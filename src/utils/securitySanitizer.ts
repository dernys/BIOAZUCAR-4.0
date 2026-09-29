/**
 * BIOAZÚCAR 4.0 — SECURITY SANITIZER UTILITIES
 * ==============================================================================
 * Centralized sanitization for audit logs and security telemetry.
 * Safe for both browser bundle and Node/Edge runtime (zero Node dependencies).
 */

/**
 * Strips secrets, passwords, tokens and credentials from audit metadata (IEC 62443 SEC-7).
 */
export function sanitizeAuditMetadata(meta?: Record<string, any>): Record<string, any> | undefined {
  if (!meta) return undefined;
  const sensitiveKeys = [
    "token",
    "password",
    "secret",
    "authorization",
    "apikey",
    "bearer",
    "key",
    "passwordhash",
    "jwt",
    "credential",
  ];
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) {
      continue;
    } else if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
      clean[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      clean[k] = sanitizeAuditMetadata(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}
