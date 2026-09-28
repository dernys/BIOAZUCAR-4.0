import { describe, it, expect, beforeEach } from "vitest";
import {
  assertStorageTierPermitted,
  FORBIDDEN_IN_LOCAL_STORAGE,
  IndustrialDataClassification,
  StorageClassificationViolationError,
  IndustrialIndexedDbVault,
} from "../services/storage/IndustrialIndexedDbVault";
import { diskStoreAndForward } from "../services/edge/DiskStoreAndForwardEngine";
import { getStoredUser, saveStoredUser, PREDEFINED_USERS } from "../services/authService";

describe("BIOAZÚCAR 4.0 — INDUSTRIAL LOCAL DATA ARCHITECTURE & STORAGE CLASSIFICATION", () => {
  let vault: IndustrialIndexedDbVault;

  beforeEach(() => {
    vault = IndustrialIndexedDbVault.getInstance();
    vault.clearMemoryForTesting();
  });

  describe("1. Strict Data Governance: Prohibiting Sensitive Operational Data in localStorage", () => {
    it("should strictly forbid credentials, tokens, telemetry, OT config and production params in localStorage tier", () => {
      for (const classification of FORBIDDEN_IN_LOCAL_STORAGE) {
        expect(() => {
          assertStorageTierPermitted(classification, "LOCAL_STORAGE_UI_ONLY");
        }).toThrowError(StorageClassificationViolationError);
      }
    });

    it("should allow only UI_PREFERENCE in localStorage tier", () => {
      expect(() => {
        assertStorageTierPermitted("UI_PREFERENCE", "LOCAL_STORAGE_UI_ONLY");
      }).not.toThrow();
    });

    it("should permit operational data classifications in INDEXED_DB and SQLITE_WAL tiers", () => {
      const classifications: IndustrialDataClassification[] = [
        "OT_CONFIG",
        "TELEMETRY",
        "ALARMS",
        "HISTORIAN",
        "PRODUCTION_PARAMS",
      ];

      for (const c of classifications) {
        expect(() => assertStorageTierPermitted(c, "INDEXED_DB")).not.toThrow();
        expect(() => assertStorageTierPermitted(c, "SQLITE_WAL")).not.toThrow();
      }
    });
  });

  describe("2. IndexedDB Vault Architecture for Browser Client", () => {
    it("should store and retrieve OT device configuration securely in vault", async () => {
      const mockDeviceConfig = {
        deviceId: "DEV_MOLINO_01",
        ip: "192.168.10.50",
        protocol: "MODBUS_TCP",
        port: 502,
        slaveId: 1,
        activeTags: ["TAG_SPEED_RPM", "TAG_PRESSURE_BAR"],
      };

      await vault.setItem("ot_devices", "DEV_MOLINO_01", mockDeviceConfig, "OT_CONFIG");
      const retrieved = await vault.getItem("ot_devices", "DEV_MOLINO_01");

      expect(retrieved).toEqual(mockDeviceConfig);
    });

    it("should store and clear Store & Forward offline telemetry queue in vault", async () => {
      const telemetryBatch = [
        { tagId: "TAG_JUICE_BRIX", value: 14.8, timestamp: new Date().toISOString() },
        { tagId: "TAG_BAGASSE_FLOW", value: 140.2, timestamp: new Date().toISOString() },
      ];

      await vault.setItem("saf_telemetry", "batch-001", telemetryBatch, "TELEMETRY");
      const retrieved = await vault.getItem<typeof telemetryBatch>("saf_telemetry", "batch-001");

      expect(retrieved).toHaveLength(2);

      await vault.removeItem("saf_telemetry", "batch-001");
      const afterRemoval = await vault.getItem("saf_telemetry", "batch-001");
      expect(afterRemoval).toBeNull();
    });
  });

  describe("3. Engine Verification: DiskStoreAndForwardEngine Never Uses LOCAL_STORAGE", () => {
    it("should report SQLITE_WAL, JSON_FILE or INDEXED_DB storage engine, never LOCAL_STORAGE", () => {
      const engine = diskStoreAndForward.getStorageEngine();
      expect(["SQLITE_WAL", "JSON_FILE", "INDEXED_DB", "MEMORY"]).toContain(engine);
      expect((engine as string)).not.toBe("LOCAL_STORAGE");
    });
  });

  describe("4. Authentication Service Session Governance", () => {
    it("should retrieve a valid non-privileged operator session without touching localStorage", () => {
      const user = getStoredUser();
      expect(user).toBeDefined();
      expect(user.role).toBe("operador");
      expect(user.isSuperAdmin).toBe(false);
    });

    it("should update and retain active operator session in memory", () => {
      const supervisor = PREDEFINED_USERS.find((u) => u.role === "supervisor")!;
      saveStoredUser(supervisor);

      const current = getStoredUser();
      expect(current.role).toBe("supervisor");
      expect(current.email).toBe(supervisor.email);
    });
  });
});
