/**
 * BioAzúcar 4.0 — Canonical Data Quality Engine & Data Truth Validator (I14 / I15 / I22)
 * 
 * Enforces industrial data quality rules and provenance invariants:
 *  1. Golden Rule: "SIMULATED jamás se vuelve REAL" (No simulation falsification).
 *  2. "STALE ≠ GOOD", "BAD ≠ TRUSTED", "UNCERTAIN ≠ GOOD", "COMM_FAILURE ≠ ZERO".
 *  3. Range validation (engMin / engMax) -> OUT_OF_RANGE.
 *  4. Stale & Frozen signal detection -> TIMEOUT / STALE.
 *  5. Rate-of-Change / Outlier jump detection -> RATE_OF_CHANGE_EXCEEDED.
 *  6. Clock Skew and Timeliness auditing.
 *  7. Canonical Data Lineage and Provenance assignment (17 attributes immutable).
 */

import {
  IndustrialDataPoint,
  IndustrialRuntimeMode,
  IndustrialSourceType,
  CanonicalIndustrialProtocol,
  IndustrialDataType,
  IndustrialDataQuality,
  IndustrialQualityReason,
  IndustrialCalibrationState,
  normalizeProtocol,
  DataQuality,
} from "../../types";
import { getRuntimeProfile } from "./config/runtimeProfile";

export interface QualityValidationRule {
  tag: string;
  engMin?: number;
  engMax?: number;
  maxRateOfChangePerSec?: number;
  frozenTimeoutMs?: number;
  minDeadband?: number;
  isStaticConstant?: boolean;
}

export interface QualityAuditResult {
  isValid: boolean;
  finalQuality: IndustrialDataQuality | DataQuality;
  reasons: string[];
  normalizedPoint: IndustrialDataPoint;
}

export class DataQualityEngine {
  private static instance: DataQualityEngine;

  // Track previous readings per tag for rate-of-change and frozen detection
  private tagHistory = new Map<
    string,
    {
      lastValue: number | string | boolean;
      lastTimestamp: number;
      frozenSinceTimestamp: number;
      sampleCount: number;
      provenance?: string;
      runtimeMode?: IndustrialRuntimeMode;
    }
  >();

  // Registered rules per tag pattern or specific tag
  private rules = new Map<string, QualityValidationRule>();

  private constructor() {
    this.registerDefaultRules();
  }

  public static getInstance(): DataQualityEngine {
    if (!DataQualityEngine.instance) {
      DataQualityEngine.instance = new DataQualityEngine();
    }
    return DataQualityEngine.instance;
  }

  private registerDefaultRules(): void {
    // Boiler Pressure (HP)
    this.registerRule({
      tag: "TI-HP-STEAM-01",
      engMin: 0,
      engMax: 120,
      maxRateOfChangePerSec: 15,
      frozenTimeoutMs: 60000,
      minDeadband: 0.05,
    });

    // Sucrose Extraction
    this.registerRule({
      tag: "TANDEM-1-EXTRACTION",
      engMin: 80,
      engMax: 100,
      maxRateOfChangePerSec: 5,
      frozenTimeoutMs: 120000,
      minDeadband: 0.02,
    });

    // Cane Milling Rate (TCH)
    this.registerRule({
      tag: "MILLING-TCH-01",
      engMin: 0,
      engMax: 1200,
      maxRateOfChangePerSec: 100,
      frozenTimeoutMs: 60000,
      minDeadband: 0.5,
    });

    // Power Export (MW)
    this.registerRule({
      tag: "TG-POWER-EXPORT-01",
      engMin: -5, // -5 indicates import
      engMax: 60,
      maxRateOfChangePerSec: 10,
      frozenTimeoutMs: 60000,
      minDeadband: 0.1,
    });

    // Imbibition Water Flow (m3/h)
    this.registerRule({
      tag: "FIC-IMBIBITION-01",
      engMin: 0,
      engMax: 150,
      maxRateOfChangePerSec: 25,
      frozenTimeoutMs: 60000,
      minDeadband: 0.2,
    });
  }

  public registerRule(rule: QualityValidationRule): void {
    this.rules.set(rule.tag, rule);
  }

  /**
   * Evaluates and normalizes an incoming data point.
   * Guarantees that simulated data is NEVER flagged as physical truth.
   */
  public evaluate(raw: Partial<IndustrialDataPoint>): QualityAuditResult {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const reasons: string[] = [];

    const activeProfile = getRuntimeProfile();
    const tag = raw.tagId || raw.tag || "UNKNOWN_TAG";
    const prev = this.tagHistory.get(tag);

    // 1. Immutable Data Truth Rule: "SIMULATED jamás se vuelve REAL"
    const wasSimulated = Boolean(
      raw.runtimeMode === "SIMULATION" ||
      raw.sourceType === "SIMULATOR" ||
      raw.sourceType === "MOCK" ||
      raw.isSimulated === true ||
      raw.provenance === "SIMULATED_PROCESS_MODEL" ||
      (prev && prev.runtimeMode === "SIMULATION")
    );

    let isSimulated: boolean = wasSimulated ? true : (raw.isSimulated === false ? false : false);
    let provenance = raw.provenance || (wasSimulated ? "SIMULATED_PROCESS_MODEL" : "PHYSICAL_OT");

    // Defense against spoofing: If source claims physical/LIVE_OT but simulation flags are set
    if (wasSimulated) {
      isSimulated = true;
      provenance = "SIMULATED_PROCESS_MODEL";
      if (
        raw.provenance === "OBSERVED_OT" ||
        raw.provenance === "PHYSICAL_OT" ||
        raw.source === "LIVE_OT"
      ) {
        reasons.push("PROVENANCE_MUTATION_BLOCKED: Simulated point cannot be rebranded as LIVE_OT or physical");
      }
    }

    // In PRODUCTION profile: Rejection of any simulated / mock telemetry
    if (activeProfile === "PRODUCTION" && (wasSimulated || raw.isSimulated === true)) {
      reasons.push("CRITICAL_PROVENANCE_VIOLATION: Simulated point rejected in PRODUCTION profile");
    }

    // Prevent runtimeMode mutation downstream (e.g. SIMULATION -> PRODUCTION)
    let runtimeMode: IndustrialRuntimeMode = raw.runtimeMode || (isSimulated ? "SIMULATION" : activeProfile);
    if (prev && prev.runtimeMode === "SIMULATION" && raw.runtimeMode === "PRODUCTION") {
      runtimeMode = "SIMULATION";
      reasons.push("PROVENANCE_MUTATION_BLOCKED: runtimeMode cannot be mutated from SIMULATION to PRODUCTION");
    }

    let quality: IndustrialDataQuality = (raw.quality as IndustrialDataQuality) || "GOOD";
    let qualityReason: IndustrialQualityReason = (raw.qualityReason as IndustrialQualityReason) || "NORMAL";

    // If communication failure already occurred, propagate faithfully (COMM_FAILURE != ZERO)
    if (raw.qualityReason === "COMM_FAILURE" || raw.quality === "BAD") {
      quality = "BAD";
      qualityReason = "COMM_FAILURE";
      reasons.push("COMM_FAILURE: Source communication failure detected");
    }

    const rule = this.rules.get(tag);
    const numValue =
      typeof raw.value === "number"
        ? raw.value
        : typeof raw.engValue === "number"
        ? raw.engValue
        : NaN;

    // 2. Engineering Range Validation
    if (!isNaN(numValue)) {
      const min = raw.engMin ?? rule?.engMin;
      const max = raw.engMax ?? rule?.engMax;

      if (min !== undefined && numValue < min) {
        quality = "BAD";
        qualityReason = "OUT_OF_RANGE";
        reasons.push(`OUT_OF_RANGE_LOW: value ${numValue} < min ${min}`);
      } else if (max !== undefined && numValue > max) {
        quality = "BAD";
        qualityReason = "OUT_OF_RANGE";
        reasons.push(`OUT_OF_RANGE_HIGH: value ${numValue} > max ${max}`);
      }
    }

    // 3. Rate of Change & Frozen Signal Detection
    const deviceTime = raw.deviceTimestamp ? new Date(raw.deviceTimestamp).getTime() : now;

    if (prev && !isNaN(numValue) && typeof prev.lastValue === "number") {
      const deltaMs = Math.max(1, deviceTime - prev.lastTimestamp);
      const deltaSec = deltaMs / 1000;
      const deltaVal = Math.abs(numValue - prev.lastValue);
      const deadband = rule?.minDeadband ?? 0.001;

      // Frozen signal check (unless statically constant)
      if (!rule?.isStaticConstant) {
        if (deltaVal <= deadband) {
          const frozenDuration = now - prev.frozenSinceTimestamp;
          const maxFrozenMs = rule?.frozenTimeoutMs ?? 180000; // 3 min default
          if (frozenDuration > maxFrozenMs) {
            if (quality === "GOOD") {
              quality = "UNCERTAIN";
              qualityReason = "TIMEOUT";
            }
            reasons.push(`STALE_FROZEN_SIGNAL: flatline for ${(frozenDuration / 1000).toFixed(0)}s`);
          }
        } else {
          // Reset frozen timer on real movement
          prev.frozenSinceTimestamp = now;
        }
      }

      // Rate of change spike detection
      const maxRate = rule?.maxRateOfChangePerSec;
      if (maxRate && deltaSec > 0) {
        const ratePerSec = deltaVal / deltaSec;
        if (ratePerSec > maxRate) {
          if (quality === "GOOD" || quality === "SIMULATED") {
            quality = "UNCERTAIN";
            qualityReason = "RATE_OF_CHANGE_EXCEEDED";
          }
          reasons.push(`EXCESSIVE_RATE_OF_CHANGE: rate ${ratePerSec.toFixed(2)}/s exceeded limit ${maxRate}/s`);
        }
      }

      // Update history
      prev.lastValue = raw.value ?? numValue;
      prev.lastTimestamp = deviceTime;
      prev.sampleCount++;
      prev.runtimeMode = runtimeMode;
    } else {
      // First observation
      this.tagHistory.set(tag, {
        lastValue: raw.value ?? numValue,
        lastTimestamp: deviceTime,
        frozenSinceTimestamp: now,
        sampleCount: 1,
        runtimeMode,
      });
    }

    // 4. Clock Skew Auditing
    const ingestionTime = raw.ingestionTimestamp ? new Date(raw.ingestionTimestamp).getTime() : now;
    const clockSkewMs = Math.abs(ingestionTime - deviceTime);
    if (clockSkewMs > 300000) { // 5 minutes tolerance
      reasons.push(`DEVICE_CLOCK_SKEW: ${Math.round(clockSkewMs / 1000)}s discrepancy`);
    }

    // 5. Provenance integrity check (provenance cannot be silently removed)
    const sourceId = raw.sourceId || raw.deviceId || (isSimulated ? "SIM-SOURCE-01" : "PLC-SOURCE-01");
    const driverId = raw.driverId || raw.deviceId || "DRIVER-UNKNOWN";
    const deviceId = raw.deviceId || raw.equipmentId || "DEV-DEFAULT";
    const assetId = raw.assetId || raw.equipmentId || tag.split(".")[0] || "ASSET-DEFAULT";
    const protocol: CanonicalIndustrialProtocol = raw.protocol
      ? normalizeProtocol(raw.protocol)
      : (isSimulated ? "CANONICAL_TEST" : "OPC_UA");

    const sourceType: IndustrialSourceType = raw.sourceType || (isSimulated ? "SIMULATOR" : "PLC");
    const dataType: IndustrialDataType =
      raw.dataType && ["FLOAT", "FLOAT32", "FLOAT64", "INT16", "INT32", "INT64", "UINT16", "UINT32", "BOOLEAN", "STRING"].includes(raw.dataType)
        ? (raw.dataType as IndustrialDataType)
        : typeof raw.value === "boolean"
        ? "BOOLEAN"
        : typeof raw.value === "string"
        ? "STRING"
        : "FLOAT";

    const calibrationState: IndustrialCalibrationState = raw.calibrationState || "CALIBRATED";
    const sequence = raw.sequence ?? raw.sequenceNumber ?? 0;
    const engineeringUnit = raw.engineeringUnit ?? raw.unit ?? "";

    if (reasons.length > 0 && quality === "GOOD") {
      // If reasons contain violations, adjust quality
      if (reasons.some((r) => r.includes("VIOLATION") || r.includes("BLOCKED"))) {
        quality = activeProfile === "PRODUCTION" || !isSimulated ? "BAD" : "SIMULATED";
        qualityReason = "PROVENANCE_MISMATCH";
      }
    }

    // Assemble Canonical Industrial Data Point (All 17 fields strictly populated)
    const normalizedPoint: IndustrialDataPoint = {
      runtimeMode,
      sourceType,
      sourceId,
      driverId,
      protocol,
      deviceId,
      assetId,
      tagId: tag,
      value: raw.value !== undefined ? raw.value : (!isNaN(numValue) ? numValue : 0),
      engineeringUnit,
      dataType,
      deviceTimestamp: raw.deviceTimestamp || nowIso,
      ingestionTimestamp: raw.ingestionTimestamp || nowIso,
      sequence,
      quality,
      qualityReason,
      calibrationState,
      schemaVersion: "4.0.0",

      // Retrocompatibility aliases
      id: raw.id || `dp-${tag}-${now}`,
      tag,
      equipmentId: assetId,
      siteId: raw.siteId,
      areaId: raw.areaId,
      tenantId: raw.tenantId,
      rawValue: raw.rawValue !== undefined ? raw.rawValue : raw.value,
      engValue: !isNaN(numValue) ? numValue : undefined,
      unit: engineeringUnit,
      scale: raw.scale ?? 1,
      offset: raw.offset ?? 0,
      deadband: raw.deadband ?? rule?.minDeadband ?? 0,
      samplingInterval: raw.samplingInterval,
      source: isSimulated ? "SIMULATION" : "OPC_UA",
      isHistorical: raw.isHistorical ?? false,
      isSimulated,
      provenance,
      securityClearanceLevel: raw.securityClearanceLevel ?? 1,
      engMin: raw.engMin ?? rule?.engMin,
      engMax: raw.engMax ?? rule?.engMax,
      description: raw.description,
      correlationId: raw.correlationId,
      sequenceNumber: sequence,
    };

    return {
      isValid: quality !== "BAD",
      finalQuality: quality,
      reasons,
      normalizedPoint: Object.freeze(normalizedPoint),
    };
  }

  /**
   * Resets internal history caches (useful during test teardown).
   */
  public resetHistory(): void {
    this.tagHistory.clear();
  }
}

export const dataQualityEngine = DataQualityEngine.getInstance();
