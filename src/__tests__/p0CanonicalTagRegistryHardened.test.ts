/**
 * BioAzúcar 4.0 — P0-02 Hardened Canonical Tag Registry Test Suite
 * 
 * Verifies strict 32-field industrial tag specification, versioning, tamper-evident hashing,
 * semantic classifications, and lossless conversion to CanonicalIndustrialDataPoint.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { IndustrialTagRegistryService } from "../services/tags/IndustrialTagRegistryService";
import { TagCreationInput } from "../types/canonicalTagRecord";
import { DiscoveredTag } from "../services/discovery/types";

describe("P0-02: Hardened Industrial Tag Registry & 32-Field Specification", () => {
  let registry: IndustrialTagRegistryService;

  beforeEach(() => {
    IndustrialTagRegistryService.resetInstance();
    registry = IndustrialTagRegistryService.getInstance();
  });

  it("should contain default seeded industrial tags with all 32 required fields", () => {
    const tchTag = registry.getTag("tag-milling-tch");
    expect(tchTag).toBeDefined();

    // Verify mandatory P0-02 fields
    expect(tchTag?.tagId).toBe("tag-milling-tch");
    expect(tchTag?.canonicalName).toContain("Flujo de Molienda TCH");
    expect(tchTag?.sourceId).toBe("src-opcua-central");
    expect(tchTag?.originalAddress).toBe("ns=2;s=Milling.Tandem.TCH_Actual");
    expect(tchTag?.protocol).toBe("OPC_UA");
    expect(tchTag?.driver).toBe("OpcUaDriver");
    expect(tchTag?.tenantId).toBe("ingenio-central");
    expect(tchTag?.siteId).toBe("planta-azucarera-01");
    expect(tchTag?.areaId).toBe("MOLIENDA");
    expect(tchTag?.processId).toBe("PROC_EXTRACCION_JUGO");
    expect(tchTag?.assetId).toBe("TANDEM_MOLINOS_01");
    expect(tchTag?.deviceId).toBe("PLC_MOLIENDA_01");
    expect(tchTag?.variable).toBe("TCH_Actual");
    expect(tchTag?.dataType).toBe("FLOAT");
    expect(tchTag?.engineeringUnit).toBe("TCH");
    expect(tchTag?.scale).toBe(1.0);
    expect(tchTag?.offset).toBe(0.0);
    expect(tchTag?.min).toBe(0);
    expect(tchTag?.max).toBe(600);
    expect(tchTag?.deadband).toBe(0.5);
    expect(tchTag?.scanRate).toBe(1000);
    expect(tchTag?.timestampSource).toBe("DEVICE");
    expect(tchTag?.qualityMapping.defaultQuality).toBe("GOOD");
    expect(tchTag?.alarmMapping.enabled).toBe(true);
    expect(tchTag?.alarmMapping.high).toBe(500);
    expect(tchTag?.criticality).toBe("SAFETY_CRITICAL");
    expect(tchTag?.semanticClass).toBe("PROCESS_VARIABLE");
    expect(tchTag?.safetyClassification).toBe("BPCS");
    expect(tchTag?.calibrationState).toBe("CALIBRATED");
    expect(tchTag?.owner).toBe("lead-instrumentation@ingenio.local");
    expect(tchTag?.approvalStatus).toBe("APPROVED");
    expect(tchTag?.version).toBe(1);
    expect(tchTag?.effectiveFrom).toBeDefined();
    expect(tchTag?.effectiveTo).toBeUndefined();
    expect(tchTag?.tagIntegrityHash).toBeDefined();
    expect(tchTag?.tagIntegrityHash).toHaveLength(64); // SHA-256 hex
  });

  it("should enforce validation and reject tag registration with missing mandatory fields", () => {
    const invalidInput: any = {
      tagId: "tag-incomplete",
      // missing canonicalName, sourceId, etc.
    };

    expect(() => registry.registerTag(invalidInput)).toThrow();
  });

  it("should support immutable tag updates, incrementing version and retaining historical audits", () => {
    const original = registry.getTag("tag-boiler1-steam-pressure");
    expect(original?.version).toBe(1);

    // Update max scale and alarm limit
    const updated = registry.updateTag(
      "tag-boiler1-steam-pressure",
      {
        max: 65.0,
        alarmMapping: { high: 50.0, enabled: true },
      },
      "chief-engineer@ingenio.local"
    );

    expect(updated.version).toBe(2);
    expect(updated.max).toBe(65.0);
    expect(updated.alarmMapping.high).toBe(50.0);
    expect(updated.owner).toBe("chief-engineer@ingenio.local");
    expect(updated.effectiveTo).toBeUndefined();

    // Check history
    const history = registry.getTagHistory("tag-boiler1-steam-pressure");
    expect(history.length).toBeGreaterThanOrEqual(1);
    const v1 = history[0];
    expect(v1.version).toBe(1);
    expect(v1.effectiveTo).toBeDefined();
  });

  it("should query tags with multi-dimensional filters", () => {
    const safetyTags = registry.findTags({ criticality: "SAFETY_CRITICAL" });
    expect(safetyTags.length).toBeGreaterThanOrEqual(2);

    const boilerTags = registry.findTags({ areaId: "CALDERAS" });
    expect(boilerTags).toHaveLength(1);
    expect(boilerTags[0].tagId).toBe("tag-boiler1-steam-pressure");

    const searchResults = registry.findTags({ searchQuery: "Báscula" });
    expect(searchResults).toHaveLength(1);
    expect(searchResults[0].tagId).toBe("tag-weighbridge-gross-weight");
  });

  it("should seamlessly convert tag definitions into valid 17-field CanonicalIndustrialDataPoint", () => {
    // Normal value
    const point = registry.createDataPointFromTag("tag-milling-tch", 420.5);

    expect(point.runtimeMode).toBe("PRODUCTION");
    expect(point.sourceId).toBe("src-opcua-central");
    expect(point.driverId).toBe("OpcUaDriver");
    expect(point.protocol).toBe("OPC_UA");
    expect(point.tagId).toBe("tag-milling-tch");
    expect(point.assetId).toBe("TANDEM_MOLINOS_01");
    expect(point.value).toBe(420.5);
    expect(point.engineeringUnit).toBe("TCH");
    expect(point.quality).toBe("GOOD");
    expect(point.schemaVersion).toBe("1.0.0");

    // Out of range value detection
    const badPoint = registry.createDataPointFromTag("tag-milling-tch", 850.0); // max is 600
    expect(badPoint.quality).toBe("OUT_OF_RANGE");
    expect(badPoint.qualityReason).toContain("fuera del rango");
  });

  it("should import and bridge discovered tags from P0-01 Discovery Engine into canonical records", () => {
    const discovered: DiscoveredTag[] = [
      {
        id: "disc-01",
        sourceId: "src-opc-auto",
        deviceId: "dev-evap-train",
        canonicalName: "Nivel Meladura Tacho 3",
        originalAddress: "ns=2;s=Evap.Level_Effect_3",
        protocol: "OPC_UA",
        variable: "Level_Effect_3",
        dataType: "FLOAT",
        engineeringUnit: "%",
        min: 0,
        max: 100,
        approvalStatus: "MAPPED",
        discoveredAt: new Date().toISOString(),
      },
    ];

    const imported = registry.importFromDiscoveredTags(discovered, {
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
      areaId: "EVAPORACION",
      processId: "PROC_CONCENTRACION_JUGO",
      assetId: "EVAPORADOR_EFECTO_3",
      owner: "ingeniero-proceso@ingenio.local",
    });

    expect(imported).toHaveLength(1);
    const tag = imported[0];
    expect(tag.tagId).toBe("tag-level-effect-3");
    expect(tag.canonicalName).toBe("Nivel Meladura Tacho 3");
    expect(tag.areaId).toBe("EVAPORACION");
    expect(tag.version).toBe(1);

    // Verify it is registered and queryable
    const found = registry.getTag("tag-level-effect-3");
    expect(found).toBeDefined();
    expect(found?.protocol).toBe("OPC_UA");
  });
});
