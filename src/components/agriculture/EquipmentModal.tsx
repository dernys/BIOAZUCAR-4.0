import React, { useState, useEffect } from "react";
import { X, Wrench, Check, AlertCircle, ShieldCheck, Truck } from "lucide-react";
import { AgriculturalEquipmentAsset, EquipmentCategory } from "../../types/agriculture";

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (asset: AgriculturalEquipmentAsset) => void;
  initialAsset?: AgriculturalEquipmentAsset | null;
  theme?: "dark" | "light";
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAsset,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EquipmentCategory>("TRACTOR_PULL");
  const [modelYear, setModelYear] = useState<number>(2022);
  const [engineHp, setEngineHp] = useState<number>(210);
  const [payloadTons, setPayloadTons] = useState<number>(0);
  const [mechanicalAvailability, setMechanicalAvailability] = useState<number>(88);
  const [fuelRate, setFuelRate] = useState<number>(22.5);
  const [status, setStatus] = useState<AgriculturalEquipmentAsset["status"]>("OPERATIONAL");
  const [accumulatedHours, setAccumulatedHours] = useState<number>(1850);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAsset) {
      setCode(initialAsset.code);
      setName(initialAsset.name);
      setCategory(initialAsset.category);
      setModelYear(initialAsset.modelYear || 2022);
      setEngineHp(initialAsset.engineHp || 210);
      setPayloadTons(initialAsset.payloadCapacityTons || 0);
      setMechanicalAvailability(initialAsset.mechanicalAvailabilityPercent || 88);
      setFuelRate(initialAsset.hourlyFuelConsumptionLiters || 22.5);
      setStatus(initialAsset.status || "OPERATIONAL");
      setAccumulatedHours(initialAsset.accumulatedEngineHours || 1850);
      setNotes(initialAsset.notes || "");
    } else {
      setCode(`EQ-${Math.floor(100 + Math.random() * 900)}`);
      setName("");
      setCategory("TRACTOR_PULL");
      setModelYear(2023);
      setEngineHp(210);
      setPayloadTons(0);
      setMechanicalAvailability(90);
      setFuelRate(22.0);
      setStatus("OPERATIONAL");
      setAccumulatedHours(800);
      setNotes("");
    }
    setError(null);
  }, [initialAsset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("El código del activo de maquinaria es obligatorio.");
      return;
    }
    if (!name.trim()) {
      setError("La descripción o modelo del equipo es obligatoria.");
      return;
    }

    const assetToSave: AgriculturalEquipmentAsset = {
      id: initialAsset?.id || `eq-${code.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
      tenantId: initialAsset?.tenantId || "TENANT_AZUCAR_01",
      code: code.trim().toUpperCase(),
      name: name.trim(),
      category,
      modelYear,
      engineHp,
      payloadCapacityTons: payloadTons > 0 ? payloadTons : undefined,
      mechanicalAvailabilityPercent: mechanicalAvailability,
      hourlyFuelConsumptionLiters: fuelRate,
      status,
      accumulatedEngineHours: accumulatedHours,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    onSave(assetToSave);
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
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialAsset ? "Editar Activo Mecanizado" : "Registrar Maquinaria Agrícola"}
              </h3>
              <p className="text-xs text-slate-400">
                Ficha de parque de tracción, cosechadoras y transporte CCT
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
                Código Activo
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ej. TR-01, HARV-02"
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
                onChange={(e) => setCategory(e.target.value as EquipmentCategory)}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="TRACTOR_PULL">Tractor de Preparación / Tiro</option>
                <option value="TRACTOR_CULTIVATION">Tractor de Tratos / Cultivo</option>
                <option value="HARVESTER">Cosechadora Combinada de Caña</option>
                <option value="INFIELD_TRANSLOADER">Transbordo Autovolcable</option>
                <option value="ROAD_TRUCK">Camión de Carretera (CCT)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre / Modelo del Activo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. John Deere 8430 - 225 HP"
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
                Potencia (HP)
              </label>
              <input
                type="number"
                min="50"
                max="800"
                value={engineHp}
                onChange={(e) => setEngineHp(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Año de Fabricación
              </label>
              <input
                type="number"
                min="1990"
                max="2030"
                value={modelYear}
                onChange={(e) => setModelYear(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Capacidad Carga (t)
              </label>
              <input
                type="number"
                min="0"
                max="80"
                step="0.5"
                value={payloadTons}
                onChange={(e) => setPayloadTons(Number(e.target.value))}
                placeholder="Opcional"
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
                Disp. Mecánica (%)
              </label>
              <input
                type="number"
                min="40"
                max="100"
                value={mechanicalAvailability}
                onChange={(e) => setMechanicalAvailability(Number(e.target.value))}
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
                min="5"
                max="100"
                step="0.5"
                value={fuelRate}
                onChange={(e) => setFuelRate(Number(e.target.value))}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Horómetro Acumulado
              </label>
              <input
                type="number"
                min="0"
                value={accumulatedHours}
                onChange={(e) => setAccumulatedHours(Number(e.target.value))}
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
                Estado Operacional
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AgriculturalEquipmentAsset["status"])}
                className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                  isLight
                    ? "bg-slate-50 border-slate-300 text-slate-900"
                    : "bg-slate-800 border-slate-700 text-slate-100"
                }`}
              >
                <option value="OPERATIONAL">OPERATIVO EN CAMPO</option>
                <option value="MAINTENANCE">EN TALLER / MANTENIMIENTO</option>
                <option value="RESERVE">EN RESERVA ESTRATÉGICA</option>
                <option value="ARCHIVED">DESINCORPORADO / BAJA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Observaciones / Mantenimiento
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ej. Service preventivo a 2000h"
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
              <span>Guardar Ficha de Maquinaria</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
