/**
 * BioAzúcar 4.0 — Cryptographic Chained Audit Trail Engine (SEC-P0 §15 & §16)
 * ==============================================================================
 * Standards: IEC 62443-4-2 (FR 3 / FR 6), ISO 27001 A.12.4, ISA-95 Audit Traceability.
 *
 * Implements:
 * 1. Cryptographic event hash chaining (Merkle-style sequential ledger):
 *    event[n].previousHash = event[n-1].eventHash
 * 2. Mandatory Security Event Registry.
 * 3. Tamper detection: verifyAuditChainIntegrity().
 * 4. Multi-tenant isolated audit partitioning.
 */

import { sha256Hex } from "../../utils/cryptoUtils";

export type MandatorySecurityAction =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "TOKEN_REJECTED"
  | "MFA_FAILURE"
  | "MFA_ENROLL"
  | "ROLE_CHANGED"
  | "PERMISSION_CHANGED"
  | "TENANT_CREATED"
  | "TENANT_UPDATED"
  | "TENANT_DELETED"
  | "MEMBERSHIP_CHANGED"
  | "USER_CREATED"
  | "USER_DISABLED"
  | "USER_DELETED"
  | "CROSS_TENANT_ACCESS_ATTEMPT"
  | "TENANT_HEADER_SPOOFING_REJECTED"
  | "AUTHORIZATION_DENIED"
  | "SETPOINT_CHANGE"
  | "CRITICAL_COMMAND_REQUESTED"
  | "CRITICAL_COMMAND_APPROVED"
  | "CRITICAL_COMMAND_EXECUTED"
  | "CRITICAL_COMMAND_REJECTED"
  | "SECURITY_POLICY_CHANGED"
  | "FAIL_OPEN_REJECTED"
  | "HEADER_TENANT_INJECTION_REJECTED";

export interface ChainedAuditRecord {
  eventId: string;
  timestamp: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: string;
  tenantId: string;
  action: MandatorySecurityAction | string;
  resource: string;
  result: "SUCCESS" | "DENIED" | "ERROR";
  severity: "INFO" | "WARNING" | "CRITICAL";
  correlationId: string;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  previousHash: string;
  eventHash: string;
}

export const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export class AuditChainService {
  private static instance: AuditChainService | null = null;
  private lastHash: string = GENESIS_HASH;
  private chain: ChainedAuditRecord[] = [];
  private readonly maxChainLength = 1000;

  private constructor() {}

  public static getInstance(): AuditChainService {
    if (!AuditChainService.instance) {
      AuditChainService.instance = new AuditChainService();
    }
    return AuditChainService.instance;
  }

  public static resetInstance(): void {
    AuditChainService.instance = null;
  }

  /**
   * Computes the deterministic SHA-256 event hash for an audit record.
   */
  public computeEventHash(params: {
    eventId: string;
    timestamp: string;
    actorUid: string;
    actorRole: string;
    tenantId: string;
    action: string;
    resource: string;
    result: string;
    correlationId: string;
    previousHash: string;
    metadata?: Record<string, any>;
  }): string {
    const metaStr = params.metadata ? JSON.stringify(params.metadata, Object.keys(params.metadata).sort()) : "";
    const canonicalPayload = [
      params.eventId,
      params.timestamp,
      params.actorUid,
      params.actorRole,
      params.tenantId,
      params.action,
      params.resource,
      params.result,
      params.correlationId,
      params.previousHash,
      metaStr,
    ].join("::");

    return sha256Hex(canonicalPayload);
  }

  /**
   * Creates, cryptographically chains, and logs a new audit event.
   */
  public recordChainedEvent(params: {
    actorUid: string;
    actorEmail?: string;
    actorRole: string;
    tenantId: string;
    action: MandatorySecurityAction | string;
    resource: string;
    result: "SUCCESS" | "DENIED" | "ERROR";
    severity?: "INFO" | "WARNING" | "CRITICAL";
    correlationId?: string;
    sourceIp?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    eventId?: string;
    timestamp?: string;
  }): ChainedAuditRecord {
    const eventId = params.eventId || `sec-evt-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = params.timestamp || new Date().toISOString();
    const correlationId = params.correlationId || `corr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const severity = params.severity || (params.result === "DENIED" ? "WARNING" : "INFO");
    const previousHash = this.lastHash;

    const eventHash = this.computeEventHash({
      eventId,
      timestamp,
      actorUid: params.actorUid,
      actorRole: params.actorRole,
      tenantId: params.tenantId,
      action: params.action,
      resource: params.resource,
      result: params.result,
      correlationId,
      previousHash,
      metadata: params.metadata,
    });

    const record: ChainedAuditRecord = {
      eventId,
      timestamp,
      actorUid: params.actorUid,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      tenantId: params.tenantId,
      action: params.action,
      resource: params.resource,
      result: params.result,
      severity,
      correlationId,
      sourceIp: params.sourceIp,
      userAgent: params.userAgent,
      metadata: params.metadata,
      previousHash,
      eventHash,
    };

    this.lastHash = eventHash;
    this.chain.push(record);
    if (this.chain.length > this.maxChainLength) {
      this.chain.shift();
    }

    return record;
  }

  /**
   * Verifies the full cryptographic chaining integrity of a sequence of audit records.
   * Detects retroactive modification, deletion, or insertion of events.
   */
  public verifyAuditChainIntegrity(records?: ChainedAuditRecord[]): {
    isValid: boolean;
    brokenAtIndex?: number;
    expectedHash?: string;
    actualHash?: string;
    reason?: string;
  } {
    const list = records || this.chain;
    if (list.length === 0) {
      return { isValid: true };
    }

    for (let i = 0; i < list.length; i++) {
      const current = list[i];

      // 1. Verify previousHash chaining (unless it's the very first observed record)
      if (i > 0) {
        const previous = list[i - 1];
        if (current.previousHash !== previous.eventHash) {
          return {
            isValid: false,
            brokenAtIndex: i,
            expectedHash: previous.eventHash,
            actualHash: current.previousHash,
            reason: `Discrepancia en previousHash en índice ${i}: La cadena criptográfica fue rota o manipulada.`,
          };
        }
      }

      // 2. Recompute current hash and verify signature
      const computedHash = this.computeEventHash({
        eventId: current.eventId,
        timestamp: current.timestamp,
        actorUid: current.actorUid,
        actorRole: current.actorRole,
        tenantId: current.tenantId,
        action: current.action,
        resource: current.resource,
        result: current.result,
        correlationId: current.correlationId,
        previousHash: current.previousHash,
        metadata: current.metadata,
      });

      if (computedHash !== current.eventHash) {
        return {
          isValid: false,
          brokenAtIndex: i,
          expectedHash: computedHash,
          actualHash: current.eventHash,
          reason: `Alteración de datos detectada en el registro ${current.eventId}: El hash almacenado no coincide con el payload recalculado.`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Retrieves tenant-isolated chained audit logs.
   * If tenantId is not "GLOBAL", returns only events matching that tenant.
   */
  public getChainedAuditRecords(tenantId?: string): ChainedAuditRecord[] {
    const copy = JSON.parse(JSON.stringify(this.chain));
    if (tenantId && tenantId !== "GLOBAL") {
      return copy.filter((r: ChainedAuditRecord) => r.tenantId === tenantId);
    }
    return copy;
  }

  /**
   * For testing tamper detection: deliberately modifies an event in memory
   */
  public tamperRecordForTesting(index: number, modifiedField: "action" | "tenantId" | "result", newValue: any): void {
    if (this.chain[index]) {
      (this.chain[index] as any)[modifiedField] = newValue;
    }
  }
}
