import React from "react";
import {
  Factory,
  Flame,
  Zap,
  Droplets,
  Layers,
  ArrowRight,
  ChevronRight,
  TrendingUp,
  Activity,
  AlertTriangle,
  Scale,
  Sparkles,
  Info,
  Radio,
  Wifi,
} from "lucide-react";
import {
  TwinAssetMetadata,
  TwinEquipmentState,
  ProcessFlowConnection,
  TwinOperationalMode,
} from "../../services/digitaltwin/domain/DigitalTwinTypes";
import { CANONICAL_TWIN_ASSETS } from "../../services/digitaltwin/domain/TwinAssetCatalog";

interface ProcessDiagramTwinViewProps {
  flows: ProcessFlowConnection[];
  equipmentStates: Record<string, TwinEquipmentState>;
  selectedEquipmentId: string;
  onSelectEquipment: (id: string) => void;
  operationalMode: TwinOperationalMode;
  theme?: "dark" | "light";
}

export const ProcessDiagramTwinView: React.FC<ProcessDiagramTwinViewProps> = ({
  flows,
  equipmentStates,
  selectedEquipmentId,
  onSelectEquipment,
  operationalMode,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  // Helper to get flow rate
  const getFlow = (flowId: string) => flows.find((f) => f.id === flowId);

  // Sugar line assets
  const sugarLineAssets = [
    { id: "eq-patio-cana", label: "Recepción & Batey", stage: "Caña Entera" },
    { id: "eq-preparacion", label: "Preparación & Desfibrador", stage: "Caña Preparada" },
    { id: "eq-molino-1", label: "Molino 1 Primario", stage: "Jugo Primera Presión" },
    { id: "eq-molino-3", label: "Molino 3 Intermedio", stage: "Maceración" },
    { id: "eq-molino-6", label: "Molino 6 Extractor", stage: "Imbibición Compuesta" },
    { id: "eq-clarificador", label: "Clarificación Rápida", stage: "Jugo Clarificado" },
    { id: "eq-evaporadores", label: "Evaporación Cuádruple", stage: "Meladura 66.8°Bx" },
    { id: "eq-tachos-cristalizacion", label: "Tachos al Vacío", stage: "Masa Cocida A" },
    { id: "eq-secador-ensacado", label: "Secado & Ensacado", stage: "Azúcar Terminado" },
  ];

  // Energy & Cogen cycle assets
  const energyLineAssets = [
    { id: "eq-molino-6", label: "Molino 6 (Bagazo)", metric: "Bagazo 48.8% Hum" },
    { id: "eq-caldera-1", label: "Caldera Biomasa 65 bar", metric: "Vapor HP 485°C" },
    { id: "eq-turbina-1", label: "Turbogenerador TG1", metric: "Extracción 2.2 bar" },
    { id: "eq-subestacion", label: "Subestación 138 kV", metric: "Despacho Fiscal SEN" },
  ];

  return (
    <div className="space-y-6">
      {/* SECTION 1: PROCESO FABRIL AZUCARERO (MATERIAL FLOW) */}
      <div
        className={`p-5 rounded-2xl border transition shadow-xl ${
          isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-tech uppercase tracking-wider text-emerald-400">
                1. Línea Principal de Proceso Azucarero (Flujo de Masa Sacarosa)
              </h3>
              <p className="text-xs text-slate-400">
                Caña en Batey ➔ Preparación ➔ Molienda Tándem ➔ Clarificación ➔ Evaporación ➔ Cristalización ➔ Azúcar
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
            Flujo Continuo Gravitacional / Bombeo
          </span>
        </div>

        {/* Process Flow Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5">
          {sugarLineAssets.map((item, idx) => {
            const asset = CANONICAL_TWIN_ASSETS.find((a) => a.id === item.id);
            const state = equipmentStates[item.id];
            const isSelected = selectedEquipmentId === item.id;

            return (
              <div key={item.id} className="relative flex flex-col justify-between">
                <button
                  onClick={() => onSelectEquipment(item.id)}
                  className={`w-full p-3 rounded-xl border text-left transition flex flex-col justify-between h-full ${
                    isSelected
                      ? "bg-emerald-500/15 border-emerald-500 shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-400"
                      : isLight
                      ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      : "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        P{idx + 1} • {asset?.code || "EQ"}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          state?.currentState === "FAULT"
                            ? "bg-rose-500 animate-ping"
                            : state?.currentState === "WARNING"
                            ? "bg-amber-400 animate-pulse"
                            : "bg-emerald-400"
                        }`}
                      />
                    </div>
                    <h4 className="text-xs font-bold text-slate-100 leading-tight mb-1">
                      {item.label}
                    </h4>
                    <span className="text-[10px] text-emerald-400 font-mono block">
                      {item.stage}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">Estado:</span>
                    <span
                      className={`font-bold ${
                        state?.currentState === "WARNING" ? "text-amber-400" : "text-emerald-400"
                      }`}
                    >
                      {state?.currentState || "RUNNING"}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CICLO TERMODINÁMICO DE COGENERACIÓN (ENERGY FLOW) */}
      <div
        className={`p-5 rounded-2xl border transition shadow-xl ${
          isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
        }`}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold font-tech uppercase tracking-wider text-amber-400">
                2. Ciclo Termodinámico & Cogeneración Eléctrica (Flujo Energético)
              </h3>
              <p className="text-xs text-slate-400">
                Bagazo de Molienda ➔ Caldera Biomasa 65 bar ➔ Colector Vapor HP ➔ Turbina TG1 ➔ Electricidad al SEN + Vapor Escape a Fábrica
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
            Balance ASME PTC 4 / Contrapresión
          </span>
        </div>

        {/* Energy Flow Topology Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {energyLineAssets.map((item, idx) => {
            const asset = CANONICAL_TWIN_ASSETS.find((a) => a.id === item.id);
            const state = equipmentStates[item.id];
            const isSelected = selectedEquipmentId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectEquipment(item.id)}
                className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400"
                    : isLight
                    ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                    : "bg-slate-950/80 hover:bg-slate-800/80 border-slate-800"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      FASE {idx + 1} • {asset?.code}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                        state?.currentState === "WARNING"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}
                    >
                      {state?.currentState || "RUNNING"}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{item.label}</h4>
                  <span className="text-xs text-amber-400 font-mono font-bold block">
                    {item.metric}
                  </span>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
                  <span>Confiabilidad:</span>
                  <span className="text-emerald-400 font-bold">
                    {((state?.stateConfidence || 0.98) * 100).toFixed(0)}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Animated Flow Conduit Summary */}
        <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
            <div>
              <span className="text-slate-500 text-[10px] block">Combustible a Caldera:</span>
              <span className="text-amber-300 font-bold">
                {getFlow("flow-mat-m6-boiler")?.currentRate || 97.5} t/h bagazo
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <div>
              <span className="text-slate-500 text-[10px] block">Vapor HP Colector Principal:</span>
              <span className="text-cyan-300 font-bold">
                {getFlow("flow-energy-boiler-turbine")?.currentRate || 211.5} t/h (65 bar)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <span className="text-slate-500 text-[10px] block">Excedente Eléctrico SEN:</span>
              <span className="text-emerald-400 font-bold">
                {getFlow("flow-energy-turbine-substation")?.currentRate || 21.2} MW inyectados
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
