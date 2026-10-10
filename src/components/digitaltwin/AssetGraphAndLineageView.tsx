import React, { useState } from "react";
import {
  GitBranch,
  Layers,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  Radio,
  Wifi,
  Cpu,
  Info,
  Sliders,
  CheckCircle2,
  Share2,
  ExternalLink,
} from "lucide-react";
import {
  TwinAssetMetadata,
  TwinEquipmentState,
  TwinSensorDefinition,
  TwinActuatorDefinition,
  TwinVariableLineage,
  ProcessFlowConnection,
} from "../../services/digitaltwin/domain/DigitalTwinTypes";
import { CANONICAL_TWIN_ASSETS } from "../../services/digitaltwin/domain/TwinAssetCatalog";

interface AssetGraphAndLineageViewProps {
  selectedAsset: TwinAssetMetadata | undefined;
  selectedState: TwinEquipmentState | undefined;
  sensors: TwinSensorDefinition[];
  actuators: TwinActuatorDefinition[];
  flows: { incoming: ProcessFlowConnection[]; outgoing: ProcessFlowConnection[] };
  upstreamAssets: TwinAssetMetadata[];
  downstreamAssets: TwinAssetMetadata[];
  lineage: TwinVariableLineage | undefined;
  onSelectEquipment: (id: string) => void;
  theme?: "dark" | "light";
}

export const AssetGraphAndLineageView: React.FC<AssetGraphAndLineageViewProps> = ({
  selectedAsset,
  selectedState,
  sensors,
  actuators,
  flows,
  upstreamAssets,
  downstreamAssets,
  lineage,
  onSelectEquipment,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [activeSubTab, setActiveSubTab] = useState<"DETAILS" | "LINEAGE" | "TOPOLOGY">("DETAILS");

  if (!selectedAsset) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-xs">
        Selecciona un activo industrial en la vista 3D o diagrama para inspeccionar su grafo topológico.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Asset Header */}
      <div
        className={`p-5 rounded-2xl border transition shadow-xl ${
          isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono font-bold text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                {selectedAsset.code}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Área: {selectedAsset.areaId} • Nivel ISA-95: {selectedAsset.isa95Level}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-tech tracking-wide">
              {selectedAsset.name}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">{selectedAsset.description}</p>
          </div>

          <div className="flex items-center gap-3 font-mono">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block">ESTADO OPERACIONAL</span>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block ${
                  selectedState?.currentState === "FAULT"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                    : selectedState?.currentState === "WARNING"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                ● {selectedState?.currentState || "RUNNING"}
              </span>
            </div>

            <div className="text-right pl-3 border-l border-slate-800">
              <span className="text-[10px] text-slate-500 block">CONFIANZA DEL ESTADO</span>
              <span className="text-xs font-bold text-emerald-400">
                {((selectedState?.stateConfidence || 0.98) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Subtab Toggle Buttons */}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => setActiveSubTab("DETAILS")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
              activeSubTab === "DETAILS"
                ? "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Variables & Especificaciones</span>
          </button>

          <button
            onClick={() => setActiveSubTab("TOPOLOGY")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
              activeSubTab === "TOPOLOGY"
                ? "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Grafo Topológico Aguas Arriba / Abajo</span>
          </button>

          <button
            onClick={() => setActiveSubTab("LINEAGE")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 ${
              activeSubTab === "LINEAGE"
                ? "bg-cyan-600 text-white font-bold shadow-md shadow-cyan-600/30"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Trazabilidad de Linaje de Datos</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: DETAILS & TECHNICAL SPECS */}
      {activeSubTab === "DETAILS" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sensors (7 cols) */}
          <div
            className={`lg:col-span-7 p-5 rounded-2xl border transition shadow-xl ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
            }`}
          >
            <h3 className="text-sm font-bold font-tech uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <Radio className="w-4 h-4" />
              <span>Sensores & Transmisores Instrumentados ({sensors.length})</span>
            </h3>

            <div className="space-y-2.5">
              {sensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between font-mono text-xs"
                >
                  <div>
                    <span className="text-[10px] text-cyan-400 font-bold block">{sensor.tagId}</span>
                    <h4 className="font-bold text-slate-200">{sensor.name}</h4>
                    <span className="text-[10px] text-slate-500">
                      Dir. PLC: {sensor.plcMemoryAddress} • Protocolo: {sensor.protocol} • Escaneo: {sensor.scanRateMs}ms
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Rango: {sensor.rangeMin} a {sensor.rangeMax} {sensor.engineeringUnit}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Actuators */}
            {actuators.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold font-tech uppercase text-amber-400 mb-2">
                  Actuadores & Elementos Finales de Control ({actuators.length})
                </h4>
                <div className="space-y-2">
                  {actuators.map((act) => (
                    <div
                      key={act.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs"
                    >
                      <div>
                        <span className="font-bold text-slate-300">{act.name}</span>
                        <span className="text-[10px] text-slate-500 block">
                          Tipo: {act.actuatorType} • Posición Failsafe: {act.failsafePosition}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {act.interlockProtected ? "🔒 Enclavamiento Activo" : "Control Libre"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Technical Specs & Capacity (5 cols) */}
          <div
            className={`lg:col-span-5 p-5 rounded-2xl border transition shadow-xl font-mono text-xs ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
            }`}
          >
            <h3 className="text-sm font-bold font-tech uppercase tracking-wider text-emerald-400 mb-3">
              Capacidad de Diseño & Parámetros
            </h3>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Capacidad Nominal:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedAsset.designCapacity.nominalValue} {selectedAsset.designCapacity.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Máximo Seguro:</span>
                <span className="text-amber-400 font-bold">
                  {selectedAsset.designCapacity.maxSafeValue} {selectedAsset.designCapacity.unit}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mínimo Operativo:</span>
                <span className="text-slate-300 font-bold">
                  {selectedAsset.designCapacity.minSafeValue} {selectedAsset.designCapacity.unit}
                </span>
              </div>
            </div>

            <h4 className="text-[11px] font-bold text-slate-400 uppercase mb-2">Especificaciones Técnicas:</h4>
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
              {Object.entries(selectedAsset.technicalSpecs).map(([key, val]) => (
                <div key={key} className="flex justify-between text-[11px]">
                  <span className="text-slate-500 truncate max-w-[180px]">{key}:</span>
                  <span className="text-cyan-300 font-bold">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TOPOLOGY UPSTREAM / DOWNSTREAM */}
      {activeSubTab === "TOPOLOGY" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Upstream Assets */}
          <div
            className={`p-5 rounded-2xl border transition shadow-xl ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800 text-amber-400">
              <ArrowLeft className="w-4 h-4" />
              <h3 className="text-sm font-bold font-tech uppercase tracking-wider">
                Activos Aguas Arriba (Upstream / Alimenta a {selectedAsset.code})
              </h3>
            </div>

            {upstreamAssets.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4">
                No existen equipos intermedios aguas arriba; este activo recibe materia prima bruta directamente del exterior.
              </p>
            ) : (
              <div className="space-y-2.5">
                {upstreamAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelectEquipment(asset.id)}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-mono text-amber-400 font-bold block">{asset.code}</span>
                      <h4 className="text-xs font-bold text-white">{asset.name}</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Inspeccionar ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Downstream Assets */}
          <div
            className={`p-5 rounded-2xl border transition shadow-xl ${
              isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
            }`}
          >
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-800 text-cyan-400">
              <ArrowRight className="w-4 h-4" />
              <h3 className="text-sm font-bold font-tech uppercase tracking-wider">
                Activos Aguas Abajo (Downstream / Recibe de {selectedAsset.code})
              </h3>
            </div>

            {downstreamAssets.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono p-4">
                No existen equipos intermedios aguas abajo; este activo entrega producto final terminado.
              </p>
            ) : (
              <div className="space-y-2.5">
                {downstreamAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => onSelectEquipment(asset.id)}
                    className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 font-bold block">{asset.code}</span>
                      <h4 className="text-xs font-bold text-white">{asset.name}</h4>
                    </div>
                    <span className="text-xs text-slate-400 font-mono">Inspeccionar ➔</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: DATA LINEAGE VISUAL DRAWER */}
      {activeSubTab === "LINEAGE" && (
        <div
          className={`p-5 rounded-2xl border transition shadow-xl font-mono text-xs ${
            isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900/95 border-slate-800 text-slate-100"
          }`}
        >
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-800 text-emerald-400">
            <Share2 className="w-4 h-4" />
            <h3 className="text-sm font-bold font-tech uppercase tracking-wider">
              Linaje Criptográfico de Datos («¿De dónde salió este dato?»)
            </h3>
          </div>

          {lineage ? (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">VARIABLE MONITOREADA:</span>
                  <span className="text-sm font-bold text-white">{lineage.variableName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">CALIDAD DE DATO:</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    🟢 {lineage.quality}
                  </span>
                </div>
              </div>

              {/* Visual Breadcrumb Trace */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                  Cadena de Procedencia y Transporte OT/IT:
                </span>

                <div className="flex flex-col md:flex-row md:items-center gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                    <span className="text-[9px] text-slate-500 block">1. SENSOR FÍSICO</span>
                    <strong className="text-amber-300">{lineage.chain.sensorName}</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Dir: {lineage.chain.plcMemoryAddress}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 hidden md:block" />

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                    <span className="text-[9px] text-slate-500 block">2. PLC DE CAMPO</span>
                    <strong className="text-cyan-300">{lineage.chain.sourceDevice}</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Protocolo: {lineage.chain.protocol}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 hidden md:block" />

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                    <span className="text-[9px] text-slate-500 block">3. EDGE DAEMON</span>
                    <strong className="text-emerald-300">{lineage.chain.driverId}</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Sync Δ: {lineage.chain.deviceClockSyncDeltaMs}ms</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-600 shrink-0 hidden md:block" />

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex-1">
                    <span className="text-[9px] text-slate-500 block">4. CANONICAL TWIN</span>
                    <strong className="text-purple-300">{lineage.chain.tagPath}</strong>
                    <span className="text-[9px] text-slate-400 block mt-0.5">Proveniencia: {lineage.chain.provenance}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-500 p-4">Selecciona un sensor o activo para visualizar su cadena de linaje.</p>
          )}
        </div>
      )}
    </div>
  );
};
