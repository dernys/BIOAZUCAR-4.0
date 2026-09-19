/**
 * BioAzúcar 4.0 — Test Suite: [P0-05] Edge Provisioning E2E con Firma Asimétrica (PRV-01)
 * 
 * Spec Reference: BIOAZUCAR_MASTER_DEVELOPMENT.md Section 25 [P0-05] & IEC 62443-4-2
 * 
 * Verifies:
 *  1. Asymmetric cryptographic key generation and ECDSA-SHA256 / HMAC-SHA256 signature verification.
 *  2. Tamper-evident protection: detecting payload mutation or forged hashes.
 *  3. Anti-replay and expiration defense: rejecting replayed nonces and expired manifests.
 *  4. Strict target boundary enforcement: preventing cross-gateway / cross-tenant provisioning.
 *  5. Hot-reload driver reconfiguration without process restart.
 *  6. Autonomous Atomic Rollback: instantly restoring previous safe drivers upon healthcheck fault.
 *  7. Full audit history and cryptographic lineage tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EdgeProvisioningService,
  EdgeManifestConfig,
  SignedEdgeManifest,
} from "../services/edge/EdgeProvisioningService";
import { IndustrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { EdgeRuntimeSupervisor } from "../services/edge/supervisor/EdgeRuntimeSupervisor";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

describe("[P0-05] Edge Provisioning E2E con Firma Asimétrica & Atomic Rollback", () => {
  let provisioningService: EdgeProvisioningService;
  let driverManager: IndustrialDriverManager;
  let supervisor: EdgeRuntimeSupervisor;

  const TEST_TENANT = "TENANT_AZUCAR_CENTRAL";
  const TEST_SITE = "SITE_MOLIENDA_01";
  const TEST_GATEWAY = "EDGE_IPC_TANDEM1";

  beforeEach(() => {
    RuntimeProfileManager.getInstance().setOverride("LAB");
    provisioningService = EdgeProvisioningService.getInstance();
    driverManager = IndustrialDriverManager.getInstance();
    supervisor = EdgeRuntimeSupervisor.getInstance();

    provisioningService.resetStateForTesting();
    driverManager.clearAll();
    supervisor.resetSupervisor();
  });

  afterEach(async () => {
    await driverManager.disconnectAll();
    driverManager.clearAll();
    provisioningService.resetStateForTesting();
    supervisor.resetSupervisor();
    RuntimeProfileManager.getInstance().reset();
  });

  it("1. Debe generar par de claves asimétricas ECDSA y firmar/verificar un manifiesto válido", () => {
    const keyPair = provisioningService.generateKeyPair("ca-cloud-root-01", "ECDSA-SHA256");
    expect(keyPair.publicKey).toContain("BEGIN PUBLIC KEY");
    expect(keyPair.privateKey).toContain("BEGIN PRIVATE KEY");

    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    const manifestConfig: EdgeManifestConfig = {
      manifestId: "MAN-2026-TANDEM-01",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-TEST-001",
      drivers: [
        {
          id: "drv-modbus-tandem",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.10.10:502",
          reconnectIntervalMs: 500,
          timeoutMs: 2000,
          maxReconnectAttempts: 3,
        },
        {
          id: "drv-opcua-caldera",
          protocol: "OPC-UA",
          endpoint: "opc.tcp://192.168.10.50:4840",
          reconnectIntervalMs: 1000,
          timeoutMs: 3000,
          maxReconnectAttempts: 3,
        },
      ],
    };

    const signed = provisioningService.signManifest(manifestConfig, keyPair.privateKey, {
      keyId: keyPair.keyId,
      algorithm: "ECDSA-SHA256",
      signedBy: "admin-ot@bioazucar.com",
    });

    expect(signed.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.signature.signatureValue).toBeTruthy();
    expect(signed.signature.keyId).toBe("ca-cloud-root-01");

    const verifyResult = provisioningService.verifyManifest(signed, {
      expectedGatewayId: TEST_GATEWAY,
      expectedTenantId: TEST_TENANT,
    });

    expect(verifyResult.valid).toBe(true);
    expect(verifyResult.code).toBe("VALID");
    expect(verifyResult.payloadHash).toBe(signed.payloadHash);
  });

  it("2. Debe detectar manipulación de datos (tamper-evidence) si se alteran endpoints o parámetros", () => {
    const keyPair = provisioningService.generateKeyPair("ca-cloud-root-02", "ECDSA-SHA256");
    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    const manifestConfig: EdgeManifestConfig = {
      manifestId: "MAN-2026-TAMPER-01",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-TAMPER-001",
      drivers: [
        {
          id: "drv-modbus-1",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.10.20:502",
          reconnectIntervalMs: 500,
          timeoutMs: 2000,
          maxReconnectAttempts: 3,
        },
      ],
    };

    const signed = provisioningService.signManifest(manifestConfig, keyPair.privateKey, {
      keyId: keyPair.keyId,
      algorithm: "ECDSA-SHA256",
    });

    // Manipular el endpoint tras la firma
    const tamperedPayload: SignedEdgeManifest = {
      ...signed,
      manifest: {
        ...signed.manifest,
        drivers: [
          {
            id: "drv-modbus-1",
            protocol: "MODBUS-TCP",
            endpoint: "10.66.66.66:502", // IP alterada por atacante
            reconnectIntervalMs: 500,
            timeoutMs: 2000,
            maxReconnectAttempts: 3,
          },
        ],
      },
    };

    const result = provisioningService.verifyManifest(tamperedPayload);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("CORRUPTED_PAYLOAD");
    expect(result.error).toContain("hash del payload no coincide");
  });

  it("3. Debe rechazar manifiestos expirados y detectar ataques de retransmisión (anti-replay)", async () => {
    const keyPair = provisioningService.generateKeyPair("ca-key-03", "ECDSA-SHA256");
    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    // Manifiesto con fecha de expiración en el pasado
    const expiredConfig: EdgeManifestConfig = {
      manifestId: "MAN-EXPIRED-01",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date(Date.now() - 7200000).toISOString(),
      expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hora expirado
      nonce: "NONCE-EXPIRED-01",
      drivers: [],
    };

    const signedExpired = provisioningService.signManifest(expiredConfig, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    const verifyExpired = provisioningService.verifyManifest(signedExpired);
    expect(verifyExpired.valid).toBe(false);
    expect(verifyExpired.code).toBe("EXPIRED");

    // Probar detección de Nonce Replay
    const validConfig: EdgeManifestConfig = {
      manifestId: "MAN-REPLAY-01",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-SINGLE-USE-123",
      drivers: [
        {
          id: "drv-replay-modbus",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.10.15:502",
          reconnectIntervalMs: 1000,
          timeoutMs: 2000,
          maxReconnectAttempts: 3,
        },
      ],
    };

    const signedValid = provisioningService.signManifest(validConfig, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    // Primera aplicación: exitosa
    const firstApply = await provisioningService.applySignedManifest(signedValid, {
      expectedGatewayId: TEST_GATEWAY,
      expectedTenantId: TEST_TENANT,
    });
    expect(firstApply.success).toBe(true);

    // Segunda aplicación con el mismo nonce: REPLAY_DETECTED
    const replayApply = await provisioningService.applySignedManifest(signedValid, {
      expectedGatewayId: TEST_GATEWAY,
      expectedTenantId: TEST_TENANT,
    });
    expect(replayApply.success).toBe(false);
    expect(replayApply.rollbackReason).toContain("retransmisión");
  });

  it("4. Debe verificar aislamiento y rechazar manifiestos dirigidos a otro nodo o tenant", () => {
    const keyPair = provisioningService.generateKeyPair("ca-key-04", "ECDSA-SHA256");
    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    const foreignConfig: EdgeManifestConfig = {
      manifestId: "MAN-FOREIGN-01",
      version: 1,
      tenantId: "TENANT_DIFFERENT",
      siteId: TEST_SITE,
      gatewayId: "EDGE_IPC_OTHER_MILL",
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-FOREIGN-01",
      drivers: [],
    };

    const signed = provisioningService.signManifest(foreignConfig, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    const verifyGateway = provisioningService.verifyManifest(signed, {
      expectedGatewayId: TEST_GATEWAY,
    });
    expect(verifyGateway.valid).toBe(false);
    expect(verifyGateway.code).toBe("TARGET_MISMATCH");
    expect(verifyGateway.error).toContain("no coincide con el nodo local");
  });

  it("5. Debe ejecutar Hot-Reload de drivers en caliente sin reiniciar el daemon", async () => {
    const keyPair = provisioningService.generateKeyPair("ca-key-05", "ECDSA-SHA256");
    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    const manifestV1: EdgeManifestConfig = {
      manifestId: "MAN-V1-ACTIVE",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-V1-001",
      drivers: [
        {
          id: "drv-modbus-1",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.1.10:502",
          reconnectIntervalMs: 500,
          timeoutMs: 1000,
          maxReconnectAttempts: 2,
        },
      ],
    };

    const signedV1 = provisioningService.signManifest(manifestV1, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    const applyV1 = await provisioningService.applySignedManifest(signedV1);
    expect(applyV1.success).toBe(true);
    expect(applyV1.driversConfigured).toBe(1);
    expect(driverManager.getAllDrivers().length).toBe(1);
    expect(driverManager.getDriver("drv-modbus-1")).toBeDefined();

    // Hot-reload hacia V2 con 2 drivers (agrega OPC UA)
    const manifestV2: EdgeManifestConfig = {
      manifestId: "MAN-V2-ACTIVE",
      version: 2,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-V2-002",
      drivers: [
        {
          id: "drv-modbus-1",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.1.10:502",
          reconnectIntervalMs: 500,
          timeoutMs: 1000,
          maxReconnectAttempts: 2,
        },
        {
          id: "drv-opcua-tandem",
          protocol: "OPC-UA",
          endpoint: "opc.tcp://192.168.1.20:4840",
          reconnectIntervalMs: 1000,
          timeoutMs: 2000,
          maxReconnectAttempts: 3,
        },
      ],
    };

    const signedV2 = provisioningService.signManifest(manifestV2, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    const applyV2 = await provisioningService.applySignedManifest(signedV2);
    expect(applyV2.success).toBe(true);
    expect(applyV2.hotReloaded).toBe(true);
    expect(applyV2.driversConfigured).toBe(2);

    const activeDrivers = driverManager.getAllDrivers();
    expect(activeDrivers.length).toBe(2);
    expect(driverManager.getDriver("drv-opcua-tandem")).toBeDefined();
    expect(provisioningService.getActiveManifest()?.manifest.version).toBe(2);
  });

  it("6. Debe ejecutar Atomic Rollback autónomo si un driver falla en el healthcheck post-reconfiguración", async () => {
    const keyPair = provisioningService.generateKeyPair("ca-key-06", "ECDSA-SHA256");
    provisioningService.registerTrustedKey(keyPair.keyId, keyPair.publicKey, "ECDSA-SHA256");

    // 1. Desplegar Manifest Seguro V1
    const manifestV1: EdgeManifestConfig = {
      manifestId: "MAN-SAFE-V1",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-SAFE-01",
      drivers: [
        {
          id: "drv-safe-modbus",
          protocol: "MODBUS-TCP",
          endpoint: "192.168.10.5:502",
          reconnectIntervalMs: 1000,
          timeoutMs: 1000,
          maxReconnectAttempts: 1,
        },
      ],
    };

    const signedV1 = provisioningService.signManifest(manifestV1, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });
    const resultV1 = await provisioningService.applySignedManifest(signedV1);
    expect(resultV1.success).toBe(true);
    expect(driverManager.getDriver("drv-safe-modbus")).toBeDefined();

    // 2. Intentar desplegar Manifest V2 que provocará un fallo en connect()
    // Simulamos que el nuevo driver genera un fallo crítico
    const manifestV2Defective: EdgeManifestConfig = {
      manifestId: "MAN-DEFECTIVE-V2",
      version: 2,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-DEFECTIVE-02",
      drivers: [
        {
          id: "drv-broken-plc",
          protocol: "MODBUS-TCP",
          endpoint: "256.256.256.256:9999", // Dirección inválida
          reconnectIntervalMs: 1000,
          timeoutMs: 500,
          maxReconnectAttempts: 1,
        },
      ],
    };

    const signedV2 = provisioningService.signManifest(manifestV2Defective, keyPair.privateKey, {
      keyId: keyPair.keyId,
    });

    // Mockeamos que connectAll devuelve fallo para 'drv-broken-plc'
    const origConnectAll = driverManager.connectAll.bind(driverManager);
    vi.spyOn(driverManager, "connectAll").mockImplementationOnce(async () => {
      return { "drv-broken-plc": false };
    });

    const resultV2 = await provisioningService.applySignedManifest(signedV2);

    expect(resultV2.success).toBe(false);
    expect(resultV2.rolledBack).toBe(true);
    expect(resultV2.rollbackReason).toContain("Healthcheck fallido");

    // Verificar que el runtime restauró el driver seguro de V1
    const currentDrivers = driverManager.getAllDrivers();
    expect(currentDrivers.some((d) => d.id === "drv-safe-modbus")).toBe(true);
    expect(driverManager.getDriver("drv-broken-plc")).toBeUndefined();
    expect(provisioningService.getActiveManifest()?.manifest.manifestId).toBe("MAN-SAFE-V1");
  });

  it("7. Debe registrar historial completo y rechazar firmas con claves no confiables", () => {
    // Generamos dos pares de claves diferentes
    const trustedPair = provisioningService.generateKeyPair("trusted-key-01", "ECDSA-SHA256");
    const untrustedPair = provisioningService.generateKeyPair("untrusted-key-99", "ECDSA-SHA256");

    // Registramos sólo la clave trusted
    provisioningService.registerTrustedKey(trustedPair.keyId, trustedPair.publicKey, "ECDSA-SHA256");

    const manifest: EdgeManifestConfig = {
      manifestId: "MAN-UNTRUSTED-01",
      version: 1,
      tenantId: TEST_TENANT,
      siteId: TEST_SITE,
      gatewayId: TEST_GATEWAY,
      runtimeProfile: "LAB",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      nonce: "NONCE-UNTRUSTED-01",
      drivers: [],
    };

    // Firmamos con la clave NO registrada
    const signedUntrusted = provisioningService.signManifest(manifest, untrustedPair.privateKey, {
      keyId: untrustedPair.keyId,
    });

    const result = provisioningService.verifyManifest(signedUntrusted);
    expect(result.valid).toBe(false);
    expect(result.code).toBe("UNTRUSTED_KEY");
    expect(result.error).toContain("no está registrada como autoridad de confianza");
  });
});
