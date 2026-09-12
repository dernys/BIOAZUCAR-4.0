import React, { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { AgronomicAlert } from "../../types/agriculture";

interface AgronomicAlertsBannerProps {
  alerts: AgronomicAlert[];
  theme?: "dark" | "light";
}

export const AgronomicAlertsBanner: React.FC<AgronomicAlertsBannerProps> = ({
  alerts,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [isExpanded, setIsExpanded] = useState(false);

  if (!alerts || alerts.length === 0) {
    return (
      <div
        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          isLight
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-semibold">
            Inteligencia de Campo 4.0: Sin alertas críticas agronómicas ni desbalances operacionales detectados.
          </span>
        </div>
        <span className="text-[11px] font-mono opacity-80">Modelo Canónico PDA 100% Nominal</span>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === "CRITICAL").length;
  const warningCount = alerts.filter((a) => a.severity === "WARNING").length;

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        criticalCount > 0
          ? isLight
            ? "bg-rose-50/80 border-rose-200"
            : "bg-rose-950/20 border-rose-500/30"
          : isLight
          ? "bg-amber-50/80 border-amber-200"
          : "bg-amber-950/20 border-amber-500/30"
      }`}
    >
      {/* Banner Header */}
      <div className="p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg ${
              criticalCount > 0
                ? "bg-rose-500/20 text-rose-400"
                : "bg-amber-500/20 text-amber-400"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100">
                Inteligencia de Campo 4.0 — {alerts.length} Alerta{alerts.length > 1 ? "s" : ""} Agronómica{alerts.length > 1 ? "s" : ""} Activa{alerts.length > 1 ? "s" : ""}
              </span>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 font-mono">
                  {criticalCount} CRÍTICA{criticalCount > 1 ? "S" : ""}
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                  {warningCount} ADVERTENCIA{warningCount > 1 ? "S" : ""}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Supervisión de umbrales biológicos, balance de maquinaria y logística de zafra en tiempo real
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg border transition ${
            isLight
              ? "bg-white border-slate-300 text-slate-700 hover:bg-slate-100"
              : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          <span>{isExpanded ? "Ocultar Detalles" : "Ver Recomendaciones"}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Alert List */}
      {isExpanded && (
        <div
          className={`p-3.5 pt-0 grid grid-cols-1 md:grid-cols-2 gap-3 border-t ${
            isLight ? "border-slate-200" : "border-slate-800/80"
          }`}
        >
          {alerts.map((alert) => {
            const isCrit = alert.severity === "CRITICAL";
            const isWarn = alert.severity === "WARNING";
            return (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                  isCrit
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                    : isWarn
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {isCrit ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    )}
                    <span className="font-bold text-slate-100">{alert.title}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 font-mono text-slate-300">
                    {alert.category}
                  </span>
                </div>

                <p className="text-[11px] text-slate-300">{alert.message}</p>

                {alert.recommendation && (
                  <div className="mt-2 p-2 rounded bg-black/30 border border-white/5 flex items-start gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-slate-200">
                      <strong className="text-emerald-400">Recomendación:</strong> {alert.recommendation}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
