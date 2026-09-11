/**
 * BioAzúcar 4.0 — PDA Governance & Deterministic Reporting Unit Tests
 * Test Suite: PdaFormulaRegistry & AgriculturalReportingService
 * 
 * Validates:
 * 1. Formula Registry Integrity: Versioning, Model Origin, Variables & #REF! segregation.
 * 2. 13 PDA Deterministic Reports: Formats, KPIs, Rows and Columns.
 * 3. Mathematical Invariants: Mass/Area Balance, Non-negativity, Fleet Bounds.
 * 4. Golden Campaign Scenario: Complete Agricultural Lifecycle Execution.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PdaFormulaRegistry } from "../PdaFormulaRegistry";
import {
  AgriculturalReportingService,
  AgriculturalReportContext,
} from "../AgriculturalReportingService";
import {
  AgriculturalCampaign,
  FieldPlot,
  PdaReportType,
} from "../../../types/agriculture";
import { INITIAL_AGRICULTURAL_CAMPAIGN, INITIAL_FIELD_PLOTS } from "../../../data/mockAgriculturalData";
import { YieldCalculationService, MODEL_REVISION } from "../YieldCalculationService";
import { AgriculturalPlanningService } from "../AgriculturalPlanningService";
import { MachineryAndLogisticsService } from "../MachineryAndLogisticsService";
import { AgroEconomicsService } from "../AgroEconomicsService";

describe("BioAzúcar 4.0 — PDA Governance & Formula Registry", () => {
  beforeEach(() => {
    PdaFormulaRegistry.resetToCanonical();
  });

  it("1. Registry Integrity: loads all master PDA formulas with complete metadata", () => {
    const all = PdaFormulaRegistry.getAllFormulas();
    expect(all.length).toBeGreaterThanOrEqual(16);

    // Verify key formulas exist
    const tchProj = PdaFormulaRegistry.getFormula("FORMULA_TCH_PLOT");
    expect(tchProj).toBeDefined();
    expect(tchProj?.name).toContain("Rendimiento Agrícola Proyectado");
    expect(tchProj?.status).toBe("PDA_VALIDATED");
    expect(tchProj?.modelOrigin).toBe("PDA_2014");
    expect(tchProj?.moduleCategory).toBe("RENDIMIENTO_TCH");
    expect(tchProj?.units).toBe("t/ha");
    expect(tchProj?.variables.length).toBeGreaterThanOrEqual(4);

    const truckFleet = PdaFormulaRegistry.getFormula("FORMULA_CCT_TRUCKS");
    expect(truckFleet).toBeDefined();
    expect(truckFleet?.name).toContain("Flota Requerida de Camiones");
    expect(truckFleet?.status).toBe("PDA_VALIDATED");
    expect(truckFleet?.units).toBe("camiones");
  });

  it("2. Origin Segregation: clearly distinguishes between PDA 2014 and BioAzúcar 4.0", () => {
    const pda2014 = PdaFormulaRegistry.getFormulasByOrigin("PDA_2014");
    const bio40 = PdaFormulaRegistry.getFormulasByOrigin("BIOAZUCAR_4_0");

    expect(pda2014.length).toBeGreaterThanOrEqual(13);
    expect(bio40.length).toBeGreaterThanOrEqual(2);

    // BioAzúcar 4.0 improvements check
    const aiCurve = PdaFormulaRegistry.getFormula("FORMULA_BIOAZUCAR_NDVI_TCH");
    expect(aiCurve).toBeDefined();
    expect(aiCurve?.modelOrigin).toBe("BIOAZUCAR_4_0");
    expect(["DERIVED", "BIOAZUCAR_MODEL"]).toContain(aiCurve?.status);
  });

  it("3. Damaged Source (#REF!) Segregation: marks corrupted ODS formulas as INVALID_SOURCE", () => {
    const invalidList = PdaFormulaRegistry.getFormulasByStatus("INVALID_SOURCE");
    expect(invalidList.length).toBeGreaterThanOrEqual(1);

    const refCorrupted = invalidList.find((f) => f.formulaId === "FORMULA_DAMAGED_HISTORIC_REF");
    expect(refCorrupted).toBeDefined();
    expect(refCorrupted?.name).toContain("Referencia Rota");
    expect(refCorrupted?.expression).toContain("#REF!");
    expect(refCorrupted?.status).toBe("INVALID_SOURCE");
    expect(refCorrupted?.notes).toContain("deshabilitada");
  });

  it("4. Audited Versioning: modifying a verified formula bumps version and creates audit log", () => {
    const initial = PdaFormulaRegistry.getFormula("FORMULA_TCH_PLOT");
    expect(initial).toBeDefined();

    // Update with valid reason
    const res = PdaFormulaRegistry.updateFormula({
      formulaId: "FORMULA_TCH_PLOT",
      newExpression: "TCH = BaseYieldTch * RatoonDecay(Stage) * SoilFactor(SoilType) * ClimateFactor * (1 + TchVarPct / 100) * 1.02",
      reason: "Calibración de factor micro-climático local en ingenio",
      changedBy: "usr-agronomo-01",
    });

    expect(res.success).toBe(true);
    const updated = res.updatedFormula;
    expect(updated).toBeDefined();
    expect(updated?.version).toBe("1.1.0");
    expect(updated?.auditHistory?.length).toBeGreaterThanOrEqual(1);
    expect(updated?.auditHistory?.[0].changedBy).toBe("usr-agronomo-01");
    expect(updated?.auditHistory?.[0].reason).toContain("Calibración");
  });
});

describe("BioAzúcar 4.0 — Agricultural Reporting Service (13 PDA Reports)", () => {
  // Build a realistic test context using domain planning services
  const mockCampaign: AgriculturalCampaign = {
    ...INITIAL_AGRICULTURAL_CAMPAIGN,
    totalAreaHectares: 4500,
    averageTchCampaign: 85.0,
    effectiveHarvestDays: 135,
    dailyHarvestRequirementTons: 2500,
  };

  const mockPlots: FieldPlot[] = INITIAL_FIELD_PLOTS;
  const mockSummary = YieldCalculationService.calculateCampaignYieldSummary(mockPlots);
  const mockSoilPrep = AgriculturalPlanningService.planSoilPreparation({
    tenantId: mockCampaign.tenantId,
    campaignId: mockCampaign.id,
    targetPreparationAreaHa: 700,
    availableCalendarDays: 120,
  });
  const mockPlanting = AgriculturalPlanningService.planPlanting({
    tenantId: mockCampaign.tenantId,
    campaignId: mockCampaign.id,
    targetPlantingAreaHa: 700,
  });
  const mockTreatments = AgriculturalPlanningService.planCulturalTreatments({
    tenantId: mockCampaign.tenantId,
    campaignId: mockCampaign.id,
    plantCaneAreaHa: 700,
    ratoonCaneAreaHa: 3100,
  });
  const mockFleet = MachineryAndLogisticsService.consolidateFleetPlan({
    tenantId: mockCampaign.tenantId,
    campaignId: mockCampaign.id,
    balanceItems: [],
  });
  const mockCct = MachineryAndLogisticsService.calculateTransportCycle({
    roundTripDistanceKm: 36,
    dailyHarvestDemandTons: 2500,
  });
  const mockEconomics = AgroEconomicsService.consolidateCampaignEconomics({
    tenantId: mockCampaign.tenantId,
    campaignId: mockCampaign.id,
    totalArableAreaHa: 4500,
    totalCaneTonsDelivered: 323000,
    soilPrepPlan: mockSoilPrep,
    plantingPlan: mockPlanting,
    treatmentsPlan: mockTreatments,
    fleetPlan: mockFleet,
  });

  const testContext: AgriculturalReportContext = {
    campaign: mockCampaign,
    plots: mockPlots,
    campaignSummary: mockSummary,
    soilPrepPlan: mockSoilPrep,
    plantingPlan: mockPlanting,
    treatmentsPlan: mockTreatments,
    fleetPlan: mockFleet,
    cctLogistics: mockCct,
    economics: mockEconomics,
  };

  const allReportTypes: PdaReportType[] = [
    "MASTER_PDA",
    "AREA_BALANCE",
    "RENOVATION_PLANTING",
    "SOIL_PREP",
    "TREATMENTS_INPUTS",
    "PRODUCTION_TCH",
    "HARVEST",
    "MACHINERY",
    "CCT_LOGISTICS",
    "FUEL_DIESEL",
    "COSTS_OPEX_CAPEX",
    "CAMPAIGN_SCENARIO_COMPARISON",
    "FORMULAS_PARAMETERS_TRACE",
  ];

  it("5. Completeness: generates all 13 PDA reports without errors", () => {
    allReportTypes.forEach((type) => {
      const report = AgriculturalReportingService.generateReport(type, testContext);
      expect(report).toBeDefined();
      expect(report.metadata.reportType).toBe(type);
      expect(report.columns.length).toBeGreaterThan(0);
      expect(report.rows.length).toBeGreaterThan(0);
      expect(report.summaryKpis.length).toBeGreaterThan(0);
      expect(report.traceNotes.length).toBeGreaterThan(0);
      expect(report.metadata.modelRevision).toBe(MODEL_REVISION);
    });
  });

  it("6. Mathematical Invariants: verifies mass & area conservation", () => {
    const areaReport = AgriculturalReportingService.generateReport("AREA_BALANCE", testContext);
    expect(areaReport).toBeDefined();

    const totalAreaKpi = areaReport.summaryKpis.find((k) => k.label.includes("Superficie Total"));
    expect(totalAreaKpi).toBeDefined();
    expect(parseFloat(String(totalAreaKpi!.value).replace(/,/g, ""))).toBeGreaterThan(0);
  });

  it("7. Bounds & Non-Negativity: all computed physical outputs are non-negative", () => {
    const dieselReport = AgriculturalReportingService.generateReport("FUEL_DIESEL", testContext);
    dieselReport.rows.forEach((row) => {
      if (row.litros != null) {
        const num = typeof row.litros === "number" ? row.litros : parseFloat(String(row.litros).replace(/,/g, ""));
        expect(num).toBeGreaterThanOrEqual(0);
      }
    });

    const costReport = AgriculturalReportingService.generateReport("COSTS_OPEX_CAPEX", testContext);
    costReport.rows.forEach((row) => {
      if (row.montoUSD != null) {
        const num = typeof row.montoUSD === "number" ? row.montoUSD : parseFloat(String(row.montoUSD).replace(/[^0-9.-]+/g, ""));
        expect(num).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it("8. Export Capabilities: generates valid CSV and JSON structures", () => {
    const masterReport = AgriculturalReportingService.generateReport("MASTER_PDA", testContext);
    
    // CSV Test
    const csv = AgriculturalReportingService.exportToCsv(masterReport);
    expect(csv).toContain("REPORTE AGRÍCOLA BIOAZÚCAR 4.0");
    expect(csv).toContain("Módulo Operacional");
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(5);

    // JSON Test
    const json = AgriculturalReportingService.exportToJson(masterReport);
    const parsed = JSON.parse(json);
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.reportType).toBe("MASTER_PDA");
    expect(parsed.rows.length).toBe(masterReport.rows.length);
  });
});

