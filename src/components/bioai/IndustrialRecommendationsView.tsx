import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Zap,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Check,
  Clock,
  Send,
  Loader2,
  RefreshCw,
  Flame,
  Layers,
  Scale,
  ShieldAlert,
  Info,
  ShieldCheck,
} from "lucide-react";
import { TelemetryData, TenantEnterprise } from "../../types";
import { IndustrialRecommendation } from "../../types/bioai";
import { bioAiEngineService } from "../../services/bioai/BioAiEngineService";
import { commandService } from "../../services/edge/CommandService";

interface IndustrialRecommendationsViewProps {
  telemetry: TelemetryData;
  activeTenant?: TenantEnterprise;
  alarms?: any[];
  equipmentList?: any[];
}

export const IndustrialRecommendationsView: React.FC<IndustrialRecommendationsViewProps> = ({
  telemetry,
  activeTenant,
  alarms = [],
  equipmentList = [],
}) => {
  const [recommendations, setRecommendations] = useState<IndustrialRecommendation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filterPriority, setFilterPriority] = useState<string>("ALL");
  const [filterArea, setFilterArea] = useState<string>("ALL");
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const recs = await bioAiEngineService.getIndustrialRecommendations(
        telemetry,
        alarms,
        equipmentList,
        activeTenant
      );
      setRecommendations(recs);
    } catch (err) {
      console.error("Error loading recommendations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [activeTenant?.id]);

  const isSimulated = telemetry.isSimulated ?? true;

  const handleApplyRecommendation = async (rec: IndustrialRecommendation) => {
    setApplyingId(rec.id);
    setActionSuccess(null);

    try {
      if (rec.targetTag && rec.proposedSetpoint !== undefined) {
        await commandService.executeCommand(
          {
            tag: rec.targetTag,
            commandType: "CHANGE_SETPOINT",
            requestedValue: rec.proposedSetpoint,
            operatorId: "operador_dcs",
            role: "operador",
            tenantId: activeTenant?.id || "tenant-001",
            reason: `Aplicación de recomendación de IA: ${rec.title}`,
            clientIp: "127.0.0.1",
            securityClearanceLevel: 3,
          },
          true
        );
      }

      setRecommendations((prev) =>
        prev.map((r) => (r.id === rec.id ? { ...r, status: "APPLIED" as const } : r))
      );
      setActionSuccess(`Recomendación "${rec.title}" aplicada con éxito al sistema SCADA.`);
    } catch (err: any) {
      console.error("Error applying recommendation:", err);
    } finally {
      setApplyingId(null);
    }
  };

  const handleDismiss = (id: string) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "DISMISSED" as const } : r))
    );
  };

  const filteredRecs = recommendations.filter((r) => {
    if (filterPriority !== "ALL" && r.priority !== filterPriority) return false;
    if (filterArea !== "ALL" && r.area !== filterArea) return false;
    return true;
  });

  const totalUSDPerHour = recommendations
    .filter((r) => r.status === "PENDING" || r.status === "APPLIED")
    .reduce((acc, r) => acc + (r.estimatedImpact.financialUSDPerHour || 0), 0);

  const totalMWSavings = recommendations
    .filter((r) => r.status === "PENDING" || r.status === "APPLIED")
    .reduce((acc, r) => acc + (r.estimatedImpact.energySavingsMW || 0), 0);

  return (
    <div className="space-y-6">
      {/* Summary Banner: Projected Value & Savings */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Recomendaciones Prescriptivas de IA Industrial
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Prescriptive Optimization
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Estrategias cuantificadas para maximizar extracción de azúcar, eficiencia térmica y generación eléctrica
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">Potencial Económico Total</span>
            <span className="text-lg font-bold font-tech text-emerald-400">
              +${totalUSDPerHour.toLocaleString()} USD / h
            </span>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div className="text-right">
            <span className="text-[10px] font-mono text-slate-400 block">Potencia Recuperable</span>
            <span className="text-lg font-bold font-tech text-yellow-400">
              +{totalMWSavings.toFixed(1)} MW
            </span>
          </div>
          <button
            onClick={loadRecommendations}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Recargar recomendaciones"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-400" : ""}`} />
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
              {isSimulated ? "Recomendaciones sobre Modelo Simulado" : "Recomendaciones de Campo en Tiempo Real"}
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
              ? "Estas acciones prescriptivas ajustan consignas virtuales en el gemelo matemático termodinámico. Los lazos de control de campo no reciben consignas automáticas sin autorización expresa del operador DCS."
              : "Estas acciones prescriptivas aplican sobre lazos de control y setpoints de la instrumentación física en campo."}
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-400">Prioridad:</span>
          {["ALL", "CRITICA", "ALTA", "MEDIA"].map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-2.5 py-1 rounded transition ${
                filterPriority === p
                  ? "bg-slate-700 text-white font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {p === "ALL" ? "Todas" : p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">Área:</span>
          {["ALL", "MOLIENDA", "CALDERA", "COGENERACION", "EVAPORACION"].map((a) => (
            <button
              key={a}
              onClick={() => setFilterArea(a)}
              className={`px-2.5 py-1 rounded transition ${
                filterArea === a
                  ? "bg-indigo-600 text-white font-bold"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
              }`}
            >
              {a === "ALL" ? "Todas" : a}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRecs.map((rec) => {
          const isCritical = rec.priority === "CRITICA";
          const isHigh = rec.priority === "ALTA";

          return (
            <div
              key={rec.id}
              className={`bg-slate-900/90 border rounded-xl p-5 shadow-xl flex flex-col justify-between transition ${
                rec.status === "APPLIED"
                  ? "border-emerald-500/40 bg-slate-900/60"
                  : isCritical
                  ? "border-rose-500/40 hover:border-rose-500/70"
                  : isHigh
                  ? "border-amber-500/30 hover:border-amber-500/60"
                  : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header: Area, Priority, Confidence */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                        isCritical
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : isHigh
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                      }`}
                    >
                      {rec.priority}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {rec.area}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="text-slate-400">Confianza IA:</span>
                    <strong className="text-indigo-300">{rec.aiConfidence}%</strong>
                  </div>
                </div>

                {/* Title & Detected Problem */}
                <div className="mt-3 space-y-1.5">
                  <h4 className="text-sm font-bold text-white leading-snug">{rec.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-300">Problema:</strong> {rec.problemDetected}
                  </p>
                </div>

                {/* Recommended Action & Procedure */}
                <div className="my-3 p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-2">
                  <div className="text-xs font-medium text-emerald-300 flex items-start gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rec.recommendedAction}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed pl-5">
                    {rec.detailedProcedure}
                  </p>
                </div>

                {/* Setpoint Comparison (if available) */}
                {rec.targetTag && rec.proposedSetpoint !== undefined && (
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs font-mono mb-3">
                    <span className="text-slate-500">{rec.targetTag}:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">
                        Actual: <strong className="text-slate-200">{rec.currentSetpoint} {rec.unit}</strong>
                      </span>
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                      <span className="text-cyan-300 font-bold">
                        Propuesto: {rec.proposedSetpoint} {rec.unit}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: Impact & Execution Controls */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <div className="text-xs font-mono">
                  <span className="text-emerald-400 font-bold block">
                    {rec.estimatedImpact.text}
                  </span>
                  {rec.estimatedImpact.energySavingsMW ? (
                    <span className="text-[10px] text-yellow-400">
                      +{rec.estimatedImpact.energySavingsMW} MW recuperación
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {rec.status === "APPLIED" ? (
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Aplicado
                    </span>
                  ) : (
                    <>
                      <button
                        onClick={() => handleDismiss(rec.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => handleApplyRecommendation(rec)}
                        disabled={applyingId === rec.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {applyingId === rec.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Aplicar Setpoint</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
