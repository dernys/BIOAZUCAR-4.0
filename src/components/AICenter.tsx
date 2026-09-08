import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  GitPullRequest,
  Zap,
  Radio,
  BrainCircuit,
  MessageSquare,
  AlertTriangle,
  Flame,
  Send,
  Loader2,
  CheckCircle2,
  DollarSign,
  Layers,
  ArrowRight,
} from "lucide-react";
import { TelemetryData, UserRole, TenantEnterprise, EquipmentItem, AlarmEvent } from "../types";
import { OperationalPredictionsView } from "./bioai/OperationalPredictionsView";
import { RootCauseAnalysisView } from "./bioai/RootCauseAnalysisView";
import { IndustrialRecommendationsView } from "./bioai/IndustrialRecommendationsView";
import { IndustrialGatewayStatusView } from "./bioai/IndustrialGatewayStatusView";
import {
  diagnoseAnomalyWithAI,
  optimizeCombustionWithAI,
  sendChatToAI,
  OptimizeCombustionResult,
} from "../services/aiService";

interface AICenterProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
  activeTenant?: TenantEnterprise;
  equipmentList?: EquipmentItem[];
  alarms?: AlarmEvent[];
  onNavigateToTab?: (tab: any) => void;
  onOpenCopilot?: () => void;
}

export type BioAiTab =
  | "operational_predictions"
  | "root_cause_analysis"
  | "recommendations"
  | "gateway_status"
  | "copilot_assistant";

export const AICenter: React.FC<AICenterProps> = ({
  telemetry,
  currentRole,
  activeTenant,
  equipmentList = [],
  alarms = [],
  onNavigateToTab,
  onOpenCopilot,
}) => {
  const [activeBioAiTab, setActiveBioAiTab] = useState<BioAiTab>("operational_predictions");

  // Combustion Optimizer state for copilot tab
  const [optimizingCombustion, setOptimizingCombustion] = useState<boolean>(false);
  const [combustionResult, setCombustionResult] = useState<OptimizeCombustionResult | null>(null);

  // AI Chat state for copilot tab
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "ai"; text: string; time: string }>>([
    {
      sender: "ai",
      text: `Hola, soy el AI Sugar Industry Engineer de BioAzúcar 4.0. Operando en "${activeTenant?.name || "Central Azucarero"}". Actualmente la molienda procesa ${telemetry.tch} TCH y exportamos ${telemetry.powerExportGridMW} MW al SEN. ¿Deseas consultar eficiencia energética de hoy, equipos con mayor riesgo, la causa de la última parada o recomendaciones operacionales?`,
      time: "15:40",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState<string>("");
  const [sendingChat, setSendingChat] = useState<boolean>(false);

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

  const quickQuestions = [
    "¿Cuál fue la eficiencia energética de hoy?",
    "¿Qué equipo tiene mayor riesgo?",
    "¿Qué ocurrió durante la última parada?",
    "¿Por qué disminuyó la producción?",
    "¿Qué recomendaciones tienes?",
  ];

  return (
    <div className="space-y-6">
      {/* Top Main Header: BioAI Intelligence Center */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-400">
              <BrainCircuit className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white font-tech tracking-wider flex items-center gap-2">
                BioAI Intelligence Engine
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-normal">
                  v4.2 Industrial Release
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Plataforma de inteligencia operacional para ingenios azucareros — Modelos termodinámicos, RCA automatizado y prescripción operativa
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right font-mono text-xs">
            <span className="text-slate-500">Ingenio Azucarero:</span>
            <span className="text-cyan-400 font-bold">
              {activeTenant?.name || "BioAzúcar Central"} ({activeTenant?.code || "CEN-01"})
            </span>
          </div>
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-emerald-500/20 font-mono"
            >
              <Sparkles className="w-4 h-4" />
              <span>Abrir Copilot Flotante</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Subtabs (MÓDULO 7) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveBioAiTab("operational_predictions")}
          className={`px-4 py-2 rounded-lg text-xs font-mono transition flex items-center gap-2 ${
            activeBioAiTab === "operational_predictions"
              ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Predicción Operacional</span>
        </button>

        <button
          onClick={() => setActiveBioAiTab("root_cause_analysis")}
          className={`px-4 py-2 rounded-lg text-xs font-mono transition flex items-center gap-2 ${
            activeBioAiTab === "root_cause_analysis"
              ? "bg-rose-600 text-white font-bold shadow-lg shadow-rose-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <GitPullRequest className="w-4 h-4" />
          <span>Diagnóstico Causa Raíz (RCA)</span>
        </button>

        <button
          onClick={() => setActiveBioAiTab("recommendations")}
          className={`px-4 py-2 rounded-lg text-xs font-mono transition flex items-center gap-2 ${
            activeBioAiTab === "recommendations"
              ? "bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Recomendaciones de Optimización</span>
        </button>

        <button
          onClick={() => setActiveBioAiTab("gateway_status")}
          className={`px-4 py-2 rounded-lg text-xs font-mono transition flex items-center gap-2 ${
            activeBioAiTab === "gateway_status"
              ? "bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>Conectividad OT (Gateways)</span>
        </button>

        <button
          onClick={() => setActiveBioAiTab("copilot_assistant")}
          className={`px-4 py-2 rounded-lg text-xs font-mono transition flex items-center gap-2 ${
            activeBioAiTab === "copilot_assistant"
              ? "bg-amber-600 text-white font-bold shadow-lg shadow-amber-600/30"
              : "bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800"
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>AI Sugar Industry Engineer</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeBioAiTab === "operational_predictions" && (
        <OperationalPredictionsView
          telemetry={telemetry}
          activeTenant={activeTenant}
          equipmentList={equipmentList}
          alarms={alarms}
        />
      )}

      {activeBioAiTab === "root_cause_analysis" && (
        <RootCauseAnalysisView
          telemetry={telemetry}
          activeTenant={activeTenant}
          alarms={alarms}
          equipmentList={equipmentList}
        />
      )}

      {activeBioAiTab === "recommendations" && (
        <IndustrialRecommendationsView
          telemetry={telemetry}
          activeTenant={activeTenant}
          alarms={alarms}
          equipmentList={equipmentList}
        />
      )}

      {activeBioAiTab === "gateway_status" && (
        <IndustrialGatewayStatusView />
      )}

      {activeBioAiTab === "copilot_assistant" && (
        <div className="space-y-6">
          {/* Combustion Quick Optimizer & Quick Queries */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick Combustion Optimizer (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                    Optimizador Termodinámico de Caldera
                  </h3>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded border border-amber-500/20">
                  ASME PTC 4
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-500 text-[10px] block">Presión Vapor HP</span>
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
                  <span className="text-slate-500 text-[10px] block">Generación Neta</span>
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
                    <span>Calculando Setpoints...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Calcular Consignas Óptimas</span>
                  </>
                )}
              </button>

              {combustionResult && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
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
                </div>
              )}
            </div>

            {/* AI Engineer Chat & Technical Question Prompts (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
                      Consultas Técnicas Industriales
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    Online
                  </span>
                </div>

                {/* Quick Sugared Technical Queries */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {quickQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => setInputPrompt(q)}
                      className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition font-sans"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Chat History Box */}
                <div className="h-60 overflow-y-auto bg-slate-950/80 rounded-xl p-4 border border-slate-800 space-y-3">
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex flex-col ${
                        msg.sender === "user" ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`max-w-xl rounded-xl p-3 text-xs leading-relaxed ${
                          msg.sender === "user"
                            ? "bg-emerald-600 text-white rounded-br-none"
                            : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                        }`}
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5 px-1">
                        {msg.time} • {msg.sender === "user" ? "Operador" : "AI Sugar Engineer"}
                      </span>
                    </div>
                  ))}
                  {sendingChat && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Analizando telemetría y formulando dictamen técnico...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chat Form */}
              <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Pregunta sobre molienda, vapor, turbinas o paradas..."
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  className="flex-1 bg-slate-950 text-xs text-white rounded-xl px-4 py-2.5 border border-slate-800 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={sendingChat || !inputPrompt.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 font-mono"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
