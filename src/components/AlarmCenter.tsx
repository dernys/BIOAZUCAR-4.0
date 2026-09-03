import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Volume2,
  VolumeX,
  Clock,
  Filter,
  ShieldAlert,
  Search,
  Check,
  RotateCcw,
  ShieldCheck,
  Lock,
  Layers,
  Activity,
  Zap,
  Info,
  CheckCheck,
} from "lucide-react";
import { AlarmEvent, UserRole } from "../types";
import { checkRbacPermission, getRoleBadgeInfo } from "../services/rbacService";

interface AlarmCenterProps {
  alarms: AlarmEvent[];
  onAcknowledgeAlarm: (alarmId: string) => void;
  onClearAlarm: (alarmId: string) => void;
  currentRole: UserRole;
}

export const AlarmCenter: React.FC<AlarmCenterProps> = ({
  alarms = [],
  onAcknowledgeAlarm,
  onClearAlarm,
  currentRole,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [isAudible, setIsAudible] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmEvent | null>(null);

  const safeAlarms = Array.isArray(alarms) ? alarms : [];

  // RBAC Checks
  const rbacAck = useMemo(
    () => checkRbacPermission(currentRole, "ACKNOWLEDGE_ALARM"),
    [currentRole]
  );
  const rbacClear = useMemo(
    () => checkRbacPermission(currentRole, "CLEAR_ALARM"),
    [currentRole]
  );
  const rbacShelve = useMemo(
    () => checkRbacPermission(currentRole, "SHELVE_ALARM"),
    [currentRole]
  );
  const roleBadge = getRoleBadgeInfo(currentRole);

  const filteredAlarms = safeAlarms.filter((a) => {
    const matchesSeverity =
      severityFilter === "ALL" ||
      a.severity === severityFilter ||
      (severityFilter === "CRITICAL" && (a.severity === "CRITICAL" || a.severity === "CRITICA")) ||
      (severityFilter === "WARNING" && (a.severity === "WARNING" || a.severity === "ALTA" || a.severity === "MEDIA"));
    const matchesSearch =
      (a.message || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.equipmentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.code || a.tag || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const activeCount = safeAlarms.filter(
    (a) => a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED")
  ).length;
  const criticalCount = safeAlarms.filter(
    (a) =>
      (a.severity === "CRITICAL" || a.severity === "CRITICA") &&
      (a.status === "ACTIVE" || !a.acknowledged)
  ).length;

  const handleAcknowledgeAll = () => {
    if (!rbacAck.allowed) {
      alert(rbacAck.reason);
      return;
    }
    const unacknowledged = safeAlarms.filter((a) => !a.acknowledged && a.status !== "CLEARED");
    unacknowledged.forEach((a) => onAcknowledgeAlarm(a.id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            Consola de Alarmas & Eventos de Operación (ISA-18.2 / EEMUA 191)
          </h2>
          <p className="text-xs text-slate-400">
            Registro secuencial de eventos (SOE), reconocimiento de disparos y gestión de alarmas de proceso
          </p>
        </div>

        {/* Audio buzzer & KPI */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAudible((p) => !p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition ${
              isAudible
                ? "bg-slate-800 border-slate-700 text-emerald-400"
                : "bg-slate-950 border-slate-800 text-slate-500"
            }`}
          >
            {isAudible ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{isAudible ? "Buzzer Activado" : "Buzzer Silenciado"}</span>
          </button>

          {activeCount > 0 && rbacAck.allowed && (
            <button
              onClick={handleAcknowledgeAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 text-xs font-mono transition font-bold"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>ACK Global ({activeCount})</span>
            </button>
          )}

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
              {criticalCount} Críticas
            </span>
            <span className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              {activeCount} Activas
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
        <div className="flex items-center gap-2">
          {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono transition ${
                severityFilter === sev
                  ? "bg-emerald-500 text-slate-950 font-bold"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {sev === "ALL" ? "Todas" : sev}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por mensaje, equipo o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-950 text-xs text-slate-200 rounded-lg pl-9 pr-3 py-1.5 border border-slate-800 focus:outline-none focus:border-emerald-500 w-64 font-mono"
          />
        </div>
      </div>

      {/* Alarms Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
              <tr>
                <th className="p-3">Severidad / Código</th>
                <th className="p-3">Timestamp (SOE)</th>
                <th className="p-3">Equipo Afectado</th>
                <th className="p-3">Descripción de la Alarma</th>
                <th className="p-3 text-center">Valor / Límite</th>
                <th className="p-3 text-center">Estado</th>
                <th className="p-3 text-right">Acción (RBAC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredAlarms.map((alarm) => {
                const isCritical = alarm.severity === "CRITICAL" || alarm.severity === "CRITICA";
                const isWarning = alarm.severity === "WARNING" || alarm.severity === "ALTA" || alarm.severity === "MEDIA";
                const displayVal = alarm.value ?? alarm.currentValue ?? 0;
                const displayCode = alarm.code || alarm.tag || `ALM-${alarm.id.slice(-4).toUpperCase()}`;
                const isActive = alarm.status === "ACTIVE" || (!alarm.acknowledged && alarm.status !== "CLEARED");

                return (
                  <tr
                    key={alarm.id}
                    onClick={() => setSelectedAlarm(alarm)}
                    className={`cursor-pointer transition ${
                      isActive
                        ? isCritical
                          ? "bg-rose-950/20 text-rose-200 hover:bg-rose-950/30"
                          : "bg-amber-950/20 text-amber-200 hover:bg-amber-950/30"
                        : "hover:bg-slate-800/30 text-slate-400"
                    }`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            isCritical
                              ? "bg-rose-500 animate-ping"
                              : isWarning
                              ? "bg-amber-400 animate-pulse"
                              : "bg-cyan-400"
                          }`}
                        ></span>
                        <span className="font-mono font-bold text-white">{displayCode}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono block mt-0.5">
                        {alarm.severity}
                      </span>
                    </td>

                    <td className="p-3 font-mono text-slate-300">{alarm.timestamp}</td>

                    <td className="p-3 font-semibold text-white">{alarm.equipmentName}</td>

                    <td className="p-3 max-w-md text-slate-300">{alarm.message}</td>

                    <td className="p-3 text-center font-mono font-bold">
                      <span className={isCritical ? "text-rose-400" : "text-amber-400"}>
                        {displayVal} {alarm.unit}
                      </span>{" "}
                      <span className="text-slate-500 font-normal">/ {alarm.threshold} {alarm.unit}</span>
                    </td>

                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isActive
                            ? isCritical
                              ? "bg-rose-500/30 text-rose-300 border border-rose-500/50"
                              : "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                            : alarm.status === "ACKNOWLEDGED" || alarm.acknowledged
                            ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}
                      >
                        {isActive ? "ACTIVE" : (alarm.status || "ACKNOWLEDGED")}
                      </span>
                    </td>

                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {isActive ? (
                        <button
                          onClick={() => onAcknowledgeAlarm(alarm.id)}
                          className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono transition"
                        >
                          Reconocer (ACK)
                        </button>
                      ) : alarm.status === "ACKNOWLEDGED" || alarm.acknowledged ? (
                        <button
                          onClick={() => {
                            if (!rbacClear.allowed) {
                              alert(rbacClear.reason);
                              return;
                            }
                            onClearAlarm(alarm.id);
                          }}
                          className={`px-2.5 py-1 rounded text-xs font-mono transition ${
                            rbacClear.allowed
                              ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                              : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                          }`}
                          title={rbacClear.allowed ? "Normalizar alarma" : rbacClear.reason}
                        >
                          Normalizar (RST)
                        </button>
                      ) : (
                        <span className="text-emerald-400 text-xs font-mono flex items-center justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> Normal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OPTIMIZED ISA-18.2 ALARM DETAIL & ROOT CAUSE MODAL */}
      {selectedAlarm && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-tech">
                    Diagnóstico de Evento ISA-18.2
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Tag: {selectedAlarm.code || selectedAlarm.tag || "PLC_ALM"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedAlarm(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-slate-300">
                <span>Equipo:</span>
                <strong className="text-white font-sans">{selectedAlarm.equipmentName}</strong>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Severidad:</span>
                <span className="text-rose-400 font-bold uppercase">{selectedAlarm.severity}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Estampa Temporal SOE:</span>
                <span className="text-slate-200">{selectedAlarm.timestamp}</span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span>Valor Medido vs Consigna:</span>
                <span className="text-amber-300 font-bold">
                  {selectedAlarm.value ?? selectedAlarm.currentValue} {selectedAlarm.unit} (Límite: {selectedAlarm.threshold} {selectedAlarm.unit})
                </span>
              </div>
            </div>

            <div className="space-y-1.5 font-sans">
              <span className="text-[11px] text-slate-400 font-mono font-bold block">Mensaje de Proceso:</span>
              <p className="text-xs text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                {selectedAlarm.message}
              </p>
            </div>

            <div className="space-y-1.5 font-sans">
              <span className="text-[11px] text-emerald-400 font-mono font-bold block">Protocolo de Respuesta Inmediata:</span>
              <ul className="text-[11px] text-slate-300 list-disc list-inside space-y-1 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                <li>Verificar flujo enclavado en lazo de control SCADA.</li>
                <li>Verificar estado térmico y vibratorio en panel CBM.</li>
                <li>Registrar evento en bitácora de turno DCS.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedAlarm(null)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cerrar
              </button>
              {!selectedAlarm.acknowledged && (
                <button
                  type="button"
                  onClick={() => {
                    onAcknowledgeAlarm(selectedAlarm.id);
                    setSelectedAlarm(null);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Reconocer Alarma (ACK)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
