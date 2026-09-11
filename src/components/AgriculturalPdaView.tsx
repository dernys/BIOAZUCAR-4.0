/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Executive View (PDA Audit & Governance)
 * Model: Plano de Desenvolvimento Agrícola (PDA_set30_rev2014_v1.ods)
 * 
 * Audited Architecture:
 * 1. Categorization & Governance of Parameters:
 *    - CONFIRMADO: Fórmulas y celdas ODS auditadas matemáticamente.
 *    - REQUIERE_VALIDACION: Parámetros agronómicos que requieren calibración en campo/ingenio real.
 *    - CONFIGURABLE: Variables económicas o logísticas que fluctúan por zafra y mercado.
 * 2. Complete Traceability: ISA-95 Level 4 audit trace with exact ODS coordinates.
 * 3. Bidirectional Industrial Flows:
 *    - Harvested plots dispatch to Mill Reception -> creates real CaneBatch in cane_batches.
 *    - Agricultural machinery prep -> generates Preventive Work Orders in work_orders.
 * 4. Error Immunization: Safe number coercion (no undefined.toFixed crashes) and unique list keys.
 */

import React, { useState, useMemo, useEffect } from "react";
import {
  Tractor,
  Sprout,
  Wheat,
  Truck,
  DollarSign,
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  RefreshCw,
  Sliders,
  ChevronRight,
  ShieldCheck,
  Fuel,
  Maximize2,
  X,
  Droplets,
  Edit3,
  Save,
  Check,
  ArrowRight,
  Activity,
  Plus,
  Search,
  Filter,
  SlidersHorizontal,
  FileText,
  BadgeAlert,
  Trash2,
  Download,
  Calculator,
} from "lucide-react";
import {
  FieldPlot,
  AgriculturalCampaign,
  CalculationTrace,
  EquipmentCategory,
  AgriculturalParameter,
  ValidationStatus,
  AgroParameterCategory,
  CaneVarietyYieldMaster,
} from "../types/agriculture";
import { CaneBatch, WorkOrder } from "../types";
import {
  YieldCalculationService,
  COMMERCIAL_VARIETIES_CATALOG,
} from "../services/agriculture/YieldCalculationService";
import { AgriculturalPlanningService } from "../services/agriculture/AgriculturalPlanningService";
import {
  MachineryAndLogisticsService,
  BENCHMARK_ACQUISITION_PRICES_USD,
} from "../services/agriculture/MachineryAndLogisticsService";
import {
  AgroEconomicsService,
  BENCHMARK_ECONOMIC_PRICES,
} from "../services/agriculture/AgroEconomicsService";
import {
  AgriculturalParameterRegistry,
} from "../services/agriculture/AgriculturalParameterRegistry";
import {
  AgriculturalPersistenceService,
} from "../services/agriculture/AgriculturalPersistenceService";
import {
  INITIAL_AGRICULTURAL_CAMPAIGN,
  INITIAL_FIELD_PLOTS,
} from "../data/mockAgriculturalData";
import { PlotModal } from "./agriculture/PlotModal";
import { VarietyModal } from "./agriculture/VarietyModal";
import { CampaignModal } from "./agriculture/CampaignModal";
import { ParameterModal } from "./agriculture/ParameterModal";
import { FormulaViewerModal } from "./agriculture/FormulaViewerModal";

interface AgriculturalPdaViewProps {
  theme?: "dark" | "light";
  currentTenantName?: string;
  nominalMillTch?: number; // e.g. 450 t/h from SCADA
  onBatchDispatched?: (batch: CaneBatch) => void;
  onWorkOrderCreated?: (wo: WorkOrder) => void;
}

type SubTab = "plots" | "varieties" | "operations" | "fleet_cct" | "economics" | "governance";

/**
 * Universal safe number formatter to prevent runtime undefined.toFixed() crashes
 */
function safeFixed(val: number | null | undefined, digits: number = 2, fallback: string = "0.00"): string {
  if (val == null || typeof val !== "number" || Number.isNaN(val)) return fallback;
  return val.toFixed(digits);
}

function safeNum(val: number | null | undefined, fallback: number = 0): number {
  if (val == null || typeof val !== "number" || Number.isNaN(val)) return fallback;
  return val;
}

export const AgriculturalPdaView: React.FC<AgriculturalPdaViewProps> = ({
  theme = "dark",
  currentTenantName = "Central Azucarero Principal",
  nominalMillTch = 450.0,
  onBatchDispatched,
  onWorkOrderCreated,
}) => {
  const isLight = theme === "light";

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("plots");
  const [plots, setPlots] = useState<FieldPlot[]>(INITIAL_FIELD_PLOTS);
  const [campaign, setCampaign] = useState<AgriculturalCampaign>(
    () => AgriculturalPersistenceService.getLocalCachedCampaign() || INITIAL_AGRICULTURAL_CAMPAIGN
  );

  // Dynamic Varieties Catalog state
  const [varieties, setVarieties] = useState<CaneVarietyYieldMaster[]>(() => {
    return Object.values(AgriculturalParameterRegistry.getVarietyCatalog());
  });

  // Modal dialog states
  const [isPlotModalOpen, setIsPlotModalOpen] = useState(false);
  const [editingPlot, setEditingPlot] = useState<FieldPlot | null>(null);

  const [isVarietyModalOpen, setIsVarietyModalOpen] = useState(false);
  const [editingVariety, setEditingVariety] = useState<CaneVarietyYieldMaster | null>(null);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);

  const [isParamModalOpen, setIsParamModalOpen] = useState(false);
  const [editingParamCustom, setEditingParamCustom] = useState<AgriculturalParameter | null>(null);

  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);

  // Parameters governance state
  const [parameters, setParameters] = useState<AgriculturalParameter[]>(() =>
    AgriculturalParameterRegistry.getAllParameters()
  );
  const [governanceCategoryFilter, setGovernanceCategoryFilter] = useState<string>("ALL");
  const [governanceStatusFilter, setGovernanceStatusFilter] = useState<string>("ALL");
  const [governanceSearch, setGovernanceSearch] = useState<string>("");
  const [editingParam, setEditingParam] = useState<AgriculturalParameter | null>(null);
  const [paramEditValue, setParamEditValue] = useState<string>("");
  const [notificationMsg, setNotificationMsg] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // Filter states for plots
  const [selectedUeb, setSelectedUeb] = useState<string>("ALL");
  const [selectedVariety, setSelectedVariety] = useState<string>("ALL");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");

  // What-If Simulation controls
  const [climateImpactFactor, setClimateImpactFactor] = useState<number>(1.0); // 0.85 to 1.15
  const [dieselPriceUSD, setDieselPriceUSD] = useState<number>(BENCHMARK_ECONOMIC_PRICES.DIESEL_USD_PER_LITER);
  const [cctDistanceKm, setCctDistanceKm] = useState<number>(36.0); // round-trip km

  // Trace modal inspection
  const [selectedTrace, setSelectedTrace] = useState<CalculationTrace | null>(null);

  // Subscribe to real-time parameters and plots
  useEffect(() => {
    const unsubParams = AgriculturalPersistenceService.subscribeToParameters(
      campaign.tenantId,
      (updatedParams) => {
        setParameters(updatedParams);
      }
    );

    const unsubPlots = AgriculturalPersistenceService.subscribeToFieldPlots(
      campaign.tenantId,
      (updatedPlots) => {
        setPlots(updatedPlots);
      }
    );

    return () => {
      unsubParams();
      unsubPlots();
    };
  }, [campaign.tenantId]);

  // Derived filtered plots
  const filteredPlots = useMemo(() => {
    return plots.filter((plot) => {
      const matchUeb = selectedUeb === "ALL" || plot.uebName === selectedUeb;
      const matchVariety = selectedVariety === "ALL" || plot.varietyCode === selectedVariety;
      const matchStage = selectedStage === "ALL" || plot.currentStage === selectedStage;
      return matchUeb && matchVariety && matchStage;
    });
  }, [plots, selectedUeb, selectedVariety, selectedStage]);

  // Campaign Consolidation
  const campaignSummary = useMemo(() => {
    const summary = YieldCalculationService.calculateCampaignYieldSummary(plots);
    const dailyDemand =
      campaign.effectiveHarvestDays > 0
        ? (summary.totalProductionTons ?? 0) / campaign.effectiveHarvestDays
        : 0;
    return {
      ...summary,
      totalArableAreaHectares: safeNum(summary.totalAreaHa),
      totalProjectedCaneTons: safeNum(summary.totalProductionTons),
      weightedAverageTch: safeNum(summary.averageTch),
      dailyHarvestRequirementTons: safeNum(dailyDemand),
    };
  }, [campaign, plots]);

  // Operational plans
  const soilPrepPlan = useMemo(() => {
    const renewalArea = plots
      .filter((p) => p.currentStage === "DEMOLICION" || p.currentStage === "PLANTA")
      .reduce((sum, p) => sum + safeNum(p.areaHectares), 0);
    return AgriculturalPlanningService.planSoilPreparation({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      targetPreparationAreaHa: renewalArea > 0 ? renewalArea : 230.0,
      availableCalendarDays: 60,
    });
  }, [campaign, plots]);

  const plantingPlan = useMemo(() => {
    return AgriculturalPlanningService.planPlanting({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      targetPlantingAreaHa: safeNum(soilPrepPlan.totalPreparationAreaHa, 230.0),
    });
  }, [campaign, soilPrepPlan]);

  const culturalTreatmentsPlan = useMemo(() => {
    const plantArea = plots
      .filter((p) => p.currentStage === "PLANTA")
      .reduce((sum, p) => sum + safeNum(p.areaHectares), 0);
    const ratoonArea = plots
      .filter((p) => p.currentStage.startsWith("RETONO") || p.currentStage === "SOCA")
      .reduce((sum, p) => sum + safeNum(p.areaHectares), 0);

    return AgriculturalPlanningService.planCulturalTreatments({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      plantCaneAreaHa: plantArea > 0 ? plantArea : 260.0,
      ratoonCaneAreaHa: ratoonArea > 0 ? ratoonArea : 850.0,
      vinasseApplicationRateM3PerHa: 150.0,
      filterCakeApplicationRateTonsPerHa: 30.0,
    });
  }, [campaign, plots]);

  // Fleet balance items & consolidation
  const fleetPlan = useMemo(() => {
    const heavyTractorItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_PESADO",
      description: "Tractores Pesados 210 HP (Subsolado & Arado Profundo)",
      totalWorkloadHours: safeNum(soilPrepPlan.totalMachineHours) * 0.55,
      workingWindowDays: 60,
      dailyOperatingHours: 16,
      fleetAvailableUnits: 2,
    });

    const mediumTractorItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_MEDIO",
      description: "Tractores Medios 140 HP (Grada, Surcado & Tratos Culturales)",
      totalWorkloadHours: safeNum(culturalTreatmentsPlan.totalMachineHours) * 0.45,
      workingWindowDays: 90,
      dailyOperatingHours: 16,
      fleetAvailableUnits: 4,
    });

    const harvesterItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "COSECHADORA_COMBINADA",
      description: "Cosechadoras Combinadas de Caña Picada 350 HP",
      totalWorkloadHours: safeNum(campaignSummary.totalProjectedCaneTons) / 52.0, // 52 t/h effective capacity
      workingWindowDays: campaign.effectiveHarvestDays,
      dailyOperatingHours: 18,
      mechanicalAvailabilityRatio: 0.82,
      fleetAvailableUnits: 2,
    });

    const transloaderItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_TRANSBORDO",
      description: "Conjunto Tractor + Vagón Transbordo 14 t",
      totalWorkloadHours: (safeNum(campaignSummary.totalProjectedCaneTons) / 52.0) * 1.3,
      workingWindowDays: campaign.effectiveHarvestDays,
      dailyOperatingHours: 18,
      fleetAvailableUnits: 3,
    });

    return MachineryAndLogisticsService.consolidateFleetPlan({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      balanceItems: [heavyTractorItem, mediumTractorItem, harvesterItem, transloaderItem],
    });
  }, [campaign, soilPrepPlan, culturalTreatmentsPlan, campaignSummary]);

  // CCT Transport calculation
  const cctLogistics = useMemo(() => {
    const dailyDemand = safeNum(campaignSummary.dailyHarvestRequirementTons);
    return MachineryAndLogisticsService.calculateTransportCycle({
      roundTripDistanceKm: cctDistanceKm,
      dailyHarvestDemandTons: dailyDemand,
      averageSpeedEmptyKmH: 45.0,
      averageSpeedLoadedKmH: 32.0,
      loadingInFieldTimeHours: 0.45,
      unloadingAtMillTimeHours: 0.35,
      fieldQueueTimeHours: 0.15,
      millWeighbridgeQueueTimeHours: 0.20,
      payloadTonsPerTruck: 45.0,
      dailyUtilizationFactor: 0.80,
    });
  }, [cctDistanceKm, campaignSummary]);

  // Economics
  const economics = useMemo(() => {
    return AgroEconomicsService.consolidateCampaignEconomics({
      tenantId: campaign.tenantId,
      campaignId: campaign.id,
      totalArableAreaHa: safeNum(campaignSummary.totalArableAreaHectares),
      totalCaneTonsDelivered: safeNum(campaignSummary.totalProjectedCaneTons) * climateImpactFactor,
      soilPrepPlan,
      plantingPlan,
      treatmentsPlan: culturalTreatmentsPlan,
      fleetPlan,
      customDieselPriceUSD: dieselPriceUSD,
    });
  }, [
    campaign,
    campaignSummary,
    climateImpactFactor,
    soilPrepPlan,
    plantingPlan,
    culturalTreatmentsPlan,
    fleetPlan,
    dieselPriceUSD,
  ]);

  // Variety decay curve reference from dynamic varieties catalog
  const varietyCatalogList = varieties;

  // Plot CRUD handlers
  const handleSavePlot = async (savedPlot: FieldPlot) => {
    // Recalculate projected TCH and Tons with the latest variety & soil factors
    const varietyObj = varieties.find((v) => v.varietyCode === savedPlot.varietyCode);
    const base = varietyObj?.baseYieldTch || savedPlot.historicalAverageTch || 90;
    const decay = varietyObj?.ratoonDecayFactors?.[savedPlot.currentStage] ?? 1.0;
    const soil = savedPlot.soilType === "FRANCO" ? 1.0 : savedPlot.soilType === "ARCILLOSO" ? 0.98 : 0.92;
    const tch = Number((base * decay * soil).toFixed(1));
    const tons = Number((savedPlot.areaHectares * tch).toFixed(1));

    const enrichedPlot: FieldPlot = {
      ...savedPlot,
      projectedTch: tch,
      projectedTotalCaneTons: tons,
    };

    const exists = plots.some((p) => p.id === enrichedPlot.id);
    const updatedPlots = exists
      ? plots.map((p) => (p.id === enrichedPlot.id ? enrichedPlot : p))
      : [enrichedPlot, ...plots];

    setPlots(updatedPlots);
    await AgriculturalPersistenceService.saveFieldPlot(enrichedPlot);

    setNotificationMsg({
      text: `Parcela ${enrichedPlot.code} guardada con éxito (${enrichedPlot.areaHectares} ha, ${enrichedPlot.projectedTch} t/ha).`,
      type: "success",
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleDeletePlot = async (plotId: string, plotCode: string) => {
    if (window.confirm(`¿Estás seguro de eliminar el lote ${plotCode}? Esta acción no se puede deshacer.`)) {
      const updatedPlots = plots.filter((p) => p.id !== plotId);
      setPlots(updatedPlots);
      await AgriculturalPersistenceService.deleteFieldPlot(plotId);
      setNotificationMsg({
        text: `Lote ${plotCode} eliminado correctamente del catastro.`,
        type: "info",
      });
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Variety CRUD handlers
  const handleSaveVariety = async (savedVariety: CaneVarietyYieldMaster) => {
    const exists = varieties.some((v) => v.varietyCode === savedVariety.varietyCode);
    const updated = exists
      ? varieties.map((v) => (v.varietyCode === savedVariety.varietyCode ? savedVariety : v))
      : [...varieties, savedVariety];

    setVarieties(updated);
    AgriculturalParameterRegistry.registerCustomVariety(savedVariety);
    await AgriculturalPersistenceService.saveVariety(savedVariety, campaign.tenantId);

    // Re-evaluate plot yields with new variety curves
    const reCalculatedPlots = YieldCalculationService.calculatePlotYields(plots);
    setPlots(reCalculatedPlots);

    setNotificationMsg({
      text: `Variedad ${savedVariety.varietyCode} guardada y curvas de decaimiento actualizadas.`,
      type: "success",
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  const handleDeleteVariety = async (varCode: string) => {
    if (window.confirm(`¿Estás seguro de eliminar la variedad ${varCode}?`)) {
      const updated = varieties.filter((v) => v.varietyCode !== varCode);
      setVarieties(updated);
      await AgriculturalPersistenceService.deleteVariety(varCode, campaign.tenantId);
      setNotificationMsg({
        text: `Variedad ${varCode} eliminada del catálogo activo.`,
        type: "info",
      });
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Campaign Update handler
  const handleSaveCampaign = async (updatedCamp: AgriculturalCampaign) => {
    setCampaign(updatedCamp);
    await AgriculturalPersistenceService.saveCampaign(updatedCamp);
    setNotificationMsg({
      text: `Configuración de Zafra actualizada (${updatedCamp.name}, ${updatedCamp.effectiveHarvestDays} días).`,
      type: "success",
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Custom Parameter Save handler
  const handleSaveParameterCustom = async (savedParam: AgriculturalParameter) => {
    await AgriculturalPersistenceService.saveParameter(savedParam);
    AgriculturalParameterRegistry.registerCustomParameter(savedParam);
    setParameters(AgriculturalParameterRegistry.getAllParameters());
    setNotificationMsg({
      text: `Parámetro ${savedParam.key} guardado (${savedParam.value} ${savedParam.unit}).`,
      type: "success",
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Export Catastro to JSON
  const handleExportCatastro = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plots, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `catastro_lotes_zafra_${campaign.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtered parameters for governance table
  const filteredParameters = useMemo(() => {
    return parameters.filter((p) => {
      const matchCat = governanceCategoryFilter === "ALL" || p.category === governanceCategoryFilter;
      const matchStatus = governanceStatusFilter === "ALL" || p.validationStatus === governanceStatusFilter;
      const matchSearch =
        governanceSearch.trim() === "" ||
        p.key.toLowerCase().includes(governanceSearch.toLowerCase()) ||
        p.name.toLowerCase().includes(governanceSearch.toLowerCase()) ||
        p.sourceSheet.toLowerCase().includes(governanceSearch.toLowerCase());
      return matchCat && matchStatus && matchSearch;
    });
  }, [parameters, governanceCategoryFilter, governanceStatusFilter, governanceSearch]);

  // Parameters audit statistics
  const parameterStats = useMemo(() => {
    const total = parameters.length;
    const confirmed = parameters.filter((p) => p.validationStatus === "CONFIRMADO").length;
    const requiresVal = parameters.filter((p) => p.validationStatus === "REQUIERE_VALIDACION").length;
    const configurable = parameters.filter((p) => p.validationStatus === "CONFIGURABLE").length;
    return { total, confirmed, requiresVal, configurable };
  }, [parameters]);

  // Handle saving an edited parameter
  const handleSaveParam = async () => {
    if (!editingParam) return;
    const numVal = parseFloat(paramEditValue);
    if (isNaN(numVal)) {
      setNotificationMsg({ text: "El valor numérico no es válido", type: "error" });
      return;
    }

    const updated: AgriculturalParameter = {
      ...editingParam,
      value: numVal,
    };

    await AgriculturalPersistenceService.saveParameter(updated);
    setEditingParam(null);
    setNotificationMsg({
      text: `Parámetro ${updated.key} actualizado correctamente (${updated.value} ${updated.unit})`,
      type: "success",
    });
    setTimeout(() => setNotificationMsg(null), 4000);
  };

  // Reset parameters
  const handleResetParameters = async () => {
    if (window.confirm("¿Restablecer todos los parámetros agrícolas a los valores canónicos del ODS PDA?")) {
      await AgriculturalPersistenceService.resetParametersToCanonical(campaign.tenantId);
      setNotificationMsg({ text: "Parámetros restablecidos al modelo canónico PDA", type: "info" });
      setTimeout(() => setNotificationMsg(null), 4000);
    }
  };

  // Dispatch plot harvest to Mill (Industry integration)
  const handleDispatchHarvest = async (plot: FieldPlot) => {
    const tonsToDispatch = safeNum(plot.projectedTotalCaneTons, plot.areaHectares * (plot.projectedTch || 80));
    try {
      const newBatch = await AgriculturalPersistenceService.dispatchHarvestPlotToFactory(plot, tonsToDispatch);
      if (onBatchDispatched) {
        onBatchDispatched(newBatch);
      }
      setNotificationMsg({
        text: `Lote ${plot.code} cosechado y despachado con éxito. Lote de caña ${newBatch.batchCode} (${newBatch.netWeightTons} t) en patio de recepción.`,
        type: "success",
      });
      setTimeout(() => setNotificationMsg(null), 5000);
    } catch (err) {
      setNotificationMsg({ text: "Error al despachar lote de caña a fábrica", type: "error" });
    }
  };

  // Generate CMMS Work Orders
  const handleGenerateWorkOrders = async () => {
    try {
      const wo = await AgriculturalPersistenceService.generateAgriculturalWorkOrders(
        campaign.id,
        "PREPARACION_SUELO",
        "Subsolado y Roturación de Campo",
        "Ing. Mecanización Agrícola",
        campaign.tenantId
      );
      if (onWorkOrderCreated) {
        onWorkOrderCreated(wo);
      }
      setNotificationMsg({
        text: `Orden de Mantenimiento CMMS generada: ${wo.title} (${wo.equipmentId})`,
        type: "success",
      });
      setTimeout(() => setNotificationMsg(null), 5000);
    } catch (err) {
      setNotificationMsg({ text: "Error al generar orden de trabajo CMMS", type: "error" });
    }
  };

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isLight ? "bg-slate-50 text-slate-800" : "bg-slate-950 text-slate-100"}`}>
      {/* Toast Notification Banner */}
      {notificationMsg && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
            notificationMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : notificationMsg.type === "error"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
              : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}
        >
          <div className="flex items-center gap-2">
            {notificationMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : notificationMsg.type === "error" ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span className="font-medium">{notificationMsg.text}</span>
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Campaign Info */}
      <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/90 border-slate-800"}`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Tractor className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Plan de Desarrollo Agrícola (PDA) & Inteligencia de Campo 4.0
              </h1>
            </div>
            <p className="text-xs text-slate-400">
              {currentTenantName} • Campaña: <span className="text-slate-200 font-semibold">{campaign.name}</span> • 
              <span className="text-emerald-400 font-semibold ml-1">Motor Dinámico Abierto de Fórmulas & Parámetros</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsFormulaModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                  : "bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
              }`}
            >
              <Calculator className="w-4 h-4 text-violet-400" />
              <span>Ecuaciones & Fórmulas</span>
            </button>

            <button
              onClick={() => setIsCampaignModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100"
                  : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
              }`}
            >
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Configurar Zafra ({campaign.effectiveHarvestDays}d)</span>
            </button>

            <button
              onClick={() => setSelectedTrace(campaignSummary.trace)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  : "bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Trazabilidad</span>
            </button>

            <button
              onClick={() => setActiveSubTab("governance")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Gestor Parámetros ({parameterStats.requiresVal > 0 ? `${parameterStats.requiresVal} por validar` : `${parameters.length} total`})</span>
            </button>
          </div>
        </div>

        {/* Global Executive Metric KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-4 border-t border-slate-800/60">
          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Área Cañera Total</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-slate-100">
                {safeNum(campaignSummary.totalArableAreaHectares).toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </span>
              <span className="text-xs text-slate-500">ha</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Producción Caña</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-emerald-500">
                {(safeNum(campaignSummary.totalProjectedCaneTons) * climateImpactFactor).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-500">t</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">TCH Ponderado</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono">
                {safeFixed(safeNum(campaignSummary.weightedAverageTch) * climateImpactFactor, 2)}
              </span>
              <span className="text-xs text-slate-500">t/ha</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Demanda Molienda</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-amber-500">
                {safeNum(campaignSummary.dailyHarvestRequirementTons).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-500">t/día</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Flota Camiones CCT</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-blue-400">
                {safeNum(cctLogistics.trucksRequiredForDailyDemand, 1)}
              </span>
              <span className="text-xs text-slate-500">unidades</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Costo Directo OPEX</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-emerald-400">
                ${safeFixed(economics?.opex?.costPerTonCaneUSD, 2)}
              </span>
              <span className="text-xs text-slate-500">/t caña</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
        {[
          { id: "plots", label: "Catastro de Lotes & Cosecha", icon: Wheat },
          { id: "varieties", label: "Variedades & Decaimiento", icon: Sprout },
          { id: "operations", label: "Preparación, Siembra & Tratos", icon: Tractor },
          { id: "fleet_cct", label: "Flota & Logística CCT", icon: Truck },
          { id: "economics", label: "Agro-Economía & CAPEX", icon: DollarSign },
          { id: "governance", label: "Gestor de Fórmulas & Parámetros", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={`tab-${tab.id}`}
              onClick={() => setActiveSubTab(tab.id as SubTab)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                isActive
                  ? isLight
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : isLight
                  ? "text-slate-600 hover:bg-slate-200"
                  : "text-slate-400 hover:bg-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.id === "governance" && parameterStats.requiresVal > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {parameterStats.requiresVal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: Field Plots & Biological Decay */}
      {activeSubTab === "plots" && (
        <div className="space-y-6">
          {/* Variety Reference Decay Box */}
          <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wheat className="w-4 h-4 text-emerald-500" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                  Curvas de Decaimiento Biológico por Variedad (ODS Sheets: 'TCH' & 'EVOLUÇÃO tch por cepa')
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Modelo determinista de retención de productividad por corte sucesivo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {varietyCatalogList.map((variety) => (
                <div
                  key={`var-${variety.varietyCode}`}
                  className={`p-3.5 rounded-lg border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/70 border-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{variety.varietyCode}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      TCH Base: {safeFixed(variety.baseYieldTch, 1)} t/ha
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{variety.name}</p>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Planta / Soca Q1:</span>
                      <span className="font-mono font-medium">100% → 90%</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Retoño Q3 / Q5:</span>
                      <span className="font-mono font-medium">78% → 60%</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Retoño Q7+:</span>
                      <span className="font-mono text-rose-400 font-medium">
                        {safeFixed((variety.ratoonDecayFactors?.RETONO_Q7_PLUS ?? 0.52) * 100, 0)}% (Demolición)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action & Filters Bar */}
          <div className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-400">Filtrar Lotes:</span>
              
              <select
                value={selectedUeb}
                onChange={(e) => setSelectedUeb(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todas las Divisiones / UEBs</option>
                <option value="División Agrícola Norte">División Agrícola Norte</option>
                <option value="División Agrícola Centro">División Agrícola Centro</option>
                <option value="División Agrícola Sur">División Agrícola Sur</option>
              </select>

              <select
                value={selectedVariety}
                onChange={(e) => setSelectedVariety(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todas las Variedades</option>
                {varieties.map((v) => (
                  <option key={v.varietyCode} value={v.varietyCode}>
                    {v.varietyCode} — {v.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStage}
                onChange={(e) => setSelectedStage(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todas las Etapas del Ciclo</option>
                <option value="PLANTA">Caña Planta (Año 1)</option>
                <option value="SOCA">Soca (Año 2)</option>
                <option value="RETONO_Q2">Retoño Q2 (Año 3)</option>
                <option value="RETONO_Q3">Retoño Q3 (Año 4)</option>
                <option value="RETONO_Q4">Retoño Q4 (Año 5)</option>
                <option value="RETONO_Q5">Retoño Q5 (Año 6)</option>
                <option value="RETONO_Q6">Retoño Q6 (Año 7)</option>
                <option value="RETONO_Q7_PLUS">Retoño Q7+ (Año 8+)</option>
                <option value="DEMOLICION">Demolición / Renovación</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCatastro}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                title="Descargar Catastro de Lotes en JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Catastro</span>
              </button>

              <button
                onClick={() => {
                  setEditingPlot(null);
                  setIsPlotModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir Lote / Parcela</span>
              </button>
            </div>
          </div>

          {/* Plots Table */}
          <div className={`overflow-x-auto rounded-xl border ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-semibold ${isLight ? "bg-slate-100/70 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"}`}>
                  <th className="p-3">Código Lote</th>
                  <th className="p-3">División / UEB</th>
                  <th className="p-3">Área (ha)</th>
                  <th className="p-3">Variedad</th>
                  <th className="p-3">Etapa Ciclo</th>
                  <th className="p-3">Suelo</th>
                  <th className="p-3">Distancia (km)</th>
                  <th className="p-3">TCH Proyectado</th>
                  <th className="p-3">Caña Total (t)</th>
                  <th className="p-3">Estado / Alerta</th>
                  <th className="p-3 text-center">Acciones & Cosecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredPlots.map((plot, idx) => {
                  const isDemolitionCandidate =
                    plot.currentStage === "DEMOLICION" ||
                    plot.currentStage === "RETONO_Q7_PLUS" ||
                    (plot.projectedTch != null && plot.projectedTch < 50.0);

                  return (
                    <tr
                      key={`plot-${plot.id || plot.code || idx}`}
                      className={`hover:bg-slate-800/30 transition ${
                        isDemolitionCandidate ? (isLight ? "bg-rose-50/50" : "bg-rose-950/20") : ""
                      }`}
                    >
                      <td className="p-3 font-mono font-bold">{plot.code}</td>
                      <td className="p-3 text-slate-400">{plot.uebName}</td>
                      <td className="p-3 font-mono">{safeFixed(plot.areaHectares, 1)}</td>
                      <td className="p-3 font-medium text-emerald-400">{plot.varietyCode}</td>
                      <td className="p-3">
                        <span className="font-medium">{plot.currentStage}</span>
                        <span className="text-[10px] text-slate-500 block">Año {plot.ratoonAgeYears}</span>
                      </td>
                      <td className="p-3 text-slate-400">{plot.soilType}</td>
                      <td className="p-3 font-mono">{safeFixed(plot.distanceToMillKm, 1)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {plot.projectedTch != null ? safeFixed(plot.projectedTch, 1) : "—"}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {plot.projectedTotalCaneTons != null
                          ? safeNum(plot.projectedTotalCaneTons).toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                      <td className="p-3">
                        {plot.status === "COSECHADO" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Cosechado
                          </span>
                        ) : isDemolitionCandidate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Renovación Sugerida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Óptimo
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {plot.status !== "COSECHADO" ? (
                            <button
                              onClick={() => handleDispatchHarvest(plot)}
                              title="Despachar caña a báscula de fábrica (CaneBatch)"
                              className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1 transition"
                            >
                              <Truck className="w-3 h-3" />
                              <span>Cosechar</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">En Patio Molienda</span>
                          )}

                          <button
                            onClick={() => {
                              setEditingPlot(plot);
                              setIsPlotModalOpen(true);
                            }}
                            title="Editar Parámetros del Lote"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeletePlot(plot.id, plot.code)}
                            title="Eliminar Lote del Catastro"
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => setSelectedTrace(plot.trace)}
                            title="Auditar cálculo ODS"
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB: Varieties & Biological Decay Curves */}
      {activeSubTab === "varieties" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div>
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Sprout className="w-4 h-4 text-lime-400" />
                <span>Catálogo Activo de Variedades de Caña y Curvas de Decaimiento</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Modifica el TCH base de cada cultivar, sus propiedades agroindustriales (Pol, Pureza, Fibra) y la curva de retención vegetativa por corte.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingVariety(null);
                setIsVarietyModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-lime-500 hover:bg-lime-400 text-black text-xs font-bold flex items-center gap-1.5 transition shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Variedad</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {varieties.map((variety) => {
              const f = variety.ratoonDecayFactors;
              return (
                <div
                  key={`var-card-${variety.varietyCode}`}
                  className={`p-4 rounded-xl border transition-all ${
                    isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/90 border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold font-mono text-sm text-lime-400">{variety.varietyCode}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">
                          {variety.maturity}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{variety.name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingVariety(variety);
                          setIsVarietyModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Editar Variedad"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {varieties.length > 1 && (
                        <button
                          onClick={() => handleDeleteVariety(variety.varietyCode)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                          title="Eliminar Variedad"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Agroindustrial specs */}
                  <div className="grid grid-cols-3 gap-2 my-3 p-2.5 rounded-lg bg-slate-950/50 text-center text-xs font-mono">
                    <div>
                      <span className="text-slate-500 text-[10px] block">TCH Base</span>
                      <span className="font-bold text-slate-200">{safeFixed(variety.baseYieldTch, 1)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Pol %</span>
                      <span className="font-bold text-amber-400">{safeFixed(variety.polPercent, 1)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Pureza %</span>
                      <span className="font-bold text-cyan-400">{safeFixed(variety.purityPercent, 1)}%</span>
                    </div>
                  </div>

                  {/* Decay curve visualization */}
                  <div className="space-y-1.5 text-xs">
                    <span className="text-[11px] font-semibold text-slate-400 block">Factores de Decaimiento por Cepa:</span>
                    <div className="grid grid-cols-3 gap-1.5 text-[11px] font-mono">
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Planta:</span>
                        <span className="font-bold text-emerald-400">{safeFixed((f?.PLANTA ?? 1) * 100, 0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Soca 1:</span>
                        <span className="font-bold text-emerald-400">{safeFixed((f?.SOCA ?? 0.9) * 100, 0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Retoño 2:</span>
                        <span className="font-bold text-slate-300">{safeFixed((f?.RETONO_Q2 ?? 0.83) * 100, 0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Retoño 3:</span>
                        <span className="font-bold text-slate-300">{safeFixed((f?.RETONO_Q3 ?? 0.77) * 100, 0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Retoño 5:</span>
                        <span className="font-bold text-amber-400">{safeFixed((f?.RETONO_Q5 ?? 0.62) * 100, 0)}%</span>
                      </div>
                      <div className="p-1.5 rounded bg-slate-950/40 border border-slate-800/40 flex justify-between">
                        <span className="text-slate-500">Retoño 7+:</span>
                        <span className="font-bold text-rose-400">{safeFixed((f?.RETONO_Q7_PLUS ?? 0.5) * 100, 0)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Operations, Planting & Industrial By-products */}
      {activeSubTab === "operations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-900/60">
            <div>
              <h4 className="text-xs font-bold text-slate-200">Plan Operativo Mecanizado</h4>
              <p className="text-[11px] text-slate-400">Planificación de maquinaria pesada, siembra y reciclaje de subproductos industriales.</p>
            </div>
            <button
              onClick={handleGenerateWorkOrders}
              className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Tractor className="w-3.5 h-3.5" />
              <span>Emitir Órdenes CMMS para Maquinaria</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Soil Preparation */}
            <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tractor className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm">
                    Preparación de Suelos & Renovación (ODS Sheets: 'Áreas PS e PL' & 'Áreas PS_operações')
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTrace(soilPrepPlan.trace)}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Trace
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Área Objetivo de Preparación / Reforma:</span>
                  <span className="font-mono font-bold">{safeFixed(soilPrepPlan.totalPreparationAreaHa, 1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Horas-Máquina de Tractor Requeridas:</span>
                  <span className="font-mono font-bold">{safeFixed(soilPrepPlan.totalMachineHours, 1)} h</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Consumo Total Diesel de Preparación:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {safeNum(soilPrepPlan.totalDieselLiters).toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                  </span>
                </div>
              </div>

              {/* Sub-operations table */}
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Operaciones Mecanizadas:</span>
                <div className="space-y-2">
                  {soilPrepPlan.workloadItems.map((item, idx) => (
                    <div
                      key={`prep-op-${item.operation?.id || idx}`}
                      className="flex items-center justify-between text-xs p-2 rounded border border-slate-800/40 bg-slate-950/40"
                    >
                      <div>
                        <span className="font-semibold block">{item.operation?.name || "Operación"}</span>
                        <span className="text-[11px] text-slate-500">
                          {item.operation?.category} • {item.operation?.effectiveCapacityHaPerHour} ha/h
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-slate-300">{safeFixed(item.requiredMachineHours, 1)} h</span>
                        <span className="text-slate-500 block text-[11px]">
                          {safeFixed(item.requiredDieselLiters, 0)} L diesel
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Planting Plan */}
            <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sprout className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-sm">
                    Plantío Mecanizado & Semilleros (ODS Sheet: 'PLANTIO')
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTrace(plantingPlan.trace)}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Trace
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Área de Siembra Programada:</span>
                  <span className="font-mono font-bold">{safeFixed(plantingPlan.targetPlantingAreaHa, 1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Dosis de Semilla de Caña:</span>
                  <span className="font-mono font-bold">{plantingPlan.seedCaneRateTonsPerHa} t/ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Área de Semillero Dedicada Requerida:</span>
                  <span className="font-mono font-bold text-emerald-400">{safeFixed(plantingPlan.dedicatedSeedCaneAreaHa, 1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Fertilizante Químico de Fondo (NPK):</span>
                  <span className="font-mono font-bold">{safeFixed(plantingPlan.totalBasalFertilizerTons, 1)} t</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Horas de Plantadora Mecanizada:</span>
                  <span className="font-mono font-bold">{safeFixed(plantingPlan.requiredMachineHours, 1)} h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Circular Bioeconomy */}
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  Economía Circular & Subproductos Fabriles (ODS Sheets: 'TRATOS PLANTA' & 'TRATOS SOCAeRETONOS')
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Área Caña Planta en Trato</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {safeFixed(culturalTreatmentsPlan.plantCaneAreaHa, 1)} ha
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Área Soca / Retoño en Trato</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {safeFixed(culturalTreatmentsPlan.ratoonCaneAreaHa, 1)} ha
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Fertirriego con Vinaza Fabril</span>
                <span className="text-lg font-bold font-mono text-blue-400 mt-1 block">
                  {culturalTreatmentsPlan.vinasseAppliedM3 != null
                    ? safeNum(culturalTreatmentsPlan.vinasseAppliedM3).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : "—"} m³
                </span>
                <span className="text-[10px] text-slate-500">150 m³/ha en 60% área retoño</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Reciclaje de Cachaza de Filtro</span>
                <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">
                  {culturalTreatmentsPlan.filterCakeAppliedTons != null
                    ? safeNum(culturalTreatmentsPlan.filterCakeAppliedTons).toLocaleString(undefined, { maximumFractionDigits: 0 })
                    : "—"} t
                </span>
                <span className="text-[10px] text-slate-500">30 t/ha en surco / renovación</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Fleet Balance & CCT Road Transport */}
      {activeSubTab === "fleet_cct" && (
        <div className="space-y-6">
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Tractor className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-sm">
                  Balance y Dimensionamiento de Flota Agrícola (ODS Sheets: 'Equipamentos PS_CALCULOS' & 'COMPRAS')
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(fleetPlan.trace)}
                className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Trace Balance
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className={`border-b font-semibold ${isLight ? "bg-slate-100/70 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"}`}>
                    <th className="p-3">Categoría de Equipo</th>
                    <th className="p-3">Descripción Operativa</th>
                    <th className="p-3">Carga Trabajo (h)</th>
                    <th className="p-3">Ventana (días)</th>
                    <th className="p-3">Disp. Mecánica</th>
                    <th className="p-3">Flota Req.</th>
                    <th className="p-3">Flota Disp.</th>
                    <th className="p-3">Déficit</th>
                    <th className="p-3">Precio Unit. (USD)</th>
                    <th className="p-3 font-bold">CAPEX Inversión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {fleetPlan.balanceItems.map((item, idx) => (
                    <tr key={`fleet-${item.category}-${idx}`} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-emerald-400">{item.category}</td>
                      <td className="p-3 text-slate-300">{item.description}</td>
                      <td className="p-3 font-mono">{safeFixed(item.totalWorkloadHours, 1)} h</td>
                      <td className="p-3 font-mono">{item.workingWindowDays}</td>
                      <td className="p-3 font-mono">{safeFixed(safeNum(item.mechanicalAvailabilityRatio) * 100, 0)}%</td>
                      <td className="p-3 font-mono font-bold text-slate-200">{item.fleetRequiredUnits}</td>
                      <td className="p-3 font-mono text-slate-400">{item.fleetAvailableUnits}</td>
                      <td className="p-3 font-mono font-bold">
                        {item.fleetDeficitUnits > 0 ? (
                          <span className="text-rose-400">+{item.fleetDeficitUnits}</span>
                        ) : (
                          <span className="text-emerald-400">0 (OK)</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">${safeNum(item.unitAcquisitionPriceUSD).toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        ${safeNum(item.totalAcquisitionCapexUSD).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* CCT Transport Cycle */}
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  Logística CCT (Corte, Carga & Transporte) — Dimensionamiento de Camiones
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(cctLogistics.trace)}
                className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Trace CCT
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Distancia Ida y Vuelta</span>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="2"
                    value={cctDistanceKm}
                    onChange={(e) => setCctDistanceKm(parseFloat(e.target.value))}
                    className="w-24 accent-emerald-500"
                  />
                  <span className="font-mono font-bold text-slate-200">{cctDistanceKm} km</span>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Tiempo en Tránsito (Vacío + Cargado)</span>
                <span className="text-lg font-bold font-mono text-slate-200 mt-1 block">
                  {safeFixed(cctLogistics.transitTimeHours, 2)} h
                </span>
                <span className="text-[10px] text-slate-500">45 km/h vacío, 32 km/h cargado</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Ciclo Completo por Camión</span>
                <span className="text-lg font-bold font-mono text-slate-200 mt-1 block">
                  {safeFixed(cctLogistics.totalCycleTimeHours, 2)} h
                </span>
                <span className="text-[10px] text-slate-500">Incluye colas y descarga en patio</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Viajes Efectivos / Día-Camión</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {safeFixed(cctLogistics.effectiveTripsPerTruckDay, 2)} viajes
                </span>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-blue-400 block">Flota de Camiones Bi-Tren Requerida:</span>
                <span className="text-2xl font-bold font-mono text-white mt-0.5 block">
                  {cctLogistics.trucksRequiredForDailyDemand} Camiones de 45 t
                </span>
              </div>
              <div className="text-right text-xs text-slate-300">
                Capacidad por camión: <span className="font-bold text-white">{safeFixed(cctLogistics.dailyCapacityPerTruckTons, 1)} t/día</span>
                <br />
                Demanda Diaria Molienda: <span className="font-bold">{safeFixed(campaignSummary.dailyHarvestRequirementTons, 0)} t/día</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Agro-Economics & Capital Investment */}
      {activeSubTab === "economics" && (
        <div className="space-y-6">
          {/* Scenario / Sensitivity Bar */}
          <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">
                Simulador de Sensibilidad Agro-Económica & Clima (What-If)
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Impacto Climático (Sequía/Lluvia):</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {safeFixed(safeNum(climateImpactFactor, 1) * 100, 0)}% (
                    {climateImpactFactor < 1 ? "Sequía" : climateImpactFactor > 1 ? "Favorable" : "Normal"})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="1.20"
                  step="0.05"
                  value={climateImpactFactor}
                  onChange={(e) => setClimateImpactFactor(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Precio Combustible Diesel:</span>
                  <span className="font-mono font-bold text-amber-400">${safeFixed(dieselPriceUSD, 2)} USD/L</span>
                </div>
                <input
                  type="range"
                  min="0.60"
                  max="1.80"
                  step="0.05"
                  value={dieselPriceUSD}
                  onChange={(e) => setDieselPriceUSD(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => {
                    setClimateImpactFactor(1.0);
                    setDieselPriceUSD(BENCHMARK_ECONOMIC_PRICES.DIESEL_USD_PER_LITER);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Restablecer Parámetros Base</span>
                </button>
              </div>
            </div>
          </div>

          {/* OPEX Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-sm">
                    Estructura OPEX de Campo (ODS Sheet: 'OPEX' & 'DIESEL e LUBR')
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedTrace(economics.trace)}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Trace OPEX
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Combustible Diesel ({safeNum(economics.totalDieselConsumedLiters).toLocaleString(undefined, { maximumFractionDigits: 0 })} L):</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.fuelDieselCostUSD).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Fertilizantes N-P-K & Enmiendas:</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.fertilizersAndAmendmentsCostUSD).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Defensivos Químicos & Herbicidas:</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.agrochemicalsAndDefensivesCostUSD).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Mantenimiento de Maquinaria & Desgaste:</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.machineryMaintenanceCostUSD).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Mano de Obra Directa (Operadores/Choferes):</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.workforceLaborCostUSD).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Otros Costos Operativos de Campo:</span>
                  <span className="font-mono font-bold">${safeNum(economics.opex?.otherOperationalCostsUSD).toLocaleString()}</span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total OPEX Agrícola:</span>
                  <span className="font-mono text-emerald-400 text-base">
                    ${safeNum(economics.opex?.totalOpexUSD).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Unit costs indicators */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/60">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] text-emerald-400 uppercase font-semibold block">Costo Directo por Tonelada</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    ${safeFixed(economics?.opex?.costPerTonCaneUSD, 2)}
                  </span>
                  <span className="text-[10px] text-slate-400">USD/t caña puesta en fábrica</span>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <span className="text-[11px] text-blue-400 uppercase font-semibold block">Costo Directo por Hectárea</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    ${safeFixed(economics?.opex?.costPerHectareUSD, 2)}
                  </span>
                  <span className="text-[10px] text-slate-400">USD/ha cultivada</span>
                </div>
              </div>
            </div>

            {/* CAPEX Breakdown */}
            <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm">
                    Inversiones de Capital CAPEX (ODS Sheet: 'CAPEX' & 'OUTROS INV')
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Adquisición y Reposición de Maquinaria:</span>
                  <span className="font-mono font-bold text-amber-400">
                    ${safeNum(economics.capex?.machineryAcquisitionUSD).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Infraestructura de Campo, Caminos & Talleres:</span>
                  <span className="font-mono font-bold">
                    ${safeNum(economics.capex?.agriculturalInfrastructureUSD).toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Reforma & Acondicionamiento de Suelos:</span>
                  <span className="font-mono font-bold">
                    ${safeNum(economics.capex?.soilImprovementAndRenovationUSD).toLocaleString()}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total Inversión CAPEX Agrícola:</span>
                  <span className="font-mono text-amber-400 text-base">
                    ${safeNum(economics.capex?.totalCapexUSD).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-xs space-y-1">
                <span className="font-bold text-slate-300 block">Directriz de Rentabilidad Agrícola:</span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Para mantener un costo menor a <span className="text-emerald-400 font-bold">$22.00 USD/t</span>, la edad media
                  del cañaveral debe mantenerse por debajo de 4.2 años, requiriendo un ritmo de renovación sostenido de al menos
                  el 15.0% anual del área total.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PDA Parameters Governance & Audit (ODS Verification) */}
      {activeSubTab === "governance" && (
        <div className="space-y-6">
          {/* Header Card & Audit Summary */}
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base">
                    Gobernanza & Auditoría de Parámetros del Modelo PDA (ODS)
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl">
                  Auditoría formal de trazabilidad matemática sobre la hoja <span className="font-mono text-slate-200">PDA_set30_rev2014_v1.ods</span>.
                  Los parámetros están clasificados según su rigor determinista para evitar asunciones no verificadas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingParamCustom(null);
                    setIsParamModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nuevo Parámetro</span>
                </button>

                <button
                  onClick={handleResetParameters}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 text-xs font-semibold transition"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Restablecer Canónicos</span>
                </button>
              </div>
            </div>

            {/* Audit Status Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/60">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-[11px] text-slate-400 block uppercase font-medium">Total Parámetros</span>
                <span className="text-xl font-bold font-mono text-slate-100 mt-0.5 block">
                  {parameterStats.total}
                </span>
                <span className="text-[10px] text-slate-500">Registrados en bioazúcar</span>
              </div>

              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400 uppercase font-semibold">Confirmados</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
                  {parameterStats.confirmed}
                </span>
                <span className="text-[10px] text-slate-400">Fórmulas ODS exactas</span>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-400 uppercase font-semibold">Por Validar</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">
                  {parameterStats.requiresVal}
                </span>
                <span className="text-[10px] text-slate-400">Auditar contra campo real</span>
              </div>

              <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/10">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-blue-400 uppercase font-semibold">Configurables</span>
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-xl font-bold font-mono text-blue-400 mt-0.5 block">
                  {parameterStats.configurable}
                </span>
                <span className="text-[10px] text-slate-400">Variables de mercado/zafra</span>
              </div>
            </div>
          </div>

          {/* Search & Filters */}
          <div className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar clave, nombre o celda..."
                  value={governanceSearch}
                  onChange={(e) => setGovernanceSearch(e.target.value)}
                  className={`text-xs pl-8 pr-3 py-1.5 rounded-md border w-64 ${
                    isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                  }`}
                />
              </div>

              <select
                value={governanceCategoryFilter}
                onChange={(e) => setGovernanceCategoryFilter(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todas las Categorías</option>
                <option value="VARIEDAD">Variedades & TCH Base</option>
                <option value="SUELO">Suelos & Modificadores</option>
                <option value="PREPARACION_SUELO">Preparación de Suelos</option>
                <option value="PLANTIO">Siembra & Semilleros</option>
                <option value="TRATOS_CULTURALES">Tratos Culturales & Vinaza</option>
                <option value="MAQUINARIA">Maquinaria & Rendimientos</option>
                <option value="CCT_LOGISTICA">Logística CCT & Transporte</option>
                <option value="ECONOMIA">Precios, Diesel & Laboral</option>
              </select>

              <select
                value={governanceStatusFilter}
                onChange={(e) => setGovernanceStatusFilter(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-md border ${
                  isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todos los Estados de Validación</option>
                <option value="CONFIRMADO">CONFIRMADO (Fórmula Exacta ODS)</option>
                <option value="REQUIERE_VALIDACION">REQUIERE_VALIDACION (Calibración en Campo)</option>
                <option value="CONFIGURABLE">CONFIGURABLE (Parámetro Libre)</option>
              </select>
            </div>

            <span className="text-xs text-slate-400">
              Mostrando <span className="font-bold text-slate-200">{filteredParameters.length}</span> de {parameters.length} parámetros
            </span>
          </div>

          {/* Parameters Table */}
          <div className={`overflow-x-auto rounded-xl border ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-semibold ${isLight ? "bg-slate-100/70 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"}`}>
                  <th className="p-3">Estado de Validación</th>
                  <th className="p-3">Clave Parámetro</th>
                  <th className="p-3">Nombre & Descripción</th>
                  <th className="p-3">Valor Actual</th>
                  <th className="p-3">Unidad</th>
                  <th className="p-3">Hoja / Celdas ODS</th>
                  <th className="p-3 text-center">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredParameters.map((param, idx) => {
                  return (
                    <tr
                      key={`param-${param.id || param.key || idx}`}
                      className="hover:bg-slate-800/30 transition"
                    >
                      <td className="p-3 whitespace-nowrap">
                        {param.validationStatus === "CONFIRMADO" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            CONFIRMADO
                          </span>
                        ) : param.validationStatus === "REQUIERE_VALIDACION" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            REQUIERE_VALIDACIÓN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                            <SlidersHorizontal className="w-3 h-3" />
                            CONFIGURABLE
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-300">{param.key}</td>
                      <td className="p-3 max-w-xs">
                        <span className="font-semibold text-slate-200 block">{param.name}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1">{param.description}</span>
                      </td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {typeof param.value === "number" ? param.value.toLocaleString() : String(param.value)}
                      </td>
                      <td className="p-3 text-slate-400 font-mono">{param.unit}</td>
                      <td className="p-3 font-mono text-[11px] text-slate-300">
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800">
                          {param.sourceSheet}!{param.sourceCells}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingParam(param);
                              setParamEditValue(String(param.value));
                            }}
                            className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700 transition flex items-center gap-1"
                            title="Edición rápida de valor"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Valor</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingParamCustom(param);
                              setIsParamModalOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
                            title="Editar Parámetro Completo (Metadatos, Rango, Fórmulas)"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PARAMETER EDIT MODAL */}
      {editingParam && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">Editar Parámetro Agrícola</h3>
              </div>
              <button
                onClick={() => setEditingParam(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 block mb-1">Nombre:</span>
                <span className="font-bold text-slate-200 block text-sm">{editingParam.name}</span>
                <span className="font-mono text-[11px] text-slate-500">{editingParam.key}</span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Estado en Modelo:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300">
                  {editingParam.validationStatus}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Referencia ODS:</span>
                <span className="font-mono text-emerald-400">
                  {editingParam.sourceSheet}!{editingParam.sourceCells}
                </span>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nuevo Valor ({editingParam.unit}):
                </label>
                <input
                  type="number"
                  step="any"
                  value={paramEditValue}
                  onChange={(e) => setParamEditValue(e.target.value)}
                  className="w-full text-sm font-mono px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {editingParam.validationStatus === "REQUIERE_VALIDACION" && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Este parámetro requiere calibración en campo contra las condiciones reales del ingenio antes de dar por cerrada la zafra.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setEditingParam(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveParam}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Parámetro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALCULATION TRACE AUDIT MODAL (ISA-95 Level 4) */}
      {selectedTrace && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">
                  Auditoría Determinista de Cálculo (ISA-95 Level 4)
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                  Fórmula Matemática Auditada:
                </span>
                <p className="font-mono bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 mt-1 text-xs break-all">
                  {selectedTrace.formula}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800/60">
                  <span className="text-slate-500 block text-[10px] uppercase">Hoja Origen ODS:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedTrace.sourceSheet}</span>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800/60">
                  <span className="text-slate-500 block text-[10px] uppercase">Celdas / Coordenadas:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedTrace.sourceCells}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-300 block mb-2">Variables de Entrada & Unidades:</span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {Object.entries(selectedTrace.inputs).map(([key, rawItem], idx) => {
                    const val =
                      rawItem != null && typeof rawItem === "object" && "value" in rawItem
                        ? (rawItem as any).value
                        : rawItem;
                    const unit =
                      rawItem != null && typeof rawItem === "object" && "unit" in rawItem
                        ? (rawItem as any).unit
                        : "";

                    return (
                      <div
                        key={`trace-inp-${key}-${idx}`}
                        className="flex items-center justify-between p-2 rounded bg-slate-950/70 border border-slate-800/40 text-[11px]"
                      >
                        <span className="font-mono text-slate-400">{key}:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {typeof val === "number" ? val.toLocaleString() : String(val ?? "—")}{" "}
                          {unit && <span className="text-slate-500 font-normal">{unit}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
                <span>Revisión del Modelo: {selectedTrace.modelRevision}</span>
                <span>Calculado: {new Date(selectedTrace.calculatedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PLOT MANAGEMENT MODAL (Create/Edit Field Plots) */}
      <PlotModal
        isOpen={isPlotModalOpen}
        onClose={() => {
          setIsPlotModalOpen(false);
          setEditingPlot(null);
        }}
        onSave={handleSavePlot}
        initialPlot={editingPlot}
        availableVarieties={varieties}
        varieties={varieties}
        theme={theme}
      />

      {/* VARIETY & DECAY CURVE MODAL */}
      <VarietyModal
        isOpen={isVarietyModalOpen}
        onClose={() => {
          setIsVarietyModalOpen(false);
          setEditingVariety(null);
        }}
        onSave={handleSaveVariety}
        initialVariety={editingVariety}
      />

      {/* CAMPAIGN & HARVEST SEASON CONFIGURATION MODAL */}
      <CampaignModal
        isOpen={isCampaignModalOpen}
        onClose={() => setIsCampaignModalOpen(false)}
        onSave={handleSaveCampaign}
        initialCampaign={campaign}
      />

      {/* PARAMETER DETAILED MANAGEMENT MODAL */}
      <ParameterModal
        isOpen={isParamModalOpen}
        onClose={() => {
          setIsParamModalOpen(false);
          setEditingParamCustom(null);
        }}
        onSave={handleSaveParameterCustom}
        initialParam={editingParamCustom}
      />

      {/* MATHEMATICAL FORMULA VIEWER MODAL */}
      <FormulaViewerModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
        onOpenParameterEditor={(paramKey) => {
          setIsFormulaModalOpen(false);
          const found = parameters.find((p) => p.key === paramKey);
          if (found) {
            setEditingParamCustom(found);
            setIsParamModalOpen(true);
          } else {
            setActiveSubTab("governance");
          }
        }}
      />
    </div>
  );
};
