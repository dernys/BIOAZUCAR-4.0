import React, { useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  ShieldAlert,
} from "lucide-react";
import { ActionConfirmationRequest } from "../domain/CopilotTypes";

interface CopilotConfirmationProps {
  request: ActionConfirmationRequest;
  onConfirm: (payload: Record<string, any>) => void;
  onCancel: () => void;
}

export const CopilotConfirmation: React.FC<CopilotConfirmationProps> = ({
  request,
  onConfirm,
  onCancel,
}) => {
  const isLevel3 = request.level === 3;
  const perfection = request.perfectionSuggestion || request.payload?.perfectionSuggestion;
  const hasPerfection = Boolean(perfection && perfection.recommendedValue !== undefined);

  const [useRecommended, setUseRecommended] = useState<boolean>(hasPerfection);
  const [operatorNotes, setOperatorNotes] = useState("");

  const activeValue = useRecommended && hasPerfection ? perfection!.recommendedValue : request.proposedValue;

  return (
    <div
      className={`my-3 p-4 rounded-xl border shadow-xl flex flex-col gap-3 transition-all ${
        isLevel3
          ? "bg-slate-950/95 border-rose-500/70 text-rose-100 shadow-rose-950/30"
          : "bg-slate-950/95 border-amber-500/70 text-amber-100 shadow-amber-950/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${isLevel3 ? "text-rose-400 animate-pulse" : "text-amber-400"}`}
          />
          <div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider block">
              {isLevel3 ? "⚠️ ACCIÓN CRÍTICA DE CONTROL OT (NIVEL 3)" : "CONFIRMACIÓN DE OPERACIÓN INDUSTRIAL (NIVEL 2)"}
            </span>
            <span className="text-sm font-bold text-white">{request.title}</span>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-900 border border-slate-700 text-slate-300">
          Req: {request.requiredPermission}
        </span>
      </div>

      <p className="text-xs text-slate-200 leading-relaxed font-sans">{request.description}</p>

      {/* Sugerencia de Perfeccionamiento IA (Action Advisory Layer) */}
      {hasPerfection && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-cyan-950/60 to-emerald-950/60 border border-cyan-500/40 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
              Sugerencia de Perfeccionamiento BioAI (Ingeniería de Primeros Principios)
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-200">
              Confianza: {perfection!.confidenceScore || 95}%
            </span>
          </div>

          <p className="text-xs text-slate-200 leading-relaxed font-sans">{perfection!.rationale}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            {perfection!.efficiencyGain && (
              <div className="p-2 rounded bg-slate-950/80 border border-emerald-900/60 text-emerald-300 flex items-start gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                <div>
                  <strong className="text-emerald-200 block text-[10px]">GANANCIA DE EFICIENCIA:</strong>
                  {perfection!.efficiencyGain}
                </div>
              </div>
            )}
            {perfection!.riskMitigation && (
              <div className="p-2 rounded bg-slate-950/80 border border-amber-900/60 text-amber-300 flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
                <div>
                  <strong className="text-amber-200 block text-[10px]">MITIGACIÓN DE RIESGO:</strong>
                  {perfection!.riskMitigation}
                </div>
              </div>
            )}
          </div>

          {perfection!.thermodynamicBasis && (
            <div className="text-[10px] font-mono text-cyan-300/80 bg-slate-950/60 px-2 py-1 rounded border border-cyan-900/40">
              <strong>Base Termodinámica / Estándar:</strong> {perfection!.thermodynamicBasis}
            </div>
          )}

          {/* Selector de Valor: Recomendado vs Solicitado */}
          <div className="mt-1 pt-2 border-t border-cyan-900/40 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-mono text-slate-400 mr-1">Seleccionar Valor a Aplicar:</span>
            <button
              type="button"
              onClick={() => setUseRecommended(true)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
                useRecommended
                  ? "bg-cyan-600 text-white border-cyan-400 shadow-md shadow-cyan-950"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Aplicar Sugerencia IA ({perfection!.recommendedValue} {request.unit || ""})
            </button>
            <button
              type="button"
              onClick={() => setUseRecommended(false)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1.5 border ${
                !useRecommended
                  ? "bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950"
                  : "bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              Mantener Original ({request.proposedValue} {request.unit || ""})
            </button>
          </div>
        </div>
      )}

      {/* Value Comparison Block */}
      {(request.currentValue !== undefined || activeValue !== undefined) && (
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">VALOR ACTUAL EN PLANTA</span>
            <span className="text-slate-200 font-bold">
              {request.currentValue} {request.unit || ""}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-cyan-400 block">VALOR A APLICAR SELECCIONADO</span>
            <span className={`font-bold text-sm ${useRecommended && hasPerfection ? "text-cyan-300" : "text-amber-300"}`}>
              {activeValue} {request.unit || ""}
              {useRecommended && hasPerfection && (
                <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-cyan-900 text-cyan-200 border border-cyan-700">
                  OPTIMIZADO IA
                </span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Operational Impact */}
      {request.operationalImpact && (
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
          <strong className="text-slate-400">Impacto Operacional:</strong> {request.operationalImpact}
        </div>
      )}

      {/* Operator Justification for Level 3 */}
      {isLevel3 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-mono text-slate-400">
            Justificación Operativa / Orden de Turno (Auditado con Hash SHA-256):
          </label>
          <input
            type="text"
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            placeholder="Ej: Aprobado por jefatura de turno para optimización de vapor..."
            className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {/* Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition flex items-center gap-1.5"
        >
          <XCircle className="w-3.5 h-3.5" /> Cancelar
        </button>

        <button
          onClick={() =>
            onConfirm({
              ...request.payload,
              value: activeValue,
              newValue: activeValue,
              exportMW: typeof activeValue === "number" ? activeValue : undefined,
              appliedValue: activeValue,
              wasPerfectionApplied: Boolean(useRecommended && hasPerfection),
              operatorNotes: operatorNotes || (useRecommended ? "Aplicada sugerencia de perfeccionamiento BioAI" : "Confirmado valor original por operador"),
            })
          }
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-lg ${
            isLevel3
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Confirmar & Ejecutar
        </button>
      </div>
    </div>
  );
};

