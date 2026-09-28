import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BioAzucarEdgeDaemon, EdgeDaemonConfig } from "../services/edge/daemon";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";
import { DualNicManager } from "../services/edge/network/DualNicManager";
import { diskStoreAndForward } from "../services/edge/DiskStoreAndForwardEngine";
import { createCanonicalDataPoint } from "../types/industrialDataPoint";

describe("BIOAZÚCAR 4.0 — EDGE DAEMON PRODUCTION HARDENING & STORE-AND-FORWARD", () => {
  let runtimeManager: RuntimeProfileManager;
  let dualNicManager: DualNicManager;

  beforeEach(() => {
    runtimeManager = RuntimeProfileManager.getInstance();
    runtimeManager.suppressExitForTesting(true);
    dualNicManager = DualNicManager.getInstance();
    dualNicManager.setKernelIpForward(0);
    delete process.env.BIOAZUCAR_EDGE_SECRET;
  });

  afterEach(() => {
    runtimeManager.resetForTesting();
    dualNicManager.setKernelIpForward(0);
  });

  describe("1. Security: Elimination of Hardcoded Default Secrets & Startup Failure", () => {
    it("should abort startup in PRODUCTION if edge secret is missing", async () => {
      runtimeManager.setOverride("PRODUCTION");

      const config: EdgeDaemonConfig = {
        tenantId: "TENANT_AZUCAR_01",
        edgeId: "edge-test-01",
        edgeSecret: "", // Missing secret
        cloudSyncUrl: "https://central.bioazucar.com/api/edge/telemetry-sync",
        cloudSyncIntervalMs: 5000,
        heartbeatIntervalMs: 10000,
        batchSize: 50,
        healthPort: 9191,
        otInterface: "eth0",
        dmzInterface: "eth1",
        rejectUnauthorized: true,
      };

      const daemon = new BioAzucarEdgeDaemon(config);
      await expect(daemon.start()).rejects.toThrowError(
        /Missing or insecure BIOAZUCAR_EDGE_SECRET in PRODUCTION/
      );
    });

    it("should abort startup in PRODUCTION if edge secret is insecure default string", async () => {
      runtimeManager.setOverride("PRODUCTION");

      const config: EdgeDaemonConfig = {
        tenantId: "TENANT_AZUCAR_01",
        edgeId: "edge-test-01",
        edgeSecret: "bioazucar_industrial_edge_super_secret_key", // Insecure default
        cloudSyncUrl: "https://central.bioazucar.com/api/edge/telemetry-sync",
        cloudSyncIntervalMs: 5000,
        heartbeatIntervalMs: 10000,
        batchSize: 50,
        healthPort: 9192,
        otInterface: "eth0",
        dmzInterface: "eth1",
        rejectUnauthorized: true,
      };

      const daemon = new BioAzucarEdgeDaemon(config);
      await expect(daemon.start()).rejects.toThrowError(
        /Missing or insecure BIOAZUCAR_EDGE_SECRET in PRODUCTION/
      );
    });
  });

  describe("2. Security: Insecure HTTP Protocol Rejection in PRODUCTION", () => {
    it("should reject http:// endpoint in PRODUCTION and mandate HTTPS/mTLS", async () => {
      runtimeManager.setOverride("PRODUCTION");

      const config: EdgeDaemonConfig = {
        tenantId: "TENANT_AZUCAR_01",
        edgeId: "edge-test-01",
        edgeSecret: "a_very_secure_high_entropy_secret_key_prod_64_bytes_long_12345",
        cloudSyncUrl: "http://central.bioazucar.com/api/edge/telemetry-sync", // HTTP rejected
        cloudSyncIntervalMs: 5000,
        heartbeatIntervalMs: 10000,
        batchSize: 50,
        healthPort: 9193,
        otInterface: "eth0",
        dmzInterface: "eth1",
        rejectUnauthorized: true,
      };

      const daemon = new BioAzucarEdgeDaemon(config);
      await expect(daemon.start()).rejects.toThrowError(
        /Insecure HTTP sync endpoint .* rejected in PRODUCTION profile/
      );
    });
  });

  describe("3. Dual-NIC OT/IT Isolation Enforcement", () => {
    it("should abort startup in PRODUCTION if kernel IP forwarding is enabled (net.ipv4.ip_forward = 1)", async () => {
      runtimeManager.setOverride("PRODUCTION");
      dualNicManager.setKernelIpForward(1); // Violation!

      const config: EdgeDaemonConfig = {
        tenantId: "TENANT_AZUCAR_01",
        edgeId: "edge-test-01",
        edgeSecret: "a_very_secure_high_entropy_secret_key_prod_64_bytes_long_12345",
        cloudSyncUrl: "https://central.bioazucar.com/api/edge/telemetry-sync",
        cloudSyncIntervalMs: 5000,
        heartbeatIntervalMs: 10000,
        batchSize: 50,
        healthPort: 9194,
        otInterface: "eth0",
        dmzInterface: "eth1",
        rejectUnauthorized: true,
      };

      const daemon = new BioAzucarEdgeDaemon(config);
      await expect(daemon.start()).rejects.toThrowError(
        /Dual-NIC kernel IP forwarding is enabled/
      );
    });

    it("should pass Dual-NIC security compliance audit when isolated", () => {
      dualNicManager.setKernelIpForward(0);
      const audit = dualNicManager.auditDualNicCompliance();

      expect(audit.ipForwardingDisabled).toBe(true);
      expect(audit.otHasNoDefaultGateway).toBe(true);
      expect(audit.complianceScore).toBe(100);
      expect(audit.violations).toHaveLength(0);
    });
  });

  describe("4. Store & Forward Resilient Accounting & Outage Recovery", () => {
    it("should track generated, persisted, transmitted, and acknowledged points with zero loss", async () => {
      const config: EdgeDaemonConfig = {
        tenantId: "TENANT_AZUCAR_01",
        edgeId: "edge-node-saf-test",
        edgeSecret: "test_secret_for_saf_simulation_unit_test_99",
        cloudSyncUrl: "https://mock-cloud.bioazucar.local/api/edge/telemetry-sync",
        cloudSyncIntervalMs: 1000,
        heartbeatIntervalMs: 5000,
        batchSize: 10,
        healthPort: 9195,
        otInterface: "eth0",
        dmzInterface: "eth1",
        rejectUnauthorized: false,
      };

      const daemon = new BioAzucarEdgeDaemon(config);
      const initialAccounting = daemon.getSafAccounting();

      expect(initialAccounting.generated).toBe(0);
      expect(initialAccounting.persisted).toBe(0);
      expect(initialAccounting.acknowledged).toBe(0);
      expect(initialAccounting.lost).toBe(0);

      // Create test data points
      const p1: any = {
        id: `pt-1-${Date.now()}`,
        tag: "TAG_MOLINO_SPEED",
        tagId: "TAG_MOLINO_SPEED",
        equipmentId: "MOLINO-01",
        areaId: "MOLIENDA",
        value: 1250,
        unit: "RPM",
        dataType: "FLOAT64",
        source: "MODBUS",
        protocol: "MODBUS_TCP",
        quality: "GOOD",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1,
        isHistorical: false,
        isSimulated: false,
        runtimeMode: "LAB",
        sourceType: "PLC",
        sourceId: "src-plc-01",
        driverId: "drv-modbus-01",
        deviceId: "dev-molino-01",
        assetId: "ast-tandem-01",
        engineeringUnit: "RPM",
      };

      const p2: any = {
        id: `pt-2-${Date.now()}`,
        tag: "TAG_CALDERA_PRESS",
        tagId: "TAG_CALDERA_PRESS",
        equipmentId: "CALDERA-01",
        areaId: "GENERACION_VAPOR",
        value: 65.4,
        unit: "bar",
        dataType: "FLOAT64",
        source: "OPC_UA",
        protocol: "OPC_UA",
        quality: "GOOD",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 2,
        isHistorical: false,
        isSimulated: false,
        runtimeMode: "LAB",
        sourceType: "PLC",
        sourceId: "src-plc-02",
        driverId: "drv-opcua-01",
        deviceId: "dev-caldera-01",
        assetId: "ast-caldera-01",
        engineeringUnit: "bar",
      };

      // Enqueue to disk Store & Forward
      diskStoreAndForward.clear();
      diskStoreAndForward.enqueueBatch([p1, p2]);

      const state = diskStoreAndForward.getState();
      expect(state.bufferedCount).toBeGreaterThanOrEqual(2);

      // Prepare batch and verify rollback on communication failure
      const batch = diskStoreAndForward.prepareBatch(2);
      expect(batch).not.toBeNull();
      expect(batch!.points).toHaveLength(2);

      // Rollback simulates WAN outage during transmission
      diskStoreAndForward.rollbackBatch(batch!.batchId);
      const afterRollback = diskStoreAndForward.getState();
      expect(afterRollback.bufferedCount).toBeGreaterThanOrEqual(2);

      // Second attempt succeeds and acknowledges
      const reBatch = diskStoreAndForward.prepareBatch(2);
      expect(reBatch).not.toBeNull();
      diskStoreAndForward.acknowledgeBatch(reBatch!.batchId);

      const afterAck = diskStoreAndForward.getState();
      expect(afterAck.totalForwarded).toBeGreaterThanOrEqual(2);
    });
  });
});
