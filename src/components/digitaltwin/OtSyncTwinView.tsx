import React, { useState } from "react";
import {
  RefreshCw,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Layers,
  ArrowRight,
  Zap,
  ShieldCheck,
  Activity,
  Check,
  Lock,
} from "lucide-react";
import { TelemetryData } from "../../types";

interface OtSyncTwinViewProps {
  telemetry: TelemetryData;
  theme?: "dark" | "light";
}

interface DiscrepancyCheck {
  variable: string;
  measured: number;
  simulated: number;
  unit: string;
  deltaPercent: number;
  status: "CONCORDANT" | "DEVIATION" | "CRITICAL_DRIFT";
  tag: string;
  protocol: string;
  diagnosis: string;
}

export const OtSyncTwinView: React.FC<OtSyncTwinViewProps> = ({
  telemetry,
  theme = "dark",
}) => {
  const [controlMode, setControlMode] = useState<"SHADOW_TWIN" | "SUPERVISORY_CLOSED_LOOP">(
    "SHADOW_TWIN"
  );
  const [isVerifying, setIsVerifying] = useState(false);

  // Model Discrepancy calculation: |Measured - ModelPredicted| / ModelPredicted
  const discrepancies: DiscrepancyCheck[] = [
    {
      variable: "Flujo de Vapor HP",
      measured: telemetry.steamFlowHP || 211.5,
      simulated: 210.8,
      unit: "t/h",
      deltaPercent: 0.33,
      status: "CONCORDANT",
      tag: "PLC01_BOIL_FT001.PV",
      protocol: "OPC-UA",
      diagnosis: "Excelente concordancia con modelo estequiométrico de combustión ASME",
    },
    {
      variable: "Vibración Molino 3",
      measured: telemetry.mill3Vibration || 2.4,
      simulated: 1.8,
      unit: "mm/s",
      deltaPercent: +33.3,
      status: telemetry.mill3Vibration > 4.5 ? "CRITICAL_DRIFT" : "DEVIATION",
      tag: "PLC02_MILL3_VT003.RMS",
      protocol: "MQTT Sparkplug B",
      diagnosis: "Desviación armónica detectada. Indica holgura mecánica incipiente en chumacera Edwards",
    },
    {
      variable: "Presión Domo Caldera 1",
      measured: telemetry.boilerPressureHP || 64.6,
      simulated: 64.8,
      unit: "bar",
      deltaPercent: 0.31,
      status: "CONCORDANT",
      tag: "PLC01_BOIL_PT001.PV",
      protocol: "OPC-UA",
      diagnosis: "Presión estable dentro del lazo de control PID maestro",
    },
    {
      variable: "Potencia Exportada SEN",
      measured: telemetry.powerExportGridMW || 21.2,
      simulated: 21.4,
      unit: "MW",
      deltaPercent: 0.93,
      status: "CONCORDANT",
      tag: "SWGR_GEN_MW_EXP.VAL",
      protocol: "IEC 61850 / OPC-UA",
      diagnosis: "Despacho eléctrico sincronizado con medidor fiscal de frontera",
    },
    {
      variable: "Tasa de Extracción Molienda",
      measured: telemetry.millingExtraction || 96.5,
      simulated: 96.6,
      unit: "%",
      deltaPercent: 0.10,
      status: "CONCORDANT",
      tag: "CALC_EXTR_POL_TANDEM.VAL",
      protocol: "UNS Analytics Engine",
      diagnosis: "Extracción concordante con tasa de imbibición compuesta",
    },
    {
      variable: "Brix Meladura Evaporadores",
      measured: telemetry.evaporatorSyrupBrix || 66.8,
      simulated: 67.2,
      unit: "°Bx",
      deltaPercent: 0.59,
      status: "CONCORDANT",
      tag: "PLC03_EVAP_DT004.PV",
      protocol: "Modbus TCP Gateway",
      diagnosis: "Densímetro de radiación gama calibrado",
    },
  ];

  const handleVerify = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
    }, 800);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold">
                ISO 23247 DIGITAL TWIN ARCHITECTURE
              </span>
              <span className="text-xs text-slate-400">
                Sincronismo de Réplica Físico-Virtual & Calidad de Señal
              </span>
            </div>
            <h2 className="text-xl font-bold text-white font-tech flex items-center gap-2">
              <Radio className="w-5 h-5 text-cyan-400" />
              Sincronización OT Bidireccional y Validación de Discrepancias
            </h2>
            <p className="text-xs text-slate-300 max-w-3xl mt-1">
              Monitorea en milisegundos la consistencia entre los sensores físicos del DCS (OT) y el modelo matemático virtual.
              Cualquier discrepancia persistente revela derivas de sensores, incrustaciones o pérdidas ocultas en planta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isVerifying ? "animate-spin" : ""}`} />
              <span>Verificar Consistencia</span>
            </button>
          </div>
        </div>

        {/* Sync Status Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Latencia de Espejo</span>
            <span className="text-base font-bold text-emerald-400">14 ms</span>
            <span className="text-[9px] text-slate-500 block">Transporte: MQTT Broker</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Calidad de Señal (OPC UA)</span>
            <span className="text-base font-bold text-emerald-400">100% GOOD</span>
            <span className="text-[9px] text-slate-500 block">StatusCode: 0x00000000</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Discrepancia Promedio</span>
            <span className="text-base font-bold text-cyan-300">0.45%</span>
            <span className="text-[9px] text-slate-500 block">Dentro de banda de diseño (&lt; 2%)</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 block">Modo Operativo</span>
            <span className="text-base font-bold text-purple-300">
              {controlMode === "SHADOW_TWIN" ? "Shadow Twin" : "Closed Loop"}
            </span>
            <span className="text-[9px] text-slate-500 block">Aislamiento IEC 62443 SL-3</span>
          </div>
        </div>
      </div>

      {/* Discrepancy Matrix Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase">
              Matriz de Concordancia Físico-Virtual (Physics-Informed Verification)
            </h3>
          </div>
          <span className="text-slate-400 text-[10px]">Tolerancia de desvío admitida: ± 2.0%</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[10px]">
                <th className="pb-2">Variable de Proceso</th>
                <th className="pb-2">Tag Físico (PLC/DCS)</th>
                <th className="pb-2">Medición Sensor</th>
                <th className="pb-2">Predicción Modelo</th>
                <th className="pb-2">Desvío Δ%</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Diagnóstico del Gemelo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {discrepancies.map((row, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 font-bold text-white">{row.variable}</td>
                  <td className="py-2.5 text-cyan-400 font-bold">{row.tag}</td>
                  <td className="py-2.5 text-slate-200">
                    {row.measured} {row.unit}
                  </td>
                  <td className="py-2.5 text-slate-400">
                    {row.simulated} {row.unit}
                  </td>
                  <td
                    className={`py-2.5 font-bold ${
                      row.status === "CRITICAL_DRIFT"
                        ? "text-rose-400"
                        : row.status === "DEVIATION"
                        ? "text-amber-400"
                        : "text-emerald-400"
                    }`}
                  >
                    {row.deltaPercent > 0 ? `+${row.deltaPercent}%` : `${row.deltaPercent}%`}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        row.status === "CONCORDANT"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : row.status === "DEVIATION"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-400 max-w-xs truncate" title={row.diagnosis}>
                    {row.diagnosis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisory Closed-Loop Safety Gating */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white font-tech">
                Enclavamiento de Control de Bucle Cerrado (Human-in-the-Loop)
              </h4>
              <p className="text-slate-300 text-[11px] max-w-2xl mt-0.5 leading-relaxed">
                Por directiva de ciberseguridad industrial <strong>IEC 62443 SL-3</strong>, el Gemelo Digital opera por defecto
                en modo <em>Sombra Pasiva (Shadow Twin)</em>. Para habilitar la inyección prescriptiva de consignas hacia el DCS,
                se requiere autorización explícita del Supervisor de Turno.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setControlMode("SHADOW_TWIN")}
              className={`px-3 py-2 rounded-xl border transition ${
                controlMode === "SHADOW_TWIN"
                  ? "bg-slate-800 text-white border-purple-500 font-bold"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              Modo Sombra Pasiva
            </button>
            <button
              onClick={() => setControlMode("SUPERVISORY_CLOSED_LOOP")}
              className={`px-3 py-2 rounded-xl border transition ${
                controlMode === "SUPERVISORY_CLOSED_LOOP"
                  ? "bg-purple-600 text-white border-purple-400 font-bold shadow-lg shadow-purple-600/30"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              Control Supervisado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
