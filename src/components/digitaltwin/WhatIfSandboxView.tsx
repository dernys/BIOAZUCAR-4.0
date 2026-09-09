import React, { useState, useMemo } from "react";
import {
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Flame,
  Zap,
  Droplets,
  Scale,
  Cpu,
  ArrowRight,
  Send,
} from "lucide-react";
import { TelemetryData } from "../../types";

interface WhatIfSandboxViewProps {
  telemetry: TelemetryData;
  theme?: "dark" | "light";
  onApplyPreset?: (scenarioName: string) => void;
}

export const WhatIfSandboxView: React.FC<WhatIfSandboxViewProps> = ({
  telemetry,
  theme = "dark",
  onApplyPreset,
}) => {
  // Real-time baseline values from telemetry
  const baselineTCH = telemetry.tch || 450;
  const baselineMoisture = telemetry.bagasseMoisture || 48.8;
  const baselinePressure = telemetry.boilerPressureHP || 64.6;
  const baselineImbibitionRatio = 250; // % sobre fibra
  const baselinePowerExport = telemetry.powerExportGridMW || 21.2;

  // Interactive slider parameters
  const [simTCH, setSimTCH] = useState<number>(baselineTCH);
  const [simMoisture, setSimMoisture] = useState<number>(baselineMoisture);
  const [simPressure, setSimPressure] = useState<number>(baselinePressure);
  const [simImbibition, setSimImbibition] = useState<number>(baselineImbibitionRatio);
  const [simExportMW, setSimExportMW] = useState<number>(baselinePowerExport);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Reset to current DCS telemetry
  const handleReset = () => {
    setSimTCH(baselineTCH);
    setSimMoisture(baselineMoisture);
    setSimPressure(baselinePressure);
    setSimImbibition(baselineImbibitionRatio);
    setSimExportMW(baselinePowerExport);
    setAppliedNotice(null);
  };

  // Load Presets
  const applyPreset = (preset: "MAX_POWER" | "WET_BAGASSE" | "HIGH_THROUGHPUT" | "STEAM_SAVER") => {
    if (preset === "MAX_POWER") {
      setSimTCH(480);
      setSimMoisture(47.5);
      setSimPressure(66.0);
      setSimImbibition(240);
      setSimExportMW(28.5);
    } else if (preset === "WET_BAGASSE") {
      setSimTCH(420);
      setSimMoisture(53.5);
      setSimPressure(60.0);
      setSimImbibition(220);
      setSimExportMW(16.5);
    } else if (preset === "HIGH_THROUGHPUT") {
      setSimTCH(540);
      setSimMoisture(49.2);
      setSimPressure(65.0);
      setSimImbibition(260);
      setSimExportMW(24.0);
    } else if (preset === "STEAM_SAVER") {
      setSimTCH(440);
      setSimMoisture(47.0);
      setSimPressure(65.5);
      setSimImbibition(210);
      setSimExportMW(23.5);
    }
    setAppliedNotice(`Preset "${preset}" cargado en el simulador What-If`);
  };

  // Physics Simulation Calculations
  const simResults = useMemo(() => {
    // 1. Bagasse production: ~29.6% of cane
    const bagasseProduced = simTCH * 0.296; // t/h

    // 2. Lower Heating Value of bagasse (kcal/kg) based on moisture:
    // LHV drops drastically with moisture: ~1820 at 48.8%, ~1580 at 54%
    const lhv_kcal = 4250 - 48.5 * simMoisture - 27 - 0.85;
    const lhv_MJ = lhv_kcal * 0.0041868;

    // 3. Boiler Efficiency (ASME PTC 4)
    // Decreases if moisture is high or pressure is too far from optimal
    const baseEff = 86.0;
    const moisturePenalty = (simMoisture - 48.0) * 0.65;
    const boilerEfficiency = +(baseEff - moisturePenalty).toFixed(1);

    // 4. Steam Generation
    // Steam generated per ton of bagasse: ~2.15 t steam / t bagasse at 85% eff
    const bagasseToBoilers = Math.min(bagasseProduced, 98 + (simTCH - 450) * 0.15);
    const steamGeneratedHP = +(bagasseToBoilers * 2.15 * (boilerEfficiency / 85.0)).toFixed(1);

    // 5. Factory steam demand: ~440 kg steam / ton cane + imbibition evaporation load
    const factorySteamDemand = +((simTCH * 0.44) + (simImbibition - 250) * 0.08).toFixed(1);
    const turbineSteamDemand = +(simExportMW * 6.5).toFixed(1);
    const totalSteamDemand = +(factorySteamDemand + turbineSteamDemand).toFixed(1);
    const steamBalance = +(steamGeneratedHP - totalSteamDemand).toFixed(1); // surplus/deficit

    // 6. Bagasse yard balance (t/h stored into yard)
    const bagasseStorageRate = +(bagasseProduced - bagasseToBoilers).toFixed(1);

    // 7. Sugar Production
    const extractionEff = +(96.8 - (simTCH > 500 ? (simTCH - 500) * 0.015 : 0) + (simImbibition - 250) * 0.01).toFixed(1);
    const recoveryYield = +(11.4 * (extractionEff / 96.5)).toFixed(2);
    const sugarTonsPerHour = +(simTCH * (recoveryYield / 100)).toFixed(2);
    const sugarBagsPerDay = Math.floor(sugarTonsPerHour * 24 * 20);

    // 8. Financial Delta (USD / hour)
    // Sugar: $480 / ton
    // Power Export: $78 / MWh
    const currentSugarTonsPerHour = baselineTCH * 0.114;
    const currentPowerExport = baselinePowerExport;
    const currentHourlyRevenue = (currentSugarTonsPerHour * 480) + (currentPowerExport * 78);
    const simHourlyRevenue = (sugarTonsPerHour * 480) + (simExportMW * 78);
    const deltaRevenueUSD = +(simHourlyRevenue - currentHourlyRevenue).toFixed(0);

    // 9. Safety Margin
    const pressureMargin = +(75 - simPressure).toFixed(1); // bar to relief valve
    const riskLevel =
      steamBalance < -5
        ? "DEFICIT_VAPOR"
        : simMoisture > 52
        ? "COMBUSTION_INESTABLE"
        : simTCH > 530
        ? "SOBRECARGA_MOLINOS"
        : "OPTIMO";

    return {
      bagasseProduced: +bagasseProduced.toFixed(1),
      lhv_kcal: Math.round(lhv_kcal),
      boilerEfficiency,
      steamGeneratedHP,
      totalSteamDemand,
      steamBalance,
      bagasseStorageRate,
      extractionEff,
      recoveryYield,
      sugarTonsPerHour,
      sugarBagsPerDay,
      deltaRevenueUSD,
      pressureMargin,
      riskLevel,
    };
  }, [simTCH, simMoisture, simPressure, simImbibition, simExportMW, baselineTCH, baselinePowerExport]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-[10px] font-bold">
                PRESCRIPTIVE PREDICTIVE TWIN
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Simulación física de lazo cerrado desacoplada del DCS
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-tech flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              Simulador de Escenarios 'What-If' en Tiempo Real
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1">
              Ejecute pruebas operacionales predictivas sin perturbar el ingenio físico. El modelo calcula en milisegundos
              los equilibrios termodinámicos, balances de masa y el impacto económico proyectado.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono border border-slate-700 transition"
              title="Restablecer controles a los valores reales medidos en el DCS"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset a DCS Real</span>
            </button>
          </div>
        </div>

        {/* Preset Buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800">
          <span className="text-[10px] text-slate-400 font-mono uppercase">Escenarios Típicos:</span>
          <button
            onClick={() => applyPreset("MAX_POWER")}
            className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-mono transition"
          >
            ⚡ Max Cogeneración (+28.5 MW)
          </button>
          <button
            onClick={() => applyPreset("WET_BAGASSE")}
            className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono transition"
          >
            🌧️ Bagazo Húmedo (53.5% H)
          </button>
          <button
            onClick={() => applyPreset("HIGH_THROUGHPUT")}
            className="text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 font-mono transition"
          >
            🏭 Sobremolienda (540 TCH)
          </button>
          <button
            onClick={() => applyPreset("STEAM_SAVER")}
            className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono transition"
          >
            💧 Ahorro de Vapor Fabril
          </button>
        </div>

        {appliedNotice && (
          <div className="mt-3 p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{appliedNotice}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Controls (Left) vs Projected Outcomes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Param Sliders (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white font-tech uppercase flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-400" />
              Variables Operacionales de Entrada
            </h3>
            <span className="text-[10px] text-slate-500">Virtual Sandbox</span>
          </div>

          {/* Slider 1: TCH */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-slate-300 font-bold">Molienda de Caña (TCH):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Real: {baselineTCH}</span>
                <span className="text-base font-bold text-cyan-400">{simTCH} TCH</span>
              </div>
            </div>
            <input
              type="range"
              min="300"
              max="650"
              step="5"
              value={simTCH}
              onChange={(e) => setSimTCH(Number(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>300 (Carga Mínima)</span>
              <span>450 (Nominal)</span>
              <span>650 (Sobrecarga)</span>
            </div>
          </div>

          {/* Slider 2: Bagasse Moisture */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-slate-300 font-bold">Humedad de Bagazo (%):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Real: {baselineMoisture}%</span>
                <span className={`text-base font-bold ${simMoisture > 52 ? "text-rose-400" : "text-amber-400"}`}>
                  {simMoisture}%
                </span>
              </div>
            </div>
            <input
              type="range"
              min="42.0"
              max="56.0"
              step="0.5"
              value={simMoisture}
              onChange={(e) => setSimMoisture(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>42.0% (Seco Óptimo)</span>
              <span>48.5% (Típico)</span>
              <span>56.0% (Lluvia Severa)</span>
            </div>
          </div>

          {/* Slider 3: Boiler Pressure */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-slate-300 font-bold">Presión Colector HP (bar):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Real: {baselinePressure} bar</span>
                <span className="text-base font-bold text-white">{simPressure} bar</span>
              </div>
            </div>
            <input
              type="range"
              min="48"
              max="72"
              step="0.5"
              value={simPressure}
              onChange={(e) => setSimPressure(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>48 bar</span>
              <span>65 bar (Diseño)</span>
              <span>72 bar (Alerta Válvula)</span>
            </div>
          </div>

          {/* Slider 4: Imbibition Water Ratio */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-slate-300 font-bold">Agua Imbibición (% s/fibra):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Real: 250%</span>
                <span className="text-base font-bold text-cyan-300">{simImbibition}%</span>
              </div>
            </div>
            <input
              type="range"
              min="180"
              max="320"
              step="5"
              value={simImbibition}
              onChange={(e) => setSimImbibition(Number(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>180% (Bajo)</span>
              <span>250% (Equilibrio)</span>
              <span>320% (Alta Dilución)</span>
            </div>
          </div>

          {/* Slider 5: SEN Export Target */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline">
              <label className="text-slate-300 font-bold">Despacho Eléctrico SEN (MW):</label>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px]">Real: {baselinePowerExport} MW</span>
                <span className="text-base font-bold text-emerald-400">{simExportMW} MW</span>
              </div>
            </div>
            <input
              type="range"
              min="10"
              max="34"
              step="0.5"
              value={simExportMW}
              onChange={(e) => setSimExportMW(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>10 MW (Base PPA)</span>
              <span>22 MW (Contrato)</span>
              <span>34 MW (Tope Turbina)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Simulation Results (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Top Key Impact Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 uppercase">Impacto Financiero Proyectado:</span>
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-bold ${
                      simResults.deltaRevenueUSD >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {simResults.deltaRevenueUSD >= 0 ? `+$${simResults.deltaRevenueUSD.toLocaleString()}` : `-$${Math.abs(simResults.deltaRevenueUSD).toLocaleString()}`} / h
                  </span>
                  <span className="text-xs text-slate-400">
                    ({((simResults.deltaRevenueUSD * 24) / 1000).toFixed(1)} k$/día)
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase block">Diagnóstico del Gemelo:</span>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block ${
                    simResults.riskLevel === "OPTIMO"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : simResults.riskLevel === "DEFICIT_VAPOR"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {simResults.riskLevel.replace("_", " ")}
                </span>
              </div>
            </div>

            {/* Quick 4 KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Balance de Vapor</span>
                <span
                  className={`text-base font-bold ${
                    simResults.steamBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {simResults.steamBalance >= 0 ? `+${simResults.steamBalance}` : simResults.steamBalance} t/h
                </span>
                <span className="text-[9px] text-slate-500 block">
                  Gen: {simResults.steamGeneratedHP} | Dem: {simResults.totalSteamDemand}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Bagazo a Patio</span>
                <span className="text-base font-bold text-amber-400">
                  {simResults.bagasseStorageRate > 0 ? `+${simResults.bagasseStorageRate}` : simResults.bagasseStorageRate} t/h
                </span>
                <span className="text-[9px] text-slate-500 block">PCI: {simResults.lhv_kcal} kcal/kg</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Azúcar Proyectado</span>
                <span className="text-base font-bold text-white">{simResults.sugarTonsPerHour} t/h</span>
                <span className="text-[9px] text-cyan-300 block">{simResults.sugarBagsPerDay.toLocaleString()} sacos/día</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Eficiencia ASME</span>
                <span className="text-base font-bold text-emerald-400">{simResults.boilerEfficiency}%</span>
                <span className="text-[9px] text-slate-500 block">Margen: {simResults.pressureMargin} bar</span>
              </div>
            </div>
          </div>

          {/* Comparative Table: Real DCS vs Simulated What-If */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl font-mono text-xs">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Comparativa: DCS Físico vs Gemelo Simulado</span>
              <span className="text-[10px] text-cyan-400 font-normal">Diferencial (Δ)</span>
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-[10px] uppercase">
                    <th className="pb-1.5">Variable del Proceso</th>
                    <th className="pb-1.5">Medición DCS</th>
                    <th className="pb-1.5">Simulación Gemelo</th>
                    <th className="pb-1.5 text-right">Variación (Δ)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  <tr>
                    <td className="py-2 text-white">Molienda de Caña</td>
                    <td className="py-2 text-slate-400">{baselineTCH} TCH</td>
                    <td className="py-2 text-cyan-300 font-bold">{simTCH} TCH</td>
                    <td className="py-2 text-right font-bold text-cyan-400">
                      {simTCH - baselineTCH >= 0 ? `+${simTCH - baselineTCH}` : simTCH - baselineTCH} TCH
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">Vapor HP Generado</td>
                    <td className="py-2 text-slate-400">{telemetry.steamFlowHP || 211.5} t/h</td>
                    <td className="py-2 text-white font-bold">{simResults.steamGeneratedHP} t/h</td>
                    <td className="py-2 text-right font-bold">
                      {+(simResults.steamGeneratedHP - (telemetry.steamFlowHP || 211.5)).toFixed(1)} t/h
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">Potencia Exportada SEN</td>
                    <td className="py-2 text-slate-400">{baselinePowerExport} MW</td>
                    <td className="py-2 text-emerald-300 font-bold">{simExportMW} MW</td>
                    <td className="py-2 text-right font-bold text-emerald-400">
                      {+(simExportMW - baselinePowerExport).toFixed(1)} MW
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">Eficiencia Caldera</td>
                    <td className="py-2 text-slate-400">{telemetry.boilerEfficiency || 85.2}%</td>
                    <td className="py-2 text-white font-bold">{simResults.boilerEfficiency}%</td>
                    <td className="py-2 text-right font-bold">
                      {+(simResults.boilerEfficiency - (telemetry.boilerEfficiency || 85.2)).toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 text-white">Tasa de Extracción Pol</td>
                    <td className="py-2 text-slate-400">{telemetry.millingExtraction || 96.5}%</td>
                    <td className="py-2 text-white font-bold">{simResults.extractionEff}%</td>
                    <td className="py-2 text-right font-bold">
                      {+(simResults.extractionEff - (telemetry.millingExtraction || 96.5)).toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Prescriptive Recommendation from AI/Twin */}
            <div className="mt-4 p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="text-slate-300 text-[11px] leading-relaxed">
                <strong>Recomendación Prescriptiva del Gemelo:</strong> Para sostener{" "}
                <span className="text-cyan-300 font-bold">{simTCH} TCH</span> con bagazo al{" "}
                <span className="text-amber-300 font-bold">{simMoisture}%</span>, se aconseja regular el exceso de aire al{" "}
                <span className="text-white font-bold">32%</span> (O₂ en chimenea 3.8%) para evitar pérdidas de calor por gases secos y preservar el balance térmico de evaporación.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
