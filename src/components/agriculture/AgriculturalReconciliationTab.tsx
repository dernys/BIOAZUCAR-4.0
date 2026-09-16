import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Filter,
  Info,
  Layers,
  Scale,
  DollarSign,
  Tractor,
  Truck,
  Wheat,
  Activity,
  FileCheck,
} from "lucide-react";
import {
  AgriculturalReconciliationSummary,
  AgriculturalReconciliationCheck,
  ReconciliationStatus,
} from "../../types/agriculture";

interface AgriculturalReconciliationTabProps {
  theme?: "dark" | "light";
  report: AgriculturalReconciliationSummary;
  onRunReconciliation?: () => void;
  campaignName?: string;
}

export const AgriculturalReconciliationTab: React.FC<AgriculturalReconciliationTabProps> = ({
  theme = "dark",
  report,
  onRunReconciliation,
  campaignName = "Zafra Actual",
}) => {
  const isLight = theme === "light";
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [selectedCheck, setSelectedCheck] = useState<AgriculturalReconciliationCheck | null>(null);

  const integrityScorePercent = Math.round(
    (report.passCount / Math.max(1, report.checksCount)) * 100
  );

  const filteredChecks = report.checks.filter((chk) => {
    if (filterStatus === "ALL") return true;
    return chk.status === filterStatus;
  });

  const exportAuditDocument = () => {
    const text = `# ACTA DE AUDITORÍA Y RECONCILIACIÓN MATEMÁTICA AGRÍCOLA
BioAzúcar 4.0 — Inteligencia y Planificación Agrícola Soberana
Fecha de Emisión: ${new Date(report.timestamp).toLocaleString()}
Campaña: ${campaignName} (${report.campaignId})

## RESULTADO GLOBAL
- Estado de Reconciliación: ${report.overallStatus}
- Índice de Integridad Matemática: ${integrityScorePercent}%
- Total Verificaciones: ${report.checksCount}
- Aprobadas: ${report.passCount}
- Advertencias: ${report.warningCount}
- Críticas: ${report.criticalCount}

## DETALLE DE VERIFICACIONES MATEMÁTICAS
${report.checks
  .map(
    (c, idx) => `
### ${idx + 1}. [${c.status}] ${c.name} (${c.checkId})
- Categoría: ${c.category}
- Fórmula / Regla: ${c.formulaDescription}
- Valor Esperado: ${c.expectedValue} ${c.unit}
- Valor Actual: ${c.actualValue} ${c.unit}
- Diferencia: ${c.difference} ${c.unit} (Tolerancia: ±${c.tolerance} ${c.unit})
- Detalle: ${c.details}
- Acción Correctiva: ${c.remediationAction}
`
  )
  .join("\n")}

--------------------------------------------------------------------------------
Certificado bajo el Estándar de Data Truth de BioAzúcar 4.0.
`;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Acta_Reconciliacion_${report.campaignId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AREA_BALANCE":
        return Wheat;
      case "PRODUCTION_BALANCE":
        return Layers;
      case "HARVEST_BALANCE":
        return Activity;
      case "CCT_BALANCE":
        return Truck;
      case "MILL_DEMAND_BALANCE":
        return Scale;
      case "OPEX_BALANCE":
      case "UNIT_COST_BALANCE":
      case "CAPEX_BALANCE":
        return DollarSign;
      default:
        return Tractor;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold font-mono tracking-tight">
              Matriz de Reconciliación Matemática & Auditoría Data Truth
            </h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono uppercase tracking-wider ${
                report.overallStatus === "PASS"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : report.overallStatus === "WARNING"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
              }`}
            >
              ESTADO: {report.overallStatus}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Validación estricta de coherencia integral E2E: balance de áreas, producción, tracción de maquinaria, ciclo CCT, molienda fabril y contabilidad OPEX/CAPEX.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRunReconciliation && (
            <button
              onClick={onRunReconciliation}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Ejecutar Verificación E2E</span>
            </button>
          )}
          <button
            onClick={exportAuditDocument}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>Descargar Acta de Auditoría</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Score Card */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Score de Integridad</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black font-mono ${
                integrityScorePercent >= 90
                  ? "text-emerald-400"
                  : integrityScorePercent >= 75
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {integrityScorePercent}%
            </span>
            <span className="text-xs text-slate-500">coherencia</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                integrityScorePercent >= 90
                  ? "bg-emerald-500"
                  : integrityScorePercent >= 75
                  ? "bg-amber-500"
                  : "bg-rose-500"
              }`}
              style={{ width: `${integrityScorePercent}%` }}
            />
          </div>
        </div>

        {/* Total Checks */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Verificaciones Ejecutadas</span>
            <Scale className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-slate-100">
              {report.checksCount}
            </span>
            <span className="text-xs text-slate-400">ecuaciones</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Validaciones de balance y físicas
          </div>
        </div>

        {/* Passed */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Aprobadas (PASS)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-emerald-400">
              {report.passCount}
            </span>
            <span className="text-xs text-slate-500">sin descuadre</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Tolerancia matemática cumplida
          </div>
        </div>

        {/* Warnings */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Advertencias (WARN)</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-amber-400">
              {report.warningCount}
            </span>
            <span className="text-xs text-slate-500">desviaciones menores</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            Requieren revisión operativa
          </div>
        </div>

        {/* Critical */}
        <div className={`p-4 rounded-xl border ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
            <span>Críticas (CRITICAL)</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-rose-400">
              {report.criticalCount}
            </span>
            <span className="text-xs text-slate-500">bloqueantes</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 font-mono">
            {report.criticalCount === 0 ? "Sin errores bloqueantes" : "Acción inmediata requerida"}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {["ALL", "PASS", "WARNING", "ERROR", "CRITICAL"].map((st) => (
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
            {st === "ALL" ? "Todas las Reglas" : st}
          </button>
        ))}
      </div>

      {/* Main Reconciliation Table */}
      <div className={`rounded-xl border overflow-hidden ${isLight ? "bg-white border-slate-200 shadow-xs" : "bg-slate-900 border-slate-800"}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className={`text-[11px] font-bold uppercase tracking-wider border-b ${
              isLight ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-slate-950/80 text-slate-400 border-slate-800"
            }`}>
              <tr>
                <th className="py-3 px-4">Verificación / Ecuación</th>
                <th className="py-3 px-3">Categoría</th>
                <th className="py-3 px-3 text-right">Valor Esperado</th>
                <th className="py-3 px-3 text-right">Valor Actual</th>
                <th className="py-3 px-3 text-right">Diferencia</th>
                <th className="py-3 px-3 text-center">Tolerancia</th>
                <th className="py-3 px-3 text-center">Estatus</th>
                <th className="py-3 px-3">Acción Recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredChecks.map((chk) => {
                const Icon = getCategoryIcon(chk.category);
                const isSelected = selectedCheck?.checkId === chk.checkId;
                return (
                  <tr
                    key={chk.checkId}
                    onClick={() => setSelectedCheck(isSelected ? null : chk)}
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
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div>
                          <span>{chk.name}</span>
                          <span className="block text-[10px] text-slate-400 font-mono font-normal">
                            {chk.checkId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                      {chk.category}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-300">
                      {typeof chk.expectedValue === "number" ? chk.expectedValue.toLocaleString() : chk.expectedValue} {chk.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-100">
                      {typeof chk.actualValue === "number" ? chk.actualValue.toLocaleString() : chk.actualValue} {chk.unit}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">
                      <span className={chk.difference > chk.tolerance ? "text-rose-400 font-bold" : "text-emerald-400"}>
                        {chk.difference > 0 ? `+${chk.difference.toLocaleString()}` : chk.difference.toLocaleString()} {chk.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-400">
                      ±{chk.tolerance} {chk.unit}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                          chk.status === "PASS"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : chk.status === "WARNING"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {chk.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-slate-400 max-w-sm truncate">
                      {chk.remediationAction}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Check Detail Box */}
      {selectedCheck && (
        <div className={`p-5 rounded-xl border ${isLight ? "bg-slate-50 border-slate-300" : "bg-slate-900/90 border-slate-700"}`}>
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">
                Auditoría Técnica: {selectedCheck.name} ({selectedCheck.checkId})
              </h3>
            </div>
            <button
              onClick={() => setSelectedCheck(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <div>
                <span className="text-slate-400 font-semibold block">Ecuación / Regla de Coherencia:</span>
                <code className="text-emerald-400 font-mono text-[11px] block mt-1 bg-slate-950 p-2 rounded border border-slate-800">
                  {selectedCheck.formulaDescription}
                </code>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Diagnóstico de Auditoría:</span>
                <p className="text-slate-300 mt-1 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-800">
                  {selectedCheck.details}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-slate-400 font-semibold block">Acción de Remediación Sugerida:</span>
                <p className="text-amber-300 mt-1 leading-relaxed bg-amber-500/10 p-2.5 rounded border border-amber-500/20">
                  {selectedCheck.remediationAction}
                </p>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono">
                <span className="text-slate-400">Tolerancia Permisible:</span>
                <span className="text-slate-200">±{selectedCheck.tolerance} {selectedCheck.unit}</span>
                <span className="text-slate-400">Diferencia Registrada:</span>
                <span className={selectedCheck.difference > selectedCheck.tolerance ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                  {selectedCheck.difference.toLocaleString()} {selectedCheck.unit}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
