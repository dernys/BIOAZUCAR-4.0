import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Zap,
  Flame,
  Scale,
  RefreshCw,
  Clock,
  Sparkles,
  DollarSign,
  AlertCircle,
  Activity,
  Layers,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { TelemetryData, TenantEnterprise } from "../../types";
import {
  ProductionPrediction24h,
  EnergyPrediction24h,
  EquipmentRiskAssessment,
} from "../../types/bioai";
import { bioAiEngineService } from "../../services/bioai/BioAiEngineService";

interface OperationalPredictionsViewProps {
  telemetry: TelemetryData;
  activeTenant?: TenantEnterprise;
  equipmentList?: any[];
  alarms?: any[];
}

export const OperationalPredictionsView: React.FC<OperationalPredictionsViewProps> = ({
  telemetry,
  activeTenant,
  equipmentList = [],
  alarms = [],
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [prodPred, setProdPred] = useState<ProductionPrediction24h | null>(null);
  const [energyPred, setEnergyPred] = useState<EnergyPrediction24h | null>(null);
  const [equipmentRisks, setEquipmentRisks] = useState<EquipmentRiskAssessment[]>([]);
  const [timeHorizon, setTimeHorizon] = useState<"12h" | "24h" | "48h">("24h");

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        bioAiEngineService.getProductionPredictions(telemetry, activeTenant),
        bioAiEngineService.getEnergyPredictions(telemetry, activeTenant),
      ]);
      setProdPred(p);
      setEnergyPred(e);
      const risks = bioAiEngineService.evaluateEquipmentRisks(equipmentList, telemetry, alarms);
      setEquipmentRisks(risks);
    } catch (err) {
      console.error("Error loading operational predictions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, [telemetry.tch, telemetry.powerExportGridMW, activeTenant?.id]);

  return (
    <div className="space-y-6">
      {/* Top Banner with Model Status & Refresh */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                Modelos Predictivos en Tiempo Real
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Inferencia Activa
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Pronósticos estequiométricos y termodinámicos entrenados con historiales de zafra y telemetría en vivo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {(["12h", "24h", "48h"] as const).map((h) => (
              <button
                key={h}
                onClick={() => setTimeHorizon(h)}
                className={`px-2.5 py-1 rounded transition ${
                  timeHorizon === h
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {h}
              </button>
            ))}
          </div>

          <button
            onClick={loadPredictions}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            <span>Recalcular</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid: Production & Energy Forecasts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Sugar Output Forecast */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Scale className="w-4 h-4 text-amber-400" />
                Azúcar Proyectado ({timeHorizon})
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Rend. {prodPred?.sugarYieldForecastPercent || 10.95}%
              </span>
            </div>
            <div className="text-2xl font-bold font-tech text-white">
              {prodPred ? prodPred.sugarTonsForecast24h.toLocaleString() : "..."}{" "}
              <span className="text-xs font-mono font-normal text-slate-400">toneladas</span>
            </div>
            <div className="text-xs font-mono text-amber-300/90 mt-1">
              ≈ {prodPred ? prodPred.sugarBagsForecast24h.toLocaleString() : "..."} sacos (50 kg)
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Extracción Sacarosa:</span>
            <span className="text-white font-bold">{prodPred?.sucroseExtractionForecast || 95.8}%</span>
          </div>
        </div>

        {/* Card 2: Cane Milling Accumulation */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Molienda Proyectada
              </span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                TCH Próx. 1h: {prodPred?.predictedTchNext1h || 450}
              </span>
            </div>
            <div className="text-2xl font-bold font-tech text-white">
              {prodPred ? prodPred.caneAccumTodayForecastTons.toLocaleString() : "..."}{" "}
              <span className="text-xs font-mono font-normal text-slate-400">t caña</span>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              Ritmo sostenido: {telemetry.tch} TCH instantáneo
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Confianza IA:</span>
            <span className="text-emerald-400 font-bold">{prodPred?.confidenceScore || 94}%</span>
          </div>
        </div>

        {/* Card 3: Energy Export & Revenue */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-yellow-400" />
                Despacho Eléctrico ({timeHorizon})
              </span>
              <span className="text-[10px] font-mono text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                {telemetry.powerExportGridMW} MW Activo
              </span>
            </div>
            <div className="text-2xl font-bold font-tech text-white">
              {energyPred ? energyPred.projectedExport24hMWh.toLocaleString() : "..."}{" "}
              <span className="text-xs font-mono font-normal text-slate-400">MWh netos</span>
            </div>
            <div className="text-xs font-mono text-emerald-400 mt-1 flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              Ingreso: ${energyPred ? energyPred.projectedRevenue24hUSD.toLocaleString() : "..."} USD
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>PPA Tarifa:</span>
            <span className="text-white font-bold">$78.50 / MWh</span>
          </div>
        </div>

        {/* Card 4: Bagasse Balance & Energy Index */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Flame className="w-4 h-4 text-orange-400" />
                Balance de Bagazo
              </span>
              <span className="text-[10px] font-mono text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                Humedad: {telemetry.bagasseMoisture}%
              </span>
            </div>
            <div className="text-2xl font-bold font-tech text-white">
              +{energyPred?.bagasseSurplusStorageTph || 14.8}{" "}
              <span className="text-xs font-mono font-normal text-slate-400">t/h a patio</span>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              Producción {energyPred?.bagasseTotalProducedTph || 126} t/h vs Calderas {energyPred?.bagasseBurnedBoilersTph || 111.2} t/h
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Índice Eficiencia:</span>
            <span className="text-cyan-400 font-bold">{energyPred?.energyEfficiencyIndexPercent || 88.4}%</span>
          </div>
        </div>
      </div>

      {/* Mid Section: Thermodynamic Steam Balance & Losses Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Steam & Losses Breakdown (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                Balance de Vapor & Distribución de Pérdidas Fabriles
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/20">
              ASME PTC 4.1
            </span>
          </div>

          <div className="space-y-3">
            {/* Specific Steam Consumption Indicator */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-300 font-medium block">Consumo Específico de Vapor</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  Meta diseño ingenio: {energyPred?.targetSteamConsumptionKgPerKgCane || 0.46} kg vapor / kg caña
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold font-mono text-cyan-400">
                  {energyPred?.specificSteamConsumptionKgPerKgCane || 0.485} kg/kg
                </span>
                <span className="text-[10px] font-mono block text-emerald-400">
                  Óptimo (Margen +5.4%)
                </span>
              </div>
            </div>

            {/* Losses Progress Breakdown */}
            <div className="space-y-2.5 pt-2">
              <span className="text-xs font-bold text-slate-300 font-tech uppercase tracking-wider block">
                Pérdidas de Sacarosa y Térmicas Estimadas
              </span>

              {/* Loss 1: Bagasse Pol */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Pérdida de Pol en Bagazo (Tándem de Molienda)</span>
                  <span className="text-amber-400 font-bold">{prodPred?.losses.bagassePolLossPercent || 1.82}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-amber-400 h-2 rounded-full" style={{ width: "36%" }}></div>
                </div>
              </div>

              {/* Loss 2: Final Molasses */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Pérdida en Miel Final (Melaza Agotada)</span>
                  <span className="text-rose-400 font-bold">{prodPred?.losses.finalMolassesLossPercent || 6.45}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-rose-400 h-2 rounded-full" style={{ width: "65%" }}></div>
                </div>
              </div>

              {/* Loss 3: Filter Cake */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Pérdida en Cachaza (Filtros Rotativos al Vacío)</span>
                  <span className="text-cyan-400 font-bold">{prodPred?.losses.filterCakeLossPercent || 0.42}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-cyan-400 h-2 rounded-full" style={{ width: "15%" }}></div>
                </div>
              </div>

              {/* Loss 4: Undetermined */}
              <div>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Pérdidas Indeterminadas e Inversión Térmica</span>
                  <span className="text-indigo-400 font-bold">{prodPred?.losses.undeterminedLossPercent || 0.75}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div className="bg-indigo-400 h-2 rounded-full" style={{ width: "22%" }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Risk Top 5 Matrix (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                Matriz de Riesgo Operativo (48h)
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
              RUL Predictivo
            </span>
          </div>

          <div className="space-y-2.5">
            {equipmentRisks.slice(0, 4).map((risk) => (
              <div
                key={risk.equipmentId}
                className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg hover:border-slate-700 transition space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white block">
                    {risk.name} <span className="text-[10px] font-mono text-slate-500">({risk.code})</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      risk.failureProbability48h > 30
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : risk.failureProbability48h > 15
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    }`}
                  >
                    Falla: {risk.failureProbability48h}%
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between font-mono">
                  <span>Factor Crítico: <strong className="text-amber-300">{risk.primaryStressFactor}</strong></span>
                  <span>RUL: <strong className="text-white">{risk.remainingUsefulLifeHours} h</strong></span>
                </div>

                <div className="text-[11px] text-slate-300 bg-slate-900/80 p-2 rounded border border-slate-800 flex items-start gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                  <span className="leading-tight text-slate-300">{risk.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
