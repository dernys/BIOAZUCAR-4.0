import { describe, it, expect, beforeEach } from "vitest";
import {
  FieldPlot,
  AgriculturalCampaign,
  CaneVarietyYieldMaster,
  SoilPreparationPlan,
  PlantingPlan,
  CulturalTreatmentPlan,
  MachineryFleetPlan,
  CctTransportCycleCalculation,
  YieldCalculationResult,
  AgroEconomicsSummary,
  AgriculturalPlanVsRealSummary,
  AgriculturalReconciliationSummary,
  PdaReportResult,
  CalculationTrace,
} from "../../../types/agriculture";
import { PdaFormulaRegistry } from "../PdaFormulaRegistry";
import { YieldCalculationService } from "../YieldCalculationService";
import { MachineryAndLogisticsService } from "../MachineryAndLogisticsService";
import { AgroEconomicsService } from "../AgroEconomicsService";
import { AgriculturalPlanVsRealService } from "../AgriculturalPlanVsRealService";
import { AgriculturalReconciliationService } from "../AgriculturalReconciliationService";
import { AgriculturalReportingService } from "../AgriculturalReportingService";
import { AgriculturalDataTruthService } from "../AgriculturalDataTruthService";
import { copilotService } from "../../../copilot/services/copilotService";
import { CopilotSessionContext } from "../../../copilot/types/copilot";

describe("BioAzúcar 4.0 — Agricultural Motor E2E Deterministic Validation Suite", () => {
  const TENANT_ID = "TENANT_SOBERANIA_01";
  const CAMPAIGN_ID = "CAMP-2026-SOBERANA";
  const USER_AUDITOR = "Ing. Manuel Valdés (Auditor Principal)";

  beforeEach(() => {
    PdaFormulaRegistry.resetToCanonical();
  });

  // ==========================================================================
  // SECTION 1: E2E CHAIN VALIDATION (CAMPAIGN -> REPORT)
  // ==========================================================================
  describe("1. Cadena E2E Obligatoria (Sin Mock Data ni ODS Runtime)", () => {
    it("debe ejecutar el ciclo de vida completo: CAMPAÑA → UEB → LOTES → VARIEDADES → ÁREAS → LABORES → EQUIPOS → COSECHA → CCT → COSTOS → PLAN → REAL → RECONCILIACIÓN → KPI → REPORTE", () => {
      // 1.1 CAMPAÑA
      const campaign: AgriculturalCampaign = {
        id: CAMPAIGN_ID,
        tenantId: TENANT_ID,
        code: "ZAFRA-2026-SOB",
        name: "Campaña Soberanía Azucarera 2026",
        startDate: "2026-11-15",
        endDate: "2027-04-15",
        status: "ACTIVE",
        totalAreaHectares: 1250.0,
        totalArableAreaHectares: 1250.0,
        projectedTotalCaneTons: 90000.0,
        averageTchCampaign: 72.0,
        effectiveHarvestDays: 120,
        dailyHarvestRequirementTons: 750.0,
        nominalMillTch: 35.0,
        plannedOpexUSD: 2475000.0,
        plannedCapexUSD: 380000.0,
        dataClassification: "CALCULATED",
        dataOrigin: "BIOAZUCAR",
        dataQuality: "VALIDATED",
        lastAuditTimestamp: new Date().toISOString(),
      };
      expect(campaign.id).toBe(CAMPAIGN_ID);

      // 1.2 UEB (Unidades Empresariales de Base)
      const uebs = ["UEB-CENTRAL", "UEB-NORTE", "UEB-SUR"];

      // 1.3 VARIEDADES CANÓNICAS
      const varieties: CaneVarietyYieldMaster[] = [
        {
          id: "VAR-B80251",
          varietyCode: "B-80251",
          varietyName: "B-80251 Rústica Alta Sacarosa",
          cycleType: "MEDIO",
          baseYieldTch: 80.0,
          potentialYieldTch: 95.0,
          expectedPolPercentage: 14.8,
          expectedFiberPercentage: 13.2,
          decayCurveType: "MODERADO",
          ratoonDecayFactors: { plant: 1.0, soca1: 0.92, soca2: 0.85, soca3: 0.78, soca4: 0.70, soca5Plus: 0.60 },
          recommendedSoilTypes: ["VERTISOL", "FERRALITICO"],
          droughtTolerance: "ALTA",
          frostTolerance: "MEDIA",
          modelOrigin: "INICA_CUBA",
          modelVersion: "1.0.0",
          notes: "Variedad robusta de maduración media.",
        },
        {
          id: "VAR-C8612",
          varietyCode: "C-86-12",
          varietyName: "C-86-12 Precoz Biomasa",
          cycleType: "TEMPRANO",
          baseYieldTch: 85.0,
          potentialYieldTch: 100.0,
          expectedPolPercentage: 14.2,
          expectedFiberPercentage: 14.0,
          decayCurveType: "MODERADO",
          ratoonDecayFactors: { plant: 1.0, soca1: 0.90, soca2: 0.82, soca3: 0.75, soca4: 0.68, soca5Plus: 0.58 },
          recommendedSoilTypes: ["FERRALITICO"],
          droughtTolerance: "MEDIA",
          frostTolerance: "BAJA",
          modelOrigin: "INICA_CUBA",
          modelVersion: "1.0.0",
          notes: "Excelente desarrollo inicial y alta biomasa.",
        },
      ];
      expect(varieties.length).toBe(2);

      // 1.4 LOTES (10 lotes explícitos con áreas que totalizan 1250.0 ha)
      const plots: FieldPlot[] = [
        { id: "LOT-01", uebId: uebs[0], varietyId: "B-80251", areaHectares: 150.0, ratoonStage: "PLANTA", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 80.0, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-02", uebId: uebs[0], varietyId: "B-80251", areaHectares: 120.0, ratoonStage: "SOCA_1", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 73.6, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-03", uebId: uebs[0], varietyId: "C-86-12", areaHectares: 130.0, ratoonStage: "SOCA_2", soilType: "VERTISOL", irrigationType: "ASPERSION", projectedTch: 69.7, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-04", uebId: uebs[1], varietyId: "C-86-12", areaHectares: 140.0, ratoonStage: "PLANTA", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 85.0, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-05", uebId: uebs[1], varietyId: "B-80251", areaHectares: 110.0, ratoonStage: "SOCA_1", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 73.6, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-06", uebId: uebs[1], varietyId: "B-80251", areaHectares: 125.0, ratoonStage: "SOCA_3", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 62.4, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-07", uebId: uebs[2], varietyId: "C-86-12", areaHectares: 160.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "ASPERSION", projectedTch: 85.0, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-08", uebId: uebs[2], varietyId: "B-80251", areaHectares: 105.0, ratoonStage: "SOCA_2", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 68.0, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-09", uebId: uebs[2], varietyId: "C-86-12", areaHectares: 115.0, ratoonStage: "SOCA_1", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 76.5, status: "EN_CRECIMIENTO", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
        { id: "LOT-10", uebId: uebs[2], varietyId: "B-80251", areaHectares: 95.0, ratoonStage: "SOCA_4", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 56.0, status: "EN_DEMOLICION", dataClassification: "REAL", dataOrigin: "BIOAZUCAR", dataQuality: "VALIDATED" },
      ];

      // 1.5 ÁREAS: Verificación estricta de balance de superficie
      const totalPlotArea = plots.reduce((acc, p) => acc + p.areaHectares, 0);
      expect(totalPlotArea).toBe(1250.0);
      expect(totalPlotArea).toBe(campaign.totalAreaHectares);

      // 1.6 LABORES AGRÍCOLAS (Soil Prep, Planting, Cultural Treatments)
      const soilPrepPlan: SoilPreparationPlan = {
        campaignId: CAMPAIGN_ID,
        totalPreparationAreaHa: 100.0,
        subsoilingAreaHa: 100.0,
        harrowingAreaHa: 100.0,
        furrowingAreaHa: 100.0,
        totalMachineHours: 850.0,
        totalDieselLiters: 18700.0,
        estimatedCostUSD: 45000.0,
        heavyTractorsRequired: 2,
        workingWindowDays: 60,
        status: "PLANIFICADO",
        activities: [],
      };

      const plantingPlan: PlantingPlan = {
        campaignId: CAMPAIGN_ID,
        targetPlantingAreaHa: 100.0,
        seedCaneRequiredTons: 1200.0,
        mechanizedPlantingAreaHa: 80.0,
        manualPlantingAreaHa: 20.0,
        furrowDistanceMeters: 1.6,
        seedRateTonsPerHa: 12.0,
        estimatedCostUSD: 85000.0,
        status: "PLANIFICADO",
        items: [],
      };

      const treatmentsPlan: CulturalTreatmentPlan = {
        campaignId: CAMPAIGN_ID,
        totalTreatedAreaHa: 1150.0,
        fertilizerApplicationsAreaHa: 1150.0,
        herbicideApplicationsAreaHa: 1150.0,
        biologicalPestControlAreaHa: 1150.0,
        cultivationMechanicalAreaHa: 1150.0,
        totalDieselLiters: 25300.0,
        estimatedCostUSD: 160000.0,
        status: "PLANIFICADO",
        interventions: [],
      };

      // 1.7 EQUIPOS Y BALANCE DE FLOTA
      const fleetItemTractor = MachineryAndLogisticsService.calculateFleetBalanceItem({
        category: "TRACTOR_PESADO",
        description: "Tractor Pesado de Roturación",
        totalWorkloadHours: 850.0,
        workingWindowDays: 60,
        fleetAvailableUnits: 2,
      });
      expect(fleetItemTractor.fleetRequiredUnits).toBeGreaterThanOrEqual(1);

      const fleetPlan: MachineryFleetPlan = {
        campaignId: CAMPAIGN_ID,
        generatedAt: new Date().toISOString(),
        overallSufficiencyStatus: "EQUILIBRADO",
        totalCapexDeficitUSD: 0,
        totalDieselDemandLiters: 44000.0,
        balanceItems: [fleetItemTractor],
      };

      // 1.8 COSECHA (Yield Calculation)
      const yieldSummary = YieldCalculationService.calculateCampaignYield(plots, campaign);
      expect(yieldSummary.totalArableAreaHectares).toBe(1250.0);
      expect(yieldSummary.totalProjectedCaneTons).toBeGreaterThan(80000);
      expect(yieldSummary.weightedAverageTch).toBeGreaterThan(65);

      // 1.9 CCT LOGÍSTICA (Transporte y Tiro)
      const cctLogistics = MachineryAndLogisticsService.calculateCctTransportCycle({
        campaignId: CAMPAIGN_ID,
        averageHaulDistanceKm: 18.0,
        averageLoadedSpeedKmH: 35.0,
        averageEmptySpeedKmH: 45.0,
        fieldLoadingTimeMinutes: 25.0,
        millUnloadingTimeMinutes: 20.0,
        fieldWaitTimeMinutes: 15.0,
        millQueueTimeMinutes: 15.0,
        truckPayloadTons: 28.0,
        operatingHoursPerDay: 18.0,
        trafficCongestionFactor: 1.1,
        dailyMillCrushCapacityTons: campaign.dailyHarvestRequirementTons,
      });
      expect(cctLogistics.roundTripCycleTimeMinutes).toBeGreaterThan(60);
      expect(cctLogistics.trucksRequiredCount).toBeGreaterThanOrEqual(2);

      // 1.10 COSTOS AGRO-ECONÓMICOS
      const economics = AgroEconomicsService.consolidateCampaignEconomics({
        campaign,
        summary: yieldSummary,
        soilPrepPlan,
        plantingPlan,
        treatmentsPlan,
        fleetPlan,
        cctLogistics,
      });
      expect(economics.opex.totalOpexUSD).toBeGreaterThan(0);
      expect(economics.opex.costPerTonCaneUSD).toBeGreaterThan(10);
      expect(economics.opex.costPerTonCaneUSD).toBeLessThan(70);

      // 1.11 PLAN VS REAL
      const planVsReal = AgriculturalPlanVsRealService.generatePlanVsRealSummary({
        campaign,
        plots,
        soilPrepPlan,
        plantingPlan,
        treatmentsPlan,
      });
      expect(planVsReal.items.length).toBeGreaterThanOrEqual(3);
      expect(planVsReal.overallStatus).toBeDefined();

      // 1.12 RECONCILIACIÓN MATEMÁTICA MULTI-MÓDULO
      const reconciliation = AgriculturalReconciliationService.reconcileCampaign({
        campaign,
        plots,
        campaignSummary: yieldSummary,
        soilPrepPlan,
        fleetPlan,
        cctLogistics,
        economics,
      });
      expect(reconciliation.overallStatus).toMatch(/PASS|WARNING|ERROR/);
      expect(reconciliation.integrityIndex).toBeGreaterThanOrEqual(80);
      expect(reconciliation.checks.length).toBeGreaterThanOrEqual(7);

      // 1.13 KPIS CLAVE Y REPORTE DETERMINÍSTICO
      const reportBalance = AgriculturalReportingService.generateDeterministicReport({
        reportType: "REPORTE_BALANCE_MASA_AREA",
        campaign,
        plots,
        campaignSummary: yieldSummary,
        soilPrepPlan,
        fleetPlan,
        cctLogistics,
        economics,
        reconciliation,
      });
      expect(reportBalance.title).toContain("Balance de Masa");
      expect(reportBalance.kpis.length).toBeGreaterThanOrEqual(4);
      expect(reportBalance.columns.length).toBeGreaterThan(0);
      expect(reportBalance.rows.length).toBe(10); // 10 plots audited
    });
  });

  // ==========================================================================
  // SECTION 2: DATA TRUTH AUDITING
  // ==========================================================================
  describe("2. Data Truth & Provenance Auditing", () => {
    it("debe verificar que cada KPI y dato conserve explícitamente todos sus atributos de linaje ISA-95", () => {
      const trace = PdaFormulaRegistry.createCalculationTrace({
        formulaId: "TCH_PROYECTADO_V1",
        inputs: {
          BaseYieldTch: { value: 85.0, unit: "t/ha", source: "FIELD_HISTORY" },
          RatoonDecay: { value: 0.92, unit: "factor", source: "VARIETY_TABLE" },
        },
        result: { value: 78.2, unit: "t/ha" },
        user: USER_AUDITOR,
        campaignId: CAMPAIGN_ID,
      });

      expect(trace.traceId).toBeDefined();
      expect(trace.formulaId).toBe("TCH_PROYECTADO_V1");
      expect(trace.modelVersion).toBe("1.0.0");
      expect(trace.dataClassification).toBe("CALCULATED");
      expect(trace.dataOrigin).toBe("PDA_FORMULA_REGISTRY");
      expect(trace.dataQuality).toBe("VALIDATED");
      expect(trace.calculatedBy).toBe(USER_AUDITOR);
      expect(trace.campaignId).toBe(CAMPAIGN_ID);
      expect(trace.calculatedAt).toBeDefined();
      expect(trace.inputs["BaseYieldTch"].value).toBe(85.0);
      expect(trace.inputs["RatoonDecay"].value).toBe(0.92);
      expect(trace.result.value).toBe(78.2);
    });

    it("debe bloquear la promoción silenciosa de DEFAULT, ASSUMPTION, BENCHMARK o SIMULATED a REAL", () => {
      const simulatedItem = {
        id: "TEST_SIM_01",
        name: "Rendimiento Estimado Monte Carlo",
        dataClassification: "SIMULATED",
        dataOrigin: "PDA_SIMULATOR",
        dataQuality: "UNVERIFIED",
      };

      // Ensure classification remains strictly SIMULATED and cannot be masqueraded as REAL
      expect(simulatedItem.dataClassification).not.toBe("REAL");
      expect(simulatedItem.dataOrigin).not.toBe("BIOAZUCAR_OT");

      const auditCheck = AgriculturalDataTruthService.auditEntityTruth({
        entityId: simulatedItem.id,
        classification: simulatedItem.dataClassification as any,
        origin: simulatedItem.dataOrigin as any,
        quality: simulatedItem.dataQuality as any,
      });

      expect(auditCheck.isLegitimateLiveOt).toBe(false);
      expect(auditCheck.requiresPhysicalVerification).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 3: MATHEMATICAL INTEGRITY & EVALUATE FORMULA
  // ==========================================================================
  describe("3. Mathematical Integrity & evaluateFormula() Edge Cases", () => {
    it("debe evaluar correctamente casos normales devolviendo trace, unidad y fórmula", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "TCH_PROYECTADO_V1",
        { BaseYieldTch: 80, RatoonDecay: 0.9 },
        { campaignId: CAMPAIGN_ID, user: USER_AUDITOR }
      );

      expect(res.success).toBe(true);
      expect(res.result).toBe(72.0);
      expect(res.unit).toBe("t/ha");
      expect(res.warnings.length).toBe(0);
      expect(res.error).toBeUndefined();
      expect(res.trace).toBeDefined();
      expect(res.trace.formulaId).toBe("TCH_PROYECTADO_V1");
      expect(res.trace.result.value).toBe(72.0);
    });

    it("debe interceptar y advertir sobre valores fuera de rango agronómico (BaseYield > 250)", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "TCH_PROYECTADO_V1",
        { BaseYieldTch: 280, RatoonDecay: 1.0 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.success).toBe(true);
      expect(res.result).toBe(280.0);
      expect(res.warnings.some((w) => w.includes("fuera de rango"))).toBe(true);
    });

    it("debe bloquear divisiones por cero en DEMANDA_DIARIA_MOLIENDA_V1", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "DEMANDA_DIARIA_MOLIENDA_V1",
        { TotalProductionTons: 95000, EffectiveHarvestDays: 0 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.success).toBe(false);
      expect(res.result).toBeUndefined();
      expect(res.error).toContain("Error de división por cero");
      expect(res.trace.result.value).toBe("DIV_BY_ZERO");
    });

    it("debe bloquear divisiones por cero en CAMIONES_CCT_V1", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "CAMIONES_CCT_V1",
        { DailyHarvestTons: 800, TruckPayloadTons: 0, CyclesPerDay: 4 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.success).toBe(false);
      expect(res.result).toBeUndefined();
      expect(res.error).toContain("Error de división por cero");
      expect(res.trace.result.value).toBe("DIV_BY_ZERO");
    });

    it("debe bloquear divisiones por cero en COSTO_OPEX_UNITARIO_V1", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "COSTO_OPEX_UNITARIO_V1",
        { TotalOpexUSD: 2500000, TotalCaneTons: 0 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.success).toBe(false);
      expect(res.result).toBeUndefined();
      expect(res.error).toContain("Error de división por cero");
      expect(res.trace.result.value).toBe("DIV_BY_ZERO");
    });

    it("debe manejar valores negativos emitiendo warnings explícitos", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "PRODUCCION_LOTE_V1",
        { AreaHa: -50, TchProjected: 75 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.warnings.some((w) => w.includes("Superficie negativa"))).toBe(true);
    });
  });

  // ==========================================================================
  // SECTION 4: RECONCILIATION DETERMINISM
  // ==========================================================================
  describe("4. Reglas Determinísticas de Reconciliación", () => {
    it("debe detectar discrepancia entre catastro de lotes y superficie de campaña (REC_AREA_CATASTRO)", () => {
      const badCampaign: AgriculturalCampaign = {
        id: "CAMP-ERR-01",
        tenantId: TENANT_ID,
        code: "ERR-01",
        name: "Campaña Inconsistente",
        startDate: "2026-11-01",
        endDate: "2027-04-01",
        status: "ACTIVE",
        totalAreaHectares: 2000.0, // Declares 2000 ha, but plots only sum to 250 ha
        totalArableAreaHectares: 2000.0,
        projectedTotalCaneTons: 15000.0,
        averageTchCampaign: 60.0,
        effectiveHarvestDays: 100,
        dailyHarvestRequirementTons: 150.0,
        nominalMillTch: 25.0,
        plannedOpexUSD: 1000000,
        plannedCapexUSD: 100000,
      };

      const smallPlots: FieldPlot[] = [
        { id: "L-1", uebId: "UEB-1", varietyId: "V-1", areaHectares: 150.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 60.0, status: "EN_CRECIMIENTO" },
        { id: "L-2", uebId: "UEB-1", varietyId: "V-1", areaHectares: 100.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 60.0, status: "EN_CRECIMIENTO" },
      ];

      const res = AgriculturalReconciliationService.reconcileCampaign({
        campaign: badCampaign,
        plots: smallPlots,
        campaignSummary: {
          totalArableAreaHectares: 250.0,
          totalProjectedCaneTons: 15000.0,
          weightedAverageTch: 60.0,
          dailyHarvestRequirementTons: 150.0,
        } as any,
        soilPrepPlan: { totalPreparationAreaHa: 0 } as any,
        fleetPlan: { balanceItems: [] } as any,
        cctLogistics: { dailyCapacityPerTruckTons: 100 } as any,
        economics: { opex: { totalOpexUSD: 1000000, costPerTonCaneUSD: 66.6 } } as any,
      });

      const areaCheck = res.checks.find((c) => c.checkId === "REC_AREA_CATASTRO");
      expect(areaCheck).toBeDefined();
      expect(areaCheck?.status).toBe("CRITICAL");
      expect(areaCheck?.difference).toBe(1750.0);
      expect(areaCheck?.remediationAction).toContain("Diferencia grave");
    });

    it("debe detectar déficit crítico de transporte CCT (REC_CCT_CAPACIDAD)", () => {
      const goodCampaign: AgriculturalCampaign = {
        id: "CAMP-OK",
        tenantId: TENANT_ID,
        code: "OK",
        name: "Campaña CCT Test",
        startDate: "2026-11-01",
        endDate: "2027-04-01",
        status: "ACTIVE",
        totalAreaHectares: 100.0,
        totalArableAreaHectares: 100.0,
        projectedTotalCaneTons: 8000.0,
        averageTchCampaign: 80.0,
        effectiveHarvestDays: 10,
        dailyHarvestRequirementTons: 800.0, // High demand: 800 t/day
        nominalMillTch: 40.0,
        plannedOpexUSD: 200000,
        plannedCapexUSD: 50000,
      };

      const res = AgriculturalReconciliationService.reconcileCampaign({
        campaign: goodCampaign,
        plots: [{ id: "L-1", uebId: "UEB-1", varietyId: "V-1", areaHectares: 100.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 80.0, status: "EN_CRECIMIENTO" }],
        campaignSummary: {
          totalArableAreaHectares: 100.0,
          totalProjectedCaneTons: 8000.0,
          weightedAverageTch: 80.0,
          dailyHarvestRequirementTons: 800.0,
        } as any,
        soilPrepPlan: { totalPreparationAreaHa: 0 } as any,
        fleetPlan: {
          balanceItems: [{ category: "CAMION_CANERO_RODOVIARIO", fleetAvailableUnits: 1 }], // Only 1 truck!
        } as any,
        cctLogistics: { dailyCapacityPerTruckTons: 100 }, // 1 * 100 = 100 t/day vs 800 t/day needed!
        economics: { opex: { totalOpexUSD: 200000, costPerTonCaneUSD: 25.0 } } as any,
      });

      const cctCheck = res.checks.find((c) => c.checkId === "REC_CCT_CAPACIDAD");
      expect(cctCheck).toBeDefined();
      expect(cctCheck?.status).toBe("CRITICAL");
      expect(cctCheck?.difference).toBe(700.0); // 800 - 100 = 700 t deficit
      expect(cctCheck?.remediationAction).toContain("Déficit crítico de transporte");
    });
  });

  // ==========================================================================
  // SECTION 5: FORMULA GOVERNANCE & VERSIONING
  // ==========================================================================
  describe("5. Formula Governance & Immutability", () => {
    it("debe exigir motivo, usuario y actualizar la versión manteniendo el histórico inmutable", () => {
      const formulaBefore = PdaFormulaRegistry.getFormula("TCH_PROYECTADO_BIOAZUCAR_V1");
      expect(formulaBefore).toBeDefined();
      const versionBefore = formulaBefore?.version;

      // Create a calculation trace with V1
      const traceV1 = PdaFormulaRegistry.createCalculationTrace({
        formulaId: "TCH_PROYECTADO_BIOAZUCAR_V1",
        inputs: { BaseYieldTch: { value: 80, unit: "t/ha" } },
        result: { value: 80, unit: "t/ha" },
        user: USER_AUDITOR,
      });
      expect(traceV1.modelVersion).toBe(versionBefore);

      // Upgrade formula to V2
      const updateResult = PdaFormulaRegistry.updateFormula({
        formulaId: "TCH_PROYECTADO_BIOAZUCAR_V1",
        newExpression: "BaseYieldTch * RatoonDecay * SoilFactor * ClimateFactor * 1.02",
        changedBy: USER_AUDITOR,
        reason: "Ajuste por mejora en eficiencia de riego localizado",
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.updatedFormula?.version).toBe("1.2.0");
      expect(updateResult.updatedFormula?.auditHistory?.length).toBeGreaterThan(0);

      // Create a new trace with V2
      const traceV2 = PdaFormulaRegistry.createCalculationTrace({
        formulaId: "TCH_PROYECTADO_BIOAZUCAR_V1",
        inputs: { BaseYieldTch: { value: 80, unit: "t/ha" } },
        result: { value: 81.6, unit: "t/ha" },
        user: USER_AUDITOR,
      });
      expect(traceV2.modelVersion).toBe("1.2.0");

      // Verify that traceV1 remains strictly at V1 (immutability of history)
      expect(traceV1.modelVersion).toBe(versionBefore);
      expect(traceV1.modelVersion).not.toBe(traceV2.modelVersion);
    });
  });

  // ==========================================================================
  // SECTION 6: PLAN VS REAL CATEGORICAL ISOLATION
  // ==========================================================================
  describe("6. Plan vs Real Categorical Isolation", () => {
    it("debe mantener categorías PLAN, ACTUAL, FORECAST, SCENARIO estrictamente separadas en los cálculos", () => {
      const campaign: AgriculturalCampaign = {
        id: "CAMP-PVR",
        tenantId: TENANT_ID,
        code: "PVR",
        name: "Plan vs Real Isolation",
        startDate: "2026-11-01",
        endDate: "2027-04-01",
        status: "ACTIVE",
        totalAreaHectares: 500.0,
        totalArableAreaHectares: 500.0,
        projectedTotalCaneTons: 35000.0,
        averageTchCampaign: 70.0,
        effectiveHarvestDays: 100,
        dailyHarvestRequirementTons: 350.0,
        nominalMillTch: 25.0,
        plannedOpexUSD: 1000000.0,
        plannedCapexUSD: 150000.0,
      };

      const plots: FieldPlot[] = [
        { id: "P-1", uebId: "U1", varietyId: "V1", areaHectares: 250.0, ratoonStage: "PLANTA", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 70.0, status: "COSECHADO" },
        { id: "P-2", uebId: "U1", varietyId: "V1", areaHectares: 250.0, ratoonStage: "SOCA_1", soilType: "FERRALITICO", irrigationType: "SECANO", projectedTch: 70.0, status: "EN_CRECIMIENTO" },
      ];

      const pvrSummary = AgriculturalPlanVsRealService.generatePlanVsRealSummary({
        campaign,
        plots,
        soilPrepPlan: { totalPreparationAreaHa: 200, totalMachineHours: 1200, totalDieselLiters: 26000 } as any,
        plantingPlan: { targetPlantingAreaHa: 200 } as any,
        treatmentsPlan: { totalTreatedAreaHa: 400 } as any,
      });

      for (const item of pvrSummary.items) {
        expect(item.plannedAreaHa).toBeDefined();
        expect(item.realAreaHa).toBeDefined();
        expect(item.deviationAreaHa).toBeCloseTo(item.realAreaHa - item.plannedAreaHa, 2);
        expect(item.dataClassification).toBe("REAL");
      }
    });
  });

  // ==========================================================================
  // SECTION 7 & 8: ADVERSARIAL TESTING & INTEGRITY DEFENSES
  // ==========================================================================
  describe("7 & 8. Adversarial Testing & System Defenses", () => {
    it("debe detectar y bloquear lote duplicado", () => {
      const duplicatePlots: FieldPlot[] = [
        { id: "DUP-01", uebId: "UEB-1", varietyId: "V-1", areaHectares: 50.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 70.0, status: "EN_CRECIMIENTO" },
        { id: "DUP-01", uebId: "UEB-1", varietyId: "V-1", areaHectares: 50.0, ratoonStage: "PLANTA", soilType: "VERTISOL", irrigationType: "SECANO", projectedTch: 70.0, status: "EN_CRECIMIENTO" },
      ];

      const check = AgriculturalDataTruthService.validatePlotCollectionIntegrity(duplicatePlots);
      expect(check.hasDuplicates).toBe(true);
      expect(check.duplicateIds).toContain("DUP-01");
      expect(check.isValid).toBe(false);
    });

    it("debe rechazar o marcar TCH imposible (> 300 t/ha) como anomalía fisiológica", () => {
      const impossibleTchPlot: FieldPlot = {
        id: "LOT-ANOMALY",
        uebId: "UEB-1",
        varietyId: "V-1",
        areaHectares: 50.0,
        ratoonStage: "PLANTA",
        soilType: "VERTISOL",
        irrigationType: "SECANO",
        projectedTch: 450.0, // Impossible TCH!
        status: "EN_CRECIMIENTO",
      };

      const check = AgriculturalDataTruthService.validatePlotAgronomicBounds(impossibleTchPlot);
      expect(check.isAnomaly).toBe(true);
      expect(check.reason).toContain("TCH fuera de rango biológico");
    });

    it("debe responder con error controlado ante fórmula inexistente o versión inválida", () => {
      const res = PdaFormulaRegistry.evaluateFormula(
        "FORMULA_FANTASMA_V99",
        { X: 100 },
        { campaignId: CAMPAIGN_ID }
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain("no encontrada en el registro agronómico");
      expect(res.trace.result.value).toBe("ERROR");
    });

    it("debe aislar datos con tenantId ausente o perteneciente a otro tenant", () => {
      const foreignCampaign: AgriculturalCampaign = {
        id: "CAMP-FOREIGN",
        tenantId: "TENANT_INVASOR_99",
        code: "INV",
        name: "Campaña Externa",
        startDate: "2026-11-01",
        endDate: "2027-04-01",
        status: "ACTIVE",
        totalAreaHectares: 500,
        totalArableAreaHectares: 500,
        projectedTotalCaneTons: 35000,
        averageTchCampaign: 70,
        effectiveHarvestDays: 100,
        dailyHarvestRequirementTons: 350,
        nominalMillTch: 25,
        plannedOpexUSD: 1000000,
        plannedCapexUSD: 150000,
      };

      const isolationCheck = AgriculturalDataTruthService.verifyTenantBoundary(
        TENANT_ID,
        foreignCampaign.tenantId
      );
      expect(isolationCheck.authorized).toBe(false);
      expect(isolationCheck.violationType).toBe("CROSS_TENANT_ACCESS_DENIED");
    });
  });

  // ==========================================================================
  // SECTION 9: COPILOT / BIOAI CANONICAL RESPONSIVENESS
  // ==========================================================================
  describe("9. Copilot / BioAI Canonical Responsiveness", () => {
    const copilotContext: CopilotSessionContext = {
      tenantId: TENANT_ID,
      plantCode: "ING-SOBERANIA-01",
      plantName: "Central Azucarero Soberanía",
      userId: "usr-auditor-01",
      username: "mvaldes",
      displayName: "Ing. Manuel Valdés",
      roles: ["SUPER_ADMIN", "PROCESS_ENGINEER"],
      permissions: ["MODIFY_SETPOINTS", "ACKNOWLEDGE_ALARM", "CHANGE_DISPATCH_MW", "AUDIT_RECORDS"],
      securityLevel: 3,
      currentView: "agricultural_pda",
      activeTab: "agricultural_pda",
    };

    it("debe responder determinísticamente sobre Reconciliación Agrícola sin alucinar", async () => {
      const response = await copilotService.sendMessage(
        "auditoria de reconciliacion y consistencia del plan agricola",
        copilotContext,
        [],
        [],
        [],
        { id: TENANT_ID, name: "Central Azucarero Soberanía", code: "SOBERANIA" }
      );

      expect(response.intent).toBe("RECONCILIATION_AUDIT");
      expect(response.message).toContain("Reconciliación Multidimensional");
      expect(response.message).toContain("REC_AREA_CATASTRO");
      expect(response.message).toContain("REC_CCT_CAPACIDAD");
    });

    it("debe responder determinísticamente sobre Plan vs Real sin mezclar categorías", async () => {
      const response = await copilotService.sendMessage(
        "analisis de plan vs real ejecucion de labores agricolas",
        copilotContext,
        [],
        [],
        [],
        { id: TENANT_ID, name: "Central Azucarero Soberanía", code: "SOBERANIA" }
      );

      expect(response.intent).toBe("PLAN_VS_REAL");
      expect(response.message).toContain("Plan vs Real");
      expect(response.message).toContain("PREPARO_SOLO");
    });

    it("debe responder determinísticamente sobre Gobernanza de Fórmulas y Trazas", async () => {
      const response = await copilotService.sendMessage(
        "registro de formulas pda y trazabilidad de calculo",
        copilotContext,
        [],
        [],
        [],
        { id: TENANT_ID, name: "Central Azucarero Soberanía", code: "SOBERANIA" }
      );

      expect(response.intent).toBe("FORMULA_GOVERNANCE");
      expect(response.message).toContain("Gobernanza de Fórmulas PDA");
      expect(response.message).toContain("TCH_PROYECTADO_V1");
    });
  });
});
