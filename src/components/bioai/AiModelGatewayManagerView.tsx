import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Zap,
  DollarSign,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  Server,
  Cloud,
  HardDrive,
  Clock,
  Terminal,
} from "lucide-react";
import { UserRole, TenantEnterprise } from "../../types";

interface AiModelGatewayManagerViewProps {
  currentRole: UserRole;
  activeTenant?: TenantEnterprise;
}

interface GatewayStatusPayload {
  activeProvider: string;
  fallbackChain: string[];
  providers: Array<{
    provider: string;
    configured: boolean;
    isPrimary: boolean;
    isLocalOnPremise: boolean;
    model: string;
  }>;
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    fallbackRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalEstimatedCostUsd: number;
    averageLatencyMs: number;
    providerBreakdown: Record<
      string,
      {
        requests: number;
        failures: number;
        totalTokens: number;
        totalCostUsd: number;
        avgLatencyMs: number;
      }
    >;
  };
}

interface ObservabilityRecord {
  id: string;
  traceId: string;
  timestamp: string;
  tenantId: string;
  userId: string;
  provider: string;
  model: string;
  status: "SUCCESS" | "FAILED" | "FALLBACK";
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  isLocalOnPremise: boolean;
  errorMessage?: string;
}

export const AiModelGatewayManagerView: React.FC<AiModelGatewayManagerViewProps> = ({
  currentRole,
}) => {
  const [status, setStatus] = useState<GatewayStatusPayload | null>(null);
  const [records, setRecords] = useState<ObservabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(
    null
  );

  const canManage = ["admin", "superadmin", "ciberseguridad"].includes(currentRole);

  const fetchStatusAndRecords = async () => {
    try {
      const token = localStorage.getItem("bioazucar_jwt") || "";
      const authHeaders = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const [resStatus, resRecords] = await Promise.all([
        fetch("/api/ai/gateway/status", { headers: authHeaders }),
        fetch("/api/ai/gateway/records?limit=15", { headers: authHeaders }),
      ]);

      if (resStatus.ok) {
        const data = await resStatus.json();
        setStatus(data);
      }
      if (resRecords.ok) {
        const recData = await resRecords.json();
        setRecords(recData.records || []);
      }
    } catch (err: any) {
      console.warn("AI Gateway fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndRecords();
    const interval = setInterval(fetchStatusAndRecords, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchProvider = async (providerName: string) => {
    if (!canManage) return;
    setSwitching(providerName);
    setFeedback(null);
    try {
      const token = localStorage.getItem("bioazucar_jwt") || "";
      const res = await fetch("/api/ai/gateway/config", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ primaryProvider: providerName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Error al conmutar proveedor");
      }

      setFeedback({
        type: "success",
        msg: `Proveedor de IA conmutado exitosamente a: ${providerName.toUpperCase()}`,
      });
      await fetchStatusAndRecords();
    } catch (err: any) {
      setFeedback({
        type: "error",
        msg: err.message || "Fallo en la conmutación de proveedor",
      });
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  AI Model Gateway Multi-Proveedor & Observabilidad
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/50 rounded">
                  P0-08 COMPLIANT
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-700/50 rounded">
                  IEC 62443 SL3
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Desacoplamiento soberano de modelos LLM con conmutación transparente entre Gemini,
                OpenAI, Anthropic, Azure y Ollama On-Premise (air-gapped sin fuga de datos).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setLoading(true);
                fetchStatusAndRecords();
              }}
              className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Actualizar Telemetría</span>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs font-medium border flex items-center space-x-2 ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-800 text-emerald-200"
                : "bg-rose-950/60 border-rose-800 text-rose-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Peticiones Totales</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {status?.stats.totalRequests.toLocaleString() ?? "0"}
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span className="text-emerald-400 font-medium">
              {status?.stats.successfulRequests ?? 0} exitosas
            </span>
            {status?.stats.fallbackRequests ? (
              <span className="text-amber-400">({status.stats.fallbackRequests} failovers)</span>
            ) : null}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tokens Totales</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {(
              (status?.stats.totalPromptTokens || 0) + (status?.stats.totalCompletionTokens || 0)
            ).toLocaleString()}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Prompt: {status?.stats.totalPromptTokens.toLocaleString() ?? 0} | Gen:{" "}
            {status?.stats.totalCompletionTokens.toLocaleString() ?? 0}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Costo Acumulado USD</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            ${(status?.stats.totalEstimatedCostUsd || 0).toFixed(4)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            On-Premise (Ollama): $0.0000 costo nube
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Latencia Media</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {status?.stats.averageLatencyMs ?? 0} ms
          </div>
          <div className="text-xs text-slate-500 mt-1 flex items-center space-x-1">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Proveedor Activo: {status?.activeProvider.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Available Providers Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Matriz de Proveedores Conmutables & Soberanía de Datos</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(status?.providers || []).map((p) => {
            const isSelected = p.provider === status?.activeProvider;
            const pBreakdown = status?.stats.providerBreakdown[p.provider];

            return (
              <div
                key={p.provider}
                className={`border rounded-xl p-5 transition-all ${
                  isSelected
                    ? "bg-slate-800/90 border-emerald-500/60 shadow-lg shadow-emerald-950/20"
                    : "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-white uppercase">
                        {p.provider}
                      </span>
                      {p.isLocalOnPremise && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                          AIR-GAPPED LOCAL
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono">
                      Modelo: {p.model}
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="px-2 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>PRIMARIO</span>
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium text-slate-400 bg-slate-800 rounded-full">
                      RESPALDO
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 text-xs space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Ejecuciones:</span>
                    <span className="font-semibold text-white">{pBreakdown?.requests ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Tokens Procesados:</span>
                    <span className="font-semibold text-white">
                      {(pBreakdown?.totalTokens ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Gasto Estimado:</span>
                    <span className="font-semibold text-emerald-400">
                      ${(pBreakdown?.totalCostUsd ?? 0).toFixed(4)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Latencia Media:</span>
                    <span className="font-semibold text-white">
                      {pBreakdown?.avgLatencyMs ?? 0} ms
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3">
                  <button
                    disabled={isSelected || !canManage || switching === p.provider}
                    onClick={() => handleSwitchProvider(p.provider)}
                    className={`w-full py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center space-x-1.5 transition-colors ${
                      isSelected
                        ? "bg-emerald-500/20 text-emerald-300 cursor-default"
                        : canManage
                        ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                        : "bg-slate-800/40 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {switching === p.provider ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Conmutando...</span>
                      </>
                    ) : isSelected ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Activo en Planta</span>
                      </>
                    ) : (
                      <>
                        <span>Activar como Primario</span>
                        <ArrowRight className="w-3 h-3" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Observability Audit Trail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">
              Bitácora de Observabilidad de Invocaciones (Ring Buffer IEC 62443)
            </h3>
          </div>
          <span className="text-xs text-slate-500">Últimos {records.length} registros</span>
        </div>

        {records.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No se han registrado invocaciones de IA en la sesión actual.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Trace ID</th>
                  <th className="py-2.5 px-3">Proveedor & Modelo</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Tokens (P/C)</th>
                  <th className="py-2.5 px-3">Costo</th>
                  <th className="py-2.5 px-3">Latencia</th>
                  <th className="py-2.5 px-3">Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-cyan-300">
                      {r.traceId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-white uppercase">{r.provider}</span>
                      <span className="text-slate-500 ml-1 font-mono text-[10px]">({r.model})</span>
                    </td>
                    <td className="py-2.5 px-3">
                      {r.status === "SUCCESS" ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                          SUCCESS
                        </span>
                      ) : r.status === "FALLBACK" ? (
                        <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                          FALLBACK
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px]">
                          FAILED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {r.promptTokens} / {r.completionTokens} ({r.totalTokens})
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400 font-mono">
                      ${r.estimatedCostUsd.toFixed(4)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{r.latencyMs} ms</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
