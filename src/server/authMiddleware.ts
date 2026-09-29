import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { UserRole } from "../types";
import { getAdminAuth, getAdminFirestore } from "./firebaseAdmin";
import { MembershipService } from "./membershipService";
import { systemLogger } from "../services/logger/IndustrialLogger";
import { auditEventsTotal, crossTenantViolationsTotal } from "../services/metrics";
import {
  AuthenticatedPrincipal,
  AtomicPermission,
  hasAtomicPermission,
  validateSuperAdminIntegrity,
  ROLE_ATOMIC_PERMISSIONS,
} from "../types/securityPrincipal";
import { AuditChainService, MandatorySecurityAction } from "../services/security/AuditChainService";

export interface AuthenticatedUser {
  id?: string;
  uid: string;
  email: string;
  role: string;
  tenantId: string;
  isSuperAdmin: boolean;
  securityLevel: number;
  permissions?: string[];
  scope?: "GLOBAL" | "TENANT";
  authenticationAssurance?: "AAL1" | "AAL2" | "AAL3";
  principal?: AuthenticatedPrincipal;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      principal?: AuthenticatedPrincipal;
      correlationId?: string;
    }
  }
}

// In-memory sliding window rate limiter
interface RateLimitEntry {
  count: number;
  resetTime: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

export function rateLimiter(limit: number = 30, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.user?.uid || req.ip || "unknown").toString();
    const now = Date.now();
    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count++;
    }

    rateLimitMap.set(key, record);

    if (record.count > limit) {
      return res.status(429).json({
        error: "Demasiadas peticiones a la API de IA (Rate limit exceeded). Espere un momento.",
        retryAfterSec: Math.ceil((record.resetTime - now) / 1000),
      });
    }

    next();
  };
}

export function resetRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Server-Side Security Headers (IEC 62443 / OWASP ASVS compliant)
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https: wss: ws:; frame-ancestors 'self' https://ai.studio https://*.google.com https://*.run.app;"
  );
  // Note: Alignment marker with IEC 62443 security design principles
  res.setHeader("X-Industrial-Security", "IEC-62443-SL3");
  next();
}

/**
 * Server-side audit log entry model with IEC 62443 traceability
 */
export interface ServerAuditRecord {
  id: string;
  eventId?: string;
  timestamp: string;
  actorUid: string;
  userId?: string;
  actorEmail?: string;
  actorRole: string;
  userRole?: string;
  tenantId: string;
  action: string;
  eventType?: string;
  resource: string;
  result: "SUCCESS" | "DENIED" | "ERROR";
  severity?: "INFO" | "WARNING" | "CRITICAL";
  correlationId?: string;
  ip?: string;
  sourceIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  previousHash?: string;
  eventHash?: string;
}

const AUDIT_FILE_PATH = process.env.BIOAZUCAR_AUDIT_LOG_FILE || path.join(process.cwd(), "data", "server-audit-trail.jsonl");

// Load existing audit entries from disk on server boot (IEC 62443 Non-Repudiation)
const serverAuditTrail: ServerAuditRecord[] = [];
try {
  if (fs.existsSync(AUDIT_FILE_PATH)) {
    const rawLines = fs.readFileSync(AUDIT_FILE_PATH, "utf8").split("\n").filter(Boolean);
    const recentLines = rawLines.slice(-500);
    for (const line of recentLines) {
      try {
        serverAuditTrail.push(JSON.parse(line));
      } catch {
        // Skip malformed line
      }
    }
  }
} catch {
  // Silent fallback to clean in-memory buffer
}

import { sanitizeAuditMetadata } from "../utils/securitySanitizer";
export { sanitizeAuditMetadata };

export function logServerAuditEvent(record: Partial<ServerAuditRecord>): ServerAuditRecord {
  const actorUid = record.actorUid || record.userId || "ANONYMOUS";
  const actorRole = record.actorRole || record.userRole || "NONE";
  const action = record.action || record.eventType || "OPERATION";
  const tenantId = record.tenantId || "UNKNOWN";
  const id = record.id || record.eventId || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = record.timestamp || new Date().toISOString();
  const correlationId = record.correlationId || `corr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const sanitizedMetadata = sanitizeAuditMetadata(record.metadata);

  // Cryptographic Chained Audit Trail (IEC 62443 SL3 Merkle-style sequential ledger)
  const auditChain = AuditChainService.getInstance();
  const chainedRecord = auditChain.recordChainedEvent({
    eventId: id,
    timestamp,
    actorUid,
    actorEmail: record.actorEmail,
    actorRole,
    tenantId,
    action,
    resource: record.resource || "/api",
    result: record.result || "SUCCESS",
    severity: record.severity,
    correlationId,
    sourceIp: record.sourceIp || record.ip,
    userAgent: record.userAgent,
    metadata: sanitizedMetadata,
  });

  const fullRecord: ServerAuditRecord = {
    id,
    eventId: id,
    timestamp,
    actorUid,
    userId: actorUid,
    actorEmail: record.actorEmail,
    actorRole,
    userRole: actorRole,
    tenantId,
    action,
    eventType: record.eventType || action,
    resource: record.resource || "/api",
    result: record.result || "SUCCESS",
    severity: record.severity || (record.result === "DENIED" ? "WARNING" : "INFO"),
    correlationId,
    ip: record.ip || record.sourceIp,
    sourceIp: record.sourceIp || record.ip,
    userAgent: record.userAgent,
    metadata: sanitizedMetadata,
    previousHash: chainedRecord.previousHash,
    eventHash: chainedRecord.eventHash,
  };

  serverAuditTrail.push(fullRecord);
  if (serverAuditTrail.length > 500) {
    serverAuditTrail.shift();
  }

  // 1. Structured JSON Logger output
  systemLogger.audit(`[AUDIT] ${fullRecord.action} by ${fullRecord.actorUid} (${fullRecord.actorRole}) - Result: ${fullRecord.result}`, {
    auditRecord: fullRecord,
  });

  // 2. Prometheus OpenMetrics telemetry counter
  try {
    auditEventsTotal.inc({
      tenant_id: fullRecord.tenantId || "UNKNOWN",
      action: fullRecord.action,
      result: fullRecord.result,
      severity: fullRecord.severity,
    });
  } catch {
    // Prometheus metric increment error handled gracefully
  }

  // 3. Persistent Disk Append (Immunity against server restart)
  try {
    const dir = path.dirname(AUDIT_FILE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(AUDIT_FILE_PATH, JSON.stringify(fullRecord) + "\n", "utf8");
  } catch (_fileErr) {
    // Disk write error handled gracefully
  }

  // 4. Durable Firestore Collection Persistence (IEC 62443 Centralized Tamper-Proof Audit)
  persistAuditEventToFirestore(fullRecord).catch(() => {
    // Firestore error already logged inside persistAuditEventToFirestore
  });

  return fullRecord;
}

/**
 * Persists an audit record directly into the Firestore 'audit_logs' collection (Admin SDK)
 */
export async function persistAuditEventToFirestore(record: ServerAuditRecord): Promise<boolean> {
  try {
    const db = getAdminFirestore();
    const cleanDoc = Object.fromEntries(
      Object.entries(record).filter(([_, v]) => v !== undefined)
    );
    await db.collection("audit_logs").doc(record.id).set(cleanDoc);
    return true;
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("PERMISSION_DENIED") || msg.includes("NOT_FOUND") || msg.includes("UNAUTHENTICATED")) {
      systemLogger.debug(`Firestore audit persistence deferred to local disk journal: ${msg}`);
    } else {
      systemLogger.warn(`Failed persisting audit record ${record.id} to Firestore: ${msg}`);
    }
    return false;
  }
}

/**
 * Async version of logServerAuditEvent that awaits disk and Firestore writes
 */
export async function logServerAuditEventAsync(record: Partial<ServerAuditRecord>): Promise<ServerAuditRecord> {
  const fullRecord = logServerAuditEvent(record);
  await persistAuditEventToFirestore(fullRecord);
  return fullRecord;
}

/**
 * Returns durable audit trail: queries Firestore 'audit_logs' first, falling back to disk/memory
 */
export async function fetchDurableAuditTrail(tenantId?: string, limitCount: number = 100): Promise<ServerAuditRecord[]> {
  try {
    const db = getAdminFirestore();
    let query: any = db.collection("audit_logs").orderBy("timestamp", "desc").limit(limitCount);
    if (tenantId && tenantId !== "GLOBAL") {
      query = db.collection("audit_logs").where("tenantId", "==", tenantId).limit(limitCount);
    }
    const snapshot = await query.get();
    if (!snapshot.empty) {
      const records: ServerAuditRecord[] = [];
      snapshot.forEach((doc: any) => {
        records.push(doc.data() as ServerAuditRecord);
      });
      return records;
    }
  } catch (_dbErr) {
    // Fall back to memory and disk journal if Firestore is unreachable
  }
  // Disk / memory fallback
  return getServerAuditTrail(tenantId);
}

export function getServerAuditTrail(tenantId?: string): ServerAuditRecord[] {
  // Returns deep copy of audit records to prevent client-side mutation
  const records: ServerAuditRecord[] = JSON.parse(JSON.stringify(serverAuditTrail));
  if (tenantId && tenantId !== "GLOBAL") {
    return records.filter((r) => r.tenantId === tenantId);
  }
  return records;
}

export function clearServerAuditTrail(): void {
  serverAuditTrail.length = 0;
}

// Secret key used for HMAC signature verification in verification suites
const JWT_VERIFICATION_SECRET = process.env.JWT_SECRET || "bioazucar-industrial-hmac-secret-key-62443";

/**
 * Validates test tokens strictly in isolated test environments (SEC-2)
 */
function parseTestToken(token: string): AuthenticatedUser | null {
  if (token.includes(":")) {
    const parts = token.split(":");
    const role = parts[1] as UserRole;
    const tenantId = parts[2];
    const uid = parts[3] || (role ? `usr-${role}` : "");
    if (!role || !tenantId || !uid) return null;
    const isSuperAdmin = role === "superadmin" && tenantId === "GLOBAL";
    const scope: "GLOBAL" | "TENANT" = isSuperAdmin ? "GLOBAL" : "TENANT";
    const atomicPermissions = ROLE_ATOMIC_PERMISSIONS[role] || [];
    const principal: AuthenticatedPrincipal = {
      uid,
      email: `${uid}@bioazucar.com`,
      tenantId,
      membershipId: `mem-${uid}`,
      roleId: `role-${role}`,
      role,
      permissions: atomicPermissions,
      isSuperAdmin,
      securityLevel: role === "superadmin" ? 5 : role === "administrador" ? 4 : role === "supervisor" ? 3 : 2,
      authenticationAssurance: isSuperAdmin ? "AAL2" : "AAL1",
      scope,
    };
    return {
      id: uid,
      uid,
      email: `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin,
      securityLevel: principal.securityLevel,
      scope,
      permissions: atomicPermissions,
      principal,
      authenticationAssurance: principal.authenticationAssurance,
    };
  }

  const tokenBody = token.replace("test-token-", "");
  const roleMatch = tokenBody.match(/^([a-z_]+)-(.*)$/);
  if (roleMatch) {
    const role = roleMatch[1] as UserRole;
    const remainder = roleMatch[2];
    const uidIndex = remainder.lastIndexOf("-usr-");
    let tenantId = remainder;
    let uid = `usr-${role}`;
    if (uidIndex !== -1) {
      tenantId = remainder.substring(0, uidIndex);
      uid = remainder.substring(uidIndex + 1);
    }
    if (!role || !tenantId) return null;
    const isSuperAdmin = role === "superadmin" && tenantId === "GLOBAL";
    const scope: "GLOBAL" | "TENANT" = isSuperAdmin ? "GLOBAL" : "TENANT";
    const atomicPermissions = ROLE_ATOMIC_PERMISSIONS[role] || [];
    const principal: AuthenticatedPrincipal = {
      uid,
      email: `${uid}@bioazucar.com`,
      tenantId,
      membershipId: `mem-${uid}`,
      roleId: `role-${role}`,
      role,
      permissions: atomicPermissions,
      isSuperAdmin,
      securityLevel: role === "superadmin" ? 5 : role === "administrador" ? 4 : role === "supervisor" ? 3 : 2,
      authenticationAssurance: isSuperAdmin ? "AAL2" : "AAL1",
      scope,
    };
    return {
      id: uid,
      uid,
      email: `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin,
      securityLevel: principal.securityLevel,
      scope,
      permissions: atomicPermissions,
      principal,
      authenticationAssurance: principal.authenticationAssurance,
    };
  }

  return null;
}

/**
 * Helper to verify test HMAC tokens in test environments
 */
function verifyHmacTokenForTests(token: string): AuthenticatedUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const headerJson = Buffer.from(headerB64, "base64url").toString("utf-8");
    const header = JSON.parse(headerJson);
    if (!header.alg || header.alg.toLowerCase() === "none") return null;

    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson);

    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp !== undefined && claims.exp < nowSec) return null;
    if (claims.nbf !== undefined && claims.nbf > nowSec + 60) return null;
    if (claims.iat !== undefined && claims.iat > nowSec + 300) return null;

    const uid = claims.user_id || claims.sub || claims.uid;
    if (!uid || typeof uid !== "string" || uid.trim() === "") return null;

    if (header.alg === "HS256") {
      const expectedSig = crypto
        .createHmac("sha256", JWT_VERIFICATION_SECRET)
        .update(`${headerB64}.${payloadB64}`)
        .digest("base64url");
      if (signatureB64 !== expectedSig) return null;
    } else {
      return null;
    }

    const membership = MembershipService.getEffectiveMembershipSync(uid, claims.email);
    let role: string;
    let tenantId: string;
    let securityLevel: number;
    let permissions: string[] | undefined;
    let membershipId: string;

    if (membership) {
      if (membership.status && membership.status !== "ACTIVE") {
        logServerAuditEvent({
          actorUid: uid,
          actorEmail: claims.email,
          actorRole: membership.role,
          tenantId: membership.tenantId,
          action: "AUTHORIZATION_DENIED",
          resource: "HMAC_TOKEN_VERIFY",
          result: "DENIED",
          severity: "CRITICAL",
          metadata: { reason: "Membership is disabled or suspended", status: membership.status },
        });
        return null;
      }

      if (claims.role && claims.role !== membership.role) {
        logServerAuditEvent({
          actorUid: uid,
          actorEmail: claims.email,
          actorRole: membership.role,
          tenantId: membership.tenantId,
          action: "AUTHORIZATION_DENIED",
          resource: "HMAC_TOKEN_VERIFY",
          result: "DENIED",
          severity: "CRITICAL",
          metadata: { reason: "Inconsistent role claims vs server membership" },
        });
        return null;
      }

      if (claims.tenantId && claims.tenantId !== membership.tenantId) {
        logServerAuditEvent({
          actorUid: uid,
          actorEmail: claims.email,
          actorRole: membership.role,
          tenantId: membership.tenantId,
          action: "AUTHORIZATION_DENIED",
          resource: "HMAC_TOKEN_VERIFY",
          result: "DENIED",
          severity: "CRITICAL",
          metadata: { reason: "Inconsistent tenant claims vs server membership" },
        });
        return null;
      }

      role = membership.role;
      tenantId = membership.tenantId;
      securityLevel = membership.securityLevel;
      permissions = membership.permissions;
      membershipId = membership.id;
    } else {
      if (!claims.role || !claims.tenantId) {
        logServerAuditEvent({
          actorUid: uid,
          actorEmail: claims.email,
          actorRole: "NONE",
          tenantId: "NONE",
          action: "FAIL_OPEN_REJECTED",
          resource: "HMAC_TOKEN_VERIFY",
          result: "DENIED",
          severity: "CRITICAL",
          metadata: { reason: "No membership found and test token lacks explicit role/tenantId" },
        });
        return null;
      }
      role = claims.role;
      tenantId = claims.tenantId;
      securityLevel = claims.role === "superadmin" ? 5 : claims.role === "administrador" ? 4 : 2;
      permissions = claims.permissions;
      membershipId = `mem-test-${uid}`;
    }

    if (!ROLE_ATOMIC_PERMISSIONS[role]) {
      return null;
    }

    const isSuperAdmin = role === "superadmin" && tenantId === "GLOBAL";
    const scope: "GLOBAL" | "TENANT" = isSuperAdmin ? "GLOBAL" : "TENANT";
    const atomicPermissions = ROLE_ATOMIC_PERMISSIONS[role] || [];
    const assurance: "AAL1" | "AAL2" | "AAL3" =
      claims.mfa || claims.authenticationAssurance === "AAL2" || isSuperAdmin ? "AAL2" : "AAL1";

    const principal: AuthenticatedPrincipal = {
      uid,
      email: claims.email || `${uid}@bioazucar.com`,
      tenantId,
      membershipId,
      roleId: `role-${role}`,
      role,
      permissions: atomicPermissions,
      isSuperAdmin,
      securityLevel,
      authenticationAssurance: assurance,
      scope,
    };

    return {
      id: uid,
      uid,
      email: claims.email || `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin,
      securityLevel,
      scope,
      permissions: permissions || atomicPermissions,
      principal,
      authenticationAssurance: assurance,
    };
  } catch {
    return null;
  }
}

/**
 * SEC-1: Validates a Firebase ID Token using Firebase Admin SDK.
 * Never trusts unverified client claims, localStorage, or client-sent headers.
 */
export async function parseAndVerifyToken(authHeader?: string): Promise<AuthenticatedUser | null> {
  if (!authHeader) {
    return null;
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();
  if (!token) return null;

  // SEC-2: Handle test tokens strictly in isolated test environments
  const isTestEnv = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  if (token.startsWith("test-token-") || token.startsWith("test-token:")) {
    if (!isTestEnv) {
      return null; // Strictly reject in production and runtime
    }
    return parseTestToken(token);
  }

  // Pre-validate token structure (rejects alg:none and malformed tokens immediately)
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const headerB64 = parts[0];
    const headerJson = Buffer.from(headerB64, "base64url").toString("utf-8");
    const header = JSON.parse(headerJson);
    if (!header.alg || header.alg.toLowerCase() === "none") {
      return null; // Reject "none" algorithm attack immediately
    }

    const payloadB64 = parts[1];
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
    const claims = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1000);
    if (claims.exp !== undefined && claims.exp < nowSec) {
      return null; // Expired token
    }
  } catch {
    return null;
  }

  // 1. Primary: Official Firebase Admin SDK Token Verification (SEC-1)
  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token, false);
    const uid = decodedToken.uid;
    const email = decodedToken.email || `${uid}@bioazucar.com`;

    // SEC-4: Resolve effective tenant membership strictly from server-side directory (Fail-Closed)
    const membership = await MembershipService.getEffectiveMembership(uid, email);
    if (!membership) {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: "UNAUTHORIZED",
        tenantId: "UNKNOWN",
        action: "FAIL_OPEN_REJECTED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: { reason: "Authenticated identity has no active tenant membership." },
      });
      return null;
    }

    if (membership.status && membership.status !== "ACTIVE") {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: membership.role,
        tenantId: membership.tenantId,
        action: "AUTHORIZATION_DENIED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: { reason: `Membership is disabled or suspended (${membership.status}).` },
      });
      return null;
    }

    if (!membership.tenantId || membership.tenantId.trim() === "") {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: membership.role,
        tenantId: "UNKNOWN",
        action: "AUTHORIZATION_DENIED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: { reason: "Tenant does not exist for membership." },
      });
      return null;
    }

    if (!ROLE_ATOMIC_PERMISSIONS[membership.role]) {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: String(membership.role),
        tenantId: membership.tenantId,
        action: "AUTHORIZATION_DENIED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: { reason: `Role '${membership.role}' does not exist in canonical registry.` },
      });
      return null;
    }

    // Inconsistent claims detection (anti-spoofing)
    if (decodedToken.role && decodedToken.role !== membership.role) {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: membership.role,
        tenantId: membership.tenantId,
        action: "AUTHORIZATION_DENIED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: {
          reason: "Claims / membership mismatch (role spoofing detected)",
          tokenRole: decodedToken.role,
          membershipRole: membership.role,
        },
      });
      return null;
    }
    if (decodedToken.tenantId && decodedToken.tenantId !== membership.tenantId) {
      logServerAuditEvent({
        actorUid: uid,
        actorEmail: email,
        actorRole: membership.role,
        tenantId: membership.tenantId,
        action: "AUTHORIZATION_DENIED",
        resource: "AUTH_VERIFY_TOKEN",
        result: "DENIED",
        severity: "CRITICAL",
        metadata: {
          reason: "Claims / membership mismatch (tenantId spoofing detected)",
          tokenTenantId: decodedToken.tenantId,
          membershipTenantId: membership.tenantId,
        },
      });
      return null;
    }

    // SuperAdmin criteria: Must satisfy role='superadmin' AND tenantId='GLOBAL'
    const isSuperAdmin = membership.role === "superadmin" && membership.tenantId === "GLOBAL";
    const scope: "GLOBAL" | "TENANT" = isSuperAdmin ? "GLOBAL" : "TENANT";
    const securityLevel =
      membership.securityLevel ||
      (isSuperAdmin ? 5 : membership.role === "administrador" ? 4 : membership.role === "supervisor" ? 3 : 2);
    const atomicPermissions = ROLE_ATOMIC_PERMISSIONS[membership.role] || [];
    const assurance: "AAL1" | "AAL2" | "AAL3" =
      (decodedToken.amr?.includes("mfa") || isSuperAdmin) ? "AAL2" : "AAL1";

    const principal: AuthenticatedPrincipal = {
      uid,
      email,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      roleId: (membership as any).roleId || `role-${membership.role}`,
      role: membership.role,
      permissions: atomicPermissions,
      isSuperAdmin,
      securityLevel,
      authenticationAssurance: assurance,
      scope,
    };

    return {
      id: uid,
      uid,
      email,
      role: membership.role,
      tenantId: membership.tenantId,
      isSuperAdmin,
      securityLevel,
      scope,
      permissions: membership.permissions || atomicPermissions,
      principal,
      authenticationAssurance: assurance,
    };
  } catch (firebaseErr: any) {
    // If running in isolated test mode (vitest) with HMAC verification test tokens
    if (isTestEnv) {
      return verifyHmacTokenForTests(token);
    }
    return null;
  }
}

/**
 * Express Middleware: Captures or generates Correlation ID and propagates across request/response lifecycle (SEC-P0 §17)
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = (req.headers["x-correlation-id"] || req.headers["x-request-id"]) as string;
  const correlationId =
    incoming && typeof incoming === "string" && incoming.trim() !== ""
      ? incoming.trim()
      : `corr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
  req.correlationId = correlationId;
  res.setHeader("X-Correlation-Id", correlationId);
  next();
}

/**
 * Express Middleware: Requires verified authentication Bearer token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const user = await parseAndVerifyToken(authHeader);

  if (!user) {
    logServerAuditEvent({
      actorUid: "ANONYMOUS",
      actorRole: "NONE",
      tenantId: "UNKNOWN",
      action: `${req.method} ${req.path}`,
      resource: req.path,
      result: "DENIED",
      correlationId: req.correlationId,
      ip: req.ip,
      metadata: { reason: "Missing, invalid, expired token or fail-open rejection" },
    });

    return res.status(401).json({
      error: "Acceso no autenticado o no autorizado. Se requiere membresía activa válida y Bearer Token verificado.",
      code: "UNAUTHENTICATED",
    });
  }

  req.user = user;
  req.principal = user.principal;
  next();
}

/**
 * Express Middleware: Enforces Role-Based Access Control (RBAC) on server-side
 */
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    const isAuthorizedSuperAdmin = req.user.isSuperAdmin && req.user.role === "superadmin";
    if (isAuthorizedSuperAdmin || allowedRoles.includes(req.user.role)) {
      return next();
    }

    logServerAuditEvent({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      tenantId: req.user.tenantId,
      action: `${req.method} ${req.path}`,
      resource: req.path,
      result: "DENIED",
      correlationId: req.correlationId,
      ip: req.ip,
      metadata: {
        reason: `Rol '${req.user.role}' no autorizado. Se requiere uno de: [${allowedRoles.join(", ")}]`,
      },
    });

    return res.status(403).json({
      error: `Permisos insuficientes. El rol '${req.user.role}' no tiene autorización para esta acción.`,
      code: "FORBIDDEN_ROLE",
    });
  };
}

/**
 * Express Middleware: Enforces fine-grained Atomic Permissions (SEC-P0 §6)
 */
export function requireAtomicPermission(requiredPermission: AtomicPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.principal) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    if (hasAtomicPermission(req.principal, requiredPermission)) {
      return next();
    }

    logServerAuditEvent({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      tenantId: req.user.tenantId,
      action: "AUTHORIZATION_DENIED",
      resource: req.originalUrl || req.path,
      result: "DENIED",
      severity: "WARNING",
      correlationId: req.correlationId,
      ip: req.ip,
      metadata: {
        reason: `Permiso atómico faltante: Se requiere '${requiredPermission}'.`,
        userPermissions: req.principal.permissions,
        userRole: req.principal.role,
      },
    });

    return res.status(403).json({
      error: `Permisos insuficientes: Se requiere el permiso atómico '${requiredPermission}'.`,
      code: "FORBIDDEN_PERMISSION",
      requiredPermission,
    });
  };
}

/**
 * Express Middleware: Enforces MFA / Authentication Assurance Level (SEC-P0 §19)
 */
export function requireAssuranceLevel(minLevel: "AAL2" | "AAL3" = "AAL2") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.principal) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    const currentLevel = req.principal.authenticationAssurance || req.user.authenticationAssurance || "AAL1";
    const levelRanks = { AAL1: 1, AAL2: 2, AAL3: 3 };

    if (levelRanks[currentLevel] >= levelRanks[minLevel]) {
      return next();
    }

    logServerAuditEvent({
      actorUid: req.user.uid,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      tenantId: req.user.tenantId,
      action: "MFA_FAILURE",
      resource: req.originalUrl || req.path,
      result: "DENIED",
      severity: "CRITICAL",
      correlationId: req.correlationId,
      ip: req.ip,
      metadata: {
        reason: `Operación crítica requiere nivel de autenticación reforzada ${minLevel}. Nivel actual: ${currentLevel}.`,
        minLevel,
        currentLevel,
      },
    });

    return res.status(403).json({
      error: `Autenticación de alto nivel requerida: Esta operación exige ${minLevel} (MFA/FIDO2). Nivel de sesión actual: ${currentLevel}.`,
      code: "FORBIDDEN_MFA_REQUIRED",
      requiredLevel: minLevel,
      currentLevel,
    });
  };
}

/**
 * Error thrown when an unauthorized cross-tenant data access attempt is made (IEC 62443 SL3)
 */
export class CrossTenantViolationError extends Error {
  public readonly code = "CROSS_TENANT_DENIED";
  public readonly statusCode = 403;
  constructor(
    public readonly userTenant: string,
    public readonly attemptedTenant: string,
    public readonly resource?: string
  ) {
    super(
      `Violación de aislamiento multi-tenant: La cuenta ('${userTenant}') no tiene autorización para acceder o mutar datos de '${attemptedTenant}'.`
    );
    this.name = "CrossTenantViolationError";
  }
}

/**
 * Asserts that the authenticated user has clearance for target tenant. Throws CrossTenantViolationError if unauthorized.
 */
export function assertTenantAuthorization(
  user: AuthenticatedUser,
  targetTenantId?: string,
  resource?: string
): void {
  if (!targetTenantId) {
    return;
  }
  const isAuthorizedSuperAdmin = user.isSuperAdmin && user.role === "superadmin" && user.tenantId === "GLOBAL";
  if (isAuthorizedSuperAdmin) {
    return;
  }
  const cleanTarget = targetTenantId.trim();
  if (cleanTarget && cleanTarget !== user.tenantId) {
    throw new CrossTenantViolationError(user.tenantId, cleanTarget, resource);
  }
}

/**
 * Express Middleware: Enforces Strict Multi-Tenant Isolation (SEC-4 & SEC-5 / IEC 62443 SL3)
 */
export function requireTenantIsolation(
  targetTenantGetter?: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    // Superadmin has global clearance strictly if role=superadmin AND tenantId=GLOBAL
    const isAuthorizedSuperAdmin =
      req.user.isSuperAdmin &&
      req.user.role === "superadmin" &&
      (req.user.scope === "GLOBAL" || req.user.tenantId === "GLOBAL");

    if (isAuthorizedSuperAdmin) {
      return next();
    }

    // Extract target tenant candidates across all request locations
    const candidateTenants: (string | undefined)[] = [
      targetTenantGetter ? targetTenantGetter(req) : undefined,
      req.params?.tenantId,
      req.query?.tenantId as string,
      req.query?.targetTenantId as string,
      req.body?.tenantId,
      req.body?.targetTenantId,
      req.body?.millId,
      req.headers["x-tenant-id"] as string,
    ];

    for (const rawTenant of candidateTenants) {
      if (rawTenant && typeof rawTenant === "string" && rawTenant.trim() !== "") {
        const targetTenant = rawTenant.trim();
        // Mandatory Tenant Isolation: subject.tenantId == resource.tenantId
        if (targetTenant !== req.user.tenantId) {
          try {
            crossTenantViolationsTotal.inc({
              source_tenant: req.user.tenantId,
              target_tenant: targetTenant,
              endpoint: req.baseUrl + (req.route?.path || req.path),
            });
          } catch {
            // Metrics increment non-blocking
          }

          logServerAuditEvent({
            actorUid: req.user.uid,
            actorEmail: req.user.email,
            actorRole: req.user.role,
            tenantId: req.user.tenantId,
            action: "CROSS_TENANT_ACCESS_ATTEMPT",
            resource: req.originalUrl || req.path,
            result: "DENIED",
            severity: "CRITICAL",
            correlationId: req.correlationId,
            ip: req.ip,
            metadata: {
              userTenant: req.user.tenantId,
              attemptedTenant: targetTenant,
              method: req.method,
              endpoint: req.originalUrl || req.path,
            },
          });

          return res.status(403).json({
            error: `Violación de aislamiento multi-tenant: Su cuenta (${req.user.tenantId}) no tiene autorización para acceder a los datos de '${targetTenant}'.`,
            code: "CROSS_TENANT_DENIED",
            userTenant: req.user.tenantId,
            targetTenant,
          });
        }
      }
    }

    next();
  };
}

/**
 * Strict Multi-Tenant Isolation with anti-spoofing and Header Injection rejection
 */
export function requireStrictTenantIsolation() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    // Verify X-Tenant-Id header cannot spoof a different tenant
    const headerTenant = req.headers["x-tenant-id"];
    if (headerTenant && typeof headerTenant === "string" && headerTenant.trim() !== "") {
      const sanitizedHeader = headerTenant.trim();
      const isAuthorizedSuperAdmin =
        req.user.isSuperAdmin &&
        req.user.role === "superadmin" &&
        (req.user.scope === "GLOBAL" || req.user.tenantId === "GLOBAL");

      if (!isAuthorizedSuperAdmin && sanitizedHeader !== req.user.tenantId) {
        logServerAuditEvent({
          actorUid: req.user.uid,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          tenantId: req.user.tenantId,
          action: "HEADER_TENANT_INJECTION_REJECTED",
          resource: req.originalUrl || req.path,
          result: "DENIED",
          severity: "CRITICAL",
          correlationId: req.correlationId,
          ip: req.ip,
          metadata: {
            userTenant: req.user.tenantId,
            injectedHeaderTenant: sanitizedHeader,
          },
        });

        return res.status(403).json({
          error: "Inyección de cabecera detectada: La cabecera X-Tenant-Id no coincide con el tenant autenticado.",
          code: "TENANT_HEADER_SPOOFING_REJECTED",
        });
      }
    }

    return requireTenantIsolation()(req, res, next);
  };
}

/**
 * Helper to verify that a resource belongs strictly to the user's authorized tenant (SEC-5)
 */
export function verifyResourceTenantOwnership(
  resource: { tenantId?: string } | null | undefined,
  user: AuthenticatedUser
): boolean {
  if (user.isSuperAdmin || user.tenantId === "GLOBAL") {
    return true;
  }
  if (!resource || !resource.tenantId) {
    return false;
  }
  return resource.tenantId === user.tenantId;
}

/**
 * Express Middleware: Enforces resource-level tenant authorization (SEC-5)
 */
export function requireResourceTenantOwnership(
  resourceResolver: (req: Request) => Promise<{ tenantId?: string } | null> | { tenantId?: string } | null
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    if (req.user.isSuperAdmin || req.user.tenantId === "GLOBAL") {
      return next();
    }

    try {
      const resource = await resourceResolver(req);
      if (!resource) {
        return res.status(404).json({ error: "Recurso no encontrado", code: "NOT_FOUND" });
      }

      if (!verifyResourceTenantOwnership(resource, req.user)) {
        logServerAuditEvent({
          actorUid: req.user.uid,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          tenantId: req.user.tenantId,
          action: "CROSS_TENANT_RESOURCE_ACCESS_DENIED",
          resource: req.path,
          result: "DENIED",
          ip: req.ip,
          metadata: {
            userTenant: req.user.tenantId,
            resourceTenant: resource.tenantId,
          },
        });

        return res.status(403).json({
          error: `Acceso denegado: El recurso pertenece al tenant '${resource.tenantId}', inaccesible para su cuenta ('${req.user.tenantId}').`,
          code: "CROSS_TENANT_DENIED",
        });
      }

      next();
    } catch (err: any) {
      return res.status(500).json({ error: `Error validando autorización de recurso: ${err.message}` });
    }
  };
}
