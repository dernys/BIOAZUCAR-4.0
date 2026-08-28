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
  Clock
} from "lucide-react";
import { UserRole, PlantStatus, AlarmEvent, SimulationScenario } from "../types";

export interface HeaderProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
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
  onRoleChange,
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

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Brand & Plant Status */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-slate-950 shadow-lg shadow-emerald-500/20 font-bold">
            <Factory className="w-5 h-5 text-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-wider font-tech text-white uppercase flex items-center gap-1.5">
                BioAzúcar 4.0
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  MES / IIoT
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Zafra 2026-2027 • <span className="text-slate-300 font-medium">Central Azucarero & Cogeneración</span>
            </p>
          </div>
        </div>

        {/* Center: Live Simulation Controls & Scenario Injector */}
        <div className="flex items-center flex-wrap gap-2 bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/80">
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
              className="bg-slate-900 text-xs text-slate-200 rounded px-2 py-1 border border-slate-700/80 focus:outline-none focus:border-emerald-500 cursor-pointer font-mono"
            >
              <option value="NORMAL">Modo Normal (450 TCH / 32 MW)</option>
              <option value="VIBRACION_MOLINO3">⚠️ Anomalía: Vibración Molino 3 (4.8 mm/s)</option>
              <option value="CAIDA_PRESION_CALDERA">🔥 Anomalía: Caída Presión Caldera 1</option>
              <option value="ALTO_BRIX_JUGOS">💧 Anomalía: Alto Brix Meladura (72 °Bx)</option>
              <option value="SOBRECARGA_RED_MW">⚡ Evento: Sobrecarga en Red (+24 MW)</option>
            </select>
          </div>
        </div>

        {/* Right: Alarm Buzzer, Role Switcher, Clock */}
        <div className="flex items-center gap-3">
          {/* Alarm indicator */}
          <button
            onClick={toggleMute}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition ${
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

          {/* Role Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <div className="text-[11px]">
              <span className="text-slate-400 mr-1 hidden md:inline">Rol:</span>
              <select
                value={currentRole}
                onChange={(e) => onRoleChange(e.target.value as UserRole)}
                className="bg-transparent text-emerald-300 font-semibold focus:outline-none cursor-pointer uppercase text-xs"
              >
                <option value="administrador" className="bg-slate-900 text-white">
                  Administrador
                </option>
                <option value="supervisor" className="bg-slate-900 text-white">
                  Supervisor de Turno
                </option>
                <option value="operador" className="bg-slate-900 text-white">
                  Operador de Planta
                </option>
                <option value="mantenimiento" className="bg-slate-900 text-white">
                  Ing. Mantenimiento
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
