import React, { useState } from "react";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Factory,
  Globe,
  MapPin,
  Zap,
  Flame,
  ShieldCheck,
  Search,
  ExternalLink,
  Save,
  X,
  RefreshCw,
  Layers,
  ArrowRight,
  TrendingUp,
  Cpu,
  Activity,
  Radio,
  Server
} from "lucide-react";
import { TenantEnterprise, UserAccount, UserRole } from "../types";
import { createTenantInDb, updateTenantInDb, deleteTenantInDb } from "../services/dbService";

interface EnterprisesManagerProps {
  tenants: TenantEnterprise[];
  activeTenant: TenantEnterprise;
  onSelectTenant: (tenant: TenantEnterprise) => void;
  currentUser: UserAccount;
  onOpenCreateWizard?: () => void;
  theme?: "light" | "dark";
}

export const EnterprisesManager: React.FC<EnterprisesManagerProps> = ({
  tenants,
  activeTenant,
  onSelectTenant,
  currentUser,
  onOpenCreateWizard,
  theme = "dark",
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantEnterprise | null>(null);
  const [deletingTenantId, setDeletingTenantId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    country: "Venezuela",
    location: "",
    taxId: "",
    nominalTch: 450,
    millCount: 5,
    powerCapacityMW: 30.0,
    boilerPressureBar: 65.0,
    boilerSteamFlowTph: 120.0,
    industrySector: "Azúcar Blanco, Refinado & Cogeneración Eléctrica",
    otProtocol: "OPC-UA",
    otGatewayHost: "192.168.10.50",
    otPort: 4840,
    otEndpointUrl: "opc.tcp://192.168.10.50:4840",
    runtimeMode: "LIVE_OT" as "LIVE_OT" | "SIMULATION",
    simulationEnabled: false,
    prometheusMetricsPath: "/metrics",
    prometheusScrapePort: 3000,
    status: "ACTIVE" as const,
    primaryAdminEmail: "",
    primaryContactPhone: "",
    themeColor: "#10b981",
    description: "",
    sugarYieldTarget: 11.5,
  });

  const isSuperAdmin = currentUser.isSuperAdmin || currentUser.role === "superadmin";

  const handleOpenCreateModal = () => {
    setFormData({
      name: "",
      code: "",
      country: "Venezuela",
      location: "",
      taxId: "",
      nominalTch: 450,
      millCount: 5,
      powerCapacityMW: 30.0,
      boilerPressureBar: 65.0,
      boilerSteamFlowTph: 120.0,
      industrySector: "Azúcar Blanco, Refinado & Cogeneración Eléctrica",
      otProtocol: "OPC-UA",
      otGatewayHost: "192.168.10.50",
      otPort: 4840,
      otEndpointUrl: "opc.tcp://192.168.10.50:4840",
      runtimeMode: "LIVE_OT",
      simulationEnabled: false,
      prometheusMetricsPath: "/metrics",
      prometheusScrapePort: 3000,
      status: "ACTIVE",
      primaryAdminEmail: currentUser.email || "admin@planta.com",
      primaryContactPhone: "+58 255 000-0000",
      themeColor: "#10b981",
      description: "Ingenio azucarero de producción continua con cogeneración y despacho al SEN.",
      sugarYieldTarget: 11.5,
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = (tenant: TenantEnterprise) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      code: tenant.code,
      country: tenant.country,
      location: tenant.location,
      taxId: tenant.taxId,
      nominalTch: tenant.nominalTch,
      millCount: tenant.millCount || 5,
      powerCapacityMW: tenant.powerCapacityMW,
      boilerPressureBar: tenant.boilerPressureBar,
      boilerSteamFlowTph: tenant.boilerSteamFlowTph || 120.0,
      industrySector: tenant.industrySector,
      otProtocol: tenant.otProtocol || "OPC-UA",
      otGatewayHost: tenant.otGatewayHost || "192.168.10.50",
      otPort: tenant.otPort || 4840,
      otEndpointUrl: tenant.otEndpointUrl || "opc.tcp://192.168.10.50:4840",
      runtimeMode: tenant.runtimeMode === "SIMULATION" ? "SIMULATION" : "LIVE_OT",
      simulationEnabled: tenant.simulationEnabled || false,
      prometheusMetricsPath: tenant.prometheusMetricsPath || "/metrics",
      prometheusScrapePort: tenant.prometheusScrapePort || 3000,
      status: tenant.status as any,
      primaryAdminEmail: tenant.primaryAdminEmail,
      primaryContactPhone: tenant.primaryContactPhone,
      themeColor: tenant.themeColor || "#10b981",
      description: tenant.description || "",
      sugarYieldTarget: tenant.sugarYieldTarget || 11.5,
    });
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
      setFeedback({ text: "El nombre y código de la empresa son requeridos.", type: "error" });
      return;
    }

    setIsProcessing(true);
    try {
      if (editingTenant) {
        // Update existing tenant
        await updateTenantInDb(editingTenant.id, formData, currentUser);
        setFeedback({
          text: `Empresa "${formData.name}" actualizada exitosamente en Cloud Firestore.`,
          type: "success",
        });
        setEditingTenant(null);
      } else {
        // Create new tenant from scratch
        await createTenantInDb(formData, currentUser);
        setFeedback({
          text: `¡Nueva empresa "${formData.name}" aprovisionada con éxito desde cero con telemetría, activos y lazos de control aislados!`,
          type: "success",
        });
        setIsCreateModalOpen(false);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al procesar la empresa.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    if (!isSuperAdmin) {
      setFeedback({ text: "Solo el Superadministrador puede eliminar empresas.", type: "error" });
      return;
    }
    if (tenants.length <= 1) {
      setFeedback({ text: "No se puede eliminar la única empresa activa del sistema.", type: "error" });
      return;
    }

    setIsProcessing(true);
    try {
      await deleteTenantInDb(tenantId, currentUser);
      setFeedback({ text: "Empresa eliminada exitosamente del ecosistema multi-inquilino.", type: "success" });
      setDeletingTenantId(null);
      // If deleted tenant was active, switch to first available
      if (activeTenant.id === tenantId) {
        const remaining = tenants.filter((t) => t.id !== tenantId);
        if (remaining.length > 0) onSelectTenant(remaining[0]);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar empresa.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.country.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white font-tech uppercase tracking-wider">
                  Directorio Corporativo Multi-Tenant
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border border-cyan-500/30">
                  {tenants.length} Centrales Registrados
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Aprovisionamiento, aislamiento de datos, monitoreo de capacidad fabril y conmutación de inquilinos en tiempo real.
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {isSuperAdmin ? (
              <>
                {onOpenCreateWizard && (
                  <button
                    type="button"
                    onClick={onOpenCreateWizard}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-md shadow-emerald-600/20"
                  >
                    <span className="text-sm">✨</span>
                    <span>Asistente Aprovisionamiento IA (Wizard)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-2 transition border border-slate-300 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 stroke-[2]" />
                  <span>Formulario Rápido</span>
                </button>
              </>
            ) : (
              <div className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500" />
                <span>Modo Inquilino Asignado ({activeTenant.name})</span>
              </div>
            )}
          </div>
        </div>

        {/* Global Multi-Tenant Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80">
          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">Empresa Activa Actual</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Factory className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 font-mono truncate">{activeTenant.name}</span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">Capacidad Molienda Total</span>
            <div className="flex items-center gap-1.5 mt-1">
              <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs font-bold text-cyan-800 dark:text-cyan-300 font-mono">
                {tenants.reduce((acc, t) => acc + (t.nominalTch || 0), 0).toLocaleString()} TCH Global
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">Generación Eléctrica Total</span>
            <div className="flex items-center gap-1.5 mt-1">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 font-mono">
                {tenants.reduce((acc, t) => acc + (t.powerCapacityMW || 0), 0).toFixed(1)} MW Cogeneración
              </span>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/60">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">Nivel de Aislamiento</span>
            <div className="flex items-center gap-1.5 mt-1">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-xs font-bold text-purple-800 dark:text-purple-300 font-mono">Firestore Partitioned</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Buscar empresa por nombre, código, país o ubicación..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-200 pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-800 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
          <span>Mostrando:</span>
          <span className="text-cyan-700 dark:text-cyan-300 font-bold">{filteredTenants.length}</span>
          <span>de {tenants.length} ingenios</span>
        </div>
      </div>

      {/* Enterprise Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTenants.map((tenant) => {
          const isActive = activeTenant.id === tenant.id;
          return (
            <div
              key={tenant.id}
              className={`rounded-2xl p-5 border transition duration-200 flex flex-col justify-between relative overflow-hidden ${
                isActive
                  ? "bg-white dark:bg-slate-900 border-cyan-500 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/40"
                  : "bg-white dark:bg-slate-900/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
              }`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute top-0 right-0 bg-cyan-600 text-white text-[10px] font-bold font-mono px-3 py-0.5 rounded-bl-xl uppercase tracking-wider flex items-center gap-1 shadow-md">
                  <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                  <span>Planta Activa</span>
                </div>
              )}

              <div>
                {/* Header Card */}
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 shadow-md border border-white/10"
                    style={{ backgroundColor: tenant.themeColor || "#10b981" }}
                  >
                    <Factory className="w-5 h-5 text-white" />
                  </div>
                  <div className="pr-12">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white font-tech tracking-wide line-clamp-1">
                      {tenant.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 font-bold">{tenant.code}</span>
                      <span className="text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-slate-400" />
                        {tenant.country}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location & Tax ID */}
                <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{tenant.location}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span>RIF / ID Fiscal:</span>
                    <span className="text-slate-800 dark:text-slate-300 font-bold">{tenant.taxId}</span>
                  </div>
                </div>

                {/* Industrial Specs Box */}
                <div className="grid grid-cols-3 gap-2 mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 text-center font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Molienda</span>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{tenant.nominalTch} TCH</span>
                    <span className="text-[9px] text-slate-400 block">{tenant.millCount || 5} molinos</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Turbina</span>
                    <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">{tenant.powerCapacityMW} MW</span>
                    <span className="text-[9px] text-slate-400 block">SEN Despacho</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Caldera</span>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{tenant.boilerPressureBar} Bar</span>
                    <span className="text-[9px] text-slate-400 block">{tenant.boilerSteamFlowTph || 120} t/h</span>
                  </div>
                </div>

                {/* OT & Prometheus Tags */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-500" />
                    <span>OT: <strong>{tenant.otProtocol || "OPC-UA"}</strong></span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span>Prometheus: <strong>:{tenant.prometheusScrapePort || 3000}</strong></span>
                  </div>
                </div>

                {/* Description */}
                {tenant.description && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 italic">
                    "{tenant.description}"
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectTenant(tenant)}
                  disabled={isActive}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default border border-slate-300 dark:border-slate-700"
                      : "bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white shadow-md shadow-cyan-600/20"
                  }`}
                >
                  {isActive ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                      <span>Planta Activa</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Conmutar a esta Planta</span>
                    </>
                  )}
                </button>

                {isSuperAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(tenant)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs transition"
                      title="Editar Empresa"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingTenantId(tenant.id)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 hover:text-rose-700 dark:text-slate-400 dark:hover:text-rose-300 border border-slate-300 dark:border-slate-700 hover:border-rose-400 text-xs transition"
                      title="Eliminar Empresa"
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
      {(isCreateModalOpen || editingTenant) && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8 text-slate-900 dark:text-slate-100">
            <div className="p-5 bg-slate-50 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white font-tech uppercase">
                    {editingTenant ? "Editar Empresa / Ingenio" : "Crear Nueva Empresa Desde Cero"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Aprovisionamiento automático de base de datos aislada, telemetría y especificaciones de campo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingTenant(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTenant} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Nombre del Ingenio / Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ingenio Santa Elena 4.0"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Código Único de Identificación *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. INGENIO-SANTA-ELENA"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s+/g, "-") })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">País / Jurisdicción</label>
                  <input
                    type="text"
                    required
                    placeholder="Venezuela, Colombia, México..."
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Ubicación / Ciudad / Estado</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Barquisimeto, Edo. Lara"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">RIF / Tax Identification / RFC</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. J-12345678-9"
                    value={formData.taxId}
                    onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">Sector Industrial & Productos</label>
                  <input
                    type="text"
                    required
                    value={formData.industrySector}
                    onChange={(e) => setFormData({ ...formData, industrySector: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Technical Specifications */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-cyan-700 dark:text-cyan-400 font-bold block mb-2 uppercase tracking-wider">
                  Especificaciones Técnicas & Capacidad de Proceso
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Capacidad Nominal (TCH)</label>
                    <input
                      type="number"
                      required
                      min={50}
                      max={2000}
                      value={formData.nominalTch}
                      onChange={(e) => setFormData({ ...formData, nominalTch: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-emerald-700 dark:text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Número de Molinos</label>
                    <input
                      type="number"
                      required
                      min={3}
                      max={8}
                      value={formData.millCount}
                      onChange={(e) => setFormData({ ...formData, millCount: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-emerald-700 dark:text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Turbogeneración (MW)</label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min={1}
                      max={200}
                      value={formData.powerCapacityMW}
                      onChange={(e) => setFormData({ ...formData, powerCapacityMW: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-cyan-700 dark:text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Presión Caldera HP (Bar)</label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min={20}
                      max={120}
                      value={formData.boilerPressureBar}
                      onChange={(e) => setFormData({ ...formData, boilerPressureBar: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-amber-700 dark:text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Caudal Vapor (t/h)</label>
                    <input
                      type="number"
                      required
                      step="1"
                      min={20}
                      max={500}
                      value={formData.boilerSteamFlowTph}
                      onChange={(e) => setFormData({ ...formData, boilerSteamFlowTph: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-amber-700 dark:text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Protocolo OT Primario</label>
                    <select
                      value={formData.otProtocol}
                      onChange={(e) => setFormData({ ...formData, otProtocol: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="OPC-UA">OPC-UA (IEC 62541)</option>
                      <option value="MQTT-Sparkplug">MQTT Sparkplug B</option>
                      <option value="Modbus-TCP">Modbus TCP</option>
                      <option value="Siemens-S7">Siemens S7 (Port 102)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Modo de Operación del Ingenio</label>
                    <select
                      value={formData.runtimeMode}
                      onChange={(e) => {
                        const mode = e.target.value as "LIVE_OT" | "SIMULATION";
                        setFormData({
                          ...formData,
                          runtimeMode: mode,
                          simulationEnabled: mode === "SIMULATION",
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-800 dark:text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
                    >
                      <option value="LIVE_OT">Planta Real / Conexión Industrial Física (LIVE_OT - Sin Simulación)</option>
                      <option value="SIMULATION">Gemelo Digital / Simulación Educativa (SIMULATION)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">IP / Host Pasarela Industrial</label>
                    <input
                      type="text"
                      required
                      placeholder="192.168.10.50 o dcs.planta.local"
                      value={formData.otGatewayHost}
                      onChange={(e) => setFormData({ ...formData, otGatewayHost: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">Puerto de Red Industrial</label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={65535}
                      value={formData.otPort}
                      onChange={(e) => setFormData({ ...formData, otPort: Number(e.target.value) })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 dark:text-slate-300 block mb-1">URL Endpoint Completa</label>
                    <input
                      type="text"
                      required
                      placeholder="opc.tcp://192.168.10.50:4840"
                      value={formData.otEndpointUrl}
                      onChange={(e) => setFormData({ ...formData, otEndpointUrl: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Administrative Contact & Style */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Email Administrador Principal</label>
                  <input
                    type="email"
                    required
                    value={formData.primaryAdminEmail}
                    onChange={(e) => setFormData({ ...formData, primaryAdminEmail: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Teléfono Planta</label>
                  <input
                    type="text"
                    value={formData.primaryContactPhone}
                    onChange={(e) => setFormData({ ...formData, primaryContactPhone: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-700 dark:text-slate-300 block mb-1">Descripción / Notas de Operación</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingTenant(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-md shadow-cyan-600/20"
                >
                  {isProcessing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingTenant ? "Actualizar Empresa" : "Crear & Aprovisionar Ingenio"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTenantId && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-tech uppercase">Confirmar Eliminación</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono mb-6">
              ¿Está seguro de que desea eliminar la empresa seleccionada? Esta acción removerá el registro del directorio multi-inquilino.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingTenantId(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-mono"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteTenant(deletingTenantId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs font-mono flex items-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Empresa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
