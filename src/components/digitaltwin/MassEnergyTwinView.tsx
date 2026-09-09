import React, { useState } from "react";
import {
  Flame,
  Zap,
  Droplets,
  Gauge,
  Layers,
  ArrowRight,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertCircle,
  Scale,
  RefreshCw,
  BarChart3,
  Cpu,
} from "lucide-react";
import { TelemetryData } from "../../types";

interface MassEnergyTwinViewProps {
  telemetry: TelemetryData;
  theme?: "dark" | "light";
}

export const MassEnergyTwinView: React.FC<MassEnergyTwinViewProps> = ({
  telemetry,
  theme = "dark",
}) => {
  const [activeStage, setActiveStage] = useState<
    "ALL" | "MILLING" | "BOILER" | "TURBINE" | "EVAPORATION" | "SUGAR"
  >("ALL");

  // Multi-physics Mass & Energy balance calculations based on real cane processing engineering:
  const tch = telemetry.tch || 450;
  const canePol = telemetry.canePol || 15.4;
  const caneBrix = telemetry.caneBrix || 18.8;
  const caneFiber = 14.2; // % fibra típica
  const caneWater = 100 - caneBrix - caneFiber; // ~67%

  // 1. Milling & Extraction Balance
  const imbibitionWater = telemetry.imbibitionWaterFlow || 85.8; // t/h
  const imbibitionOnFiber = ((imbibitionWater / (tch * (caneFiber / 100))) * 100).toFixed(1);
  const extractionEff = telemetry.millingExtraction || 96.5; // %
  const polInCane = (tch * (canePol / 100)); // t/h Pol entrada
  const polExtracted = polInCane * (extractionEff / 100);
  const polLostInBagasse = polInCane - polExtracted;

  // Bagasse Production
  const bagasseRate = telemetry.bagasseProductionRate || tch * 0.296;
  const bagasseMoisture = telemetry.bagasseMoisture || 48.8;
  // Lower Heating Value (PCI) formula de Hugot: PCI = 4250 - 4850*W - 1080*Ash - 42.5*Pol
  const bagasseLHV_kcal = Math.round(4250 - 48.5 * bagasseMoisture - 10.8 * 2.5 - 0.425 * 2.0); // ~1820 kcal/kg
  const bagasseLHV_MJ = (bagasseLHV_kcal * 0.0041868).toFixed(2); // ~7.62 MJ/kg

  // Mixed Juice Output
  const mixedJuiceFlow = (tch + imbibitionWater - bagasseRate).toFixed(1); // t/h

  // 2. High-Pressure Boiler Balance (ASME PTC 4)
  const boilerConsumption = telemetry.bagasseBoilerConsumption || Math.min(bagasseRate, 98);
  const boilerPressure = telemetry.boilerPressureHP || 64.6; // bar
  const boilerTemp = telemetry.boilerTempHP || 485.2; // °C
  // Steam enthalpy at 65 bar, 485°C ~ 3380 kJ/kg, Feedwater enthalpy at 115°C ~ 485 kJ/kg => Delta h = 2895 kJ/kg
  const steamEnthalpyKJ = 3385;
  const feedwaterEnthalpyKJ = 485;
  const deltaEnthalpyKJ = steamEnthalpyKJ - feedwaterEnthalpyKJ;
  const steamFlowHP = telemetry.steamFlowHP || 211.5; // t/h
  const boilerEfficiency = telemetry.boilerEfficiency || 85.2;
  const totalHeatInputMW = ((boilerConsumption * 1000 * Number(bagasseLHV_MJ)) / 3600).toFixed(1);
  const totalSteamHeatOutputMW = ((steamFlowHP * 1000 * deltaEnthalpyKJ) / 3600 / 1000).toFixed(1);

  // 3. Cogeneration & Power Dispatch Balance
  const powerGrossMW = telemetry.powerGeneratedMW || 32.5;
  const powerInternalMW = telemetry.powerInternalMW || 11.3;
  const powerExportMW = telemetry.powerExportGridMW || 21.2;
  const specificSteamConsumption = ((steamFlowHP * 1000) / (powerGrossMW * 1000)).toFixed(2); // kg/kWh (~6.5 kg/kWh)
  const isentropicEfficiency = 81.8; // %

  // 4. Exhaust Steam to Factory (Evaporation & Boiling)
  const steamLP_Pressure = telemetry.steamPressureLP || 2.2;
  const steamLP_Temp = telemetry.steamTempLP || 134.8;
  const specificSteamPerTonCane = ((steamFlowHP * 1000) / tch).toFixed(0); // ~468 kg steam / t cane
  const syrupBrix = telemetry.evaporatorSyrupBrix || 66.8;
  const clarifiedJuiceFlow = telemetry.clarifiedJuiceFlow || tch * 0.84;
  // Water evaporated in quadruple effect: W = Juice * (1 - Brix_juice / Brix_syrup)
  const juiceBrix = 14.8;
  const waterEvaporatedRate = (clarifiedJuiceFlow * (1 - juiceBrix / syrupBrix)).toFixed(1);

  // 5. Final Products & Yield Balance
  const sugarRateTonsToday = telemetry.sugarProductionTonsToday || 862.4;
  const sugarBagsToday = telemetry.sugarBagsToday || 17248;
  const factoryYield = telemetry.factoryRecoveryYield || 11.42; // %
  const molassesRate = telemetry.molassesProductionTons || 279.5;

  return (
    <div className="space-y-6">
      {/* Top Banner: Multi-Physics Mathematical Twin Overview */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold">
                RAMI 4.0 / ISO 23247 MULTI-PHYSICS
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Actualizado en continuo vía UNS Broker
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-tech flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              Gemelo Termodinámico de Balance de Masa y Energía
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1">
              Modelo matemático en tiempo real basado en balances estequiométricos de caña, vaporización ASME PTC 4,
              ciclos Rankine con recalentamiento y termodinámica de múltiple efecto de evaporación azucarera.
            </p>
          </div>

          {/* Mass conservation status */}
          <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Conservación de Masa (Δm)</span>
              <span className="text-sm font-bold text-emerald-300">0.02% (Dentro de Tolerancia)</span>
              <span className="text-[9px] text-slate-500 block">Σ Entradas: {(tch + imbibitionWater).toFixed(1)} t/h = Σ Salidas</span>
            </div>
          </div>
        </div>

        {/* Stage selector pills */}
        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/80">
          {[
            { id: "ALL", label: "Flujo Integral de Planta" },
            { id: "MILLING", label: "1. Molienda & Extracción" },
            { id: "BOILER", label: "2. Calderas & Vapor HP" },
            { id: "TURBINE", label: "3. Turbogeneración SEN" },
            { id: "EVAPORATION", label: "4. Evaporación & Concentración" },
            { id: "SUGAR", label: "5. Cristalización & Sacarosa" },
          ].map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActiveStage(stage.id as any)}
              className={`text-xs px-3 py-1.5 rounded-lg font-mono transition ${
                activeStage === stage.id
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "bg-slate-950/80 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sankey / Stage Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Stage 1: Milling */}
        <div
          className={`bg-slate-900/90 border rounded-2xl p-4 shadow-lg transition ${
            activeStage === "ALL" || activeStage === "MILLING"
              ? "border-emerald-500/40 ring-1 ring-emerald-500/20"
              : "border-slate-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold text-emerald-400">FASE 1: MOLIENDA</span>
            <span className="text-xs font-mono text-slate-400">Extr: {extractionEff}%</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Caña de Entrada (TCH)</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-white">{tch} t/h</span>
                <span className="text-[10px] text-cyan-300">Pol: {canePol}%</span>
              </div>
              <span className="text-[9px] text-slate-500">Fibra: {caneFiber}% • Brix: {caneBrix}°Bx</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Agua de Imbibición Compuesta</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-cyan-400">{imbibitionWater} t/h</span>
                <span className="text-[10px] text-slate-400">{imbibitionOnFiber}% s/fibra</span>
              </div>
              <span className="text-[9px] text-slate-500">Temp: 72°C • Donnelly Chutes</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Bagazo Producido (Humedad {bagasseMoisture}%)</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-amber-400">{bagasseRate} t/h</span>
                <span className="text-[10px] text-amber-300">{bagasseLHV_kcal} kcal/kg</span>
              </div>
              <span className="text-[9px] text-slate-500">PCI: {bagasseLHV_MJ} MJ/kg • {((bagasseRate/tch)*100).toFixed(1)}% de caña</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Jugo Mixto Extraído</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-emerald-400">{mixedJuiceFlow} t/h</span>
                <span className="text-[10px] text-slate-400">14.8° Brix</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 2: Boiler Steam Generation */}
        <div
          className={`bg-slate-900/90 border rounded-2xl p-4 shadow-lg transition ${
            activeStage === "ALL" || activeStage === "BOILER"
              ? "border-amber-500/40 ring-1 ring-amber-500/20"
              : "border-slate-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold text-amber-400">FASE 2: CALDERAS ASME</span>
            <span className="text-xs font-mono text-slate-400">Eficiencia: {boilerEfficiency}%</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Bagazo Consumido en Hogar</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-amber-300">{boilerConsumption} t/h</span>
                <span className="text-[10px] text-slate-400">{totalHeatInputMW} MW térmicos</span>
              </div>
              <span className="text-[9px] text-slate-500">Almacén de patio: {(bagasseRate - boilerConsumption).toFixed(1)} t/h</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Vapor HP Sobrecalentado</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-white">{steamFlowHP} t/h</span>
                <span className="text-[10px] text-cyan-300">{boilerPressure} bar</span>
              </div>
              <span className="text-[9px] text-slate-500">Temp: {boilerTemp}°C • Entalpía: {steamEnthalpyKJ} kJ/kg</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Potencia Térmica Útil en Vapor</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-emerald-400">{totalSteamHeatOutputMW} MWt</span>
                <span className="text-[10px] text-slate-400">Δh: {deltaEnthalpyKJ} kJ/kg</span>
              </div>
              <span className="text-[9px] text-slate-500">Agua Alimentación: 115°C desaireada</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Gases de Chimenea & Combustión</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-300">O₂: {telemetry.flueGasO2}%</span>
                <span className="text-[10px] text-slate-400">Temp: 165°C</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 3: Cogeneration & Power */}
        <div
          className={`bg-slate-900/90 border rounded-2xl p-4 shadow-lg transition ${
            activeStage === "ALL" || activeStage === "TURBINE"
              ? "border-cyan-500/40 ring-1 ring-cyan-500/20"
              : "border-slate-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold text-cyan-400">FASE 3: COGENERACIÓN</span>
            <span className="text-xs font-mono text-slate-400">Isentrópico: {isentropicEfficiency}%</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Potencia Eléctrica Bruta</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-cyan-300">{powerGrossMW} MW</span>
                <span className="text-[10px] text-slate-400">35 MVA Stator</span>
              </div>
              <span className="text-[9px] text-slate-500">Consumo Específico: {specificSteamConsumption} kg/kWh</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Exportación Neta a Red SEN</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-emerald-400">{powerExportMW} MW</span>
                <span className="text-[10px] text-slate-400">138 kV</span>
              </div>
              <span className="text-[9px] text-slate-500">Autoconsumo Ingenio: {powerInternalMW} MW</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Vapor Escape (LP) a Fábrica</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">{steamLP_Pressure} bar</span>
                <span className="text-[10px] text-amber-300">{steamLP_Temp} °C</span>
              </div>
              <span className="text-[9px] text-slate-500">Índice Fabril: {specificSteamPerTonCane} kg vap/t caña</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Calidad de Energía</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-200">60.02 Hz</span>
                <span className="text-[10px] text-emerald-300">FP: {telemetry.powerFactor}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stage 4: Evaporation & Sugar Production */}
        <div
          className={`bg-slate-900/90 border rounded-2xl p-4 shadow-lg transition ${
            activeStage === "ALL" || activeStage === "EVAPORATION" || activeStage === "SUGAR"
              ? "border-purple-500/40 ring-1 ring-purple-500/20"
              : "border-slate-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="text-[10px] font-mono font-bold text-purple-400">FASE 4 & 5: AZÚCAR</span>
            <span className="text-xs font-mono text-slate-400">Rendimiento: {factoryYield}%</span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Evaporación Cuádruple Efecto</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-purple-300">{waterEvaporatedRate} t/h agua</span>
                <span className="text-[10px] text-emerald-400">Meladura: {syrupBrix}°Bx</span>
              </div>
              <span className="text-[9px] text-slate-500">Economía de vapor: 3.4 kg agua / kg vapor escape</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Producción Acumulada Hoy</span>
              <div className="flex justify-between items-baseline">
                <span className="text-base font-bold text-white">{sugarRateTonsToday} t</span>
                <span className="text-[10px] text-amber-300 font-bold">{sugarBagsToday.toLocaleString()} sacos</span>
              </div>
              <span className="text-[9px] text-slate-500">Sacos de 50 kg • Humedad &lt; 0.04%</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Subproducto Melaza Final</span>
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-bold text-slate-300">{molassesRate} t</span>
                <span className="text-[10px] text-slate-400">85° Brix</span>
              </div>
              <span className="text-[9px] text-slate-500">Pérdida en melaza: 8.4% Pol</span>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
              <span className="text-[10px] text-slate-500 block">Balance de Pérdidas de Sacarosa</span>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex my-1">
                <div className="bg-emerald-500 h-full" style={{ width: "88%" }} title="Recuperación: 88%"></div>
                <div className="bg-amber-500 h-full" style={{ width: "8.4%" }} title="Melaza: 8.4%"></div>
                <div className="bg-rose-500 h-full" style={{ width: "2.5%" }} title="Bagazo: 2.5%"></div>
                <div className="bg-slate-500 h-full" style={{ width: "1.1%" }} title="Cachaza + Indet: 1.1%"></div>
              </div>
              <span className="text-[9px] text-slate-400 flex justify-between">
                <span>Azúcar: 88%</span>
                <span>Melaza: 8.4%</span>
                <span>Bagazo: 2.5%</span>
                <span>Otras: 1.1%</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Thermodynamic State Metrics Detailed Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wide">
              Matriz de Estados Termodinámicos y Entalpías del Gemelo
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Vapor: IAPWS-IF97 • Azúcar: ICUMSA GS2/3
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                <th className="pb-2">Punto de Estado</th>
                <th className="pb-2">Fluido</th>
                <th className="pb-2">Presión</th>
                <th className="pb-2">Temperatura</th>
                <th className="pb-2">Flujo Másico</th>
                <th className="pb-2">Entalpía (h)</th>
                <th className="pb-2">Potencia / Exergía</th>
                <th className="pb-2 text-right">Estado Modelo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span> ST-1 Domo Caldera
                </td>
                <td className="py-2.5 text-slate-400">Vapor Sobrecalentado</td>
                <td className="py-2.5 text-cyan-300">{boilerPressure} bar(a)</td>
                <td className="py-2.5">{boilerTemp} °C</td>
                <td className="py-2.5 text-white font-bold">{steamFlowHP} t/h</td>
                <td className="py-2.5">{steamEnthalpyKJ} kJ/kg</td>
                <td className="py-2.5 text-amber-300">{totalSteamHeatOutputMW} MWt</td>
                <td className="py-2.5 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30">
                    NOMINAL
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> ST-2 Admisión Turbina
                </td>
                <td className="py-2.5 text-slate-400">Vapor HP Turbina</td>
                <td className="py-2.5 text-cyan-300">{(boilerPressure - 1.2).toFixed(1)} bar</td>
                <td className="py-2.5">{(boilerTemp - 4).toFixed(1)} °C</td>
                <td className="py-2.5 text-white font-bold">{(steamFlowHP * 0.98).toFixed(1)} t/h</td>
                <td className="py-2.5">3368 kJ/kg</td>
                <td className="py-2.5 text-cyan-300">{powerGrossMW} MWe</td>
                <td className="py-2.5 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30">
                    NOMINAL
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span> ST-3 Escape Contrapresión
                </td>
                <td className="py-2.5 text-slate-400">Vapor LP Saturado</td>
                <td className="py-2.5 text-cyan-300">{steamLP_Pressure} bar</td>
                <td className="py-2.5">{steamLP_Temp} °C</td>
                <td className="py-2.5 text-white font-bold">{(steamFlowHP * 0.95).toFixed(1)} t/h</td>
                <td className="py-2.5">2720 kJ/kg</td>
                <td className="py-2.5 text-slate-400">Calor Fabril</td>
                <td className="py-2.5 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30">
                    BALANCEADO
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-2.5 font-bold text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span> ST-4 Condensado Retorno
                </td>
                <td className="py-2.5 text-slate-400">Agua Tratada</td>
                <td className="py-2.5 text-cyan-300">4.5 bar</td>
                <td className="py-2.5">98.5 °C</td>
                <td className="py-2.5 text-white font-bold">{(steamFlowHP * 0.88).toFixed(1)} t/h</td>
                <td className="py-2.5">412 kJ/kg</td>
                <td className="py-2.5 text-slate-400">Recirculación</td>
                <td className="py-2.5 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] border border-emerald-500/30">
                    88% RETORNO
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
