import React, { useState } from "react";
import {
  Activity,
  Clock,
  Fuel,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Info,
} from "lucide-react";
import {
  AgriculturalPlanVsRealSummary,
  AgriculturalPlanVsRealItem,
  AgriculturalCampaign,
  FieldPlot,
} from "../../types/agriculture";

interface AgriculturalPlanVsRealTabProps {
  theme?: "dark" | "light";
  summary: AgriculturalPlanVsRealSummary;
  campaign: AgriculturalCampaign;
  plots: FieldPlot[];
  onRefresh?: () => void;
}

export const AgriculturalPlanVsRealTab: React.FC<AgriculturalPlanVsRealTabProps> = ({
  theme = "dark",
  summary,
  campaign,
  onRefresh,
}) => {
  const isLight = theme === "light";
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<AgriculturalPlanVsRealItem | null>(null);

  const filteredItems = summary.items.filter((item) => {
    const matchStatus = filterStatus === "ALL" || item.status === filterStatus;
    const matchSearch =
      searchTerm.trim() === "" ||
      item.laborName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.laborCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  const exportReport = () => {
    const headers = "Código,Labor_Agrícola,Categoría,Plan_ha,Real_ha,Desvío_ha,Desvío_%,Plan_h,Real_h,Plan_Diesel_L,Real_Diesel_L,Plan_Cost_USD,Real_Cost_USD,Estatus,Causa\n";
    const rows = summary.items
      .map(
        (i) =>
          `"${i.laborCode}","${i.laborName}","${i.category}",${i.plannedAreaHa},${i.realAreaHa},${i.deviationAreaHa},${i.deviationAreaPercent},${i.plannedHours},${i.realHours},${i.plannedDieselLiters},${i.realDieselLiters},${i.plannedCostUSD},${i.realCostUSD},"${i.status}","${i.deviationCause || ""}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Plan_vs_Real_${campaign.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight">
              Control Operativo PLAN vs REAL de Labores Agrícolas
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                summary.overallStatus === "OPTIMO"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : summary.overallStatus === "ATENCION"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              ESTADO GLOBAL: {summary.overallStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Comparativa directa entre la línea base planificada del PDA y la ejecución física reportada en campo y telemetría.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Actualizar Telemetría</span>
            </button>
          )}
          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Informe CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Execution % */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Avance Global Superficie</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {summary.areaExecutionPercent.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500">
              ({summary.totalRealAreaHa.toLocaleString()} / {summary.totalPlannedAreaHa.toLocaleString()} ha)
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, summary.areaExecutionPercent)}%` }}
            />
          </div>
        </div>

        {/* Machine Hours */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Horas-Máquina</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              {summary.totalRealHours.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400">
              / {summary.totalPlannedHours.toLocaleString(undefined, { maximumFractionDigits: 0 })} h
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
            {summary.totalRealHours > summary.totalPlannedHours ? (
              <span className="text-amber-400 flex items-center font-mono">
                <TrendingUp className="w-3.5 h-3.5 mr-0.5" />
                +{(summary.totalRealHours - summary.totalPlannedHours).toFixed(0)} h de sobreuso
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center font-mono">
                <TrendingDown className="w-3.5 h-3.5 mr-0.5" />
                {(summary.totalRealHours - summary.totalPlannedHours).toFixed(0)} h vs plan
              </span>
            )}
          </div>
        </div>

        {/* Diesel Fuel */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Combustible Diésel</span>
            <Fuel className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-400">
              {summary.totalRealDieselLiters.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400">
              / {summary.totalPlannedDieselLiters.toLocaleString(undefined, { maximumFractionDigits: 0 })} L
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono">
            Ratio real: {(summary.totalRealDieselLiters / Math.max(1, summary.totalRealAreaHa)).toFixed(1)} L/ha
          </div>
        </div>

        {/* Cost USD */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Costo Total Labores</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              ${summary.totalRealCostUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-slate-400">
              / ${summary.totalPlannedCostUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-1 text-[11px] font-mono">
            {summary.totalRealCostUSD > summary.totalPlannedCostUSD ? (
              <span className="text-rose-400">Desvío: +${(summary.totalRealCostUSD - summary.totalPlannedCostUSD).toFixed(0)} USD</span>
            ) : (
              <span className="text-emerald-400">Ahorro: -${(summary.totalPlannedCostUSD - summary.totalRealCostUSD).toFixed(0)} USD</span>
            )}
          </div>
        </div>

        {/* Operational Status */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Labores en Monitoreo</span>
            <Calendar className="w-4 h-4 text-violet-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-slate-100">
              {summary.items.length}
            </span>
            <span className="text-xs text-slate-400">operaciones</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
            <span className="text-emerald-400">{summary.items.filter((i) => i.status === "OPTIMO").length} óptimas</span>
            <span>•</span>
            <span className="text-amber-400">{summary.items.filter((i) => i.status === "ATENCION").length} atención</span>
            <span>•</span>
            <span className="text-rose-400">{summary.items.filter((i) => i.status === "CRITICO").length} críticas</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex items-center gap-1">
            {["ALL", "OPTIMO", "ATENCION", "CRITICO"].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  filterStatus === st
                    ? "bg-emerald-600 text-white"
                    : isLight
                    ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {st === "ALL" ? "Todos los Estados" : st}
              </button>
            ))}
          </div>
        </div>

        <input
          type="text"
          placeholder="Buscar labor u operación agronómica..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={`w-full sm:w-72 px-3 py-1.5 text-xs rounded-lg border outline-hidden transition ${
            isLight
              ? "bg-white border-slate-300 text-slate-900 focus:border-emerald-500"
              : "bg-slate-900 border-slate-700 text-slate-100 focus:border-emerald-500"
          }`}
        />
      </div>

      {/* Main Comparative Table */}
      <div className={`rounded-xl border overflow-hidden ${isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className={`text-[11px] font-bold uppercase tracking-wider border-b ${
              isLight ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-slate-950/80 text-slate-400 border-slate-800"
            }`}>
              <tr>
                <th className="py-3 px-4">Labor Agrícola</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3 text-right">Plan (ha)</th>
                <th className="py-3 px-3 text-right">Real (ha)</th>
                <th className="py-3 px-3 text-center">Avance (%)</th>
                <th className="py-3 px-3 text-right">Horas (P / R)</th>
                <th className="py-3 px-3 text-right">Diésel (P / R)</th>
                <th className="py-3 px-3 text-right">Costo USD (P / R)</th>
                <th className="py-3 px-3 text-center">Estatus</th>
                <th className="py-3 px-3">Causa de Desviación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                const execPct = item.plannedAreaHa > 0 ? (item.realAreaHa / item.plannedAreaHa) * 100 : 100;
                return (
                  <tr
                    key={`pvr-${item.id}`}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? isLight
                          ? "bg-emerald-50"
                          : "bg-emerald-500/10"
                        : isLight
                        ? "hover:bg-slate-50"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <td className="py-3 px-4 font-bold text-slate-200">
                      <div>
                        <span>{item.laborName}</span>
                        <span className="block text-[10px] text-slate-500 font-mono font-normal">
                          {item.laborCode}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px]">
                      {item.category}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {item.plannedAreaHa.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      {item.realAreaHa.toFixed(1)}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              execPct >= 90
                                ? "bg-emerald-500"
                                : execPct >= 75
                                ? "bg-amber-500"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, execPct)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[11px]">
                          {execPct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      <span>{item.plannedHours.toFixed(0)}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className={item.realHours > item.plannedHours ? "text-amber-400 font-bold" : "text-slate-300"}>
                        {item.realHours.toFixed(0)} h
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      <span>{item.plannedDieselLiters.toFixed(0)}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className={item.realDieselLiters > item.plannedDieselLiters ? "text-amber-400 font-bold" : "text-slate-300"}>
                        {item.realDieselLiters.toFixed(0)} L
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      <span>${item.plannedCostUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className={item.realCostUSD > item.plannedCostUSD ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                        ${item.realCostUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          item.status === "OPTIMO"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : item.status === "ATENCION"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                      {item.deviationCause || "Ejecución conforme al cronograma de zafra."}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Operation Detail Modal / Drawer */}
      {selectedItem && (
        <div className={`p-5 rounded-xl border ${isLight ? "bg-slate-50 border-slate-300" : "bg-slate-900/90 border-slate-700"}`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">
                Auditoría Detallada: {selectedItem.laborName} ({selectedItem.laborCode})
              </h3>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Cerrar Detalle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">Desviación en Superficie</span>
              <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                {selectedItem.deviationAreaHa > 0 ? `+${selectedItem.deviationAreaHa.toFixed(1)}` : selectedItem.deviationAreaHa.toFixed(1)} ha
              </div>
              <span className="text-[11px] text-slate-500">
                {selectedItem.deviationAreaPercent.toFixed(1)}% respecto al plan
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">Desviación Horas-Máquina</span>
              <div className="text-lg font-bold font-mono text-blue-400 mt-1">
                {selectedItem.deviationHours > 0 ? `+${selectedItem.deviationHours.toFixed(1)}` : selectedItem.deviationHours.toFixed(1)} h
              </div>
              <span className="text-[11px] text-slate-500">
                Eficiencia: {((selectedItem.plannedHours / Math.max(1, selectedItem.realHours)) * 100).toFixed(0)}%
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">Desviación en Diésel</span>
              <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                {selectedItem.deviationDieselLiters > 0 ? `+${selectedItem.deviationDieselLiters.toFixed(1)}` : selectedItem.deviationDieselLiters.toFixed(1)} L
              </div>
              <span className="text-[11px] text-slate-500">
                Variación de consumo unitario
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-slate-400 font-medium block">Impacto Financiero</span>
              <div className="text-lg font-bold font-mono text-rose-400 mt-1">
                ${selectedItem.deviationCostUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
              </div>
              <span className="text-[11px] text-slate-500">
                {selectedItem.deviationCostUSD > 0 ? "Sobrecosto en labor" : "Ahorro obtenido"}
              </span>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1">
            <span className="font-bold text-slate-300">Diagnóstico Agronómico & Causa Raíz:</span>
            <p className="text-slate-400 leading-relaxed">
              {selectedItem.deviationCause}
            </p>
            {selectedItem.correctiveAction && (
              <p className="text-amber-400 pt-1">
                <strong>Acción Correctiva:</strong> {selectedItem.correctiveAction}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
