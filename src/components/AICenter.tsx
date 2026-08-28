import React, { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  Flame,
  Zap,
  TrendingUp,
  BrainCircuit,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  HelpCircle,
  Cpu,
  ArrowRight,
  DollarSign,
  ShieldCheck
} from "lucide-react";
import { TelemetryData, AIDiagnosticResult, UserRole } from "../types";
import {
  diagnoseAnomalyWithAI,
  optimizeCombustionWithAI,
  sendChatToAI,
  OptimizeCombustionResult,
} from "../services/aiService";

interface AICenterProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
}

export const AICenter: React.FC<AICenterProps> = ({
  telemetry,
  currentRole,
}) => {
  // Anomaly Diagnostic state
  const [analyzingAnomaly, setAnalyzingAnomaly] = useState<boolean>(false);
  const [diagnosticResult, setDiagnosticResult] = useState<AIDiagnosticResult | null>({
    id: "diag-init",
    timestamp: "Hace 2 min",
    equipment: "Molino 3 - Extracción Intermedia",
    metric: "Vibración RMS en Chumacera Superior",
    currentValue: 4.8,
    threshold: 4.5,
    unit: "mm/s",
    rootCause:
      "Desbalance mecánico y armónicos 2X causados por variación en la capa de caña desfibrada y desgaste localizado en el casquillo de bronce de la maza superior.",
    severity: "ALTA",
    immediateAction:
      "Ajustar regulador de velocidad del accionamiento hidráulico en -4% y verificar presión de lubricante ISO VG 460.",
    maintenanceRecommendation:
      "Programar inspección boroscópica y verificación de apriete de pernos de bancada en el próximo paro quincenal.",
    financialImpact: "Riesgo de parada imprevista de tándem: ~$18,500 USD / hora.",
    confidenceScore: 94,
    isAiGenerated: true,
  });

  // Combustion Optimizer state
  const [optimizingCombustion, setOptimizingCombustion] = useState<boolean>(false);
  const [combustionResult, setCombustionResult] = useState<OptimizeCombustionResult | null>(null);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: `Hola, soy el Asistente Experto en Operaciones de BioAzúcar 4.0. Actualmente la planta procesa ${telemetry.tch} TCH de caña y exporta ${telemetry.powerExportGridMW} MW a la red nacional. ¿En qué parámetro o equipo necesitas soporte técnico?`,
      time: "15:40",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [sendingChat, setSendingChat] = useState<boolean>(false);

  // Run anomaly diagnosis
  const handleRunDiagnosis = async (equipment: string, metric: string, value: number, threshold: number, unit: string) => {
    setAnalyzingAnomaly(true);
    try {
      const result = await diagnoseAnomalyWithAI(
        equipment,
        metric,
        value,
        threshold,
        unit,
        `Molienda a ${telemetry.tch} TCH, Calderas a ${telemetry.boilerPressureHP} bar`
      );
      setDiagnosticResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setAnalyzingAnomaly(false);
    }
  };

  // Run combustion optimization
  const handleOptimizeCombustion = async () => {
    setOptimizingCombustion(true);
    try {
      const result = await optimizeCombustionWithAI(telemetry);
      setCombustionResult(result);
    } catch (e) {
      console.error(e);
    } finally {
      setOptimizingCombustion(false);
    }
  };

  // Send chat message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim()) return;

    const userText = inputPrompt;
    setInputPrompt("");
    setChatMessages((prev) => [
      ...prev,
      { sender: "user", text: userText, time: new Date().toLocaleTimeString().slice(0, 5) },
    ]);

    setSendingChat(true);
    try {
      const reply = await sendChatToAI(userText, telemetry);
      setChatMessages((prev) => [
        ...prev,
        { sender: "ai", text: reply, time: new Date().toLocaleTimeString().slice(0, 5) },
      ]);
    } catch (e) {
      console.error(e);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Centro de Inteligencia Artificial Industrial (Gemini 3.7)
          </h2>
          <p className="text-xs text-slate-400">
            Detección de anomalías en tiempo real, análisis de causa raíz y optimización de combustión & despacho eléctrico
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-indigo-400 animate-pulse" />
            Motor de IA Conectado
          </span>
        </div>
      </div>

      {/* Grid: 1. Anomaly Diagnosis | 2. Combustion Optimizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module 1: Anomaly Detector & Root-Cause Explainer (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                  Detección de Desviaciones & Diagnóstico IA
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                1 Evento Activo
              </span>
            </div>

            {/* Quick Test Buttons for Anomalies */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400">Analizar caso:</span>
              <button
                onClick={() =>
                  handleRunDiagnosis(
                    "Molino 3 - Extracción Intermedia",
                    "Vibración RMS en Chumacera Superior",
                    4.8,
                    4.5,
                    "mm/s"
                  )
                }
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono border border-slate-700 transition"
              >
                Molino 3 (Vibración 4.8 mm/s)
              </button>
              <button
                onClick={() =>
                  handleRunDiagnosis(
                    "Caldera Acuotubular 01",
                    "Presión de Vapor Alta Caída Rápida",
                    54.2,
                    64.0,
                    "bar"
                  )
                }
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono border border-slate-700 transition"
              >
                Caldera 1 (Presión 54 bar)
              </button>
              <button
                onClick={() =>
                  handleRunDiagnosis(
                    "Transportador de Bagazo Final",
                    "Humedad Excesiva de Bagazo",
                    53.8,
                    48.5,
                    "%"
                  )
                }
                className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono border border-slate-700 transition"
              >
                Bagazo (Humedad 53.8%)
              </button>
            </div>

            {/* Diagnostic Card */}
            {analyzingAnomaly ? (
              <div className="my-10 flex flex-col items-center justify-center text-center space-y-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-300 font-mono">
                  Gemini 3.7 procesando telemetría termodinámica y espectro de vibración...
                </span>
              </div>
            ) : diagnosticResult ? (
              <div className="mt-4 bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {diagnosticResult.equipment}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {diagnosticResult.metric}:{" "}
                      <strong className="text-amber-400">
                        {diagnosticResult.currentValue} {diagnosticResult.unit}
                      </strong>{" "}
                      (Límite: {diagnosticResult.threshold} {diagnosticResult.unit})
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      SEVERIDAD: {diagnosticResult.severity}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Confianza IA: {diagnosticResult.confidenceScore}%
                    </div>
                  </div>
                </div>

                {/* Root cause */}
                <div className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                  <strong className="text-indigo-300 block mb-1 uppercase tracking-wider text-[10px]">
                    Causa Raíz Identificada:
                  </strong>
                  <p className="leading-relaxed">{diagnosticResult.rootCause}</p>
                </div>

                {/* Immediate operator action */}
                <div className="text-xs bg-emerald-950/20 p-3 rounded-lg border border-emerald-500/30">
                  <strong className="text-emerald-300 block mb-1 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Acción Inmediata para Sala de Control (Operador DCS):
                  </strong>
                  <p className="text-emerald-200">{diagnosticResult.immediateAction}</p>
                </div>

                {/* Maintenance Recommendation */}
                <div className="text-xs bg-indigo-950/20 p-3 rounded-lg border border-indigo-500/30">
                  <strong className="text-indigo-300 block mb-1 uppercase tracking-wider text-[10px]">
                    Recomendación para Mantenimiento:
                  </strong>
                  <p className="text-slate-300">{diagnosticResult.maintenanceRecommendation}</p>
                </div>

                {/* Financial impact */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1 text-slate-300">
                    <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                    Impacto Financiero Estimado:
                  </span>
                  <span className="font-mono text-rose-400 font-bold">
                    {diagnosticResult.financialImpact}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Module 2: AI Combustion & Steam Optimizer (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                  Optimizador de Combustión & Despacho MW
                </h3>
              </div>
              <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                Termodinámica
              </span>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              Calcula la mezcla estequiométrica ideal de bagazo, exceso de aire y balance de vapor para maximizar los MWh exportados a la red eléctrica.
            </p>

            <div className="my-4 grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Presión Caldera</span>
                <span className="text-cyan-400 font-bold text-sm">{telemetry.boilerPressureHP} bar</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Flujo Vapor HP</span>
                <span className="text-white font-bold text-sm">{telemetry.steamFlowHP} t/h</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Humedad Bagazo</span>
                <span className="text-amber-400 font-bold text-sm">{telemetry.bagasseMoisture}%</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Potencia Eléctrica</span>
                <span className="text-yellow-400 font-bold text-sm">{telemetry.powerGeneratedMW} MW</span>
              </div>
            </div>

            <button
              onClick={handleOptimizeCombustion}
              disabled={optimizingCombustion}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {optimizingCombustion ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calculando Setpoints Óptimos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Calcular Setpoints Óptimos de Combustión</span>
                </>
              )}
            </button>

            {/* Results Display */}
            {combustionResult && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Alimentación Bagazo</span>
                    <span className="text-amber-300 font-bold">{combustionResult.optimalBagasseFeed}</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">Exceso Aire Óptimo</span>
                    <span className="text-cyan-300 font-bold">{combustionResult.optimalExcessAir}</span>
                  </div>
                </div>

                <div className="p-2.5 bg-emerald-950/30 rounded border border-emerald-500/30 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Ganancia Exportación:</span>
                  <span className="text-emerald-400 font-bold font-mono">
                    {combustionResult.gridExportGain}
                  </span>
                </div>

                <div className="space-y-1 mt-2 text-[11px] text-slate-400">
                  <strong className="text-slate-300 block text-[10px] uppercase tracking-wider">
                    Sugerencias Operativas:
                  </strong>
                  {combustionResult.suggestions.map((sug, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-slate-300">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{sug}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Module 3: Industrial AI Copilot Chat */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Asistente Consultor de Ingeniería y Operaciones Azucareras
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Pregunta sobre calderas de bagazo, tándem, evaporadores Robert, tachos o despacho eléctrico
          </span>
        </div>

        {/* Chat History Box */}
        <div className="h-64 overflow-y-auto bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
          {chatMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${
                msg.sender === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-2xl rounded-xl p-3 text-xs leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-emerald-600 text-white rounded-br-none"
                    : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                }`}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5 px-1">
                {msg.time} • {msg.sender === "user" ? "Operador" : "BioAzúcar AI"}
              </span>
            </div>
          ))}
          {sendingChat && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>BioAzúcar AI redactando análisis técnico...</span>
            </div>
          )}
        </div>

        {/* Chat input form */}
        <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2">
          <input
            type="text"
            placeholder="Ejemplo: ¿Cómo optimizar el consumo de vapor en el cuádruple efecto si la caña viene con bajo Brix?"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            className="flex-1 bg-slate-950 text-xs text-white rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
          />
          <button
            type="submit"
            disabled={sendingChat || !inputPrompt.trim()}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Consultar</span>
          </button>
        </form>
      </div>
    </div>
  );
};
