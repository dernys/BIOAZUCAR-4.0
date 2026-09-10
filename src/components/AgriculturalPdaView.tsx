/**
 * BioAzúcar 4.0 — Agricultural Intelligence & Planning Executive View
 * Native implementation of the PDA (Plano de Desenvolvimento Agrícola) Model.
 * 
 * Features:
 * 1. Field Plot Cadastre & Biological Yield Decay Curves (ODS 'TCH', 'EVOLUÇÃO tch por cepa')
 * 2. Mechanized Soil Prep, Planting & Circular Industrial By-product Recycling (Vinasse & Filter Cake)
 * 3. Agricultural Fleet Dimensioning & CCT Road Transport Cycle (ODS 'Equipamentos', 'COLHEITA')
 * 4. Agro-Economics OPEX ($/t, $/ha) & CAPEX Investment Budget (ODS 'OPEX', 'CAPEX')
 * 5. Full Evidence-First Calculation Trace Inspector (Auditability ISA-95 Level 4)
 */

import React, { useState, useMemo } from "react";
import {
  Tractor,
  Sprout,
  Wheat,
  Truck,
  DollarSign,
  TrendingDown,
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
} from "lucide-react";
import {
  FieldPlot,
  AgriculturalCampaign,
  CalculationTrace,
  EquipmentCategory,
} from "../types/agriculture";
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
  INITIAL_AGRICULTURAL_CAMPAIGN,
  INITIAL_FIELD_PLOTS,
} from "../data/mockAgriculturalData";

interface AgriculturalPdaViewProps {
  theme?: "dark" | "light";
  currentTenantName?: string;
  nominalMillTch?: number; // e.g. 450 t/h from SCADA
}

type SubTab = "plots" | "operations" | "fleet_cct" | "economics";

export const AgriculturalPdaView: React.FC<AgriculturalPdaViewProps> = ({
  theme = "dark",
  currentTenantName = "Central Azucarero Principal",
  nominalMillTch = 450.0,
}) => {
  const isLight = theme === "light";

  const [activeSubTab, setActiveSubTab] = useState<SubTab>("plots");
  const [plots, setPlots] = useState<FieldPlot[]>(INITIAL_FIELD_PLOTS);
  const [campaign] = useState<AgriculturalCampaign>(INITIAL_AGRICULTURAL_CAMPAIGN);

  // Filter states
  const [selectedUeb, setSelectedUeb] = useState<string>("ALL");
  const [selectedVariety, setSelectedVariety] = useState<string>("ALL");
  const [selectedStage, setSelectedStage] = useState<string>("ALL");

  // What-If Simulation controls
  const [climateImpactFactor, setClimateImpactFactor] = useState<number>(1.0); // 0.85 to 1.15
  const [dieselPriceUSD, setDieselPriceUSD] = useState<number>(BENCHMARK_ECONOMIC_PRICES.DIESEL_USD_PER_LITER);
  const [cctDistanceKm, setCctDistanceKm] = useState<number>(36.0); // round-trip km

  // Trace modal inspection
  const [selectedTrace, setSelectedTrace] = useState<CalculationTrace | null>(null);

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
        ? summary.totalProductionTons / campaign.effectiveHarvestDays
        : 0;
    return {
      ...summary,
      totalArableAreaHectares: summary.totalAreaHa,
      totalProjectedCaneTons: summary.totalProductionTons,
      weightedAverageTch: summary.averageTch,
      dailyHarvestRequirementTons: dailyDemand,
    };
  }, [campaign, plots]);

  // Operational plans
  const soilPrepPlan = useMemo(() => {
    const renewalArea = plots
      .filter((p) => p.currentStage === "DEMOLICION" || p.currentStage === "PLANTA")
      .reduce((sum, p) => sum + p.areaHectares, 0);
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
      targetPlantingAreaHa: soilPrepPlan.totalPreparationAreaHa,
    });
  }, [campaign, soilPrepPlan]);

  const culturalTreatmentsPlan = useMemo(() => {
    const plantArea = plots
      .filter((p) => p.currentStage === "PLANTA")
      .reduce((sum, p) => sum + p.areaHectares, 0);
    const ratoonArea = plots
      .filter((p) => p.currentStage.startsWith("RETONO") || p.currentStage === "SOCA")
      .reduce((sum, p) => sum + p.areaHectares, 0);

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
      totalWorkloadHours: soilPrepPlan.totalMachineHours * 0.55,
      workingWindowDays: 60,
      dailyOperatingHours: 16,
      fleetAvailableUnits: 2,
    });

    const mediumTractorItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_MEDIO",
      description: "Tractores Medios 140 HP (Grada, Surcado & Tratos Culturales)",
      totalWorkloadHours: culturalTreatmentsPlan.totalMachineHours * 0.45,
      workingWindowDays: 90,
      dailyOperatingHours: 16,
      fleetAvailableUnits: 4,
    });

    const harvesterItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "COSECHADORA_COMBINADA",
      description: "Cosechadoras Combinadas de Caña Picada 350 HP",
      totalWorkloadHours: campaignSummary.totalProjectedCaneTons / 52.0, // 52 t/h effective capacity
      workingWindowDays: campaign.effectiveHarvestDays,
      dailyOperatingHours: 18,
      mechanicalAvailabilityRatio: 0.82,
      fleetAvailableUnits: 2,
    });

    const transloaderItem = MachineryAndLogisticsService.calculateFleetBalanceItem({
      category: "TRACTOR_TRANSBORDO",
      description: "Conjunto Tractor + Vagón Transbordo 14 t",
      totalWorkloadHours: (campaignSummary.totalProjectedCaneTons / 52.0) * 1.3,
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
    const dailyDemand = campaignSummary.dailyHarvestRequirementTons;
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
      totalArableAreaHa: campaignSummary.totalArableAreaHectares,
      totalCaneTonsDelivered: campaignSummary.totalProjectedCaneTons * climateImpactFactor,
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

  // Variety decay curve reference (ODS 'EVOLUÇÃO tch por cepa')
  const varietyCatalogList = useMemo(() => {
    return Object.values(COMMERCIAL_VARIETIES_CATALOG);
  }, []);

  return (
    <div className={`p-4 md:p-6 space-y-6 ${isLight ? "bg-slate-50 text-slate-800" : "bg-slate-950 text-slate-100"}`}>
      {/* Header & Campaign Info */}
      <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900/90 border-slate-800"}`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Tractor className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Plan de Desarrollo Agrícola (PDA) & Inteligencia de Campo
              </h1>
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                Modelo ODS Rev. 2014
              </span>
            </div>
            <p className={`text-xs ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              {campaign.name} • Tenant: <span className="font-semibold">{currentTenantName}</span> • Tándem Molienda Nominal:{" "}
              <span className="font-mono text-emerald-500 font-semibold">{nominalMillTch} TCH</span>
            </p>
          </div>

          {/* Quick Action / Trace Audit */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedTrace(campaignSummary.trace)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                  : "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Trazabilidad ODS PDA</span>
            </button>
          </div>
        </div>

        {/* Executive KPI Grid (Deterministic Metrics) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-800/40">
          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Área Catastrada</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono">{campaignSummary.totalArableAreaHectares.toLocaleString()}</span>
              <span className="text-xs text-slate-500">ha</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Caña Proyectada</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-emerald-500">
                {(campaignSummary.totalProjectedCaneTons * climateImpactFactor).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-500">t</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">TCH Ponderado</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono">
                {(campaignSummary.weightedAverageTch * climateImpactFactor).toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">t/ha</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Demanda Molienda</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-amber-500">
                {campaignSummary.dailyHarvestRequirementTons.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-xs text-slate-500">t/día</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Flota Camiones CCT</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-blue-400">{cctLogistics.trucksRequiredForDailyDemand}</span>
              <span className="text-xs text-slate-500">unidades</span>
            </div>
          </div>

          <div className={`p-3 rounded-lg border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/60 border-slate-800"}`}>
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">Costo Directo OPEX</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-bold font-mono text-emerald-400">
                ${economics.opex.costPerTonCaneUSD.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">/t caña</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 overflow-x-auto">
        {[
          { id: "plots", label: "Catastro de Lotes & TCH", icon: Wheat },
          { id: "operations", label: "Preparación, Siembra & Tratos", icon: Sprout },
          { id: "fleet_cct", label: "Flota & Logística CCT", icon: Truck },
          { id: "economics", label: "Agro-Economía & CAPEX", icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
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
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: Field Plots & Yield Decay Curves */}
      {activeSubTab === "plots" && (
        <div className="space-y-6">
          {/* Reference Variety Yield Decay Curves Box */}
          <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold">
                  Curva Canónica de Decaimiento por Cepa (ODS Sheet: 'EVOLUÇÃO tch por cepa')
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Modelo determinista de retención de productividad por corte sucesivo
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {varietyCatalogList.map((variety) => (
                <div
                  key={variety.varietyCode}
                  className={`p-3.5 rounded-lg border ${
                    isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/70 border-slate-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{variety.varietyCode}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      TCH Base: {variety.baseYieldTch} t/ha
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
                        {(((variety.ratoonDecayFactors?.RETONO_Q7_PLUS ?? 0.52)) * 100).toFixed(0)}% (Demolición)
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters Bar */}
          <div className={`p-3 rounded-lg border flex flex-wrap items-center gap-3 ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
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
              <option value="RB86-7515">RB86-7515</option>
              <option value="SP80-3280">SP80-3280</option>
              <option value="CTC-4">CTC-4</option>
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

          {/* Plots Table */}
          <div className={`overflow-x-auto rounded-xl border ${
            isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
          }`}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className={`border-b font-semibold ${isLight ? "bg-slate-100/70 border-slate-200 text-slate-700" : "bg-slate-950 border-slate-800 text-slate-300"}`}>
                  <th className="p-3">Código Lote</th>
                  <th className="p-3">División (UEB)</th>
                  <th className="p-3">Área (ha)</th>
                  <th className="p-3">Variedad</th>
                  <th className="p-3">Etapa / Edad</th>
                  <th className="p-3">Suelo</th>
                  <th className="p-3">Distancia (km)</th>
                  <th className="p-3">TCH Proy. (t/ha)</th>
                  <th className="p-3">Caña Total (t)</th>
                  <th className="p-3">Estado / Alerta</th>
                  <th className="p-3 text-center">Trazabilidad</th>
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
                      key={plot.id || `plot-${idx}`}
                      className={`hover:bg-slate-800/30 transition ${
                        isDemolitionCandidate ? (isLight ? "bg-rose-50/50" : "bg-rose-950/20") : ""
                      }`}
                    >
                      <td className="p-3 font-mono font-bold">{plot.code}</td>
                      <td className="p-3 text-slate-400">{plot.uebName}</td>
                      <td className="p-3 font-mono">{(plot.areaHectares ?? 0).toFixed(1)}</td>
                      <td className="p-3 font-medium text-emerald-400">{plot.varietyCode}</td>
                      <td className="p-3">
                        <span className="font-medium">{plot.currentStage}</span>
                        <span className="text-[10px] text-slate-500 block">Año {plot.ratoonAgeYears}</span>
                      </td>
                      <td className="p-3 text-slate-400">{plot.soilType}</td>
                      <td className="p-3 font-mono">{(plot.distanceToMillKm ?? 0).toFixed(1)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {plot.projectedTch != null ? plot.projectedTch.toFixed(1) : "—"}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {plot.projectedTotalCaneTons != null
                          ? plot.projectedTotalCaneTons.toLocaleString(undefined, { maximumFractionDigits: 0 })
                          : "—"}
                      </td>
                      <td className="p-3">
                        {isDemolitionCandidate ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Renovación Sugerida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Productivo
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedTrace(plot.trace ?? null)}
                          className="p-1 rounded hover:bg-slate-700/50 text-slate-400 hover:text-white transition"
                          title="Inspeccionar Trazabilidad ODS"
                        >
                          <Info className="w-4 h-4 text-emerald-500" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: Soil Preparation, Planting & Cultural Treatments */}
      {activeSubTab === "operations" && (
        <div className="space-y-6">
          {/* Soil Preparation & Planting Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Soil Preparation Plan */}
            <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Tractor className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm">
                    Plan Mecanizado de Preparación de Suelo (ODS Sheet: 'Áreas PS_operações')
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
                  <span className="text-slate-400">Área Objetivo de Preparación:</span>
                  <span className="font-mono font-bold">{(soilPrepPlan.totalPreparationAreaHa ?? 0).toFixed(1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Total Horas Máquina Requeridas:</span>
                  <span className="font-mono font-bold">{(soilPrepPlan.totalMachineHours ?? 0).toFixed(1)} h</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Consumo Total Diesel de Preparación:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {(soilPrepPlan.totalDieselLiters ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} L
                  </span>
                </div>
              </div>

              {/* Sub-operations table */}
              <div className="mt-4 pt-4 border-t border-slate-800/60">
                <span className="text-xs font-semibold text-slate-400 block mb-2">Operaciones Mecanizadas:</span>
                <div className="space-y-2">
                  {soilPrepPlan.workloadItems.map((item) => (
                    <div
                      key={item.operation.id}
                      className="flex items-center justify-between text-xs p-2 rounded border border-slate-800/40 bg-slate-950/40"
                    >
                      <div>
                        <span className="font-semibold block">{item.operation.name}</span>
                        <span className="text-[11px] text-slate-500">
                          {item.operation.category} • {item.operation.effectiveCapacityHaPerHour} ha/h
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-slate-300">{(item.requiredMachineHours ?? 0).toFixed(1)} h</span>
                        <span className="text-slate-500 block text-[11px]">
                          {(item.requiredDieselLiters ?? 0).toFixed(0)} L diesel
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
                    Plan de Siembra / Plantío (ODS Sheet: 'PLANTIO')
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
                  <span className="text-slate-400">Área Neta de Siembra:</span>
                  <span className="font-mono font-bold">{(plantingPlan.targetPlantingAreaHa ?? 0).toFixed(1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Demanda Caña Semilla (13.5 t/ha):</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(plantingPlan.totalSeedCaneRequiredTons ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} t
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Área Destinada a Semilleros:</span>
                  <span className="font-mono font-bold">{(plantingPlan.dedicatedSeedCaneAreaHa ?? 0).toFixed(1)} ha</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Fertilizante de Fondo N-P-K (400 kg/ha):</span>
                  <span className="font-mono font-bold">{(plantingPlan.totalBasalFertilizerTons ?? 0).toFixed(1)} t</span>
                </div>
                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Horas Plantadora & Tractor:</span>
                  <span className="font-mono font-bold">{(plantingPlan.requiredMachineHours ?? 0).toFixed(1)} h</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cultural Treatments & Circular Economy By-Products */}
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  Tratos Culturales & Reciclaje Circular de Subproductos Fabriles
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(culturalTreatmentsPlan.trace)}
                className="text-xs text-emerald-500 hover:underline flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Trace
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Área Caña Planta en Trato</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {(culturalTreatmentsPlan.plantCaneAreaHa ?? 0).toFixed(1)} ha
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Área Soca / Retoño en Trato</span>
                <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                  {(culturalTreatmentsPlan.ratoonCaneAreaHa ?? 0).toFixed(1)} ha
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Fertirriego con Vinaza Fabril</span>
                <span className="text-lg font-bold font-mono text-blue-400 mt-1 block">
                  {culturalTreatmentsPlan.vinasseAppliedM3?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"} m³
                </span>
                <span className="text-[10px] text-slate-500">150 m³/ha en 60% área retoño</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Reciclaje de Cachaza de Filtro</span>
                <span className="text-lg font-bold font-mono text-amber-400 mt-1 block">
                  {culturalTreatmentsPlan.filterCakeAppliedTons?.toLocaleString(undefined, { maximumFractionDigits: 0 }) ?? "—"} t
                </span>
                <span className="text-[10px] text-slate-500">30 t/ha en surco / renovación</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: Machinery Fleet Balance & CCT Road Transport */}
      {activeSubTab === "fleet_cct" && (
        <div className="space-y-6">
          {/* Fleet Dimensioning Table */}
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
                    <tr key={`${item.category}-${idx}`} className="hover:bg-slate-800/30 transition">
                      <td className="p-3 font-mono font-bold text-emerald-400">{item.category}</td>
                      <td className="p-3 text-slate-300">{item.description}</td>
                      <td className="p-3 font-mono">{(item.totalWorkloadHours ?? 0).toFixed(1)} h</td>
                      <td className="p-3 font-mono">{item.workingWindowDays}</td>
                      <td className="p-3 font-mono">{((item.mechanicalAvailabilityRatio ?? 0) * 100).toFixed(0)}%</td>
                      <td className="p-3 font-mono font-bold text-slate-200">{item.fleetRequiredUnits}</td>
                      <td className="p-3 font-mono text-slate-400">{item.fleetAvailableUnits}</td>
                      <td className="p-3 font-mono font-bold">
                        {item.fleetDeficitUnits > 0 ? (
                          <span className="text-rose-400">+{item.fleetDeficitUnits}</span>
                        ) : (
                          <span className="text-emerald-400">0 (OK)</span>
                        )}
                      </td>
                      <td className="p-3 font-mono">${item.unitAcquisitionPriceUSD.toLocaleString()}</td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        ${item.totalAcquisitionCapexUSD.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2 border-slate-800 bg-slate-950/80">
                    <td colSpan={5} className="p-3 text-right uppercase tracking-wider text-slate-400">
                      Totales de Flota & Presupuesto CAPEX:
                    </td>
                    <td className="p-3 font-mono text-slate-200">{fleetPlan.totalFleetRequired}</td>
                    <td className="p-3 font-mono text-slate-400">{fleetPlan.totalFleetAvailable}</td>
                    <td className="p-3 font-mono text-rose-400">+{fleetPlan.totalFleetDeficit}</td>
                    <td></td>
                    <td className="p-3 font-mono text-amber-400 text-sm">
                      ${fleetPlan.totalAcquisitionCapexUSD.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* CCT Road Transport Cycle (ODS 'COLHEITA' / 'CCT_pessoas') */}
          <div className={`p-5 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">
                  Logística CCT: Ciclo de Transporte & Flota Rodoviaria (ODS Sheet: 'COLHEITA')
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400">Distancia Media Ida y Vuelta:</label>
                <input
                  type="number"
                  value={cctDistanceKm}
                  onChange={(e) => setCctDistanceKm(Math.max(10, Number(e.target.value)))}
                  className={`w-20 px-2 py-1 text-xs rounded border font-mono ${
                    isLight ? "bg-slate-50 border-slate-300" : "bg-slate-950 border-slate-700"
                  }`}
                />
                <span className="text-xs text-slate-500">km</span>
                <button
                  onClick={() => setSelectedTrace(cctLogistics.trace)}
                  className="text-xs text-emerald-500 hover:underline flex items-center gap-1 ml-2"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Trace CCT
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Tiempo Tránsito (Ida/Vuelta)</span>
                <span className="text-base font-bold font-mono text-slate-200 mt-1 block">
                  {(cctLogistics.transitTimeHours ?? 0).toFixed(2)} h
                </span>
                <span className="text-[10px] text-slate-500">45 km/h vacío, 32 km/h cargado</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Tiempo Total del Ciclo</span>
                <span className="text-base font-bold font-mono text-slate-200 mt-1 block">
                  {(cctLogistics.totalCycleTimeHours ?? 0).toFixed(2)} h
                </span>
                <span className="text-[10px] text-slate-500">Tránsito + Carga + Báscula + Descarga</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Viajes Efectivos / Camión / Día</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">
                  {(cctLogistics.effectiveTripsPerTruckDay ?? 0).toFixed(2)} viajes
                </span>
                <span className="text-[10px] text-slate-500">Factor utilización 80% (19.2 h)</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="text-xs text-slate-400 block">Capacidad por Camión</span>
                <span className="text-base font-bold font-mono text-emerald-400 mt-1 block">
                  {(cctLogistics.dailyCapacityPerTruckTons ?? 0).toFixed(1)} t/día
                </span>
                <span className="text-[10px] text-slate-500">Bi-tren rodoviario 45 t</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-between">
              <span className="text-xs text-blue-300">
                Demanda Diaria Molienda: <span className="font-bold">{(campaignSummary.dailyHarvestRequirementTons ?? 0).toFixed(0)} t/día</span>
              </span>
              <span className="text-xs font-bold text-blue-300">
                Flota Mínima Requerida: <span className="text-base font-mono text-white underline">{cctLogistics.trucksRequiredForDailyDemand ?? 0} camiones</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: Agro-Economics & What-If Simulation */}
      {activeSubTab === "economics" && (
        <div className="space-y-6">
          {/* What-If Parameters Interactive Toolbar */}
          <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
            <div className="flex items-center gap-2 mb-3">
              <Sliders className="w-4 h-4 text-emerald-500" />
              <h3 className="font-bold text-sm">
                Simulador What-If de Sensibilidad Agro-Económica (ODS 'análise Evolução TCH')
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Impacto Climático / Hídrico:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {(((climateImpactFactor ?? 1)) * 100).toFixed(0)}% ({(climateImpactFactor ?? 1) < 1 ? "Sequía" : (climateImpactFactor ?? 1) > 1 ? "Favorable" : "Normal"})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.80"
                  max="1.20"
                  step="0.05"
                  value={climateImpactFactor}
                  onChange={(e) => setClimateImpactFactor(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Precio Diesel Agro:</span>
                  <span className="font-mono font-bold text-amber-400">${(dieselPriceUSD ?? 0).toFixed(2)} USD/L</span>
                </div>
                <input
                  type="range"
                  min="0.70"
                  max="1.40"
                  step="0.05"
                  value={dieselPriceUSD}
                  onChange={(e) => setDieselPriceUSD(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
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
                  <span className="text-slate-400">Combustible Diesel ({economics.totalDieselConsumedLiters.toLocaleString(undefined, { maximumFractionDigits: 0 })} L):</span>
                  <span className="font-mono font-bold">${economics.opex.fuelDieselCostUSD.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Fertilizantes N-P-K & Enmiendas:</span>
                  <span className="font-mono font-bold">${economics.opex.fertilizersAndAmendmentsCostUSD.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Defensivos Químicos & Herbicidas:</span>
                  <span className="font-mono font-bold">${economics.opex.agrochemicalsAndDefensivesCostUSD.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Mantenimiento de Maquinaria & Desgaste:</span>
                  <span className="font-mono font-bold">${economics.opex.machineryMaintenanceCostUSD.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Mano de Obra Directa (Operadores/Choferes):</span>
                  <span className="font-mono font-bold">${economics.opex.workforceLaborCostUSD.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Otros Costos Operativos de Campo:</span>
                  <span className="font-mono font-bold">${economics.opex.otherOperationalCostsUSD.toLocaleString()}</span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total OPEX Agrícola:</span>
                  <span className="font-mono text-emerald-400 text-base">
                    ${economics.opex.totalOpexUSD.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Unit costs indicators */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800/60">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] text-emerald-400 uppercase font-semibold block">Costo Directo por Tonelada</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    ${(economics.opex?.costPerTonCaneUSD ?? 0).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-slate-400">USD/t caña puesta en fábrica</span>
                </div>

                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                  <span className="text-[11px] text-blue-400 uppercase font-semibold block">Costo Directo por Hectárea</span>
                  <span className="text-xl font-bold font-mono text-white mt-1 block">
                    ${(economics.opex?.costPerHectareUSD ?? 0).toFixed(2)}
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
                    ${economics.capex.machineryAcquisitionUSD.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Infraestructura Rural & Tanques de Vinaza:</span>
                  <span className="font-mono font-bold">
                    ${economics.capex.agriculturalInfrastructureUSD.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs p-2.5 rounded bg-slate-950/50">
                  <span className="text-slate-400">Sistematización & Enmiendas de Base:</span>
                  <span className="font-mono font-bold">
                    ${economics.capex.soilImprovementAndRenovationUSD.toLocaleString()}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span>Total CAPEX Inversión:</span>
                  <span className="font-mono text-amber-400 text-base">
                    ${economics.capex.totalCapexUSD.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mt-6 p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-xs text-slate-400 space-y-1">
                <span className="font-bold text-slate-300 block">Alineación con el Modelo ODS PDA:</span>
                <p>
                  Los valores reflejan la tasa de reposición de activos mecánicos requeridos para garantizar
                  el caudal diario de molienda en zafra continua sin interrupciones por déficit de corte o alce.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EVIDENCE-FIRST CALCULATION TRACE MODAL */}
      {selectedTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div
            className={`w-full max-w-2xl rounded-xl border p-5 space-y-4 shadow-2xl ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-100"
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-800">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">
                  Trazabilidad Matemática Evidence-First (Auditoría ISA-95)
                </h3>
              </div>
              <button
                onClick={() => setSelectedTrace(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded bg-slate-950 font-mono text-emerald-400">
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider mb-1">Fórmula Canónica:</span>
                {selectedTrace.formula}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-slate-950">
                  <span className="text-slate-500 block text-[10px] uppercase">Hoja Origen ODS:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedTrace.sourceSheet}</span>
                </div>

                <div className="p-2.5 rounded bg-slate-950">
                  <span className="text-slate-500 block text-[10px] uppercase">Celdas / Coordenadas:</span>
                  <span className="font-mono font-bold text-slate-200">{selectedTrace.sourceCells}</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-300 block mb-2">Variables de Entrada & Unidades:</span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {Object.entries(selectedTrace.inputs).map(([key, rawItem]) => {
                    const item = rawItem as { value: string | number | boolean; unit: string };
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 rounded bg-slate-950/70 border border-slate-800/40 text-[11px]"
                      >
                        <span className="font-mono text-slate-400">{key}:</span>
                        <span className="font-mono font-bold text-slate-200">
                          {typeof item.value === "number" ? item.value.toLocaleString() : String(item.value)}{" "}
                          <span className="text-slate-500 font-normal">{item.unit}</span>
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
    </div>
  );
};
