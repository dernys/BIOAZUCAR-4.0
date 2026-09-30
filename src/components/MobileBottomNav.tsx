import React, { useState } from "react";
import {
  LayoutDashboard,
  GitBranch,
  ShieldAlert,
  Sparkles,
  Layers,
  X,
  Search,
  Building2,
  Zap,
  Boxes,
  Tractor,
  TrendingUp,
  Wrench,
  Users,
  Settings,
  Database,
  ChevronRight,
  ShieldCheck,
  Award,
  Factory,
  Radio,
} from "lucide-react";
import { NavigationTab, UserRole, UserAccount, TenantEnterprise, AlarmEvent } from "../types";

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  activeAlarmsCount?: number;
  onOpenCopilot?: () => void;
  currentUser?: UserAccount;
  currentRole?: UserRole;
  activeTenant?: TenantEnterprise;
  tenants?: TenantEnterprise[];
  onSelectTenant?: (tenant: TenantEnterprise) => void;
  plantStatus?: string;
  theme?: "dark" | "light";
  onOpenDbModal?: () => void;
  dbLatencyMs?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  activeAlarmsCount = 0,
  onOpenCopilot,
  currentUser,
  currentRole,
  activeTenant,
  tenants = [],
  onSelectTenant,
  plantStatus = "OPERACION_NORMAL",
  theme = "dark",
  onOpenDbModal,
  dbLatencyMs = 45,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const isLight = theme === "light";
  const isSuper = currentRole === "superadmin" || currentUser?.isSuperAdmin;
  const isAdmin = isSuper || currentRole === "administrador";

  // Categorized domains for quick mobile exploration conforming to ISA-95
  const domainGroups: {
    category: string;
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    items: {
      id: NavigationTab;
      label: string;
      desc: string;
      icon: React.ComponentType<{ className?: string }>;
      tag?: string;
      adminOnly?: boolean;
      superAdminOnly?: boolean;
      highlight?: boolean;
    }[];
  }[] = [
    {
      category: "PLANT",
      title: "Operación & Planta (L3/L2)",
      icon: Factory,
      items: [
        { id: "dashboard", label: "Dashboard KPI", desc: "Producción TCH y OEE", icon: LayoutDashboard },
        { id: "scada", label: "Sinóptico SCADA", desc: "Mímico dinámico & lazos PID", icon: GitBranch },
        { id: "energy_dispatch", label: "Energía & Calderas", desc: "ASME PTC 4 & MW despacho", icon: Zap, tag: "Cogen" },
        { id: "digital_twin", label: "Gemelo Digital 3D", desc: "Three.js espacial WebGL", icon: Boxes, tag: "3D" },
        { id: "batches", label: "Trazabilidad LIMS", desc: "Batey, pesaje y Pol", icon: Building2 },
      ],
    },
    {
      category: "AGRONOMY",
      title: "Campo & Plan Agrícola (PDA)",
      icon: Tractor,
      items: [
        { id: "agricultural_pda", label: "Plan Agrícola PDA", desc: "Campo, CCT & Frentes de corte", icon: Tractor, tag: "PDA" },
      ],
    },
    {
      category: "OT_OBSERVABILITY",
      title: "Historiador & Observabilidad OT",
      icon: Radio,
      items: [
        { id: "historian", label: "Historiador TSDB", desc: "Tendencias & LTTB compresión", icon: TrendingUp },
        { id: "uns_hub", label: "Hub UNS Sparkplug B", desc: "Namespace ISA-95 unificado", icon: Radio, tag: "MQTT" },
        { id: "alarms", label: "Centro de Alarmas", desc: "ISA-18.2 E-Stops & Trips", icon: ShieldAlert },
      ],
    },
    {
      category: "MAINTENANCE_SECURITY",
      title: "Mantenimiento & Gobierno IAM",
      icon: ShieldCheck,
      items: [
        { id: "equipment", label: "Mantenimiento CMMS", desc: "Órdenes de trabajo & MTBF", icon: Wrench },
        { id: "users_roles", label: "Seguridad & IAM", desc: "Roles, ABAC & Gobernanza IEC 62443", icon: Users, adminOnly: true, tag: "SL3", highlight: true },
        { id: "system_config", label: "Configuración Sistema", desc: "Parámetros & variables globales", icon: Settings, adminOnly: true },
      ],
    },
    {
      category: "ENTERPRISE",
      title: "Directorio Multi-Central",
      icon: Building2,
      items: [
        { id: "enterprises", label: "Directorio de Ingenios", desc: "Flota multi-tenant & KPIs", icon: Building2, superAdminOnly: true },
      ],
    },
  ];

  // Flat list filtered by search and permissions
  const filteredGroups = domainGroups.map((group) => {
    const visibleItems = group.items.filter((item) => {
      if (item.superAdminOnly && !isSuper) return false;
      if (item.adminOnly && !isAdmin) return false;
      if (searchQuery.trim() === "") return true;
      const q = searchQuery.toLowerCase();
      return item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
    });
    return { ...group, items: visibleItems };
  }).filter((g) => g.items.length > 0);

  const handleSelectTab = (tab: NavigationTab) => {
    onTabChange(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FIXED BOTTOM DOCKED ACTION BAR (SMARTPHONE / COMPACT TABLET)            */}
      {/* ========================================================================= */}
      <nav
        aria-label="Navegación Móvil de Planta"
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl transition-colors shadow-2xl safe-area-bottom ${
          isLight
            ? "bg-white/95 border-slate-200 text-slate-800 shadow-slate-400/20"
            : "bg-slate-950/95 border-slate-800/90 text-slate-200 shadow-black/80"
        }`}
      >
        <div className="grid grid-cols-5 h-16 max-w-md mx-auto px-1 items-center">
          {/* Button 1: Dashboard */}
          <button
            onClick={() => onTabChange("dashboard")}
            className={`flex flex-col items-center justify-center h-full min-w-[48px] py-1 transition-transform active:scale-95 ${
              activeTab === "dashboard"
                ? isLight
                  ? "text-emerald-700 font-bold"
                  : "text-emerald-400 font-bold"
                : isLight
                ? "text-slate-500 hover:text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className={`p-1 rounded-xl transition ${activeTab === "dashboard" ? (isLight ? "bg-emerald-100" : "bg-emerald-950/70") : ""}`}>
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Dashboard</span>
          </button>

          {/* Button 2: SCADA */}
          <button
            onClick={() => onTabChange("scada")}
            className={`flex flex-col items-center justify-center h-full min-w-[48px] py-1 transition-transform active:scale-95 ${
              activeTab === "scada"
                ? isLight
                  ? "text-emerald-700 font-bold"
                  : "text-emerald-400 font-bold"
                : isLight
                ? "text-slate-500 hover:text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className={`p-1 rounded-xl transition ${activeTab === "scada" ? (isLight ? "bg-emerald-100" : "bg-emerald-950/70") : ""}`}>
              <GitBranch className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate">SCADA</span>
          </button>

          {/* Button 3: COPILOT AI (CENTER ELEVATED ACTION) */}
          <div className="flex flex-col items-center justify-center -mt-5">
            <button
              onClick={() => {
                if (onOpenCopilot) {
                  onOpenCopilot();
                } else {
                  onTabChange("dashboard");
                }
              }}
              className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/50 hover:shadow-emerald-700/60 active:scale-90 transition-transform ring-4 ring-slate-950"
              title="Abrir BioAzúcar Copilot IA"
            >
              <Sparkles className="w-6 h-6 animate-pulse" />
            </button>
            <span className="text-[9px] font-bold font-mono tracking-tighter mt-1 text-emerald-400">
              Copilot
            </span>
          </div>

          {/* Button 4: Alarmas */}
          <button
            onClick={() => onTabChange("alarms")}
            className={`flex flex-col items-center justify-center h-full min-w-[48px] py-1 relative transition-transform active:scale-95 ${
              activeTab === "alarms"
                ? isLight
                  ? "text-rose-700 font-bold"
                  : "text-rose-400 font-bold"
                : isLight
                ? "text-slate-500 hover:text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className={`p-1 rounded-xl relative transition ${activeTab === "alarms" ? (isLight ? "bg-rose-100" : "bg-rose-950/70") : ""}`}>
              <ShieldAlert className="w-5 h-5" />
              {activeAlarmsCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 min-w-[16px] text-center rounded-full text-[9px] font-mono font-extrabold bg-rose-600 text-white animate-pulse shadow-xs">
                  {activeAlarmsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Alarmas</span>
          </button>

          {/* Button 5: MENÚ / DOMINIOS (DRAWER TRIGGER) */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className={`flex flex-col items-center justify-center h-full min-w-[48px] py-1 transition-transform active:scale-95 ${
              isDrawerOpen
                ? isLight
                  ? "text-indigo-700 font-bold"
                  : "text-indigo-400 font-bold"
                : isLight
                ? "text-slate-500 hover:text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <div className={`p-1 rounded-xl transition ${isDrawerOpen ? (isLight ? "bg-indigo-100" : "bg-indigo-950/70") : ""}`}>
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight truncate">Módulos</span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 2. MOBILE DRAWER / SHEET FOR ALL SYSTEM DOMAINS & MODULES                  */}
      {/* ========================================================================= */}
      {isDrawerOpen && (
        <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`w-full max-h-[88vh] rounded-t-3xl border-t shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-900"
                : "bg-slate-950 border-slate-800 text-slate-100"
            }`}
          >
            {/* Header of Drawer */}
            <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isLight ? "border-slate-200 bg-white" : "border-slate-800/80 bg-slate-900/50"}`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Centro de Control & Módulos</h3>
                  <p className="text-[11px] font-mono text-slate-500">
                    {activeTenant?.name || "BioAzúcar 4.0"} • {currentRole?.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className={`p-2 rounded-xl border min-w-[44px] min-h-[44px] flex items-center justify-center transition ${
                  isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300"
                }`}
                aria-label="Cerrar menú"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search */}
            <div className="p-3 border-b border-slate-800/40">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar módulo, SCADA, caldera, LIMS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none ${
                    isLight
                      ? "bg-white border-slate-300 text-slate-900 focus:border-emerald-600"
                      : "bg-slate-900 border-slate-800 text-slate-200 focus:border-emerald-500"
                  }`}
                />
              </div>
            </div>

            {/* Quick Switch Tenant / Central Azucarero */}
            {tenants.length > 1 && (
              <div className="px-4 py-2 border-b border-slate-800/40 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">Central:</span>
                {tenants.map((t) => {
                  const isSel = activeTenant?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (onSelectTenant) onSelectTenant(t);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 transition flex items-center gap-1.5 border ${
                        isSel
                          ? isLight
                            ? "bg-cyan-100 text-cyan-950 border-cyan-500 font-bold"
                            : "bg-cyan-950/80 text-cyan-300 border-cyan-500/50 font-bold"
                          : isLight
                          ? "bg-white text-slate-700 border-slate-300"
                          : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.themeColor || "#059669" }} />
                      <span>{t.code || t.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Modules List by ISA-95 Group */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
              {filteredGroups.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.category} className="space-y-1.5">
                    <div className="flex items-center gap-2 px-1">
                      <GroupIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {group.title}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isCurrent = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelectTab(item.id)}
                            className={`w-full min-h-[50px] p-3 rounded-2xl flex items-center justify-between text-left transition border ${
                              isCurrent
                                ? isLight
                                  ? "bg-emerald-50 border-2 border-emerald-600 text-emerald-950 font-bold shadow-xs"
                                  : "bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 font-bold shadow-md shadow-emerald-950/30"
                                : isLight
                                ? "bg-white hover:bg-slate-100 border-slate-200 text-slate-800"
                                : "bg-slate-900/70 hover:bg-slate-800 border-slate-800/80 text-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                                  isCurrent
                                    ? isLight
                                      ? "bg-emerald-600 text-white border-emerald-700"
                                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : isLight
                                    ? "bg-slate-100 text-slate-700 border-slate-300"
                                    : "bg-slate-800 text-slate-400 border-slate-700"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold">{item.label}</span>
                                  {item.tag && (
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                      isLight ? "bg-slate-200 text-slate-800 border border-slate-300" : "bg-slate-800 text-slate-300"
                                    }`}>
                                      {item.tag}
                                    </span>
                                  )}
                                </div>
                                <span className={`text-[10px] block truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>
                                  {item.desc}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 shrink-0 ${isCurrent ? (isLight ? "text-emerald-700" : "text-emerald-400") : "text-slate-500"}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Status and Diagnostics Tile at Bottom of Drawer */}
              <div className={`p-3 rounded-2xl border text-xs font-mono space-y-1.5 ${
                isLight ? "bg-white border-slate-200 text-slate-700" : "bg-slate-900/50 border-slate-800 text-slate-400"
              }`}>
                <div className="flex items-center justify-between">
                  <span>Modo Operativo:</span>
                  <span className={`font-bold ${plantStatus === "OPERACION_NORMAL" ? "text-emerald-500" : "text-amber-500"}`}>
                    {plantStatus}
                  </span>
                </div>
                {onOpenDbModal && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40">
                    <button
                      onClick={() => {
                        setIsDrawerOpen(false);
                        onOpenDbModal();
                      }}
                      className="text-emerald-400 hover:underline flex items-center gap-1.5"
                    >
                      <Database className="w-3.5 h-3.5" />
                      <span>Ver Persistencia Cloud ({dbLatencyMs}ms)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
