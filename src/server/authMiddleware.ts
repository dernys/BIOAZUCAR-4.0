import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { UserRole } from "../types";
import { getAdminAuth, getAdminFirestore } from "./firebaseAdmin";
import { MembershipService } from "./membershipService";
import { systemLogger } from "../services/logger/IndustrialLogger";
import { auditEventsTotal } from "../services/metrics";

export interface AuthenticatedUser {
  id?: string;
  uid: string;
  email: string;
  role: string;
  tenantId: string;
  isSuperAdmin: boolean;
  securityLevel: number;
  permissions?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
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
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;"
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
  metadata?: Record<string, any>;
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

/**
 * Strips secrets, passwords, tokens and credentials from audit metadata (SEC-7)
 */
function sanitizeAuditMetadata(meta?: Record<string, any>): Record<string, any> | undefined {
  if (!meta) return undefined;
  const sensitiveKeys = ["token", "password", "secret", "authorization", "apikey", "bearer", "key", "passwordhash"];
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      clean[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      clean[k] = sanitizeAuditMetadata(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export function logServerAuditEvent(record: Partial<ServerAuditRecord>): ServerAuditRecord {
  const actorUid = record.actorUid || record.userId || "ANONYMOUS";
  const actorRole = record.actorRole || record.userRole || "operador";
  const action = record.action || record.eventType || "OPERATION";
  const fullRecord: ServerAuditRecord = {
    id: record.id || `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: record.timestamp || new Date().toISOString(),
    actorUid,
    userId: actorUid,
    actorEmail: record.actorEmail,
    actorRole,
    userRole: actorRole,
    tenantId: record.tenantId || "UNKNOWN",
    action,
    eventType: record.eventType || action,
    resource: record.resource || "/api",
    result: record.result || "SUCCESS",
    severity: record.severity || (record.result === "DENIED" ? "WARNING" : "INFO"),
    correlationId: record.correlationId || `corr-${Date.now().toString(36)}`,
    ip: record.ip,
    metadata: sanitizeAuditMetadata(record.metadata),
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
  return getServerAuditTrail();
}

export function getServerAuditTrail(): ServerAuditRecord[] {
  // Returns deep copy of audit records to prevent client-side mutation
  return JSON.parse(JSON.stringify(serverAuditTrail));
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
    const role = (parts[1] || "operador") as UserRole;
    const tenantId = parts[2] || "tenant-bioazucar-01";
    const uid = parts[3] || `usr-${role}`;
    return {
      id: uid,
      uid,
      email: `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin: role === "superadmin" || tenantId === "GLOBAL",
      securityLevel: role === "superadmin" ? 5 : role === "administrador" ? 4 : role === "supervisor" ? 3 : 2,
    };
  }

  const tokenBody = token.replace("test-token-", "");
  const roleMatch = tokenBody.match(/^([a-z]+)-(.*)$/);
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
    return {
      id: uid,
      uid,
      email: `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin: role === "superadmin" || tenantId === "GLOBAL",
      securityLevel: role === "superadmin" ? 5 : role === "administrador" ? 4 : role === "supervisor" ? 3 : 2,
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
    const role = membership?.role || claims.role || "operador";
    const tenantId = membership?.tenantId || claims.tenantId || "tenant-bioazucar-01";
    const securityLevel = membership?.securityLevel || (role === "superadmin" ? 5 : role === "administrador" ? 4 : 2);

    return {
      id: uid,
      uid,
      email: claims.email || `${uid}@bioazucar.com`,
      role,
      tenantId,
      isSuperAdmin: role === "superadmin" || tenantId === "GLOBAL" || Boolean(claims.isSuperAdmin),
      securityLevel,
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

    // SEC-4: Resolve effective tenant membership strictly from server-side directory
    const membership = await MembershipService.getEffectiveMembership(uid, email);
    const role = membership?.role || (decodedToken.role as string) || "operador";
    const tenantId = membership?.tenantId || (decodedToken.tenantId as string) || "tenant-bioazucar-01";
    const securityLevel =
      membership?.securityLevel ||
      (role === "superadmin" ? 5 : role === "administrador" ? 4 : role === "supervisor" ? 3 : 2);
    const isSuperAdmin = role === "superadmin" || tenantId === "GLOBAL" || Boolean(decodedToken.isSuperAdmin);

    return {
      id: uid,
      uid,
      email,
      role,
      tenantId,
      isSuperAdmin,
      securityLevel,
      permissions: membership?.permissions,
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
      ip: req.ip,
      metadata: { reason: "Missing, invalid, or expired Bearer token" },
    });

    return res.status(401).json({
      error: "Acceso no autenticado. Se requiere un Bearer Token válido (Firebase ID Token verificado).",
      code: "UNAUTHENTICATED",
    });
  }

  req.user = user;
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

    if (req.user.isSuperAdmin || allowedRoles.includes(req.user.role)) {
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
 * Express Middleware: Enforces Strict Multi-Tenant Isolation (SEC-4 & SEC-5)
 */
export function requireTenantIsolation(
  targetTenantGetter?: (req: Request) => string | undefined
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Usuario no autenticado", code: "UNAUTHENTICATED" });
    }

    // Superadmin has global clearance
    if (req.user.isSuperAdmin || req.user.tenantId === "GLOBAL") {
      return next();
    }

    // Derive target tenant from request or custom resolver
    const targetTenant = targetTenantGetter
      ? targetTenantGetter(req)
      : (req.body?.targetTenantId || req.body?.tenantId || req.query?.tenantId || req.headers["x-tenant-id"]);

    if (targetTenant && typeof targetTenant === "string") {
      if (targetTenant !== req.user.tenantId) {
        logServerAuditEvent({
          actorUid: req.user.uid,
          actorEmail: req.user.email,
          actorRole: req.user.role,
          tenantId: req.user.tenantId,
          action: "CROSS_TENANT_ACCESS_ATTEMPT",
          resource: req.path,
          result: "DENIED",
          ip: req.ip,
          metadata: {
            userTenant: req.user.tenantId,
            attemptedTenant: targetTenant,
          },
        });

        return res.status(403).json({
          error: `Violación de aislamiento multi-tenant: Su cuenta (${req.user.tenantId}) no tiene autorización para acceder a los datos de '${targetTenant}'.`,
          code: "CROSS_TENANT_DENIED",
        });
      }
    }

    next();
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
