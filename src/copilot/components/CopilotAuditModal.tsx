import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Database,
  RefreshCw,
  X,
} from "lucide-react";
import { copilotAuditService } from "../services/copilotAuditService";
import { CopilotAuditEvent, CopilotMetrics } from "../domain/CopilotTypes";

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CopilotAuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose }) => {
  const [events, setEvents] = useState<CopilotAuditEvent[]>([]);
  const [metrics, setMetrics] = useState<CopilotMetrics>({
    requestsTotal: 0,
    toolCallsTotal: 0,
    toolErrorsTotal: 0,
    authDeniedTotal: 0,
    confirmationsRequested: 0,
    confirmationsApproved: 0,
    confirmationsRejected: 0,
    avgLatencyMs: 0,
    tokensConsumedTotal: 0,
  });

  useEffect(() => {
    if (!isOpen) return;

    setEvents(copilotAuditService.getSessionEvents());
    setMetrics(copilotAuditService.getMetrics());

    const unsub = copilotAuditService.subscribe(() => {
      setEvents(copilotAuditService.getSessionEvents());
      setMetrics(copilotAuditService.getMetrics());
    });

    return unsub;
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white font-tech">
                Auditoría de Seguridad & Telemetría Copilot AI (IEC 62443)
              </h2>
              <p className="text-xs text-slate-400">
                Registro inmutable de invocaciones, verificación RBAC y tiempos de respuesta.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Metrics Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Consultas Totales</span>
            <span className="text-xl font-bold text-cyan-400">{metrics.requestsTotal}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Herramientas OT</span>
            <span className="text-xl font-bold text-emerald-400">{metrics.toolCallsTotal}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Latencia Media</span>
            <span className="text-xl font-bold text-slate-200">{metrics.avgLatencyMs} ms</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Accesos Denegados</span>
            <span className={`text-xl font-bold ${metrics.authDeniedTotal > 0 ? "text-rose-400" : "text-slate-400"}`}>
              {metrics.authDeniedTotal}
            </span>
          </div>
        </div>

        {/* Event Logs List */}
        <div className="flex-1 overflow-y-auto space-y-2 border border-slate-800 rounded-xl p-3 bg-slate-950/60 max-h-96">
          <span className="text-xs font-bold text-slate-300 block mb-2 font-mono">
            Historial de Ejecución de la Sesión ({events.length}):
          </span>

          {events.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 font-mono">
              Aún no se han registrado eventos de Copilot en esta sesión.
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        ev.resultStatus === "SUCCESS"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : ev.resultStatus === "DENIED"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {ev.resultStatus}
                    </span>
                    <strong className="text-slate-200">{ev.toolName || ev.intent}</strong>
                    <span className="text-slate-500 text-[10px]">• {ev.userName}</span>
                  </div>
                  {ev.requiredPermission && (
                    <span className="text-[10px] text-slate-400 block">
                      Permiso: {ev.requiredPermission}
                    </span>
                  )}
                </div>

                <div className="text-right text-[10px] text-slate-500">
                  <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
