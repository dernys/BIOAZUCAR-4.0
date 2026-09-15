import {
  IndustrialDataPoint,
  DataQuality,
  IndustrialTagSample,
  TagSampleQuality,
  TagSampleAvailability,
  IndustrialTagDefinition,
  ConnectionRegistryEntry,
} from "../../types";
import { validateIndustrialTagSample, SampleValidationContext } from "./IndustrialRegistryValidator";

export type DataOrigin =
  | "REAL"
  | "REAL_OT"
  | "REAL_USER"
  | "SIMULATED"
  | "CALCULATED"
  | "DEFAULT"
  | "IMPORTED"
  | "PREDICTED";

export interface DataQualityAuditResult {
  isValid: boolean;
  score: number; // 0 to 100
  origin: DataOrigin;
  quality: DataQuality;
  reasons: string[];
  latencyMs: number;
}

export interface SampleQualityAuditResult {
  isValid: boolean;
  score: number; // 0 to 100
  quality: TagSampleQuality;
  availability: TagSampleAvailability;
  reasons: string[];
  latencyMs: number;
  evaluatedSample: IndustrialTagSample;
}

export interface QualityGatePolicy {
  /** If true, strictly rejects any point where origin is not REAL */
  requireRealOriginInProduction: boolean;
  /** Maximum acceptable device-to-ingestion latency skew in milliseconds */
  maxLatencySkewMs: number;
  /** Reject values exceeding engineering limits */
  enforceEngineeringRange: boolean;
  /** Reject points without traceable equipment hierarchy */
  requireAssetLineage: boolean;
}

const DEFAULT_POLICY: QualityGatePolicy = {
  requireRealOriginInProduction: true,
  maxLatencySkewMs: 30000, // 30s
  enforceEngineeringRange: true,
  requireAssetLineage: true,
};

/**
 * IndustrialDataQualityGate
 * 
 * Central validation authority that audits every incoming industrial data point
 * before it is accepted by the Historian, KPI Engine or BioAI Models.
 * 
 * Enforces the rule: NEVER allow models to evaluate mixing REAL and SIMULATED
 * data silently.
 */
export class IndustrialDataQualityGate {
  private static instance: IndustrialDataQualityGate;
  private policy: QualityGatePolicy;
  private totalAudited: number = 0;
  private totalPassed: number = 0;
  private totalFlagged: number = 0;

  private constructor(policy: Partial<QualityGatePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  public static getInstance(policy?: Partial<QualityGatePolicy>): IndustrialDataQualityGate {
    if (!IndustrialDataQualityGate.instance) {
      IndustrialDataQualityGate.instance = new IndustrialDataQualityGate(policy);
    }
    return IndustrialDataQualityGate.instance;
  }

  /**
   * Determine exact origin of a data point or provenance string
   */
  public resolveOrigin(
    pointOrProvenance?: IndustrialDataPoint | string,
    isSimulated?: boolean
  ): DataOrigin {
    if (typeof pointOrProvenance === "object" && pointOrProvenance !== null) {
      const point = pointOrProvenance as IndustrialDataPoint;
      if (point.isSimulated || point.source === "SIMULATION") {
        return "SIMULATED";
      }
      if (point.provenance === "SIMULATED_PROCESS_MODEL") {
        return "SIMULATED";
      }
      if (point.source === "LIVE_OT" || point.source === "OPC_UA" || point.source === "MODBUS") {
        return "REAL";
      }
      return "REAL";
    }

    if (isSimulated || pointOrProvenance === "SIMULATED_PROCESS_MODEL") {
      return "SIMULATED";
    }
    if (pointOrProvenance === "OBSERVED_OT" || pointOrProvenance === "LIVE_OT") {
      return "REAL";
    }
    return isSimulated ? "SIMULATED" : "REAL";
  }

  /**
   * Audit an industrial data point against quality and governance rules
   */
  public auditPoint(
    point: IndustrialDataPoint,
    isProductionEnvironment: boolean = false
  ): DataQualityAuditResult {
    return this.audit(point, isProductionEnvironment);
  }

  public audit(
    point: IndustrialDataPoint,
    isProductionEnvironment: boolean = false
  ): DataQualityAuditResult {
    this.totalAudited++;
    const reasons: string[] = [];
    let score = 100;

    const origin = this.resolveOrigin(point);

    // 1. Production Origin Check (No stealth simulation data in production)
    if (isProductionEnvironment && this.policy.requireRealOriginInProduction) {
      if (origin !== "REAL") {
        score -= 50;
        reasons.push(`RECHAZO_ORIGEN: Se intentó inyectar dato ${origin} en entorno de producción real`);
      }
    }

    // 2. Data Quality Check
    if (point.quality === "BAD") {
      score -= 40;
      reasons.push("CALIDAD_BAD: Sensor o driver reportó fallo en lectura física");
    } else if (point.quality === "UNCERTAIN") {
      score -= 15;
      reasons.push("CALIDAD_UNCERTAIN: Lectura fuera de calibración o en degradación");
    }

    // 3. Timestamp skew and clock drift check
    const rawDeviceTime = point.deviceTimestamp || point.timestamp;
    const rawIngestTime = point.ingestionTimestamp || point.timestamp || new Date().toISOString();
    const deviceTime = rawDeviceTime ? new Date(rawDeviceTime).getTime() : NaN;
    const ingestTime = rawIngestTime ? new Date(rawIngestTime).getTime() : NaN;
    const latencyMs = (!isNaN(deviceTime) && !isNaN(ingestTime)) ? Math.abs(ingestTime - deviceTime) : 0;

    if (isNaN(deviceTime)) {
      score -= 30;
      reasons.push("TIMESTAMP_INVALIDO: deviceTimestamp no cumple formato ISO-8601");
    } else if (latencyMs > this.policy.maxLatencySkewMs) {
      score -= 15;
      reasons.push(`LATENCIA_EXCESIVA: Desfase de ${Math.round(latencyMs / 1000)}s entre sensor y servidor`);
    }

    // 4. Range and Engineering Limits
    if (this.policy.enforceEngineeringRange && typeof point.value === "number") {
      if (point.engMin !== undefined && point.value < point.engMin) {
        score -= 25;
        reasons.push(`FUERA_DE_RANGO_MIN: ${point.value} < min(${point.engMin}) ${point.unit}`);
      }
      if (point.engMax !== undefined && point.value > point.engMax) {
        score -= 25;
        reasons.push(`FUERA_DE_RANGO_MAX: ${point.value} > max(${point.engMax}) ${point.unit}`);
      }
    }

    // 5. Lineage & Asset Hierarchy
    if (this.policy.requireAssetLineage) {
      if (!point.equipmentId || point.equipmentId.trim() === "") {
        score -= 20;
        reasons.push("LINAJE_INCOMPLETO: Falta equipmentId en la jerarquía ISA-95");
      }
    }

    const finalScore = Math.max(0, score);
    const isValid = finalScore >= 60;

    if (isValid) {
      this.totalPassed++;
    } else {
      this.totalFlagged++;
    }

    return {
      isValid,
      score: finalScore,
      origin,
      quality: point.quality,
      reasons,
      latencyMs,
    };
  }

  /**
   * Audits an IndustrialTagSample, decoupling QUALITY (GOOD/BAD/UNCERTAIN)
   * from AVAILABILITY (AVAILABLE/STALE/UNAVAILABLE).
   * Validates:
   *  tenant, connection, source, timestamp, quality, availability,
   *  engineering range, data type, sampling interval, asset mapping, protocol, provenance.
   */
  public auditTagSample(
    sample: IndustrialTagSample,
    context?: SampleValidationContext,
    isProductionEnvironment: boolean = false
  ): SampleQualityAuditResult {
    this.totalAudited++;
    const reasons: string[] = [];
    let score = 100;

    // 1. Structural & Isolation Validation
    const validation = validateIndustrialTagSample(sample, context);
    if (!validation.isValid) {
      score -= 50;
      reasons.push(...validation.errors);
    }

    // 2. Separate Quality Evaluation
    let evaluatedQuality: TagSampleQuality = sample.quality || "GOOD";
    if (sample.quality === "BAD") {
      score -= 30;
      reasons.push("CALIDAD_BAD: Driver o sensor físico reportó falla");
    } else if (sample.quality === "UNCERTAIN") {
      score -= 15;
      reasons.push("CALIDAD_UNCERTAIN: Calibración dudosa o señal degradada");
    }

    // 3. Separate Availability Evaluation (AVAILABLE vs STALE vs UNAVAILABLE)
    let evaluatedAvailability: TagSampleAvailability = sample.availability || "AVAILABLE";
    const srcTimeMs = Date.parse(sample.sourceTimestamp);
    const nowMs = Date.now();
    const ageMs = !isNaN(srcTimeMs) ? nowMs - srcTimeMs : Infinity;

    const maxSilence = context?.connection?.maxSilenceMs || 10000;
    if (ageMs > maxSilence) {
      evaluatedAvailability = "STALE";
      score -= 25;
      reasons.push(`DISPONIBILIDAD_STALE: Muestra obsoleta (${Math.round(ageMs / 1000)}s sin refresco > maxSilence ${maxSilence}ms)`);
    } else if (ageMs < 0 || isNaN(srcTimeMs)) {
      evaluatedAvailability = "UNAVAILABLE";
      score -= 40;
      reasons.push("DISPONIBILIDAD_UNAVAILABLE: Marca de tiempo de origen inconsistente o no disponible");
    } else {
      evaluatedAvailability = "AVAILABLE";
    }

    // 4. Data Type Compatibility
    if (context?.tag?.dataType) {
      const expectedType = context.tag.dataType;
      const actualType = typeof sample.value;
      if ((expectedType === "NUMBER" || expectedType === "FLOAT" || expectedType === "INTEGER" || expectedType === "INT") && actualType !== "number") {
        evaluatedQuality = "BAD";
        score -= 30;
        reasons.push(`DISCORDANCIA_TIPO: El tag requiere numérico (${expectedType}), pero la muestra es '${actualType}'`);
      } else if ((expectedType === "BOOLEAN" || expectedType === "BOOL") && actualType !== "boolean") {
        evaluatedQuality = "BAD";
        score -= 30;
        reasons.push(`DISCORDANCIA_TIPO: El tag requiere booleano (${expectedType}), pero la muestra es '${actualType}'`);
      } else if (expectedType === "STRING" && actualType !== "string") {
        evaluatedQuality = "BAD";
        score -= 30;
        reasons.push(`DISCORDANCIA_TIPO: El tag requiere cadena (${expectedType}), pero la muestra es '${actualType}'`);
      }
    }

    // 5. Engineering Range Validation
    if (typeof sample.value === "number" && context?.tag?.engineeringRange) {
      const { min, max } = context.tag.engineeringRange;
      if (min !== undefined && sample.value < min) {
        evaluatedQuality = "UNCERTAIN";
        score -= 20;
        reasons.push(`FUERA_RANGO_MIN: ${sample.value} inferior al mínimo de ingeniería (${min} ${sample.unit || ''})`);
      }
      if (max !== undefined && sample.value > max) {
        evaluatedQuality = "UNCERTAIN";
        score -= 20;
        reasons.push(`FUERA_RANGO_MAX: ${sample.value} superior al máximo de ingeniería (${max} ${sample.unit || ''})`);
      }
    }

    // 6. Asset Lineage Verification
    if (!sample.assetId && !context?.tag?.assetId) {
      score -= 15;
      reasons.push("LINAJE_ASSET_FALTANTE: No se mapeó la muestra a un equipo físico de planta");
    }

    // 7. Production Origin Guard (No simulation in production)
    if (isProductionEnvironment && sample.origin === "SIMULATED") {
      score -= 50;
      reasons.push("VIOLACION_PRODUCCION: Muestra SIMULATED rechazada en entorno productivo LIVE_OT");
    }

    // 8. Three-stage Latency
    const gtwTimeMs = Date.parse(sample.gatewayTimestamp);
    const ingTimeMs = Date.parse(sample.ingestionTimestamp);
    const latencyMs = !isNaN(srcTimeMs) && !isNaN(ingTimeMs) ? Math.max(0, ingTimeMs - srcTimeMs) : 0;

    const finalScore = Math.max(0, score);
    const isValid = finalScore >= 70 && evaluatedQuality !== "BAD" && evaluatedAvailability !== "UNAVAILABLE";

    if (isValid) {
      this.totalPassed++;
    } else {
      this.totalFlagged++;
    }

    const evaluatedSample: IndustrialTagSample = {
      ...sample,
      quality: evaluatedQuality,
      availability: evaluatedAvailability,
      validationStatus: isValid ? "PASSED" : "REJECTED",
    };

    return {
      isValid,
      score: finalScore,
      quality: evaluatedQuality,
      availability: evaluatedAvailability,
      reasons,
      latencyMs,
      evaluatedSample,
    };
  }

  /**
   * Evaluates an IndustrialTagSample and returns normalized quality and availability decisions.
   */
  public evaluateSample(
    sample: IndustrialTagSample,
    context?: any,
    isProductionEnvironment: boolean = false
  ) {
    const audit = this.auditTagSample(sample, context, isProductionEnvironment);
    return {
      ...audit,
      finalQuality: audit.quality,
      finalAvailability: audit.availability,
      validationStatus: audit.evaluatedSample.validationStatus as "PASSED" | "REJECTED",
      qualityScore: audit.score,
      rejectionReasons: audit.reasons,
    };
  }

  /**
   * Diagnostic metrics
   */
  public getMetrics() {
    return {
      totalAudited: this.totalAudited,
      totalPassed: this.totalPassed,
      totalFlagged: this.totalFlagged,
      acceptanceRate:
        this.totalAudited > 0
          ? Math.round((this.totalPassed / this.totalAudited) * 1000) / 10
          : 100,
    };
  }
}

export const industrialDataQualityGate = IndustrialDataQualityGate.getInstance();
