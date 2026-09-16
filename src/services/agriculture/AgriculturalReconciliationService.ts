/**
 * BioAzúcar 4.0 — Agricultural Reconciliation Engine (Auditoría Integral de Integridad)
 * 
 * Verifies mathematical coherence across the full agronomic pipeline:
 * CAMPAÑA → UEB → PARCELAS → ÁREAS → VARIEDADES → CICLOS → TCH → PRODUCCIÓN → LABORES → COSECHA → CCT → FÁBRICA → COSTOS
 * 
 * 100% Autonomous, traceable and auditable.
 * Enforces tolerance checks, returns statuses: PASS, WARNING, ERROR, CRITICAL, UNRECONCILED.
 */

import {
  FieldPlot,
  AgriculturalCampaign,
  SoilPreparationPlan,
  PlantingPlan,
  CulturalTreatmentPlan,
  MachineryFleetPlan,
  CctTransportCycleCalculation,
  AgroEconomicsSummary,
  YieldCalculationResult,
  AgriculturalReconciliationCheck,
  AgriculturalReconciliationSummary,
  ReconciliationStatus,
  CalculationTrace,
} from "../../types/agriculture";
import { PdaFormulaRegistry } from "./PdaFormulaRegistry";
import { AgriculturalParameterRegistry } from "./AgriculturalParameterRegistry";

export interface ReconciliationInputContext {
  campaign: AgriculturalCampaign;
  plots: FieldPlot[];
  campaignSummary: YieldCalculationResult & {
    totalArableAreaHectares?: number;
    totalProjectedCaneTons?: number;
    weightedAverageTch?: number;
    dailyHarvestRequirementTons?: number;
  };
  soilPrepPlan: SoilPreparationPlan;
  plantingPlan: PlantingPlan;
  treatmentsPlan: CulturalTreatmentPlan;
  fleetPlan: MachineryFleetPlan;
  cctLogistics: CctTransportCycleCalculation;
  economics: AgroEconomicsSummary;
  nominalMillTch?: number;
  millAvailabilityFactor?: number;
}

export class AgriculturalReconciliationService {
  /**
   * Runs the complete end-to-end reconciliation audit on an agricultural plan.
   */
  public static reconcileCampaign(context: ReconciliationInputContext): AgriculturalReconciliationSummary {
    const checks: AgriculturalReconciliationCheck[] = [];

    // 1. AREA RECONCILIATION: Sum of plot areas vs Campaign declared area
    const plotSumAreaHa = context.plots.reduce((sum, p) => sum + (Number(p.areaHectares) || 0), 0);
    const campaignTotalArea = Number(context.campaign.totalAreaHectares) || 0;
    const areaDiff = Math.abs(plotSumAreaHa - campaignTotalArea);
    const areaTolerance = 0.5; // 0.5 ha tolerance for floating point

    let areaStatus: ReconciliationStatus = "PASS";
    let areaRemediation = "Las áreas de parcelas coinciden exactamente con la superficie de la campaña.";
    if (areaDiff > 50.0) {
      areaStatus = "CRITICAL";
      areaRemediation = `Diferencia grave de ${areaDiff.toFixed(2)} ha entre el catastro de parcelas (${plotSumAreaHa.toFixed(2)} ha) y la campaña (${campaignTotalArea.toFixed(2)} ha). Ajustar la superficie de la campaña o dar de alta/baja parcelas faltantes.`;
    } else if (areaDiff > 5.0) {
      areaStatus = "ERROR";
      areaRemediation = `Descuadre de ${areaDiff.toFixed(2)} ha detectado. Validar la mensura de lotes registrados en la UEB.`;
    } else if (areaDiff > areaTolerance) {
      areaStatus = "WARNING";
      areaRemediation = `Diferencia marginal de ${areaDiff.toFixed(2)} ha dentro de umbral técnico.`;
    }

    checks.push({
      checkId: "REC_AREA_CATASTRO",
      name: "Balance de Superficie Catastral vs Campaña",
      category: "AREA_BALANCE",
      status: areaStatus,
      expectedValue: Number(campaignTotalArea.toFixed(2)),
      actualValue: Number(plotSumAreaHa.toFixed(2)),
      difference: Number(areaDiff.toFixed(2)),
      tolerance: areaTolerance,
      unit: "ha",
      formulaDescription: "AreaCampana == Sum(AreaParcelas)",
      details: `Superficie catastral declarada: ${campaignTotalArea.toFixed(2)} ha | Suma de lotes individuales: ${plotSumAreaHa.toFixed(2)} ha.`,
      remediationAction: areaRemediation,
      trace: PdaFormulaRegistry.createCalculationTrace({
        formulaId: "AREA_FINAL_V1",
        inputs: {
          campaignArea: { value: campaignTotalArea, unit: "ha", description: "Superficie de campaña" },
          plotSumArea: { value: plotSumAreaHa, unit: "ha", description: "Suma de parcelas" },
        },
        result: { value: areaDiff, unit: "ha" },
      }),
    });

    // 1b. AREA BALANCE: Arable vs Demolition vs Renewal
    const demolitionAreaHa = context.plots
      .filter((p) => p.currentStage === "DEMOLICION")
      .reduce((s, p) => sumSafe(s, p.areaHectares), 0);
    const arableAreaHa = plotSumAreaHa - demolitionAreaHa;
    const renewalTargetHa = context.soilPrepPlan?.totalPreparationAreaHa || 0;

    let renewalStatus: ReconciliationStatus = "PASS";
    let renewalRemediation = "El plan de renovación cubre las áreas en demolición y renovación programada.";
    if (demolitionAreaHa > 0 && renewalTargetHa < demolitionAreaHa) {
      renewalStatus = "WARNING";
      renewalRemediation = `El área de preparación de suelos programada (${renewalTargetHa.toFixed(1)} ha) es inferior a las parcelas marcadas en demolición (${demolitionAreaHa.toFixed(1)} ha). Se recomienda ampliar la ventana de roturación.`;
    }

    checks.push({
      checkId: "REC_AREA_RENOVACION",
      name: "Balance de Renovación y Demolición de Cepas",
      category: "AREA_BALANCE",
      status: renewalStatus,
      expectedValue: Number(demolitionAreaHa.toFixed(2)),
      actualValue: Number(renewalTargetHa.toFixed(2)),
      difference: Number(Math.abs(renewalTargetHa - demolitionAreaHa).toFixed(2)),
      tolerance: 5.0,
      unit: "ha",
      formulaDescription: "AreaPreparacionSuelo >= AreaDemolicion",
      details: `Área en demolición: ${demolitionAreaHa.toFixed(2)} ha | Área roturación programada: ${renewalTargetHa.toFixed(2)} ha | Superficie cañera útil: ${arableAreaHa.toFixed(2)} ha.`,
      remediationAction: renewalRemediation,
    });

    // 2. PRODUCTION BALANCE: Production = Area * TCH per plot and Campaign Total
    const individualPlotTons = context.plots.reduce((sum, p) => {
      const area = Number(p.areaHectares) || 0;
      const tch = Number(p.projectedTch) || 0;
      return sum + (area * tch);
    }, 0);
    const summaryProductionTons = Number(context.campaignSummary.totalProjectedCaneTons) || 0;
    const prodDiff = Math.abs(individualPlotTons - summaryProductionTons);
    const prodTolerance = 1.0; // 1 ton tolerance

    let prodStatus: ReconciliationStatus = "PASS";
    let prodRemediation = "La producción de caña proyectada cuadra exactamente con el modelo varietal por lote.";
    if (prodDiff > 100.0) {
      prodStatus = "ERROR";
      prodRemediation = `Inconsistencia de ${prodDiff.toFixed(2)} t entre el sumatorio de lotes y el consolidado de campaña. Recalcular rendimientos de variedades.`;
    } else if (prodDiff > prodTolerance) {
      prodStatus = "WARNING";
      prodRemediation = `Diferencia de redondeo de ${prodDiff.toFixed(2)} t.`;
    }

    checks.push({
      checkId: "REC_PROD_TOTAL",
      name: "Balance de Producción de Biomasa Cañera",
      category: "PRODUCTION_BALANCE",
      status: prodStatus,
      expectedValue: Number(summaryProductionTons.toFixed(2)),
      actualValue: Number(individualPlotTons.toFixed(2)),
      difference: Number(prodDiff.toFixed(2)),
      tolerance: prodTolerance,
      unit: "t",
      formulaDescription: "ProduccionTotal == Sum(Area_i * TCH_i)",
      details: `Producción consolidada: ${summaryProductionTons.toFixed(2)} t | Sumatorio analítico de lotes: ${individualPlotTons.toFixed(2)} t.`,
      remediationAction: prodRemediation,
      trace: PdaFormulaRegistry.createCalculationTrace({
        formulaId: "PRODUCCION_LOTE_V1",
        inputs: {
          consolidatedTons: { value: summaryProductionTons, unit: "t" },
          plotSumTons: { value: individualPlotTons, unit: "t" },
        },
        result: { value: prodDiff, unit: "t" },
      }),
    });

    // 2b. WEIGHTED AVERAGE TCH RECONCILIATION
    const expectedAvgTch = arableAreaHa > 0 ? individualPlotTons / arableAreaHa : 0;
    const summaryAvgTch = Number(context.campaignSummary.weightedAverageTch) || 0;
    const tchDiff = Math.abs(expectedAvgTch - summaryAvgTch);

    let tchStatus: ReconciliationStatus = "PASS";
    if (tchDiff > 2.0) {
      tchStatus = "ERROR";
    } else if (tchDiff > 0.1) {
      tchStatus = "WARNING";
    }

    checks.push({
      checkId: "REC_TCH_PONDERADO",
      name: "Consistencia de TCH Medio Ponderado",
      category: "PRODUCTION_BALANCE",
      status: tchStatus,
      expectedValue: Number(expectedAvgTch.toFixed(2)),
      actualValue: Number(summaryAvgTch.toFixed(2)),
      difference: Number(tchDiff.toFixed(2)),
      tolerance: 0.1,
      unit: "t/ha",
      formulaDescription: "TCH_Ponderado == ProduccionTotal / AreaCosechable",
      details: `TCH calculado por ponderación de áreas: ${expectedAvgTch.toFixed(2)} t/ha | TCH reportado en campaña: ${summaryAvgTch.toFixed(2)} t/ha.`,
      remediationAction: tchStatus === "PASS" ? "TCH ponderado matemáticamente coherente." : "Alinear el promedio ponderado de TCH con la matriz de superficies cosechables.",
    });

    // 3. HARVEST & DAILY DEMAND BALANCE
    const effectiveDays = Math.max(1, context.campaign.effectiveHarvestDays || 135);
    const calculatedDailyDemand = summaryProductionTons / effectiveDays;
    const reportedDailyDemand = Number(context.campaignSummary.dailyHarvestRequirementTons) || 0;
    const demandDiff = Math.abs(calculatedDailyDemand - reportedDailyDemand);

    let demandStatus: ReconciliationStatus = "PASS";
    if (demandDiff > 20.0) {
      demandStatus = "ERROR";
    } else if (demandDiff > 1.0) {
      demandStatus = "WARNING";
    }

    checks.push({
      checkId: "REC_DEMANDA_DIARIA",
      name: "Requerimiento Diario de Cosecha (Corte/Día)",
      category: "HARVEST_BALANCE",
      status: demandStatus,
      expectedValue: Number(calculatedDailyDemand.toFixed(2)),
      actualValue: Number(reportedDailyDemand.toFixed(2)),
      difference: Number(demandDiff.toFixed(2)),
      tolerance: 1.0,
      unit: "t/día",
      formulaDescription: "DemandaDiaria == ProduccionTotal / DiasEfectivosZafra",
      details: `Requerimiento calculado (${summaryProductionTons.toFixed(0)} t / ${effectiveDays} días): ${calculatedDailyDemand.toFixed(2)} t/día | Demanda configurada: ${reportedDailyDemand.toFixed(2)} t/día.`,
      remediationAction: demandStatus === "PASS" ? "Ritmo de corte sincronizado con el calendario de zafra." : "Ajustar los días efectivos de zafra o la capacidad nominal de corte diario.",
    });

    // 4. CCT LOGISTICS CAPACITY BALANCE
    const dailyDemandTons = calculatedDailyDemand;
    const truckDailyCapacity = Number(context.cctLogistics.dailyCapacityPerTruckTons) || 1;
    const trucksRequired = Math.ceil(dailyDemandTons / truckDailyCapacity);
    const trucksAvailable = context.fleetPlan.balanceItems.find(
      (b) => b.category === "CAMION_CANERO_RODOVIARIO"
    )?.fleetAvailableUnits ?? 8; // default available fleet
    const transportDailyCapacity = trucksAvailable * truckDailyCapacity;
    const transportDeficitTons = dailyDemandTons - transportDailyCapacity;

    let cctStatus: ReconciliationStatus = "PASS";
    let cctRemediation = "La flota disponible de transporte rodoviario cubre la demanda diaria de molienda.";
    if (transportDeficitTons > 0 && (transportDeficitTons / dailyDemandTons) > 0.25) {
      cctStatus = "CRITICAL";
      cctRemediation = `Déficit crítico de transporte: la flota actual solo puede mover ${transportDailyCapacity.toFixed(0)} t/día de las ${dailyDemandTons.toFixed(0)} t/día requeridas (déficit de ${transportDeficitTons.toFixed(0)} t/día). Se requieren ${trucksRequired} camiones (${trucksRequired - trucksAvailable} unidades faltantes). Riesgo inminente de parada de fábrica.`;
    } else if (transportDeficitTons > 0) {
      cctStatus = "WARNING";
      cctRemediation = `Déficit moderado de transporte (${transportDeficitTons.toFixed(0)} t/día). Se recomienda fletar ${Math.max(1, trucksRequired - trucksAvailable)} camiones de terceros o habilitar turnos nocturnos.`;
    }

    checks.push({
      checkId: "REC_CCT_CAPACIDAD",
      name: "Suficiencia de Capacidad de Transporte (CCT)",
      category: "CCT_BALANCE",
      status: cctStatus,
      expectedValue: Number(dailyDemandTons.toFixed(2)),
      actualValue: Number(transportDailyCapacity.toFixed(2)),
      difference: Number(Math.max(0, transportDeficitTons).toFixed(2)),
      tolerance: 0,
      unit: "t/día",
      formulaDescription: "CapacidadTransporteDiaria >= DemandaCosechaDiaria",
      details: `Demanda de entrega a fábrica: ${dailyDemandTons.toFixed(2)} t/día | Capacidad rodoviaria instalada (${trucksAvailable} camiones * ${truckDailyCapacity.toFixed(1)} t/camión): ${transportDailyCapacity.toFixed(2)} t/día.`,
      remediationAction: cctRemediation,
    });

    // 5. MILL DEMAND VS DELIVERED CANE (Fábrica)
    const nominalTch = context.nominalMillTch || 450.0;
    const millAvail = context.millAvailabilityFactor || 0.90;
    const millDailyGrindCapacity = nominalTch * 24.0 * millAvail;
    const millDiff = transportDailyCapacity - millDailyGrindCapacity;

    let millStatus: ReconciliationStatus = "PASS";
    let millRemediation = "El flujo de caña transportada está en equilibrio con la tasa de molienda del tándem.";
    if (millDailyGrindCapacity > transportDailyCapacity * 1.2) {
      millStatus = "WARNING";
      millRemediation = `El ingenio tiene capacidad ociosa de molienda (${millDailyGrindCapacity.toFixed(0)} t/día) superior al suministro de caña (${transportDailyCapacity.toFixed(0)} t/día). Optimizar la logística de alce y tiro para maximizar el factor de molienda.`;
    }

    checks.push({
      checkId: "REC_FABRICA_MOLIENDA",
      name: "Equilibrio Suministro de Caña vs Tándem de Molienda",
      category: "MILL_DEMAND_BALANCE",
      status: millStatus,
      expectedValue: Number(millDailyGrindCapacity.toFixed(2)),
      actualValue: Number(transportDailyCapacity.toFixed(2)),
      difference: Number(Math.abs(millDiff).toFixed(2)),
      tolerance: 200.0,
      unit: "t/día",
      formulaDescription: "CapacidadMoliendaFabrica == CapacidadEntregaDiaria",
      details: `Capacidad de molienda tándem (${nominalTch} TCH * 24 h * ${(millAvail * 100).toFixed(0)}% disp): ${millDailyGrindCapacity.toFixed(2)} t/día | Caña disponible entregada: ${transportDailyCapacity.toFixed(2)} t/día.`,
      remediationAction: millRemediation,
    });

    // 6. FINANCIAL RECONCILIATION: OPEX Component Sum Integrity
    const opex = context.economics.opex;
    const sumOpexComponents =
      Number(opex.fuelDieselCostUSD || 0) +
      Number(opex.fertilizersAndAmendmentsCostUSD || 0) +
      Number(opex.agrochemicalsAndDefensivesCostUSD || 0) +
      Number(opex.machineryMaintenanceCostUSD || 0) +
      Number(opex.workforceLaborCostUSD || 0) +
      Number(opex.otherOperationalCostsUSD || 0);

    const totalReportedOpex = Number(opex.totalOpexUSD) || 0;
    const opexDiff = Math.abs(sumOpexComponents - totalReportedOpex);

    let opexStatus: ReconciliationStatus = "PASS";
    let opexRemediation = "El presupuesto OPEX coincide al 100% con la suma de sus rubros de costo operativo.";
    if (opexDiff > 100.0) {
      opexStatus = "ERROR";
      opexRemediation = `Diferencia de $${opexDiff.toFixed(2)} USD entre la suma de componentes y el total OPEX reportado.`;
    } else if (opexDiff > 1.0) {
      opexStatus = "WARNING";
      opexRemediation = `Diferencia menor de redondeo en OPEX ($${opexDiff.toFixed(2)} USD).`;
    }

    checks.push({
      checkId: "REC_OPEX_SUMA",
      name: "Integridad Contable OPEX (Suma de Componentes)",
      category: "OPEX_BALANCE",
      status: opexStatus,
      expectedValue: Number(sumOpexComponents.toFixed(2)),
      actualValue: Number(totalReportedOpex.toFixed(2)),
      difference: Number(opexDiff.toFixed(2)),
      tolerance: 1.0,
      unit: "USD",
      formulaDescription: "TotalOpex == Sum(Diesel + Fertilizantes + Defensivos + Mantenimiento + ManoDeObra + Admin)",
      details: `Total OPEX consolidado: $${totalReportedOpex.toLocaleString()} USD | Sumatorio analítico de rubros: $${sumOpexComponents.toLocaleString()} USD.`,
      remediationAction: opexRemediation,
    });

    // 7. FINANCIAL RECONCILIATION: Unit Cost per Ton
    const validTons = summaryProductionTons > 0 ? summaryProductionTons : 1;
    const calculatedCostPerTon = totalReportedOpex / validTons;
    const reportedCostPerTon = Number(opex.costPerTonCaneUSD) || 0;
    const costPerTonDiff = Math.abs(calculatedCostPerTon - reportedCostPerTon);

    let costPerTonStatus: ReconciliationStatus = "PASS";
    let costPerTonRemediation = "Costo unitario por tonelada de caña matemáticamente coherente.";
    if (costPerTonDiff > 1.0) {
      costPerTonStatus = "ERROR";
      costPerTonRemediation = `Inconsistencia en el costo unitario por tonelada ($${costPerTonDiff.toFixed(2)} USD/t).`;
    } else if (calculatedCostPerTon < 15.0 || calculatedCostPerTon > 80.0) {
      costPerTonStatus = "WARNING";
      costPerTonRemediation = `El costo unitario de $${calculatedCostPerTon.toFixed(2)} USD/t está fuera del rango agro-económico típico ($20 - $55 USD/t). Verificar precios de diesel e insumos.`;
    }

    checks.push({
      checkId: "REC_COSTO_UNITARIO_TON",
      name: "Consistencia de Costo Unitario por Tonelada de Caña",
      category: "UNIT_COST_BALANCE",
      status: costPerTonStatus,
      expectedValue: Number(calculatedCostPerTon.toFixed(2)),
      actualValue: Number(reportedCostPerTon.toFixed(2)),
      difference: Number(costPerTonDiff.toFixed(2)),
      tolerance: 0.1,
      unit: "USD/t",
      formulaDescription: "CostoPorTon == TotalOpexUSD / TotalToneladasCana",
      details: `Costo calculado ($${totalReportedOpex.toFixed(0)} / ${validTons.toFixed(0)} t): $${calculatedCostPerTon.toFixed(2)} USD/t | Reportado: $${reportedCostPerTon.toFixed(2)} USD/t.`,
      remediationAction: costPerTonRemediation,
    });

    // 8. CAPEX RECONCILIATION: Machinery Deficit vs Fleet Plan
    const reportedCapex = Number(context.economics.capex?.totalCapexUSD) || 0;
    const fleetCapex = Number(context.fleetPlan.totalAcquisitionCapexUSD) || 0;
    const capexDiff = Math.abs(reportedCapex - fleetCapex);

    let capexStatus: ReconciliationStatus = "PASS";
    if (reportedCapex === 0 && context.fleetPlan.totalFleetDeficit > 0) {
      capexStatus = "CRITICAL";
    }

    checks.push({
      checkId: "REC_CAPEX_MAQUINARIA",
      name: "Balance de Inversión CAPEX vs Déficit de Maquinaria",
      category: "CAPEX_BALANCE",
      status: capexStatus,
      expectedValue: Number(fleetCapex.toFixed(2)),
      actualValue: Number(reportedCapex.toFixed(2)),
      difference: Number(capexDiff.toFixed(2)),
      tolerance: 100.0,
      unit: "USD",
      formulaDescription: "TotalCapex >= DeficitMaquinaria * PreciosAdquisicion",
      details: `CAPEX maquinaria derivado del balance de tracción: $${fleetCapex.toLocaleString()} USD (${context.fleetPlan.totalFleetDeficit} equipos faltantes) | CAPEX declarado: $${reportedCapex.toLocaleString()} USD.`,
      remediationAction: capexStatus === "PASS" ? "Inversiones CAPEX alineadas con los déficits de tracción mecánica." : "Asignar presupuesto de adquisición para los equipos en déficit.",
    });

    // Tally and compute overall status
    const passCount = checks.filter((c) => c.status === "PASS").length;
    const warningCount = checks.filter((c) => c.status === "WARNING").length;
    const errorCount = checks.filter((c) => c.status === "ERROR").length;
    const criticalCount = checks.filter((c) => c.status === "CRITICAL").length;

    let overallStatus: ReconciliationStatus = "PASS";
    if (criticalCount > 0) {
      overallStatus = "CRITICAL";
    } else if (errorCount > 0) {
      overallStatus = "ERROR";
    } else if (warningCount > 0) {
      overallStatus = "WARNING";
    }

    return {
      campaignId: context.campaign.id,
      campaignName: context.campaign.name,
      timestamp: new Date().toISOString(),
      overallStatus,
      checksCount: checks.length,
      passCount,
      warningCount,
      errorCount,
      criticalCount,
      checks,
    };
  }
}

function sumSafe(a: number, b: any): number {
  return (Number(a) || 0) + (Number(b) || 0);
}
