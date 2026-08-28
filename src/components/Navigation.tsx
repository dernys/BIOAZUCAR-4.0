import React from "react";
import {
  LayoutDashboard,
  Cpu,
  Boxes,
  Layers,
  Sparkles,
  Wrench,
  TrendingUp,
  ShieldAlert,
  GitBranch
} from "lucide-react";

export type NavigationTab =
  | "dashboard"
  | "scada"
  | "digital_twin"
  | "batches"
  | "equipment"
  | "historian"
  | "alarms"
  | "ai_center";

export type NavTabId = NavigationTab;

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  activeAlarmsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  activeAlarmsCount = 0,
}) => {
  const navItems = [
    {
      id: "dashboard" as NavigationTab,
      label: "Dashboard KPI",
      icon: LayoutDashboard,
      desc: "Producción & OEE",
    },
    {
      id: "scada" as NavigationTab,
      label: "Sinóptico SCADA",
      icon: GitBranch,
      desc: "Mímico de Proceso",
    },
    {
      id: "digital_twin" as NavigationTab,
      label: "Gemelo Digital 3D",
      icon: Boxes,
      desc: "Three.js WebGL",
    },
    {
      id: "batches" as NavigationTab,
      label: "Lotes & Trazabilidad",
      icon: Layers,
      desc: "Recepción Caña",
    },
    {
      id: "equipment" as NavigationTab,
      label: "Equipos & CMMS",
      icon: Wrench,
      desc: "Vibración & OTs",
    },
    {
      id: "historian" as NavigationTab,
      label: "Historiador",
      icon: TrendingUp,
      desc: "Tendencias & CSV",
    },
    {
      id: "alarms" as NavigationTab,
      label: "Alarmas",
      icon: ShieldAlert,
      badge: activeAlarmsCount > 0 ? activeAlarmsCount : null,
      desc: "ISA-18.2 SOE",
    },
    {
      id: "ai_center" as NavigationTab,
      label: "Centro IA Gemini",
      icon: Sparkles,
      desc: "Diagnósticos & Chat",
      highlight: true,
    },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar py-2.5 gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition whitespace-nowrap shrink-0 relative ${
                isActive
                  ? item.highlight
                    ? "bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 shadow-lg shadow-indigo-500/20 font-bold"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 font-bold"
                  : item.highlight
                  ? "text-indigo-300 hover:bg-indigo-950/40 hover:text-indigo-200 border border-indigo-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? item.highlight
                      ? "text-indigo-400"
                      : "text-emerald-400"
                    : "text-slate-400"
                }`}
              />
              <div className="flex flex-col text-left">
                <span>{item.label}</span>
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
    </nav>
  );
};
