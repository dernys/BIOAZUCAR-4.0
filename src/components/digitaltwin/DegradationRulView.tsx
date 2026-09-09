import React, { useState } from "react";
import {
  Wrench,
  AlertTriangle,
  Activity,
  Clock,
  CheckCircle2,
  TrendingDown,
  Layers,
  Flame,
  Zap,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";
import { EquipmentItem, TelemetryData } from "../../types";

interface DegradationRulViewProps {
  telemetry: TelemetryData;
  equipmentList?: EquipmentItem[];
  theme?: "dark" | "light";
}

interface DegradationAsset {
  id: string;
  name: string;
  code: string;
  category: "MOLIENDA" | "CALDERAS" | "TURBINA" | "EVAPORACION";
  wearMetric: string;
  currentWear: number;
  maxThreshold: number;
  unit: string;
  rulHours: number;
  rulDays: number;
  failureRisk: "BAJO" | "MODERADO" | "CRITICO";
  wearRatePerHour: number;
  nextIntervention: string;
  failureMode: string;
  historyPoints: number[]; // Progression of wear over last 6 zafra periods
}

export const DegradationRulView: React.FC<DegradationRulViewProps> = ({
  telemetry,
  equipmentList = [],
  theme = "dark",
}) => {
  const [selectedAssetId, setSelectedAssetId] = useState<string>("eq-molino-3");

  const assets: DegradationAsset[] = [
    {
      id: "eq-molino-3",
      name: "Molino 3 (Tándem de Molienda)",
      code: "ML-03",
      category: "MOLIENDA",
      wearMetric: "Desgaste de Rayado Maza Superior",
      currentWear: 18.4,
      maxThreshold: 25.0,
      unit: "mm",
      rulHours: 840,
      rulDays: 35,
      failureRisk: telemetry.mill3Vibration > 4.5 ? "CRITICO" : "MODERADO",
      wearRatePerHour: 0.0078,
      nextIntervention: "Rectificado y calafateo de ranuras en parada quincenal",
      failureMode: "Pérdida de agarre de bagazo, resbalamiento y vibración armónica 1X",
      historyPoints: [4.2, 8.1, 11.5, 14.2, 16.8, 18.4],
    },
    {
      id: "eq-caldera-1",
      name: "Caldera Biomasa 65 bar (ASME PTC 4)",
      code: "BOIL-01",
      category: "CALDERAS",
      wearMetric: "Factor Ensuciamiento Banco Convector (Rf)",
      currentWear: 0.0038,
      maxThreshold: 0.0055,
      unit: "m²·K/W",
      rulHours: 120,
      rulDays: 5,
      failureRisk: "MODERADO",
      wearRatePerHour: 0.000014,
      nextIntervention: "Ciclo de soplado de hollín con vapor de 15 bar",
      failureMode: "Aumento de temperatura de gases de chimenea y pérdida de rendimiento térmico",
      historyPoints: [0.0012, 0.0018, 0.0025, 0.0031, 0.0035, 0.0038],
    },
    {
      id: "eq-turbina-1",
      name: "Turbogenerador de Vapor 35 MVA",
      code: "TG-01",
      category: "TURBINA",
      wearMetric: "Holgura Radial Sellos Laberinto",
      currentWear: 0.42,
      maxThreshold: 0.65,
      unit: "mm",
      rulHours: 7200,
      rulDays: 300,
      failureRisk: "BAJO",
      wearRatePerHour: 0.00003,
      nextIntervention: "Inspección boroscópica en mantenimiento mayor inter-zafra",
      failureMode: "Fuga interna de vapor HP y degradación de rendimiento isentrópico",
      historyPoints: [0.22, 0.26, 0.31, 0.35, 0.39, 0.42],
    },
    {
      id: "eq-evaporadores",
      name: "Evaporador Cuádruple Efecto 1",
      code: "EV-01",
      category: "EVAPORACION",
      wearMetric: "Incrustación de Sales Cálcicas (Costra)",
      currentWear: 1.25,
      maxThreshold: 1.80,
      unit: "mm",
      rulHours: 144,
      rulDays: 6,
      failureRisk: "MODERADO",
      wearRatePerHour: 0.0038,
      nextIntervention: "Ebullición con solución cáustica al 10% y neutralización",
      failureMode: "Caída drástica del coeficiente global de transferencia térmica (U)",
      historyPoints: [0.2, 0.45, 0.72, 0.94, 1.12, 1.25],
    },
  ];

  const selectedAsset = assets.find((a) => a.id === selectedAssetId) || assets[0];
  const wearPercentage = Math.min(100, Math.round((selectedAsset.currentWear / selectedAsset.maxThreshold) * 100));

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-bold">
                PROGNOSTICS & HEALTH MANAGEMENT (PHM)
              </span>
              <span className="text-xs text-slate-400">
                Modelo de Vida Útil Remanente (RUL) y Degradación Mecánica
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-tech flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-400" />
              Gemelo de Degradación y Fatiga de Activos Industriales
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1">
              Anticipa fallas catastróficas mediante leyes de desgaste de Paris-Erdogan y distribuciones de Weibull,
              correlacionando horas de operación continuas, cargas mecánicas, temperatura y vibraciones armónicas.
            </p>
          </div>
        </div>

        {/* Asset Cards Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800">
          {assets.map((asset) => (
            <button
              key={asset.id}
              onClick={() => setSelectedAssetId(asset.id)}
              className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                selectedAssetId === asset.id
                  ? "bg-slate-800/90 border-purple-500/60 shadow-lg ring-1 ring-purple-500/30"
                  : "bg-slate-950/80 border-slate-800 hover:bg-slate-800/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-cyan-400">{asset.code}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      asset.failureRisk === "CRITICO"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                        : asset.failureRisk === "MODERADO"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    }`}
                  >
                    {asset.failureRisk}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white font-tech line-clamp-1">{asset.name}</h4>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-[9px] text-slate-500 block">RUL Estimado</span>
                  <span className="text-sm font-bold text-white">{asset.rulDays} días</span>
                </div>
                <span className="text-[10px] text-slate-400">({asset.rulHours} h)</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detailed Analysis of Selected Asset */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Wear Gauge & Diagnostics (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-bold text-cyan-400 block">{selectedAsset.code}</span>
              <h3 className="text-sm font-bold text-white font-tech">{selectedAsset.name}</h3>
            </div>
            <span className="text-[10px] text-slate-400 uppercase bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              {selectedAsset.category}
            </span>
          </div>

          {/* Wear Progression Gauge Bar */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] text-slate-400 font-bold">{selectedAsset.wearMetric}</span>
              <span className="text-base font-bold text-white">
                {selectedAsset.currentWear} / {selectedAsset.maxThreshold} {selectedAsset.unit}
              </span>
            </div>

            <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden flex border border-slate-800">
              <div
                className={`h-full transition-all duration-500 ${
                  wearPercentage > 80
                    ? "bg-rose-500"
                    : wearPercentage > 60
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${wearPercentage}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 pt-0.5">
              <span>0 (Nuevo / Rectificado)</span>
              <span>Límite Tolerancia: {selectedAsset.maxThreshold} {selectedAsset.unit}</span>
            </div>
          </div>

          {/* Key Prognostic Indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">RUL Operacional</span>
              <span className="text-lg font-bold text-emerald-400">{selectedAsset.rulHours} h</span>
              <span className="text-[9px] text-slate-500 block">~{selectedAsset.rulDays} días de molienda</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 block">Tasa de Desgaste</span>
              <span className="text-lg font-bold text-cyan-400">
                {selectedAsset.wearRatePerHour} {selectedAsset.unit}/h
              </span>
              <span className="text-[9px] text-slate-500 block">Por hora de servicio</span>
            </div>
          </div>

          {/* Failure Mode & Next Action */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Modo de Falla Probable:</span>
              <p className="text-slate-300 text-[11px] leading-relaxed mt-0.5">
                {selectedAsset.failureMode}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] text-emerald-400 uppercase block font-bold">
                Intervención Prescrita:
              </span>
              <p className="text-white text-[11px] font-bold mt-0.5">
                {selectedAsset.nextIntervention}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Degradation Trend Curve & History (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white font-tech uppercase flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              Curva de Degradación Acumulada vs Límite de Falla
            </h3>
            <span className="text-[10px] text-slate-400">Histórico de Campaña Zafra</span>
          </div>

          {/* Graphical Representation of Progression */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 block mb-2">
              Evolución de {selectedAsset.wearMetric} ({selectedAsset.unit}) en los últimos 6 períodos:
            </span>

            {/* Sparkline-like bars */}
            <div className="h-40 flex items-end justify-between gap-3 pt-4 px-2 border-b border-slate-800">
              {selectedAsset.historyPoints.map((val, idx) => {
                const heightPercent = Math.min(100, (val / selectedAsset.maxThreshold) * 100);
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                    <span className="text-[10px] text-slate-300 font-bold">{val}</span>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        idx === selectedAsset.historyPoints.length - 1
                          ? "bg-purple-500"
                          : "bg-slate-700 hover:bg-slate-600"
                      }`}
                      style={{ height: `${heightPercent}%` }}
                    />
                    <span className="text-[9px] text-slate-500 uppercase">Sem {idx + 1}</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-2.5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-slate-700 rounded-sm inline-block"></span>
                <span>Inspecciones pasadas</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-purple-500 rounded-sm inline-block"></span>
                <span>Lectura Actual</span>
              </div>
              <div className="flex items-center gap-2 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-500 inline-block"></span>
                <span>Límite Crítico: {selectedAsset.maxThreshold} {selectedAsset.unit}</span>
              </div>
            </div>
          </div>

          {/* Prescriptive Engineering Directive */}
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-start gap-3 text-slate-300 text-[11px] leading-relaxed">
            <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <strong>Dictamen de Ingeniería Predictiva:</strong> Con base en la tasa de degradación estimada de{" "}
              <span className="text-white font-bold">{selectedAsset.wearRatePerHour} {selectedAsset.unit}/h</span>,
              el activo alcanzará su límite de diseño dentro de{" "}
              <span className="text-amber-300 font-bold">{selectedAsset.rulDays} días</span>. Se ha reservado
              automáticamente la orden de trabajo en el módulo de Mantenimiento y se confirmó stock de repuestos en pañol.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
