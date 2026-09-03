import React from "react";
import {
  X,
  Layers,
  Cpu,
  Database,
  ShieldAlert,
  ShieldCheck,
  Radio,
  ArrowRight,
  Sparkles,
  Info,
  Clock,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { DataLineageInfo, DataQuality, DataSourceType } from "../types";

interface DataLineageModalProps {
  lineage: DataLineageInfo | null;
  onClose: () => void;
}

export const DataLineageModal: React.FC<DataLineageModalProps> = ({
  lineage,
  onClose,
}) => {
  if (!lineage) return null;

  const getQualityBadge = (quality: DataQuality) => {
    switch (quality) {
      case "GOOD":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> BUENA (GOOD)
          </span>
        );
      case "SIMULATED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Sparkles className="w-3 h-3" /> SIMULADA (TEST)
          </span>
        );
      case "UNCERTAIN":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <ShieldAlert className="w-3 h-3" /> DUDOSA (UNCERTAIN)
          </span>
        );
      case "BAD":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-3 h-3" /> MALA (BAD)
          </span>
        );
    }
  };

  const getSourceBadge = (source: DataSourceType) => {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <Radio className="w-3 h-3" /> {source}
      </span>
    );
  };

  return (
    <div
      id="modal-data-lineage-overlay"
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        id="modal-data-lineage-container"
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Trazabilidad y Linaje de Datos
                </h3>
                <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  IEC 62443 / ISA-95
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Auditoría de procedencia de variable industrial y fórmula de cálculo
              </p>
            </div>
          </div>
          <button
            id="btn-close-data-lineage-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* KPI Target Overview */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Variable / Indicador Calculado
              </span>
              <h4 className="text-xl font-bold text-white mt-0.5">{lineage.kpiName}</h4>
              {lineage.description && (
                <p className="text-xs text-slate-400 mt-1">{lineage.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4 bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-lg">
              <div className="text-right">
                <span className="text-xs text-slate-400">Valor Actual</span>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {typeof lineage.kpiValue === "number" ? lineage.kpiValue.toFixed(2) : lineage.kpiValue}{" "}
                  <span className="text-xs text-slate-300 font-sans">{lineage.unit}</span>
                </div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="space-y-1">
                {getQualityBadge(lineage.overallQuality)}
                <div>{getSourceBadge(lineage.overallSource)}</div>
              </div>
            </div>
          </div>

          {/* Mathematical Formula / Calculation Lineage */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              Fórmula / Método de Ingestión
            </span>
            <div className="bg-slate-950 font-mono text-sm text-cyan-300 p-3 rounded-lg border border-cyan-900/40 flex items-center gap-2">
              <span className="text-slate-500 select-none">ƒ(x) =</span>
              <span>{lineage.formula}</span>
            </div>
          </div>

          {/* Input Tags Hierarchy / Ingestion Chain */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              Tags de Entrada & Equipos de Origen ({lineage.inputTags.length})
            </span>

            {lineage.inputTags.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-4 bg-slate-950/40 rounded-lg text-center border border-slate-800">
                Lectura directa sin dependencias jerárquicas adicionales.
              </div>
            ) : (
              <div className="space-y-2.5">
                {lineage.inputTags.map((tag, idx) => (
                  <div
                    key={`${tag.tag}-${idx}`}
                    className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3.5 hover:border-slate-700 transition space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {tag.tag}
                        </span>
                        <span className="text-xs text-slate-300">{tag.tagName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getQualityBadge(tag.quality)}
                        {getSourceBadge(tag.source)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                      <div>
                        <span className="text-slate-500">Equipo:</span>
                        <p className="text-slate-300 font-medium">{tag.equipmentName}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Valor Leído:</span>
                        <p className="text-emerald-400 font-mono font-bold">
                          {tag.value} {tag.unit}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Protocolo:</span>
                        <p className="text-cyan-400 font-mono">{tag.protocol}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Timestamp:</span>
                        <p className="text-slate-400 font-mono text-[11px] truncate">
                          {tag.timestamp ? new Date(tag.timestamp).toLocaleTimeString() : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OT/IT Environment Notice */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-300/90">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-amber-300">Aviso de Entorno de Desarrollo:</span>
              <p>
                Este punto de datos está alimentado por el proveedor de simulación determinista{" "}
                <span className="font-mono font-bold text-white">SIMULATION</span>. Al conectar los gateways
                físicos (OPC-UA, MQTT Sparkplug B, Modbus o EROS), los valores y timestamps reflejarán el bus
                de campo en tiempo real sin requerir cambios en las fórmulas de cálculo.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Última actualización: {new Date(lineage.timestamp).toLocaleString()}
          </span>
          <button
            id="btn-close-data-lineage-footer"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-xs font-semibold transition"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
