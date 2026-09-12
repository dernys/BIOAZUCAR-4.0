import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, Sparkles, Sprout, DollarSign } from "lucide-react";
import { AgriculturalInputMaster } from "../../types/agriculture";

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: AgriculturalInputMaster) => void;
  initialInput?: AgriculturalInputMaster | null;
  theme?: "dark" | "light";
}

export const InputModal: React.FC<InputModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialInput,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AgriculturalInputMaster["category"]>("FERTILIZANTE");
  const [standardDose, setStandardDose] = useState<number>(350);
  const [unit, setUnit] = useState("kg/ha");
  const [unitCostUSD, setUnitCostUSD] = useState<number>(0.72);
  const [targetCycle, setTargetCycle] = useState<AgriculturalInputMaster["targetCycle"]>("SOCA_RETONO");
  const [activeIngredient, setActiveIngredient] = useState("");
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState<"ACTIVO" | "ARCHIVADO">("ACTIVO");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialInput) {
      setCode(initialInput.code);
      setName(initialInput.name);
      setCategory(initialInput.category);
      setStandardDose(initialInput.standardDosePerHa);
      setUnit(initialInput.unit);
      setUnitCostUSD(initialInput.unitCostUSD);
      setTargetCycle(initialInput.targetCycle);
      setActiveIngredient(initialInput.activeIngredient || "");
      setSupplier(initialInput.supplier || "");
      setStatus(initialInput.status || "ACTIVO");
    } else {
      setCode(`INS-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setCategory("FERTILIZANTE");
      setStandardDose(300);
      setUnit("kg/ha");
      setUnitCostUSD(0.65);
      setTargetCycle("AMBOS");
      setActiveIngredient("");
      setSupplier("");
      setStatus("ACTIVO");
    }
    setError(null);
  }, [initialInput, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("El código del insumo es requerido.");
      return;
    }
    if (!name.trim()) {
      setError("El nombre comercial o fórmula del producto es requerido.");
      return;
    }
    if (standardDose <= 0) {
      setError("La dosis estándar debe ser mayor a 0.");
      return;
    }

    const inputToSave: AgriculturalInputMaster = {
      id: initialInput?.id || `input-${code.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      tenantId: initialInput?.tenantId || "TENANT_AZUCAR_01",
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      standardDosePerHa: standardDose,
      unit: unit.trim(),
      unitCostUSD,
      targetCycle,
      activeIngredient: activeIngredient.trim() || undefined,
      supplier: supplier.trim() || undefined,
      status,
      updatedAt: new Date().toISOString(),
    };

    onSave(inputToSave);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-950"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialInput ? "Calibrar Insumo Agrícola" : "Registrar Insumo / Enmienda"}
              </h3>
              <p className="text-xs text-slate-400">
                Catálogo de formulaciones, dosis por hectárea y costes unitarios
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Código Insumo
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ej. FERT-NPK-01"
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden font-mono ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Categoría Agronómica
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AgriculturalInputMaster["category"])}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="FERTILIZANTE">Fertilizante Químico / Mineral</option>
                <option value="HERBICIDA">Herbicida Pre/Post-emergente</option>
                <option value="MADURADOR">Madurador Fisiológico</option>
                <option value="SUBPRODUCTO_FABRIL">Subproducto Fabril (Vinaza / Cachaza)</option>
                <option value="ENMIENDA">Enmienda Cálcica / Yeso</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre Comercial / Fórmula
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. NPK 18-06-18 Granulado"
              className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900"
                  : "bg-slate-800 border-slate-700 text-slate-100"
              }`}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Dosis Estándar
              </label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={standardDose}
                onChange={(e) => setStandardDose(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Unidad
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="kg/ha, L/ha, m³/ha"
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Coste Unitario ($ USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCostUSD}
                onChange={(e) => setUnitCostUSD(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Etapa Agronómica Destino
              </label>
              <select
                value={targetCycle}
                onChange={(e) => setTargetCycle(e.target.value as AgriculturalInputMaster["targetCycle"])}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="PLANTA">Exclusivo Caña Planta</option>
                <option value="SOCA_RETONO">Exclusivo Socas / Retoños</option>
                <option value="AMBOS">Ambos Ciclos (Planta y Soca)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVO" | "ARCHIVADO")}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="ACTIVO">ACTIVO EN PLANIFICACIÓN</option>
                <option value="ARCHIVADO">ARCHIVADO / DESCATALOGADO</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Ingrediente Activo / Composición
              </label>
              <input
                type="text"
                value={activeIngredient}
                onChange={(e) => setActiveIngredient(e.target.value)}
                placeholder="ej. Glifosato 480 g/L, N 18%"
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Proveedor / Origen
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="ej. Fabril Interno, Yara, Syngenta"
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div
            className={`pt-4 border-t flex items-center justify-end gap-3 ${
              isLight ? "border-slate-200" : "border-slate-800"
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold rounded-lg border transition ${
                isLight
                  ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Insumo Agrícola</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
