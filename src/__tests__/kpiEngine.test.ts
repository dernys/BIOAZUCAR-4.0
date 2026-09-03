import { describe, it, expect } from "vitest";
import { kpiEngine, CANONICAL_KPI_DEFINITIONS } from "../services/kpiEngine";
import { IndustrialDataPoint, TelemetryData } from "../types";

describe("KPI Engine & Data Lineage Traceability (ISO 22400-2 / IEC 62443)", () => {
  it("Canonical KPI definitions are registered with explicit formulas and input tags", () => {
    const kpis = kpiEngine.getKpiDefinitions();
    expect(kpis.length).toBeGreaterThanOrEqual(6);

    const tchKpi = kpis.find((k) => k.id === "kpi-tch");
    expect(tchKpi).toBeDefined();
    expect(tchKpi?.category).toBe("MOLIENDA");
    expect(tchKpi?.unit).toBe("TCH");
    expect(tchKpi?.inputTags).toContain("Milling.TCH_Actual");

    const extractionKpi = kpis.find((k) => k.id === "kpi-extraction");
    expect(extractionKpi).toBeDefined();
    expect(extractionKpi?.formula).toContain("Pol_Caña");

    const oeeKpi = kpis.find((k) => k.id === "kpi-oee-overall");
    expect(oeeKpi).toBeDefined();
    expect(oeeKpi?.formula).toContain("Availability");
  });

  it("Data Lineage calculates provenance and tag dependencies correctly", () => {
    const mockMap = new Map<string, IndustrialDataPoint>();
    const now = new Date().toISOString();

    mockMap.set("Milling.TCH_Actual", {
      id: "dp-1",
      tag: "Milling.TCH_Actual",
      equipmentId: "eq-molino-1",
      areaId: "MOLIENDA",
      value: 465.5,
      unit: "TCH",
      dataType: "FLOAT",
      source: "SIMULATION",
      protocol: "SIMULATOR",
      quality: "GOOD",
      deviceTimestamp: now,
      ingestionTimestamp: now,
      sequence: 1,
      isHistorical: false,
      isSimulated: true,
      description: "Flujo de Molienda TCH",
    });

    const lineage = kpiEngine.calculateDataLineage("kpi-tch", mockMap);

    expect(lineage.kpiName).toBe("Molienda Horaria (TCH)");
    expect(lineage.kpiValue).toBe(465.5);
    expect(lineage.unit).toBe("TCH");
    expect(lineage.overallQuality).toBe("GOOD");
    expect(lineage.overallSource).toBe("SIMULATION");
    expect(lineage.inputTags.length).toBe(1);
    expect(lineage.inputTags[0].equipmentId).toBe("eq-molino-1");
    expect(lineage.inputTags[0].value).toBe(465.5);
  });

  it("Data Lineage propagates UNCERTAIN / BAD quality flags when sensors report anomalies", () => {
    const mockMap = new Map<string, IndustrialDataPoint>();
    const now = new Date().toISOString();

    mockMap.set("Milling.TCH_Actual", {
      id: "dp-1",
      tag: "Milling.TCH_Actual",
      equipmentId: "eq-molino-1",
      areaId: "MOLIENDA",
      value: 0,
      unit: "TCH",
      dataType: "FLOAT",
      source: "SIMULATION",
      protocol: "SIMULATOR",
      quality: "BAD",
      deviceTimestamp: now,
      ingestionTimestamp: now,
      sequence: 1,
      isHistorical: false,
      isSimulated: true,
      description: "Sensor desconectado",
    });

    const lineage = kpiEngine.calculateDataLineage("kpi-tch", mockMap);
    expect(lineage.overallQuality).toBe("BAD");
  });
});
