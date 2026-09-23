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
import { ISA182_SHELVING_REASONS, ShelvingReasonCode, AlarmShelvingService } from "../services/alarms/AlarmShelvingService";

interface AlarmCenterProps {
  alarms: AlarmEvent[];
  onAcknowledgeAlarm: (alarmId: string) => void;
  onClearAlarm: (alarmId: string) => void;
  onShelveAlarm?: (alarmId: string, durationMinutes: number, reasonCode: ShelvingReasonCode, customReason?: string) => void;
  onUnshelveAlarm?: (alarmId: string) => void;
  currentRole: UserRole;
}

export const AlarmCenter: React.FC<AlarmCenterProps> = ({
  alarms = [],
  onAcknowledgeAlarm,
  onClearAlarm,
  onShelveAlarm,
  onUnshelveAlarm,
  currentRole,
}) => {
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "ACKNOWLEDGED" | "SHELVED" | "CLEARED">("ALL");
  const [isAudible, setIsAudible] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmEvent | null>(null);

  // ISA-18.2 Shelving Modal State
  const [shelvingTarget, setShelvingTarget] = useState<AlarmEvent | null>(null);
  const [selectedReasonCode, setSelectedReasonCode] = useState<ShelvingReasonCode>("CALIBRATION_TESTING");
  const [shelveDurationMinutes, setShelveDurationMinutes] = useState<number>(60);
  const [customReasonNotes, setCustomReasonNotes] = useState<string>("");

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

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "SHELVED" && a.shelved) ||
      (statusFilter === "ACTIVE" && !a.shelved && (a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED"))) ||
      (statusFilter === "ACKNOWLEDGED" && !a.shelved && (a.status === "ACKNOWLEDGED" || a.acknowledged) && a.status !== "CLEARED") ||
      (statusFilter === "CLEARED" && a.status === "CLEARED");

    const matchesSearch =
      (a.message || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.equipmentName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.code || a.tag || "").toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSeverity && matchesStatus && matchesSearch;
  });

  const activeCount = safeAlarms.filter(
    (a) => !a.shelved && (a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED"))
  ).length;

  const criticalCount = safeAlarms.filter(
    (a) =>
      !a.shelved &&
      (a.severity === "CRITICAL" || a.severity === "CRITICA") &&
      (a.status === "ACTIVE" || !a.acknowledged)
  ).length;

  const shelvedCount = safeAlarms.filter((a) => a.shelved).length;

  const handleOpenShelveModal = (alarm: AlarmEvent) => {
    if (!rbacShelve.allowed) {
      alert(rbacShelve.reason || "Acceso denegado: se requiere permiso SHELVE_ALARM");
      return;
    }
    const defaultReason = ISA182_SHELVING_REASONS[0];
    setShelvingTarget(alarm);
    setSelectedReasonCode(defaultReason.code);
    setShelveDurationMinutes(defaultReason.defaultDurationMinutes);
    setCustomReasonNotes("");
  };

  const handleConfirmShelve = () => {
    if (!shelvingTarget) return;
    if (onShelveAlarm) {
      onShelveAlarm(
        shelvingTarget.id,
        shelveDurationMinutes,
        selectedReasonCode,
        customReasonNotes.trim() || undefined
      );
    }
    setShelvingTarget(null);
  };

  const handleUnshelve = (alarmId: string) => {
    if (!rbacShelve.allowed) {
      alert(rbacShelve.reason || "Acceso denegado: se requiere permiso SHELVE_ALARM");
      return;
    }
    if (onUnshelveAlarm) {
      onUnshelveAlarm(alarmId);
    }
  };

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
            {shelvedCount > 0 && (
              <span className="px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {shelvedCount} Silenciadas (ISA-18.2)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-400 font-bold mr-1">Estado ISA-18.2:</span>
            {[
              { key: "ALL", label: "Todas", count: safeAlarms.length },
              { key: "ACTIVE", label: "Activas Sin Reconocer", count: activeCount },
              { key: "ACKNOWLEDGED", label: "Reconocidas (ACK)", count: safeAlarms.filter(a => !a.shelved && (a.status === "ACKNOWLEDGED" || a.acknowledged) && a.status !== "CLEARED").length },
              { key: "SHELVED", label: "Silenciadas (Shelved)", count: shelvedCount },
              { key: "CLEARED", label: "Normalizadas", count: safeAlarms.filter(a => a.status === "CLEARED").length },
            ].map((st) => (
              <button
                key={st.key}
                onClick={() => setStatusFilter(st.key as any)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition flex items-center gap-1.5 ${
                  statusFilter === st.key
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
                    : "bg-slate-950/70 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <span>{st.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${statusFilter === st.key ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-300"}`}>
                  {st.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-500" />
            Rol: <strong className="text-slate-200">{roleBadge.label}</strong>
          </span>
        </div>

        {/* Severity Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400 font-bold mr-1">Severidad:</span>
            {(["ALL", "CRITICAL", "WARNING", "INFO"] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`text-xs px-2.5 py-1 rounded-lg font-mono transition ${
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
                      {alarm.shelved ? (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-purple-500/30 text-purple-300 border border-purple-500/50 flex items-center justify-center gap-1">
                          <Clock className="w-3 h-3" />
                          SHELVED
                        </span>
                      ) : (
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
                      )}
                    </td>

                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {alarm.shelved ? (
                          <div className="flex items-center gap-1.5">
                            {alarm.shelvedUntil && (
                              <span className="text-[10px] font-mono text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/60" title={`Silenciado hasta: ${alarm.shelvedUntil}`}>
                                {Math.max(0, Math.round((new Date(alarm.shelvedUntil).getTime() - Date.now()) / 60000))}m rest.
                              </span>
                            )}
                            <button
                              onClick={() => handleUnshelve(alarm.id)}
                              className="px-2 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-mono transition"
                              title="Desarchivar alarma y restaurar al estado operativo normal"
                            >
                              Desarchivar
                            </button>
                          </div>
                        ) : (
                          <>
                            {isActive && (
                              <button
                                onClick={() => onAcknowledgeAlarm(alarm.id)}
                                className="px-2 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono transition"
                              >
                                ACK
                              </button>
                            )}

                            {(alarm.status === "ACKNOWLEDGED" || alarm.acknowledged) && alarm.status !== "CLEARED" && (
                              <button
                                onClick={() => {
                                  if (!rbacClear.allowed) {
                                    alert(rbacClear.reason);
                                    return;
                                  }
                                  onClearAlarm(alarm.id);
                                }}
                                className={`px-2 py-1 rounded text-xs font-mono transition ${
                                  rbacClear.allowed
                                    ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                                    : "bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800"
                                }`}
                                title={rbacClear.allowed ? "Normalizar alarma" : rbacClear.reason}
                              >
                                RST
                              </button>
                            )}

                            {alarm.status !== "CLEARED" && (
                              <button
                                onClick={() => handleOpenShelveModal(alarm)}
                                className={`px-2 py-1 rounded text-xs font-mono transition flex items-center gap-1 ${
                                  rbacShelve.allowed
                                    ? "bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-700/50"
                                    : "bg-slate-950 text-slate-600 cursor-not-allowed border border-slate-800"
                                }`}
                                title={rbacShelve.allowed ? "Silenciar alarma temporalmente (ISA-18.2)" : rbacShelve.reason}
                              >
                                <Clock className="w-3 h-3" />
                                <span>Shelve</span>
                              </button>
                            )}

                            {alarm.status === "CLEARED" && (
                              <span className="text-emerald-400 text-xs font-mono flex items-center justify-end gap-1">
                                <Check className="w-3.5 h-3.5" /> Normal
                              </span>
                            )}
                          </>
                        )}
                      </div>
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
              {selectedAlarm.shelved && (
                <div className="mt-2 pt-2 border-t border-slate-800 bg-purple-950/20 p-2 rounded-lg text-purple-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-purple-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Silenciamiento Temporal Activo (ISA-18.2)</span>
                  </div>
                  <div>Motivo: <strong className="text-purple-100">{selectedAlarm.shelveReason || "No especificado"}</strong></div>
                  <div>Operador: <strong className="text-purple-100">{selectedAlarm.shelvedBy || "N/A"}</strong></div>
                  <div>Expira en: <strong className="text-purple-100">{selectedAlarm.shelvedUntil ? new Date(selectedAlarm.shelvedUntil).toLocaleTimeString() : "N/A"}</strong></div>
                </div>
              )}
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

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div>
                {!selectedAlarm.shelved && selectedAlarm.status !== "CLEARED" && rbacShelve.allowed && (
                  <button
                    type="button"
                    onClick={() => {
                      const tgt = selectedAlarm;
                      setSelectedAlarm(null);
                      handleOpenShelveModal(tgt);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 text-purple-200 border border-purple-700/50 text-xs flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Silenciar Alarma (ISA-18.2)</span>
                  </button>
                )}
                {selectedAlarm.shelved && rbacShelve.allowed && (
                  <button
                    type="button"
                    onClick={() => {
                      handleUnshelve(selectedAlarm.id);
                      setSelectedAlarm(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                  >
                    Desarchivar Ahora
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
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
        </div>
      )}

      {/* ISA-18.2 MODAL DE SILENCIAMIENTO / SHELVING */}
      {shelvingTarget && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-purple-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200 font-mono text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-tech">
                    Silenciamiento Temporal de Alarma (ISA-18.2)
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Equipo: {shelvingTarget.equipmentName} | Tag: {shelvingTarget.code || shelvingTarget.tag || shelvingTarget.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShelvingTarget(null)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <div className="bg-purple-950/20 border border-purple-800/40 rounded-xl p-3 text-purple-200 space-y-1">
              <div className="flex items-center gap-2 font-bold text-purple-300 text-xs">
                <ShieldAlert className="w-4 h-4 text-purple-400" />
                <span>Política de Supresión Controlada</span>
              </div>
              <p className="text-[11px] text-purple-200/90 font-sans leading-relaxed">
                El silenciamiento temporal (Shelving) suprime notificaciones audibles y visuales molestas bajo una causa operativa justificada. Al expirar el tiempo establecido, el sistema reactivará automáticamente la alarma si la condición de proceso persiste.
              </p>
            </div>

            {/* Motivo de Justificación */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block">
                Motivo / Justificación Operativa (Obligatorio ISA-18.2):
              </label>
              <div className="space-y-2">
                {ISA182_SHELVING_REASONS.map((r) => (
                  <label
                    key={r.code}
                    onClick={() => {
                      setSelectedReasonCode(r.code);
                      setShelveDurationMinutes(r.defaultDurationMinutes);
                    }}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition ${
                      selectedReasonCode === r.code
                        ? "bg-purple-950/40 border-purple-500 text-purple-100"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-950"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shelvingReason"
                      checked={selectedReasonCode === r.code}
                      onChange={() => {}}
                      className="mt-0.5 text-purple-500 focus:ring-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-white">{r.label}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{r.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Duración */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block">
                Duración del Silenciamiento:
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {[15, 30, 60, 120, 240, 480, 1440].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setShelveDurationMinutes(mins)}
                    className={`px-3 py-1.5 rounded-lg font-mono text-xs transition border ${
                      shelveDurationMinutes === mins
                        ? "bg-purple-500 text-slate-950 font-bold border-purple-400"
                        : "bg-slate-950 text-slate-300 hover:text-white border-slate-800"
                    }`}
                  >
                    {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-slate-500 block font-mono">
                Expira automáticamente a las: {new Date(Date.now() + shelveDurationMinutes * 60000).toLocaleTimeString()}
              </span>
            </div>

            {/* Observaciones adicionales */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 block">
                Observaciones del Operador (Opcional):
              </label>
              <input
                type="text"
                value={customReasonNotes}
                onChange={(e) => setCustomReasonNotes(e.target.value)}
                placeholder="Ej. Técnico López realizando ajuste en transmisor..."
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShelvingTarget(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmShelve}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-900/30"
              >
                <Clock className="w-4 h-4" />
                <span>Confirmar Silenciamiento ({shelveDurationMinutes < 60 ? `${shelveDurationMinutes}m` : `${shelveDurationMinutes / 60}h`})</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
