import React, { useState } from "react";
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
  RotateCcw
} from "lucide-react";
import { AlarmEvent, UserRole } from "../types";

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

  const safeAlarms = Array.isArray(alarms) ? alarms : [];

  const filteredAlarms = safeAlarms.filter((a) => {
    const matchesSeverity =
      severityFilter === "ALL" ||
      a.severity === severityFilter ||
      (severityFilter === "CRITICAL" && a.severity === "CRITICA") ||
      (severityFilter === "WARNING" && (a.severity === "ALTA" || a.severity === "MEDIA"));
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
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
                <th className="p-3 text-right">Acción</th>
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
                    className={`transition ${
                      isActive
                        ? isCritical
                          ? "bg-rose-950/20 text-rose-200"
                          : "bg-amber-950/20 text-amber-200"
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

                    <td className="p-3 text-right">
                      {isActive ? (
                        <button
                          onClick={() => onAcknowledgeAlarm(alarm.id)}
                          className="px-2.5 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono transition"
                        >
                          Reconocer (ACK)
                        </button>
                      ) : alarm.status === "ACKNOWLEDGED" || alarm.acknowledged ? (
                        <button
                          onClick={() => onClearAlarm(alarm.id)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
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
    </div>
  );
};
