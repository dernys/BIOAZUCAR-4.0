import React, { useState, useEffect, useMemo } from "react";
import { X, Sliders, Check, AlertCircle, Sparkles, Code, CheckCircle2, Braces, ListFilter } from "lucide-react";
import { AgriculturalParameter, AgroParameterCategory, ValidationStatus } from "../../types/agriculture";
import {
  formatGovernedValue,
  detectGovernedValueType,
  validateGovernedJson,
  parseGovernedInput,
} from "../../utils/governedValueFormatter";

interface ParameterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (param: AgriculturalParameter) => void;
  initialParam?: AgriculturalParameter | null;
  theme?: "dark" | "light";
  tenantId: string;
}

const CATEGORIES: { value: AgroParameterCategory; label: string }[] = [
  { value: "VARIEDAD", label: "Variedades & Curvas de Decaimiento" },
  { value: "SUELO", label: "Factores Edafológicos / Suelo" },
  { value: "PREPARACION_SUELO", label: "Preparación de Suelo & Labores" },
  { value: "PLANTIO", label: "Plantío, Siembra & Semilla" },
  { value: "TRATOS_CULTURALES", label: "Tratos Culturales & Subproductos (Vinaza/Cachaza)" },
  { value: "MAQUINARIA", label: "Maquinaria, Rendimientos & Combustible" },
  { value: "CCT_LOGISTICA", label: "CCT (Corte, Alce y Transporte) & Tiempos" },
  { value: "ECONOMIA", label: "Precios Unitarios, Insumos & OPEX/CAPEX" },
  { value: "THRESHOLDS", label: "Límites, Factores de Seguridad & Umbrales" },
];

type SupportedValueType = "numeric" | "text" | "boolean" | "object" | "array";

export const ParameterModal: React.FC<ParameterModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialParam,
  theme = "dark",
  tenantId,
}) => {
  const isLight = theme === "light";

  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [category, setCategory] = useState<AgroParameterCategory>("AGRO_OPERATIONS");
  const [valueType, setValueType] = useState<SupportedValueType>("numeric");
  const [value, setValue] = useState<string>("");
  const [unit, setUnit] = useState("");
  const [source, setSource] = useState("Calibración Agronómica Local");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("CONFIRMADO");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialParam) {
      setName(initialParam.name);
      setKey(initialParam.key);
      setCategory(initialParam.category);

      // Detect original type with high precision
      let detectedType: SupportedValueType = "numeric";
      if (initialParam.type === "object" || typeof initialParam.value === "object") {
        detectedType = Array.isArray(initialParam.value) ? "array" : "object";
      } else if (initialParam.type === "boolean" || typeof initialParam.value === "boolean") {
        detectedType = "boolean";
      } else if (initialParam.type === "text" || typeof initialParam.value === "string") {
        detectedType = "text";
      } else {
        detectedType = "numeric";
      }
      setValueType(detectedType);

      if (detectedType === "object" || detectedType === "array") {
        setValue(formatGovernedValue(initialParam.value, undefined, { multiline: true, indent: 2 }));
      } else {
        setValue(formatGovernedValue(initialParam.value));
      }

      setUnit(initialParam.unit);
      setSource(initialParam.source || "Calibración Agronómica Local");
      setDescription(initialParam.description || "");
      setNotes(initialParam.notes || "");
      setValidationStatus(
        initialParam.validationStatus === "REQUIRES_VALIDATION"
          ? "REQUIERE_VALIDACION"
          : initialParam.validationStatus === "CONFIGURABLE"
          ? "CONFIGURABLE"
          : "CONFIRMADO"
      );
    } else {
      setName("");
      setKey("");
      setCategory("MAQUINARIA");
      setValueType("numeric");
      setValue("1.0");
      setUnit("L/ha");
      setSource("Calibración Agronómica Local");
      setDescription("");
      setNotes("");
      setValidationStatus("CONFIRMADO");
    }
    setErrorMsg(null);
  }, [initialParam, isOpen]);

  // Live JSON validation for object/array
  const jsonStatus = useMemo(() => {
    if (valueType !== "object" && valueType !== "array") return { valid: true };
    return validateGovernedJson(value);
  }, [value, valueType]);

  if (!isOpen) return null;

  const handlePrettifyJson = () => {
    if (jsonStatus.valid && jsonStatus.parsed !== undefined) {
      setValue(JSON.stringify(jsonStatus.parsed, null, 2));
      setErrorMsg(null);
    } else {
      setErrorMsg(jsonStatus.error || "No se puede formatear JSON inválido.");
    }
  };

  const handleTypeChange = (newType: SupportedValueType) => {
    setValueType(newType);
    setErrorMsg(null);

    // Provide default valid templates when switching type on new parameter
    if (!initialParam) {
      if (newType === "boolean") {
        setValue("true");
        setUnit("bool");
      } else if (newType === "object") {
        setValue("{\n  \"factor\": 1.0\n}");
        setUnit("object");
      } else if (newType === "array") {
        setValue("[\n  1.0,\n  0.9\n]");
        setUnit("array");
      } else if (newType === "numeric") {
        setValue("1.0");
        setUnit("L/ha");
      } else {
        setValue("");
        setUnit("-");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre del parámetro o fórmula es obligatorio.");
      return;
    }
    if (!key.trim()) {
      setErrorMsg("La clave identificadora es obligatoria (ej. DIESEL_PRICE_USD).");
      return;
    }

    // Validate and parse value strictly according to valueType
    const parsed = parseGovernedInput(value, valueType);
    if (!parsed.success) {
      setErrorMsg(parsed.error || "El valor ingresado no es válido para el tipo seleccionado.");
      return;
    }

    const paramToSave: AgriculturalParameter = {
      id: initialParam?.id || `param-custom-${Date.now()}`,
      tenantId: initialParam?.tenantId || tenantId,
      name: name.trim(),
      key: key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      category,
      value: parsed.value,
      unit: unit.trim() || (valueType === "object" || valueType === "array" ? "object" : "-"),
      type: (initialParam?.type && initialParam.type !== "object" ? initialParam.type : valueType) as any,
      source: source.trim(),
      provenanceDoc: initialParam?.provenanceDoc || "Gestor Dinámico de Parámetros",
      version: initialParam?.version || "1.0.0",
      effectiveFrom: initialParam?.effectiveFrom || new Date().toISOString(),
      status: validationStatus as any,
      validationStatus,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(paramToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div
        className={`w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden transition-all my-8 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-100"
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-800"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide">
                {initialParam ? "Modificar Parámetro / Fórmula" : "Crear Nuevo Parámetro o Fórmula"}
              </h2>
              <p className="text-xs text-slate-400">
                Gobernanza de coeficientes escalares, booleanos y estructuras complejas JSON
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Nombre Descriptivo del Parámetro *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Precio Diésel B7 Puesto en Campo"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Clave Identificadora Única *
              </label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Ej. ECONOMIC_DIESEL_PRICE_USD"
                disabled={Boolean(initialParam)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                } ${initialParam ? "opacity-70 cursor-not-allowed" : ""}`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Categoría Agrícola *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AgroParameterCategory)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {CATEGORIES.map((cat) => (
                  <option key={`opt-cat-${cat.value}`} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Selector and Indicator */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <span>Tipo de Dato Gobernado</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {valueType === "numeric"
                      ? "Escalar Numérico"
                      : valueType === "boolean"
                      ? "Booleano (True/False)"
                      : valueType === "object"
                      ? "Objeto Estructurado JSON ({...})"
                      : valueType === "array"
                      ? "Lista / Array JSON ([...])"
                      : "Texto / String"}
                  </span>
                </label>

                {(valueType === "object" || valueType === "array") && (
                  <button
                    type="button"
                    onClick={handlePrettifyJson}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1 transition"
                    title="Formatear e indentar JSON"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span>Formatear JSON</span>
                  </button>
                )}
              </div>

              {/* Segmented type switcher */}
              <div className={`grid grid-cols-5 p-1 rounded-lg border text-xs text-center ${
                isLight ? "bg-slate-100 border-slate-300" : "bg-slate-950 border-slate-800"
              }`}>
                {(["numeric", "boolean", "object", "array", "text"] as SupportedValueType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    className={`py-1 rounded font-mono transition ${
                      valueType === t
                        ? "bg-amber-500 text-black font-bold shadow-xs"
                        : isLight
                        ? "text-slate-600 hover:text-slate-900"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {t === "numeric"
                      ? "Numérico"
                      : t === "boolean"
                      ? "Booleano"
                      : t === "object"
                      ? "Objeto"
                      : t === "array"
                      ? "Array"
                      : "Texto"}
                  </button>
                ))}
              </div>
            </div>

            {/* Value Editor based on valueType */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Valor Actual *
                </label>
                {(valueType === "object" || valueType === "array") && (
                  <span className={`text-[11px] font-mono flex items-center gap-1 ${
                    jsonStatus.valid ? "text-emerald-400" : "text-rose-400"
                  }`}>
                    {jsonStatus.valid ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Sintaxis JSON Válida</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>JSON Inválido</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {valueType === "boolean" ? (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setValue("true")}
                    className={`p-2.5 rounded-lg border font-mono font-bold text-sm transition flex items-center justify-center gap-2 ${
                      value === "true"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                        : isLight
                        ? "bg-slate-100 border-slate-300 text-slate-700"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>VERDADERO (true)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue("false")}
                    className={`p-2.5 rounded-lg border font-mono font-bold text-sm transition flex items-center justify-center gap-2 ${
                      value === "false"
                        ? "bg-rose-500/20 border-rose-500 text-rose-400"
                        : isLight
                        ? "bg-slate-100 border-slate-300 text-slate-700"
                        : "bg-slate-800 border-slate-700 text-slate-400"
                    }`}
                  >
                    <X className="w-4 h-4" />
                    <span>FALSO (false)</span>
                  </button>
                </div>
              ) : valueType === "object" || valueType === "array" ? (
                <div className="space-y-1.5">
                  <textarea
                    rows={8}
                    value={value}
                    onChange={(e) => {
                      setValue(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder={valueType === "object" ? '{\n  "param": 1.0\n}' : '[\n  1.0,\n  2.0\n]'}
                    className={`w-full p-3 rounded-lg border text-xs font-mono font-medium focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                      !jsonStatus.valid
                        ? "border-rose-500 bg-rose-950/20 text-rose-200"
                        : isLight
                        ? "bg-slate-50 border-slate-300 text-slate-900"
                        : "bg-slate-950 border-slate-700 text-emerald-300"
                    }`}
                    required
                  />
                  {!jsonStatus.valid && jsonStatus.error && (
                    <p className="text-[11px] font-mono text-rose-400">{jsonStatus.error}</p>
                  )}
                </div>
              ) : valueType === "numeric" ? (
                <input
                  type="number"
                  step="any"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Ej. 0.95"
                  className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                  }`}
                  required
                />
              ) : (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Texto o valor alfanumérico"
                  className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                    isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                  }`}
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Unidad de Medida
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ej. USD/L, t/ha, h, km/h, object"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Estado de Validación
              </label>
              <select
                value={validationStatus}
                onChange={(e) => setValidationStatus(e.target.value as ValidationStatus)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                <option value="CONFIRMADO">Confirmado (Validado por Agrónomo)</option>
                <option value="CONFIGURABLE">Configurable (Variable de Mercado/Operativa)</option>
                <option value="REQUIERE_VALIDACION">Requiere Validación en Campo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Fuente / Justificación
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Ej. Análisis de Costos Combustible Zafra"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Fórmula / Descripción de Uso Agronómico
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Explica la fórmula matemática o el impacto operacional de este parámetro en el cálculo agrícola."
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={(valueType === "object" || valueType === "array") && !jsonStatus.valid}
              className={`px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg ${
                (valueType === "object" || valueType === "array") && !jsonStatus.valid
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
                  : "bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20 cursor-pointer"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>Guardar Parámetro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
