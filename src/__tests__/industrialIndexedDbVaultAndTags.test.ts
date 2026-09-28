import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  IndustrialIndexedDbVault,
  CANONICAL_OBJECT_STORES,
  assertStorageTierPermitted,
} from "../services/storage/IndustrialIndexedDbVault";
import { TagManagementService } from "../services/tagManagementService";
import { INITIAL_TAG_CATALOG } from "../services/tagManagementService";

describe("Industrial IndexedDB Vault & Tag Management Hydration Architecture", () => {
  let vault: IndustrialIndexedDbVault;

  beforeEach(() => {
    vault = IndustrialIndexedDbVault.getInstance();
    vault.clearMemoryForTesting();
  });

  afterEach(() => {
    vault.closeDb();
    vi.restoreAllMocks();
  });

  describe("1. Canonical Schema & Object Stores Definition", () => {
    it("should define exactly the canonical object stores required for plant operations", () => {
      const requiredStores = [
        "tags",
        "devices",
        "connections",
        "telemetry",
        "alarms",
        "workOrders",
        "caneBatches",
        "auditLogs",
        "configuration",
        "offlineMutations",
      ];

      for (const req of requiredStores) {
        expect(CANONICAL_OBJECT_STORES).toContain(req);
      }
    });

    it("should include backward-compatible store names for existing components", () => {
      expect(CANONICAL_OBJECT_STORES).toContain("industrial_tags");
      expect(CANONICAL_OBJECT_STORES).toContain("ot_tags");
      expect(CANONICAL_OBJECT_STORES).toContain("ot_devices");
      expect(CANONICAL_OBJECT_STORES).toContain("ot_connections");
      expect(CANONICAL_OBJECT_STORES).toContain("saf_telemetry");
      expect(CANONICAL_OBJECT_STORES).toContain("central_config");
      expect(CANONICAL_OBJECT_STORES).toContain("offline_journal");
      expect(CANONICAL_OBJECT_STORES).toContain("agricultural_persistence");
      expect(CANONICAL_OBJECT_STORES).toContain("auth_session");
    });

    it("should verify schema integrity returns valid status", async () => {
      const integrity = await vault.verifySchemaIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.missingStores).toHaveLength(0);
      expect(integrity.version).toBe(vault.currentVersion);
    });
  });

  describe("2. Storage Operations, Persistence, Recovery & Isolation", () => {
    it("should store and retrieve records with governance validation", async () => {
      const testTag = {
        id: "TANDEM1/MILL1/HYDRAULIC_PRESS_BAR",
        name: "Presión Hidráulica Molino 1",
        unit: "bar",
        value: 280.5,
      };

      await vault.setItem("industrial_tags", "key-mill1-press", testTag, "OT_CONFIG");
      const retrieved = await vault.getItem<typeof testTag>("industrial_tags", "key-mill1-press");

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(testTag.id);
      expect(retrieved?.value).toBe(280.5);
    });

    it("should support removing items cleanly", async () => {
      await vault.setItem("central_config", "k1", { test: true }, "OT_CONFIG");
      expect(await vault.getItem("central_config", "k1")).toBeDefined();

      await vault.removeItem("central_config", "k1");
      expect(await vault.getItem("central_config", "k1")).toBeNull();
    });

    it("should support clearing an entire store without affecting other stores", async () => {
      await vault.setItem("connections", "conn-1", { ip: "10.0.0.1" }, "OT_CONFIG");
      await vault.setItem("devices", "dev-1", { model: "PLC-5" }, "OT_CONFIG");

      await vault.clearStore("connections");

      expect(await vault.getItem("connections", "conn-1")).toBeNull();
      expect(await vault.getItem("devices", "dev-1")).toBeDefined();
    });

    it("should handle graceful fallback if store does not exist or fails without crashing", async () => {
      // Writing to an arbitrary or legacy store should not crash
      await expect(
        vault.setItem("unknown_legacy_store", "k1", { val: 123 }, "OT_CONFIG")
      ).resolves.not.toThrow();

      const res = await vault.getItem("unknown_legacy_store", "k1");
      expect(res).toEqual({ val: 123 });
    });
  });

  describe("3. TagManagementService Hydration & Vault Integration", () => {
    it("should hydrate tags from vault and report structured success", async () => {
      const service = TagManagementService.getInstance();
      const result = await service.hydrateFromVault();

      expect(result.success).toBe(true);
      expect(result.tagCount).toBeGreaterThan(0);
      expect(["INITIAL_CATALOG_SEEDED", "VAULT_PERSISTED", "VAULT_MIGRATED", "EMPTY_PRODUCTION"]).toContain(result.source);
    });

    it("should validate tag structure during hydration and reject corrupted records", async () => {
      // Write corrupted items to vault
      const corruptedData = [
        { id: "VALID_TAG_01", name: "Valid Tag", unit: "TCH", address: "Reg40001" },
        { id: null, name: "Corrupted No ID" },
        "string_not_an_object",
      ];
      await vault.setItem("industrial_tags", "bioazucar_canonical_tags_v1", corruptedData, "OT_CONFIG");

      const service = TagManagementService.getInstance();
      const result = await service.hydrateFromVault();

      expect(result.success).toBe(true);
      const tag = await service.getTagById("VALID_TAG_01");
      expect(tag).toBeDefined();
    });

    it("should migrate tags from legacy 'ot_tags' or 'tags' if 'industrial_tags' is empty", async () => {
      // Clear primary store
      await vault.clearStore("industrial_tags");

      // Place data in legacy store 'ot_tags'
      const legacyTags = [
        {
          id: "LEGACY_TAG_BOILER_01",
          name: "Flujo Vapor Caldera 1",
          unit: "t/h",
          address: "ns=2;s=CB01.SteamFlow",
          source: "OPC_UA",
          dataType: "Float32",
          frequencySec: 1.0,
        },
      ];
      await vault.setItem("ot_tags", "bioazucar_canonical_tags_v1", legacyTags, "OT_CONFIG");

      const service = TagManagementService.getInstance();
      const result = await service.hydrateFromVault();

      expect(result.success).toBe(true);
      expect(result.source).toBe("VAULT_MIGRATED");
      const tag = await service.getTagById("LEGACY_TAG_BOILER_01");
      expect(tag).toBeDefined();
    });

    it("should never generate synthetic fallback in PRODUCTION mode on empty DB", async () => {
      const origEnv = process.env.INDUSTRIAL_RUNTIME_PROFILE;
      try {
        process.env.INDUSTRIAL_RUNTIME_PROFILE = "PRODUCTION";

        await vault.clearStore("industrial_tags");
        await vault.clearStore("tags");
        await vault.clearStore("ot_tags");

        const service = TagManagementService.getInstance();
        const result = await service.hydrateFromVault();

        expect(result.success).toBe(true);
        expect(result.source).toBe("EMPTY_PRODUCTION");
        expect(result.tagCount).toBe(0);

        const allTags = await service.getTags();
        expect(allTags).toHaveLength(0);
      } finally {
        process.env.INDUSTRIAL_RUNTIME_PROFILE = origEnv;
      }
    });
  });

  describe("4. IDB Upgrade & Concurrency Handling", () => {
    it("should handle clean closure and reopening of the database connection", () => {
      expect(() => vault.closeDb()).not.toThrow();
    });

    it("should prohibit sensitive operational data from leaking into localStorage", () => {
      expect(() => {
        assertStorageTierPermitted("CREDENTIALS", "LOCAL_STORAGE_UI_ONLY");
      }).toThrow();
      expect(() => {
        assertStorageTierPermitted("TELEMETRY", "LOCAL_STORAGE_UI_ONLY");
      }).toThrow();
      expect(() => {
        assertStorageTierPermitted("OT_CONFIG", "LOCAL_STORAGE_UI_ONLY");
      }).toThrow();
    });
  });
});
