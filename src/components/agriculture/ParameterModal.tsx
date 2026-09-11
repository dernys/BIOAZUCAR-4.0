import React, { useState, useEffect } from "react";
import { X, Sliders, Check, AlertCircle, Sparkles } from "lucide-react";
import { AgriculturalParameter, AgroParameterCategory, ValidationStatus } from "../../types/agriculture";

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
      setValue(
        typeof initialParam.value === "object"
          ? JSON.stringify(initialParam.value, null, 2)
          : String(initialParam.value)
      );
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
      setValue("1.0");
      setUnit("L/ha");
      setSource("Calibración Agronómica Local");
      setDescription("");
      setNotes("");
      setValidationStatus("CONFIRMADO");
    }
    setErrorMsg(null);
  }, [initialParam, isOpen]);

  if (!isOpen) return null;

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

    // Try parsing value as number, boolean or object if applicable
    let parsedValue: any = value;
    if (value === "true") parsedValue = true;
    else if (value === "false") parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== "") parsedValue = Number(value);
    else if (value.startsWith("{") || value.startsWith("[")) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        setErrorMsg("El valor JSON ingresado no es válido.");
        return;
      }
    }

    const paramToSave: AgriculturalParameter = {
      id: initialParam?.id || `param-custom-${Date.now()}`,
      tenantId: initialParam?.tenantId || tenantId,
      name: name.trim(),
      key: key.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_"),
      category,
      value: parsedValue,
      unit: unit.trim() || "-",
      source: source.trim(),
      provenanceDoc: "Gestor Dinámico de Parámetros",
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
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden transition-all my-8 ${
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
                Ajuste dinámico de coeficientes, rendimientos mecánicos y precios
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

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Valor Actual *
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ej. 0.95"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-amber-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Unidad de Medida
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ej. USD/L, t/ha, h, km/h"
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

            <div>
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
              className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20"
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
