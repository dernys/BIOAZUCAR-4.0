/**
 * BioAzúcar 4.0 — Zero-Touch Remote Provisioning (ZTP) Service (PRV-02 / P0-05 Extended)
 * 
 * Spec Reference: BIOAZUCAR_MASTER_DEVELOPMENT.md Section 25 [PRV-02] & IEC 62443-4-2 FR1/FR4/FR5
 * 
 * Implements end-to-end zero-touch industrial provisioning:
 *  1. Factory Bootstrap Token Generation with hardware identity binding (chassis UUID, MAC, serial).
 *  2. Edge PKI Enrollment: CSR validation, Subject DN & SAN enforcement, and X.509 issuance.
 *  3. Mutual TLS (mTLS) Authentication: Handshake validation, nonce proof, and revocation checks.
 *  4. Secure Signed Manifest Dispatch over mTLS with hot-reload driver reconfiguration.
 *  5. Post-provisioning health verification and autonomic atomic rollback upon fault.
 *  6. Device lifecycle management (UNPROVISIONED -> BOOTSTRAPPING -> CSR_SUBMITTED -> CERT_ISSUED -> MTLS_ESTABLISHED -> COMMISSIONED).
 */

import crypto from "crypto";
import {
  BootstrapToken,
  CertificateSigningRequest,
  HardwareIdentity,
  IssuedCertificateBundle,
  MtlsVerificationRequest,
  MtlsVerificationResponse,
  PreRegisteredDevice,
  SubjectAlternativeNames,
  SubjectDistinguishedName,
  ZtpDeviceStatus,
  ZtpProvisioningResponse,
} from "./ZeroTouchProvisioningTypes";
import { X509CertificateEngine } from "./X509CertificateEngine";
import {
  EdgeProvisioningService,
  SignedEdgeManifest,
} from "../EdgeProvisioningService";
import { EdgeRuntimeSupervisor } from "../supervisor/EdgeRuntimeSupervisor";
import { logAuditEventToDb } from "../../dbService";

export class ZeroTouchProvisioningService {
  private static instance: ZeroTouchProvisioningService;

  private pkiEngine: X509CertificateEngine;
  private manifestService: EdgeProvisioningService;
  private supervisor: EdgeRuntimeSupervisor;

  // Pre-registered devices catalog: gatewayId -> PreRegisteredDevice
  private preRegisteredDevices = new Map<string, PreRegisteredDevice>();

  // Active bootstrap tokens: tokenId -> BootstrapToken
  private bootstrapTokens = new Map<string, BootstrapToken>();

  // Active mTLS sessions: sessionToken -> { gatewayId, tenantId, establishedAt, expiresAt, fingerprint }
  private activeMtlsSessions = new Map<
    string,
    {
      gatewayId: string;
      tenantId: string;
      siteId: string;
      establishedAt: string;
      expiresAt: string;
      fingerprint: string;
    }
  >();

  private constructor(
    pkiEngine: X509CertificateEngine = X509CertificateEngine.getInstance(),
    manifestService: EdgeProvisioningService = EdgeProvisioningService.getInstance(),
    supervisor: EdgeRuntimeSupervisor = EdgeRuntimeSupervisor.getInstance()
  ) {
    this.pkiEngine = pkiEngine;
    this.manifestService = manifestService;
    this.supervisor = supervisor;
  }

  public static getInstance(): ZeroTouchProvisioningService {
    if (!ZeroTouchProvisioningService.instance) {
      ZeroTouchProvisioningService.instance = new ZeroTouchProvisioningService();
    }
    return ZeroTouchProvisioningService.instance;
  }

  // ==========================================================================
  // 1. Device Pre-Registration & Inventory Management
  // ==========================================================================

  public preRegisterDevice(device: PreRegisteredDevice): void {
    this.preRegisteredDevices.set(device.gatewayId, {
      ...device,
      status: "UNPROVISIONED",
      registeredAt: device.registeredAt || new Date().toISOString(),
    });

    logAuditEventToDb({
      tenantId: device.tenantId || "SYSTEM",
      userRole: "ADMIN",
      userName: device.registeredBy || "admin-central",
      action: "ZTP_DEVICE_PRE_REGISTERED",
      module: "Zero-Touch Provisioning",
      targetId: device.gatewayId,
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify({
        gatewayId: device.gatewayId,
        siteId: device.siteId,
        tenantId: device.tenantId,
        chassisUuid: device.expectedChassisUuid,
      }),
    }).catch(() => {});
  }

  public getDevice(gatewayId: string): PreRegisteredDevice | undefined {
    return this.preRegisteredDevices.get(gatewayId);
  }

  public getAllDevices(): PreRegisteredDevice[] {
    return Array.from(this.preRegisteredDevices.values());
  }

  // ==========================================================================
  // 2. Factory Bootstrap Token Generation & Proof Validation
  // ==========================================================================

  /**
   * Generates a single-use cryptographically strong Day-0 bootstrap token.
   */
  public generateBootstrapToken(options: {
    tenantId: string;
    siteId: string;
    gatewayId: string;
    ttlHours?: number;
    allowedSubnets?: string[];
  }): BootstrapToken {
    const tokenId = `tok-ztp-${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
    const tokenSecret = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const ttlMs = (options.ttlHours || 24) * 3600 * 1000;

    const token: BootstrapToken = {
      tokenId,
      tokenSecret,
      tenantId: options.tenantId,
      siteId: options.siteId,
      gatewayId: options.gatewayId,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      used: false,
      allowedSubnets: options.allowedSubnets,
    };

    this.bootstrapTokens.set(tokenId, token);
    return token;
  }

  /**
   * Computes an HMAC proof for an edge device using its bootstrap secret.
   */
  public static computeTokenProof(
    tokenSecret: string,
    hardwareIdentity: HardwareIdentity,
    nonce: string
  ): string {
    const payload = `${hardwareIdentity.chassisUuid}:${hardwareIdentity.macAddress}:${hardwareIdentity.serialNumber}:${nonce}`;
    return crypto.createHmac("sha256", tokenSecret).update(payload, "utf8").digest("hex");
  }

  /**
   * Validates the bootstrap token and proof submitted with a CSR.
   */
  public validateTokenProof(
    tokenId: string,
    proof: string,
    hardwareIdentity: HardwareIdentity,
    nonce: string
  ): { valid: boolean; error?: string; token?: BootstrapToken } {
    const token = this.bootstrapTokens.get(tokenId);
    if (!token) {
      return { valid: false, error: `Bootstrap token '${tokenId}' not found or invalid.` };
    }

    if (token.used) {
      return { valid: false, error: `Bootstrap token '${tokenId}' has already been consumed.` };
    }

    if (Date.now() > new Date(token.expiresAt).getTime()) {
      return { valid: false, error: `Bootstrap token '${tokenId}' has expired.` };
    }

    const expectedProof = ZeroTouchProvisioningService.computeTokenProof(
      token.tokenSecret,
      hardwareIdentity,
      nonce
    );

    if (proof !== expectedProof) {
      return { valid: false, error: "Cryptographic bootstrap token proof mismatch (invalid secret or hardware identity)." };
    }

    return { valid: true, token };
  }

  // ==========================================================================
  // 3. PKI Certificate Enrollment (CSR Validation & X.509 Issuance)
  // ==========================================================================

  /**
   * Processes a CSR submitted by an edge device during initial ZTP bootstrapping.
   */
  public async processEnrollment(csr: CertificateSigningRequest): Promise<ZtpProvisioningResponse> {
    const device = this.preRegisteredDevices.get(csr.subject.commonName.replace(/^edge-/, "").split(".")[0]) ||
                   this.preRegisteredDevices.get(csr.hardwareIdentity.serialNumber) ||
                   this.findDeviceByChassisOrMac(csr.hardwareIdentity);

    if (!device) {
      return {
        success: false,
        deviceStatus: "UNPROVISIONED",
        gatewayId: csr.subject.commonName,
        error: "Device not found in authorized pre-registration inventory (IEC 62443 FR1 violation).",
        errorCode: "DEVICE_NOT_REGISTERED",
      };
    }

    // Validate Bootstrap Token Proof
    const tokenCheck = this.validateTokenProof(
      csr.bootstrapTokenId,
      csr.bootstrapTokenProof,
      csr.hardwareIdentity,
      csr.nonce
    );

    if (!tokenCheck.valid || !tokenCheck.token) {
      return {
        success: false,
        deviceStatus: device.status,
        gatewayId: device.gatewayId,
        error: tokenCheck.error || "Invalid bootstrap proof",
        errorCode: "INVALID_BOOTSTRAP_PROOF",
      };
    }

    // Hardware Identity Verification
    if (device.expectedChassisUuid && device.expectedChassisUuid !== csr.hardwareIdentity.chassisUuid) {
      return {
        success: false,
        deviceStatus: device.status,
        gatewayId: device.gatewayId,
        error: `Hardware chassis UUID '${csr.hardwareIdentity.chassisUuid}' does not match expected '${device.expectedChassisUuid}'.`,
        errorCode: "HARDWARE_MISMATCH",
      };
    }

    if (device.expectedMacAddress && device.expectedMacAddress !== csr.hardwareIdentity.macAddress) {
      return {
        success: false,
        deviceStatus: device.status,
        gatewayId: device.gatewayId,
        error: `MAC address '${csr.hardwareIdentity.macAddress}' does not match expected '${device.expectedMacAddress}'.`,
        errorCode: "HARDWARE_MISMATCH",
      };
    }

    // Issue X.509 Device Certificate
    const certBundle = this.pkiEngine.issueDeviceCertificate(csr.csrPem, {
      validityDays: 365,
      san: csr.san,
    });

    // Mark token as used
    tokenCheck.token.used = true;
    tokenCheck.token.usedAt = new Date().toISOString();
    tokenCheck.token.usedByHardwareId = csr.hardwareIdentity.chassisUuid;

    // Update device status
    device.status = "CERT_ISSUED";
    device.activeCertificateFingerprint = certBundle.metadata.fingerprintSha256;
    device.lastSeenAt = new Date().toISOString();

    logAuditEventToDb({
      tenantId: device.tenantId || "SYSTEM",
      userRole: "ADMIN",
      userName: "ztp-authority",
      action: "ZTP_CERTIFICATE_ISSUED",
      module: "Zero-Touch Provisioning",
      targetId: device.gatewayId,
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify({
        gatewayId: device.gatewayId,
        serialNumber: certBundle.metadata.serialNumber,
        fingerprintSha256: certBundle.metadata.fingerprintSha256,
      }),
    }).catch(() => {});

    return {
      success: true,
      deviceStatus: "CERT_ISSUED",
      gatewayId: device.gatewayId,
      certificateBundle: certBundle,
    };
  }

  // ==========================================================================
  // 4. Mutual TLS (mTLS) Handshake Verification
  // ==========================================================================

  /**
   * Verifies an mTLS connection request from an edge device.
   */
  public verifyMtlsHandshake(request: MtlsVerificationRequest): MtlsVerificationResponse {
    // 1. Verify certificate chain and revocation status
    const chainCheck = this.pkiEngine.verifyCertificateChain(request.clientCertificatePem);
    if (!chainCheck.valid) {
      const isRevoked = chainCheck.reason?.includes("REVOKED");
      return {
        authenticated: false,
        status: isRevoked ? "REJECTED_REVOKED" : "REJECTED_UNTRUSTED_CLIENT",
        error: chainCheck.reason,
      };
    }

    // 2. Extract Client Certificate metadata
    const metadata = this.pkiEngine.extractCertificateMetadata(request.clientCertificatePem);

    // 3. Match device from CommonName
    const cnMatch = metadata.subject.match(/CN=([^,\n]+)/);
    const commonName = cnMatch ? cnMatch[1] : "";
    const gatewayId = commonName.replace(/^edge-/, "").split(".")[0];

    const device = this.preRegisteredDevices.get(gatewayId);
    if (!device) {
      return {
        authenticated: false,
        status: "REJECTED_TARGET_MISMATCH",
        error: `No pre-registered device matched for CN '${commonName}'.`,
      };
    }

    // 4. Verify client cryptographic signature proof over the nonces
    const payloadToSign = `${request.serverNonce}:${request.clientNonce}`;
    const x509 = new crypto.X509Certificate(request.clientCertificatePem);

    try {
      const verify = crypto.createVerify("SHA256");
      verify.update(payloadToSign, "utf8");
      verify.end();
      const verified = verify.verify(x509.publicKey, request.clientSignatureProof, "base64");
      if (!verified) {
        return {
          authenticated: false,
          status: "REJECTED_UNTRUSTED_CLIENT",
          error: "mTLS cryptographic signature proof failed (client does not possess private key).",
        };
      }
    } catch (err: any) {
      return {
        authenticated: false,
        status: "REJECTED_UNTRUSTED_CLIENT",
        error: `Signature proof verification error: ${err.message}`,
      };
    }

    // Update status
    device.status = "MTLS_ESTABLISHED";
    device.lastSeenAt = new Date().toISOString();
    device.activeCertificateFingerprint = metadata.fingerprintSha256;

    const sessionToken = `mtls-sess-${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}`;
    this.activeMtlsSessions.set(sessionToken, {
      gatewayId: device.gatewayId,
      tenantId: device.tenantId,
      siteId: device.siteId,
      establishedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      fingerprint: metadata.fingerprintSha256,
    });

    return {
      authenticated: true,
      status: "ESTABLISHED",
      gatewayId: device.gatewayId,
      tenantId: device.tenantId,
      siteId: device.siteId,
      clientFingerprint: metadata.fingerprintSha256,
    };
  }

  // ==========================================================================
  // 5. Initial Configuration Manifest Dispatch & Commissioning Lifecycle
  // ==========================================================================

  /**
   * Prepares and cryptographically signs an initial configuration manifest for an edge daemon.
   */
  public prepareInitialManifest(
    gatewayId: string,
    signingKeyPem: string,
    options: {
      keyId: string;
      ttlHours?: number;
    }
  ): SignedEdgeManifest {
    const device = this.preRegisteredDevices.get(gatewayId);
    if (!device) {
      throw new Error(`Device '${gatewayId}' not found for manifest preparation.`);
    }

    const now = Date.now();
    const ttlMs = (options.ttlHours || 48) * 3600 * 1000;

    const manifest = {
      manifestId: `man-init-${gatewayId}-${Date.now().toString(36)}`,
      version: 1,
      tenantId: device.tenantId,
      siteId: device.siteId,
      gatewayId: device.gatewayId,
      runtimeProfile: device.assignedRuntimeProfile,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      nonce: crypto.randomBytes(16).toString("hex"),
      drivers: [
        {
          id: `drv-modbus-${gatewayId}`,
          protocol: "MODBUS_TCP" as const,
          endpoint: "192.168.10.15:502",
          timeoutMs: 3000,
          readOnly: false,
          isSimulatedFallback: device.assignedRuntimeProfile !== "PRODUCTION",
        },
        {
          id: `drv-spb-${gatewayId}`,
          protocol: "SPARKPLUG" as const,
          endpoint: "mqtt://192.168.10.60:1883",
          timeoutMs: 5000,
          readOnly: false,
          isSimulatedFallback: device.assignedRuntimeProfile !== "PRODUCTION",
        },
      ],
      tags: [
        {
          tagId: "Milling.Tandem1.TCH",
          name: "Milling Tandem Cane Rate",
          address: "40001",
          dataType: "FLOAT32",
          unit: "TCH",
          scanRateMs: 1000,
        },
        {
          tagId: "Steam.Boiler1.Pressure",
          name: "Main Boiler Steam Pressure",
          address: "40003",
          dataType: "FLOAT32",
          unit: "bar",
          scanRateMs: 500,
        },
      ],
    };

    return this.manifestService.signManifest(manifest, signingKeyPem, {
      keyId: options.keyId,
      algorithm: "ECDSA-SHA256",
      signedBy: "ztp-orchestrator@bioazucar.internal",
    });
  }

  /**
   * Confirms successful edge commissioning after driver health check.
   */
  public confirmCommissioning(gatewayId: string): boolean {
    const device = this.preRegisteredDevices.get(gatewayId);
    if (!device) return false;

    device.status = "COMMISSIONED";
    device.lastSeenAt = new Date().toISOString();

    logAuditEventToDb({
      tenantId: device.tenantId || "SYSTEM",
      userRole: "ADMIN",
      userName: "ztp-service",
      action: "ZTP_DEVICE_COMMISSIONED",
      module: "Zero-Touch Provisioning",
      targetId: gatewayId,
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify({
        gatewayId,
        tenantId: device.tenantId,
        siteId: device.siteId,
      }),
    }).catch(() => {});

    return true;
  }

  /**
   * Marks device as faulted/rolled back if commissioning fails.
   */
  public reportCommissioningFault(gatewayId: string, error: string): void {
    const device = this.preRegisteredDevices.get(gatewayId);
    if (device) {
      device.status = "FAULTED_ROLLBACK";
      device.lastSeenAt = new Date().toISOString();

      logAuditEventToDb({
        tenantId: device.tenantId || "SYSTEM",
        userRole: "ADMIN",
        userName: "ztp-service",
        action: "ZTP_COMMISSIONING_FAULT_ROLLBACK",
        module: "Zero-Touch Provisioning",
        targetId: gatewayId,
        status: "DENIED",
        ipAddress: "127.0.0.1",
        newValue: JSON.stringify({ gatewayId, error }),
      }).catch(() => {});
    }
  }

  /**
   * Revokes a provisioned device certificate.
   */
  public revokeDevice(gatewayId: string, reason: string): boolean {
    const device = this.preRegisteredDevices.get(gatewayId);
    if (!device || !device.activeCertificateFingerprint) return false;

    this.pkiEngine.revokeCertificate(device.activeCertificateFingerprint, reason);
    device.status = "REVOKED";

    logAuditEventToDb({
      tenantId: device.tenantId || "SYSTEM",
      userRole: "ADMIN",
      userName: "admin-security",
      action: "ZTP_DEVICE_CERTIFICATE_REVOKED",
      module: "Zero-Touch Provisioning",
      targetId: gatewayId,
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      newValue: JSON.stringify({ gatewayId, reason, fingerprint: device.activeCertificateFingerprint }),
    }).catch(() => {});

    return true;
  }

  private findDeviceByChassisOrMac(hw: HardwareIdentity): PreRegisteredDevice | undefined {
    for (const d of this.preRegisteredDevices.values()) {
      if (d.expectedChassisUuid && d.expectedChassisUuid === hw.chassisUuid) return d;
      if (d.expectedMacAddress && d.expectedMacAddress === hw.macAddress) return d;
      if (d.expectedSerialNumber && d.expectedSerialNumber === hw.serialNumber) return d;
    }
    return undefined;
  }

  // ==========================================================================
  // 6. Edge Device Agent Simulator (End-to-End Client Workflow)
  // ==========================================================================

  /**
   * Executes the entire ZTP flow on an edge node in a single automated procedure.
   */
  public async executeEdgeZtpWorkflow(params: {
    hardwareIdentity: HardwareIdentity;
    bootstrapTokenId: string;
    bootstrapTokenSecret: string;
    signingAuthorityPublicKeyPem: string;
    signingAuthorityKeyId: string;
    caKeyPemForServerSign: string;
  }): Promise<{
    success: boolean;
    status: ZtpDeviceStatus;
    gatewayId: string;
    certificateBundle?: IssuedCertificateBundle;
    rolledBack?: boolean;
    error?: string;
  }> {
    const {
      hardwareIdentity,
      bootstrapTokenId,
      bootstrapTokenSecret,
      signingAuthorityPublicKeyPem,
      signingAuthorityKeyId,
      caKeyPemForServerSign,
    } = params;

    // Register trusted authority public key on Edge
    this.manifestService.registerTrustedKey(
      signingAuthorityKeyId,
      signingAuthorityPublicKeyPem,
      "ECDSA-SHA256"
    );

    // 1. Generate CSR on Edge Device
    const subject: SubjectDistinguishedName = {
      commonName: `edge-${hardwareIdentity.serialNumber}.bioazucar.internal`,
      organization: "BioAzucar Sugar Mill",
      organizationalUnit: "Industrial Edge Fleet",
      country: "VE",
      stateOrProvince: "Portuguesa",
      locality: "Acarigua",
    };

    const san: SubjectAlternativeNames = {
      dnsNames: [`edge-${hardwareIdentity.serialNumber}.bioazucar.internal`],
      ipAddresses: ["192.168.10.50"],
    };

    const { csrPem, privateKeyPem } = this.pkiEngine.generateDeviceCsr(subject, san);

    // 2. Compute Bootstrap Token Proof
    const nonce = crypto.randomBytes(16).toString("hex");
    const tokenProof = ZeroTouchProvisioningService.computeTokenProof(
      bootstrapTokenSecret,
      hardwareIdentity,
      nonce
    );

    const csrRequest: CertificateSigningRequest = {
      csrPem,
      publicKeyPem: "",
      subject,
      san,
      algorithm: "ECDSA-SHA256",
      hardwareIdentity,
      bootstrapTokenId,
      bootstrapTokenProof: tokenProof,
      nonce,
      timestamp: new Date().toISOString(),
    };

    // 3. Submit CSR to Central Provisioning Authority
    const enrollResult = await this.processEnrollment(csrRequest);
    if (!enrollResult.success || !enrollResult.certificateBundle) {
      return {
        success: false,
        status: enrollResult.deviceStatus,
        gatewayId: enrollResult.gatewayId,
        error: enrollResult.error,
      };
    }

    const certBundle = enrollResult.certificateBundle;

    // 4. Perform Mutual TLS Handshake
    const serverNonce = crypto.randomBytes(16).toString("hex");
    const clientNonce = crypto.randomBytes(16).toString("hex");
    const payloadToSign = `${serverNonce}:${clientNonce}`;

    const sign = crypto.createSign("SHA256");
    sign.update(payloadToSign, "utf8");
    sign.end();
    const clientSignatureProof = sign.sign(privateKeyPem, "base64");

    const mtlsReq: MtlsVerificationRequest = {
      clientCertificatePem: certBundle.certificatePem,
      serverCertificatePem: certBundle.intermediateCaPem || certBundle.rootCaPem,
      tlsVersion: "TLSv1.3",
      cipherSuite: "TLS_AES_256_GCM_SHA384",
      clientNonce,
      serverNonce,
      clientSignatureProof,
    };

    const mtlsResult = this.verifyMtlsHandshake(mtlsReq);
    if (!mtlsResult.authenticated) {
      return {
        success: false,
        status: "CSR_SUBMITTED",
        gatewayId: enrollResult.gatewayId,
        error: `mTLS handshake failed: ${mtlsResult.error}`,
      };
    }

    // 5. Download & Apply Signed Configuration Manifest
    const signedManifest = this.prepareInitialManifest(
      enrollResult.gatewayId,
      caKeyPemForServerSign,
      { keyId: signingAuthorityKeyId }
    );

    const applyResult = await this.manifestService.applySignedManifest(signedManifest);

    if (applyResult.rolledBack) {
      this.reportCommissioningFault(
        enrollResult.gatewayId,
        applyResult.rollbackReason || "Post-reconfiguration health check failed."
      );
      return {
        success: false,
        status: "FAULTED_ROLLBACK",
        gatewayId: enrollResult.gatewayId,
        rolledBack: true,
        error: applyResult.rollbackReason,
      };
    }

    // 6. Confirm Commissioning
    this.confirmCommissioning(enrollResult.gatewayId);

    return {
      success: true,
      status: "COMMISSIONED",
      gatewayId: enrollResult.gatewayId,
      certificateBundle: certBundle,
      rolledBack: false,
    };
  }

  public resetForTesting(): void {
    this.preRegisteredDevices.clear();
    this.bootstrapTokens.clear();
    this.activeMtlsSessions.clear();
    this.pkiEngine.clearRevocationsForTesting();
  }
}
