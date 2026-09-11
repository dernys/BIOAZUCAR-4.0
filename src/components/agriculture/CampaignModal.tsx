import React, { useState, useEffect } from "react";
import { X, Calendar, Check, AlertCircle, Target, Factory } from "lucide-react";
import { AgriculturalCampaign } from "../../types/agriculture";

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (campaign: AgriculturalCampaign) => void;
  initialCampaign: AgriculturalCampaign;
  theme?: "dark" | "light";
}

export const CampaignModal: React.FC<CampaignModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialCampaign,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [name, setName] = useState(initialCampaign.name);
  const [startDate, setStartDate] = useState(initialCampaign.startDate);
  const [endDate, setEndDate] = useState(initialCampaign.endDate);
  const [effectiveHarvestDays, setEffectiveHarvestDays] = useState<number>(initialCampaign.effectiveHarvestDays);
  const [targetMillingTons, setTargetMillingTons] = useState<number>(initialCampaign.targetMillingTons);
  const [targetSugarTons, setTargetSugarTons] = useState<number>(initialCampaign.targetSugarTons);
  const [plannedRenovationRatePercent, setPlannedRenovationRatePercent] = useState<number>(
    initialCampaign.plannedRenovationRatePercent
  );
  const [status, setStatus] = useState<AgriculturalCampaign["status"]>(initialCampaign.status);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(initialCampaign.name);
    setStartDate(initialCampaign.startDate);
    setEndDate(initialCampaign.endDate);
    setEffectiveHarvestDays(initialCampaign.effectiveHarvestDays);
    setTargetMillingTons(initialCampaign.targetMillingTons);
    setTargetSugarTons(initialCampaign.targetSugarTons);
    setPlannedRenovationRatePercent(initialCampaign.plannedRenovationRatePercent);
    setStatus(initialCampaign.status);
    setErrorMsg(null);
  }, [initialCampaign, isOpen]);

  if (!isOpen) return null;

  const dailyDemand = effectiveHarvestDays > 0 ? targetMillingTons / effectiveHarvestDays : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("El nombre de la campaña o zafra es requerido.");
      return;
    }
    if (effectiveHarvestDays <= 0) {
      setErrorMsg("Los días efectivos de molienda deben ser mayores a 0.");
      return;
    }
    if (targetMillingTons <= 0) {
      setErrorMsg("La meta de molienda de caña debe ser mayor a 0.");
      return;
    }

    const updated: AgriculturalCampaign = {
      ...initialCampaign,
      name: name.trim(),
      startDate,
      endDate,
      effectiveHarvestDays: Number(effectiveHarvestDays),
      targetMillingTons: Number(targetMillingTons),
      targetSugarTons: Number(targetSugarTons),
      plannedRenovationRatePercent: Number(plannedRenovationRatePercent),
      status,
    };

    onSave(updated);
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
            <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide">
                Configuración de Campaña Agrícola / Zafra
              </h2>
              <p className="text-xs text-slate-400">
                Parámetros temporales, objetivos de molienda y tasa de renovación
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

        {/* Live Calculation Banner */}
        <div className={`p-4 mx-5 mt-5 rounded-xl border flex items-center justify-between text-xs md:text-sm ${
          isLight ? "bg-cyan-50 border-cyan-200 text-cyan-950" : "bg-cyan-950/30 border-cyan-500/30 text-cyan-200"
        }`}>
          <div className="flex items-center gap-2">
            <Factory className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold">Molienda Diaria Requerida:</span>
          </div>
          <div className="font-mono font-bold text-base text-cyan-400">
            {dailyDemand.toLocaleString(undefined, { maximumFractionDigits: 1 })} t/día
          </div>
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
                Nombre de la Campaña / Zafra *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Zafra 2026/2027"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Fecha Inicio Zafra
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Fecha Término Zafra
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Días Efectivos de Cosecha / Molienda *
              </label>
              <input
                type="number"
                step="1"
                min="10"
                value={effectiveHarvestDays}
                onChange={(e) => setEffectiveHarvestDays(parseInt(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Estado de la Campaña
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                <option value="EN_CURSO">En Curso (Zafra Activa)</option>
                <option value="PLANIFICACION">En Planificación Agrícola</option>
                <option value="FINALIZADA">Finalizada / Cerrada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Meta Molienda Caña Bruta (Toneladas) *
              </label>
              <input
                type="number"
                step="1000"
                min="1000"
                value={targetMillingTons}
                onChange={(e) => setTargetMillingTons(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Meta Azúcar Comercial (Toneladas) *
              </label>
              <input
                type="number"
                step="100"
                min="100"
                value={targetSugarTons}
                onChange={(e) => setTargetSugarTons(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Tasa Anual de Renovación de Cepas (%) *
              </label>
              <input
                type="number"
                step="0.5"
                min="5"
                max="50"
                value={plannedRenovationRatePercent}
                onChange={(e) => setPlannedRenovationRatePercent(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Define el porcentaje de área demolida y replantada anualmente para mantener el vigor vegetativo (Típico 15% - 20%).
              </span>
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
              className="px-5 py-2 rounded-xl text-sm font-bold bg-cyan-500 hover:bg-cyan-400 text-black flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
