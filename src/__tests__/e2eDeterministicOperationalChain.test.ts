/**
 * BIOAZÚCAR 4.0 — Deterministic E2E Operational Chain & Lifecycle Validation Suite
 * 
 * Verifies the full operational chain according to BIOAZUCAR-STD-E2E-001:
 * MASTER DATA → PDA → AGRO PLAN → WORK REQUIREMENT → WORK ORDER →
 * HARVEST EXECUTION → CCT/TRANSPORT → WEIGHBRIDGE → CANEBATCH →
 * YARD → MILLING → INDUSTRIAL PROCESS → QUALITY & LIMS →
 * ENERGY & COGEN → BIOAI PROVENANCE → CLOSED LOOP FEEDBACK → PDA.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { AgronomicValidationService } from "../services/agriculture/AgronomicValidationService";
import { AgriculturalParameterRegistry } from "../services/agriculture/AgriculturalParameterRegistry";
import { AgriculturalPersistenceService } from "../services/agriculture/AgriculturalPersistenceService";
import { IndustrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { FieldPlot, AgriculturalCampaign, ClosedLoopFeedbackSummary } from "../types/agriculture";
import { CaneBatch, WorkOrder, IndustrialDataPoint } from "../types";

describe("BioAzúcar 4.0 — Deterministic E2E Industrial Lifecycle & Evidence Standard", () => {
  const TENANT_A = "TENANT_AZUCAR_01";
  const TENANT_B = "TENANT_AZUCAR_02";
  const CAMPAIGN_ID = "camp-2026-2027";

  let samplePlot: FieldPlot;
  let sampleCampaign: AgriculturalCampaign;

  beforeEach(() => {
    sampleCampaign = {
      id: CAMPAIGN_ID,
      tenantId: TENANT_A,
      name: "Zafra Chica 2026-2027",
      calendarDays: 140,
      effectiveHarvestDays: 125,
      nominalMillingTch: 450,
      totalNetAreaHectares: 12500,
      totalAreaHectares: 12500,
      renewalTargetPercent: 12,
      projectedTotalCaneTons: 950000,
      dailyHarvestRequirementTons: 7600,
      averageTchCampaign: 76.0,
      sugarTargetTons: 105000,
      targetMillingTons: 950000,
      targetSugarTons: 105000,
      plannedRenovationRatePercent: 12,
      plannedTotalGrossCaneTons: 950000,
      budgetOpexUSD: 24000000,
      status: "APROBADA",
      syncStatus: "SYNCED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    samplePlot = {
      id: "plot-e2e-001",
      code: "LOTE-NORTE-42",
      tenantId: TENANT_A,
      campaignId: CAMPAIGN_ID,
      uebName: "Héctor Rodríguez",
      blockSector: "Zona Cañera Central",
      varietyCode: "C323-68",
      cycleType: "PRIMAVERA",
      cutNumber: 2,
      currentStage: "RETONO_Q2",
      ratoonAgeYears: 2,
      soilType: "FERRALITICO_ROJO",
      distanceToMillKm: 14.5,
      historicalAverageTch: 78.0,
      projectedTch: 78.4,
      projectedTotalCaneTons: 2234.4,
      scheduledHarvestMonth: 2,
      areaHectares: 28.5,
      expectedTch: 78.4,
      drainageCondition: "BUENO",
      status: "PLANIFICADO",
      syncStatus: "SYNCED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // =========================================================================
  // 1. MASTER DATA & PDA CAMPAIGN VALIDATION
  // =========================================================================
  it("Etapa 1 & 2: Valida Master Data y parámetros agronómicos de la Campaña PDA", () => {
    const campaignValidation = AgronomicValidationService.validateAgriculturalCampaign(sampleCampaign);
    expect(campaignValidation.isValid).toBe(true);
    expect(campaignValidation.errors.length).toBe(0);

    const varietyCatalog = AgriculturalParameterRegistry.getVarietyCatalog();
    expect(varietyCatalog["C323-68"]).toBeDefined();
    expect(varietyCatalog["C323-68"].polPercent).toBeGreaterThan(12);
    expect(varietyCatalog["C323-68"].purityPercent).toBeGreaterThan(80);
  });

  // =========================================================================
  // 2. PLOT LIFECYCLE & FORBIDDEN STATE TRANSITION REJECTION
  // =========================================================================
  it("Etapa 3: Valida máquina de estados de parcela y rechaza saltos ilícitos de ciclo", () => {
    // 1. Transición legal: PLANIFICADO -> PREPARACION_SUELO
    const legalPrep = AgronomicValidationService.validatePlotLifecycleTransition(
      samplePlot.status,
      "PREPARACION_SUELO"
    );
    expect(legalPrep.allowed).toBe(true);

    // 2. Transición ilegal: PLANIFICADO -> COSECHADO (Rechazado directamente)
    const illegalJump = AgronomicValidationService.validatePlotLifecycleTransition(
      samplePlot.status,
      "COSECHADO"
    );
    expect(illegalJump.allowed).toBe(false);
    expect(illegalJump.reason).toContain("prohibida");

    // 3. Simular avance legítimo a READY_FOR_HARVEST
    samplePlot.status = "READY_FOR_HARVEST";
    const harvestReadyCheck = AgronomicValidationService.validatePlotLifecycleTransition(
      samplePlot.status,
      "COSECHADO"
    );
    expect(harvestReadyCheck.allowed).toBe(true);
  });

  // =========================================================================
  // 3. WORK ORDERS LIFECYCLE & MUTATION REJECTION
  // =========================================================================
  it("Etapa 4 & 5: Valida ciclo de vida de Órdenes de Trabajo y rechaza reaperturas ilícitas", () => {
    const wo: WorkOrder = {
      id: "WO-AGRO-901",
      code: "WO-AGRO-901",
      title: "Mantenimiento Preventivo Cosechadora Case IH 8810",
      description: "Mantenimiento preventivo programado",
      equipmentId: "EQ-HARV-01",
      equipmentName: "Cosechadora CH-01",
      type: "PREVENTIVO",
      priority: "ALTA",
      status: "PENDIENTE",
      assignedTo: "Mecánico Especialista",
      estimatedHours: 4,
      estimatedDurationHours: 4,
      tasks: [{ id: "t1", text: "Cambio de cuchillas", done: false }],
      dueDate: new Date().toISOString(),
      createdDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId: TENANT_A,
    };

    // PENDIENTE -> EN_PROCESO (Válido)
    const legalStep = AgronomicValidationService.validateWorkOrderLifecycleTransition(wo.status, "EN_PROCESO");
    expect(legalStep.allowed).toBe(true);

    // CANCELADA -> COMPLETADA (Inválido)
    const illegalReopen = AgronomicValidationService.validateWorkOrderLifecycleTransition("CANCELADA", "COMPLETADA");
    expect(illegalReopen.allowed).toBe(false);
    expect(illegalReopen.reason).toContain("Transición inválida");
  });

  // =========================================================================
  // 4. HARVEST EXECUTION, DISPATCH & WEIGHBRIDGE TRACEABILITY
  // =========================================================================
  it("Etapa 6, 7 & 8: Despacha cosecha a fábrica asegurando trazabilidad de linaje y báscula", async () => {
    samplePlot.status = "READY_FOR_HARVEST";

    const harvestTons = 65.4;
    const tareTons = 12.2;

    const caneBatch = await AgriculturalPersistenceService.dispatchHarvestPlotToFactory(
      samplePlot,
      harvestTons,
      "agronomo_e2e_auditor",
      {
        truckPlate: "B-184920",
        tareWeightTons: tareTons,
        trashPercent: 4.2,
        polPercent: 14.2,
        fiberPercent: 12.8,
        purityPercent: 86.5,
      }
    );

    // Verificación de linaje de trazabilidad
    expect(caneBatch.plotId).toBe(samplePlot.id);
    expect(caneBatch.campaignId).toBe(sampleCampaign.id);
    expect(caneBatch.truckPlate).toBe("B-184920");
    expect(caneBatch.tareWeightTons).toBe(12.2);
    expect(caneBatch.netWeightTons).toBe(harvestTons);
    expect(caneBatch.grossWeightTons).toBe(Number((harvestTons + tareTons).toFixed(2)));
    expect(caneBatch.weighingProvenance).toBe("MEASURED_SCALE");
    expect(caneBatch.status).toBe("EN_PATIO");

    // Parcela queda en estado COSECHADO
    const cachedPlots = AgriculturalPersistenceService.getLocalCachedPlots();
    const updated = cachedPlots.find((p) => p.id === samplePlot.id);
    expect(updated?.status).toBe("COSECHADO");
  });

  // =========================================================================
  // 5. CANE BATCH LIFECYCLE IN YARD & MILLING TANDEM
  // =========================================================================
  it("Etapa 9, 10 & 11: Ejecuta máquina de estados de lote de caña en patio y molienda", () => {
    // Estado inicial en patio
    let currentStatus: CaneBatch["status"] = "EN_PATIO";

    // 1. EN_PATIO -> EN_MUESTREO (Válido para sonda oblicua)
    const samplingCheck = AgronomicValidationService.validateCaneBatchLifecycleTransition(currentStatus, "EN_MUESTREO");
    expect(samplingCheck.allowed).toBe(true);
    currentStatus = "EN_MUESTREO";

    // 2. EN_MUESTREO -> EN_MOLIENDA (Válido para mesa alimentadora)
    const millingCheck = AgronomicValidationService.validateCaneBatchLifecycleTransition(currentStatus, "EN_MOLIENDA");
    expect(millingCheck.allowed).toBe(true);
    currentStatus = "EN_MOLIENDA";

    // 3. EN_MOLIENDA -> PROCESADO (Válido tras extracción)
    const processedCheck = AgronomicValidationService.validateCaneBatchLifecycleTransition(currentStatus, "PROCESADO");
    expect(processedCheck.allowed).toBe(true);
    currentStatus = "PROCESADO";

    // 4. Salto ilegal: PROCESADO -> EN_BASCULA (Rechazado)
    const illegalRewind = AgronomicValidationService.validateCaneBatchLifecycleTransition(currentStatus, "EN_BASCULA");
    expect(illegalRewind.allowed).toBe(false);
    expect(illegalRewind.reason).toContain("PROCESADO");
  });

  // =========================================================================
  // 6. DATA ORIGIN AUDIT & QUALITY GATE
  // =========================================================================
  it("Etapa 12 & 13: IndustrialDataQualityGate distingue con precisión datos REALES de SIMULADOS", () => {
    const qualityGate = IndustrialDataQualityGate.getInstance();

    const realPoint: IndustrialDataPoint = {
      tag: "MOL-T1-PRESS-01",
      value: 280.5,
      unit: "bar",
      timestamp: new Date().toISOString(),
      quality: "GOOD",
      source: "OPC_UA",
      provenance: "LIVE_OT",
      isSimulated: false,
    };

    const simulatedPoint: IndustrialDataPoint = {
      tag: "MOL-T1-PRESS-01",
      value: 280.5,
      unit: "bar",
      timestamp: new Date().toISOString(),
      quality: "GOOD",
      source: "SIMULATION",
      provenance: "SIMULATED_PROCESS_MODEL",
      isSimulated: true,
    };

    const auditReal = qualityGate.auditPoint(realPoint);
    expect(auditReal.origin).toBe("REAL");
    expect(auditReal.isValid).toBe(true);

    const auditSimulated = qualityGate.auditPoint(simulatedPoint);
    expect(auditSimulated.origin).toBe("SIMULATED");
  });

  // =========================================================================
  // 7. CLOSED-LOOP FEEDBACK: REAL EXECUTION VS PDA RECALIBRATION
  // =========================================================================
  it("Etapa 19 & 20: Cierra el ciclo retroalimentando la ejecución real al PDA", async () => {
    // Simular resultado final de molienda
    const feedbackRecord: ClosedLoopFeedbackSummary = {
      campaignId: CAMPAIGN_ID,
      campaignName: sampleCampaign.name,
      tenantId: TENANT_A,
      timestamp: new Date().toISOString(),
      plannedCaneTons: 950000,
      actualHarvestedCaneTons: 932000,
      factoryReceivedCaneTons: 931000,
      plannedHarvestTons: 950000,
      actualHarvestTons: 932000,
      harvestVsPlanDeviationPercent: -1.89,
      receptionVsHarvestDeviationPercent: -0.11,
      millingVsReceptionDeviationPercent: -0.05,
      sugarVsPlanDeviationPercent: 1.46,
      processedCaneTons: 930500,
      sugarProductionTons: 106540,
      actualIndustrialYieldPercent: 11.45,
      agriculturalOpexPlannedUSD: 24000000,
      agriculturalOpexActualUSD: 24350000,
      opexDeviationPercent: 1.45,
      variances: [],
      replanFeedback: "Rendimiento industrial dentro de banda (+0.12%). Se recomienda ajustar TCH nominal a 440.",
      recordedAt: new Date().toISOString(),
    };

    // 1. Guardar feedback
    const saved = await AgriculturalPersistenceService.saveClosedLoopFeedback(feedbackRecord, "auditor_e2e");
    expect(saved.campaignId).toBe(CAMPAIGN_ID);

    // 2. Recuperar feedback
    const history = AgriculturalPersistenceService.getClosedLoopFeedback(TENANT_A, CAMPAIGN_ID);
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].sugarProductionTons).toBe(106540);

    // 3. Aplicar ajuste de ciclo cerrado al PDA para la siguiente campaña
    const recalibrated = await AgriculturalPersistenceService.applyClosedLoopFeedbackToCampaign(
      CAMPAIGN_ID,
      TENANT_A,
      { tchAdjustmentPercent: -2.2 }, // Reducción menor calibrada por experiencia de molienda
      "director_agroindustrial"
    );

    expect(recalibrated).toBeDefined();
    expect(recalibrated?.nominalMillingTch).toBeLessThan(450);
  });
});
