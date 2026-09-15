/**
 * BioAzúcar 4.0 — PDA Parameter Governance & Audit Trail Unit Tests
 * Test Suite: AgriculturalPersistenceService & Parameter Governance
 * 
 * Validates:
 * 1. Parameter modification captures true previousValue and newValue in immutable audit trail.
 * 2. Mandatory change reason and actor identification are preserved in audit trail.
 * 3. Range and domain validation rules for agronomic parameters.
 * 4. Canonical reset audit trail logging.
 * 5. Sequential audit integrity across multiple parameter revisions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgriculturalPersistenceService } from "../AgriculturalPersistenceService";
import { AgriculturalParameterRegistry } from "../AgriculturalParameterRegistry";
import { AgriculturalParameter } from "../../../types/agriculture";
import { validateParamValue } from "../agriculturalValidation";

describe("BioAzúcar 4.0 — PDA Parameter Governance & Audit Trail", () => {
  const TEST_TENANT = "TENANT_TEST_PDA_GOV";

  beforeEach(async () => {
    await AgriculturalPersistenceService.resetParametersToCanonical(TEST_TENANT);
  });

  it("1. Parameter Audit Capture: records exact previousValue, newValue, actor, and reason", async () => {
    const existing = AgriculturalParameterRegistry.getParameter("MIN_ECONOMIC_TCH_THRESHOLD");
    expect(existing).toBeDefined();
    const initialVal = existing!.value;

    const modifiedParam: AgriculturalParameter = {
      ...existing!,
      value: 58.5,
      tenantId: TEST_TENANT,
    };

    const actor = "Ing. Carlos Mendoza (Jefe de Agronomía)";
    const reason = "Ajuste de umbral por aumento en costos de corte mecanizado";

    await AgriculturalPersistenceService.saveParameter(modifiedParam, actor, reason);

    const history = AgriculturalPersistenceService.getAuditHistory(TEST_TENANT);
    const paramAudits = history.filter((rec) => rec.entityType === "PARAMETER" && rec.entityId === modifiedParam.id);

    expect(paramAudits.length).toBeGreaterThanOrEqual(1);
    const latest = paramAudits[0];

    expect(latest.entityName).toBe(modifiedParam.name);
    expect(latest.user).toBe(actor);
    expect(latest.reason).toBe(reason);
    expect(latest.previousValue).toBeDefined();
    expect(latest.previousValue.value).toBe(initialVal);
    expect(latest.newValue.value).toBe(58.5);
  });

  it("2. Sequential Parameter Audits: maintains continuous previousValue -> newValue chain", async () => {
    const existing = AgriculturalParameterRegistry.getParameter("HARVESTER_EFFECTIVE_CAPACITY_TCH");
    expect(existing).toBeDefined();
    const initialVal = existing!.value;

    // First adjustment: e.g. 52 -> 56 t/h
    const step1: AgriculturalParameter = {
      ...existing!,
      value: 56.0,
      tenantId: TEST_TENANT,
    };
    await AgriculturalPersistenceService.saveParameter(step1, "Operador Cosecha", "Calibración con cosechadoras nuevas John Deere");

    // Second adjustment: 56 -> 60 t/h
    const step2: AgriculturalParameter = {
      ...step1,
      value: 60.0,
    };
    await AgriculturalPersistenceService.saveParameter(step2, "Superintendente CCT", "Optimización de velocidad de avance en lote plano");

    const history = AgriculturalPersistenceService.getAuditHistory(TEST_TENANT);
    const audits = history.filter((rec) => rec.entityType === "PARAMETER" && rec.entityId === existing!.id);

    expect(audits.length).toBeGreaterThanOrEqual(2);
    // Most recent is index 0
    expect(audits[0].previousValue.value).toBe(56.0);
    expect(audits[0].newValue.value).toBe(60.0);
    expect(audits[1].previousValue.value).toBe(initialVal);
    expect(audits[1].newValue.value).toBe(56.0);
  });

  it("3. Parameter Value Validation: correctly rejects out-of-bound and negative inputs", () => {
    const dummyCostParam: AgriculturalParameter = {
      id: "TEST_COST",
      tenantId: TEST_TENANT,
      key: "TEST_COST",
      name: "Costo Unitario Test",
      category: "ECONOMIA",
      value: 100,
      unit: "USD/ha",
      type: "currency",
      version: "1.0.0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      validationStatus: "CONFIGURABLE",
    };

    expect(validateParamValue(dummyCostParam, -10)).toContain("no pueden ser negativos");
    expect(validateParamValue(dummyCostParam, 50)).toBeNull();

    const dummyPercentParam: AgriculturalParameter = {
      id: "TEST_PCT",
      tenantId: TEST_TENANT,
      key: "TEST_PCT",
      name: "Porcentaje Pérdidas",
      category: "CCT_LOGISTICA",
      value: 5,
      unit: "%",
      type: "rate",
      version: "1.0.0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      validationStatus: "CONFIGURABLE",
    };

    expect(validateParamValue(dummyPercentParam, -1)).toContain("no puede ser negativo");
    expect(validateParamValue(dummyPercentParam, 120)).toContain("debe estar entre 0% y 100%");
    expect(validateParamValue(dummyPercentParam, 8.5)).toBeNull();

    const dummyFactorParam: AgriculturalParameter = {
      id: "TEST_FACTOR",
      tenantId: TEST_TENANT,
      key: "TEST_FACTOR",
      name: "Factor de Rendimiento",
      category: "VARIEDAD",
      value: 1.0,
      unit: "factor",
      type: "factor",
      version: "1.0.0",
      effectiveFrom: "2026-01-01T00:00:00.000Z",
      validationStatus: "CONFIRMADO",
    };

    expect(validateParamValue(dummyFactorParam, 0.01)).toContain("entre 0.05 y 10.0");
    expect(validateParamValue(dummyFactorParam, 15)).toContain("entre 0.05 y 10.0");
    expect(validateParamValue(dummyFactorParam, 1.15)).toBeNull();
  });

  it("4. Canonical Reset Audit: logs formal reset event in audit trail", async () => {
    await AgriculturalPersistenceService.resetParametersToCanonical(TEST_TENANT);
    const history = AgriculturalPersistenceService.getAuditHistory(TEST_TENANT);
    const resetEvents = history.filter(
      (rec) => rec.entityType === "PARAMETER" && rec.reason.includes("Restablecimiento")
    );

    expect(resetEvents.length).toBeGreaterThanOrEqual(1);
    expect(resetEvents[0].user).toContain("ADMIN");
  });
});
