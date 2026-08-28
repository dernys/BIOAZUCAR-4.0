import React, { useState } from "react";
import {
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Filter,
  BarChart3,
  RefreshCw,
  Clock,
  ArrowUpRight
} from "lucide-react";
import { TelemetryData, UserRole } from "../types";

interface HistorianTrendsProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
}

export const HistorianTrends: React.FC<HistorianTrendsProps> = ({
  telemetry,
  currentRole,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>("TCH");
  const [timeRange, setTimeRange] = useState<"1H" | "8H" | "24H" | "7D">("8H");

  // Simulated Historian Data points for trends
  const trendTags = [
    { id: "TCH", name: "Toneladas de Caña por Hora (TCH)", unit: "t/h", current: telemetry.tch, color: "#10b981" },
    { id: "BAGASSE_PROD", name: "Generación de Bagazo", unit: "t/h", current: telemetry.bagasseProductionRate, color: "#f59e0b" },
    { id: "STEAM_HP", name: "Flujo Vapor Alta Presión", unit: "t/h", current: telemetry.steamFlowHP, color: "#06b6d4" },
    { id: "POWER_MW", name: "Potencia Generada Turbina", unit: "MW", current: telemetry.powerGeneratedMW, color: "#eab308" },
    { id: "POWER_EXPORT", name: "Excedente Exportado a Red", unit: "MW", current: telemetry.powerExportGridMW, color: "#34d399" },
    { id: "BRIX_SYRUP", name: "Concentración Meladura", unit: "°Bx", current: telemetry.evaporatorSyrupBrix, color: "#a855f7" },
  ];

  const activeTag = trendTags.find((t) => t.id === selectedTag) || trendTags[0];

  // 16 points data generation
  const points = [
    { time: "08:00", val: 420, baseline: 450 },
    { time: "09:00", val: 440, baseline: 450 },
    { time: "10:00", val: 462, baseline: 450 },
    { time: "11:00", val: 455, baseline: 450 },
    { time: "12:00", val: 430, baseline: 450 },
    { time: "13:00", val: 470, baseline: 450 },
    { time: "14:00", val: 458, baseline: 450 },
    { time: "15:00", val: 465, baseline: 450 },
    { time: "16:00", val: telemetry.tch, baseline: 450 },
  ];

  const handleExportCSV = () => {
    const csvContent =
      "data:text/csv;charset=utf-8,Fecha,Hora,Tag,Valor,Unidad,Estado\n" +
      points.map((p) => `2026-08-28,${p.time},${activeTag.id},${p.val},${activeTag.unit},GOOD`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BioAzucar_${activeTag.id}_Historico.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Historiador de Datos Industriales (Process Historian & Analytics)
          </h2>
          <p className="text-xs text-slate-400">
            Registro continuo de series temporales, correlación termodinámica y exportación para auditorías
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            {(["1H", "8H", "24H", "7D"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-2.5 py-1 rounded transition ${
                  timeRange === range
                    ? "bg-emerald-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Export CSV button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Tag Selector (4 cols) + Chart Visualizer (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tag Selector List */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
          <span className="text-xs font-bold text-white uppercase tracking-wider block mb-3">
            Variables de Proceso Disponibles
          </span>

          <div className="space-y-2">
            {trendTags.map((tag) => {
              const isSelected = selectedTag === tag.id;
              return (
                <div
                  key={tag.id}
                  onClick={() => setSelectedTag(tag.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-800/90 border-emerald-500/60 shadow-md"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold text-slate-200 block">{tag.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{tag.id}</span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-sm font-bold text-white block">
                      {tag.current} <span className="text-xs text-slate-400 font-normal">{tag.unit}</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-semibold">Calidad: Buena</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Trend Chart Panel */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                  Gráfica de Tendencia Temporal • Rango {timeRange}
                </span>
                <h3 className="text-base font-bold text-white font-tech">{activeTag.name}</h3>
              </div>
              <div className="text-right font-mono">
                <span className="text-xs text-slate-400 block">Último Valor:</span>
                <span className="text-lg font-bold text-white font-tech">
                  {activeTag.current} {activeTag.unit}
                </span>
              </div>
            </div>

            {/* Custom SVG Trend Line Graph */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="h-56 relative w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2">
                {/* SVG Polyline */}
                <svg className="absolute inset-0 w-full h-full p-6 overflow-visible pointer-events-none">
                  <polyline
                    fill="none"
                    stroke={activeTag.color}
                    strokeWidth="3"
                    points="20,120 70,90 130,40 190,55 250,110 310,25 370,50 430,35 490,45"
                  />
                  {/* Dots */}
                  {[
                    [20, 120],
                    [70, 90],
                    [130, 40],
                    [190, 55],
                    [250, 110],
                    [310, 25],
                    [370, 50],
                    [430, 35],
                    [490, 45],
                  ].map(([cx, cy], i) => (
                    <circle key={i} cx={cx} cy={cy} r="4" fill={activeTag.color} />
                  ))}
                </svg>

                {/* X Axis Labels */}
                {points.map((p, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center justify-end z-10">
                    <span className="text-[10px] font-mono text-slate-400 mt-2">{p.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statistical summary bar */}
            <div className="grid grid-cols-4 gap-3 mt-4 text-xs font-mono bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px] block">Mínimo Registrado:</span>
                <span className="text-slate-200 font-bold">420.0 {activeTag.unit}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Promedio de Turno:</span>
                <span className="text-emerald-400 font-bold">454.8 {activeTag.unit}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Máximo Registrado:</span>
                <span className="text-cyan-400 font-bold">472.1 {activeTag.unit}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] block">Desviación Estándar:</span>
                <span className="text-slate-300 font-bold">± 11.4</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
