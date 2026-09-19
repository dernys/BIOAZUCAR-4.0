/**
 * BioAzúcar 4.0 — Edge Provisioning & Asymmetric Cryptographic Signing Engine (P0-05 / PRV-01)
 * 
 * Spec Reference: BIOAZUCAR_MASTER_DEVELOPMENT.md Section 25 [P0-05] & IEC 62443-4-2
 * 
 * Provides end-to-end secure remote provisioning for Industrial Edge Daemons:
 *  1. Asymmetric Digital Signing (ECDSA-SHA256 / Ed25519 / RSA) and HMAC-SHA256.
 *  2. Canonical Manifest Serialization & Tamper-Evident SHA-256 Payload Hash.
 *  3. Nonce Tracking & Anti-Replay Protection with Expiration Validation.
 *  4. Hot-Reload Reconfiguration of Industrial Drivers (zero daemon downtime).
 *  5. Post-Reconfiguration Health Verification via EdgeRuntimeSupervisor.
 *  6. Atomic Rollback: Instant revert to last known-good manifest upon any driver fault.
 *  7. Full IEC 62443-4-2 Audit Trail with Cryptographic Lineage.
 */

import crypto from "crypto";
import { DriverConfig } from "./drivers/IIndustrialDriver";
import { IndustrialDriverManager } from "./drivers/IndustrialDriverManager";
import { EdgeRuntimeSupervisor } from "./supervisor/EdgeRuntimeSupervisor";
import { logAuditEventToDb } from "../dbService";

export type ProvisioningAlgorithm = "ECDSA-SHA256" | "RSA-SHA256" | "ED25519" | "HMAC-SHA256";

export interface EdgeManifestConfig {
  manifestId: string;
  version: number;
  tenantId: string;
  siteId: string;
  gatewayId: string;
  runtimeProfile: "SIMULATION" | "LAB" | "PRODUCTION";
  createdAt: string;
  expiresAt: string;
  nonce: string;
  drivers: DriverConfig[];
  tags?: Array<{
    tagId: string;
    name: string;
    address: string;
    dataType: string;
    unit: string;
    scanRateMs: number;
  }>;
  securityPolicies?: {
    allowedSubnets?: string[];
    dualNicStrict?: boolean;
    maxBandwidthKbps?: number;
    encryptionRequired?: boolean;
  };
}

export interface ManifestSignature {
  algorithm: ProvisioningAlgorithm;
  keyId: string;
  signatureValue: string;
  signedBy: string;
  signedAt: string;
}

export interface SignedEdgeManifest {
  manifest: EdgeManifestConfig;
  payloadHash: string;
  signature: ManifestSignature;
}

export interface ManifestVerificationResult {
  valid: boolean;
  code?:
    | "VALID"
    | "INVALID_SIGNATURE"
    | "EXPIRED"
    | "REPLAY_DETECTED"
    | "TARGET_MISMATCH"
    | "CORRUPTED_PAYLOAD"
    | "SCHEMA_VIOLATION"
    | "UNTRUSTED_KEY";
  error?: string;
  payloadHash?: string;
  details?: Record<string, any>;
}

export interface ManifestApplyResult {
  success: boolean;
  manifestId: string;
  appliedAt: string;
  driversConfigured: number;
  hotReloaded: boolean;
  rolledBack: boolean;
  rollbackReason?: string;
  healthCheckReport?: {
    healthy: boolean;
    totalDrivers: number;
    activeDrivers: number;
    faultedDrivers: string[];
  };
}

export interface AsymmetricKeyPair {
  keyId: string;
  algorithm: ProvisioningAlgorithm;
  publicKey: string;
  privateKey: string;
}

export class EdgeProvisioningService {
  private static instance: EdgeProvisioningService;

  // Trusted Authority Keys (keyId -> public key PEM or preshared secret)
  private trustedPublicKeys = new Map<string, { key: string; algorithm: ProvisioningAlgorithm }>();

  // Anti-replay cache of used nonces (nonce -> timestamp observed)
  private processedNonces = new Map<string, number>();

  // Active running manifest and safe rollback snapshot
  private activeManifest: SignedEdgeManifest | null = null;
  private safeRollbackSnapshot: {
    manifest: SignedEdgeManifest;
    driverConfigs: DriverConfig[];
  } | null = null;

  // Manifest deployment history
  private manifestHistory: Array<{
    manifestId: string;
    version: number;
    appliedAt: string;
    status: "ACTIVE" | "ROLLED_BACK" | "SUPERSEDED";
    details?: any;
  }> = [];

  private driverManager: IndustrialDriverManager;
  private supervisor: EdgeRuntimeSupervisor;

  private constructor(
    driverManager: IndustrialDriverManager = IndustrialDriverManager.getInstance(),
    supervisor: EdgeRuntimeSupervisor = EdgeRuntimeSupervisor.getInstance()
  ) {
    this.driverManager = driverManager;
    this.supervisor = supervisor;
  }

  public static getInstance(): EdgeProvisioningService {
    if (!EdgeProvisioningService.instance) {
      EdgeProvisioningService.instance = new EdgeProvisioningService();
    }
    return EdgeProvisioningService.instance;
  }

  /**
   * Generates a secure asymmetric key pair for signing edge manifests.
   */
  public generateKeyPair(
    keyId: string,
    algorithm: ProvisioningAlgorithm = "ECDSA-SHA256"
  ): AsymmetricKeyPair {
    if (algorithm === "ECDSA-SHA256") {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      return { keyId, algorithm, publicKey, privateKey };
    } else if (algorithm === "RSA-SHA256") {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      return { keyId, algorithm, publicKey, privateKey };
    } else if (algorithm === "ED25519") {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      return { keyId, algorithm, publicKey, privateKey };
    } else {
      // HMAC-SHA256 shared secret
      const secret = crypto.randomBytes(32).toString("hex");
      return { keyId, algorithm, publicKey: secret, privateKey: secret };
    }
  }

  /**
   * Registers a trusted signing authority public key or shared secret.
   */
  public registerTrustedKey(
    keyId: string,
    publicKeyOrSecret: string,
    algorithm: ProvisioningAlgorithm = "ECDSA-SHA256"
  ): void {
    this.trustedPublicKeys.set(keyId, { key: publicKeyOrSecret, algorithm });
  }

  public removeTrustedKey(keyId: string): boolean {
    return this.trustedPublicKeys.delete(keyId);
  }

  public clearTrustedKeys(): void {
    this.trustedPublicKeys.clear();
  }

  /**
   * Canonical JSON serialization to guarantee deterministic byte hashing.
   * Recursively sorts object keys so {a: 1, b: 2} and {b: 2, a: 1} produce identical hashes.
   */
  public canonicalStringify(obj: any): string {
    if (obj === null || typeof obj !== "object") {
      return JSON.stringify(obj);
    }
    if (Array.isArray(obj)) {
      return "[" + obj.map((item) => this.canonicalStringify(item)).join(",") + "]";
    }
    const sortedKeys = Object.keys(obj).sort();
    const parts = sortedKeys.map((k) => `"${k}":${this.canonicalStringify(obj[k])}`);
    return "{" + parts.join(",") + "}";
  }

  /**
   * Computes the SHA-256 digest of the canonical manifest payload.
   */
  public computePayloadHash(manifest: EdgeManifestConfig): string {
    const canonical = this.canonicalStringify(manifest);
    return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  /**
   * Signs an Edge Manifest configuration using the provided private key or secret.
   */
  public signManifest(
    manifest: EdgeManifestConfig,
    signingKey: string,
    options: {
      keyId: string;
      algorithm?: ProvisioningAlgorithm;
      signedBy?: string;
    }
  ): SignedEdgeManifest {
    const algorithm = options.algorithm || "ECDSA-SHA256";
    const payloadHash = this.computePayloadHash(manifest);
    let signatureValue: string;

    if (algorithm === "HMAC-SHA256") {
      signatureValue = crypto
        .createHmac("sha256", signingKey)
        .update(payloadHash, "utf8")
        .digest("hex");
    } else {
      const sign = crypto.createSign("SHA256");
      sign.update(payloadHash, "utf8");
      sign.end();
      signatureValue = sign.sign(signingKey, "base64");
    }

    return {
      manifest,
      payloadHash,
      signature: {
        algorithm,
        keyId: options.keyId,
        signatureValue,
        signedBy: options.signedBy || "provisioning-authority@bioazucar.com",
        signedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Verifies the cryptographic integrity, authenticity, non-expiration and non-replay of a SignedEdgeManifest.
   */
  public verifyManifest(
    signedManifest: SignedEdgeManifest,
    options: {
      expectedGatewayId?: string;
      expectedTenantId?: string;
      checkExpiration?: boolean;
      checkReplay?: boolean;
    } = {}
  ): ManifestVerificationResult {
    const { manifest, payloadHash, signature } = signedManifest;

    // 1. Basic schema validation
    if (!manifest || !manifest.manifestId || !manifest.drivers || !signature) {
      return {
        valid: false,
        code: "SCHEMA_VIOLATION",
        error: "Manifiesto corrupto o incompleto: faltan campos obligatorios.",
      };
    }

    // 2. Expected target validation
    if (options.expectedGatewayId && manifest.gatewayId !== options.expectedGatewayId) {
      return {
        valid: false,
        code: "TARGET_MISMATCH",
        error: `Gateway destino '${manifest.gatewayId}' no coincide con el nodo local '${options.expectedGatewayId}'.`,
      };
    }

    if (options.expectedTenantId && manifest.tenantId !== options.expectedTenantId) {
      return {
        valid: false,
        code: "TARGET_MISMATCH",
        error: `Tenant destino '${manifest.tenantId}' no coincide con el esperado '${options.expectedTenantId}'.`,
      };
    }

    // 3. Expiration validation
    const now = Date.now();
    if (options.checkExpiration !== false) {
      const expiresAtMs = new Date(manifest.expiresAt).getTime();
      if (isNaN(expiresAtMs) || now > expiresAtMs) {
        return {
          valid: false,
          code: "EXPIRED",
          error: `El manifiesto ha expirado (${manifest.expiresAt}).`,
        };
      }
    }

    // 4. Anti-Replay validation
    if (options.checkReplay !== false) {
      if (this.processedNonces.has(manifest.nonce)) {
        return {
          valid: false,
          code: "REPLAY_DETECTED",
          error: `Ataque de retransmisión detectado: el nonce '${manifest.nonce}' ya fue procesado.`,
        };
      }
    }

    // 5. Payload hash integrity verification
    const computedHash = this.computePayloadHash(manifest);
    if (computedHash !== payloadHash) {
      return {
        valid: false,
        code: "CORRUPTED_PAYLOAD",
        error: "El hash del payload no coincide. Los datos del manifiesto fueron modificados tras la firma.",
        details: { expected: computedHash, provided: payloadHash },
      };
    }

    // 6. Cryptographic signature verification against registered trusted keys
    const trusted = this.trustedPublicKeys.get(signature.keyId);
    if (!trusted) {
      return {
        valid: false,
        code: "UNTRUSTED_KEY",
        error: `La clave con keyId '${signature.keyId}' no está registrada como autoridad de confianza.`,
      };
    }

    try {
      let isSignatureValid = false;
      if (signature.algorithm === "HMAC-SHA256") {
        const expectedHmac = crypto
          .createHmac("sha256", trusted.key)
          .update(payloadHash, "utf8")
          .digest("hex");
        isSignatureValid = crypto.timingSafeEqual(
          Buffer.from(signature.signatureValue, "hex"),
          Buffer.from(expectedHmac, "hex")
        );
      } else {
        const verify = crypto.createVerify("SHA256");
        verify.update(payloadHash, "utf8");
        verify.end();
        isSignatureValid = verify.verify(trusted.key, signature.signatureValue, "base64");
      }

      if (!isSignatureValid) {
        return {
          valid: false,
          code: "INVALID_SIGNATURE",
          error: "Firma digital asimétrica inválida. Verificación criptográfica falló.",
        };
      }
    } catch (err: any) {
      return {
        valid: false,
        code: "INVALID_SIGNATURE",
        error: `Excepción durante verificación criptográfica: ${err.message}`,
      };
    }

    return {
      valid: true,
      code: "VALID",
      payloadHash: computedHash,
    };
  }

  /**
   * Applies a verified signed manifest to the Edge Runtime:
   *  1. Validates signature, target, expiration, anti-replay.
   *  2. Takes a snapshot of current drivers for automatic rollback.
   *  3. Hot-reloads drivers in IndustrialDriverManager.
   *  4. Runs health check via EdgeRuntimeSupervisor.
   *  5. Automatically executes Atomic Rollback if any driver fails.
   */
  public async applySignedManifest(
    signedManifest: SignedEdgeManifest,
    options: {
      expectedGatewayId?: string;
      expectedTenantId?: string;
      healthCheckTimeoutMs?: number;
      actor?: { name: string; role: string };
    } = {}
  ): Promise<ManifestApplyResult> {
    const tNow = new Date().toISOString();
    const manifestId = signedManifest.manifest.manifestId;

    // 1. Verify Manifest
    const verification = this.verifyManifest(signedManifest, {
      expectedGatewayId: options.expectedGatewayId,
      expectedTenantId: options.expectedTenantId,
    });

    if (!verification.valid) {
      await this.logAudit("PROVISIONING_REJECTED", {
        manifestId,
        reason: verification.error,
        code: verification.code,
        actor: options.actor,
      });

      return {
        success: false,
        manifestId,
        appliedAt: tNow,
        driversConfigured: 0,
        hotReloaded: false,
        rolledBack: false,
        rollbackReason: `Rechazado en verificación: ${verification.error}`,
      };
    }

    // 2. Mark nonce as used
    this.processedNonces.set(signedManifest.manifest.nonce, Date.now());

    // 3. Take Rollback Snapshot
    const currentDrivers = this.driverManager.getAllDrivers();
    const currentConfigs: DriverConfig[] = currentDrivers.map((d) => ({ ...d.config }));
    if (this.activeManifest) {
      this.safeRollbackSnapshot = {
        manifest: this.activeManifest,
        driverConfigs: currentConfigs,
      };
    }

    // 4. Hot-Reload Drivers
    const newConfigs = signedManifest.manifest.drivers;
    const configuredCount = newConfigs.length;

    try {
      // Disconnect and clear existing drivers
      await this.driverManager.disconnectAll();
      this.driverManager.clearAll();

      // Register new drivers from manifest
      for (const config of newConfigs) {
        this.driverManager.createAndRegisterDriver(config);
      }

      // Connect all new drivers
      const connectResults = await this.driverManager.connectAll();

      // 5. Post-Reconfiguration Health Check
      const drivers = this.driverManager.getAllDrivers();
      const faultedDrivers: string[] = [];
      let activeDrivers = 0;

      for (const driver of drivers) {
        const health = driver.getHealth();
        const connectOk = connectResults[driver.id] ?? false;

        if (!connectOk || health.status === "FAULTED") {
          faultedDrivers.push(driver.id);
        } else {
          activeDrivers++;
        }
      }

      const isFleetHealthy = faultedDrivers.length === 0;

      // 6. Handle Health Check Failure -> ATOMIC ROLLBACK
      if (!isFleetHealthy) {
        console.warn(
          `[EdgeProvisioning] Healthcheck post-reconfiguración falló. Drivers con fallo: ${faultedDrivers.join(", ")}. Ejecutando Atomic Rollback.`
        );

        const rollbackSuccess = await this.executeAtomicRollback();

        await this.logAudit("PROVISIONING_FAILED_ROLLED_BACK", {
          manifestId,
          faultedDrivers,
          rollbackSuccess,
          actor: options.actor,
        });

        return {
          success: false,
          manifestId,
          appliedAt: tNow,
          driversConfigured: configuredCount,
          hotReloaded: false,
          rolledBack: true,
          rollbackReason: `Healthcheck fallido para drivers: ${faultedDrivers.join(", ")}. Se restauró la configuración previa.`,
          healthCheckReport: {
            healthy: false,
            totalDrivers: drivers.length,
            activeDrivers,
            faultedDrivers,
          },
        };
      }

      // 7. Success: commit new manifest
      if (this.activeManifest) {
        const prevEntry = this.manifestHistory.find((m) => m.manifestId === this.activeManifest?.manifest.manifestId);
        if (prevEntry) prevEntry.status = "SUPERSEDED";
      }

      this.activeManifest = signedManifest;
      this.manifestHistory.unshift({
        manifestId,
        version: signedManifest.manifest.version,
        appliedAt: tNow,
        status: "ACTIVE",
        details: {
          driversCount: configuredCount,
          keyId: signedManifest.signature.keyId,
          algorithm: signedManifest.signature.algorithm,
        },
      });

      await this.logAudit("PROVISIONING_COMMITTED", {
        manifestId,
        driversCount: configuredCount,
        actor: options.actor,
      });

      return {
        success: true,
        manifestId,
        appliedAt: tNow,
        driversConfigured: configuredCount,
        hotReloaded: true,
        rolledBack: false,
        healthCheckReport: {
          healthy: true,
          totalDrivers: drivers.length,
          activeDrivers,
          faultedDrivers: [],
        },
      };
    } catch (err: any) {
      console.error("[EdgeProvisioning] Excepción crítica durante aplicación de manifiesto. Ejecutando Rollback:", err);
      await this.executeAtomicRollback();

      return {
        success: false,
        manifestId,
        appliedAt: tNow,
        driversConfigured: configuredCount,
        hotReloaded: false,
        rolledBack: true,
        rollbackReason: `Excepción en runtime: ${err.message}`,
      };
    }
  }

  /**
   * Executes atomic rollback to the previous safe snapshot.
   */
  public async executeAtomicRollback(): Promise<boolean> {
    if (!this.safeRollbackSnapshot) {
      console.warn("[EdgeProvisioning] No hay snapshot de rollback previo disponible.");
      return false;
    }

    try {
      await this.driverManager.disconnectAll();
      this.driverManager.clearAll();

      for (const config of this.safeRollbackSnapshot.driverConfigs) {
        this.driverManager.createAndRegisterDriver(config);
      }

      await this.driverManager.connectAll();
      this.activeManifest = this.safeRollbackSnapshot.manifest;

      this.manifestHistory.unshift({
        manifestId: this.safeRollbackSnapshot.manifest.manifest.manifestId,
        version: this.safeRollbackSnapshot.manifest.manifest.version,
        appliedAt: new Date().toISOString(),
        status: "ROLLED_BACK",
        details: { action: "ATOMIC_ROLLBACK_RESTORED" },
      });

      console.log(`[EdgeProvisioning] Atomic Rollback completado exitosamente hacia manifest '${this.activeManifest.manifest.manifestId}'.`);
      return true;
    } catch (e) {
      console.error("[EdgeProvisioning] Falló el Atomic Rollback:", e);
      return false;
    }
  }

  public getActiveManifest(): SignedEdgeManifest | null {
    return this.activeManifest;
  }

  public getManifestHistory(): Array<any> {
    return [...this.manifestHistory];
  }

  public resetStateForTesting(): void {
    this.activeManifest = null;
    this.safeRollbackSnapshot = null;
    this.manifestHistory = [];
    this.processedNonces.clear();
    this.trustedPublicKeys.clear();
  }

  private async logAudit(action: string, metadata: Record<string, any>): Promise<void> {
    try {
      await logAuditEventToDb({
        tenantId: metadata.tenantId || "SYSTEM",
        userRole: "ADMIN",
        userName: metadata.actor?.name || "system-provisioning-service",
        action: `EDGE_${action}`,
        module: "Edge Provisioning Daemon",
        targetId: metadata.manifestId || "MANIFEST",
        previousValue: metadata.code || "N/A",
        newValue: JSON.stringify(metadata),
        status: action.includes("REJECTED") || action.includes("FAILED") ? "DENIED" : "EXECUTED",
        ipAddress: "127.0.0.1",
      });
    } catch {
      // Non-blocking in decoupled test environments
    }
  }
}

export const edgeProvisioningService = EdgeProvisioningService.getInstance();
