import React, { useState, useEffect } from "react";
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Save,
  Lock,
  Unlock,
  Cpu,
  Database,
  Radio,
  Zap,
  Flame,
  FileCheck,
  Download,
  Activity,
  Layers,
  Sparkles,
  Info,
  Server,
  Plus,
  Edit,
  Trash2,
  X,
  Sliders,
  Check,
  Building,
  RotateCcw,
  Wifi,
  WifiOff
} from "lucide-react";
import { UserRole, SystemParameterConfig, UserAccount, TenantEnterprise } from "../types";
import { INITIAL_SYSTEM_CONFIGS } from "../services/authService";
import {
  subscribeToSystemConfigs,
  createSystemConfigInDb,
  updateSystemConfigInDb,
  deleteSystemConfigInDb,
  checkDatabaseHealth,
  DatabaseHealthInfo
} from "../services/dbService";

interface SystemConfigVerificationProps {
  currentRole: UserRole;
  currentUser: UserAccount;
  activeTenant: TenantEnterprise;
  onNavigateToTab?: (tab: any) => void;
}

export const SystemConfigVerification: React.FC<SystemConfigVerificationProps> = ({
  currentRole,
  currentUser,
  activeTenant,
  onNavigateToTab,
}) => {
  const [configs, setConfigs] = useState<SystemParameterConfig[]>(INITIAL_SYSTEM_CONFIGS);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastVerificationDate, setLastVerificationDate] = useState<string>(
    new Date().toISOString().slice(0, 19).replace("T", " ")
  );
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dbHealth, setDbHealth] = useState<DatabaseHealthInfo | null>(null);
  const [categoryDiagnostics, setCategoryDiagnostics] = useState<Record<string, {
    status: "VERIFIED" | "OFFLINE" | "WARNING" | "ERROR";
    details: string;
    verifiedAt: string;
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
    remediation?: string;
    [k: string]: any;
  }>>({});
  const [diagnosticRunTime, setDiagnosticRunTime] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemParameterConfig | null>(null);
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<SystemParameterConfig, "id">>({
    name: "",
    key: "",
    category: "PLC_SCADA",
    currentValue: 100,
    defaultValue: 100,
    unit: "",
    description: "",
    minLimit: 0,
    maxLimit: 500,
    status: "VERIFIED",
    lastVerified: "",
    verifiedBy: "",
    tenantId: "GLOBAL",
  });

  const canModifyConfig =
    currentUser.isSuperAdmin ||
    currentRole === "superadmin" ||
    currentRole === "administrador" ||
    currentRole === "supervisor";

  // Run real category diagnostic against live backend
  const executeRealDiagnostic = async () => {
    setIsVerifying(true);
    try {
      const health = await checkDatabaseHealth();
      setDbHealth(health);

      const res = await fetch("/api/system/verify-diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: activeTenant.id }),
      });

      if (res.ok) {
        const data = await res.json();
        setCategoryDiagnostics(data.categories || {});
        setDiagnosticRunTime(new Date().toLocaleTimeString());

        const verifiedList = Object.values(data.categories || {}).filter((c: any) => c.status === "VERIFIED");
        const offlineList = Object.values(data.categories || {}).filter((c: any) => c.status === "OFFLINE");

        if (offlineList.length > 0) {
          setFeedbackMsg({
            text: `Auditoría completada: ${verifiedList.length} categorías verificadas, ${offlineList.length} con enlace físico offline (sin simulación). Revise detalles técnicos abajo.`,
            type: "error",
          });
        } else {
          setFeedbackMsg({
            text: `¡Diagnóstico completado con éxito! ${verifiedList.length} categorías verificadas con enlace real. Latencia Firestore: ${health.latencyMs}ms.`,
            type: "success",
          });
        }
      } else {
        throw new Error("Respuesta inválida del servidor al auditar categorías.");
      }

      const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
      setLastVerificationDate(nowStr);
    } catch (err: any) {
      setFeedbackMsg({
        text: "Error durante el diagnóstico de sistemas reales: " + err.message,
        type: "error",
      });
    } finally {
      setIsVerifying(false);
      setTimeout(() => setFeedbackMsg(null), 8000);
    }
  };

  // Subscribe to real-time configs in Firestore & trigger live diagnostic
  useEffect(() => {
    const unsub = subscribeToSystemConfigs(activeTenant.id, (list) => {
      setConfigs(list);
    });

    // Check DB health
    checkDatabaseHealth().then(setDbHealth).catch(console.warn);

    // Initial real diagnostic on active tenant change
    executeRealDiagnostic();

    return () => unsub();
  }, [activeTenant.id]);

  const handleRunGlobalDiagnostic = () => {
    executeRealDiagnostic();
  };

  const handleOpenCreateModal = () => {
    setEditingConfig(null);
    setFormData({
      name: "",
      key: `${activeTenant.code}_PARAM_${Date.now().toString().slice(-4)}`,
      category: "PLC_SCADA",
      currentValue: 50,
      defaultValue: 50,
      unit: "TCH",
      description: `Parámetro de control operacional para ${activeTenant.name}.`,
      minLimit: 0,
      maxLimit: 200,
      status: "VERIFIED",
      lastVerified: new Date().toISOString().slice(0, 19).replace("T", " "),
      verifiedBy: currentUser.name,
      tenantId: activeTenant.id,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (cfg: SystemParameterConfig) => {
    setEditingConfig(cfg);
    setFormData({
      name: cfg.name,
      key: cfg.key,
      category: cfg.category,
      currentValue: cfg.currentValue,
      defaultValue: cfg.defaultValue,
      unit: cfg.unit || "",
      description: cfg.description,
      minLimit: cfg.minLimit !== undefined ? cfg.minLimit : 0,
      maxLimit: cfg.maxLimit !== undefined ? cfg.maxLimit : 1000,
      status: cfg.status,
      lastVerified: cfg.lastVerified || "",
      verifiedBy: cfg.verifiedBy || "",
      tenantId: cfg.tenantId || "GLOBAL",
    });
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingConfig) {
        await updateSystemConfigInDb(editingConfig.id, formData, currentUser);
        setFeedbackMsg({ text: `Parámetro "${formData.name}" actualizado exitosamente.`, type: "success" });
        setEditingConfig(null);
      } else {
        await createSystemConfigInDb(formData, currentUser);
        setFeedbackMsg({ text: `Nuevo parámetro "${formData.name}" registrado exitosamente.`, type: "success" });
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Error al guardar parámetro.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    setIsProcessing(true);
    try {
      await deleteSystemConfigInDb(id, currentUser);
      setFeedbackMsg({ text: "Parámetro eliminado del registro del sistema.", type: "success" });
      setDeletingConfigId(null);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Error al eliminar parámetro.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  const handleResetToDefault = async (cfg: SystemParameterConfig) => {
    try {
      await updateSystemConfigInDb(cfg.id, { currentValue: cfg.defaultValue }, currentUser);
      setFeedbackMsg({ text: `Parámetro "${cfg.name}" restablecido a su valor nominal (${cfg.defaultValue} ${cfg.unit || ""}).`, type: "success" });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Error al restablecer valor.", type: "error" });
    }
  };

  const handleExportReport = () => {
    const jsonStr = JSON.stringify(
      {
        plant: activeTenant.name,
        tenantId: activeTenant.id,
        verifiedAt: lastVerificationDate,
        verifiedBy: `${currentUser.name} (${currentUser.role.toUpperCase()})`,
        compliance: ["IEC 62443-3-3", "ISA-95 Level 3", "ASME PTC 4", "ISO 10816"],
        parametersCount: configs.length,
        parameters: configs,
      },
      null,
      2
    );
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Config_Report_${activeTenant.code}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredConfigs = configs.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || c.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const categories = [
    { id: "ALL", label: "Todas las Categorías", icon: Layers },
    { id: "PLC_SCADA", label: "PLC & SCADA", icon: Cpu },
    { id: "IIOT_GATEWAYS", label: "IIoT & Gateways", icon: Radio },
    { id: "FIRESTORE_DB", label: "Cloud Firestore", icon: Database },
    { id: "SECURITY_RBAC", label: "Seguridad RBAC", icon: ShieldCheck },
    { id: "STEAM_ENERGY", label: "Vapor & Despacho", icon: Zap },
    { id: "QUALITY_LIMS", label: "Calidad LIMS", icon: FileCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <Settings className="w-6 h-6 animate-[spin_10s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white font-tech tracking-wide uppercase">
                  Gestión & Verificación de Configuración
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  SL-3 IEC 62443
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Auditoría en tiempo real, CRUD de parámetros de control, pasarelas IIoT y diagnóstico de enlace a Firestore.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {canModifyConfig && (
              <button
                onClick={handleOpenCreateModal}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-emerald-600/20 font-mono"
              >
                <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                <span>Nuevo Parámetro</span>
              </button>
            )}

            <button
              onClick={handleRunGlobalDiagnostic}
              disabled={isVerifying}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-xl border border-slate-700 flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isVerifying ? "animate-spin" : ""}`} />
              <span>{isVerifying ? "Auditando..." : "Diagnóstico Global"}</span>
            </button>

            <button
              onClick={handleExportReport}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Exportar Informe JSON</span>
            </button>
          </div>
        </div>

        {/* Global Health Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-mono">Estado Base de Datos</span>
            <div className="flex items-center gap-1.5 mt-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 font-mono">
                {dbHealth ? `${dbHealth.status} (${dbHealth.latencyMs}ms)` : "Online Firestore"}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-mono">Parámetros en Memoria</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-cyan-300 font-mono">{configs.length} Registros</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-mono">Inquilino Asignado</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Building className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200 font-mono truncate">{activeTenant.name}</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[11px] text-slate-400 block font-mono">Usuario Autenticado</span>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold text-purple-300 font-mono uppercase truncate">
                {currentUser.name} ({currentUser.role})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-200 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Category Pills & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            const catDiag = categoryDiagnostics[cat.id];
            const hasOffline = catDiag?.status === "OFFLINE";

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : hasOffline
                    ? "bg-rose-950/40 text-rose-300 hover:text-rose-200 border border-rose-800/60"
                    : "bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
                {catDiag && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      catDiag.status === "VERIFIED"
                        ? "bg-emerald-400"
                        : catDiag.status === "OFFLINE"
                        ? "bg-rose-500 animate-pulse"
                        : "bg-amber-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar parámetro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {/* Real Category Audit Status Panel */}
      {Object.keys(categoryDiagnostics).length > 0 && (
        <div className="bg-slate-950/80 rounded-xl p-4 border border-slate-800 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">
                Auditoría Verídica de Enlaces de Campo por Categoría (Sin Simulación)
              </span>
            </div>
            {diagnosticRunTime && (
              <span className="text-[10px] text-slate-400">
                Última verificación socket: {diagnosticRunTime}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {Object.entries(categoryDiagnostics).map(([catKey, diag]: [string, any]) => {
              const isOffline = diag.status === "OFFLINE";
              const isVerified = diag.status === "VERIFIED";

              return (
                <div
                  key={catKey}
                  className={`p-2.5 rounded-lg border flex flex-col justify-between text-[11px] ${
                    isOffline
                      ? "bg-rose-950/30 border-rose-800/50 text-rose-200"
                      : isVerified
                      ? "bg-slate-900/60 border-slate-800 text-slate-300"
                      : "bg-amber-950/20 border-amber-800/40 text-amber-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-slate-200 font-tech">{catKey}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase flex items-center gap-1 ${
                        isVerified
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : isOffline
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {isVerified ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5" /> Verificado Real
                        </>
                      ) : isOffline ? (
                        <>
                          <WifiOff className="w-2.5 h-2.5" /> Sin Enlace Físico
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-2.5 h-2.5" /> Parcial
                        </>
                      )}
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                    {diag.details}
                  </p>

                  {isOffline && diag.errorCode && (
                    <div className="mt-1.5 pt-1.5 border-t border-rose-900/40 flex items-center justify-between text-[9px] text-rose-400">
                      <span>Error: {diag.errorCode}</span>
                      <span className="truncate max-w-[140px]">{diag.remediation || "Verifique IP/Puerto"}</span>
                    </div>
                  )}

                  {isVerified && diag.latencyMs !== undefined && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[9px] text-emerald-400">
                      <span>Socket Latency:</span>
                      <span className="font-bold">{diag.latencyMs}ms</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Configuration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredConfigs.map((cfg) => {
          const catDiag = categoryDiagnostics[cfg.category];
          const isOffline = catDiag?.status === "OFFLINE";
          const isVerified = catDiag ? catDiag.status === "VERIFIED" : cfg.status === "VERIFIED";

          return (
            <div
              key={cfg.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition shadow-lg relative ${
                isOffline ? "border-rose-900/60 hover:border-rose-700/80" : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white font-tech">{cfg.name}</h3>
                    <span className="text-[11px] font-mono text-cyan-400 font-bold block mt-0.5">{cfg.key}</span>
                  </div>
                  {isOffline ? (
                    <span
                      className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 shrink-0"
                      title={catDiag?.errorMessage || "Hardware no detectado en red"}
                    >
                      <WifiOff className="w-3 h-3 text-rose-400" />
                      <span>Sin Enlace Físico</span>
                    </span>
                  ) : isVerified ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Verificado Real</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Parcial</span>
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-2 font-mono leading-relaxed line-clamp-2">
                  {cfg.description}
                </p>

                {isOffline && (
                  <div className="mt-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 text-[10px] font-mono text-rose-300 flex items-center gap-1.5">
                    <WifiOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>Sin enlace con {catDiag?.target || "PLC/Gateway"}. No se generan valores falsos.</span>
                  </div>
                )}

                {/* Values Box */}
                <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 font-mono">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Valor Actual:</span>
                    <span className={`font-bold text-sm ${isOffline ? "text-slate-300" : "text-emerald-300"}`}>
                      {cfg.currentValue} {cfg.unit || ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Nominal de Fábrica:</span>
                    <span>
                      {cfg.defaultValue} {cfg.unit || ""}
                    </span>
                  </div>

                  {cfg.minLimit !== undefined && cfg.maxLimit !== undefined && (
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 pt-1 border-t border-slate-800/60">
                      <span>Rango Seguro:</span>
                      <span>
                        [{cfg.minLimit} ... {cfg.maxLimit}] {cfg.unit || ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Verification Metadata */}
                <div className="mt-3 text-[10px] font-mono text-slate-500 space-y-0.5">
                  <div>Auditado por: <span className="text-slate-400">{cfg.verifiedBy || "Sistema Automático"}</span></div>
                  <div>Fecha: <span className="text-slate-400">{cfg.lastVerified || lastVerificationDate}</span></div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleResetToDefault(cfg)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono flex items-center gap-1 border border-slate-700 transition"
                  title="Restablecer a valor nominal por defecto"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>Restablecer</span>
                </button>

                {canModifyConfig && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(cfg)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                      title="Editar parámetro"
                    >
                      <Edit className="w-3.5 h-3.5 text-cyan-400" />
                    </button>
                    <button
                      onClick={() => setDeletingConfigId(cfg.id)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                      title="Eliminar parámetro"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {(isCreateModalOpen || editingConfig) && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8 font-mono text-xs">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-tech uppercase">
                    {editingConfig ? "Editar Parámetro de Configuración" : "Registrar Nuevo Parámetro"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Ajuste de consignas SCADA y límites operacionales en Firestore.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingConfig(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nombre Descriptivo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Consigna Velocidad Molino 1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Clave Única (Key / Tag) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. MOL1_SPEED_RPM"
                    value={formData.key}
                    onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-cyan-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Categoría del Sistema</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="PLC_SCADA">PLC & SCADA</option>
                    <option value="IIOT_GATEWAYS">IIoT & Gateways</option>
                    <option value="FIRESTORE_DB">Cloud Firestore</option>
                    <option value="SECURITY_RBAC">Seguridad RBAC</option>
                    <option value="STEAM_ENERGY">Vapor & Cogeneración</option>
                    <option value="QUALITY_LIMS">Calidad LIMS</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Unidad de Medida (Unit)</label>
                  <input
                    type="text"
                    placeholder="TCH, Bar, MW, RPM, °C..."
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Valor Actual (Operación)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.currentValue as number}
                    onChange={(e) => setFormData({ ...formData, currentValue: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Valor Nominal (Default)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={formData.defaultValue as number}
                    onChange={(e) => setFormData({ ...formData, defaultValue: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Límite Mínimo Seguro</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.minLimit}
                    onChange={(e) => setFormData({ ...formData, minLimit: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Límite Máximo Seguro</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.maxLimit}
                    onChange={(e) => setFormData({ ...formData, maxLimit: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-300 block mb-1">Descripción Funcional</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingConfig(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingConfig ? "Guardar Cambios" : "Crear Parámetro"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deletingConfigId && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-tech uppercase">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-300 mb-6">
              ¿Está seguro de que desea eliminar permanentemente este parámetro de configuración de Cloud Firestore?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingConfigId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteConfig(deletingConfigId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Parámetro</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
