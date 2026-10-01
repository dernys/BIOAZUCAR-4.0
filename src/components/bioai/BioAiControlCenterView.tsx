import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Zap,
  DollarSign,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  Server,
  Cloud,
  HardDrive,
  Clock,
  Terminal,
  Search,
  Filter,
  Settings,
  Sliders,
  Database,
  FileText,
  Key,
  ShieldAlert,
  Play,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  BookOpen,
  PieChart,
  BarChart2,
  Workflow,
  Sparkles,
} from "lucide-react";
import { UserRole, TenantEnterprise } from "../../types";
import { AiModelGatewayService } from "../../services/ai/gateway/AiModelGatewayService";
import { aiPricingRegistry, AiPricingTier } from "../../services/ai/pricing/AiPricingRegistry";
import { aiModelRegistry, AiModelRecord } from "../../services/ai/models/AiModelRegistry";
import { aiProviderRegistry, AiProviderRecord, ProviderHealthStatus } from "../../services/ai/providers/AiProviderRegistry";
import { aiCostLedger, AiCostLedgerEntry, AiLedgerSummary } from "../../services/ai/ledger/AiCostLedger";
import { aiBudgetEngine, AiBudgetRule } from "../../services/ai/budget/AiBudgetEngine";
import { aiRouter, AiUseCase, AiComplexity, AiPrivacyLevel } from "../../services/ai/router/AiRouter";
import { aiPromptRegistry, PromptDefinition } from "../../services/ai/prompts/AiPromptRegistry";
import { aiRagGovernanceService, RagDocument, RagRetrievalTestResult } from "../../services/ai/rag/AiRagGovernanceService";
import { localAiComputeModel, STANDARD_HARDWARE_PROFILES } from "../../services/ai/local/LocalAiComputeModel";
import { copilotEvidenceEngine } from "../../copilot/services/CopilotEvidenceEngine";
import { COPILOT_TOOL_POLICIES } from "../../copilot/domain/CopilotPermissions";

export type BioAiControlCenterTab =
  | "overview"
  | "providers"
  | "models"
  | "connections"
  | "routing"
  | "fallback"
  | "budgets"
  | "tokens"
  | "cost_analytics"
  | "copilot"
  | "rag"
  | "tools"
  | "prompts"
  | "policies"
  | "local_ai"
  | "health"
  | "audit";

interface BioAiControlCenterViewProps {
  currentRole: UserRole;
  activeTenant?: TenantEnterprise;
  theme?: "dark" | "light";
}

export const BioAiControlCenterView: React.FC<BioAiControlCenterViewProps> = ({
  currentRole,
  activeTenant,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [activeTab, setActiveTab] = useState<BioAiControlCenterTab>("overview");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Live Subsystem States
  const [providers, setProviders] = useState<AiProviderRecord[]>(() => aiProviderRegistry.getAll());
  const [models, setModels] = useState<AiModelRecord[]>(() => aiModelRegistry.getAll());
  const [budgets, setBudgets] = useState<AiBudgetRule[]>(() => aiBudgetEngine.getAll());
  const [ledgerSummary, setLedgerSummary] = useState<AiLedgerSummary>(() => aiCostLedger.getSummary());
  const [ledgerEntries, setLedgerEntries] = useState<AiCostLedgerEntry[]>(() => aiCostLedger.getEntries(50));
  const [ragDocs, setRagDocs] = useState<RagDocument[]>(() => aiRagGovernanceService.getAllDocuments());
  const [prompts, setPrompts] = useState<PromptDefinition[]>(() => aiPromptRegistry.getAll());

  // Interactive states
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [modelTestResult, setModelTestResult] = useState<any | null>(null);
  const [routerSimUseCase, setRouterSimUseCase] = useState<AiUseCase>("OPERATIONAL_SUMMARY");
  const [routerSimComplexity, setRouterSimComplexity] = useState<AiComplexity>("MEDIUM");
  const [routerSimPrivacy, setRouterSimPrivacy] = useState<AiPrivacyLevel>("PUBLIC_CLOUD_ALLOWED");
  const [ragQuery, setRagQuery] = useState("caída de extracción de sacarosa tándem molinos");
  const [ragTestResult, setRagTestResult] = useState<RagRetrievalTestResult | null>(null);
  const [localHardware, setLocalHardware] = useState(() => localAiComputeModel.getConfig().hardwareId);
  const [electricityTariff, setElectricityTariff] = useState(() => localAiComputeModel.getConfig().electricityRateUsdPerKWh);

  const canManage = ["admin", "superadmin", "ciberseguridad"].includes(currentRole);

  const refreshAll = () => {
    setProviders(aiProviderRegistry.getAll());
    setModels(aiModelRegistry.getAll());
    setBudgets(aiBudgetEngine.getAll());
    setLedgerSummary(aiCostLedger.getSummary());
    setLedgerEntries(aiCostLedger.getEntries(50));
    setRagDocs(aiRagGovernanceService.getAllDocuments());
    setPrompts(aiPromptRegistry.getAll());
  };

  const showNotification = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleTestProvider = async (providerName: any) => {
    setTestingProvider(providerName);
    try {
      const res = await aiProviderRegistry.testConnection(providerName);
      refreshAll();
      showNotification(res.status === "HEALTHY" ? "success" : "error", `${res.message} (${res.latencyMs}ms)`);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleTestModelInference = async (modelId: string) => {
    setTestingModel(modelId);
    try {
      const res = await aiModelRegistry.testModel(modelId);
      setModelTestResult(res);
      refreshAll();
      showNotification("success", `Inferencia exitosa: ${res.tokens.total} tokens, $${res.costUsd.toFixed(6)} USD (${res.latencyMs}ms)`);
    } catch (e: any) {
      showNotification("error", e.message || "Error al probar modelo");
    } finally {
      setTestingModel(null);
    }
  };

  const handleRunRagTest = () => {
    const res = aiRagGovernanceService.testRetrieval(ragQuery, 3);
    setRagTestResult(res);
    showNotification("success", `Recuperados ${res.documentsRetrieved} fragmentos en ${res.retrievalLatencyMs}ms (Relevancia: ${(res.averageRelevanceScore * 100).toFixed(0)}%)`);
  };

  const handleResetBudgetSpend = (budgetId: string) => {
    aiBudgetEngine.resetSpend(budgetId);
    refreshAll();
    showNotification("success", "Contador de consumo restablecido a $0.00 USD");
  };

  const handleUpdateLocalCompute = (hw: string, tariff: number) => {
    setLocalHardware(hw);
    setElectricityTariff(tariff);
    localAiComputeModel.setConfig({
      hardwareId: hw,
      electricityRateUsdPerKWh: tariff,
    });
    showNotification("success", `Modelo de cómputo local actualizado: ${hw} @ $${tariff}/kWh`);
  };

  const tabs: Array<{ id: BioAiControlCenterTab; label: string; icon: any }> = [
    { id: "overview", label: "1. Overview", icon: Activity },
    { id: "providers", label: "2. Providers", icon: Cloud },
    { id: "models", label: "3. Models", icon: BrainCircuit },
    { id: "connections", label: "4. API Connections", icon: Key },
    { id: "routing", label: "5. Routing", icon: Workflow },
    { id: "fallback", label: "6. Fallback", icon: RotateCcw },
    { id: "budgets", label: "7. Budgets", icon: DollarSign },
    { id: "tokens", label: "8. Token Usage", icon: Layers },
    { id: "cost_analytics", label: "9. Cost Analytics", icon: BarChart2 },
    { id: "copilot", label: "10. Copilot", icon: Sparkles },
    { id: "rag", label: "11. RAG", icon: BookOpen },
    { id: "tools", label: "12. Tools", icon: Terminal },
    { id: "prompts", label: "13. Prompts", icon: FileText },
    { id: "policies", label: "14. Policies", icon: ShieldCheck },
    { id: "local_ai", label: "15. Local AI", icon: HardDrive },
    { id: "health", label: "16. Health", icon: Zap },
    { id: "audit", label: "17. Audit", icon: ShieldAlert },
  ];

  const currentRouteDecision = aiRouter.resolveRoute({
    useCase: routerSimUseCase,
    complexity: routerSimComplexity,
    privacyLevel: routerSimPrivacy,
    tenantId: activeTenant?.id,
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Notification Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white font-tech tracking-wide uppercase">
                BioAI Control Center
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                IEC 62443 SL3 • 17 Módulos
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Plataforma unificada de gobernanza, enrutamiento multi-proveedor, registro de modelos y costes de IA.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshAll}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sincronizar</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-300"
              : "bg-rose-950/60 border-rose-500/50 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Navigation Tab Bar (17 Modules) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-800 scrollbar-thin">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                  : "bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800/80"
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* =================================================================== */}
      {/* 1. OVERVIEW */}
      {/* =================================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Peticiones Totales</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white">{ledgerSummary.totalRequests}</span>
                <span className="text-xs text-emerald-400 font-semibold">{ledgerSummary.successfulRequests} exitosas</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Tokens Procesados</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-cyan-400">
                  {ledgerSummary.totalTokens.toLocaleString()}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {ledgerSummary.totalCachedTokens} cacheados
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Gasto Acumulado Real vs Est.</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-amber-400">
                  ${ledgerSummary.totalActualCostUsd.toFixed(4)}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  Est: ${ledgerSummary.totalEstimatedCostUsd.toFixed(4)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Latencia Media / Fallback</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold font-mono text-white">{ledgerSummary.latencyMetrics.avgMs} ms</span>
                <span className="text-xs text-purple-400 font-semibold">{ledgerSummary.fallbackRequests} fallbacks</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4 text-emerald-400" />
                <span>Proveedor Principal & Pasarela Activa</span>
              </h3>
              <p className="text-xs text-slate-400">
                Proveedor configurado por defecto para la planta: <strong className="text-emerald-400">Google Gemini</strong> con modelo de producción <strong className="text-cyan-400">gemini-2.5-flash</strong>.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleTestProvider("gemini")}
                  disabled={testingProvider !== null}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Probar Conexión Primaria</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("routing")}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Configurar Enrutador
                </button>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Estado de Presupuestos (Budget Engine)</span>
              </h3>
              <div className="space-y-2">
                {budgets.slice(0, 3).map((b) => (
                  <div key={b.id} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-slate-300">{b.displayName}</span>
                      <span className="text-amber-400">${b.currentSpendUsd.toFixed(2)} / ${b.monthlyBudgetUsd.toFixed(2)} USD</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${b.status === "CRITICAL" ? "bg-rose-500" : b.status === "WARNING" ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(100, (b.currentSpendUsd / b.monthlyBudgetUsd) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. PROVIDERS (P0-04) */}
      {/* =================================================================== */}
      {activeTab === "providers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Registro de Proveedores (Sin Exposición de Secretos)
            </h3>
            <span className="text-xs text-slate-400">IEC 62443 SL3: Secreto referenciado vía secretRef</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((p) => {
              const isTesting = testingProvider === p.provider;
              return (
                <div key={p.provider} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-white">{p.displayName}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        p.healthStatus === "HEALTHY"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : p.healthStatus === "CONFIGURED"
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                          : p.healthStatus === "NOT_CONFIGURED"
                          ? "bg-slate-800 text-slate-400"
                          : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      }`}
                    >
                      {p.healthStatus}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs font-mono text-slate-400">
                    <div>Ref Secreto: <strong className="text-amber-300">{p.secretRef}</strong></div>
                    <div>Endpoint: <span className="text-slate-300 truncate block">{p.endpointUrl}</span></div>
                    {p.latencyMs && <div>Latencia: <span className="text-cyan-400">{p.latencyMs} ms</span></div>}
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleTestProvider(p.provider)}
                      disabled={isTesting}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <Play className="w-3 h-3 text-emerald-400" />
                      <span>{isTesting ? "Probando..." : "Test Connection"}</span>
                    </button>
                    <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={p.enabled}
                        onChange={(e) => {
                          aiProviderRegistry.setEnabled(p.provider, e.target.checked);
                          refreshAll();
                        }}
                        className="rounded accent-emerald-500"
                      />
                      <span>Habilitado</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. MODELS (P0-03) */}
      {/* =================================================================== */}
      {activeTab === "models" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Catálogo de Modelos de Inteligencia Artificial (Model Registry)
            </h3>
            <span className="text-xs text-slate-400 font-mono">{models.length} modelos registrados</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Modelo / Nombre</th>
                  <th className="p-3">Proveedor</th>
                  <th className="p-3">Contexto</th>
                  <th className="p-3">Precios (In / Out por 1k)</th>
                  <th className="p-3">Capacidades</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                {models.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40">
                    <td className="p-3">
                      <div className="font-bold text-white font-sans">{m.displayName}</div>
                      <div className="text-[11px] text-slate-400">{m.modelId} (v{m.version})</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[10px]">
                        {m.provider}
                      </span>
                    </td>
                    <td className="p-3">{m.contextWindow.toLocaleString()} tokens</td>
                    <td className="p-3 text-[11px]">
                      <div>In: ${m.inputPrice.toFixed(6)}</div>
                      <div>Out: ${m.outputPrice.toFixed(6)}</div>
                    </td>
                    <td className="p-3 font-sans">
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {m.capabilities.vision && <span className="px-1 rounded bg-slate-800 text-slate-300">Vision</span>}
                        {m.capabilities.tools && <span className="px-1 rounded bg-emerald-950 text-emerald-300">Tools</span>}
                        {m.capabilities.structuredOutput && <span className="px-1 rounded bg-indigo-950 text-indigo-300">JSON</span>}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">
                        {m.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleTestModelInference(m.id)}
                        disabled={testingModel === m.id}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
                      >
                        {testingModel === m.id ? "Testando..." : "Test Model"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {modelTestResult && (
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2">
              <span className="text-xs font-bold text-emerald-400 font-mono block">Resultado de Inferencia del Modelo:</span>
              <p className="text-xs text-slate-200">{modelTestResult.output}</p>
              <div className="text-[11px] font-mono text-slate-400 flex gap-4">
                <span>Tokens: {modelTestResult.tokens.total}</span>
                <span>Coste: ${modelTestResult.costUsd.toFixed(6)} USD</span>
                <span>Latencia: {modelTestResult.latencyMs} ms</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* 4. CONNECTIONS (P0-04) */}
      {/* =================================================================== */}
      {activeTab === "connections" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
            Conexiones API & Almacenamiento Seguro de Credenciales
          </h3>
          <p className="text-xs text-slate-400">
            Siguiendo las restricciones de seguridad IEC 62443 SL3 y AI Studio Build, ninguna API Key reside en Firestore ni en memoria del frontend. Todas las credenciales son referenciadas mediante indirección en el proxy backend (server.ts).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((p) => (
              <div key={p.provider} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="font-bold text-white font-sans">{p.displayName}</span>
                  <span className="text-cyan-400">{p.apiVersion || "v1"}</span>
                </div>
                <div>URL Base: <span className="text-slate-300">{p.endpointUrl}</span></div>
                <div>Variable de Entorno: <span className="text-amber-300">{p.secretRef}</span></div>
                <div>Tipo de Aislamiento: <span className="text-emerald-400">{p.isLocalOnPremise ? "Air-Gapped On-Premise" : "VPC Cloud Server Proxy"}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 5. ROUTING (P0-08) */}
      {/* =================================================================== */}
      {activeTab === "routing" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4 text-emerald-400" />
              <span>Simulador de Enrutamiento Inteligente (AI Router)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Caso de Uso (Use Case):</label>
                <select
                  value={routerSimUseCase}
                  onChange={(e) => setRouterSimUseCase(e.target.value as AiUseCase)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="SIMPLE_QUERY">SIMPLE_QUERY (Consulta breve)</option>
                  <option value="OPERATIONAL_SUMMARY">OPERATIONAL_SUMMARY (Resumen SCADA)</option>
                  <option value="RCA">RCA (Análisis Causa Raíz)</option>
                  <option value="DOCUMENT_QA">DOCUMENT_QA (Consulta RAG SOP)</option>
                  <option value="OFFLINE">OFFLINE (Sin conexión / Autonomía)</option>
                  <option value="PRIVATE_OT">PRIVATE_OT (Privacidad industrial estricta)</option>
                  <option value="CRITICAL_OPERATIONAL">CRITICAL_OPERATIONAL (Operación crítica)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Complejidad:</label>
                <select
                  value={routerSimComplexity}
                  onChange={(e) => setRouterSimComplexity(e.target.value as AiComplexity)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="LOW">LOW (Baja)</option>
                  <option value="MEDIUM">MEDIUM (Media)</option>
                  <option value="HIGH">HIGH (Alta)</option>
                  <option value="CRITICAL">CRITICAL (Crítica)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Nivel de Privacidad:</label>
                <select
                  value={routerSimPrivacy}
                  onChange={(e) => setRouterSimPrivacy(e.target.value as AiPrivacyLevel)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  <option value="PUBLIC_CLOUD_ALLOWED">PUBLIC_CLOUD_ALLOWED (Nube pública)</option>
                  <option value="CONFIDENTIAL_TENANT">CONFIDENTIAL_TENANT (VPC inquilino)</option>
                  <option value="AIR_GAPPED_OT_ONLY">AIR_GAPPED_OT_ONLY (Solo On-Premise local)</option>
                </select>
              </div>
            </div>

            {/* Router Decision Card */}
            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  Decisión de Enrutamiento en Tiempo Real
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[10px]">
                  Política: {currentRouteDecision.policyApplied}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs pt-1">
                <div>Proveedor Seleccionado: <strong className="text-white block">{currentRouteDecision.selectedProvider}</strong></div>
                <div>Modelo Seleccionado: <strong className="text-cyan-400 block">{currentRouteDecision.selectedModel}</strong></div>
                <div>Cadena de Fallback: <span className="text-slate-400 block">{currentRouteDecision.fallbackChain.join(" ➔ ")}</span></div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300 font-sans">
                <strong>Fundamento del Enrutamiento (Rationale):</strong> {currentRouteDecision.routingRationale}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 6. FALLBACK (P0-08) */}
      {/* =================================================================== */}
      {activeTab === "fallback" && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
            Cadena de Conmutación por Fallo (Fallback Chain)
          </h3>
          <p className="text-xs text-slate-400">
            Si el proveedor primario falla, agota su cuota o excede el timeout de 20s, la llamada conmuta automáticamente en cascada sin interrumpir la operación del ingenio.
          </p>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">NIVEL 1 (Primario):</span>
              <span className="text-white">Google Gemini (gemini-2.5-flash)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 font-bold">NIVEL 2 (Local Edge Fallback):</span>
              <span className="text-white">Ollama Local On-Premise (llama3.2)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">NIVEL 3 (Harness Determinista):</span>
              <span className="text-white">Mock Industrial Adapter (mock-industrial-v1)</span>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 7. BUDGETS (P0-07) */}
      {/* =================================================================== */}
      {activeTab === "budgets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Motor de Presupuestos y Cuotas Multi-Nivel (AiBudgetEngine)
            </h3>
            <span className="text-xs text-slate-400">Acciones al exceder: BLOCK, FALLBACK_TO_LOCAL, SWITCH_TO_CHEAPER_MODEL</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {budgets.map((b) => (
              <div key={b.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{b.displayName}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      b.status === "OK"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : b.status === "WARNING"
                        ? "bg-amber-500/10 text-amber-400"
                        : "bg-rose-500/10 text-rose-400"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Alcance: {b.scope} ({b.targetId})</span>
                    <span className="text-amber-400">${b.currentSpendUsd.toFixed(2)} / ${b.monthlyBudgetUsd.toFixed(2)} USD</span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${b.status === "CRITICAL" || b.status === "EXCEEDED" ? "bg-rose-500" : b.status === "WARNING" ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(100, (b.currentSpendUsd / b.monthlyBudgetUsd) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                  <span>Acción al exceder: <strong className="text-cyan-300 font-mono">{b.exceededAction}</strong></span>
                  <button
                    type="button"
                    onClick={() => handleResetBudgetSpend(b.id)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
                  >
                    Reset Spend
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 8. TOKEN USAGE & 9. COST ANALYTICS (P0-06) */}
      {/* =================================================================== */}
      {(activeTab === "tokens" || activeTab === "cost_analytics") && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 text-xs block">Tokens Prompt / Entrada:</span>
              <span className="text-2xl font-bold text-white">{ledgerSummary.totalPromptTokens.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 text-xs block">Tokens Cacheados (Descuento 75%):</span>
              <span className="text-2xl font-bold text-cyan-400">{ledgerSummary.totalCachedTokens.toLocaleString()}</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 text-xs block">Tokens Completado / Salida:</span>
              <span className="text-2xl font-bold text-emerald-400">{ledgerSummary.totalCompletionTokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Desglose de Costes por Inquilino (Tenant) y Módulo
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
              <div>
                <span className="text-slate-400 block mb-2 font-bold">Por Inquilino (Tenant):</span>
                {Object.entries(ledgerSummary.costByTenant).map(([tenant, cost]) => (
                  <div key={tenant} className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">{tenant}</span>
                    <span className="text-amber-400 font-bold">${Number(cost).toFixed(6)} USD</span>
                  </div>
                ))}
              </div>
              <div>
                <span className="text-slate-400 block mb-2 font-bold">Por Módulo Visual:</span>
                {Object.entries(ledgerSummary.costByModule).map(([mod, cost]) => (
                  <div key={mod} className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-slate-300">{mod}</span>
                    <span className="text-cyan-400 font-bold">${Number(cost).toFixed(6)} USD</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 10. COPILOT (P0-09, P0-10, P0-11) */}
      {/* =================================================================== */}
      {activeTab === "copilot" && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>Simulación de Diagnóstico Causal Multi-Variable (P0-11)</span>
            </h3>
            <p className="text-xs text-slate-300">
              Cuando el usuario pregunta: <em>"¿Por qué bajó la extracción?"</em>, el Copilot correlaciona:
              <br />
              <code className="text-cyan-400 font-mono text-[11px]">
                Historian ➔ extraction ➔ TCH ➔ imbibition ➔ hydraulic pressure ➔ torque ➔ motor current ➔ bagasse moisture ➔ alarms ➔ maintenance ➔ baseline comparison ➔ RCA ➔ RAG/SOP
              </code>
            </p>

            <button
              type="button"
              onClick={async () => {
                const res = await copilotEvidenceEngine.executeExtractionDropRca({
                  tenantId: activeTenant?.id || "TENANT_PORTUGUESA",
                  tenantName: activeTenant?.name || "Central Portuguesa",
                  currentRole,
                  telemetry: {} as any,
                  alarms: [],
                  equipmentList: [],
                });
                showNotification("success", `RCA generado con ${res.evidenceSources.length} fuentes y confianza ${res.confidencePercent}%`);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition"
            >
              <Play className="w-4 h-4" />
              <span>Ejecutar Test RCA: "¿Por qué bajó la extracción?"</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 11. RAG (P0-12) */}
      {/* =================================================================== */}
      {activeTab === "rag" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-cyan-400" />
                <span>RAG Governance & Repositorio de Documentos Industriales</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  const res = aiRagGovernanceService.reindexAll();
                  refreshAll();
                  showNotification("success", `Reindexados ${res.indexedCount} documentos (${res.totalTokens} tokens)`);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Reindexar Corpus</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                placeholder="Probar consulta RAG..."
                className="flex-1 p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleRunRagTest}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
              >
                Test Retrieval
              </button>
            </div>

            {ragTestResult && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-cyan-400">
                  <span>Relevancia Media: {(ragTestResult.averageRelevanceScore * 100).toFixed(0)}%</span>
                  <span>Latencia: {ragTestResult.retrievalLatencyMs} ms</span>
                  <span>Tokens: {ragTestResult.tokenUsage}</span>
                </div>
                <div className="space-y-2 pt-2">
                  {ragTestResult.chunksRetrieved.map((c) => (
                    <div key={c.chunkId} className="p-2.5 rounded bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="font-bold text-white flex justify-between">
                        <span>{c.documentTitle}</span>
                        <span className="text-emerald-400 font-mono">{(c.relevanceScore * 100).toFixed(0)}% match</span>
                      </div>
                      <p className="text-slate-400 text-[11px] font-sans">{c.snippet}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ragDocs.map((doc) => (
              <div key={doc.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="font-bold text-white font-sans">{doc.title}</div>
                <div className="text-slate-400 text-[11px]">Tipo: <span className="text-cyan-300">{doc.documentType}</span> (v{doc.version})</div>
                <div className="text-slate-400 text-[11px]">Área: <span className="text-emerald-400">{doc.plantArea}</span> • {doc.chunksCount} fragmentos</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 12. TOOLS (P0-09) */}
      {/* =================================================================== */}
      {activeTab === "tools" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Catálogo de Herramientas Industriales Controladas (P0-09)
            </h3>
            <span className="text-xs text-slate-400">16 Herramientas con Validación de Esquema & RBAC</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(COPILOT_TOOL_POLICIES).slice(0, 16).map(([tName, policy]) => (
              <div key={tName} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400 font-mono">{tName}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">Nivel {policy.level}</span>
                </div>
                <p className="text-slate-300 text-[11px] font-sans">{policy.description}</p>
                <div className="text-[10px] text-slate-500 font-mono">
                  Permiso: {policy.requiredPermissions.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 13. PROMPTS (P0-13) */}
      {/* =================================================================== */}
      {activeTab === "prompts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Registro y Gobernanza de Prompts (Prompt Registry)
            </h3>
            <span className="text-xs text-slate-400 font-mono">{prompts.length} prompts auditados</span>
          </div>

          <div className="space-y-4">
            {prompts.map((p) => (
              <div key={p.promptId} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-white">{p.displayName}</span>
                    <span className="text-xs text-slate-400 font-mono ml-2">({p.promptId} v{p.version})</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400">
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400">{p.purpose}</p>
                <div className="p-3 bg-slate-950 rounded-lg text-slate-300 font-mono text-[11px] max-h-32 overflow-y-auto">
                  {p.systemPrompt}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                  <span>Aprobado por: <strong className="text-cyan-300">{p.approvedBy || "Pendiente"}</strong></span>
                  <span>Modelo objetivo: <strong className="text-emerald-300">{p.targetModel}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 14. POLICIES & 15. LOCAL AI (P0-15 & P0-17) */}
      {/* =================================================================== */}
      {activeTab === "local_ai" && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span>Modelo de Consumo Energético On-Premise (Ollama Compute Model)</span>
            </h3>
            <p className="text-xs text-slate-400">
              No reportamos simplemente <code>Ollama = $0</code>. El cómputo local consume energía eléctrica industrial modelada en base al TDP de los aceleradores y la tarifa $/kWh.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Perfil de Hardware:</label>
                <select
                  value={localHardware}
                  onChange={(e) => handleUpdateLocalCompute(e.target.value, electricityTariff)}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                >
                  {Object.entries(STANDARD_HARDWARE_PROFILES).map(([key, prof]) => (
                    <option key={key} value={key}>
                      {prof.name} ({prof.tdpWatts}W)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Tarifa Eléctrica ($/kWh):</label>
                <input
                  type="number"
                  step="0.01"
                  value={electricityTariff}
                  onChange={(e) => handleUpdateLocalCompute(localHardware, Number(e.target.value))}
                  className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-3 font-mono text-xs text-center">
              <div>
                <span className="text-slate-400 block text-[10px]">API COST</span>
                <span className="text-emerald-400 font-bold text-sm">$0.000000</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">LOCAL COMPUTE COST (1h)</span>
                <span className="text-amber-400 font-bold text-sm">
                  ${((STANDARD_HARDWARE_PROFILES[localHardware]?.tdpWatts || 450) / 1000 * electricityTariff).toFixed(4)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">TOTAL ESTIMATED COST</span>
                <span className="text-cyan-400 font-bold text-sm">
                  ${((STANDARD_HARDWARE_PROFILES[localHardware]?.tdpWatts || 450) / 1000 * electricityTariff).toFixed(4)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 16. HEALTH & 17. AUDIT (P0-06 & P0-14) */}
      {/* =================================================================== */}
      {(activeTab === "health" || activeTab === "audit" || activeTab === "policies") && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Libro Mayor de Auditoría de Costes y Trazabilidad (AiCostLedger)
            </h3>
            <span className="text-xs text-slate-400 font-mono">{ledgerEntries.length} transacciones registradas</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="p-3">Timestamp / Request</th>
                  <th className="p-3">Módulo / Caso de Uso</th>
                  <th className="p-3">Proveedor & Modelo</th>
                  <th className="p-3">Tokens (In / Out / Cache)</th>
                  <th className="p-3">Coste Est. vs Real</th>
                  <th className="p-3">Latencia</th>
                  <th className="p-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {ledgerEntries.slice(0, 15).map((e) => (
                  <tr key={e.requestId} className="hover:bg-slate-800/40">
                    <td className="p-3 text-[11px]">
                      <div>{new Date(e.timestamp).toLocaleTimeString()}</div>
                      <div className="text-[10px] text-slate-500">{e.requestId}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-white font-bold">{e.module}</div>
                      <div className="text-[10px] text-slate-400">{e.useCase}</div>
                    </td>
                    <td className="p-3">
                      <div className="text-cyan-300">{e.provider}</div>
                      <div className="text-[10px] text-slate-400">{e.model}</div>
                    </td>
                    <td className="p-3 text-[11px]">
                      <div>{e.tokens.totalTokens} tot</div>
                      <div className="text-[10px] text-slate-500">
                        {e.tokens.promptTokens} in / {e.tokens.completionTokens} out
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-amber-400 font-bold">${e.estimatedCostUsd.toFixed(6)}</div>
                      {e.costVarianceUsd !== null && (
                        <div className="text-[10px] text-slate-500">Δ ${e.costVarianceUsd.toFixed(6)}</div>
                      )}
                    </td>
                    <td className="p-3">{e.latencyMs} ms</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          e.status === "SUCCESS"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : e.status === "FALLBACK"
                            ? "bg-purple-500/10 text-purple-400"
                            : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
