import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import {
  X509CertificateEngine,
  ZeroTouchProvisioningService,
  HardwareIdentity,
  SubjectDistinguishedName,
  SubjectAlternativeNames,
  CertificateSigningRequest,
  MtlsVerificationRequest,
} from "../services/edge/provisioning";
import { EdgeProvisioningService } from "../services/edge/EdgeProvisioningService";

describe("Iteración I30 / PRV-02: Zero-Touch Remote Provisioning (ZTP) & X.509 mTLS PKI", () => {
  let pkiEngine: X509CertificateEngine;
  let ztpService: ZeroTouchProvisioningService;
  let manifestService: EdgeProvisioningService;

  const sampleHardware: HardwareIdentity = {
    chassisUuid: "advan-uno-2484g-uuid-98471-a",
    serialNumber: "IPC-PORTUGUESA-001",
    macAddress: "00:1E:06:42:F1:8A",
    hardwareModel: "Advantech UNO-2484G Industrial IPC",
    cpuArchitecture: "x86_64",
    tpmPresent: true,
  };

  beforeEach(() => {
    pkiEngine = X509CertificateEngine.getInstance();
    ztpService = ZeroTouchProvisioningService.getInstance();
    manifestService = EdgeProvisioningService.getInstance();

    ztpService.resetForTesting();
    pkiEngine.initializeDefaultHierarchy();
  });

  describe("Capa 1: Jerarquía X.509 PKI Industrial (Root CA & Intermediate CA)", () => {
    it("debe inicializar Root CA e Intermediate CA válidas parseables por crypto.X509Certificate", () => {
      const rootCertPem = pkiEngine.getRootCaCertificate();
      const intCertPem = pkiEngine.getIntermediateCaCertificate();

      expect(rootCertPem).toContain("BEGIN CERTIFICATE");
      expect(intCertPem).toContain("BEGIN CERTIFICATE");

      const rootX509 = new crypto.X509Certificate(rootCertPem);
      const intX509 = new crypto.X509Certificate(intCertPem);

      expect(rootX509.ca).toBe(true);
      expect(rootX509.subject).toContain("BioAzucar");
      expect(intX509.ca).toBe(true);

      // Verify intermediate certificate is signed by root certificate
      const isSignedByRoot = intX509.verify(rootX509.publicKey);
      expect(isSignedByRoot).toBe(true);
    });

    it("debe generar un CSR en el Edge con par de llaves ECDSA prime256v1 local", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-tandem1.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
        stateOrProvince: "Portuguesa",
        locality: "Acarigua",
      };

      const san: SubjectAlternativeNames = {
        dnsNames: ["edge-tandem1.bioazucar.internal"],
        ipAddresses: ["192.168.10.50"],
      };

      const { csrPem, privateKeyPem, publicKeyPem } = pkiEngine.generateDeviceCsr(subject, san);

      expect(csrPem).toContain("BEGIN CERTIFICATE REQUEST");
      expect(privateKeyPem).toContain("PRIVATE KEY");
      expect(publicKeyPem).toContain("BEGIN PUBLIC KEY");
    });

    it("debe firmar el CSR y emitir un Certificado de Dispositivo X.509 con cadena válida", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-boiler1.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem, { validityDays: 180 });

      expect(bundle.certificatePem).toContain("BEGIN CERTIFICATE");
      expect(bundle.metadata.isCa).toBe(false);
      expect(bundle.metadata.fingerprintSha256.length).toBe(64);

      // Verify chain
      const verification = pkiEngine.verifyCertificateChain(bundle.certificatePem);
      expect(verification.valid).toBe(true);
    });

    it("debe revocar certificados y rechazar su verificación en la cadena (CRL / Revocation)", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-compromised.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);

      expect(pkiEngine.verifyCertificateChain(bundle.certificatePem).valid).toBe(true);

      // Revoke certificate
      pkiEngine.revokeCertificate(bundle.metadata.fingerprintSha256, "KEY_COMPROMISE_EDGE_STOLEN");

      expect(pkiEngine.isRevoked(bundle.metadata.fingerprintSha256)).toBe(true);

      const verification = pkiEngine.verifyCertificateChain(bundle.certificatePem);
      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain("REVOKED");
    });
  });

  describe("Capa 2: Tokens de Bootstrap Day-0 y Binding de Identidad de Hardware", () => {
    it("debe generar un Bootstrap Token criptográficamente seguro con TTL", () => {
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
        ttlHours: 12,
      });

      expect(token.tokenId).toMatch(/^tok-ztp-/);
      expect(token.tokenSecret.length).toBe(64); // 32 bytes hex
      expect(token.used).toBe(false);

      const expiresMs = new Date(token.expiresAt).getTime();
      expect(expiresMs).toBeGreaterThan(Date.now() + 11 * 3600 * 1000);
    });

    it("debe validar la prueba HMAC-SHA256 del token vinculada al hardware", () => {
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const validProof = ZeroTouchProvisioningService.computeTokenProof(
        token.tokenSecret,
        sampleHardware,
        nonce
      );

      const result = ztpService.validateTokenProof(token.tokenId, validProof, sampleHardware, nonce);
      expect(result.valid).toBe(true);
      expect(result.token?.tokenId).toBe(token.tokenId);
    });

    it("debe rechazar pruebas con hardware spoofing o alteración de MAC/chassis", () => {
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const validProof = ZeroTouchProvisioningService.computeTokenProof(
        token.tokenSecret,
        sampleHardware,
        nonce
      );

      // Attacker attempts using same proof with a different MAC
      const spoofedHardware: HardwareIdentity = {
        ...sampleHardware,
        macAddress: "AA:BB:CC:DD:EE:FF",
      };

      const result = ztpService.validateTokenProof(token.tokenId, validProof, spoofedHardware, nonce);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("mismatch");
    });

    it("debe invalidar el token inmediatamente tras su primer uso para impedir ataques de replay", () => {
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const validProof = ZeroTouchProvisioningService.computeTokenProof(
        token.tokenSecret,
        sampleHardware,
        nonce
      );

      // First validation succeeds
      const firstCheck = ztpService.validateTokenProof(token.tokenId, validProof, sampleHardware, nonce);
      expect(firstCheck.valid).toBe(true);

      // Consume the token
      token.used = true;

      // Second validation must fail
      const secondCheck = ztpService.validateTokenProof(token.tokenId, validProof, sampleHardware, nonce);
      expect(secondCheck.valid).toBe(false);
      expect(secondCheck.error).toContain("consumed");
    });
  });

  describe("Capa 3: Enrolamiento ZTP y Cumplimiento IEC 62443 FR1", () => {
    it("debe rechazar dispositivos que no estén previamente registrados en el inventario", async () => {
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-UNKNOWN-999",
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const tokenProof = ZeroTouchProvisioningService.computeTokenProof(
        token.tokenSecret,
        sampleHardware,
        nonce
      );

      const subject: SubjectDistinguishedName = {
        commonName: "edge-unknown.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);

      const csrRequest: CertificateSigningRequest = {
        csrPem,
        publicKeyPem: "",
        subject,
        algorithm: "ECDSA-SHA256",
        hardwareIdentity: sampleHardware,
        bootstrapTokenId: token.tokenId,
        bootstrapTokenProof: tokenProof,
        nonce,
        timestamp: new Date().toISOString(),
      };

      const response = await ztpService.processEnrollment(csrRequest);
      expect(response.success).toBe(false);
      expect(response.errorCode).toBe("DEVICE_NOT_REGISTERED");
    });

    it("debe procesar el enrolamiento de un dispositivo pre-registrado y consumir el token", async () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        expectedChassisUuid: sampleHardware.chassisUuid,
        expectedMacAddress: sampleHardware.macAddress,
        expectedSerialNumber: sampleHardware.serialNumber,
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "chief-engineer@bioazucar.com",
        status: "UNPROVISIONED",
      });

      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const tokenProof = ZeroTouchProvisioningService.computeTokenProof(
        token.tokenSecret,
        sampleHardware,
        nonce
      );

      const subject: SubjectDistinguishedName = {
        commonName: "edge-IPC-PORTUGUESA-001.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);

      const csrRequest: CertificateSigningRequest = {
        csrPem,
        publicKeyPem: "",
        subject,
        algorithm: "ECDSA-SHA256",
        hardwareIdentity: sampleHardware,
        bootstrapTokenId: token.tokenId,
        bootstrapTokenProof: tokenProof,
        nonce,
        timestamp: new Date().toISOString(),
      };

      const response = await ztpService.processEnrollment(csrRequest);
      expect(response.success).toBe(true);
      expect(response.deviceStatus).toBe("CERT_ISSUED");
      expect(response.certificateBundle?.certificatePem).toBeDefined();

      // Check token is now marked used
      expect(token.used).toBe(true);

      // Attempting to reuse same token must fail
      const reuseAttempt = await ztpService.processEnrollment(csrRequest);
      expect(reuseAttempt.success).toBe(false);
      expect(reuseAttempt.errorCode).toBe("INVALID_BOOTSTRAP_PROOF");
    });
  });

  describe("Capa 4: Mutual TLS (mTLS) Handshake & Verificación de Prueba de Posesión", () => {
    it("debe autenticar exitosamente la sesión mTLS con certificado válido y firma de nonce", async () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      const subject: SubjectDistinguishedName = {
        commonName: "edge-IPC-PORTUGUESA-001.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem, privateKeyPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);

      const serverNonce = crypto.randomBytes(16).toString("hex");
      const clientNonce = crypto.randomBytes(16).toString("hex");
      const payloadToSign = `${serverNonce}:${clientNonce}`;

      const sign = crypto.createSign("SHA256");
      sign.update(payloadToSign, "utf8");
      sign.end();
      const clientSignatureProof = sign.sign(privateKeyPem, "base64");

      const mtlsReq: MtlsVerificationRequest = {
        clientCertificatePem: bundle.certificatePem,
        serverCertificatePem: bundle.intermediateCaPem || bundle.rootCaPem,
        tlsVersion: "TLSv1.3",
        cipherSuite: "TLS_AES_256_GCM_SHA384",
        clientNonce,
        serverNonce,
        clientSignatureProof,
      };

      const result = ztpService.verifyMtlsHandshake(mtlsReq);
      expect(result.authenticated).toBe(true);
      expect(result.status).toBe("ESTABLISHED");
      expect(result.gatewayId).toBe("IPC-PORTUGUESA-001");
    });

    it("debe rechazar el handshake mTLS si la firma criptográfica es inválida", () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      const subject: SubjectDistinguishedName = {
        commonName: "edge-IPC-PORTUGUESA-001.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);

      // Create a forged signature using a different key
      const { privateKey } = crypto.generateKeyPairSync("ec", {
        namedCurve: "prime256v1",
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
        publicKeyEncoding: { type: "spki", format: "pem" },
      });

      const serverNonce = crypto.randomBytes(16).toString("hex");
      const clientNonce = crypto.randomBytes(16).toString("hex");
      const payloadToSign = `${serverNonce}:${clientNonce}`;

      const sign = crypto.createSign("SHA256");
      sign.update(payloadToSign, "utf8");
      sign.end();
      const forgedSignatureProof = sign.sign(privateKey, "base64");

      const mtlsReq: MtlsVerificationRequest = {
        clientCertificatePem: bundle.certificatePem,
        serverCertificatePem: bundle.intermediateCaPem || bundle.rootCaPem,
        tlsVersion: "TLSv1.3",
        cipherSuite: "TLS_AES_256_GCM_SHA384",
        clientNonce,
        serverNonce,
        clientSignatureProof: forgedSignatureProof,
      };

      const result = ztpService.verifyMtlsHandshake(mtlsReq);
      expect(result.authenticated).toBe(false);
      expect(result.status).toBe("REJECTED_UNTRUSTED_CLIENT");
    });
  });

  describe("Capa 5: Flujo Autónomo End-to-End ZTP (Simulación del Agente de Borde)", () => {
    it("debe completar el ciclo de provisión Zero-Touch E2E con Hot-Reload y transición a COMMISSIONED", async () => {
      // 1. Pre-register edge device
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        expectedChassisUuid: sampleHardware.chassisUuid,
        expectedMacAddress: sampleHardware.macAddress,
        expectedSerialNumber: sampleHardware.serialNumber,
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "plant-manager",
        status: "UNPROVISIONED",
      });

      // 2. Generate Day-0 bootstrap token
      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      // 3. Central signing authority generates key pair for manifest signing
      const authorityKeys = manifestService.generateKeyPair("ztp-auth-key", "ECDSA-SHA256");

      // 4. Run Edge Agent ZTP Workflow
      const workflowResult = await ztpService.executeEdgeZtpWorkflow({
        hardwareIdentity: sampleHardware,
        bootstrapTokenId: token.tokenId,
        bootstrapTokenSecret: token.tokenSecret,
        signingAuthorityPublicKeyPem: authorityKeys.publicKey,
        signingAuthorityKeyId: "ztp-auth-key",
        caKeyPemForServerSign: authorityKeys.privateKey,
      });

      expect(workflowResult.success).toBe(true);
      expect(workflowResult.status).toBe("COMMISSIONED");
      expect(workflowResult.certificateBundle).toBeDefined();

      const device = ztpService.getDevice("IPC-PORTUGUESA-001");
      expect(device?.status).toBe("COMMISSIONED");
      expect(device?.activeCertificateFingerprint).toBeDefined();
    });

    it("debe ejecutar revocación central y prohibir acceso subsiguiente mTLS", async () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      const token = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
      });

      const authorityKeys = manifestService.generateKeyPair("ztp-auth-key-2", "ECDSA-SHA256");

      const workflowResult = await ztpService.executeEdgeZtpWorkflow({
        hardwareIdentity: sampleHardware,
        bootstrapTokenId: token.tokenId,
        bootstrapTokenSecret: token.tokenSecret,
        signingAuthorityPublicKeyPem: authorityKeys.publicKey,
        signingAuthorityKeyId: "ztp-auth-key-2",
        caKeyPemForServerSign: authorityKeys.privateKey,
      });

      expect(workflowResult.success).toBe(true);

      // Central admin revokes the device
      const revoked = ztpService.revokeDevice("IPC-PORTUGUESA-001", "SUSPICIOUS_NETWORK_BEHAVIOR");
      expect(revoked).toBe(true);

      const device = ztpService.getDevice("IPC-PORTUGUESA-001");
      expect(device?.status).toBe("REVOKED");

      // Verify certificate is marked revoked in PKI engine
      expect(pkiEngine.isRevoked(device!.activeCertificateFingerprint!)).toBe(true);
    });

    it("debe rechazar tokens de bootstrap vencidos (TTL expirado)", () => {
      const expiredToken = ztpService.generateBootstrapToken({
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        gatewayId: "IPC-PORTUGUESA-001",
        ttlHours: -1, // Expired 1 hour ago
      });

      const nonce = crypto.randomBytes(16).toString("hex");
      const validProof = ZeroTouchProvisioningService.computeTokenProof(
        expiredToken.tokenSecret,
        sampleHardware,
        nonce
      );

      const check = ztpService.validateTokenProof(expiredToken.tokenId, validProof, sampleHardware, nonce);
      expect(check.valid).toBe(false);
      expect(check.error).toContain("expired");
    });

    it("debe inspeccionar y validar Subject Alternative Names (SAN) con DNS e IPs industriales", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-tandem2.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const san: SubjectAlternativeNames = {
        dnsNames: ["edge-tandem2.bioazucar.internal", "milling-gateway.local"],
        ipAddresses: ["192.168.10.75", "10.0.4.15"],
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject, san);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem, { san });

      const x509 = new crypto.X509Certificate(bundle.certificatePem);
      expect(x509.subjectAltName).toContain("edge-tandem2.bioazucar.internal");
      expect(x509.subjectAltName).toContain("192.168.10.75");
      expect(x509.subjectAltName).toContain("10.0.4.15");
    });

    it("debe extraer metadata completa del certificado X.509 de acuerdo con IEC 62443-4-2", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-boiler2.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);
      const meta = pkiEngine.extractCertificateMetadata(bundle.certificatePem);

      expect(meta.serialNumber).toBeDefined();
      expect(meta.issuer).toContain("BioAzucar");
      expect(meta.validFrom).toBeDefined();
      expect(meta.validTo).toBeDefined();
      expect(meta.revoked).toBe(false);
      expect(meta.extendedKeyUsage).toContain("clientAuth");
      expect(meta.extendedKeyUsage).toContain("serverAuth");
    });

    it("debe rechazar el handshake mTLS si el dispositivo no existe en el catálogo", () => {
      const subject: SubjectDistinguishedName = {
        commonName: "edge-nonexistent.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem, privateKeyPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);

      const serverNonce = crypto.randomBytes(16).toString("hex");
      const clientNonce = crypto.randomBytes(16).toString("hex");
      const payloadToSign = `${serverNonce}:${clientNonce}`;

      const sign = crypto.createSign("SHA256");
      sign.update(payloadToSign, "utf8");
      sign.end();
      const clientSignatureProof = sign.sign(privateKeyPem, "base64");

      const mtlsReq: MtlsVerificationRequest = {
        clientCertificatePem: bundle.certificatePem,
        serverCertificatePem: bundle.intermediateCaPem || bundle.rootCaPem,
        tlsVersion: "TLSv1.3",
        cipherSuite: "TLS_AES_256_GCM_SHA384",
        clientNonce,
        serverNonce,
        clientSignatureProof,
      };

      const result = ztpService.verifyMtlsHandshake(mtlsReq);
      expect(result.authenticated).toBe(false);
      expect(result.status).toBe("REJECTED_TARGET_MISMATCH");
    });

    it("debe listar correctamente todos los dispositivos pre-registrados en la flota", () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-NODE-1",
        tenantId: "ingenio-central",
        siteId: "site-1",
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      ztpService.preRegisterDevice({
        gatewayId: "IPC-NODE-2",
        tenantId: "ingenio-central",
        siteId: "site-2",
        assignedRuntimeProfile: "PRODUCTION",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      const devices = ztpService.getAllDevices();
      expect(devices.length).toBeGreaterThanOrEqual(2);
      expect(devices.some((d) => d.gatewayId === "IPC-NODE-1")).toBe(true);
      expect(devices.some((d) => d.gatewayId === "IPC-NODE-2")).toBe(true);
    });

    it("debe rechazar certificados revocados al intentar un nuevo handshake mTLS", () => {
      ztpService.preRegisterDevice({
        gatewayId: "IPC-PORTUGUESA-001",
        tenantId: "ingenio-rio-guanare",
        siteId: "site-acarigua",
        assignedRuntimeProfile: "LAB",
        registeredAt: new Date().toISOString(),
        registeredBy: "admin",
        status: "UNPROVISIONED",
      });

      const subject: SubjectDistinguishedName = {
        commonName: "edge-IPC-PORTUGUESA-001.bioazucar.internal",
        organization: "BioAzucar Sugar Mill",
        organizationalUnit: "Industrial Edge Fleet",
        country: "VE",
      };

      const { csrPem, privateKeyPem } = pkiEngine.generateDeviceCsr(subject);
      const bundle = pkiEngine.issueDeviceCertificate(csrPem);

      // Revoke the certificate
      pkiEngine.revokeCertificate(bundle.metadata.fingerprintSha256, "HARDWARE_DECOMMISSIONED");

      const serverNonce = crypto.randomBytes(16).toString("hex");
      const clientNonce = crypto.randomBytes(16).toString("hex");
      const payloadToSign = `${serverNonce}:${clientNonce}`;

      const sign = crypto.createSign("SHA256");
      sign.update(payloadToSign, "utf8");
      sign.end();
      const clientSignatureProof = sign.sign(privateKeyPem, "base64");

      const mtlsReq: MtlsVerificationRequest = {
        clientCertificatePem: bundle.certificatePem,
        serverCertificatePem: bundle.intermediateCaPem || bundle.rootCaPem,
        tlsVersion: "TLSv1.3",
        cipherSuite: "TLS_AES_256_GCM_SHA384",
        clientNonce,
        serverNonce,
        clientSignatureProof,
      };

      const result = ztpService.verifyMtlsHandshake(mtlsReq);
      expect(result.authenticated).toBe(false);
      expect(result.status).toBe("REJECTED_REVOKED");
    });
  });
});
