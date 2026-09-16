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
  Play,
  History,
  Layers,
  Sparkles,
  Ban,
  RotateCcw,
} from "lucide-react";
import {
  PdaFormulaMaster,
  CalculationTrace,
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

  // Testing & Evaluation State
  const [testInputs, setTestInputs] = useState<Record<string, number>>({});
  const [testResult, setTestResult] = useState<{
    success: boolean;
    result?: number;
    unit: string;
    warnings: string[];
    error?: string;
    trace?: CalculationTrace;
  } | null>(null);

  // Edit Formula Versioning State
  const [isEditingVersion, setIsEditingVersion] = useState<boolean>(false);
  const [editExpression, setEditExpression] = useState<string>("");
  const [editReason, setEditReason] = useState<string>("");
  const [notification, setNotification] = useState<string | null>(null);

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

  const handleSelectFormula = (formula: PdaFormulaMaster) => {
    setSelectedFormula(formula);
    setIsEditingVersion(false);
    setEditExpression(formula.expression);
    setEditReason("");
    setTestResult(null);

    // Populate initial test inputs
    const initialInputs: Record<string, number> = {};
    formula.variables.forEach((v) => {
      if (v.symbol.includes("Tch") || v.symbol === "BaseYieldTch") initialInputs[v.symbol] = 85.0;
      else if (v.symbol === "RatoonDecay") initialInputs[v.symbol] = 0.95;
      else if (v.symbol.includes("Factor")) initialInputs[v.symbol] = 1.0;
      else if (v.symbol.includes("Area")) initialInputs[v.symbol] = 120.0;
      else if (v.symbol.includes("Days")) initialInputs[v.symbol] = 150;
      else if (v.symbol.includes("Hours")) initialInputs[v.symbol] = 16;
      else if (v.symbol.includes("Tons")) initialInputs[v.symbol] = 10000;
      else if (v.symbol.includes("Payload")) initialInputs[v.symbol] = 28;
      else if (v.symbol.includes("Cycles")) initialInputs[v.symbol] = 4;
      else if (v.symbol.includes("Opex")) initialInputs[v.symbol] = 2500000;
      else initialInputs[v.symbol] = 1.0;
    });
    setTestInputs(initialInputs);
  };

  const handleRunEvaluation = () => {
    if (!selectedFormula) return;
    const res = PdaFormulaRegistry.evaluateFormula(selectedFormula.formulaId, testInputs, {
      scenario: "Simulación en Vivo BioAzúcar 4.0",
      user: "Auditor Agrónomo",
    });
    setTestResult(res);
  };

  const handleSaveFormulaVersion = () => {
    if (!selectedFormula || !editReason.trim()) {
      alert("Por favor ingrese el motivo del cambio para el registro de auditoría.");
      return;
    }
    const updateRes = PdaFormulaRegistry.updateFormula({
      formulaId: selectedFormula.formulaId,
      newExpression: editExpression,
      reason: editReason,
      changedBy: "Auditor Agronómico BioAzúcar",
    });

    if (updateRes.success && updateRes.updatedFormula) {
      setFormulas(PdaFormulaRegistry.getAllFormulas());
      setSelectedFormula(updateRes.updatedFormula);
      setIsEditingVersion(false);
      setNotification(`Fórmula actualizada exitosamente a v${updateRes.updatedFormula.version}`);
      setTimeout(() => setNotification(null), 3500);
    }
  };

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
                  Motor Ejecutable & Trazabilidad ISA-95
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Catálogo centralizado versionado de expresiones físico-matemáticas con simulador de variables y trazabilidad de cálculo.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {notification && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-5 py-2 text-xs font-mono text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isLight ? "bg-slate-100/60 border-slate-200" : "bg-slate-950/40 border-slate-800"
        }`}>
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar fórmula por ID, expresión, variable o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border font-mono outline-hidden transition ${
                  isLight
                    ? "bg-white border-slate-300 text-slate-800 focus:border-violet-500"
                    : "bg-slate-900 border-slate-700 text-slate-200 focus:border-violet-500"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={filterOrigin}
              onChange={(e) => setFilterOrigin(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono outline-hidden ${
                isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <option value="ALL">Todos los Orígenes</option>
              <option value="BIOAZUCAR_4_0">BioAzúcar 4.0 (Soberano)</option>
              <option value="PDA_SOBERANO">PDA Soberano</option>
              <option value="CONFIGURABLE">Configurable</option>
              <option value="CANONICAL_PDA">Canónico PDA</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-mono outline-hidden ${
                isLight ? "bg-white border-slate-300 text-slate-800" : "bg-slate-900 border-slate-700 text-slate-300"
              }`}
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PDA_VALIDATED">PDA Validado</option>
              <option value="BIOAZUCAR_MODEL">Modelo BioAzúcar</option>
              <option value="CONFIGURABLE">Configurable</option>
              <option value="INVALID_REFERENCE">Inválido (#REF!)</option>
            </select>
          </div>
        </div>

        {/* Modal Body: Split view (List / Details & Test Harness) */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Formulas List (Column 1) */}
          <div className="lg:col-span-6 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1">
              <span>Fórmulas Registradas ({filteredFormulas.length})</span>
              <button
                onClick={() => {
                  PdaFormulaRegistry.resetToCanonical();
                  setFormulas(PdaFormulaRegistry.getAllFormulas());
                  setNotification("Fórmulas restablecidas a línea base canónica.");
                  setTimeout(() => setNotification(null), 3000);
                }}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Canónico</span>
              </button>
            </div>

            {filteredFormulas.map((formula) => {
              const isSelected = selectedFormula?.formulaId === formula.formulaId;
              const isInvalid = formula.status === "INVALID_REFERENCE";

              return (
                <div
                  key={formula.formulaId}
                  onClick={() => handleSelectFormula(formula)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? "bg-violet-500/10 border-violet-500 shadow-xs"
                      : isLight
                      ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                      : "bg-slate-800/40 hover:bg-slate-800/80 border-slate-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-200">
                          {formula.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          v{formula.version}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400 block mt-0.5">
                        {formula.formulaId}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isInvalid
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1"
                          : formula.modelOrigin === "BIOAZUCAR_4_0"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {isInvalid && <Ban className="w-3 h-3" />}
                      {formula.modelOrigin}
                    </span>
                  </div>

                  <div className="mt-2 p-2 rounded bg-black/40 font-mono text-[11px] text-slate-300 truncate border border-slate-900">
                    {formula.expression}
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Módulo: {formula.moduleCategory || "AGRONOMIA"}</span>
                    <span>Salida: {formula.units}</span>
                    <span>Variables: {formula.variables?.length || 0}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Test Harness & Inspection (Column 2) */}
          <div className="lg:col-span-6 space-y-4">
            {selectedFormula ? (
              <div className={`p-4 rounded-xl border ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/50 border-slate-700"}`}>
                <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-violet-400" />
                      <span>{selectedFormula.name}</span>
                    </h3>
                    <span className="text-xs font-mono text-emerald-400">
                      ID: {selectedFormula.formulaId} (v{selectedFormula.version})
                    </span>
                  </div>

                  <button
                    onClick={() => setIsEditingVersion(!isEditingVersion)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition"
                  >
                    {isEditingVersion ? "Cancelar Edición" : "Versionar Expresión"}
                  </button>
                </div>

                {/* Edit Version Form */}
                {isEditingVersion ? (
                  <div className="space-y-3 p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs mb-4">
                    <span className="font-bold text-violet-400 block">
                      Crear Nueva Versión de Ecuación (Gobernanza ISA-95)
                    </span>
                    <div>
                      <label className="block text-slate-400 mb-1">Expresión Matemática:</label>
                      <input
                        type="text"
                        value={editExpression}
                        onChange={(e) => setEditExpression(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-emerald-300 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Motivo del Cambio (Auditoría):</label>
                      <input
                        type="text"
                        placeholder="Ej: Calibración de factor de suelo según muestreo 2026..."
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-slate-200 text-xs"
                      />
                    </div>
                    <button
                      onClick={handleSaveFormulaVersion}
                      className="w-full py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      Publicar Versión Auditada
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-black/60 border border-slate-800 font-mono text-xs text-emerald-300 mb-4">
                    {selectedFormula.expression}
                  </div>
                )}

                {/* Simulator Inputs */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                    Simulador Interactivo de Variables
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {selectedFormula.variables.map((v) => (
                      <div key={v.symbol} className="p-2 rounded bg-slate-900/80 border border-slate-800 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-mono text-emerald-400 font-bold">{v.symbol}</span>
                          <span className="text-[10px]">{v.unit}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate">{v.name}</span>
                        <input
                          type="number"
                          step="any"
                          value={testInputs[v.symbol] ?? ""}
                          onChange={(e) =>
                            setTestInputs({
                              ...testInputs,
                              [v.symbol]: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-xs text-slate-100"
                        />
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleRunEvaluation}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs transition shadow-xs"
                  >
                    <Play className="w-4 h-4" />
                    <span>Ejecutar Ecuación & Validar</span>
                  </button>
                </div>

                {/* Test Result Display */}
                {testResult && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="font-bold text-slate-200">Resultado de la Ejecución:</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          testResult.success
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {testResult.success ? "CALCULADO CON ÉXITO" : "ERROR DE CÁLCULO"}
                      </span>
                    </div>

                    {testResult.success ? (
                      <div>
                        <div className="flex items-baseline gap-2 mt-1">
                          <span className="text-2xl font-black font-mono text-emerald-400">
                            {testResult.result}
                          </span>
                          <span className="font-mono text-slate-400 font-bold">{testResult.unit}</span>
                        </div>

                        {testResult.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {testResult.warnings.map((w, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>{w}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {testResult.trace && (
                          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-500 space-y-0.5">
                            <div>Trace ID: {testResult.trace.formulaId}</div>
                            <div>Modelo: {testResult.trace.modelType} | v{testResult.trace.modelVersion}</div>
                            <div>Calculado: {new Date(testResult.trace.calculatedAt).toLocaleTimeString()}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-rose-400 flex items-start gap-1.5 mt-1">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{testResult.error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 rounded-xl border border-dashed border-slate-800 text-center text-slate-500 text-xs">
                <Calculator className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                <p>Seleccione una fórmula del panel izquierdo para inspeccionar sus variables y probar su ejecución matemática.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t shrink-0 flex items-center justify-between ${
          isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-800"
        }`}>
          <div className="text-xs text-slate-400 font-mono">
            Mostrando {filteredFormulas.length} de {formulas.length} fórmulas registradas en BioAzúcar 4.0
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
