import React, { useState } from "react";
import {
  Sliders,
  Plus,
  TrendingUp,
  DollarSign,
  Droplets,
  Truck,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Edit3,
  Trash2,
} from "lucide-react";
import { AgriculturalScenario, AgriculturalCampaign } from "../../types/agriculture";

interface ScenariosSimulationTabProps {
  scenarios: AgriculturalScenario[];
  activeCampaign: AgriculturalCampaign;
  onCreateScenario: () => void;
  onEditScenario: (scenario: AgriculturalScenario) => void;
  onDeleteScenario: (scenarioId: string) => void;
  onSetBaseline: (scenarioId: string) => void;
  theme?: "dark" | "light";
}

export const ScenariosSimulationTab: React.FC<ScenariosSimulationTabProps> = ({
  scenarios,
  activeCampaign,
  onCreateScenario,
  onEditScenario,
  onDeleteScenario,
  onSetBaseline,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  // Real-time What-If sandbox controls
  const [liveClimateFactor, setLiveClimateFactor] = useState(1.0);
  const [liveDieselPrice, setLiveDieselPrice] = useState(0.95);
  const [liveSugarPrice, setLiveSugarPrice] = useState(450);
  const [liveDistanceKm, setLiveDistanceKm] = useState(18.5);

  // Dynamic simulation calculations
  const baselineTch = 80.25;
  const simulatedTch = Number((baselineTch * liveClimateFactor).toFixed(2));
  const totalArableHa = 12500;
  const simulatedCaneTons = Number((totalArableHa * simulatedTch).toFixed(0));
  const simulatedSugarTons = Number((simulatedCaneTons * 0.115).toFixed(0)); // 11.5% sucrose recovery
  const simulatedOpexUSD = Number((simulatedCaneTons * 24.5 * (liveDieselPrice / 0.95)).toFixed(0));
  const simulatedGrossRevenueUSD = Number((simulatedSugarTons * liveSugarPrice).toFixed(0));
  const simulatedGrossMarginUSD = simulatedGrossRevenueUSD - simulatedOpexUSD;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Simulador Multivariante de Escenarios Agrícolas What-If
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Análisis de resiliencia climática, sensibilidad al precio del diésel B-10, distancia de flete y cotización del azúcar
          </p>
        </div>

        <button
          onClick={onCreateScenario}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Guardar Escenario</span>
        </button>
      </div>

      {/* Live Sandbox Card */}
      <div
        className={`p-5 rounded-xl border space-y-4 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900/90 border-slate-800"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Simulador Dinámico en Tiempo Real (Sandbox Paramétrico)
          </h3>
          <button
            onClick={() => {
              setLiveClimateFactor(1.0);
              setLiveDieselPrice(0.95);
              setLiveSugarPrice(450);
              setLiveDistanceKm(18.5);
            }}
            className="text-xs text-sky-400 hover:underline"
          >
            Restablecer a Valores Nominales
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Slider 1: Climate */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Factor Climático / Lluvias:</span>
              <span className={`font-mono font-bold ${liveClimateFactor >= 1 ? "text-emerald-400" : "text-amber-400"}`}>
                {liveClimateFactor.toFixed(2)}x ({((liveClimateFactor - 1) * 100).toFixed(0)}%)
              </span>
            </div>
            <input
              type="range"
              min="0.75"
              max="1.25"
              step="0.05"
              value={liveClimateFactor}
              onChange={(e) => setLiveClimateFactor(Number(e.target.value))}
              className="w-full accent-sky-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>-25% Sequía</span>
              <span>1.0x Normal</span>
              <span>+25% Riego</span>
            </div>
          </div>

          {/* Slider 2: Diesel Price */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Precio Diésel B-10:</span>
              <span className="font-mono font-bold text-amber-400">
                ${liveDieselPrice.toFixed(2)} /L
              </span>
            </div>
            <input
              type="range"
              min="0.60"
              max="2.00"
              step="0.05"
              value={liveDieselPrice}
              onChange={(e) => setLiveDieselPrice(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>$0.60 Subvencionado</span>
              <span>$2.00 Pico Inflación</span>
            </div>
          </div>

          {/* Slider 3: Sugar Price */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Precio Azúcar Blanco:</span>
              <span className="font-mono font-bold text-emerald-400">
                ${liveSugarPrice} /t
              </span>
            </div>
            <input
              type="range"
              min="300"
              max="750"
              step="25"
              value={liveSugarPrice}
              onChange={(e) => setLiveSugarPrice(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>$300 Mínimo</span>
              <span>$750 Mercado Spot</span>
            </div>
          </div>

          {/* Slider 4: Distance */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Distancia Media Transporte:</span>
              <span className="font-mono font-bold text-blue-400">
                {liveDistanceKm.toFixed(1)} km
              </span>
            </div>
            <input
              type="range"
              min="8"
              max="45"
              step="1"
              value={liveDistanceKm}
              onChange={(e) => setLiveDistanceKm(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>8 km Cercano</span>
              <span>45 km Radio Límite</span>
            </div>
          </div>
        </div>

        {/* Real-time KPI Result Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">TCH Proyectado</span>
            <span className="text-base font-bold font-mono text-slate-100">
              {simulatedTch} t/ha
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Producción Caña</span>
            <span className="text-base font-bold font-mono text-slate-100">
              {(simulatedCaneTons / 1000).toFixed(1)}k t
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">Azúcar Producido</span>
            <span className="text-base font-bold font-mono text-amber-400">
              {(simulatedSugarTons / 1000).toFixed(1)}k t
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <span className="text-[11px] text-slate-400 block">OPEX Agrícola</span>
            <span className="text-base font-bold font-mono text-rose-400">
              ${(simulatedOpexUSD / 1000000).toFixed(2)}M
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-slate-400 block">Margen Operativo Bruto</span>
            <span className={`text-base font-bold font-mono ${simulatedGrossMarginUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              ${(simulatedGrossMarginUSD / 1000000).toFixed(2)}M
            </span>
          </div>
        </div>
      </div>

      {/* Comparison Table of Saved Scenarios */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Matriz Comparativa de Escenarios Guardados ({scenarios.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Campaña Activa: <strong className="text-slate-200">{activeCampaign.name}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className={`border-b font-semibold ${
                  isLight
                    ? "bg-slate-100/70 border-slate-200 text-slate-700"
                    : "bg-slate-950 border-slate-800 text-slate-300"
                }`}
              >
                <th className="p-3">Escenario</th>
                <th className="p-3">Factor Clima</th>
                <th className="p-3">Diésel ($/L)</th>
                <th className="p-3">Azúcar ($/t)</th>
                <th className="p-3">TCH Sim.</th>
                <th className="p-3">Producción Caña</th>
                <th className="p-3">OPEX Estimado</th>
                <th className="p-3">Estado Plan</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {scenarios.map((scen) => (
                <tr
                  key={scen.id}
                  className={`hover:bg-slate-800/20 transition ${
                    scen.isBaseline ? "bg-emerald-500/5 font-semibold" : ""
                  }`}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100">{scen.name}</span>
                      {scen.isBaseline && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          LÍNEA BASE
                        </span>
                      )}
                    </div>
                    {scen.description && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{scen.description}</p>
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    <span className={scen.climateFactor >= 1 ? "text-emerald-400" : "text-amber-400"}>
                      {scen.climateFactor.toFixed(2)}x
                    </span>
                  </td>
                  <td className="p-3 font-mono">${scen.dieselPriceUSD.toFixed(2)}</td>
                  <td className="p-3 font-mono">${scen.sugarPriceUSDPerTon}</td>
                  <td className="p-3 font-mono font-bold text-slate-200">
                    {scen.projectedTch} t/ha
                  </td>
                  <td className="p-3 font-mono">
                    {scen.projectedProductionTons?.toLocaleString()} t
                  </td>
                  <td className="p-3 font-mono font-bold text-rose-400">
                    ${((scen.estimatedOpexTotalUSD || 0) / 1000000).toFixed(2)}M
                  </td>
                  <td className="p-3">
                    {scen.isBaseline ? (
                      <span className="text-emerald-400 text-xs flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Oficial
                      </span>
                    ) : (
                      <button
                        onClick={() => onSetBaseline(scen.id)}
                        className="text-xs text-sky-400 hover:underline"
                      >
                        Fijar como Base
                      </button>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEditScenario(scen)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Editar Escenario"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteScenario(scen.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                        title="Eliminar Escenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
