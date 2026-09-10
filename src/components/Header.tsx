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
  Sparkles,
  Presentation,
  Sun,
  Moon,
  Wifi,
  WifiOff,
  Layers,
  Server
} from "lucide-react";
import { UserRole, PlantStatus, AlarmEvent, SimulationScenario, UserAccount, TenantEnterprise, TelemetryData } from "../types";
import { RuntimeMode } from "../services/runtime/types";
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
  onOpenPresentation?: () => void;
  onOpenIndustrialConnectionModal?: () => void;
  runtimeMode?: RuntimeMode;
  telemetry?: TelemetryData;
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
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
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
  onOpenPresentation,
  onOpenIndustrialConnectionModal,
  runtimeMode = "SIMULATION",
  telemetry,
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
  theme = "dark",
  onToggleTheme,
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
  const isLight = theme === "light";

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      t.code.toLowerCase().includes(tenantSearch.toLowerCase()) ||
      (t.location && t.location.toLowerCase().includes(tenantSearch.toLowerCase()))
  );

  return (
    <header className={`${isLight ? "bg-white/95 border-b border-slate-200/90" : "bg-slate-900/95 border-b border-slate-800"} backdrop-blur sticky top-0 z-50 px-3 sm:px-4 py-2 shadow-xl transition-colors`}>
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
              <h1 className={`text-sm sm:text-base font-bold tracking-wider font-tech uppercase flex items-center gap-1.5 ${isLight ? "text-slate-900" : "text-white"}`}>
                BioAzúcar 4.0
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${isLight ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"}`}>
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
                  className={`mt-0.5 text-[11px] sm:text-xs flex items-center gap-1.5 font-mono px-2 py-0.5 rounded-lg transition border shadow-xs ${
                    isLight
                      ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                      : "bg-slate-950/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/70 shadow-inner"
                  }`}
                  title="Cambiar de Ingenio / Empresa o Crear Nuevo"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: activeTenant.themeColor || "#059669" }}
                  ></span>
                  <span className={`${isLight ? "text-cyan-800 font-extrabold" : "text-cyan-300 font-bold"} max-w-[150px] sm:max-w-[220px] truncate`}>
                    {activeTenant.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isTenantMenuOpen ? "rotate-180 text-cyan-600" : isLight ? "text-slate-600" : "text-slate-400"}`} />
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
                  <div className={`absolute left-0 top-full mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl z-[70] p-3 font-mono text-xs animate-in zoom-in-95 duration-150 backdrop-blur-xl border ${
                    isLight
                      ? "bg-white border-slate-200 shadow-slate-400/20 text-slate-900"
                      : "bg-slate-900 border-slate-700/90 text-slate-200"
                  }`}>
                    <div className={`px-1 py-1 text-[10px] uppercase tracking-wider font-bold border-b flex items-center justify-between ${
                      isLight ? "border-slate-200 text-slate-600" : "border-slate-800 text-slate-400"
                    }`}>
                      <span className={`flex items-center gap-1.5 ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                        <Building2 className={`w-3.5 h-3.5 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />
                        Directorio de Ingenios
                      </span>
                      <span className={`${isLight ? "text-cyan-700" : "text-cyan-400"} font-bold`}>{tenants.length} Activos</span>
                    </div>

                    {/* Quick Search if more than 2 tenants */}
                    {tenants.length > 2 && (
                      <div className="my-2">
                        <input
                          type="text"
                          placeholder="Buscar central o código..."
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          className={`w-full rounded-lg px-2.5 py-1.5 text-[11px] focus:outline-none ${
                            isLight
                              ? "bg-slate-50 border border-slate-300 text-slate-900 focus:border-cyan-600 placeholder-slate-400"
                              : "bg-slate-950 border border-slate-800 text-slate-200 focus:border-cyan-500"
                          }`}
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
                                ? isLight
                                  ? "bg-cyan-50 text-cyan-950 border-2 border-cyan-600 shadow-xs font-bold"
                                  : "bg-cyan-950/70 text-cyan-200 border-cyan-500/50 shadow-md shadow-cyan-950/40"
                                : isLight
                                ? "hover:bg-slate-100 text-slate-700 hover:text-slate-950 border-slate-200"
                                : "hover:bg-slate-800/90 text-slate-300 border-slate-800/60"
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: t.themeColor || "#059669" }}
                                />
                                <span className={`truncate text-[12px] ${isLight ? "text-slate-900 font-bold" : "text-slate-200 font-bold"}`}>{t.name}</span>
                              </div>
                              <span className={`text-[10px] block mt-0.5 ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>
                                {t.code} • {t.nominalTch} TCH • {t.powerCapacityMW} MW • {t.location || t.country}
                              </span>
                            </div>
                            {isSel ? (
                              <Check className={`w-4 h-4 shrink-0 ${isLight ? "text-cyan-700" : "text-cyan-400"}`} />
                            ) : (
                              <span className={`text-[10px] ${isLight ? "text-slate-500 hover:text-slate-800" : "text-slate-500 group-hover:text-slate-300"}`}>Conmutar</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Superadmin Actions: Create with AI Wizard & Directory */}
                    {isSuper && (
                      <div className={`pt-2 mt-2 border-t space-y-1.5 ${isLight ? "border-slate-200" : "border-slate-800"}`}>
                        {onOpenCreateTenantWizard && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsTenantMenuOpen(false);
                              onOpenCreateTenantWizard();
                            }}
                            className={`w-full text-left p-2 rounded-xl text-[11px] font-bold flex items-center justify-between transition shadow-md ${
                              isLight
                                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-950 border border-emerald-300"
                                : "text-emerald-300 hover:text-emerald-200 bg-gradient-to-r from-emerald-950/70 to-teal-950/70 hover:from-emerald-900/70 hover:to-teal-900/70 border border-emerald-500/40 shadow-emerald-950/30"
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className={`p-1 rounded-lg ${isLight ? "bg-emerald-200 text-emerald-900" : "bg-emerald-500/20 text-emerald-400"}`}>✨</span>
                              Crear Nuevo Central con Asistente IA
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isLight ? "bg-emerald-200 text-emerald-900 font-bold" : "bg-emerald-500/30 text-emerald-200"}`}>
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
                            className={`w-full text-center py-1.5 text-[11px] font-bold rounded-xl border transition ${
                              isLight
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-slate-950 border-slate-300"
                                : "text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700/90 border-slate-700"
                            }`}
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
              <p className={`text-[11px] sm:text-xs flex items-center gap-1.5 font-mono truncate ${isLight ? "text-slate-600" : "text-slate-400"}`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0"></span>
                Zafra 2026-2027 • Central Azucarero
              </p>
            )}
          </div>
        </div>

        {/* Center: Live Simulation Controls & Scenario Injector */}
        <div className={`flex items-center flex-wrap gap-1.5 sm:gap-2 p-1 rounded-lg border ${
          isLight ? "bg-slate-100 border-slate-300" : "bg-slate-950/80 border-slate-800/80"
        }`}>
          {/* Data Source & Provenance Badge (SIMULATION vs REAL OT) */}
          {onOpenIndustrialConnectionModal && (
            <button
              onClick={onOpenIndustrialConnectionModal}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold font-mono transition border ${
                runtimeMode === "SIMULATION"
                  ? isLight
                    ? "bg-amber-100 text-amber-900 border-amber-400 font-bold hover:bg-amber-200"
                    : "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25"
                  : runtimeMode === "HYBRID"
                  ? isLight
                    ? "bg-cyan-100 text-cyan-900 border-cyan-400 font-bold hover:bg-cyan-200"
                    : "bg-cyan-500/15 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/25"
                  : telemetry?.quality !== "BAD" && !telemetry?.isSimulated
                  ? isLight
                    ? "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold hover:bg-emerald-200"
                    : "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                  : isLight
                  ? "bg-rose-100 text-rose-900 border-rose-400 font-bold hover:bg-rose-200"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25"
              }`}
              title="Origen de datos del central. Clic para conmutar entre Simulación y Pasarela Real OT."
            >
              {runtimeMode === "SIMULATION" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-amber-700" : "text-amber-400"}`} />
                  <span>SIMULADO</span>
                  <span className="hidden xl:inline text-[10px] opacity-80 font-normal">
                    (Hugot/ASME)
                  </span>
                </>
              ) : runtimeMode === "HYBRID" ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0" />
                  <Layers className={`w-3.5 h-3.5 ${isLight ? "text-cyan-700" : "text-cyan-400"}`} />
                  <span>HÍBRIDO</span>
                  <span className="hidden xl:inline text-[10px] opacity-80 font-normal">
                    (OT + Twin)
                  </span>
                </>
              ) : telemetry?.quality !== "BAD" && !telemetry?.isSimulated ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <Wifi className={`w-3.5 h-3.5 ${isLight ? "text-emerald-700" : "text-emerald-400"}`} />
                  <span>REAL OT</span>
                  <span className="hidden xl:inline text-[10px] opacity-80 font-normal">
                    (Conectado)
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <WifiOff className={`w-3.5 h-3.5 ${isLight ? "text-rose-700" : "text-rose-400"}`} />
                  <span>OT DESCONECTADO</span>
                  <span className="hidden xl:inline text-[10px] opacity-80 font-normal">
                    (Sin datos falsos)
                  </span>
                </>
              )}
            </button>
          )}

          {/* Play/Pause */}
          <button
            onClick={onToggleSim}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition border ${
              isSimRunning
                ? isLight
                  ? "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-400 font-bold"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30"
                : isLight
                ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-400 font-bold"
                : "bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
            }`}
            title={isSimRunning ? "Pausar simulación PLC" : "Reanudar simulación PLC"}
          >
            {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimRunning ? "PLC LIVE" : "PAUSADO"}</span>
          </button>

          {/* Speed selector */}
          <div className={`flex items-center rounded border p-0.5 ${
            isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-800"
          }`}>
            {[1, 2, 5].map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-1.5 py-0.5 text-[11px] font-mono rounded transition ${
                  speedMultiplier === speed
                    ? isLight
                      ? "bg-emerald-600 text-white font-bold shadow-xs"
                      : "bg-slate-700 text-emerald-400 font-bold"
                    : isLight
                    ? "text-slate-600 hover:text-slate-950 hover:bg-slate-100"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Scenario selector */}
          <div className={`flex items-center gap-1 pl-1 border-l ${isLight ? "border-slate-300" : "border-slate-800"}`}>
            <Sliders className={`w-3.5 h-3.5 hidden sm:inline ${isLight ? "text-slate-600" : "text-slate-400"}`} />
            <select
              value={scenario}
              onChange={(e) => onScenarioChange(e.target.value as SimulationScenario)}
              className={`text-xs rounded px-2 py-1 border focus:outline-none cursor-pointer font-mono max-w-[170px] sm:max-w-none truncate ${
                isLight
                  ? "bg-white text-slate-900 border-slate-300 focus:border-emerald-600 font-medium"
                  : "bg-slate-900 text-slate-200 border-slate-700/80 focus:border-emerald-500"
              }`}
            >
              <option value="NORMAL">Modo Normal ({activeTenant?.nominalTch || 450} TCH / {activeTenant?.powerCapacityMW || 32} MW)</option>
              <option value="VIBRACION_MOLINO3">⚠️ Anomalía: Vibración Molino 3 (4.8 mm/s)</option>
              <option value="CAIDA_PRESION_CALDERA">🔥 Anomalía: Caída Presión Caldera 1</option>
              <option value="ALTO_BRIX_JUGOS">💧 Anomalía: Alto Brix Meladura (72 °Bx)</option>
              <option value="SOBRECARGA_RED_MW">⚡ Evento: Sobrecarga en Red (+24 MW)</option>
            </select>
          </div>
        </div>

        {/* Right: Theme Toggle, Alarms, Multi-Tenant, Config, RBAC & User Profile */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Toggle (Dark / Light) */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-mono transition ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800 shadow-xs"
                  : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-slate-300"
              }`}
              title={theme === "dark" ? "Cambiar a Tema Claro (Control Room Diurno)" : "Cambiar a Tema Oscuro (Control Room Nocturno)"}
              aria-label="Alternar tema claro y oscuro"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xl:inline text-[11px] font-bold text-amber-300">Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden xl:inline text-[11px] font-bold text-indigo-700">Oscuro</span>
                </>
              )}
            </button>
          )}

          {/* Alarm indicator */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs transition ${
              criticalCount > 0
                ? isLight
                  ? "bg-rose-100 border-rose-400 text-rose-900 font-bold animate-pulse"
                  : "bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse"
                : unackCount > 0
                ? isLight
                  ? "bg-amber-100 border-amber-400 text-amber-900 font-bold"
                  : "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : isLight
                ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
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
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition shadow-xs border ${
                isLight
                  ? "bg-cyan-100/90 hover:bg-cyan-200/90 border-cyan-400 text-cyan-950 font-bold shadow-xs ring-1 ring-cyan-500/20"
                  : "bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold"
              }`}
              title="Abrir BioAzúcar Copilot AI (Asistente Industrial)"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isLight ? "text-cyan-800" : "text-cyan-400"} animate-pulse`} />
              <span className="hidden sm:inline font-bold">Copilot</span>
            </button>
          )}

          {/* Executive Presentation Deck Button */}
          {onOpenPresentation && (
            <button
              onClick={onOpenPresentation}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition shadow-xs border ${
                isLight
                  ? "bg-emerald-100/90 hover:bg-emerald-200/90 border-emerald-400 text-emerald-950 font-bold shadow-xs ring-1 ring-emerald-500/20"
                  : "bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold"
              }`}
              title="Abrir Presentación Ejecutiva / Pitch Deck 4.0 para Inversionistas y Clientes"
            >
              <Presentation className={`w-3.5 h-3.5 ${isLight ? "text-emerald-800" : "text-emerald-400"}`} />
              <span className="hidden sm:inline font-bold">Deck 4.0</span>
            </button>
          )}

          {/* Superadmin Multi-Tenant Center Button */}
          {isSuper && onOpenTenantsModal && (
            <button
              onClick={onOpenTenantsModal}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition border ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900 font-bold shadow-xs"
                  : "bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 font-bold"
              }`}
              title="Gestión de Empresas & Multi-Tenant"
            >
              <Building2 className={`w-3.5 h-3.5 ${isLight ? "text-slate-800" : "text-cyan-400"}`} />
              <span className="hidden md:inline font-bold">Empresas</span>
            </button>
          )}

          {/* System Configuration Quick Action */}
          {onOpenConfigVerification && (
            <button
              onClick={onOpenConfigVerification}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition border ${
                isLight
                  ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-900 font-bold shadow-xs"
                  : "bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold"
              }`}
              title="Verificar y Gestionar Configuración del Sistema (CRUD)"
            >
              <Settings className={`w-3.5 h-3.5 ${isLight ? "text-emerald-800" : "text-emerald-400"}`} />
              <span className="hidden md:inline font-bold">Config</span>
            </button>
          )}

          {/* RBAC Security Center Button */}
          <button
            onClick={onOpenRbacModal}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono transition border ${
              isLight
                ? "bg-purple-100/90 hover:bg-purple-200/90 border-purple-400 text-purple-950 font-bold shadow-xs ring-1 ring-purple-500/20"
                : "bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-bold"
            }`}
            title="Matriz de Seguridad y Privilegios RBAC (IEC 62443)"
          >
            <Shield className={`w-3.5 h-3.5 ${isLight ? "text-purple-800" : "text-purple-400"}`} />
            <span className="hidden lg:inline font-bold">RBAC</span>
          </button>

          {/* User Profile & Auth Trigger */}
          <button
            onClick={onOpenAuthModal}
            className={`flex items-center gap-2 p-1 pl-2 rounded-xl border transition ${
              isSuper
                ? isLight
                  ? "bg-amber-50 hover:bg-amber-100 border-amber-300 ring-1 ring-amber-400/30 shadow-xs"
                  : "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 ring-1 ring-amber-400/20"
                : isLight
                ? "bg-slate-100 hover:bg-slate-200 border-slate-300 shadow-xs"
                : "bg-slate-950/90 hover:bg-slate-800 border-slate-800"
            }`}
            title="Gestión de Usuario, Autenticación y Credenciales"
          >
            <div className="flex flex-col text-right hidden xl:flex">
              <span className={`text-[11px] font-bold leading-tight truncate max-w-[130px] flex items-center justify-end gap-1 ${
                isLight ? "text-slate-900 font-bold" : "text-white"
              }`}>
                {isSuper && <Crown className={`w-3 h-3 ${isLight ? "text-amber-600" : "text-amber-400"} shrink-0`} />}
                {currentUser.name}
              </span>
              <span className={`text-[9px] uppercase font-mono ${isLight ? "text-slate-600 font-semibold" : "text-slate-400"}`}>{currentUser.role}</span>
            </div>

            <div className="relative">
              <img
                src={currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                alt={currentUser.name}
                className={`w-7 h-7 rounded-lg object-cover border ${isLight ? "border-slate-300" : "border-slate-700"}`}
              />
              <span className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border ${isLight ? "border-white" : "border-slate-950"} ${isSuper ? "bg-amber-400" : "bg-emerald-400"}`} />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};

