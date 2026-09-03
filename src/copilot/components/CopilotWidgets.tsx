import React from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Layers,
  ArrowRight,
  Activity,
  Cpu,
  Clock,
  ExternalLink,
  Zap,
} from "lucide-react";
import {
  CopilotWidget,
  KpiWidget,
  ChartWidget,
  TableWidget,
  AlarmWidget,
  EquipmentWidget,
  DataLineageWidget,
  StatisticsWidget,
} from "../domain/CopilotTypes";
import { DataQuality, DataSourceType } from "../../types";

interface WidgetProps {
  widget: CopilotWidget;
  onOpenLineage?: (kpiId: string) => void;
  onOpenEquipment?: (equipmentId: string) => void;
  onRequestAcknowledge?: (alarmId: string) => void;
}

export const CopilotWidgetsRenderer: React.FC<WidgetProps> = ({
  widget,
  onOpenLineage,
  onOpenEquipment,
  onRequestAcknowledge,
}) => {
  switch (widget.type) {
    case "KPI":
      return <RenderKpiWidget kpi={widget} onOpenLineage={onOpenLineage} />;
    case "CHART":
      return <RenderChartWidget chart={widget} />;
    case "TABLE":
      return <RenderTableWidget table={widget} />;
    case "ALARM":
      return <RenderAlarmWidget alarm={widget} onRequestAcknowledge={onRequestAcknowledge} />;
    case "EQUIPMENT":
      return <RenderEquipmentWidget eq={widget} onOpenEquipment={onOpenEquipment} />;
    case "DATA_LINEAGE":
      return <RenderLineageWidget lineage={widget} />;
    case "STATISTICS":
      return <RenderStatsWidget stats={widget} />;
    default:
      return null;
  }
};

// ============================================================================
// 1. KPI WIDGET
// ============================================================================
const RenderKpiWidget: React.FC<{ kpi: KpiWidget; onOpenLineage?: (id: string) => void }> = ({
  kpi,
  onOpenLineage,
}) => {
  const isGoodQuality = kpi.quality === "GOOD";
  const isSimulated = kpi.quality === "SIMULATED";

  return (
    <div className="my-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-slate-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          {kpi.category} • {kpi.name}
        </span>
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
            isGoodQuality
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : isSimulated
              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
          }`}
        >
          {isGoodQuality && <CheckCircle2 className="w-2.5 h-2.5" />}
          {isSimulated && <Sparkles className="w-2.5 h-2.5" />}
          {kpi.quality}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {typeof kpi.value === "number" ? kpi.value.toLocaleString() : kpi.value}
          </span>
          <span className="text-xs font-mono text-slate-400">{kpi.unit}</span>
        </div>

        {kpi.target !== undefined && (
          <div className="text-right text-xs font-mono">
            <span className="text-slate-400">Meta: {kpi.target} {kpi.unit}</span>
            {kpi.deviation !== undefined && (
              <span
                className={`ml-2 font-bold ${
                  kpi.deviation >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {kpi.deviation >= 0 ? `+${kpi.deviation}` : kpi.deviation}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <span className="truncate max-w-[200px]" title={kpi.formula}>
          $ {kpi.formula}
        </span>
        {kpi.canViewLineage && (
          <button
            onClick={() => onOpenLineage?.(kpi.kpiId)}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2"
          >
            <Layers className="w-3 h-3" />
            <span>Linaje</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. CHART WIDGET
// ============================================================================
const RenderChartWidget: React.FC<{ chart: ChartWidget }> = ({ chart }) => {
  const points = chart.data || [];
  if (points.length === 0) return null;

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values) * 0.95;
  const maxVal = Math.max(...values) * 1.05;
  const range = maxVal - minVal || 1;

  const width = 340;
  const height = 110;
  const padX = 25;
  const padY = 15;

  const coords = points.map((p, i) => {
    const x = padX + (i / (points.length - 1 || 1)) * (width - padX * 2);
    const y = height - padY - ((p.value - minVal) / range) * (height - padY * 2);
    return { x, y, ...p };
  });

  const pathD = coords.reduce(
    (acc, curr, i) => (i === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    ""
  );

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`;

  return (
    <div className="my-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-slate-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">{chart.title}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
          {chart.period}
        </span>
      </div>

      {/* SVG Canvas Line Chart */}
      <div className="w-full overflow-hidden flex justify-center py-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[380px] h-28 overflow-visible">
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padX} y1={padY} x2={width - padX} y2={padY} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
          <line x1={padX} y1={height / 2} x2={width - padX} y2={height / 2} stroke="#334155" strokeDasharray="3 3" strokeWidth="0.8" />
          <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="#334155" strokeWidth="1" />

          {/* Area under curve */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Trend Line */}
          <path d={pathD} fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {coords.map((c, idx) => (
            <g key={idx}>
              <circle cx={c.x} cy={c.y} r="3" fill="#0891b2" stroke="#e0f2fe" strokeWidth="1.5" />
              <text x={c.x} y={height - 2} fontSize="8" fill="#94a3b8" textAnchor="middle" fontFamily="monospace">
                {c.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800">
        <span>Fuente: {chart.source}</span>
        <span>
          Último: <strong className="text-cyan-300">{values[values.length - 1]} {chart.unit}</strong>
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// 3. TABLE WIDGET
// ============================================================================
const RenderTableWidget: React.FC<{ table: TableWidget }> = ({ table }) => {
  return (
    <div className="my-2 p-3 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-slate-100 flex flex-col gap-2 overflow-x-auto">
      <div className="text-xs font-bold text-slate-200">{table.title}</div>
      <table className="w-full text-left text-xs font-mono">
        <thead>
          <tr className="border-b border-slate-800 text-[11px] text-slate-400">
            {table.columns.map((col) => (
              <th key={col.key} className={`pb-1.5 px-2 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {table.rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-800/40 transition">
              {table.columns.map((col) => {
                const val = row[col.key];
                return (
                  <td key={col.key} className={`py-1.5 px-2 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"}`}>
                    {col.format === "badge" ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                        {val}
                      </span>
                    ) : col.format === "percent" ? (
                      <span className="text-emerald-400 font-bold">{val}%</span>
                    ) : (
                      <span className="text-slate-200">{val}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// 4. ALARM WIDGET
// ============================================================================
const RenderAlarmWidget: React.FC<{
  alarm: AlarmWidget;
  onRequestAcknowledge?: (id: string) => void;
}> = ({ alarm, onRequestAcknowledge }) => {
  const isCrit = alarm.severity === "CRITICAL";

  return (
    <div
      className={`my-2 p-3.5 rounded-xl border shadow-md flex flex-col gap-2 ${
        isCrit
          ? "bg-rose-950/40 border-rose-800/60 text-rose-100"
          : "bg-amber-950/30 border-amber-800/50 text-amber-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className={`w-4 h-4 ${isCrit ? "text-rose-400 animate-pulse" : "text-amber-400"}`} />
          <span className="text-xs font-bold font-mono uppercase tracking-wider">
            {alarm.severity} • {alarm.equipmentName}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{alarm.timestamp}</span>
      </div>

      <p className="text-xs text-slate-200 leading-snug font-sans">{alarm.message}</p>

      <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-xs font-mono">
        <span>
          Valor: <strong className={isCrit ? "text-rose-300" : "text-amber-300"}>{alarm.currentValue} {alarm.unit}</strong> (Límite: {alarm.threshold} {alarm.unit})
        </span>

        {alarm.canAcknowledge && !alarm.acknowledged && (
          <button
            onClick={() => onRequestAcknowledge?.(alarm.alarmId)}
            className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold transition flex items-center gap-1"
          >
            <CheckCircle2 className="w-3 h-3" /> Reconocer (ACK)
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. EQUIPMENT WIDGET
// ============================================================================
const RenderEquipmentWidget: React.FC<{
  eq: EquipmentWidget;
  onOpenEquipment?: (id: string) => void;
}> = ({ eq, onOpenEquipment }) => {
  return (
    <div className="my-2 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md text-slate-100 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 font-mono">
            {eq.name} ({eq.code})
          </span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
          {eq.area}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
          <span className="text-slate-400 text-[10px] block">Índice Salud</span>
          <span className="text-base font-bold text-emerald-400">{eq.healthIndex}%</span>
        </div>
        <div className="p-2 rounded bg-slate-950/60 border border-slate-800/80">
          <span className="text-slate-400 text-[10px] block">Vibración RMS</span>
          <span className="text-base font-bold text-cyan-300">{eq.vibrationRMS || "2.4"} mm/s</span>
        </div>
      </div>

      <div className="flex justify-end pt-1 border-t border-slate-800">
        <button
          onClick={() => onOpenEquipment?.(eq.equipmentId)}
          className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
        >
          <span>Abrir Mantenimiento CMMS</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// 6. DATA LINEAGE WIDGET
// ============================================================================
const RenderLineageWidget: React.FC<{ lineage: DataLineageWidget }> = ({ lineage }) => {
  return (
    <div className="my-2 p-3.5 rounded-xl bg-slate-900/95 border border-cyan-800/40 shadow-lg text-slate-100 flex flex-col gap-2.5">
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-cyan-300 font-mono">
            Trazabilidad de Linaje: {lineage.kpiName}
          </span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {lineage.overallQuality}
        </span>
      </div>

      <div className="text-xs font-mono text-slate-300 bg-slate-950/80 p-2 rounded border border-slate-800">
        <span className="text-slate-500 block text-[10px]">FÓRMULA CANÓNICA:</span>
        <code className="text-cyan-400">{lineage.formula}</code>
      </div>

      <div className="space-y-1.5">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
          Tags de Entrada & Sensores Físicos ({lineage.inputTags.length}):
        </span>
        {lineage.inputTags.map((t, idx) => (
          <div
            key={idx}
            className="p-2 rounded bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
          >
            <div>
              <span className="text-slate-200 font-bold block">{t.tagName}</span>
              <span className="text-[10px] text-slate-400">
                {t.tag} • {t.equipmentName} • {t.protocol}
              </span>
            </div>
            <div className="text-right">
              <span className="text-cyan-300 font-bold block">
                {t.value} {t.unit}
              </span>
              <span className="text-[10px] text-slate-400">{t.source}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// 7. STATS WIDGET
// ============================================================================
const RenderStatsWidget: React.FC<{ stats: StatisticsWidget }> = ({ stats }) => {
  return (
    <div className="my-2 p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 flex flex-col gap-2">
      <div className="text-xs font-bold text-slate-200 font-mono">
        Estadísticas de {stats.metric} ({stats.period})
      </div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
        <div className="p-2 bg-slate-950 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Media</span>
          <span className="text-cyan-300 font-bold">{stats.mean}</span>
        </div>
        <div className="p-2 bg-slate-950 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Mín</span>
          <span className="text-slate-200 font-bold">{stats.min}</span>
        </div>
        <div className="p-2 bg-slate-950 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Máx</span>
          <span className="text-slate-200 font-bold">{stats.max}</span>
        </div>
        <div className="p-2 bg-slate-950 rounded border border-slate-800">
          <span className="text-[10px] text-slate-400 block">Desv. Est.</span>
          <span className="text-amber-300 font-bold">±{stats.stdDev}</span>
        </div>
      </div>
    </div>
  );
};
