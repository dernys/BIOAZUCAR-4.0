import React, { useState } from "react";
import {
  Factory,
  ShieldCheck,
  User,
  Sliders,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Zap,
  Activity,
  AlertTriangle,
  Flame,
  Radio,
  Clock,
  Shield,
  Settings,
  Crown,
  Fingerprint,
  Building2,
  ChevronDown,
  Users,
  Check,
  Sparkles
} from "lucide-react";
import { UserRole, PlantStatus, AlarmEvent, SimulationScenario, UserAccount, TenantEnterprise } from "../types";
import { getRoleBadgeInfo } from "../services/rbacService";

export interface HeaderProps {
  currentRole: UserRole;
  currentUser: UserAccount;
  tenants?: TenantEnterprise[];
  activeTenant?: TenantEnterprise;
  onSelectTenant?: (tenant: TenantEnterprise) => void;
  onRoleChange: (role: UserRole) => void;
  onOpenRbacModal: () => void;
  onOpenAuthModal: () => void;
  onOpenConfigVerification?: () => void;
  onOpenTenantsModal?: () => void;
  onOpenCreateTenantWizard?: () => void;
  onOpenCopilot?: () => void;
  plantStatus?: PlantStatus;
  scenario: SimulationScenario;
  onScenarioChange: (scenario: SimulationScenario) => void;
  isSimRunning: boolean;
  onToggleSim: () => void;
  speedMultiplier: number;
  onSpeedChange: (speed: number) => void;
  alarms?: AlarmEvent[];
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  currentUser,
  tenants = [],
  activeTenant,
  onSelectTenant,
  onRoleChange,
  onOpenRbacModal,
  onOpenAuthModal,
  onOpenConfigVerification,
  onOpenTenantsModal,
  onOpenCreateTenantWizard,
  onOpenCopilot,
  plantStatus = "OPERACION_NORMAL",
  scenario,
  onScenarioChange,
  isSimRunning,
  onToggleSim,
  speedMultiplier,
  onSpeedChange,
  alarms = [],
  isMuted: propIsMuted,
  onToggleMute,
}) => {
  const [internalMuted, setInternalMuted] = useState(false);
  const [isTenantMenuOpen, setIsTenantMenuOpen] = useState(false);
  const [tenantSearch, setTenantSearch] = useState("");
  const isMuted = propIsMuted !== undefined ? propIsMuted : internalMuted;
  const toggleMute = onToggleMute || (() => setInternalMuted((p) => !p));

  const safeAlarms = Array.isArray(alarms) ? alarms : [];
  const activeAlarms = safeAlarms.filter(
    (a) => a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED")
  );
  const criticalCount = activeAlarms.filter(
    (a) => a.severity === "CRITICA" || a.severity === "CRITICAL"
  ).length;
  const unackCount = activeAlarms.length;

  const roleInfo = getRoleBadgeInfo(currentRole);
  const isSuper = currentRole === "superadmin" || currentUser.isSuperAdmin;

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.code.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      (t.location && t.location.toLowerCase().includes(tenantSearch.toLowerCase()))
  );

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 backdrop-blur sticky top-0 z-50 px-3 sm:px-4 py-2 shadow-xl">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Brand & Plant Status */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold shrink-0">
            <Factory className="w-5 h-5 text-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm sm:text-base font-bold tracking-wider font-tech text-white uppercase flex items-center gap-1.5">
                BioAzúcar 4.0
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Multi-Tenant
                </span>
              </h1>
            </div>

            {/* Robust Multi-Tenant Selector */}
            {activeTenant ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTenantMenuOpen(!isTenantMenuOpen)}
                  className="mt-0.5 text-[11px] sm:text-xs text-slate-200 hover:text-white flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-700/70 transition shadow-inner"
                  title="Cambiar de Ingenio / Empresa o Crear Nuevo"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeTenant.themeColor || "#059669" }}
                  ></span>
                  <span className="text-cyan-300 font-bold max-w-[150px] sm:max-w-[220px] truncate">
                    {activeTenant.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isTenantMenuOpen ? "rotate-180 text-cyan-400" : ""}`} />
                </button>

                {/* Backdrop to dismiss on outside click */}
                {isTenantMenuOpen && (
                  <div
                    className="fixed inset-0 z-[65]"
                    onClick={() => setIsTenantMenuOpen(false)}
                  />
                )}

                {/* Tenant Switcher Dropdown */}
                {isTenantMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl z-[70] p-3 font-mono text-xs animate-in zoom-in-95 duration-150 backdrop-blur-xl">
                    <div className="px-1 py-1 text-[10px] text-slate-400 uppercase tracking-wider font-bold border-b border-slate-800 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                        Directorio de Ingenios
                      </span>
                      <span className="text-cyan-400 font-bold">{tenants.length} Activos</span>
                    </div>

                    {/* Quick Search if more than 2 tenants */}
                    {tenants.length > 2 && (
                      <div className="my-2">
                        <input
                          type="text"
                          placeholder="Buscar central o código..."
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    )}

                    <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                      {filteredTenants.map((t) => {
                        const isSel = activeTenant?.id === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (onSelectTenant) onSelectTenant(t);
                              setIsTenantMenuOpen(false);
                            }}
                            className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition border ${
                              isSel
                                ? "bg-cyan-950/70 text-cyan-200 border-cyan-500/50 shadow-md shadow-cyan-950/40"
                                : "hover:bg-slate-800/90 text-slate-300 border-slate-800/60"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: t.themeColor || "#059669" }}
                                />
                                <span className="font-bold truncate text-[12px]">{t.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                {t.code} • {t.nominalTch} TCH • {t.powerCapacityMW} MW • {t.location || t.country}
                              </span>
                            </div>
                            {isSel ? (
                              <Check className="w-4 h-4 text-cyan-400 shrink-0" />
                            ) : (
                              <span className="text-[10px] text-slate-500 group-hover:text-slate-300">Conmutar</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Superadmin Actions: Create with AI Wizard & Directory */}
                    {isSuper && (
                      <div className="pt-2 mt-2 border-t border-slate-800 space-y-1.5">
                        {onOpenCreateTenantWizard && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTenantMenuOpen(false);
                              onOpenCreateTenantWizard();
                            }}
                            className="w-full text-left p-2 rounded-xl text-[11px] font-bold text-emerald-300 hover:text-emerald-200 bg-gradient-to-r from-emerald-950/70 to-teal-950/70 hover:from-emerald-900/70 hover:to-teal-900/70 border border-emerald-500/40 flex items-center justify-between transition shadow-md shadow-emerald-950/30"
                          >
                            <span className="flex items-center gap-2">
                              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">✨</span>
                              Crear Nuevo Central con Asistente IA
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-mono">
                              Wizard
                            </span>
                          </button>
                        )}

                        {onOpenTenantsModal && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTenantMenuOpen(false);
                              onOpenTenantsModal();
                            }}
                            className="w-full text-center py-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/90 rounded-xl border border-slate-700 transition"
                          >
                            Gestionar Directorio de Empresas
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 font-mono truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0"></span>
                Zafra 2026-2027 • Central Azucarero
              </p>
            )}
          </div>
        </div>

        {/* Center: Live Simulation Controls & Scenario Injector */}
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-2 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
          {/* Play/Pause */}
          <button
            onClick={onToggleSim}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
              isSimRunning
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            }`}
            title={isSimRunning ? "Pausar simulación PLC" : "Reanudar simulación PLC"}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimRunning ? "PLC LIVE" : "PAUSADO"}</span>
          </button>

          {/* Speed selector */}
          <div className="flex items-center bg-slate-900 rounded border border-slate-800 p-0.5">
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition ${
                  speedMultiplier === speed
                    ? "bg-slate-700 text-emerald-400 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Scenario selector */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
            <Sliders className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={scenario}
              onChange={(e) => onScenarioChange(e.target.value as SimulationScenario)}
              className="bg-slate-900 text-xs text-slate-200 rounded px-2 py-1 border border-slate-700/80 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono max-w-[170px] sm:max-w-none truncate"
            >
              <option value="NORMAL">Modo Normal ({activeTenant?.nominalTch || 450} TCH / {activeTenant?.powerCapacityMW || 32} MW)</option>
              <option value="VIBRACION_MOLINO3">⚠️ Anomalía: Vibración Molino 3 (4.8 mm/s)</option>
              <option value="CAIDA_PRESION_CALDERA">🔥 Anomalía: Caída Presión Caldera 1</option>
              <option value="ALTO_BRIX_JUGOS">💧 Anomalía: Alto Brix Meladura (72 °Bx)</option>
              <option value="SOBRECARGA_RED_MW">⚡ Evento: Sobrecarga en Red (+24 MW)</option>
            </select>
          </div>
        </div>

        {/* Right: Alarms, Multi-Tenant, Config, RBAC & User Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Alarm indicator */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition ${
              criticalCount > 0
                ? "bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse"
                : unackCount > 0
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-800/80 border-slate-700 text-slate-400"
            }`}
            title={isMuted ? "Alarmas silenciadas" : "Audio de alarmas activo"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="font-mono font-bold">
              {unackCount > 0 ? `${unackCount} ACT` : "0 ALM"}
            </span>
          </button>

          {/* Copilot AI Trigger Button */}
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-mono transition shadow-sm"
              title="Abrir BioAzúcar Copilot AI (Asistente Industrial)"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline font-bold">Copilot</span>
            </button>
          )}

          {/* Superadmin Multi-Tenant Center Button */}
          {isSuper && onOpenTenantsModal && (
            <button
              onClick={onOpenTenantsModal}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-mono transition"
              title="Gestión de Empresas & Multi-Tenant"
            >
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden md:inline font-bold">Empresas</span>
            </button>
          )}

          {/* System Configuration Quick Action */}
          {onOpenConfigVerification && (
            <button
              onClick={onOpenConfigVerification}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono transition"
              title="Verificar y Gestionar Configuración del Sistema (CRUD)"
            >
              <Settings className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline font-bold">Config</span>
            </button>
          )}

          {/* RBAC Security Center Button */}
          <button
            onClick={onOpenRbacModal}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 text-xs font-mono transition"
            title="Matriz de Seguridad y Privilegios RBAC (IEC 62443)"
          >
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline font-bold">RBAC</span>
          </button>

          {/* User Profile & Auth Trigger */}
          <button
            onClick={onOpenAuthModal}
            className={`flex items-center gap-2 p-1 pl-2 rounded-xl border transition ${
              isSuper
                ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 ring-1 ring-amber-400/20"
                : "bg-slate-950/90 hover:bg-slate-800 border-slate-800"
            }`}
            title="Gestión de Usuario, Autenticación y Credenciales"
          >
            <div className="flex flex-col text-right hidden xl:flex">
              <span className="text-[11px] font-bold text-white leading-tight truncate max-w-[130px] flex items-center justify-end gap-1">
                {isSuper && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                {currentUser.name}
              </span>
              <span className="text-[9px] text-slate-400 uppercase font-mono">{currentUser.role}</span>
            </div>

            <div className="relative">
              <img
                src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={currentUser.name}
                className="w-7 h-7 rounded-lg object-cover border border-slate-700"
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${isSuper ? "bg-amber-400" : "bg-emerald-400"}`} />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

