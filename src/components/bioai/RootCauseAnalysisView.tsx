import React, { useState, useEffect } from "react";
import {
  GitPullRequest,
  AlertTriangle,
  Zap,
  TrendingDown,
  CheckCircle2,
  Wrench,
  DollarSign,
  BrainCircuit,
  Loader2,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Clock,
  Crosshair,
} from "lucide-react";
import { TelemetryData, TenantEnterprise } from "../../types";
import { RootCauseAnalysisResult } from "../../types/bioai";
import { bioAiEngineService } from "../../services/bioai/BioAiEngineService";

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
  const [loading, setLoading] = useState<boolean>(false);
  const [rcaResult, setRcaResult] = useState<RootCauseAnalysisResult | null>(null);

  const runAnalysis = async (incidentType: string) => {
    setLoading(true);
    setSelectedIncident(incidentType);
    try {
      const res = await bioAiEngineService.performRootCauseAnalysis(
        incidentType,
        telemetry,
        alarms,
        equipmentList,
        undefined,
        activeTenant
      );
      setRcaResult(res);
    } catch (err) {
      console.error("Error executing RCA:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis("PRODUCTION_DROP");
  }, [telemetry.tch, activeTenant?.id]);

  return (
    <div className="space-y-6">
      {/* Scenario Selector Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-rose-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Motor Causal de Diagnóstico Profundo (AI RCA)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Ishikawa & 5-Whys
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Identificación automatizada de causa raíz y árbol de derivación física ante desvíos de proceso
          </p>
        </div>

        {/* Preset incident buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAnalysis("PRODUCTION_DROP")}
            disabled={loading}
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
            onClick={() => runAnalysis("ENERGY_CONSUMPTION_SURGE")}
            disabled={loading}
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
            onClick={() => runAnalysis("CRITICAL_ALARM")}
            disabled={loading}
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
            onClick={() => runAnalysis(selectedIncident)}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Re-ejecutar diagnóstico"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-12 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
          <span className="text-xs font-mono text-slate-300">
            Analizando series de tiempo, matriz de fallas y relaciones termodinámicas...
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
                    SEVERIDAD: {rcaResult.severity}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Confianza: {rcaResult.confidenceScore}%
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
                  {rcaResult.contributingFactors.map((factor, idx) => (
                    <div
                      key={idx}
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
                  Pérdida Económica Estimada:
                </span>
                <span className="font-mono text-rose-400 font-bold text-sm">
                  {rcaResult.estimatedFinancialLoss}
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
                {rcaResult.fiveWhys.map((why, index) => (
                  <div
                    key={index}
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
                  {rcaResult.immediateAction}
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
                  {rcaResult.maintenanceRecommendation}
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
