import React, { useState, useEffect } from "react";
import { X, Sprout, TrendingDown, Check, AlertCircle } from "lucide-react";
import { CaneVarietyYieldMaster, CaneGrowthStage } from "../../types/agriculture";

interface VarietyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (variety: CaneVarietyYieldMaster) => void;
  initialVariety?: CaneVarietyYieldMaster | null;
  theme?: "dark" | "light";
}

export const VarietyModal: React.FC<VarietyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialVariety,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  const [varietyCode, setVarietyCode] = useState("");
  const [name, setName] = useState("");
  const [cycleLengthMonths, setCycleLengthMonths] = useState<number>(14);
  const [baseYieldTch, setBaseYieldTch] = useState<number>(105.0);
  const [polPercent, setPolPercent] = useState<number>(14.5);
  const [fiberPercent, setFiberPercent] = useState<number>(12.5);
  const [purityPercent, setPurityPercent] = useState<number>(88.0);
  const [maturity, setMaturity] = useState<"TEMPRANA" | "MEDIA" | "TARDIA">("MEDIA");

  // Ratoon decay factors
  const [decayPlanta, setDecayPlanta] = useState<number>(1.0);
  const [decaySoca, setDecaySoca] = useState<number>(0.90);
  const [decayQ2, setDecayQ2] = useState<number>(0.83);
  const [decayQ3, setDecayQ3] = useState<number>(0.77);
  const [decayQ4, setDecayQ4] = useState<number>(0.70);
  const [decayQ5, setDecayQ5] = useState<number>(0.62);
  const [decayQ6, setDecayQ6] = useState<number>(0.56);
  const [decayQ7Plus, setDecayQ7Plus] = useState<number>(0.50);
  const [decayDemolicion, setDecayDemolicion] = useState<number>(0.45);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialVariety) {
      setVarietyCode(initialVariety.varietyCode);
      setName(initialVariety.name);
      setCycleLengthMonths(initialVariety.cycleLengthMonths);
      setBaseYieldTch(initialVariety.baseYieldTch);
      setPolPercent(initialVariety.polPercent);
      setFiberPercent(initialVariety.fiberPercent);
      setPurityPercent(initialVariety.purityPercent);
      setMaturity(initialVariety.maturity);

      const f = initialVariety.ratoonDecayFactors || ({} as any);
      setDecayPlanta(f.PLANTA ?? 1.0);
      setDecaySoca(f.SOCA ?? 0.90);
      setDecayQ2(f.RETONO_Q2 ?? 0.83);
      setDecayQ3(f.RETONO_Q3 ?? 0.77);
      setDecayQ4(f.RETONO_Q4 ?? 0.70);
      setDecayQ5(f.RETONO_Q5 ?? 0.62);
      setDecayQ6(f.RETONO_Q6 ?? 0.56);
      setDecayQ7Plus(f.RETONO_Q7_PLUS ?? 0.50);
      setDecayDemolicion(f.DEMOLICION ?? 0.45);
    } else {
      setVarietyCode("");
      setName("");
      setCycleLengthMonths(14);
      setBaseYieldTch(105.0);
      setPolPercent(14.5);
      setFiberPercent(12.5);
      setPurityPercent(88.0);
      setMaturity("MEDIA");

      setDecayPlanta(1.0);
      setDecaySoca(0.90);
      setDecayQ2(0.83);
      setDecayQ3(0.77);
      setDecayQ4(0.70);
      setDecayQ5(0.62);
      setDecayQ6(0.56);
      setDecayQ7Plus(0.50);
      setDecayDemolicion(0.45);
    }
    setErrorMsg(null);
  }, [initialVariety, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!varietyCode.trim()) {
      setErrorMsg("El código de la variedad es obligatorio (ej. RB86-7515 o C86-12).");
      return;
    }
    if (!name.trim()) {
      setErrorMsg("El nombre de la variedad es obligatorio.");
      return;
    }
    if (baseYieldTch <= 0) {
      setErrorMsg("El TCH base debe ser mayor que 0.");
      return;
    }

    const decayMap: Record<CaneGrowthStage, number> = {
      PLANTA: Number(decayPlanta),
      SOCA: Number(decaySoca),
      RETONO_Q2: Number(decayQ2),
      RETONO_Q3: Number(decayQ3),
      RETONO_Q4: Number(decayQ4),
      RETONO_Q5: Number(decayQ5),
      RETONO_Q6: Number(decayQ6),
      RETONO_Q7_PLUS: Number(decayQ7Plus),
      DEMOLICION: Number(decayDemolicion),
    };

    const varietyToSave: CaneVarietyYieldMaster = {
      varietyCode: varietyCode.trim().toUpperCase(),
      name: name.trim(),
      cycleLengthMonths: Number(cycleLengthMonths),
      baseYieldTch: Number(baseYieldTch),
      polPercent: Number(polPercent),
      fiberPercent: Number(fiberPercent),
      purityPercent: Number(purityPercent),
      maturity,
      ratoonDecayFactors: decayMap,
    };

    onSave(varietyToSave);
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
            <div className="p-2.5 rounded-xl bg-lime-500/20 text-lime-400 border border-lime-500/30">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide">
                {initialVariety ? `Editar Variedad: ${initialVariety.varietyCode}` : "Crear Nueva Variedad de Caña"}
              </h2>
              <p className="text-xs text-slate-400">
                Parámetros agroindustriales y curva de vigor vegetativo por corte
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

          {/* Core Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Código de Variedad *
              </label>
              <input
                type="text"
                value={varietyCode}
                onChange={(e) => setVarietyCode(e.target.value)}
                placeholder="Ej. RB86-7515 o C86-12"
                disabled={Boolean(initialVariety)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                } ${initialVariety ? "opacity-75 cursor-not-allowed" : ""}`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Nombre Comercial / Descripción *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. RB86-7515 (Alta Sacarosa / Rústica)"
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                TCH Base (Caña Planta) (t/ha) *
              </label>
              <input
                type="number"
                step="0.5"
                min="10"
                value={baseYieldTch}
                onChange={(e) => setBaseYieldTch(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Maduración Fenológica
              </label>
              <select
                value={maturity}
                onChange={(e) => setMaturity(e.target.value as any)}
                className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              >
                <option value="TEMPRANA">Temprana (Inicio de Zafra, alta pureza temprana)</option>
                <option value="MEDIA">Media (Mitad de Zafra, curva pico)</option>
                <option value="TARDIA">Tardía (Final de Zafra, retención de sacarosa)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Pol % en Caña (Sacarosa)
              </label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="22"
                value={polPercent}
                onChange={(e) => setPolPercent(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Pureza Aparente del Jugo (%)
              </label>
              <input
                type="number"
                step="0.1"
                min="50"
                max="100"
                value={purityPercent}
                onChange={(e) => setPurityPercent(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Fibra % en Caña
              </label>
              <input
                type="number"
                step="0.1"
                min="5"
                max="25"
                value={fiberPercent}
                onChange={(e) => setFiberPercent(parseFloat(e.target.value) || 0)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Duración del Ciclo (Meses)
              </label>
              <input
                type="number"
                step="1"
                min="8"
                max="24"
                value={cycleLengthMonths}
                onChange={(e) => setCycleLengthMonths(parseInt(e.target.value) || 12)}
                className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-lime-500 ${
                  isLight ? "bg-white border-slate-300 text-slate-900" : "bg-slate-800 border-slate-700 text-white"
                }`}
              />
            </div>
          </div>

          {/* Ratoon Decay Factors Section */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 font-mono">
                Curva Dinámica de Decaimiento por Cepa / Corte (Factor Multiplicador)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Configura el coeficiente de retención vegetativa para cada corte respecto a la Caña Planta (1.00 = 100%).
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Caña Planta</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  max="1.5"
                  value={decayPlanta}
                  onChange={(e) => setDecayPlanta(parseFloat(e.target.value) || 1.0)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Soca 1</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decaySoca}
                  onChange={(e) => setDecaySoca(parseFloat(e.target.value) || 0.9)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 2</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ2}
                  onChange={(e) => setDecayQ2(parseFloat(e.target.value) || 0.83)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 3</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ3}
                  onChange={(e) => setDecayQ3(parseFloat(e.target.value) || 0.77)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 4</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ4}
                  onChange={(e) => setDecayQ4(parseFloat(e.target.value) || 0.70)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 5</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ5}
                  onChange={(e) => setDecayQ5(parseFloat(e.target.value) || 0.62)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 6</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ6}
                  onChange={(e) => setDecayQ6(parseFloat(e.target.value) || 0.56)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Retoño 7+</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayQ7Plus}
                  onChange={(e) => setDecayQ7Plus(parseFloat(e.target.value) || 0.50)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>

              <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/50">
                <span className="block text-slate-400 text-[10px]">Demolición</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.1"
                  max="1.2"
                  value={decayDemolicion}
                  onChange={(e) => setDecayDemolicion(parseFloat(e.target.value) || 0.45)}
                  className="w-full mt-1 bg-transparent font-mono font-bold text-center border-b border-slate-700 focus:border-lime-500 focus:outline-hidden"
                />
              </div>
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
              className="px-5 py-2 rounded-xl text-sm font-bold bg-lime-500 hover:bg-lime-400 text-black flex items-center gap-2 transition-all shadow-lg shadow-lime-500/20"
            >
              <Check className="w-4 h-4" />
              <span>{initialVariety ? "Guardar Variedad" : "Crear Variedad"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
