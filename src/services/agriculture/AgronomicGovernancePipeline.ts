/**
 * BioAzúcar 4.0 — Agronomic Data Governance Pipeline (Iteration 37 — MOM / L3-L4)
 * ==============================================================================
 * Conforms to IEC 62443 SL3 & ISA-95 Level 3/4 Governance.
 * 
 * Guarantees:
 * 1. Strict mathematical & physiological validation of sugarcane metrics:
 *    - Brix: 8.0°Bx - 28.0°Bx
 *    - Pol: 5.0% - 24.0%
 *    - Cardinal Law: Pol <= Brix (apparent purity <= 100%)
 *    - Apparent Purity: 50.0% - 100.0%
 *    - Fiber: 8.0% - 22.0%
 *    - Trash: 0.0% - 25.0%
 * 2. Immutable Cryptographic Lineage (SHA-256 Seal on every lab sample).
 * 3. Batey Weighbridge scale reconciliation (gross - tare = net) and field yield discrepancy control.
 * 4. Multi-Tenant isolation & audit logging.
 */

import {
  CaneLaboratorySample,
  CaneLabValidationOptions,
  BateyWeighbridgeReconciliation,
} from "../../types/agriculture";
import {
  AgronomicValidationService,
  AgronomicValidationError,
} from "./AgronomicValidationService";
import { logAuditEventToDb } from "../dbService";

export interface CaneSampleSubmissionResult {
  success: boolean;
  sample?: CaneLaboratorySample;
  errors?: AgronomicValidationError[];
  warnings?: AgronomicValidationError[];
  auditRecordId: string;
}

export class AgronomicGovernancePipeline {
  private static instance: AgronomicGovernancePipeline | null = null;

  // Multi-tenant partitioned repository: tenantId -> Map<sampleId, CaneLaboratorySample>
  private samplesByTenant: Map<string, Map<string, CaneLaboratorySample>> = new Map();

  // Multi-tenant partitioned weighbridge reconciliations
  private reconciliationsByTenant: Map<string, BateyWeighbridgeReconciliation[]> = new Map();

  private constructor() {}

  public static getInstance(): AgronomicGovernancePipeline {
    if (!AgronomicGovernancePipeline.instance) {
      AgronomicGovernancePipeline.instance = new AgronomicGovernancePipeline();
    }
    return AgronomicGovernancePipeline.instance;
  }

  /**
   * Submits a cane laboratory sample to the governance validation pipeline.
   * If valid, seals with SHA-256 and persists to tenant partition.
   * If invalid, rejects deterministically with agronomic error explanations.
   */
  public recordCaneLaboratorySample(
    raw: any,
    options: CaneLabValidationOptions = {}
  ): CaneSampleSubmissionResult {
    const validationResult = AgronomicValidationService.validateCaneLaboratorySample(raw, options);
    const auditRecordId = `audit-lab-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    if (!validationResult.isValid) {
      // Log rejection audit event
      const tenantId = raw?.tenantId || "UNKNOWN_TENANT";
      logAuditEventToDb({
        tenantId,
        action: "CANELAB_SAMPLE_REJECTED",
        module: "AGRONOMY_LIMS",
        targetId: raw?.sampleId || "UNKNOWN_SAMPLE",
        userRole: "analista_calidad",
        userName: raw?.analystId || "UNKNOWN_ANALYST",
        status: "DENIED",
        ipAddress: "127.0.0.1",
        newValue: validationResult.errors.map(e => e.rule).join(" | "),
      }).catch(() => {});

      return {
        success: false,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        auditRecordId,
      };
    }

    const sample = validationResult.normalizedData;
    const tenantId = sample.tenantId;

    if (!this.samplesByTenant.has(tenantId)) {
      this.samplesByTenant.set(tenantId, new Map());
    }

    const tenantMap = this.samplesByTenant.get(tenantId)!;
    tenantMap.set(sample.sampleId, sample);

    // Log approval audit event
    logAuditEventToDb({
      tenantId,
      action: "CANELAB_SAMPLE_APPROVED",
      module: "AGRONOMY_LIMS",
      targetId: sample.sampleId,
      userRole: "analista_calidad",
      userName: sample.analystId,
      status: "AUTHORIZED",
      ipAddress: "127.0.0.1",
      newValue: `Muestra ${sample.sampleCode} sellada con SHA-256 (${sample.cryptographicHash.slice(0, 12)}...). Brix: ${sample.brixDegrees}°Bx, Pol: ${sample.polPercent}%, Pureza: ${sample.apparentPurity}%.`,
    }).catch(() => {});

    return {
      success: true,
      sample,
      warnings: validationResult.warnings,
      auditRecordId,
    };
  }

  /**
   * Reconciles weighbridge scale weights with agricultural projections and records discrepancy.
   */
  public reconcileWeighbridgeReception(params: {
    estimatedFieldTons: number;
    grossWeightTons: number;
    tareWeightTons: number;
    ticketNumber: string;
    plotCode: string;
    varietyCode: string;
    tenantId: string;
    tolerancePercent?: number;
  }): BateyWeighbridgeReconciliation {
    const reconciliation = AgronomicValidationService.validateBateyWeighbridgeReconciliation(params);

    if (!this.reconciliationsByTenant.has(params.tenantId)) {
      this.reconciliationsByTenant.set(params.tenantId, []);
    }

    const tenantList = this.reconciliationsByTenant.get(params.tenantId)!;
    tenantList.push(reconciliation);

    if (reconciliation.status === "WARNING_DESVIACION") {
      logAuditEventToDb({
        tenantId: params.tenantId,
        action: "WEIGHBRIDGE_DISCREPANCY_FLAGGED",
        module: "BASCULA_RECEPCION",
        targetId: reconciliation.ticketNumber,
        userRole: "operador",
        userName: "BASCULA_AUTOMATION",
        status: "AUTHORIZED",
        ipAddress: "127.0.0.1",
        newValue: `Desviación en báscula detectada en ticket ${reconciliation.ticketNumber} (${reconciliation.plotCode}): Estimado ${reconciliation.estimatedFieldTons}t vs Báscula ${reconciliation.netWeightTons}t (Desvío: ${reconciliation.variancePercent}% > tolerancia).`,
      }).catch(() => {});
    }

    return reconciliation;
  }

  /**
   * Verifies the cryptographic integrity (tamper detection) of an existing sample.
   */
  public verifySampleIntegrity(
    sampleId: string,
    tenantId: string
  ): { valid: boolean; sample?: CaneLaboratorySample; computedHash?: string; recordedHash?: string; reason?: string } {
    const tenantMap = this.samplesByTenant.get(tenantId);
    if (!tenantMap) {
      return {
        valid: false,
        reason: `No se encontraron registros para el tenant '${tenantId}'.`,
      };
    }

    const sample = tenantMap.get(sampleId);
    if (!sample) {
      return {
        valid: false,
        reason: `Muestra '${sampleId}' no encontrada en el tenant '${tenantId}'.`,
      };
    }

    const check = AgronomicValidationService.verifyCaneSampleIntegrity(sample);

    if (!check.isValid) {
      logAuditEventToDb({
        tenantId,
        action: "TAMPER_DETECTED",
        module: "AGRONOMY_GOVERNANCE",
        targetId: sample.sampleId,
        userRole: "administrador",
        userName: "SYSTEM_GOVERNANCE_WATCHDOG",
        status: "DENIED",
        ipAddress: "127.0.0.1",
        newValue: `Alerta de alteración retroactiva en muestra ${sample.sampleCode}: Sello calculado ${check.computedHash.slice(0, 12)} difiere del registrado ${sample.cryptographicHash.slice(0, 12)}.`,
      }).catch(() => {});
    }

    return {
      valid: check.isValid,
      sample,
      computedHash: check.computedHash,
      recordedHash: sample.cryptographicHash,
      reason: check.reason,
    };
  }

  /**
   * Retrieves all laboratory samples belonging strictly to a tenant (Multi-tenant partition).
   */
  public getSamplesByTenant(tenantId: string): CaneLaboratorySample[] {
    const tenantMap = this.samplesByTenant.get(tenantId);
    if (!tenantMap) return [];
    return Array.from(tenantMap.values());
  }

  /**
   * Retrieves a single sample by ID with tenant verification.
   */
  public getSampleById(sampleId: string, tenantId: string): CaneLaboratorySample | undefined {
    return this.samplesByTenant.get(tenantId)?.get(sampleId);
  }

  /**
   * Simulates an unauthorized database tampering attempt for validation tests.
   */
  public tamperSampleForAuditTest(
    sampleId: string,
    tenantId: string,
    field: "brixDegrees" | "polPercent",
    tamperedValue: number
  ): CaneLaboratorySample | null {
    const sample = this.getSampleById(sampleId, tenantId);
    if (!sample) return null;

    // Mutate the record in place WITHOUT recomputing the cryptographic hash
    (sample as any)[field] = tamperedValue;
    return sample;
  }

  /**
   * Runs an audit over all samples in a tenant partition to detect any tampered records.
   */
  public auditAllSamplesForTenant(tenantId: string): {
    totalAudited: number;
    validCount: number;
    tamperedCount: number;
    tamperedSampleIds: string[];
  } {
    const samples = this.getSamplesByTenant(tenantId);
    let validCount = 0;
    let tamperedCount = 0;
    const tamperedSampleIds: string[] = [];

    for (const sample of samples) {
      const integrity = AgronomicValidationService.verifyCaneSampleIntegrity(sample);
      if (integrity.isValid) {
        validCount++;
      } else {
        tamperedCount++;
        tamperedSampleIds.push(sample.sampleId);
      }
    }

    return {
      totalAudited: samples.length,
      validCount,
      tamperedCount,
      tamperedSampleIds,
    };
  }

  /**
   * Resets all in-memory collections (for test isolation).
   */
  public resetPipelineForTesting(): void {
    this.samplesByTenant.clear();
    this.reconciliationsByTenant.clear();
  }
}
