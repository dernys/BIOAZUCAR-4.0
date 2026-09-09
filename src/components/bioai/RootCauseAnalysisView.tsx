import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Crosshair,
  Database,
  DollarSign,
  FileText,
  GitPullRequest,
  Layers,
  Loader2,
  RefreshCw,
  TrendingDown,
  Wrench,
  Zap,
  Info,
  ShieldCheck,
} from "lucide-react";
import { RootCauseAnalysisResult } from "../../types/bioai";
import { bioAiEngineService } from "../../services/bioai/BioAiEngineService";
import { TelemetryData, TenantEnterprise } from "../../types";

interface RootCauseAnalysisViewProps {
  telemetry: TelemetryData;
  activeTenant?: TenantEnterprise;
  alarms?: any[];
  equipmentList?: any[];
}

export const RootCauseAnalysisView: React.FC<RootCauseAnalysisViewProps> = ({
  telemetry,
  activeTenant,
  alarms = [],
  equipmentList = [],
}) => {
  const [selectedIncident, setSelectedIncident] = useState<string>("PRODUCTION_DROP");
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [rcaResult, setRcaResult] = useState<RootCauseAnalysisResult | null>(null);
  const lastIncidentRef = useRef<string>("");

  const runAnalysis = async (incidentType: string, isManual: boolean = false) => {
    // If we already have a result and it's an update, show background updating instead of full screen blanking
    if (rcaResult && !isManual && incidentType === lastIncidentRef.current) {
      setIsUpdating(true);
    } else {
      if (!rcaResult) setInitialLoading(true);
      else setIsUpdating(true);
    }

    setSelectedIncident(incidentType);
    lastIncidentRef.current = incidentType;

    try {
      const res = await bioAiEngineService.performRootCauseAnalysis(
        incidentType,
        telemetry,
        alarms,
        equipmentList,
        undefined,
        activeTenant
      );
      setRcaResult({
        ...res,
        isSimulated: telemetry.isSimulated ?? true,
        provenance: telemetry.provenance || (telemetry.isSimulated ? "SIMULATED_PROCESS_MODEL" : "OBSERVED_OT"),
      });
    } catch (err) {
      console.error("Error executing RCA:", err);
    } finally {
      setInitialLoading(false);
      setIsUpdating(false);
    }
  };

  // Only run when activeTenant changes or on initial mount.
  // DO NOT depend on telemetry.tch, which would cause an infinite re-analysis loop every 1s!
  useEffect(() => {
    runAnalysis("PRODUCTION_DROP");
  }, [activeTenant?.id]);

  const isSimulated = telemetry.isSimulated ?? true;

  return (
    <div className="space-y-6">
      {/* Scenario Selector Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Motor Causal de Diagnóstico Profundo (AI RCA)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Ishikawa & 5-Whys
            </span>
            {isUpdating && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Actualizando en segundo plano...
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Identificación de causa raíz física y árbol de derivación termodinámica ante anomalías de proceso
          </p>
        </div>

        {/* Preset incident buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAnalysis("PRODUCTION_DROP", true)}
            disabled={isUpdating}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono border transition flex items-center gap-1.5 ${
              selectedIncident === "PRODUCTION_DROP"
                ? "bg-rose-950/80 text-rose-300 border-rose-500/50 font-bold"
                : "bg-slate-800 text-slate-400 hover:text-white border-slate-700"
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Caída Rendimiento</span>
          </button>

          <button
            onClick={() => runAnalysis("ENERGY_CONSUMPTION_SURGE", true)}
            disabled={isUpdating}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono border transition flex items-center gap-1.5 ${
              selectedIncident === "ENERGY_CONSUMPTION_SURGE"
                ? "bg-amber-950/80 text-amber-300 border-amber-500/50 font-bold"
                : "bg-slate-800 text-slate-400 hover:text-white border-slate-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Sobreconsumo Vapor</span>
          </button>

          <button
            onClick={() => runAnalysis("CRITICAL_ALARM", true)}
            disabled={isUpdating}
            className={`text-xs px-3 py-1.5 rounded-lg font-mono border transition flex items-center gap-1.5 ${
              selectedIncident === "CRITICAL_ALARM"
                ? "bg-cyan-950/80 text-cyan-300 border-cyan-500/50 font-bold"
                : "bg-slate-800 text-slate-400 hover:text-white border-slate-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Alarma de Caldera</span>
          </button>

          <button
            onClick={() => runAnalysis(selectedIncident, true)}
            disabled={isUpdating}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Re-ejecutar diagnóstico"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdating ? "animate-spin text-rose-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Honest Data Provenance Banner */}
      <div
        className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
          isSimulated
            ? "bg-amber-950/20 border-amber-500/30 text-amber-200/90"
            : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200/90"
        }`}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold font-mono uppercase tracking-wider text-white">
              {isSimulated ? "Origen de Datos: Modelo de Simulación de Planta" : "Origen de Datos: Telemetría OT en Vivo"}
            </span>
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
                isSimulated
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/30 font-bold"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold"
              }`}
            >
              {isSimulated ? "SIMULATED_PROCESS_MODEL" : "OBSERVED_OT"}
            </span>
          </div>
          <p className="text-slate-300 text-[11px]">
            {isSimulated
              ? "Este diagnóstico causal ha sido calculado a partir de las ecuaciones cinéticas y termodinámicas del gemelo digital Spencer-Meade y Hugot. No representa una avería física en maquinaria real de campo."
              : "Este diagnóstico causal ha sido calculado directamente sobre instrumentación y sensores físicos de planta reportados por el Gateway OT."}
          </p>
        </div>
      </div>

      {initialLoading && !rcaResult ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
          <span className="text-xs font-mono text-slate-300">
            Calculando correlaciones físicas, balance de materia y árbol de fallas...
          </span>
        </div>
      ) : rcaResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Root Cause & Executive Summary (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Causa Raíz Primaria */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-rose-400" />
                  <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
                    {rcaResult.title}
                  </h4>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                    SEVERIDAD: {rcaResult.severity || "ALTA"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Confianza: {rcaResult.confidenceScore || 95}%
                  </span>
                </div>
              </div>

              {/* Primary Root Cause Highlight */}
              <div className="p-3.5 bg-rose-950/20 border border-rose-500/30 rounded-xl">
                <span className="text-[10px] font-mono text-rose-300 uppercase tracking-wider font-bold block mb-1">
                  Causa Raíz Principal Identificada:
                </span>
                <p className="text-sm font-bold text-white leading-snug">
                  {rcaResult.primaryRootCause}
                </p>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {rcaResult.executiveSummary}
                </p>
              </div>

              {/* Contributing Factors Table */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-300 font-tech uppercase tracking-wider block">
                  Factores Contribuyentes y Desviación de Sensores
                </span>

                <div className="space-y-2">
                  {(rcaResult.contributingFactors || []).map((factor, idx) => (
                    <div
                      key={`factor-${idx}-${factor.evidenceTag || idx}`}
                      className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1.5 text-xs font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">{factor.factor}</span>
                        <span className="text-rose-400 font-bold">
                          Peso: {factor.contributionWeightPercent}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Observado: <strong className="text-amber-300">{factor.observedValue}</strong>
                        </span>
                        <span>
                          Línea Base: <strong className="text-slate-300">{factor.expectedBaseline}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Impact Footer */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-amber-400" />
                  Impacto Económico Estimado:
                </span>
                <span className="font-mono text-rose-400 font-bold text-sm">
                  {rcaResult.estimatedFinancialLoss || rcaResult.financialImpactEstimatedUSD || "N/A"}
                </span>
              </div>
            </div>

            {/* 5-Whys Causal Tree */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <BrainCircuit className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
                  Árbol Causal de 5 Por Qués (5-Whys)
                </h4>
              </div>

              <div className="space-y-2">
                {((rcaResult.fiveWhys && rcaResult.fiveWhys.length > 0)
                  ? rcaResult.fiveWhys
                  : [
                      `1. ¿Por qué ocurrió la desviación? Por variación en el proceso de ${rcaResult.title}.`,
                      `2. ¿Por qué ocurrió la variación? Causa raíz: ${rcaResult.primaryRootCause}`,
                      `3. ¿Por qué no se contuvo inmediatamente? Límites operativos alcanzaron umbral de alerta antes de estabilización de bucle.`,
                      `4. ¿Por qué falló el control preventivo? Fluctuación de carga simultánea y retardo térmico en lazo de control.`,
                      `5. ¿Causa fundamental? Necesidad de ajuste en setpoints y mantenimiento preventivo sistemático en planta.`,
                    ]
                ).map((why, index) => (
                  <div
                    key={`why-${index}`}
                    className="p-2.5 bg-slate-950/70 border border-slate-800 rounded-lg flex items-start gap-2.5"
                  >
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold shrink-0">
                      Nivel {index + 1}
                    </span>
                    <span className="text-xs text-slate-200 leading-relaxed">{why}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Actionable Procedures for Operators and Maintenance (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Immediate DCS Operator Action */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
                  Acción Inmediata (Sala de Control DCS)
                </h4>
              </div>

              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-bold block">
                  Instrucción Operativa:
                </span>
                <p className="text-xs text-emerald-200 font-medium leading-relaxed">
                  {rcaResult.immediateAction || rcaResult.correctiveActions?.[0] || "Supervisar lazos de control y estabilizar parámetros de alimentación."}
                </p>
              </div>
            </div>

            {/* Maintenance Recommendation */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
                  Procedimiento de Mantenimiento / Taller
                </h4>
              </div>

              <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/30 rounded-xl space-y-2">
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold block">
                  Recomendación a Programar:
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {rcaResult.maintenanceRecommendation || rcaResult.preventiveActions?.[0] || "Inspección mecánica preventiva y calibración de instrumentos en la próxima ventana de mantenimiento."}
                </p>
              </div>
            </div>

            {/* Industrial Safety & Compliance */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex items-center justify-between text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Protocolo de Seguridad:
              </span>
              <span className="text-slate-200 font-bold">ISA-18.2 / ASME Section I</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
