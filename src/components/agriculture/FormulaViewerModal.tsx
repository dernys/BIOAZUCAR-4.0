import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Search,
  Filter,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ExternalLink,
  Ban,
} from "lucide-react";
import {
  PdaFormulaMaster,
  PdaFormulaStatus,
  PdaModelOrigin,
} from "../../types/agriculture";
import { PdaFormulaRegistry } from "../../services/agriculture/PdaFormulaRegistry";

interface FormulaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
  onOpenParameterEditor?: (paramKey: string) => void;
}

export const FormulaViewerModal: React.FC<FormulaViewerModalProps> = ({
  isOpen,
  onClose,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [formulas, setFormulas] = useState<PdaFormulaMaster[]>(() =>
    PdaFormulaRegistry.getAllFormulas()
  );

  useEffect(() => {
    if (isOpen) {
      setFormulas(PdaFormulaRegistry.getAllFormulas());
    }
  }, [isOpen]);

  const [filterOrigin, setFilterOrigin] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFormula, setSelectedFormula] = useState<PdaFormulaMaster | null>(null);

  const filteredFormulas = useMemo(() => {
    return formulas.filter((f) => {
      const matchOrigin = filterOrigin === "ALL" || f.modelOrigin === filterOrigin;
      const matchStatus =
        filterStatus === "ALL" ||
        f.status === filterStatus ||
        (filterStatus === "PDA_VERIFIED" && f.status === "PDA_VALIDATED");
      const matchSearch =
        searchTerm.trim() === "" ||
        f.formulaId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.expression.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.moduleCategory || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.description || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchOrigin && matchStatus && matchSearch;
    });
  }, [formulas, filterOrigin, filterStatus, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div
        className={`w-full max-w-5xl rounded-2xl border shadow-2xl overflow-hidden transition-all my-6 max-h-[90vh] flex flex-col ${
          isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-900 border-slate-700 text-slate-100"
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between shrink-0 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/80 border-slate-800"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold font-mono tracking-wide">
                  Gobernanza del Modelo Matemático & Ecuaciones PDA
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Modelo Canónico Validado & BioAzúcar 4.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Catálogo centralizado versionado de expresiones físico-matemáticas, variables agronómicas y segregación de modelos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className={`p-4 border-b shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3 ${
          isLight ? "bg-slate-100/60 border-slate-200" : "bg-slate-950/60 border-slate-800"
        }`}>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-400">Origen:</span>
              <select
                value={filterOrigin}
                onChange={(e) => setFilterOrigin(e.target.value)}
                className={`text-xs px-2.5 py-1 rounded-lg border outline-hidden ${
                  isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todos los Orígenes</option>
                <option value="PDA_2014">PDA Canónico (Validado)</option>
                <option value="BIOAZUCAR_4_0">BioAzúcar 4.0 (Mejora Predictiva)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-400">Estado:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={`text-xs px-2.5 py-1 rounded-lg border outline-hidden ${
                  isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-slate-200"
                }`}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PDA_VERIFIED">PDA_VALIDATED (Modelo Canónico Validado)</option>
                <option value="DERIVED">DERIVED (Derivadas/Predictivas)</option>
                <option value="INVALID_SOURCE">INVALID_SOURCE (#REF! Dañadas)</option>
              </select>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Buscar ecuación, variable o módulo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-hidden ${
                isLight ? "bg-white border-slate-300" : "bg-slate-900 border-slate-700 text-slate-200"
              }`}
            />
          </div>
        </div>

        {/* Content list */}
        <div className="p-6 space-y-4 overflow-y-auto grow text-sm">
          {filteredFormulas.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              No se encontraron fórmulas que coincidan con los filtros aplicados.
            </div>
          ) : (
            filteredFormulas.map((formula, idx) => {
              const isVerified = formula.status === "PDA_VERIFIED" || formula.status === "PDA_VALIDATED";
              const isInvalid = formula.status === "INVALID_SOURCE";
              const isBioazucar = formula.modelOrigin === "BIOAZUCAR_4_0";

              return (
                <div
                  key={`${formula.formulaId}-${idx}`}
                  className={`p-4 rounded-xl border transition space-y-3 ${
                    isInvalid
                      ? "bg-rose-950/20 border-rose-500/40 text-rose-100"
                      : isBioazucar
                      ? "bg-violet-950/20 border-violet-500/30 text-slate-100"
                      : isLight
                      ? "bg-slate-50 border-slate-200"
                      : "bg-slate-800/40 border-slate-700/60"
                  }`}
                >
                  {/* Title & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        [{formula.formulaId}]
                      </span>
                      <h4 className="font-bold text-sm text-slate-100">{formula.name}</h4>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        formula.modelOrigin === "PDA_2014"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                      }`}>
                        {formula.modelOrigin}
                      </span>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isVerified
                          ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                          : isInvalid
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        {isInvalid && <Ban className="w-3 h-3" />}
                        {formula.status}
                      </span>

                      <span className="text-[10px] font-mono text-slate-500">v{formula.version}</span>
                    </div>
                  </div>

                  {/* Mathematical Expression Box */}
                  <div className={`p-3 rounded-lg font-mono text-xs border ${
                    isInvalid
                      ? "bg-rose-950/40 border-rose-500/40 text-rose-200"
                      : "bg-black/50 border-slate-800 text-emerald-300"
                  }`}>
                    {formula.expression}
                  </div>

                  {/* Warning for damaged source formula (#REF!) */}
                  {isInvalid && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                      <div>
                        <span className="font-bold block">Ecuación histórica no resuelta (#REF! en registro documental previo):</span>
                        {formula.notes}
                      </div>
                    </div>
                  )}

                  {/* Origin reference & Range */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-800/60 font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500 block">Identificador Canónico:</span>
                      <span className="text-slate-300 font-semibold">{formula.formulaId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Módulo / Categoría:</span>
                      <span className="text-slate-300 font-semibold">{formula.moduleCategory || "AGRONOMIA"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Unidad de Salida:</span>
                      <span className="text-emerald-400 font-semibold">{formula.units}</span>
                    </div>
                  </div>

                  {/* Variables table */}
                  {formula.variables && formula.variables.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Variables y Parámetros:
                      </span>
                      <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-950/60 text-slate-400 font-mono text-[10px] uppercase">
                            <tr>
                              <th className="px-3 py-1.5">Símbolo</th>
                              <th className="px-3 py-1.5">Nombre</th>
                              <th className="px-3 py-1.5 text-center">Unidad</th>
                              <th className="px-3 py-1.5">Descripción Agronómica</th>
                              <th className="px-3 py-1.5">Dominio / Módulo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                            {formula.variables.map((v, vIdx) => (
                              <tr key={`var-${vIdx}`} className="hover:bg-slate-800/30">
                                <td className="px-3 py-1 text-emerald-400 font-bold">{v.symbol}</td>
                                <td className="px-3 py-1 font-sans text-slate-200">{v.name}</td>
                                <td className="px-3 py-1 text-center text-slate-400">{v.unit}</td>
                                <td className="px-3 py-1 font-sans text-slate-400">{v.description}</td>
                                <td className="px-3 py-1 text-slate-500">{v.moduleCategory || "GENERAL"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Notes / Provenance */}
                  {formula.notes && !isInvalid && (
                    <p className="text-[11px] text-slate-400 italic pt-1">
                      {formula.notes}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className={`p-4 border-t shrink-0 flex items-center justify-between ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-800"
        }`}>
          <div className="text-xs text-slate-400 font-mono">
            Mostrando {filteredFormulas.length} de {formulas.length} fórmulas registradas
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition-colors"
          >
            Cerrar Gobernanza
          </button>
        </div>
      </div>
    </div>
  );
};
