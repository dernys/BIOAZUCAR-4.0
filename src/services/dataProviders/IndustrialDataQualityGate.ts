import { IndustrialDataPoint, DataQuality } from "../../types";

export type DataOrigin = "REAL" | "SIMULATED" | "PREDICTED" | "DEFAULT";

export interface DataQualityAuditResult {
  isValid: boolean;
  score: number; // 0 to 100
  origin: DataOrigin;
  quality: DataQuality;
  reasons: string[];
  latencyMs: number;
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
   * Determine exact origin of a data point
   */
  public resolveOrigin(point: IndustrialDataPoint): DataOrigin {
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

  /**
   * Audit an industrial data point against quality and governance rules
   */
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
    const deviceTime = new Date(point.deviceTimestamp).getTime();
    const ingestTime = new Date(point.ingestionTimestamp).getTime();
    const latencyMs = Math.abs(ingestTime - deviceTime);

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
