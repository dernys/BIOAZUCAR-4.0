import React, { useState, useMemo } from "react";
import {
  Flame,
  Zap,
  TrendingUp,
  Activity,
  DollarSign,
  Layers,
  Sliders,
  ShieldCheck,
  Sparkles,
  ArrowUpRight,
  Gauge,
  Wind,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
} from "lucide-react";
import { TelemetryData, UserRole } from "../types";
import { checkRbacPermission, getRoleBadgeInfo } from "../services/rbacService";

interface EnergyDispatchProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
  onDispatchUpdate?: (exportMW: number) => void;
}

export const EnergyDispatch: React.FC<EnergyDispatchProps> = ({
  telemetry,
  currentRole,
  onDispatchUpdate,
}) => {
  const [targetExportMW, setTargetExportMW] = useState<number>(telemetry.powerExportGridMW);
  const [spotPrice, setSpotPrice] = useState<number>(telemetry.spotPriceMWh || 84.50);
  const [ppaContractPrice] = useState<number>(76.00); // USD/MWh PPA
  const [o2Setpoint, setO2Setpoint] = useState<number>(3.4); // % O2 trim

  const rbacDispatch = useMemo(
    () => checkRbacPermission(currentRole, "CHANGE_DISPATCH_MW"),
    [currentRole]
  );
  const roleBadge = getRoleBadgeInfo(currentRole);

  // Bagasse Lower Heating Value (LHV) thermodynamic calculation
  // LHV (kcal/kg) = 4250*(1 - W/100) - 4850*(Pol/100) - 585*(W/100)
  const bagasseMoisture = telemetry.bagasseMoisture || 48.8;
  const bagassePol = telemetry.canePol ? telemetry.canePol * 0.12 : 1.8;
  const lhvKcal = Math.round(4250 * (1 - bagasseMoisture / 100) - 4850 * (bagassePol / 100) - 585 * (bagasseMoisture / 100));

  // ASME PTC 4 Heat Losses Breakdown (%)
  const lossFlueGas = 7.4; // Pérdida por calor sensible en gases secos
  const lossMoistureFuel = 5.2; // Pérdida por evaporación de humedad en bagazo
  const lossHydrogen = 1.6; // Pérdida por combustión de hidrógeno
  const lossUnburned = 0.6; // Inquemados sólidos/gaseosos (CO)
  const lossRadiation = 0.6; // Radiación y convección envolvente
  const totalLosses = lossFlueGas + lossMoistureFuel + lossHydrogen + lossUnburned + lossRadiation;
  const asmeEfficiency = (100 - totalLosses).toFixed(1);

  // Power Economics calculations
  const currentExportMW = telemetry.powerExportGridMW;
  const ppaMW = 18.0; // Contrato base PPA
  const spotMW = Math.max(0, currentExportMW - ppaMW);
  const ppaHourlyRevenue = ppaMW * ppaContractPrice;
  const spotHourlyRevenue = spotMW * spotPrice;
  const totalHourlyRevenue = ppaHourlyRevenue + spotHourlyRevenue;
  const dailyProjectedUSD = totalHourlyRevenue * 24;

  // Bagasse yard autonomy
  const bagasseStock = telemetry.bagasseStockTotalTons || 14500;
  const bagasseConsumptionHour = telemetry.bagasseBoilerConsumption || 104.2;
  const bagasseAutonomyDays = (bagasseStock / (bagasseConsumptionHour * 24)).toFixed(1);

  const handleApplyDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onDispatchUpdate) {
      onDispatchUpdate(targetExportMW);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Energy & Cogeneration Summary */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 p-5 rounded-2xl border border-amber-900/40 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Zap className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide font-tech uppercase">
                Optimización Energética, Calderas ASME PTC 4 & Despacho MW
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                COGENERACIÓN BIOMASA
              </span>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Monitoreo termodinámico en tiempo real de calderas acuotubulares de alta presión (65 bar / 485°C), balance estequiométrico con control de O2 trim y optimización económica de venta de excedentes de energía al Sistema Eléctrico Nacional.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-950/80 px-3.5 py-2 rounded-xl border border-amber-500/30 text-right">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Ingreso Horario Exportación</span>
              <span className="text-base font-bold text-amber-300 font-mono">
                ${(totalHourlyRevenue ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD/h
              </span>
            </div>
          </div>
        </div>

        {/* 4 Main KPI Cards for Cogeneration */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Generación Bruta</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-white">{telemetry.powerGeneratedMW.toFixed(1)}</span>
              <span className="text-xs font-mono text-amber-400">MW</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">Turbogenerador 35 MVA</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Autoconsumo Ingenio</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-cyan-300">{telemetry.powerInternalMW.toFixed(1)}</span>
              <span className="text-xs font-mono text-slate-400">MW</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">Motores Tándem & Fabril</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Inyección Neta a Red</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-emerald-400">{telemetry.powerExportGridMW.toFixed(1)}</span>
              <span className="text-xs font-mono text-emerald-300">MW</span>
            </div>
            <span className="text-[10px] text-emerald-500/90 font-mono block mt-1">Subestación 138 kV</span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 font-mono block">Eficiencia Caldera ASME</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-bold font-mono text-amber-300">{asmeEfficiency}</span>
              <span className="text-xs font-mono text-slate-400">%</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono block mt-1">Método Indirecto (Pérdidas)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Thermodynamic Balance + Power Market Economics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: ASME PTC 4 Thermal Analysis */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase font-tech">
                  Balance Térmico de Combustión (ASME PTC 4)
                </h3>
              </div>
              <span className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                PCI: {lhvKcal} kcal/kg
              </span>
            </div>

            {/* Live Combustion Parameters */}
            <div className="grid grid-cols-3 gap-3 mb-4 font-mono text-xs">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Humedad Bagazo</span>
                <span className="text-amber-400 font-bold text-sm">{bagasseMoisture}%</span>
                <span className="text-slate-500 block text-[9px]">Setpoint: &lt; 49.0%</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Exceso de Aire (O2)</span>
                <span className="text-emerald-400 font-bold text-sm">{telemetry.flueGasO2.toFixed(2)}% O2</span>
                <span className="text-slate-500 block text-[9px]">λ = 1.21</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">Temp. Gases Chimenea</span>
                <span className="text-cyan-300 font-bold text-sm">{telemetry.flueGasTemp || 162} °C</span>
                <span className="text-slate-500 block text-[9px]">Post-Economizador</span>
              </div>
            </div>

            {/* Heat Losses Stack Bar & Detailed List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase font-mono">
                Desglose de Pérdidas Térmicas ({totalLosses.toFixed(1)}% Totales)
              </h4>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">1. Gases Secos en Chimenea (Lg):</span>
                  <span className="text-slate-200 font-bold">{lossFlueGas}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${(lossFlueGas / totalLosses) * 100}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">2. Humedad en Bagazo (Lm):</span>
                  <span className="text-slate-200 font-bold">{lossMoistureFuel}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(lossMoistureFuel / totalLosses) * 100}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">3. Formación de Agua por Hidrógeno (Lh):</span>
                  <span className="text-slate-200 font-bold">{lossHydrogen}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${(lossHydrogen / totalLosses) * 100}%` }}></div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">4. Inquemados (CO / Cenizas) + Radiación (Lu+Lr):</span>
                  <span className="text-slate-200 font-bold">{(lossUnburned + lossRadiation).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${((lossUnburned + lossRadiation) / totalLosses) * 100}%` }}></div>
                </div>
              </div>
            </div>

            {/* O2 Trim Automation Loop */}
            <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/60 p-3 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase font-mono">Controlador O2 Trim Automático</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                  AUTO (Tiro Forzado Modulado)
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Ajuste automático del damper de tiro forzado (FD Fan) según sonda de zirconio para minimizar inquemados manteniendo O2 en 3.4%.
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="2.5"
                  max="5.0"
                  step="0.1"
                  value={o2Setpoint}
                  onChange={(e) => setO2Setpoint(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <span className="text-xs font-mono font-bold text-emerald-300 shrink-0 w-16 text-right">
                  {o2Setpoint.toFixed(1)}% O2
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Power Market Dispatch & Bagasse Yard Economics */}
        <div className="lg:col-span-5 space-y-4">
          {/* Revenue & Dispatch Controller */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase font-tech">
                  Despacho al Mercado Eléctrico
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                Interconexión 138kV
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contrato Base PPA (18.0 MW):</span>
                  <span className="text-white font-bold">${ppaHourlyRevenue.toFixed(0)} USD/h (@ ${ppaContractPrice})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Excedente Spot ({(currentExportMW - ppaMW).toFixed(1)} MW):</span>
                  <span className="text-emerald-400 font-bold">${spotHourlyRevenue.toFixed(0)} USD/h (@ ${spotPrice})</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex justify-between text-sm">
                  <span className="text-amber-400 font-bold">Proyección Diaria (24h):</span>
                  <span className="text-emerald-300 font-bold">
                    ${(dailyProjectedUSD ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
                  </span>
                </div>
              </div>

              {/* Setpoint Dispatch Form */}
              <form onSubmit={handleApplyDispatch} className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      Modulación de Despacho a Red (MW):
                      {!rbacDispatch.allowed && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5 font-mono">
                          <Lock className="w-3 h-3" /> Solo lectura
                        </span>
                      )}
                    </span>
                    <span className="text-cyan-300 font-bold">{targetExportMW.toFixed(1)} MW</span>
                  </div>
                  <input
                    type="range"
                    min="15.0"
                    max="26.0"
                    step="0.5"
                    disabled={!rbacDispatch.allowed}
                    value={targetExportMW}
                    onChange={(e) => setTargetExportMW(parseFloat(e.target.value))}
                    className={`w-full ${rbacDispatch.allowed ? "accent-cyan-500 cursor-pointer" : "opacity-50 cursor-not-allowed"}`}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-0.5">Precio Spot Mercado ($/MWh):</label>
                    <input
                      type="number"
                      step="0.5"
                      disabled={!rbacDispatch.allowed}
                      value={spotPrice}
                      onChange={(e) => setSpotPrice(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 text-xs font-mono text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!rbacDispatch.allowed}
                    className={`self-end px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      rbacDispatch.allowed
                        ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                    }`}
                    title={rbacDispatch.allowed ? "Fijar Despacho en PLC" : rbacDispatch.reason}
                  >
                    Fijar Despacho
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Bagasse Yard Storage & Autonomy */}
          <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase font-tech">
                  Patio de Bagazo & Autonomía
                </h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Inventario LiDAR
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Stock en Patio</span>
                  <span className="text-amber-300 font-bold text-sm">
                    {bagasseStock.toLocaleString()} t
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">Pilas compactadas</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px]">Autonomía Caldera</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {bagasseAutonomyDays} días
                  </span>
                  <span className="text-slate-400 text-[10px] block mt-0.5">Sin molienda</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 text-[11px] block">Tasa de Excedente a Patio:</span>
                  <span className="text-cyan-300 font-bold">{telemetry.bagasseYardStorageRate || 29.2} t/h</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Balance Positivo
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
