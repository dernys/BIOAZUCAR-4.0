/**
 * BioAzúcar 4.0 — Iteration I33: Commissioning Coverage Engine Test Suite
 * =======================================================================
 * Spec Reference: developer_roadmap.md (Section 1.1 & 1.2) & Section 14
 * 
 * Verifies:
 * - 10 maturation stages coverage per tenant and area.
 * - Evidence rule: No false promotion to E6/E7 without real physical plant hardware.
 * - Cryptographic SHA-256 seal generation and tamper detection.
 * - Mathematical integrity of percentages and counts.
 * - Hierarchy navigation: TENANT -> SITE -> AREA -> PROCESS -> EQUIPMENT -> DEVICE -> TAG.
 * - Equipment breakdown & metrics (Configured, Mapped, Flowing, Good, Stale, Bad).
 * - Stale Data Policy: age > 2 * expectedInterval + jitter -> STALE.
 * - Data Lineage: 8 distinct stages from SOURCE to DASHBOARD.
 * - Multi-tenant isolation: strict tenantId boundaries.
 * - Production Fail-Closed verification.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CommissioningCoverageEngine,
  TenantCoverageReport,
} from "../services/edge/verification/CommissioningCoverageEngine";
import { IndustrialTagRegistryService } from "../services/tags/IndustrialTagRegistryService";

describe("[I33 / Phase 14] Industrial Commissioning Coverage Engine", () => {
  let engine: CommissioningCoverageEngine;
  let registry: IndustrialTagRegistryService;

  beforeEach(() => {
    IndustrialTagRegistryService.resetInstance();
    CommissioningCoverageEngine.resetInstance();
    registry = IndustrialTagRegistryService.getInstance();
    engine = CommissioningCoverageEngine.getInstance();
  });

  it("1. Debe inicializar el motor con las 10 etapas canónicas de comisionamiento", () => {
    expect(CommissioningCoverageEngine.STAGES).toHaveLength(10);
    expect(CommissioningCoverageEngine.STAGES).toEqual([
      "DISCOVERED",
      "CONFIGURED",
      "MAPPED",
      "CONNECTED",
      "SUBSCRIBED_OR_POLLING",
      "DATA_FLOWING",
      "DATA_VALIDATED",
      "COMMISSIONED",
      "FIELD_VALIDATED",
      "PRODUCTION_READY",
    ]);
  });

  it("2. Debe mapear cada etapa a su nivel de evidencia estricto E0-E7", () => {
    expect(CommissioningCoverageEngine.STAGE_EVIDENCE_MAP.DISCOVERED).toBe("E2");
    expect(CommissioningCoverageEngine.STAGE_EVIDENCE_MAP.MAPPED).toBe("E3");
    expect(CommissioningCoverageEngine.STAGE_EVIDENCE_MAP.COMMISSIONED).toBe("E5");
    expect(CommissioningCoverageEngine.STAGE_EVIDENCE_MAP.FIELD_VALIDATED).toBe("E6");
    expect(CommissioningCoverageEngine.STAGE_EVIDENCE_MAP.PRODUCTION_READY).toBe("E7");
  });

  it("3. Debe generar reporte de área MOLIENDA con cálculo exacto de etapas", () => {
    const report = engine.generateAreaReport("ingenio-central", "MOLIENDA");
    expect(report.areaId).toBe("MOLIENDA");
    expect(report.tenantId).toBe("ingenio-central");
    expect(report.totalTags).toBeGreaterThan(0);

    // Stages check
    expect(report.stages.DISCOVERED.count).toBe(report.totalTags);
    expect(report.stages.CONFIGURED.count).toBe(report.totalTags);
    expect(report.stages.MAPPED.count).toBe(report.totalTags);
    expect(report.stages.CONNECTED.count).toBe(report.totalTags);
    expect(report.stages.COMMISSIONED.count).toBe(report.totalTags); // Covered by FAT/SAT Tandem

    // Evidence Rule check: FIELD_VALIDATED & PRODUCTION_READY must NOT be claimed without physical plant
    expect(report.stages.FIELD_VALIDATED.count).toBe(0);
    expect(report.stages.PRODUCTION_READY.count).toBe(0);
    expect(report.missingCriteria.length).toBeGreaterThan(0);
  });

  it("4. Debe generar reporte integral de tenant con agregación de áreas y sello SHA-256", () => {
    const tenantReport = engine.generateTenantReport("ingenio-central");
    expect(tenantReport.tenantId).toBe("ingenio-central");
    expect(tenantReport.totalTags).toBeGreaterThan(0);
    expect(tenantReport.areas).toBeDefined();
    expect(tenantReport.areas.MOLIENDA).toBeDefined();

    // Verify percentages are mathematical numbers between 0 and 100
    for (const stage of CommissioningCoverageEngine.STAGES) {
      const pct = tenantReport.globalStagePercentages[stage];
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }

    // Master seal verification
    expect(tenantReport.reportHashSha256).toHaveLength(64);
    expect(engine.verifyCoverageSeal(tenantReport)).toBe(true);
  });

  it("5. Debe detectar manipulación fraudulenta en el reporte de cobertura (Tamper Detection)", () => {
    const tenantReport = engine.generateTenantReport("ingenio-central");
    expect(engine.verifyCoverageSeal(tenantReport)).toBe(true);

    // Tamper with data
    const forgedReport: TenantCoverageReport = {
      ...tenantReport,
      globalStageCounts: {
        ...tenantReport.globalStageCounts,
        PRODUCTION_READY: 999, // Fraudulent claim
      },
    };

    expect(engine.verifyCoverageSeal(forgedReport)).toBe(false);
  });

  it("6. Debe generar resumen global del sistema con matriz de evidencia E0-E7 honesta", () => {
    const globalSummary = engine.generateGlobalReport();
    expect(globalSummary.totalTenants).toBeGreaterThanOrEqual(1);
    expect(globalSummary.totalTags).toBeGreaterThan(0);
    expect(globalSummary.masterCoverageSealSha256).toHaveLength(64);

    // Strict evidence check: E4, E6 and E7 must be 0 in sandbox without external physical hardware
    expect(globalSummary.evidenceMatrix.e4_peerInterop).toBe(0);
    expect(globalSummary.evidenceMatrix.e6_fieldValidated).toBe(0);
    expect(globalSummary.evidenceMatrix.e7_productionReady).toBe(0);

    // E3 and E5 must reflect software and HIL verification
    expect(globalSummary.evidenceMatrix.e3_testedSoftware).toBeGreaterThan(0);
    expect(globalSummary.evidenceMatrix.e5_hilValidated).toBeGreaterThan(0);
  });

  it("7. Debe proveer jerarquía navegable ISA-95 (TENANT -> SITE -> AREA -> PROCESS -> EQUIPMENT)", () => {
    const tree = engine.getHierarchy("ingenio-central");
    expect(tree.id).toBe("ingenio-central");
    expect(tree.type).toBe("TENANT");
    expect(tree.children).toBeDefined();
    expect(tree.children?.length).toBeGreaterThan(0);

    const site = tree.children![0];
    expect(site.type).toBe("SITE");
    expect(site.children?.some((a) => a.id === "MOLIENDA")).toBe(true);
  });

  it("8. Debe calcular cobertura por equipo con contadores exactos de calidad", () => {
    const eqList = engine.getEquipmentsForArea("ingenio-central", "MOLIENDA");
    expect(eqList.length).toBeGreaterThan(0);

    const tandem = eqList.find((e) => e.equipmentId === "TANDEM_MOLINOS_01");
    expect(tandem).toBeDefined();
    expect(tandem?.totalTags).toBeGreaterThan(0);
    expect(tandem?.configuredTags).toBe(tandem?.totalTags);
    expect(tandem?.mappedTags).toBe(tandem?.totalTags);
    expect(tandem?.goodCount).toBeGreaterThanOrEqual(0);
    expect(tandem?.commissioningReadiness).toBe("HIL_VALIDATED");
  });

  it("9. Debe recuperar detalle de tag con linaje ininterrumpido de 8 eslabones", () => {
    const detail = engine.getTagDetail("ingenio-central", "tag-milling-tch");
    expect(detail).toBeDefined();
    expect(detail?.tagId).toBe("tag-milling-tch");
    expect(detail?.canonicalName).toContain("Flujo de Molienda TCH");
    expect(detail?.protocol).toBe("OPC_UA");
    expect(detail?.engineeringUnit).toBe("TCH");
    expect(detail?.scale).toBe(1.0);
    expect(detail?.offset).toBe(0.0);

    // Lineage check
    expect(detail?.lineage).toHaveLength(8);
    expect(detail?.lineage.map((l) => l.stage)).toEqual([
      "SOURCE",
      "DRIVER",
      "CANONICAL_DATA_POINT",
      "QUALITY_GATE",
      "TAG_REGISTRY",
      "HISTORIAN",
      "SEMANTIC_MODEL",
      "DASHBOARD",
    ]);
  });

  it("10. Debe aplicar política determinista de STALE DATA ante envejecimiento de telemetría", () => {
    const tag = registry.getTag("tag-milling-tch")!;
    expect(tag).toBeDefined();

    // 1. Fresh telemetry (< 2 * scanRate + jitter)
    const freshTime = new Date().toISOString();
    const freshRes = engine.evaluateTagFreshness(tag, {
      tagId: tag.tagId,
      rawValue: 450,
      engineeringValue: 450,
      quality: "GOOD",
      timestamp: freshTime,
      sequence: 1,
      sourceEndpoint: "opc.tcp://192.168.10.101:4840",
      protocol: "OPC_UA",
      provenance: "SIMULATED",
      runtimeProfile: "SIMULATION",
    });
    expect(freshRes.isStale).toBe(false);
    expect(freshRes.quality).toBe("GOOD");

    // 2. Stale telemetry (sample timestamp from 10 seconds ago with 1000ms scanRate)
    const staleTime = new Date(Date.now() - 10000).toISOString();
    const staleRes = engine.evaluateTagFreshness(tag, {
      tagId: tag.tagId,
      rawValue: 450,
      engineeringValue: 450,
      quality: "GOOD",
      timestamp: staleTime,
      sequence: 1,
      sourceEndpoint: "opc.tcp://192.168.10.101:4840",
      protocol: "OPC_UA",
      provenance: "SIMULATED",
      runtimeProfile: "SIMULATION",
    });
    expect(staleRes.isStale).toBe(true);
    expect(staleRes.quality).toBe("STALE");
    expect(staleRes.status).toBe("STALE");
  });

  it("11. Debe ingerir puntos de telemetría en vivo y actualizar métricas de flujo", () => {
    const now = new Date().toISOString();
    engine.ingestDataPoint({
      tagId: "tag-boiler1-steam-pressure",
      rawValue: 45.2,
      engineeringValue: 45.2,
      quality: "GOOD",
      timestamp: now,
      sequence: 9999,
      sourceEndpoint: "opc.tcp://192.168.10.102:4840",
      protocol: "OPC_UA",
      provenance: "SIMULATED",
      runtimeProfile: "SIMULATION",
    });

    const detail = engine.getTagDetail("ingenio-central", "tag-boiler1-steam-pressure");
    expect(detail?.sequence).toBe(9999);
    expect(detail?.currentValue).toBe(45.2);
    expect(detail?.quality).toBe("GOOD");
  });

  it("12. Debe hacer cumplir aislamiento estricto de multitenancy", () => {
    // Querying tag under wrong tenant must return null
    const wrongTenantTag = engine.getTagDetail("TENANT_FOREIGN_XYZ", "tag-milling-tch");
    expect(wrongTenantTag).toBeNull();

    // Querying equipment under wrong tenant must return empty list
    const wrongTenantEquipments = engine.getEquipmentsForArea("TENANT_FOREIGN_XYZ", "MOLIENDA");
    expect(wrongTenantEquipments).toHaveLength(0);
  });

  it("13. Debe retornar área no configurada sin inyectar datos sintéticos ficticios", () => {
    const emptyAreaEquipments = engine.getEquipmentsForArea("ingenio-central", "DESTILERIA_VACIA");
    expect(emptyAreaEquipments).toHaveLength(0);

    const emptyAreaReport = engine.generateAreaReport("ingenio-central", "DESTILERIA_VACIA");
    expect(emptyAreaReport.totalTags).toBe(0);
    expect(emptyAreaReport.areaReadiness).toBe("NOT_COMMISSIONED");
  });

  it("14. Debe rechazar telemetría simulada en perfil PRODUCTION (Fail-Closed)", () => {
    expect(() => {
      engine.ingestDataPoint({
        tagId: "tag-milling-tch",
        rawValue: 480.0,
        engineeringValue: 480.0,
        quality: "GOOD",
        timestamp: new Date().toISOString(),
        sequence: 1,
        sourceEndpoint: "opc.tcp://192.168.10.101:4840",
        protocol: "OPC_UA",
        provenance: "SIMULATED",
        runtimeProfile: "PRODUCTION", // Illegal in PRODUCTION
      });
    }).toThrow(/FAIL-CLOSED/);
  });
});
