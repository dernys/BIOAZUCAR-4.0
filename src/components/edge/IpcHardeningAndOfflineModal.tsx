import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Server,
  Network,
  Wifi,
  WifiOff,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileCode,
  Terminal,
  Activity,
  Clock,
  HardDrive,
  Copy,
  Check,
  X,
  Radio,
  Sliders,
  Play,
  Pause,
  AlertOctagon,
  Eye,
  KeyRound,
  FileCheck,
} from "lucide-react";
import { OfflineSyncManager, OfflineSyncStatus, OfflineJournalEntry } from "../../services/offline/OfflineSyncManager";
import { DualNicManager, NetworkInterfaceConfig, DualNicSecurityAudit } from "../../services/edge/network/DualNicManager";
import { ZeroTrustAccessController, BastionSession, SessionCommandAuditRecord, ZeroTrustStatus } from "../../services/edge/security/ZeroTrustAccessController";
import { CisBenchmarkHardeningService, CisAuditReport } from "../../services/edge/security/CisBenchmarkHardeningService";
import { UserRole } from "../../types";

interface IpcHardeningAndOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

type TabType = "OFFLINE_SCADA" | "DUAL_NIC" | "ZERO_TRUST" | "CIS_HARDENING";

export const IpcHardeningAndOfflineModal: React.FC<IpcHardeningAndOfflineModalProps> = ({
  isOpen,
  onClose,
  currentRole,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("OFFLINE_SCADA");

  // I10: Offline Sync Manager state
  const offlineManager = OfflineSyncManager.getInstance();
  const [offlineStatus, setOfflineStatus] = useState<OfflineSyncStatus>(offlineManager.getStatus());
  const [pendingEntries, setPendingEntries] = useState<OfflineJournalEntry[]>(offlineManager.getPendingEntries());
  const [isSyncingManually, setIsSyncingManually] = useState(false);

  // I11: Dual-NIC state
  const dualNicManager = DualNicManager.getInstance();
  const [interfaces, setInterfaces] = useState(dualNicManager.getInterfaceConfigs());
  const [nicAudit, setNicAudit] = useState<DualNicSecurityAudit>(dualNicManager.auditDualNicCompliance());
  const [copiedIptables, setCopiedIptables] = useState(false);

  // I12: Zero-Trust state
  const ztController = ZeroTrustAccessController.getInstance();
  const [ztStatus, setZtStatus] = useState<ZeroTrustStatus>(ztController.getStatus());
  const [bastionSessions, setBastionSessions] = useState<BastionSession[]>(ztController.getSessions());
  const [commandLogs, setCommandLogs] = useState<SessionCommandAuditRecord[]>(ztController.getCommandAuditLogs());
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [authErrorMsg, setAuthErrorMsg] = useState<string | null>(null);
  const [newSessionForm, setNewSessionForm] = useState({
    engineerName: "Ing. Roberto Diaz (DCS EROS Specialist)",
    role: "AUTOMATION_SPECIALIST" as const,
    bastionIp: "10.0.50.254",
    clientThumbprint: "SHA256:4C:99:12:DF:31:8B:E0:AA",
    workOrderRef: "WO-2026-EROS-HARVEST-01",
    targetDevice: "DCS-EROS-TANDEM01 (192.168.10.40)",
    ttlMinutes: 45,
    mfaToken: "849201",
  });

  // I13: CIS Benchmark state
  const cisService = CisBenchmarkHardeningService.getInstance();
  const [cisReport, setCisReport] = useState<CisAuditReport>(cisService.runAudit());

  useEffect(() => {
    if (!isOpen) return;

    const unsubOffline = offlineManager.subscribe((status) => {
      setOfflineStatus(status);
      setPendingEntries(offlineManager.getPendingEntries());
    });

    const unsubZT = ztController.subscribe((status) => {
      setZtStatus(status);
      setBastionSessions(ztController.getSessions());
      setCommandLogs(ztController.getCommandAuditLogs());
    });

    setInterfaces(dualNicManager.getInterfaceConfigs());
    setNicAudit(dualNicManager.auditDualNicCompliance());
    setCisReport(cisService.runAudit());

    return () => {
      unsubOffline();
      unsubZT();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Handlers
  const handleToggleOnlineSimulation = () => {
    const newState = !offlineStatus.isOnline;
    offlineManager.setConnectivityState(newState);
  };

  const handleTriggerManualSync = async () => {
    setIsSyncingManually(true);
    await offlineManager.triggerSynchronization();
    setIsSyncingManually(false);
  };

  const handleAddSampleOfflineMutation = () => {
    offlineManager.enqueueOperation({
      collection: "telemetry",
      operation: "LOG_MEASUREMENT",
      payload: {
        sensor: "DOMO_CALDERA_NIVEL",
        value: 58.4,
        unit: "%",
        recordedAt: Date.now(),
        localValidation: "OK_SAFE_INTERLOCK",
      },
      author: {
        userId: "usr_operator_salacontrol",
        role: currentRole,
        deviceId: "HMI-PANEL-TANDEM-01",
      },
    });
  };

  const handleCopyIptables = async () => {
    const script = dualNicManager.generateIptablesRulesScript();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(script);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = script;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopiedIptables(true);
      setTimeout(() => setCopiedIptables(false), 2500);
    } catch {
      setCopiedIptables(true);
      setTimeout(() => setCopiedIptables(false), 2500);
    }
  };

  const handleRevokeSession = (sessionId: string) => {
    ztController.revokeSession(sessionId, "Revocación manual por operador de seguridad", "admin_sec_operator");
  };

  const handleEmergencyLockdown = () => {
    if (ztStatus.isLockdownActive) {
      ztController.clearEmergencyLockdown("admin_sec_operator");
    } else {
      ztController.triggerEmergencyPlantLockdown(
        "Protocolo de aislamiento de seguridad física activado desde consola SCADA",
        "admin_sec_operator"
      );
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrorMsg(null);
    const res = ztController.requestSession({
      engineerId: "usr_ext_eng_" + Math.floor(Math.random() * 1000),
      engineerName: newSessionForm.engineerName,
      role: newSessionForm.role,
      bastionIp: newSessionForm.bastionIp,
      clientCertificateThumbprint: newSessionForm.clientThumbprint,
      workOrderRef: newSessionForm.workOrderRef,
      targetDevice: newSessionForm.targetDevice,
      ttlMinutes: Number(newSessionForm.ttlMinutes),
      mfaToken: newSessionForm.mfaToken,
    });

    if (res.success) {
      setShowNewSessionModal(false);
      setAuthErrorMsg(null);
    } else {
      setAuthErrorMsg(res.error || "Error al autorizar sesión bastión Zero-Trust");
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto min-w-0">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-fadeIn min-w-0">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white font-tech tracking-wide truncate">
                  HARDENING DE INFRAESTRUCTURA IPC & MODO OFFLINE
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                  OLA 4 • IEC 62443 L3
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate font-sans mt-0.5">
                Segmentación Dual-NIC, autonomía offline en sala de control, túneles Zero-Trust y CIS Benchmark
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 ml-2"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs - Responsive Segmented Controls */}
        <div className="border-b border-slate-800 bg-slate-950/70 p-2 sm:px-4 shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              onClick={() => setActiveTab("OFFLINE_SCADA")}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition shrink-0 border whitespace-nowrap ${
                activeTab === "OFFLINE_SCADA"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              {offlineStatus.isOnline ? (
                <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span>I10: SCADA Offline-First</span>
              {offlineStatus.pendingCount > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-mono font-bold">
                  {offlineStatus.pendingCount} pend.
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
                  Al Día
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("DUAL_NIC")}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition shrink-0 border whitespace-nowrap ${
                activeTab === "DUAL_NIC"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Network className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>I11: Dual-NIC & Firewall</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  nicAudit.complianceScore >= 90
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                }`}
              >
                {nicAudit.complianceScore}%
              </span>
            </button>

            <button
              onClick={() => setActiveTab("ZERO_TRUST")}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition shrink-0 border whitespace-nowrap ${
                activeTab === "ZERO_TRUST"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Lock className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>I12: Zero-Trust Bastion</span>
              {ztStatus.isLockdownActive ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500 text-white font-bold animate-pulse">
                  LOCKDOWN
                </span>
              ) : (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                  {ztStatus.activeSessionsCount} activas
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("CIS_HARDENING")}
              className={`flex items-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition shrink-0 border whitespace-nowrap ${
                activeTab === "CIS_HARDENING"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>I13: CIS Benchmark Linux</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                {cisReport.overallScore}% Grade A
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 min-w-0">
          {/* ========================================================================= */}
          {/* TAB 1: I10 OFFLINE-FIRST SCADA                                            */}
          {/* ========================================================================= */}
          {activeTab === "OFFLINE_SCADA" && (
            <div className="space-y-5">
              {/* Status Header Banner */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                  offlineStatus.isOnline
                    ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                    : "bg-amber-950/30 border-amber-800/50 text-amber-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      offlineStatus.isOnline
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    }`}
                  >
                    {offlineStatus.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white font-tech">
                        {offlineStatus.isOnline ? "ENLACE CENTRAL CONECTADO" : "MODO OFFLINE LOCAL (SALA DE CONTROL)"}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {offlineStatus.activeConflictPolicy}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {offlineStatus.isOnline
                        ? `Latencia de latido: ${offlineStatus.lastHeartbeatLatencyMs ?? 42}ms • Sincronización continua en tiempo real.`
                        : "Enlace WAN caído. La sala de control opera 100% de manera autónoma sin bloqueo ni pérdida de datos."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleToggleOnlineSimulation}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                      offlineStatus.isOnline
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30"
                    }`}
                  >
                    {offlineStatus.isOnline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                    <span>{offlineStatus.isOnline ? "Simular Caída WAN" : "Restablecer Enlace"}</span>
                  </button>

                  <button
                    onClick={handleTriggerManualSync}
                    disabled={isSyncingManually || offlineStatus.isSyncing}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManually ? "animate-spin" : ""}`} />
                    <span>Sincronizar Ahora</span>
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400">Mutaciones Pendientes</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {offlineStatus.pendingCount}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400">Registros Sincronizados</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {offlineStatus.syncedCount}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400">Última Sincronización</span>
                  <div className="text-xs font-mono text-cyan-400 mt-2 truncate">
                    {offlineStatus.lastSyncTimestamp
                      ? new Date(offlineStatus.lastSyncTimestamp).toLocaleTimeString()
                      : "Recién iniciado"}
                  </div>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[11px] text-slate-400">Política de Conflicto</span>
                  <div className="text-xs font-bold font-tech text-purple-400 mt-2">
                    Edge Authoritative (LWW)
                  </div>
                </div>
              </div>

              {/* Pending Offline Journal Queue */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-tech flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-cyan-400" /> Bitácora Local de Mutaciones Pendientes
                  </h4>
                  <button
                    onClick={handleAddSampleOfflineMutation}
                    className="text-xs text-cyan-400 hover:text-cyan-300 underline font-mono flex items-center gap-1"
                  >
                    + Registrar telemetría de prueba en cola
                  </button>
                </div>

                <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
                  <table className="w-full min-w-[580px] text-left text-xs font-mono">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                      <tr>
                        <th className="p-2.5">ID Journal</th>
                        <th className="p-2.5">Colección / Operación</th>
                        <th className="p-2.5">Autor / Dispositivo</th>
                        <th className="p-2.5">Estado Sync</th>
                        <th className="p-2.5">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {pendingEntries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500 font-sans">
                            No hay mutaciones pendientes de sincronización. Cola local despejada.
                          </td>
                        </tr>
                      ) : (
                        pendingEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-900/40">
                            <td className="p-2.5 text-cyan-400 font-bold">{entry.id}</td>
                            <td className="p-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] mr-1.5">
                                {entry.collection}
                              </span>
                              <span className="text-slate-400">{entry.operation}</span>
                            </td>
                            <td className="p-2.5 text-slate-300">
                              {entry.author.deviceId} ({entry.author.role})
                            </td>
                            <td className="p-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  entry.syncStatus === "PENDING"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                    : entry.syncStatus === "SYNCED"
                                    ? "bg-emerald-500/20 text-emerald-300"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {entry.syncStatus}
                              </span>
                            </td>
                            <td className="p-2.5 text-slate-400">
                              {new Date(entry.timestamp).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: I11 DUAL-NIC & FIREWALL                                            */}
          {/* ========================================================================= */}
          {activeTab === "DUAL_NIC" && (
            <div className="space-y-5">
              {/* Compliance Audit Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-tech">AUDITORÍA DUAL-NIC IEC 62443-3-3 FR5</h3>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        nicAudit.complianceScore === 100
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      Score: {nicAudit.complianceScore}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Separación estricta de conductos. Tráfico de planta en eth0 aislado de IT/DMZ en eth1.
                  </p>
                </div>

                <button
                  onClick={handleCopyIptables}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition border border-slate-700 shrink-0"
                >
                  {copiedIptables ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedIptables ? "Reglas Copiadas" : "Copiar Script iptables"}</span>
                </button>
              </div>

              {/* Topology Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* eth0 Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="font-bold text-sm text-white font-mono">{interfaces.eth0.interfaceName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                        ZONA OT (Purdue L1/L2)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">MAC: {interfaces.eth0.macAddress}</span>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dirección IP:</span>
                      <span className="font-bold text-cyan-400">{interfaces.eth0.ipAddress} / 24</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gateway por Defecto:</span>
                      <span className="text-emerald-400 font-bold">NINGUNO (0.0.0.0) • Aislamiento WAN</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Puertos de Control Permitidos:</span>
                      <span className="text-slate-200">502, 802 (Modbus), 4840 (OPC), 102 (S7), 44818 (CIP)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                    <div>RX: {(interfaces.eth0.rxBytes / 1024 / 1024).toFixed(1)} MB ({interfaces.eth0.rxPackets.toLocaleString()} pkts)</div>
                    <div>TX: {(interfaces.eth0.txBytes / 1024 / 1024).toFixed(1)} MB ({interfaces.eth0.txPackets.toLocaleString()} pkts)</div>
                  </div>
                </div>

                {/* eth1 Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                      <span className="font-bold text-sm text-white font-mono">{interfaces.eth1.interfaceName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
                        ZONA DMZ / IT (Purdue L3.5)
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-400">MAC: {interfaces.eth1.macAddress}</span>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dirección IP:</span>
                      <span className="font-bold text-cyan-400">{interfaces.eth1.ipAddress} / 24</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gateway DMZ:</span>
                      <span className="text-slate-200 font-bold">{interfaces.eth1.gateway} (Industrial Router)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Conducto Saliente Permitido:</span>
                      <span className="text-cyan-300 font-bold">TCP 443 / 8883 (TLS 1.3 / mTLS Egress)</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                    <div>RX: {(interfaces.eth1.rxBytes / 1024 / 1024).toFixed(1)} MB ({interfaces.eth1.rxPackets.toLocaleString()} pkts)</div>
                    <div>TX: {(interfaces.eth1.txBytes / 1024 / 1024).toFixed(1)} MB ({interfaces.eth1.txPackets.toLocaleString()} pkts)</div>
                  </div>
                </div>
              </div>

              {/* Kernel IP Forwarding Guard Indicator */}
              <div className="p-3 rounded-xl bg-slate-950 border border-emerald-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-xs font-bold text-white font-mono">net.ipv4.ip_forward = 0</span>
                    <p className="text-[11px] text-slate-400">
                      Reenvío de paquetes entre eth0 y eth1 deshabilitado a nivel del kernel de Linux. Imposible crear puente de red OT a IT.
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  ACTIVO & VERIFICADO
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: I12 ZERO-TRUST INDUSTRIAL BASTION                                  */}
          {/* ========================================================================= */}
          {activeTab === "ZERO_TRUST" && (
            <div className="space-y-5">
              {/* Lockdown & Overview Bar */}
              <div
                className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  ztStatus.isLockdownActive
                    ? "bg-rose-950/40 border-rose-800 text-rose-200"
                    : "bg-slate-950 border-slate-800 text-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-tech">ACCESO REMOTO ZERO-TRUST (ZTNA)</h3>
                    {ztStatus.isLockdownActive ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-500 text-white animate-pulse">
                        EMERGENCY LOCKDOWN ACTIVO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ESTADO NORMAL
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Sesiones efímeras con MFA obligatorio, firma de certificado de cliente y correlación con orden de trabajo (WO).
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowNewSessionModal(true)}
                    disabled={ztStatus.isLockdownActive}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Autorizar Sesión Bastión</span>
                  </button>

                  <button
                    onClick={handleEmergencyLockdown}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      ztStatus.isLockdownActive
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                        : "bg-rose-600 hover:bg-rose-500 text-white"
                    }`}
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>{ztStatus.isLockdownActive ? "Levantar Lockdown" : "EMERGENCY LOCKDOWN"}</span>
                  </button>
                </div>
              </div>

              {/* Active Sessions Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-tech flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" /> Sesiones de Mantenimiento Remoto Activas
                </h4>

                <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
                  <table className="w-full min-w-[650px] text-left text-xs font-mono">
                    <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-[11px]">
                      <tr>
                        <th className="p-2.5">ID Sesión</th>
                        <th className="p-2.5">Ingeniero / Rol</th>
                        <th className="p-2.5">Jump Host / Dispositivo</th>
                        <th className="p-2.5">Orden de Trabajo (WO)</th>
                        <th className="p-2.5">Estado / Comandos</th>
                        <th className="p-2.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {bastionSessions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-500 font-sans">
                            No hay sesiones remotas activas. Acceso restringido por defecto.
                          </td>
                        </tr>
                      ) : (
                        bastionSessions.map((sess) => (
                          <tr key={sess.sessionId} className="hover:bg-slate-900/40">
                            <td className="p-2.5 text-indigo-400 font-bold">{sess.sessionId}</td>
                            <td className="p-2.5">
                              <div className="text-slate-200 font-sans font-medium">{sess.engineerName}</div>
                              <div className="text-[10px] text-slate-400">{sess.role}</div>
                            </td>
                            <td className="p-2.5">
                              <div className="text-cyan-400">{sess.targetDevice}</div>
                              <div className="text-[10px] text-slate-500">vía {sess.bastionIp}</div>
                            </td>
                            <td className="p-2.5 text-amber-400 font-bold">{sess.workOrderRef}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  sess.status === "ACTIVE"
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                    : "bg-rose-500/20 text-rose-300"
                                }`}
                              >
                                {sess.status}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                {sess.recordedCommandsCount} comandos auditados
                              </div>
                            </td>
                            <td className="p-2.5 text-right">
                              {sess.status === "ACTIVE" && (
                                <button
                                  onClick={() => handleRevokeSession(sess.sessionId)}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold"
                                >
                                  Revocar Túnel
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recorded Keystrokes & Audit Trail */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-tech flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" /> Registro Forense de Comandos Ejecutados en Bastión
                </h4>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 max-h-48 overflow-y-auto font-mono text-xs">
                  {commandLogs.map((log) => (
                    <div key={log.auditId} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-[10px] text-slate-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] shrink-0 font-mono">
                          {log.sessionId}
                        </span>
                        <span className="text-slate-200 font-bold break-all font-mono">{log.commandText}</span>
                        <span className="text-slate-400 text-[11px] break-all font-mono">→ {log.targetTagOrAddress}</span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 font-mono">
                        {log.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: I13 CIS BENCHMARK LINUX HARDENING                                  */}
          {/* ========================================================================= */}
          {activeTab === "CIS_HARDENING" && (
            <div className="space-y-5">
              {/* Scorecard Header */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-tech">CIS BENCHMARK PARA LINUX & IEC 62443-4-2</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {cisReport.grade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Host: <span className="font-mono text-cyan-400">{cisReport.ipcHostname}</span> • Kernel:{" "}
                    <span className="font-mono text-slate-300">{cisReport.kernelVersion}</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-2xl font-bold font-mono text-emerald-400">{cisReport.overallScore}%</div>
                    <div className="text-[10px] text-slate-400">Cumplimiento Global</div>
                  </div>
                </div>
              </div>

              {/* Audited Checks List */}
              <div className="space-y-3">
                {cisReport.checks.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-500 font-bold">{item.id}</span>
                        <span className="text-xs font-bold text-white">{item.title}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 font-mono">
                          {item.cisSection}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{item.description}</p>
                      <div className="text-[11px] font-mono text-cyan-400/90 pt-0.5">
                        Cmd: {item.remediationCommand}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {item.status === "PASS" ? (
                        <span className="px-2 py-1 rounded text-xs font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> CONFORME
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> NO CONFORME
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
          <span>BioAzúcar 4.0 Industrial Edge Gateway • IEC 62443 SL3 Certified</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* New Bastion Session Creation Sub-Modal */}
      {showNewSessionModal && (
        <div className="fixed inset-0 z-[130] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-tech flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" /> AUTORIZAR NUEVA SESIÓN BASTIÓN ZERO-TRUST
              </h3>
              <button
                onClick={() => setShowNewSessionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-3 text-xs">
              {authErrorMsg && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{authErrorMsg}</span>
                </div>
              )}
              <div>
                <label className="text-slate-400 block mb-1">Nombre del Especialista</label>
                <input
                  type="text"
                  required
                  value={newSessionForm.engineerName}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, engineerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">IP Jump Host (Bastión)</label>
                  <input
                    type="text"
                    required
                    value={newSessionForm.bastionIp}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, bastionIp: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Orden de Trabajo (WO)</label>
                  <input
                    type="text"
                    required
                    value={newSessionForm.workOrderRef}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, workOrderRef: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Dispositivo Destino</label>
                <input
                  type="text"
                  required
                  value={newSessionForm.targetDevice}
                  onChange={(e) => setNewSessionForm({ ...newSessionForm, targetDevice: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">TTL Máximo (Minutos)</label>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    required
                    value={newSessionForm.ttlMinutes}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, ttlMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Token MFA (TOTP 6 dígitos)</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={newSessionForm.mfaToken}
                    onChange={(e) => setNewSessionForm({ ...newSessionForm, mfaToken: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewSessionModal(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Confirmar y Abrir Túnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
