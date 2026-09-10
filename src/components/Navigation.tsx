import React, { useState } from "react";
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Sparkles,
  Wrench,
  TrendingUp,
  ShieldAlert,
  GitBranch,
  Zap,
  Network,
  Database,
  Search,
  Filter,
  CheckCircle2,
  ChevronDown,
  Settings,
  Building2,
  Users,
  ShieldCheck,
  Presentation,
  Tractor
} from "lucide-react";
import { NavigationTab, UserRole, UserAccount } from "../types";

export type { NavigationTab };
export type NavTabId = NavigationTab;

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  activeAlarmsCount?: number;
  onOpenDbModal?: () => void;
  dbLatencyMs?: number;
  currentUser?: UserAccount;
  currentRole?: UserRole;
  theme?: "dark" | "light";
}

type MenuCategory = "ALL" | "OPERATIONS" | "QUALITY_MAINT" | "DATA_IOT" | "AI" | "SECURITY_CONFIG";

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  activeAlarmsCount = 0,
  onOpenDbModal,
  dbLatencyMs = 24,
  currentUser,
  currentRole,
  theme = "dark",
}) => {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const isLight = theme === "light";
  const isSuper = currentRole === "superadmin" || currentUser?.isSuperAdmin;
  const isAdmin = isSuper || currentRole === "administrador";

  const allNavItems: {
    id: NavigationTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
    category: "OPERATIONS" | "QUALITY_MAINT" | "DATA_IOT" | "AI" | "SECURITY_CONFIG";
    badge?: number | null;
    highlight?: boolean;
    tag?: string;
    superAdminOnly?: boolean;
    adminOnly?: boolean;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard KPI",
      icon: LayoutDashboard,
      desc: "Producción & OEE",
      category: "OPERATIONS",
    },
    {
      id: "scada",
      label: "Sinóptico SCADA",
      icon: GitBranch,
      desc: "Mímico & Lazos PID",
      category: "OPERATIONS",
    },
    {
      id: "agricultural_pda",
      label: "Plan Agrícola PDA",
      icon: Tractor,
      desc: "Campo, CCT & ODS 2014",
      category: "OPERATIONS",
      tag: "PDA",
    },
    {
      id: "energy_dispatch",
      label: "Energía & Calderas",
      icon: Zap,
      desc: "ASME PTC 4 & PPA MW",
      category: "OPERATIONS",
      tag: "Cogen",
    },
    {
      id: "digital_twin",
      label: "Gemelo Digital 3D",
      icon: Boxes,
      desc: "Three.js WebGL",
      category: "OPERATIONS",
      tag: "3D",
    },
    {
      id: "batches",
      label: "LIMS & Caña",
      icon: Layers,
      desc: "Core Sampler & ARE",
      category: "QUALITY_MAINT",
    },
    {
      id: "equipment",
      label: "CBM & CMMS",
      icon: Wrench,
      desc: "FFT Vibración & OTs",
      category: "QUALITY_MAINT",
    },
    {
      id: "uns_hub",
      label: "UNS & IIoT Hub",
      icon: Network,
      desc: "OPC UA & Sparkplug B",
      category: "DATA_IOT",
      tag: "OT/IT",
    },
    {
      id: "historian",
      label: "Historiador",
      icon: TrendingUp,
      desc: "Tendencias & CSV",
      category: "DATA_IOT",
    },
    {
      id: "alarms",
      label: "Alarmas",
      icon: ShieldAlert,
      desc: "ISA-18.2 SOE",
      badge: activeAlarmsCount > 0 ? activeAlarmsCount : null,
      category: "DATA_IOT",
    },
    {
      id: "ai_center",
      label: "Centro IA Gemini",
      icon: Sparkles,
      desc: "Diagnósticos & Copilot",
      category: "AI",
      highlight: true,
    },
    {
      id: "presentation",
      label: "Deck Ejecutivo",
      icon: Presentation,
      desc: "Inversionistas & Clientes",
      category: "AI",
      highlight: true,
      tag: "Pitch",
    },
    {
      id: "enterprises",
      label: "Empresas Multi-Tenant",
      icon: Building2,
      desc: "Aislamiento & Capacidad",
      category: "SECURITY_CONFIG",
      superAdminOnly: true,
      tag: "Root",
    },
    {
      id: "users_roles",
      label: "Usuarios & Roles",
      icon: Users,
      desc: "RBAC & Permisos CRUD",
      category: "SECURITY_CONFIG",
      adminOnly: true,
      tag: "RBAC",
    },
    {
      id: "system_config",
      label: "Configuración",
      icon: Settings,
      desc: "Parámetros & IEC 62443",
      category: "SECURITY_CONFIG",
      tag: "Audit",
    },
  ];

  // Filter items based on permissions
  const visibleItems = allNavItems.filter((item) => {
    if (item.superAdminOnly && !isSuper) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  const filteredItems = visibleItems.filter((item) => {
    const matchesCat = selectedCategory === "ALL" || item.category === selectedCategory;
    const matchesSearch =
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <nav className={`border-b ${isLight ? "border-slate-200/90 bg-white/95 text-slate-800" : "border-slate-800 bg-slate-950/95"} backdrop-blur-md sticky top-0 z-20 shadow-sm transition-colors`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top Mini Toolbar: Categories Filter & Live Database Sync Indicator */}
        <div className={`flex flex-wrap items-center justify-between gap-2 py-1.5 border-b text-[11px] font-mono ${isLight ? "border-slate-200/80" : "border-slate-900/80"}`}>
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            <span className={`${isLight ? "text-slate-600 font-bold" : "text-slate-500"} hidden sm:inline mr-1 text-xs`}>Área:</span>
            {[
              { id: "ALL", label: "Todas las Áreas" },
              { id: "OPERATIONS", label: "Operaciones SCADA" },
              { id: "QUALITY_MAINT", label: "Calidad & CBM" },
              { id: "DATA_IOT", label: "UNS & Historiador" },
              { id: "AI", label: "IA Gemini" },
              { id: "SECURITY_CONFIG", label: "Seguridad & Config" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id as MenuCategory)}
                className={`px-2.5 py-0.5 rounded-full transition whitespace-nowrap text-xs ${
                  selectedCategory === cat.id
                    ? isLight
                      ? "bg-emerald-700 text-white font-bold border border-emerald-800 shadow-xs ring-1 ring-emerald-600/30"
                      : "bg-slate-800 text-emerald-300 font-bold border border-slate-700"
                    : isLight
                    ? "bg-slate-100 text-slate-700 hover:text-slate-950 hover:bg-slate-200 border border-slate-300/80 font-medium"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Cloud Firestore Live DB Status Button */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {onOpenDbModal && (
              <button
                onClick={onOpenDbModal}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition group text-xs ${
                  isLight
                    ? "bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-semibold shadow-xs"
                    : "bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300"
                }`}
                title="Gestor de Persistencia y Estado en Cloud Firestore"
              >
                <span className={`w-2 h-2 rounded-full animate-pulse ${isLight ? "bg-emerald-600" : "bg-emerald-400"}`}></span>
                <Database className={`w-3 h-3 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />
                <span>Cloud Firestore</span>
                <span className={`text-[10px] font-bold ${isLight ? "text-emerald-800 font-extrabold" : "text-emerald-400/70 group-hover:text-emerald-300"}`}>
                  {dbLatencyMs}ms
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Navigation Tabs */}
        <div className="flex items-center justify-start sm:justify-between overflow-x-auto no-scrollbar py-2 gap-1.5 sm:gap-2">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium transition whitespace-nowrap shrink-0 relative ${
                  isActive
                    ? isLight
                      ? item.highlight
                        ? "bg-indigo-100 text-indigo-950 border-2 border-indigo-600 shadow-xs font-bold ring-1 ring-indigo-500/30"
                        : item.id === "energy_dispatch"
                        ? "bg-amber-100 text-amber-950 border-2 border-amber-600 shadow-xs font-bold ring-1 ring-amber-500/30"
                        : item.id === "uns_hub" || item.id === "enterprises"
                        ? "bg-cyan-100 text-cyan-950 border-2 border-cyan-600 shadow-xs font-bold ring-1 ring-cyan-500/30"
                        : item.id === "users_roles" || item.id === "digital_twin"
                        ? "bg-purple-100 text-purple-950 border-2 border-purple-600 shadow-xs font-bold ring-1 ring-purple-500/30"
                        : "bg-emerald-100 text-emerald-950 border-2 border-emerald-600 shadow-xs font-bold ring-1 ring-emerald-500/30"
                      : item.highlight
                      ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 font-bold"
                      : item.id === "energy_dispatch"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10 font-bold"
                      : item.id === "uns_hub"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold"
                      : item.id === "enterprises"
                      ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10 font-bold"
                      : item.id === "users_roles"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10 font-bold"
                      : item.id === "digital_twin"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10 font-bold"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 font-bold"
                    : isLight
                    ? item.highlight
                      ? "text-indigo-800 hover:bg-indigo-50 hover:text-indigo-950 border border-indigo-200 font-semibold"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100 border border-transparent font-semibold"
                    : item.highlight
                    ? "text-indigo-300 hover:bg-indigo-950/40 hover:text-indigo-200 border border-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? isLight
                        ? item.highlight
                          ? "text-indigo-700"
                          : item.id === "energy_dispatch"
                          ? "text-amber-700"
                          : item.id === "uns_hub" || item.id === "enterprises"
                          ? "text-cyan-800"
                          : item.id === "users_roles" || item.id === "digital_twin"
                          ? "text-purple-800"
                          : "text-emerald-800"
                        : item.highlight
                        ? "text-indigo-400"
                        : item.id === "energy_dispatch"
                        ? "text-amber-400"
                        : item.id === "uns_hub"
                        ? "text-cyan-400"
                        : item.id === "enterprises"
                        ? "text-cyan-400"
                        : item.id === "users_roles"
                        ? "text-purple-400"
                        : item.id === "digital_twin"
                        ? "text-purple-400"
                        : "text-emerald-400"
                      : isLight
                      ? item.highlight
                        ? "text-indigo-600"
                        : "text-slate-600"
                      : "text-slate-400"
                  }`}
                />
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span>{item.label}</span>
                    {item.tag && !isActive && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                        isLight ? "bg-slate-200 text-slate-800 border border-slate-300" : "bg-slate-800 text-slate-400"
                      }`}>
                        {item.tag}
                      </span>
                    )}
                  </div>
                </div>

                {item.badge ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

