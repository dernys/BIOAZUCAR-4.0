import React, { useState, useEffect } from "react";
import { X, Check, AlertCircle, Sliders, TrendingUp, DollarSign } from "lucide-react";
import { AgriculturalScenario } from "../../types/agriculture";

interface ScenarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scenario: AgriculturalScenario) => void;
  initialScenario?: AgriculturalScenario | null;
  currentCampaignId: string;
  theme?: "dark" | "light";
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialScenario,
  currentCampaignId,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [climateFactor, setClimateFactor] = useState<number>(1.0);
  const [dieselPriceUSD, setDieselPriceUSD] = useState<number>(0.95);
  const [sugarPriceUSDPerTon, setSugarPriceUSDPerTon] = useState<number>(450);
  const [avgTransportDistanceKm, setAvgTransportDistanceKm] = useState<number>(18.5);
  const [millingCapacityTcd, setMillingCapacityTcd] = useState<number>(7500);
  const [isBaseline, setIsBaseline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialScenario) {
      setName(initialScenario.name);
      setDescription(initialScenario.description || "");
      setClimateFactor(initialScenario.climateFactor);
      setDieselPriceUSD(initialScenario.dieselPriceUSD);
      setSugarPriceUSDPerTon(initialScenario.sugarPriceUSDPerTon);
      setAvgTransportDistanceKm(initialScenario.avgTransportDistanceKm);
      setMillingCapacityTcd(initialScenario.millingCapacityTcd);
      setIsBaseline(initialScenario.isBaseline);
    } else {
      setName("");
      setDescription("");
      setClimateFactor(1.0);
      setDieselPriceUSD(0.95);
      setSugarPriceUSDPerTon(450);
      setAvgTransportDistanceKm(18.5);
      setMillingCapacityTcd(7500);
      setIsBaseline(false);
    }
    setError(null);
  }, [initialScenario, isOpen]);

  if (!isOpen) return null;

  // Projected TCH & Cane Tons based on simulation formula: Baseline 80.25 t/ha * climateFactor
  const projectedTch = Number((80.25 * climateFactor).toFixed(2));
  const projectedProductionTons = Number((12500 * projectedTch).toFixed(0));
  const estimatedOpexTotalUSD = Number((projectedProductionTons * 24.5 * (dieselPriceUSD / 0.95)).toFixed(0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre descriptivo del escenario es requerido.");
      return;
    }

    const scenToSave: AgriculturalScenario = {
      id: initialScenario?.id || `scen-${Date.now()}`,
      tenantId: initialScenario?.tenantId || "TENANT_AZUCAR_01",
      campaignId: initialScenario?.campaignId || currentCampaignId,
      name: name.trim(),
      description: description.trim(),
      climateFactor,
      dieselPriceUSD,
      sugarPriceUSDPerTon,
      avgTransportDistanceKm,
      millingCapacityTcd,
      isBaseline,
      projectedTch,
      projectedProductionTons,
      estimatedOpexTotalUSD,
      updatedAt: new Date().toISOString(),
    };

    onSave(scenToSave);
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
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                {initialScenario ? "Configurar Escenario What-If" : "Nuevo Escenario de Simulación"}
              </h3>
              <p className="text-xs text-slate-400">
                Ajuste multivariante de clima, combustible, azúcar y transporte
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

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Nombre del Escenario
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Escenario Sequía Severa (-15% precipitaciones)"
              className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900"
                  : "bg-slate-800 border-slate-700 text-slate-100"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Hipótesis y Descripción
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa los supuestos de pluviometría, contingencias o inflación de costos..."
              className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden resize-none ${
                isLight
                  ? "bg-slate-50 border-slate-300 text-slate-900"
                  : "bg-slate-800 border-slate-700 text-slate-100"
              }`}
            />
          </div>

          {/* Sliders and inputs */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 space-y-4">
            <div>
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="font-semibold text-slate-300">Factor Climático / Pluviometría:</span>
                <span className={`font-mono font-bold ${climateFactor >= 1.0 ? "text-emerald-400" : "text-amber-400"}`}>
                  {climateFactor.toFixed(2)}x ({((climateFactor - 1.0) * 100).toFixed(0)}%)
                </span>
              </div>
              <input
                type="range"
                min="0.70"
                max="1.30"
                step="0.05"
                value={climateFactor}
                onChange={(e) => setClimateFactor(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>Sequía Severa (0.70x)</span>
                <span>Normal (1.00x)</span>
                <span>Zafra Húmeda / Riego Óptimo (1.30x)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Precio Diésel B-10 ($/L)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="3.0"
                  step="0.05"
                  value={dieselPriceUSD}
                  onChange={(e) => setDieselPriceUSD(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                    isLight
                      ? "bg-slate-50 border-slate-300 text-slate-900"
                      : "bg-slate-800 border-slate-700 text-slate-100"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Precio Azúcar Blanco ($/t)
                </label>
                <input
                  type="number"
                  min="200"
                  max="900"
                  value={sugarPriceUSDPerTon}
                  onChange={(e) => setSugarPriceUSDPerTon(Number(e.target.value))}
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
                  Distancia Media Transporte (km)
                </label>
                <input
                  type="number"
                  min="5"
                  max="60"
                  step="0.5"
                  value={avgTransportDistanceKm}
                  onChange={(e) => setAvgTransportDistanceKm(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                    isLight
                      ? "bg-slate-50 border-slate-300 text-slate-900"
                      : "bg-slate-800 border-slate-700 text-slate-100"
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Ritmo Molienda Fabril (TCD)
                </label>
                <input
                  type="number"
                  min="3000"
                  max="15000"
                  step="100"
                  value={millingCapacityTcd}
                  onChange={(e) => setMillingCapacityTcd(Number(e.target.value))}
                  className={`w-full px-3 py-2 text-xs rounded-lg border outline-hidden ${
                    isLight
                      ? "bg-slate-50 border-slate-300 text-slate-900"
                      : "bg-slate-800 border-slate-700 text-slate-100"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Real-Time Preview Impact */}
          <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-xs space-y-1">
            <span className="font-semibold text-sky-400 block">Proyección Resultante:</span>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <span className="text-slate-400 block">TCH Proyectado:</span>
                <span className="font-mono font-bold text-slate-200">{projectedTch} t/ha</span>
              </div>
              <div>
                <span className="text-slate-400 block">Biomasa Caña:</span>
                <span className="font-mono font-bold text-slate-200">{projectedProductionTons.toLocaleString()} t</span>
              </div>
              <div>
                <span className="text-slate-400 block">OPEX Proyectado:</span>
                <span className="font-mono font-bold text-slate-200">${(estimatedOpexTotalUSD / 1000000).toFixed(2)}M</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isBaselineCheckbox"
              checked={isBaseline}
              onChange={(e) => setIsBaseline(e.target.checked)}
              className="rounded-sm border-slate-700 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="isBaselineCheckbox" className="text-xs text-slate-300">
              Establecer como Escenario Base / Plan Oficial de Campaña
            </label>
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
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-md transition"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Escenario de Simulación</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
