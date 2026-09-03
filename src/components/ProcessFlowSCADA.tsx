import React, { useState } from "react";
import {
  Wheat,
  Flame,
  Zap,
  Droplets,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Settings,
  X,
  Gauge,
  Cpu,
  Power,
  RotateCw,
  Info
} from "lucide-react";
import { TelemetryData, UserRole, EquipmentItem } from "../types";

interface ProcessFlowSCADAProps {
  telemetry: TelemetryData;
  equipmentList: EquipmentItem[];
  currentRole: UserRole;
}

export const ProcessFlowSCADA: React.FC<ProcessFlowSCADAProps> = ({
  telemetry,
  equipmentList = [],
  currentRole,
}) => {
  const safeEquipmentList = Array.isArray(equipmentList) ? equipmentList : [];
  const [selectedNode, setSelectedNode] = useState<string | null>("eq-molino-3");
  const [controlMode, setControlMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualSetpoint, setManualSetpoint] = useState<number>(450);

  const selectedEquipment =
    safeEquipmentList.find((e) => e.id === selectedNode) ||
    safeEquipmentList[0] ||
    ({} as EquipmentItem);

  return (
    <div className="space-y-4">
      {/* SCADA Header / Control bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            Sinóptico de Proceso Industrial SCADA & DCS
          </h2>
          <p className="text-xs text-slate-400">
            Diagrama mímico interactivo con tuberías dinámicas, flujos de masa y telemetría ISA-5.1
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Scan: 250ms (OPC-UA Good)
          </span>
          <span className="text-slate-400">
            Haz clic en cualquier nodo para abrir su <strong className="text-white">Faceplate</strong>
          </span>
        </div>
      </div>

      {/* Main Interactive SCADA Mimic Canvas */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto relative min-h-[580px] bg-industrial-grid">
        {/* SVG Pipeline Layer */}
        <svg className="w-[1100px] h-[520px] absolute top-4 left-4 pointer-events-none">
          <defs>
            <linearGradient id="juiceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="bagasseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="steamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
            <linearGradient id="powerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
            </linearGradient>
          </defs>

          {/* Line 1: Cane to Mills */}
          <path
            d="M 120 100 L 230 100"
            stroke="#10b981"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />

          {/* Line 2: Mills to Juice Clarification */}
          <path
            d="M 330 100 L 440 100"
            stroke="#10b981"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />

          {/* Line 3: Clarification to Evaporation */}
          <path
            d="M 540 100 L 650 100"
            stroke="#10b981"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />

          {/* Line 4: Evaporation to Crystallization */}
          <path
            d="M 750 100 L 860 100"
            stroke="#10b981"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />

          {/* Line 5: Crystallization to Bagging */}
          <path
            d="M 960 100 L 1040 100"
            stroke="#10b981"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />

          {/* Line 6: Bagasse from Mills down to Biomass Boiler */}
          <path
            d="M 280 135 L 280 320 L 380 320"
            stroke="#f59e0b"
            strokeWidth="5"
            fill="none"
            className="pipe-flow-fast"
          />

          {/* Line 7: Steam HP from Boiler to Turbo-Generator */}
          <path
            d="M 480 320 L 640 320"
            stroke="#06b6d4"
            strokeWidth="6"
            fill="none"
            className="pipe-flow-steam"
          />

          {/* Line 8: Exhaust Steam (LP) from Turbo back up to Evaporators */}
          <path
            d="M 690 280 L 690 140"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeDasharray="4 4"
            fill="none"
          />

          {/* Line 9: Power from Turbo-Gen to Substation & Grid */}
          <path
            d="M 750 320 L 900 320"
            stroke="#eab308"
            strokeWidth="4"
            fill="none"
            className="pipe-flow"
          />
        </svg>

        {/* Process Stages Grid */}
        <div className="w-[1100px] h-[520px] relative">
          {/* STREAM 1: SUGAR PRODUCTION (TOP ROW) */}
          
          {/* Node 1: Recepción & Báscula */}
          <div
            onClick={() => setSelectedNode("eq-molino-1")}
            className={`absolute top-[40px] left-[20px] w-[110px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-molino-1"
                ? "border-emerald-400 ring-2 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Wheat className="w-4 h-4 text-emerald-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-[11px] font-bold text-white block">Recepción</span>
            <span className="text-[9px] text-slate-400 font-mono">Básculas & Core</span>
            <div className="mt-2 text-[10px] font-mono text-emerald-300 font-bold">
              {telemetry.tch} TCH
            </div>
          </div>

          {/* Node 2: Tándem de Molinos (5 Molinos) */}
          <div
            onClick={() => setSelectedNode("eq-molino-3")}
            className={`absolute top-[35px] left-[225px] w-[125px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-molino-3"
                ? "border-amber-400 ring-2 ring-amber-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <RotateCw className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: "6s" }} />
              <span className="text-[9px] font-mono bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded">
                MOL-03
              </span>
            </div>
            <span className="text-[11px] font-bold text-white block">Tándem 5M</span>
            <span className="text-[9px] text-slate-400 font-mono">Extracción: {telemetry.millingExtraction}%</span>
            <div className="mt-2 text-[10px] font-mono text-amber-300">
              Vib: 4.8 mm/s ⚠️
            </div>
          </div>

          {/* Node 3: Clarificación & Encalado */}
          <div
            onClick={() => setSelectedNode("eq-clarificador")}
            className={`absolute top-[40px] left-[435px] w-[120px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-clarificador"
                ? "border-emerald-400 ring-2 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Droplets className="w-4 h-4 text-emerald-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-[11px] font-bold text-white block">Clarificación</span>
            <span className="text-[9px] text-slate-400 font-mono">SRI Rápido</span>
            <div className="mt-2 text-[10px] font-mono text-emerald-300">
              {telemetry.clarifiedJuiceFlow} m³/h
            </div>
          </div>

          {/* Node 4: Evaporadores Cuádruple */}
          <div
            onClick={() => setSelectedNode("eq-evaporadores")}
            className={`absolute top-[35px] left-[640px] w-[130px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-evaporadores"
                ? "border-cyan-400 ring-2 ring-cyan-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Flame className="w-4 h-4 text-cyan-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-[11px] font-bold text-white block">Evaporación 4-E</span>
            <span className="text-[9px] text-slate-400 font-mono">Meladura concentrada</span>
            <div className="mt-2 text-[10px] font-mono text-cyan-300 font-bold">
              {telemetry.evaporatorSyrupBrix} °Bx
            </div>
          </div>

          {/* Node 5: Cristalización & Centrífugas */}
          <div
            onClick={() => setSelectedNode("eq-tachos")}
            className={`absolute top-[35px] left-[850px] w-[130px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-tachos"
                ? "border-emerald-400 ring-2 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-[11px] font-bold text-white block">Tachos & Centrífugas</span>
            <span className="text-[9px] text-slate-400 font-mono">Masa Cocida A/B</span>
            <div className="mt-2 text-[10px] font-mono text-emerald-300">
              Vacío: 25.4" Hg
            </div>
          </div>

          {/* Node 6: Ensacado de Azúcar */}
          <div
            onClick={() => setSelectedNode("eq-secador-ensacado")}
            className={`absolute top-[40px] left-[1020px] w-[115px] p-3 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-secador-ensacado"
                ? "border-emerald-400 ring-2 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-[11px] font-bold text-white block">Ensacado</span>
            <span className="text-[9px] text-slate-400 font-mono">Sacos 50kg</span>
            <div className="mt-2 text-[10px] font-mono text-emerald-300 font-bold">
              {(telemetry.sugarBagsToday ?? 0).toLocaleString()}
            </div>
          </div>

          {/* STREAM 2: COGENERATION & BIOMASS POWER (BOTTOM ROW) */}
          
          {/* Node 7: Caldera de Biomasa (Bagazo) */}
          <div
            onClick={() => setSelectedNode("eq-caldera-1")}
            className={`absolute top-[265px] left-[370px] w-[140px] p-3.5 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-caldera-1"
                ? "border-cyan-400 ring-2 ring-cyan-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="text-[9px] font-mono bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded">
                CAL-01
              </span>
            </div>
            <span className="text-xs font-bold text-white block">Caldera Biomasa</span>
            <span className="text-[9px] text-slate-400 font-mono">Bagazo: {telemetry.bagasseBoilerConsumption} t/h</span>
            <div className="mt-2 text-[11px] font-mono text-cyan-300 font-bold">
              {telemetry.boilerPressureHP} bar • {telemetry.steamFlowHP} t/h
            </div>
          </div>

          {/* Node 8: Turbogenerador 35 MVA */}
          <div
            onClick={() => setSelectedNode("eq-turbina-1")}
            className={`absolute top-[265px] left-[630px] w-[145px] p-3.5 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-turbina-1"
                ? "border-yellow-400 ring-2 ring-yellow-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
              <span className="text-[9px] font-mono bg-yellow-500/20 text-yellow-300 px-1 py-0.2 rounded">
                TG-01
              </span>
            </div>
            <span className="text-xs font-bold text-white block">Turbogenerador</span>
            <span className="text-[9px] text-slate-400 font-mono">Woodward 505D</span>
            <div className="mt-2 text-[11px] font-mono text-yellow-300 font-bold">
              {telemetry.powerGeneratedMW} MW • {telemetry.gridFrequencyHz} Hz
            </div>
          </div>

          {/* Node 9: Subestación Eléctrica 138kV */}
          <div
            onClick={() => setSelectedNode("eq-turbina-1")}
            className={`absolute top-[265px] left-[890px] w-[140px] p-3.5 rounded-xl border bg-slate-900/90 cursor-pointer transition transform hover:scale-105 ${
              selectedNode === "eq-turbina-1"
                ? "border-emerald-400 ring-2 ring-emerald-500/30"
                : "border-slate-800 hover:border-slate-700"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <Power className="w-5 h-5 text-emerald-400" />
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            </div>
            <span className="text-xs font-bold text-white block">Subestación 138kV</span>
            <span className="text-[9px] text-slate-400 font-mono">Despacho a Red</span>
            <div className="mt-2 text-[11px] font-mono text-emerald-300 font-bold">
              +{telemetry.powerExportGridMW} MW Exportados
            </div>
          </div>
        </div>
      </div>

      {/* Faceplate Inspection Modal / Bottom Panel for Selected Equipment */}
      {selectedEquipment && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  selectedEquipment.status === "WARNING"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : selectedEquipment.status === "CRITICAL"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                }`}
              >
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white font-tech">
                    Faceplate: {selectedEquipment.name}
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {selectedEquipment.code}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      selectedEquipment.status === "WARNING"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    }`}
                  >
                    {selectedEquipment.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tag PLC: <span className="text-cyan-400 font-mono">{selectedEquipment.plcTag}</span> • Nodo OPC-UA:{" "}
                  <span className="text-slate-300 font-mono">{selectedEquipment.opcUaNode}</span>
                </p>
              </div>
            </div>

            {/* Operator Controls (Role Aware) */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
                <button
                  onClick={() => setControlMode("AUTO")}
                  className={`px-2.5 py-1 rounded transition ${
                    controlMode === "AUTO"
                      ? "bg-emerald-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  AUTO
                </button>
                <button
                  onClick={() => {
                    if (currentRole === "administrador" || currentRole === "supervisor" || currentRole === "operador") {
                      setControlMode("MANUAL");
                    } else {
                      alert("Permiso denegado: El rol Mantenimiento no tiene mando de control en DCS.");
                    }
                  }}
                  className={`px-2.5 py-1 rounded transition ${
                    controlMode === "MANUAL"
                      ? "bg-amber-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  MANUAL
                </button>
              </div>
            </div>
          </div>

          {/* Telemetry KPIs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Health Index</span>
              <span className="text-lg font-bold font-tech text-emerald-400">
                {selectedEquipment.healthIndex}%
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Vibración RMS</span>
              <span
                className={`text-lg font-bold font-tech ${
                  selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold
                    ? "text-amber-400"
                    : "text-white"
                }`}
              >
                {selectedEquipment.vibrationRMS} <span className="text-xs font-normal text-slate-400">mm/s</span>
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Temperatura Cojinete</span>
              <span className="text-lg font-bold font-tech text-white">
                {selectedEquipment.temperatureC} <span className="text-xs font-normal text-slate-400">°C</span>
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Carga de Motor</span>
              <span className="text-lg font-bold font-tech text-cyan-400">
                {selectedEquipment.loadPercentage}%
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Horas Operación</span>
              <span className="text-lg font-bold font-tech text-slate-200">
                {selectedEquipment.hoursRun} h
              </span>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Criticidad</span>
              <span className="text-xs font-mono font-bold text-amber-300 block mt-1">
                {selectedEquipment.criticality}
              </span>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-xs text-slate-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">Descripción Funcional:</strong> {selectedEquipment.description}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
