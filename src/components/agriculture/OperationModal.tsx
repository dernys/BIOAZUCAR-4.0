import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, Cpu, Fuel, Clock } from "lucide-react";
import { AgroOperationMaster } from "../../types/agriculture";

interface OperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (operation: AgroOperationMaster) => void;
  initialOperation?: AgroOperationMaster | null;
  theme?: "dark" | "light";
}

export const OperationModal: React.FC<OperationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOperation,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AgroOperationMaster["category"]>("PREPARO_SOLO");
  const [tractorHp, setTractorHp] = useState<number>(180);
  const [implement, setImplement] = useState("");
  const [capacity, setCapacity] = useState<number>(0.65);
  const [fuelPerHour, setFuelPerHour] = useState<number>(21.0);
  const [targetCycle, setTargetCycle] = useState<AgroOperationMaster["targetCycle"]>("PRE_PLANTIO");
  const [operatorCount, setOperatorCount] = useState<number>(1);
  const [status, setStatus] = useState<"ACTIVO" | "ARCHIVADO">("ACTIVO");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOperation) {
      setId(initialOperation.id);
      setName(initialOperation.name);
      setCategory(initialOperation.category);
      setTractorHp(initialOperation.standardTractorPowerHp);
      setImplement(initialOperation.standardImplement);
      setCapacity(initialOperation.effectiveCapacityHaPerHour);
      setFuelPerHour(initialOperation.fuelConsumptionLitersPerHour);
      setTargetCycle(initialOperation.targetCycle);
      setOperatorCount(initialOperation.operatorCount);
      setStatus(initialOperation.status || "ACTIVO");
    } else {
      setId(`OP-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setCategory("PREPARO_SOLO");
      setTractorHp(180);
      setImplement("");
      setCapacity(0.70);
      setFuelPerHour(20.0);
      setTargetCycle("PRE_PLANTIO");
      setOperatorCount(1);
      setStatus("ACTIVO");
    }
    setError(null);
  }, [initialOperation, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("La denominación de la labor es obligatoria.");
      return;
    }
    if (!implement.trim()) {
      setError("El implemento o apero agrícola estándar es obligatorio.");
      return;
    }
    if (capacity <= 0) {
      setError("La capacidad efectiva (ha/hora) debe ser mayor a cero.");
      return;
    }

    const opToSave: AgroOperationMaster = {
      id: initialOperation?.id || id.trim().toUpperCase(),
      tenantId: initialOperation?.tenantId || "TENANT_AZUCAR_01",
      category,
      name: name.trim(),
      standardTractorPowerHp: tractorHp,
      standardImplement: implement.trim(),
      effectiveCapacityHaPerHour: capacity,
      fuelConsumptionLitersPerHour: fuelPerHour,
      targetCycle,
      operatorCount,
      status,
    };

    onSave(opToSave);
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
            <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialOperation ? "Editar Operación Agrícola" : "Registrar Labor Mecanizada"}
              </h3>
              <p className="text-xs text-slate-400">
                Rendimiento de campo, consumo diésel e implemento requerido
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
                ID Labor / Código
              </label>
              <input
                type="text"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="ej. OP-PS-05"
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden font-mono ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Categoría Operacional
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AgroOperationMaster["category"])}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="PREPARO_SOLO">Preparación de Suelo</option>
                <option value="PLANTIO">Plantación / Siembra</option>
                <option value="TRATO_PLANTA">Tratamiento Caña Planta</option>
                <option value="TRATO_SOCA">Tratamiento Soca / Retoño</option>
                <option value="COLHEITA">Cosecha & Carga</option>
                <option value="TRANSPORTE">Transporte Rodoviario</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre de la Labor Agrícola
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Nivelación y Conformación de Tablones"
              className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900"
                  : "bg-slate-800 border-slate-700 text-slate-100"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Implemento / Apero Estándar
            </label>
            <input
              type="text"
              value={implement}
              onChange={(e) => setImplement(e.target.value)}
              placeholder="ej. Pala Lámina Láser Niveladora 4.5m"
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
                Potencia Tractor (HP)
              </label>
              <input
                type="number"
                min="50"
                max="600"
                value={tractorHp}
                onChange={(e) => setTractorHp(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Capacidad (ha/hora)
              </label>
              <input
                type="number"
                min="0.05"
                max="10"
                step="0.05"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Diésel (L/hora)
              </label>
              <input
                type="number"
                min="3"
                max="80"
                step="0.5"
                value={fuelPerHour}
                onChange={(e) => setFuelPerHour(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Ciclo Aplicable
              </label>
              <select
                value={targetCycle}
                onChange={(e) => setTargetCycle(e.target.value as AgroOperationMaster["targetCycle"])}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="PRE_PLANTIO">Pre-Plantación (Suelo)</option>
                <option value="PLANTIO">Siembra Directa</option>
                <option value="POS_PLANTIO">Post-Plantación (Tratos)</option>
                <option value="SOCAS">Socas y Retoños</option>
                <option value="SAFRA">Período de Zafra</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Operadores / Turno
              </label>
              <input
                type="number"
                min="1"
                max="5"
                value={operatorCount}
                onChange={(e) => setOperatorCount(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
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
                <option value="ACTIVO">ACTIVA</option>
                <option value="ARCHIVADO">ARCHIVADA</option>
              </select>
            </div>
          </div>

          {/* Productivity info */}
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-center justify-between">
            <span className="text-slate-400">Consumo Específico por Hectárea:</span>
            <span className="font-mono font-bold text-indigo-300">
              {capacity > 0 ? (fuelPerHour / capacity).toFixed(2) : "0.00"} L/ha
            </span>
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Labor Mecanizada</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
