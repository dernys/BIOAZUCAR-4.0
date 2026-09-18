/**
 * BioAzúcar 4.0 — Canonical Data Quality Engine & Data Truth Validator (I14 / I15)
 * 
 * Enforces industrial data quality rules:
 *  1. Golden Rule: "SIMULATED jamás se vuelve REAL" (No simulation falsification).
 *  2. Range validation (engMin / engMax).
 *  3. Stale & Frozen signal detection (no flatlining on dynamic process tags).
 *  4. Rate-of-Change / Outlier jump detection.
 *  5. Clock Skew and Timeliness auditing.
 *  6. Canonical Data Lineage and Provenance assignment.
 */

import {
  IndustrialDataPoint,
  DataQuality,
} from "../../types";

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
  finalQuality: DataQuality;
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
    let quality: DataQuality = raw.quality || "GOOD";

    // 1. Immutable Data Truth Rule: "SIMULATED jamás se vuelve REAL"
    const wasSimulated = raw.isSimulated === true || raw.provenance === "SIMULATED_PROCESS_MODEL";
    let isSimulated = wasSimulated;
    let provenance = raw.provenance || (wasSimulated ? "SIMULATED_PROCESS_MODEL" : "OBSERVED_OT");

    // Defense against spoofing: If source claims physical but simulation flags are set
    if (wasSimulated) {
      isSimulated = true;
      provenance = "SIMULATED_PROCESS_MODEL";
      if (raw.provenance === "OBSERVED_OT" || raw.provenance === "PHYSICAL_OT") {
        reasons.push("PROVENANCE_MUTATION_BLOCKED: Simulated point cannot be rebranded as physical");
      }
    }

    const tag = raw.tag || "UNKNOWN_TAG";
    const rule = this.rules.get(tag);
    const numValue = typeof raw.value === "number" ? raw.value : typeof raw.engValue === "number" ? raw.engValue : NaN;

    // 2. Engineering Range Validation
    if (!isNaN(numValue)) {
      const min = raw.engMin ?? rule?.engMin;
      const max = raw.engMax ?? rule?.engMax;

      if (min !== undefined && numValue < min) {
        quality = "BAD";
        reasons.push(`OUT_OF_RANGE_LOW: value ${numValue} < min ${min}`);
      } else if (max !== undefined && numValue > max) {
        quality = "BAD";
        reasons.push(`OUT_OF_RANGE_HIGH: value ${numValue} > max ${max}`);
      }
    }

    // 3. Rate of Change & Frozen Signal Detection
    const prev = this.tagHistory.get(tag);
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
            if (quality === "GOOD") quality = "UNCERTAIN";
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
          if (quality === "GOOD") quality = "UNCERTAIN";
          reasons.push(`EXCESSIVE_RATE_OF_CHANGE: rate ${ratePerSec.toFixed(2)}/s exceeded limit ${maxRate}/s`);
        }
      }

      // Update history
      prev.lastValue = raw.value ?? numValue;
      prev.lastTimestamp = deviceTime;
      prev.sampleCount++;
    } else {
      // First observation
      this.tagHistory.set(tag, {
        lastValue: raw.value ?? numValue,
        lastTimestamp: deviceTime,
        frozenSinceTimestamp: now,
        sampleCount: 1,
      });
    }

    // 4. Clock Skew Auditing
    const ingestionTime = raw.ingestionTimestamp ? new Date(raw.ingestionTimestamp).getTime() : now;
    const clockSkewMs = Math.abs(ingestionTime - deviceTime);
    if (clockSkewMs > 300000) { // 5 minutes tolerance
      reasons.push(`DEVICE_CLOCK_SKEW: ${Math.round(clockSkewMs / 1000)}s discrepancy`);
    }

    // Assemble Canonical Industrial Data Point
    const normalizedPoint: IndustrialDataPoint = {
      id: raw.id || `dp-${tag}-${now}`,
      tag,
      equipmentId: raw.equipmentId,
      deviceId: raw.deviceId,
      assetId: raw.assetId,
      siteId: raw.siteId,
      areaId: raw.areaId,
      tenantId: raw.tenantId,
      value: raw.value !== undefined ? raw.value : numValue,
      rawValue: raw.rawValue !== undefined ? raw.rawValue : raw.value,
      engValue: !isNaN(numValue) ? numValue : undefined,
      unit: raw.unit || "",
      dataType: raw.dataType || (typeof raw.value === "boolean" ? "BOOLEAN" : typeof raw.value === "string" ? "STRING" : "FLOAT"),
      scale: raw.scale ?? 1,
      offset: raw.offset ?? 0,
      deadband: raw.deadband ?? rule?.minDeadband ?? 0,
      samplingInterval: raw.samplingInterval,
      source: raw.source || (isSimulated ? "SIMULATION" : "OPC_UA"),
      protocol: raw.protocol || (isSimulated ? "SIMULATOR" : "OPC-UA"),
      quality,
      qualityReason: reasons.length > 0 ? reasons.join(" | ") : raw.qualityReason,
      deviceTimestamp: raw.deviceTimestamp || nowIso,
      timestamp: raw.timestamp || raw.deviceTimestamp || nowIso,
      sourceTimestamp: raw.sourceTimestamp || raw.deviceTimestamp || nowIso,
      ingestionTimestamp: raw.ingestionTimestamp || nowIso,
      sequence: raw.sequence,
      sequenceNumber: raw.sequenceNumber,
      isHistorical: raw.isHistorical ?? false,
      isSimulated,
      provenance,
      securityClearanceLevel: raw.securityClearanceLevel ?? 1,
      engMin: raw.engMin ?? rule?.engMin,
      engMax: raw.engMax ?? rule?.engMax,
      description: raw.description,
      correlationId: raw.correlationId,
      schemaVersion: "4.0.0",
    };

    return {
      isValid: quality !== "BAD",
      finalQuality: quality,
      reasons,
      normalizedPoint,
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
