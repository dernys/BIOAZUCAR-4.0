/**
 * BioAzúcar 4.0 — Agricultural Data Truth & Governance Audit Unit Tests
 * 
 * Tests strict classification, canonical parameter validation,
 * duplication detection between registry and mocks, entity truth enforcement,
 * multi-tenant isolation, and agronomic bounds checking.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgriculturalDataTruthService } from "../AgriculturalDataTruthService";
import {
  AgriculturalParameterRegistry,
  CANONICAL_AGRICULTURAL_PARAMETERS,
} from "../AgriculturalParameterRegistry";
import { AgriculturalParameter, FieldPlot } from "../../../types/agriculture";

describe("AgriculturalDataTruthService", () => {
  beforeEach(() => {
    AgriculturalParameterRegistry.resetToCanonical();
  });

  describe("Audit Data Truth Execution", () => {
    it("debe auditar los parámetros canónicos y calcular métricas de gobernanza sin duplicados", () => {
      const summary = AgriculturalDataTruthService.auditDataTruth();

      expect(summary.totalParametersAudited).toBeGreaterThanOrEqual(40);
      expect(summary.hasDuplicates).toBe(false);
      expect(summary.duplicateKeys).toEqual([]);
      expect(summary.sovereignPercentage).toBeGreaterThan(0);
      expect(summary.items.length).toBe(summary.totalParametersAudited);

      // Verify that no item has ODS runtime dependency
      const withOds = summary.items.filter((i) => i.hasOdsDependency);
      expect(withOds.length).toBe(0);

      // Verify sovereign parameters
      expect(summary.items.some((i) => i.isSovereignBioAzucar)).toBe(true);
    });

    it("debe detectar y reportar parámetros duplicados en colecciones", () => {
      const customParams: AgriculturalParameter[] = [
        ...CANONICAL_AGRICULTURAL_PARAMETERS.slice(0, 5),
        {
          ...CANONICAL_AGRICULTURAL_PARAMETERS[0],
          id: "custom-dup-1",
          name: "Duplicado de prueba",
        },
      ];

      const summary = AgriculturalDataTruthService.auditDataTruth(customParams);
      expect(summary.hasDuplicates).toBe(true);
      expect(summary.duplicateKeys).toContain(CANONICAL_AGRICULTURAL_PARAMETERS[0].key);
    });
  });

  describe("Entity Truth & OT Promotion Guard", () => {
    it("debe rechazar promoción de datos SIMULATED a LIVE OT sin validación física", () => {
      const result = AgriculturalDataTruthService.auditEntityTruth({
        entityId: "TAG_MOLINO_01",
        classification: "SIMULATED",
      });

      expect(result.isLegitimateLiveOt).toBe(false);
      expect(result.requiresPhysicalVerification).toBe(true);
      expect(result.reason).toContain("SIMULATED no pueden ser promocionados a LIVE_OT/REAL");
    });

    it("debe rechazar promoción de BENCHMARK o ASSUMPTION a LIVE OT", () => {
      const result = AgriculturalDataTruthService.auditEntityTruth({
        entityId: "PARAM_COSTO_CORTE",
        classification: "BENCHMARK",
      });

      expect(result.isLegitimateLiveOt).toBe(false);
      expect(result.requiresPhysicalVerification).toBe(true);
      expect(result.reason).toContain("Valores asumidos o de referencia externa");
    });

    it("debe autorizar datos REAL como legítimos para control operacional", () => {
      const result = AgriculturalDataTruthService.auditEntityTruth({
        entityId: "BASCULA_TARA_01",
        classification: "REAL",
      });

      expect(result.isLegitimateLiveOt).toBe(true);
      expect(result.requiresPhysicalVerification).toBe(false);
    });
  });

  describe("Detection of Registry & Mock Duplications / Collisions", () => {
    it("debe validar integridad de colección de parámetros y detectar claves duplicadas", () => {
      const validParams: AgriculturalParameter[] = [
        {
          id: "p1",
          tenantId: "T1",
          category: "VARIEDAD",
          name: "Param 1",
          key: "KEY_P1",
          value: 10,
          unit: "t/ha",
          type: "numeric",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          status: "PDA_VALIDATED",
        },
        {
          id: "p2",
          tenantId: "T1",
          category: "VARIEDAD",
          name: "Param 2",
          key: "KEY_P2",
          value: 20,
          unit: "t/ha",
          type: "numeric",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          status: "PDA_VALIDATED",
        },
      ];

      const validCheck = AgriculturalDataTruthService.validateParameterCollectionIntegrity(validParams);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.hasDuplicates).toBe(false);

      const invalidParams: AgriculturalParameter[] = [
        ...validParams,
        {
          id: "p3",
          tenantId: "T1",
          category: "VARIEDAD",
          name: "Param 1 duplicado",
          key: "KEY_P1", // duplicate key!
          value: 99,
          unit: "t/ha",
          type: "numeric",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          status: "PDA_VALIDATED",
        },
      ];

      const invalidCheck = AgriculturalDataTruthService.validateParameterCollectionIntegrity(invalidParams);
      expect(invalidCheck.isValid).toBe(false);
      expect(invalidCheck.hasDuplicates).toBe(true);
      expect(invalidCheck.duplicateKeys).toContain("KEY_P1");
    });

    it("debe detectar colisiones cuando un mock intenta suplantar parámetros canónicos", () => {
      const candidateMockParams: AgriculturalParameter[] = [
        {
          id: "mock-var-rb86-7515",
          tenantId: "MOCK_TENANT",
          category: "VARIEDAD",
          name: "Mock RB86",
          key: "VARIETY_MASTER_RB86_7515",
          value: { baseYieldTch: 50 }, // lower mock value
          unit: "object",
          type: "object",
          version: "1.0.0",
          effectiveFrom: "2026-01-01",
          dataClassification: "SIMULATED",
          status: "CONFIGURABLE",
          dataOrigin: "SIMULATED",
        },
      ];

      const check = AgriculturalDataTruthService.detectRegistryMockDuplications(candidateMockParams);
      expect(check.hasDuplicates).toBe(true);
      expect(check.duplicateKeys).toContain("VARIETY_MASTER_RB86_7515");
      expect(check.mockCollisions.length).toBe(1);
      expect(check.isValid).toBe(false);
      expect(check.mockCollisions[0].reason).toContain("Conflicto Data Truth");
    });

    it("debe detectar duplicados en colecciones genéricas de entidades (maquinaria, insumos)", () => {
      const duplicateEquipment = [
        { id: "EQ-01", code: "TR-01" },
        { id: "EQ-02", code: "TR-02" },
        { id: "EQ-03", code: "TR-01" }, // duplicate code
      ];

      const check = AgriculturalDataTruthService.validateEntityCollectionIntegrity(duplicateEquipment, "Maquinaria");
      expect(check.hasDuplicates).toBe(true);
      expect(check.duplicateCodes).toContain("TR-01");
      expect(check.isValid).toBe(false);
      expect(check.errorMessage).toBeDefined();
    });
  });

  describe("Plot Collection Integrity & Agronomic Bounds", () => {
    it("debe detectar duplicados en colección de lotes", () => {
      const plots: FieldPlot[] = [
        { id: "LOT-01", uebName: "UEB Norte", code: "L01", areaHectares: 100, projectedTch: 85 } as any,
        { id: "LOT-02", uebName: "UEB Norte", code: "L02", areaHectares: 120, projectedTch: 90 } as any,
        { id: "LOT-01", uebName: "UEB Sur", code: "L03", areaHectares: 80, projectedTch: 75 } as any,
      ];

      const result = AgriculturalDataTruthService.validatePlotCollectionIntegrity(plots);
      expect(result.hasDuplicates).toBe(true);
      expect(result.duplicateIds).toContain("LOT-01");
      expect(result.isValid).toBe(false);
    });

    it("debe validar límites agronómicos fisiológicos del lote", () => {
      const normalPlot = { projectedTch: 95.0, areaHectares: 120.0 };
      expect(AgriculturalDataTruthService.validatePlotAgronomicBounds(normalPlot).isAnomaly).toBe(false);

      const excessiveTchPlot = { projectedTch: 320.0, areaHectares: 50.0 };
      const excessiveResult = AgriculturalDataTruthService.validatePlotAgronomicBounds(excessiveTchPlot);
      expect(excessiveResult.isAnomaly).toBe(true);
      expect(excessiveResult.reason).toContain("TCH fuera de rango biológico");

      const negativeAreaPlot = { projectedTch: 90.0, areaHectares: -10.0 };
      const negativeResult = AgriculturalDataTruthService.validatePlotAgronomicBounds(negativeAreaPlot);
      expect(negativeResult.isAnomaly).toBe(true);
      expect(negativeResult.reason).toContain("Superficie de lote inválida");
    });

    it("debe validar aislamiento multi-tenant estricto", () => {
      const sameTenant = AgriculturalDataTruthService.verifyTenantBoundary("TENANT_01", "TENANT_01");
      expect(sameTenant.authorized).toBe(true);

      const crossTenant = AgriculturalDataTruthService.verifyTenantBoundary("TENANT_01", "TENANT_02");
      expect(crossTenant.authorized).toBe(false);
      expect(crossTenant.violationType).toBe("CROSS_TENANT_ACCESS_DENIED");

      const missingTenant = AgriculturalDataTruthService.verifyTenantBoundary("TENANT_01", undefined);
      expect(missingTenant.authorized).toBe(false);
      expect(missingTenant.violationType).toBe("MISSING_TENANT_ID");
    });
  });
});
