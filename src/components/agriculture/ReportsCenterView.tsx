/**
 * BioAzúcar 4.0 — Centro de Reportes Agrícolas PDA & Auditoría Integral
 * Genera reportes ejecutivos reutilizables con datos reales de la campaña y trazabilidad PDA.
 */

import React, { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  Calculator,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Compass,
} from "lucide-react";
import {
  PdaReportType,
  PdaReportResult,
} from "../../types/agriculture";
import {
  AgriculturalReportingService,
  AgriculturalReportContext,
} from "../../services/agriculture/AgriculturalReportingService";

interface ReportsCenterViewProps {
  context: AgriculturalReportContext;
  theme?: "dark" | "light";
  onOpenFormulas?: () => void;
}

interface ReportOption {
  type: PdaReportType;
  title: string;
  category: "MAESTRO" | "CAMPO" | "OPERACIONES" | "LOGISTICA" | "ECONOMIA" | "AUDITORIA";
  description: string;
  domain: string;
}

const REPORT_CATALOG: ReportOption[] = [
  {
    type: "MASTER_PDA",
    title: "1. Plan Maestro Agrícola / PDA",
    category: "MAESTRO",
    description: "Visión integral consolidada de áreas, rendimientos, molienda, maquinaria, OPEX y CAPEX.",
    domain: "Balance Agrícola Consolidado",
  },
  {
    type: "AREA_BALANCE",
    title: "2. Balance Dinámico de Áreas",
    category: "CAMPO",
    description: "Conservación de superficie, rotación, áreas en demolición y distribución por cortes/cepas.",
    domain: "Dinámica Espacial & Rotación",
  },
  {
    type: "RENOVATION_PLANTING",
    title: "3. Plan de Renovación & Plantación",
    category: "OPERACIONES",
    description: "Área de reforma, demanda de semilla varietal, semilleros e insumos basales al surco.",
    domain: "Plan de Siembra & Viveros",
  },
  {
    type: "SOIL_PREP",
    title: "4. Preparación de Suelo & Barbecho",
    category: "OPERACIONES",
    description: "Cargas mecanizadas de subsolado, arado, grada, nivelación, surcado y diésel agrícola.",
    domain: "Mecanización & Laboreo de Suelos",
  },
  {
    type: "TREATMENTS_INPUTS",
    title: "5. Tratamientos Culturales & Insumos",
    category: "OPERACIONES",
    description: "Tratos en caña planta y socas: herbicidas, fertilización nitrogenada, vinaza y cachaza.",
    domain: "Manejo Agronómico & Nutrición",
  },
  {
    type: "PRODUCTION_TCH",
    title: "6. Producción & TCH por Parcela",
    category: "CAMPO",
    description: "Cédula de parcelas catastradas, cultivar, corte, TCH proyectado y biomasa neta.",
    domain: "Estimación de Biomasa & TCH",
  },
  {
    type: "HARVEST",
    title: "7. Frentes de Cosecha Mecanizada",
    category: "LOGISTICA",
    description: "Dimensionamiento de combinadas cañeras 52 t/h, transbordos y ritmo diario de corte.",
    domain: "Operaciones de Corte Mecanizado",
  },
  {
    type: "MACHINERY",
    title: "8. Balance de Flota & Inversión CAPEX",
    category: "LOGISTICA",
    description: "Comparativa horas requeridas vs parque disponible, detección de déficits y compras.",
    domain: "Balance de Maquinaria & Tracción",
  },
  {
    type: "CCT_LOGISTICS",
    title: "9. Logística CCT & Camiones Rodoviarios",
    category: "LOGISTICA",
    description: "Ciclo rodoviario campo-fábrica, tiempos de tránsito, tolva, báscula y flota de bi-trenes.",
    domain: "Logística Rodoviaria de Transporte",
  },
  {
    type: "FUEL_DIESEL",
    title: "10. Balance de Combustible Diésel",
    category: "ECONOMIA",
    description: "Consolidación de hidrocarburos por fase: preparación, siembra, tratos, cosecha y CCT.",
    domain: "Matriz de Consumo Energético",
  },
  {
    type: "COSTS_OPEX_CAPEX",
    title: "11. Costes Agrícolas (OPEX & CAPEX)",
    category: "ECONOMIA",
    description: "Matriz económica de costo directo por hectárea y por tonelada de caña puesta en fábrica.",
    domain: "Estructura de Costes de Producción",
  },
  {
    type: "CAMPAIGN_SCENARIO_COMPARISON",
    title: "12. Comparación de Escenarios What-If",
    category: "AUDITORIA",
    description: "Sensibilidad climática (sequía vs óptimo) y evaluación del modelo BioAzúcar 4.0.",
    domain: "Evaluación de Sensibilidad Agronómica",
  },
  {
    type: "FORMULAS_PARAMETERS_TRACE",
    title: "13. Trazabilidad de Fórmulas & Parámetros",
    category: "AUDITORIA",
    description: "Matriz de gobernanza ISA-95, procedencia del modelo, versiones y balance de ecuaciones.",
    domain: "Gobernanza & Trazabilidad de Modelos",
  },
];

export const ReportsCenterView: React.FC<ReportsCenterViewProps> = ({
  context,
  theme = "dark",
  onOpenFormulas,
}) => {
  const isLight = theme === "light";
  const [selectedReportType, setSelectedReportType] = useState<PdaReportType>("MASTER_PDA");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Filtered reports catalogue
  const filteredCatalog = useMemo(() => {
    return REPORT_CATALOG.filter((rep) => {
      const matchCat = filterCategory === "ALL" || rep.category === filterCategory;
      const matchSearch =
        searchTerm.trim() === "" ||
        rep.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rep.domain.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [filterCategory, searchTerm]);

  // Generate the active report with real data
  const currentReport: PdaReportResult = useMemo(() => {
    return AgriculturalReportingService.generateReport(selectedReportType, context);
  }, [selectedReportType, context]);

  // Export handlers
  const handleDownloadCsv = () => {
    const csvContent = AgriculturalReportingService.exportToCsv(currentReport);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_${selectedReportType.toLowerCase()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const jsonContent = AgriculturalReportingService.exportToJson(currentReport);
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_${selectedReportType.toLowerCase()}_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
        isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
      }`}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold">Centro de Reportes Agrícolas & Trazabilidad PDA</h2>
          </div>
          <p className="text-xs text-slate-400">
            Generador determinístico de los 13 informes ejecutivos del Modelo Agrícola Canónico BioAzúcar 4.0 con datos vivos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenFormulas && (
            <button
              onClick={onOpenFormulas}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
                  : "bg-violet-500/10 border-violet-500/30 text-violet-300 hover:bg-violet-500/20"
              }`}
            >
              <Calculator className="w-4 h-4 text-violet-400" />
              <span>Gobernanza de Fórmulas</span>
            </button>
          )}

          <button
            onClick={handleDownloadCsv}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              isLight
                ? "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              isLight
                ? "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
              isLight
                ? "bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                : "bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20"
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Report Selector Grid & Filter Strip */}
      <div className={`p-4 rounded-xl border space-y-4 ${isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"}`}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-400">Filtrar por Categoría:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border outline-hidden ${
                isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-200"
              }`}
            >
              <option value="ALL">Todas las Categorías (13)</option>
              <option value="MAESTRO">Maestro PDA</option>
              <option value="CAMPO">Campo & Rendimientos</option>
              <option value="OPERACIONES">Labores & Siembra</option>
              <option value="LOGISTICA">Cosecha & Flota</option>
              <option value="ECONOMIA">Costes & Combustible</option>
              <option value="AUDITORIA">Auditoría & Escenarios</option>
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar reporte..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-hidden ${
                isLight ? "bg-slate-50 border-slate-300 text-slate-800" : "bg-slate-800 border-slate-700 text-slate-200"
              }`}
            />
          </div>
        </div>

        {/* Report Buttons Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 pt-2">
          {filteredCatalog.map((rep) => {
            const isSelected = selectedReportType === rep.type;
            return (
              <button
                key={rep.type}
                onClick={() => setSelectedReportType(rep.type)}
                className={`text-left p-3 rounded-xl border transition flex flex-col justify-between ${
                  isSelected
                    ? isLight
                      ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20"
                      : "bg-emerald-500/10 border-emerald-500/60 ring-1 ring-emerald-500/30"
                    : isLight
                    ? "bg-slate-50/80 border-slate-200 hover:bg-slate-100"
                    : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`text-xs font-bold ${isSelected ? "text-emerald-500" : isLight ? "text-slate-800" : "text-slate-200"}`}>
                      {rep.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                      isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                    }`}>
                      {rep.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {rep.description}
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Dominio: {rep.domain}</span>
                  {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Report Header & Metadata */}
      <div className={`p-6 rounded-xl border space-y-6 ${isLight ? "bg-white border-slate-200 shadow-sm" : "bg-slate-900 border-slate-800"}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {currentReport.metadata.reportType}
              </span>
              <span className="text-xs text-slate-400">ID: {currentReport.metadata.reportId}</span>
            </div>
            <h3 className="text-xl font-bold mt-1 text-slate-100">{currentReport.metadata.title}</h3>
            {currentReport.metadata.subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{currentReport.metadata.subtitle}</p>
            )}
          </div>

          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <div>Campaña: <span className="text-slate-200 font-semibold">{currentReport.metadata.campaignName}</span></div>
            <div>Revisión: <span className="text-emerald-400 font-mono font-semibold">{currentReport.metadata.modelRevision}</span></div>
            <div>Generado: <span className="font-mono text-slate-300">{new Date(currentReport.metadata.generatedAt).toLocaleString()}</span></div>
          </div>
        </div>

        {/* KPI Strip for Active Report */}
        {currentReport.summaryKpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {currentReport.summaryKpis.map((kpi, idx) => (
              <div
                key={`kpi-${idx}`}
                className={`p-3.5 rounded-xl border ${
                  isLight ? "bg-slate-50 border-slate-200" : "bg-slate-950/70 border-slate-800"
                }`}
              >
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                  {kpi.label}
                </span>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className={`text-lg font-bold font-mono ${kpi.color || (isLight ? "text-slate-900" : "text-slate-100")}`}>
                    {kpi.value}
                  </span>
                  {kpi.unit && <span className="text-xs text-slate-500">{kpi.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800/80">
          <table className="w-full text-xs text-left">
            <thead className={`uppercase font-mono text-[11px] border-b ${
              isLight ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-slate-950/80 border-slate-800 text-slate-400"
            }`}>
              <tr>
                {currentReport.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-4 py-3 font-semibold ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    }`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 font-mono">
              {currentReport.rows.map((row, rIdx) => (
                <tr
                  key={`r-${rIdx}`}
                  className={`transition-colors ${
                    isLight ? "hover:bg-slate-50" : "hover:bg-slate-800/40"
                  } ${rIdx % 2 === 0 ? (isLight ? "bg-white" : "bg-slate-900/30") : (isLight ? "bg-slate-50/50" : "bg-slate-950/20")}`}
                >
                  {currentReport.columns.map((col) => (
                    <td
                      key={`${rIdx}-${col.key}`}
                      className={`px-4 py-2.5 whitespace-nowrap ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      } ${col.key === "modulo" || col.key === "lote" || col.key === "escenario" || col.key === "labor" ? "font-sans font-semibold text-slate-200" : "text-slate-300"}`}
                    >
                      {row[col.key] !== undefined ? String(row[col.key]) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Audit & Trace Notes Box */}
        {currentReport.traceNotes && currentReport.traceNotes.length > 0 && (
          <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
            isLight ? "bg-emerald-50/50 border-emerald-200 text-slate-700" : "bg-emerald-950/20 border-emerald-500/20 text-slate-300"
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Certificación de Trazabilidad & Conformidad PDA</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-slate-400 font-sans">
              {currentReport.traceNotes.map((note, nIdx) => (
                <li key={`note-${nIdx}`}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
