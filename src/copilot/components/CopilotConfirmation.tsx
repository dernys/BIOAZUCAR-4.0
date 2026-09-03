import React, { useState } from "react";
import {
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Lock,
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
  const [operatorNotes, setOperatorNotes] = useState("");
  const isLevel3 = request.level === 3;

  return (
    <div
      className={`my-3 p-4 rounded-xl border shadow-xl flex flex-col gap-3 ${
        isLevel3
          ? "bg-rose-950/40 border-rose-600/70 text-rose-100"
          : "bg-amber-950/40 border-amber-500/70 text-amber-100"
      }`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${isLevel3 ? "text-rose-400 animate-bounce" : "text-amber-400"}`}
          />
          <div>
            <span className="text-xs font-bold font-mono uppercase tracking-wider block">
              {isLevel3 ? "⚠️ ACCIÓN CRÍTICA DE CONTROL (NIVEL 3)" : "CONFIRMACIÓN DE OPERACIÓN (NIVEL 2)"}
            </span>
            <span className="text-sm font-bold text-white">{request.title}</span>
          </div>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-900 border border-slate-700 text-slate-300">
          Req: {request.requiredPermission}
        </span>
      </div>

      <p className="text-xs text-slate-200 leading-relaxed font-sans">{request.description}</p>

      {/* Value Comparison Block */}
      {(request.currentValue !== undefined || request.proposedValue !== undefined) && (
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs font-mono">
          <div>
            <span className="text-[10px] text-slate-400 block">VALOR ACTUAL</span>
            <span className="text-slate-200 font-bold">
              {request.currentValue} {request.unit || ""}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-cyan-400 block">NUEVO VALOR SOLICITADO</span>
            <span className="text-cyan-300 font-bold text-sm">
              {request.proposedValue} {request.unit || ""}
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
            Justificación Operativa / Orden de Turno (Auditado en Cloud Firestore):
          </label>
          <input
            type="text"
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            placeholder="Ej: Instrucción de jefatura de turno para compensar vapor..."
            className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono"
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
              operatorNotes: operatorNotes || "Confirmado por operador en Copilot UI",
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
