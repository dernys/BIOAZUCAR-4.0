import React, { useState } from "react";
import {
  TrendingUp,
  Zap,
  Flame,
  Wheat,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  Droplets,
  Package,
  Layers,
  Sparkles,
  RefreshCw,
  Cpu,
  BarChart3,
  Info,
  Radio,
} from "lucide-react";
import { TelemetryData, UserRole, DataLineageInfo } from "../types";
import { kpiEngine } from "../services/kpiEngine";
import { DataLineageModal } from "./DataLineageModal";

interface DashboardOverviewProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
  onNavigateToTab: (tabId: any) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  telemetry,
  currentRole,
  onNavigateToTab,
}) => {
  const [selectedLineage, setSelectedLineage] = useState<DataLineageInfo | null>(null);

  const handleOpenLineage = (kpiId: string) => {
    const lineage = kpiEngine.calculateDataLineage(kpiId, new Map(), telemetry);
    setSelectedLineage(lineage);
  };

  return (
    <div className="space-y-6">
      {/* Provenance & Environment Notice Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <span className="font-bold text-slate-200">ORIGEN DE DATOS INDUSTRIALES:</span>{" "}
            <span className="font-mono text-amber-400 font-semibold">SIMULACIÓN DETERMINISTA (IEC 62443 / ISA-95)</span>
            <p className="text-[11px] text-slate-400">
              Desarrollo activo en Google AI Studio sin enlace OT directo. Haz clic en "Linaje" en cualquier tarjeta para auditar fórmulas y tags.
            </p>
          </div>
        </div>
        <button
          id="btn-inspect-global-lineage"
          onClick={() => handleOpenLineage("kpi-tch")}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 self-start sm:self-auto transition shrink-0"
        >
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          Auditar Linaje de Proceso
        </button>
      </div>

      {/* Top Banner: Shift Summary & Key Operational Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Molienda */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/50 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Recepción & Molienda
              </span>
              <button
                onClick={() => handleOpenLineage("kpi-tch")}
                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition"
                title="Ver fórmula y tags de linaje"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-tech text-white">
                {telemetry.tch}
              </span>
              <span className="text-xs font-mono text-emerald-400 font-semibold">TCH</span>
            </div>
          </div>
          <div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Acumulado hoy:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {(telemetry.caneAccumToday ?? 0).toLocaleString()} t
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>Extracción Tándem:</span>
              <button
                onClick={() => handleOpenLineage("kpi-extraction")}
                className="font-mono text-emerald-400 font-semibold hover:underline"
              >
                {telemetry.millingExtraction}%
              </button>
            </div>
          </div>
        </div>

        {/* KPI 2: Bagazo & Biomasa */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/50 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Bagazo Disponible
              </span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                <Layers className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-tech text-white">
                {telemetry.bagasseProductionRate}
              </span>
              <span className="text-xs font-mono text-amber-400 font-semibold">t/h prod</span>
            </div>
          </div>
          <div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Quemado Calderas:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {telemetry.bagasseBoilerConsumption} t/h
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>Excedente a Patio:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                +{telemetry.bagasseYardStorageRate} t/h (Hum: {telemetry.bagasseMoisture}%)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 3: Vapor Calderas */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-cyan-500/50 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Generación Vapor HP
              </span>
              <button
                onClick={() => handleOpenLineage("kpi-steam-hp")}
                className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition"
                title="Ver fórmula y tags de linaje"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-tech text-white">
                {telemetry.boilerPressureHP}
              </span>
              <span className="text-xs font-mono text-cyan-400 font-semibold">bar</span>
              <span className="text-sm text-slate-400 font-mono">({telemetry.steamFlowHP} t/h)</span>
            </div>
          </div>
          <div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Temperatura Vapor:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {telemetry.boilerTempHP} °C
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>Eficiencia Caldera:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {telemetry.boilerEfficiency}% (O2: {telemetry.flueGasO2}%)
              </span>
            </div>
          </div>
        </div>

        {/* KPI 4: Cogeneración Eléctrica */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 relative overflow-hidden group hover:border-yellow-500/50 transition flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Cogeneración & Red
              </span>
              <button
                onClick={() => handleOpenLineage("kpi-power-export")}
                className="p-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition"
                title="Ver fórmula y tags de linaje"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-tech text-white">
                {telemetry.powerGeneratedMW}
              </span>
              <span className="text-xs font-mono text-yellow-400 font-semibold">MW Gen</span>
            </div>
          </div>
          <div>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Consumo Ingenio:</span>
              <span className="font-mono text-slate-300 font-semibold">
                {telemetry.powerInternalMW} MW
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5" /> Excedente Red:
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {telemetry.powerExportGridMW} MW ({telemetry.gridVoltageKV} kV)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Production & OEE Summary Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Azúcar y Rendimiento */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              Producción de Azúcar & Melaza
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Rend: {telemetry.factoryRecoveryYield}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 my-2">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400">Azúcar Hoy</span>
              <div className="text-lg font-bold font-tech text-white mt-0.5">
                {(telemetry.sugarProductionTonsToday ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">t</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-mono">
                {(telemetry.sugarBagsToday ?? 0).toLocaleString()} sacos (50kg)
              </span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400">Melaza / Miel B</span>
              <div className="text-lg font-bold font-tech text-white mt-0.5">
                {(telemetry.molassesProductionTons ?? 0).toLocaleString()} <span className="text-xs font-normal text-slate-400">t</span>
              </div>
              <span className="text-[10px] text-amber-400 font-mono">
                Brix Meladura: {telemetry.evaporatorSyrupBrix ?? 0}°Bx
              </span>
            </div>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-1">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (((telemetry.sugarProductionTonsToday ?? 0) / 1000) * 100))}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-slate-400 mt-1.5 flex justify-between">
            <span>Meta de turno: 1,000 t</span>
            <span className="font-mono text-emerald-300 font-semibold">
              {((telemetry.sugarProductionTonsToday / 1000) * 100).toFixed(1)}% completado
            </span>
          </span>
        </div>

        {/* OEE Global Industrial */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cyan-400" />
              Eficiencia Global de Planta (OEE)
            </span>
            <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
              {telemetry.oeeOverall}% OEE
            </span>
          </div>

          <div className="space-y-2.5 my-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Disponibilidad (Tiempo Operativo):</span>
                <span className="font-mono text-white font-semibold">{telemetry.oeeAvailability}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${telemetry.oeeAvailability}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Rendimiento (Velocidad Molienda):</span>
                <span className="font-mono text-white font-semibold">{telemetry.oeePerformance}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${telemetry.oeePerformance}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Calidad (Pureza & Pol Sacarosa):</span>
                <span className="font-mono text-white font-semibold">{telemetry.oeeQuality}%</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${telemetry.oeeQuality}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
            <span>Clasificación World Class:</span>
            <span className="font-mono text-emerald-400 font-semibold">&gt; 85.0% (Excelente)</span>
          </div>
        </div>

        {/* AI & Quick Navigation Card */}
        <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Asistente & Gemelo Digital
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Gemini 3.7 Online
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1">
              El motor de IA industrial monitoriza 482 variables en tiempo real. Balance de vapor y despacho eléctrico sincronizados con el despacho nacional.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => onNavigateToTab("digital_twin")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ver Planta 3D</span>
            </button>

            <button
              onClick={() => onNavigateToTab("ai_center")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/40 text-xs font-semibold text-indigo-200 border border-indigo-500/40 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Diagnóstico IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mass & Energy Balance Flow (Balance de Masa y Energía Integrado) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white font-tech tracking-wide flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Balance de Masa y Energía en Tiempo Real (Caña → Azúcar & Bagazo → Electricidad)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Simulación de flujo continuo ISA-88/95 con correlación termodinámica instantánea
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Flujo Azucarero
            </span>
            <span className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Bagazo
            </span>
            <span className="flex items-center gap-1.5 text-cyan-400">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Vapor HP/LP
            </span>
            <span className="flex items-center gap-1.5 text-yellow-400">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Electricidad MW
            </span>
          </div>
        </div>

        {/* Dynamic Dual Stream Visualizer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center bg-slate-950/70 p-4 rounded-xl border border-slate-800/80">
          {/* Node 1: Recepción de Caña */}
          <div className="lg:col-span-2 bg-slate-900/90 p-3 rounded-lg border border-emerald-500/40 text-center">
            <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold block">
              1. Caña de Azúcar
            </span>
            <div className="text-xl font-bold font-tech text-white mt-1">
              {telemetry.tch} <span className="text-xs text-slate-400 font-normal">TCH</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Brix: {telemetry.caneBrix}° | Pol: {telemetry.canePol}%
            </div>
          </div>

          {/* Arrow split */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
            <ArrowRight className="w-5 h-5 text-emerald-400" />
            <span className="text-[9px] text-slate-400 mt-0.5">Tándem 5M</span>
          </div>

          {/* Center Column: 2 Streams */}
          <div className="lg:col-span-6 space-y-3">
            {/* Stream A: Jugo a Azúcar */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-emerald-300 block">
                    Jugo Mixto ({telemetry.clarifiedJuiceFlow} m³/h)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Clarificación → Evaporador Cuádruple (Meladura {telemetry.evaporatorSyrupBrix}°Bx)
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-bold text-emerald-400 block">
                  {(telemetry.sugarBagsToday ?? 0).toLocaleString()} sacos
                </span>
                <span className="text-[10px] text-slate-400">
                  {(telemetry.sugarProductionTonsToday ?? 0).toFixed(1)} t Azúcar
                </span>
              </div>
            </div>

            {/* Stream B: Bagazo a Energía */}
            <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-xs font-semibold text-amber-300 block">
                    Bagazo Verde ({telemetry.bagasseProductionRate} t/h)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Caldera {telemetry.boilerPressureHP} bar ({telemetry.steamFlowHP} t/h Vapor) → Turbina 35 MVA
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs font-bold text-yellow-400 block">
                  {telemetry.powerGeneratedMW} MW
                </span>
                <span className="text-[10px] text-emerald-400">
                  +{telemetry.powerExportGridMW} MW Red
                </span>
              </div>
            </div>
          </div>

          {/* Arrow to outputs */}
          <div className="lg:col-span-1 flex flex-col items-center justify-center text-slate-500 font-mono text-xs">
            <ArrowRight className="w-5 h-5 text-yellow-400" />
            <span className="text-[9px] text-slate-400 mt-0.5">Despacho</span>
          </div>

          {/* Node 3: Salidas Comerciales */}
          <div className="lg:col-span-2 space-y-2">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-emerald-500/40 text-center">
              <span className="text-[9px] uppercase tracking-wider text-emerald-300 font-bold block">
                Azúcar Comercial
              </span>
              <span className="text-sm font-bold font-tech text-white">
                {telemetry.sugarProductionTonsToday.toFixed(1)} t
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-yellow-500/40 text-center">
              <span className="text-[9px] uppercase tracking-wider text-yellow-300 font-bold block">
                Energía a Red 138kV
              </span>
              <span className="text-sm font-bold font-tech text-yellow-300">
                {telemetry.powerExportGridMW} MW
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data Lineage Modal */}
      <DataLineageModal lineage={selectedLineage} onClose={() => setSelectedLineage(null)} />
    </div>
  );
};
