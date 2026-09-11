import React, { useState, useEffect } from "react";
import { X, MapPin, Sprout, Layers, Scale, Calendar, AlertCircle, Check } from "lucide-react";
import { FieldPlot, CaneGrowthStage, SoilType, CaneVarietyYieldMaster, FieldPlotStatus } from "../../types/agriculture";

interface PlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (plot: FieldPlot) => void;
  initialPlot?: FieldPlot | null;
  availableVarieties?: CaneVarietyYieldMaster[];
  varieties?: CaneVarietyYieldMaster[];
  theme?: "dark" | "light";
  tenantId?: string;
}

const STAGES: { value: CaneGrowthStage; label: string }[] = [
  { value: "PLANTA", label: "Caña Planta (12-16 meses)" },
  { value: "SOCA", label: "Soca 1 (Primer corte)" },
  { value: "RETONO_Q2", label: "Retoño 2 (Segundo corte)" },
  { value: "RETONO_Q3", label: "Retoño 3 (Tercer corte)" },
  { value: "RETONO_Q4", label: "Retoño 4 (Cuarto corte)" },
  { value: "RETONO_Q5", label: "Retoño 5 (Quinto corte)" },
  { value: "RETONO_Q6", label: "Retoño 6 (Sexto corte)" },
  { value: "RETONO_Q7_PLUS", label: "Retoño 7+ (Séptimo corte o más)" },
  { value: "DEMOLICION", label: "Demolición / Renovación programada" },
];

const SOILS: { value: SoilType; label: string }[] = [
  { value: "FRANCO", label: "Franco (Suelo ideal, factor 1.00)" },
  { value: "ARCILLOSO", label: "Arcilloso (Pesado, retentivo, factor 0.98)" },
  { value: "ARENOSO", label: "Arenoso (Ligero, permeable, factor 0.92)" },
];

const STATUSES: { value: FieldPlotStatus; label: string; color: string }[] = [
  { value: "VEGETACION", label: "En Vegetación (Crecimiento Activo)", color: "text-emerald-400" },
  { value: "MADURACION", label: "En Maduración (Fase Pre-Cosecha)", color: "text-amber-400" },
  { value: "COSECHADO", label: "Cosechado (En Molienda / Rebrote)", color: "text-blue-400" },
  { value: "EN_PREPARACION", label: "En Preparación de Suelo / Renovación", color: "text-purple-400" },
  { value: "PLANTADO", label: "Plantado Reciente", color: "text-teal-400" },
];

export const PlotModal: React.FC<PlotModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPlot,
  availableVarieties,
  varieties,
  theme = "dark",
  tenantId = "BIOAZUCAR-DEMO",
}) => {
  const isLight = theme === "light";
  const allVarieties = (availableVarieties && availableVarieties.length > 0)
    ? availableVarieties
    : (varieties && varieties.length > 0)
      ? varieties
      : [];

  const [code, setCode] = useState("");
  const [uebName, setUebName] = useState("UEB Central Azucarero");
  const [areaHectares, setAreaHectares] = useState<number>(45.0);
  const [varietyCode, setVarietyCode] = useState("");
  const [currentStage, setCurrentStage] = useState<CaneGrowthStage>("PLANTA");
  const [soilType, setSoilType] = useState<SoilType>("FRANCO");
  const [distanceToMillKm, setDistanceToMillKm] = useState<number>(18.0);
  const [historicalAverageTch, setHistoricalAverageTch] = useState<number>(95.0);
  const [status, setStatus] = useState<FieldPlotStatus>("VEGETACION");
  const [scheduledHarvestMonth, setScheduledHarvestMonth] = useState<number>(3);
  const [ratoonAgeYears, setRatoonAgeYears] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPlot) {
      setCode(initialPlot.code);
      setUebName(initialPlot.uebName || "UEB Central Azucarero");
      setAreaHectares(initialPlot.areaHectares);
      setVarietyCode(initialPlot.varietyCode);
      setCurrentStage(initialPlot.currentStage);
      setSoilType(initialPlot.soilType);
      setDistanceToMillKm(initialPlot.distanceToMillKm);
      setHistoricalAverageTch(initialPlot.historicalAverageTch);
      setStatus(initialPlot.status);
      setScheduledHarvestMonth(initialPlot.scheduledHarvestMonth || 3);
      setRatoonAgeYears(initialPlot.ratoonAgeYears || 1);
    } else {
      setCode(`LOTE-${Math.floor(100 + Math.random() * 900)}`);
      setUebName("UEB Central Azucarero");
      setAreaHectares(45.0);
      setVarietyCode(allVarieties[0]?.varietyCode || "RB86-7515");
      setCurrentStage("PLANTA");
      setSoilType("FRANCO");
      setDistanceToMillKm(18.0);
      setHistoricalAverageTch(95.0);
      setStatus("VEGETACION");
      setScheduledHarvestMonth(3);
      setRatoonAgeYears(1);
    }
    setErrorMsg(null);
  }, [initialPlot, isOpen, allVarieties]);

  if (!isOpen) return null;

  // Real-time calculation of expected yield
  const selectedVarietyObj = availableVarieties.find((v) => v.varietyCode === varietyCode);
  const baseTch = selectedVarietyObj?.baseYieldTch || historicalAverageTch || 90;
  const decayRatio = selectedVarietyObj?.ratoonDecayFactors?.[currentStage] ?? 1.0;
  const soilRatio = soilType === "FRANCO" ? 1.0 : soilType === "ARCILLOSO" ? 0.98 : 0.92;
  const calculatedTch = Number((baseTch * decayRatio * soilRatio).toFixed(1));
  const estimatedTons = Number((areaHectares * calculatedTch).toFixed(1));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg("El código de la parcela o lote es obligatorio.");
      return;
    }
    if (areaHectares <= 0 || isNaN(areaHectares)) {
      setErrorMsg("El área debe ser mayor que 0 hectáreas.");
      return;
    }
    if (distanceToMillKm < 0 || isNaN(distanceToMillKm)) {
      setErrorMsg("La distancia al central no puede ser negativa.");
      return;
    }

    const plotToSave: FieldPlot = {
      id: initialPlot?.id || `plot-${code.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`,
      tenantId: initialPlot?.tenantId || tenantId,
      code: code.trim().toUpperCase(),
      uebName: uebName.trim(),
      areaHectares: Number(areaHectares),
      varietyCode,
      currentStage,
      ratoonAgeYears: Number(ratoonAgeYears),
      soilType,
      distanceToMillKm: Number(distanceToMillKm),
      historicalAverageTch: Number(historicalAverageTch),
      projectedTch: calculatedTch,
      projectedTotalCaneTons: estimatedTons,
      scheduledHarvestMonth: Number(scheduledHarvestMonth),
      status,
    };

    onSave(plotToSave);
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
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide">
                {initialPlot ? "Editar Parcela / Lote Agrícola" : "Añadir Nueva Parcela / Lote"}
              </h2>
              <p className="text-xs text-slate-400">
                Gestión de Catastro de Campo, Variedad y Proyección de Rendimiento
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

        {/* Live Calculation Preview Banner */}
        <div className={`p-4 mx-5 mt-5 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-sm ${
          isLight ? "bg-emerald-50/70 border-emerald-200 text-emerald-950" : "bg-emerald-950/30 border-emerald-500/30 text-emerald-200"
        }`}>
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">Proyección Dinámica:</span>
          </div>
          <div className="flex items-center gap-4 text-xs md:text-sm font-mono">
            <div>
              <span className="text-slate-400 block text-[10px]">TCH Estimado</span>
              <span className="font-bold text-emerald-400">{calculatedTch} t/ha</span>
            </div>
            <div className="h-6 w-px bg-emerald-500/30" />
            <div>
              <span className="text-slate-400 block text-[10px]">Producción Total</span>
              <span className="font-bold text-emerald-300">{estimatedTons.toLocaleString()} t caña</span>
            </div>
            <div className="h-6 w-px bg-emerald-500/30" />
            <div>
              <span className="text-slate-400 block text-[10px]">Factor Cepa / Suelo</span>
              <span>{(decayRatio * soilRatio).toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Código de Lote */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Código del Lote *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej. LOTE-011"
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            {/* División / UEB */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                División / UEB *
              </label>
              <input
                type="text"
                value={uebName}
                onChange={(e) => setUebName(e.target.value)}
                placeholder="Ej. UEB Héctor Molina"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            {/* Área en Hectáreas */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Área (Hectáreas) *
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={areaHectares}
                onChange={(e) => setAreaHectares(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            {/* Variedad de Caña */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Variedad de Caña *
              </label>
              <select
                value={varietyCode}
                onChange={(e) => setVarietyCode(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {allVarieties.map((v) => (
                  <option key={`opt-var-${v.varietyCode}`} value={v.varietyCode}>
                    {v.varietyCode} — {v.name} ({v.baseYieldTch} t/ha base)
                  </option>
                ))}
              </select>
            </div>

            {/* Etapa del Ciclo Vegetativo */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Etapa del Ciclo Vegetativo *
              </label>
              <select
                value={currentStage}
                onChange={(e) => setCurrentStage(e.target.value as CaneGrowthStage)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {STAGES.map((s) => (
                  <option key={`opt-stage-${s.value}`} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tipo de Suelo */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Tipo de Suelo *
              </label>
              <select
                value={soilType}
                onChange={(e) => setSoilType(e.target.value as SoilType)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {SOILS.map((soil) => (
                  <option key={`opt-soil-${soil.value}`} value={soil.value}>
                    {soil.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Distancia al Central (km) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Distancia al Central (km) *
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={distanceToMillKm}
                onChange={(e) => setDistanceToMillKm(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            {/* TCH Histórico */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                TCH Histórico de Parcela (t/ha)
              </label>
              <input
                type="number"
                step="1"
                min="10"
                value={historicalAverageTch}
                onChange={(e) => setHistoricalAverageTch(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            {/* Estado Operativo */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Estado de la Parcela
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as FieldPlotStatus)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {STATUSES.map((st) => (
                  <option key={`opt-status-${st.value}`} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Mes de Cosecha Programado */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Mes Programado de Corte (1-12) *
              </label>
              <select
                value={scheduledHarvestMonth}
                onChange={(e) => setScheduledHarvestMonth(parseInt(e.target.value, 10) || 1)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                {[
                  { m: 1, name: "Enero" },
                  { m: 2, name: "Febrero" },
                  { m: 3, name: "Marzo" },
                  { m: 4, name: "Abril" },
                  { m: 5, name: "Mayo" },
                  { m: 6, name: "Junio" },
                  { m: 7, name: "Julio" },
                  { m: 8, name: "Agosto" },
                  { m: 9, name: "Septiembre" },
                  { m: 10, name: "Octubre" },
                  { m: 11, name: "Noviembre" },
                  { m: 12, name: "Diciembre" },
                ].map((item) => (
                  <option key={`month-${item.m}`} value={item.m}>
                    Mes {item.m} — {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Edad Cronológica de la Cepa */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Edad de la Cepa (Años)
              </label>
              <input
                type="number"
                min="0"
                max="15"
                step="1"
                value={ratoonAgeYears}
                onChange={(e) => setRatoonAgeYears(parseInt(e.target.value, 10) || 1)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>
          </div>

          {/* Modal Actions */}
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
              className="px-5 py-2 rounded-xl text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
            >
              <Check className="w-4 h-4" />
              <span>{initialPlot ? "Guardar Cambios" : "Crear Parcela"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
