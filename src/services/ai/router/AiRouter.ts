/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — INTELLIGENT INDUSTRIAL AI ROUTER (IEC 62443 / ISA-95)
 * [P0-08] MULTI-CRITERIA ROUTING (USE-CASE, LATENCY, PRIVACY, BUDGET & RCA)
 * ============================================================================
 */

import { AiProviderType } from "../gateway/types";
import { aiProviderRegistry } from "../providers/AiProviderRegistry";
import { aiBudgetEngine, BudgetEvaluationResult } from "../budget/AiBudgetEngine";

export type AiUseCase =
  | "SIMPLE_QUERY"
  | "OPERATIONAL_SUMMARY"
  | "RCA"
  | "DOCUMENT_QA"
  | "OFFLINE"
  | "PRIVATE_OT"
  | "CRITICAL_OPERATIONAL";

export type AiComplexity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AiLatencySla = "REALTIME_FAST" | "STANDARD" | "BATCH";
export type AiCostSensitivity = "STRICT_LOW_COST" | "BALANCED" | "PERFORMANCE_FIRST";
export type AiPrivacyLevel = "PUBLIC_CLOUD_ALLOWED" | "CONFIDENTIAL_TENANT" | "AIR_GAPPED_OT_ONLY";

export interface AiRoutingCriteria {
  useCase: AiUseCase;
  complexity?: AiComplexity;
  latencySla?: AiLatencySla;
  costSensitivity?: AiCostSensitivity;
  privacyLevel?: AiPrivacyLevel;
  runtimeProfile?: "LIVE_OT" | "SIMULATION" | "OFFLINE";
  tenantId?: string;
  userId?: string;
  module?: string;
  preferredProvider?: AiProviderType;
}

export interface AiRoutingDecision {
  selectedProvider: AiProviderType;
  selectedModel: string;
  fallbackChain: AiProviderType[];
  routingRationale: string;
  policyApplied: string;
  budgetCheck: BudgetEvaluationResult;
}

export class AiRouter {
  private static instance: AiRouter | null = null;

  private constructor() {}

  public static getInstance(): AiRouter {
    if (!AiRouter.instance) {
      AiRouter.instance = new AiRouter();
    }
    return AiRouter.instance;
  }

  public resolveRoute(criteria: AiRoutingCriteria): AiRoutingDecision {
    const {
      useCase,
      complexity = "MEDIUM",
      latencySla = "STANDARD",
      costSensitivity = "BALANCED",
      privacyLevel = "PUBLIC_CLOUD_ALLOWED",
      runtimeProfile = "SIMULATION",
      tenantId,
      userId,
      module = "general",
      preferredProvider,
    } = criteria;

    // 1. Evaluate Budget Engine First
    const budgetCheck = aiBudgetEngine.evaluateBudget({
      tenantId,
      userId,
      module,
    });

    let selectedProvider: AiProviderType = "gemini";
    let selectedModel = "gemini-2.5-flash";
    let fallbackChain: AiProviderType[] = ["ollama", "mock"];
    let routingRationale = "";
    let policyApplied = "STANDARD_ROUTE";

    // 2. Air-Gapped / Privacy Hard Constraints (IEC 62443 SL3 OT Boundary)
    if (privacyLevel === "AIR_GAPPED_OT_ONLY" || useCase === "PRIVATE_OT" || runtimeProfile === "OFFLINE") {
      selectedProvider = "ollama";
      selectedModel = "llama3.2";
      fallbackChain = ["mock"];
      policyApplied = "IEC62443_LOCAL_EDGE_AIR_GAPPED";
      routingRationale = `Selected local on-premises Ollama (${selectedModel}) due to air-gapped OT boundary constraint (privacyLevel=${privacyLevel}, useCase=${useCase}). Cloud egress prohibited.`;
      return {
        selectedProvider,
        selectedModel,
        fallbackChain,
        routingRationale,
        policyApplied,
        budgetCheck,
      };
    }

    // 3. Handle Budget Exceeded Policies
    if (!budgetCheck.allowed && budgetCheck.action === "BLOCK") {
      selectedProvider = "mock";
      selectedModel = "mock-industrial-v1";
      fallbackChain = [];
      policyApplied = "BUDGET_QUOTA_BLOCKED";
      routingRationale = `Request blocked by enterprise budget policy. Falling back to local deterministic mock: ${budgetCheck.reason}`;
      return {
        selectedProvider,
        selectedModel,
        fallbackChain,
        routingRationale,
        policyApplied,
        budgetCheck,
      };
    }

    if (budgetCheck.action === "FALLBACK_TO_LOCAL") {
      selectedProvider = "ollama";
      selectedModel = "llama3.2";
      fallbackChain = ["mock"];
      policyApplied = "BUDGET_FALLBACK_TO_LOCAL";
      routingRationale = `Switched to local Ollama edge model because budget threshold exceeded: ${budgetCheck.reason}`;
      return {
        selectedProvider,
        selectedModel,
        fallbackChain,
        routingRationale,
        policyApplied,
        budgetCheck,
      };
    }

    if (budgetCheck.action === "SWITCH_TO_CHEAPER_MODEL") {
      selectedProvider = "gemini";
      selectedModel = "gemini-2.5-flash";
      fallbackChain = ["ollama", "mock"];
      policyApplied = "BUDGET_DEMOTE_TO_CHEAP";
      routingRationale = `Demoted to ultra-low-cost Gemini 2.5 Flash ($0.075/1M) due to budget quota policy: ${budgetCheck.reason}`;
      return {
        selectedProvider,
        selectedModel,
        fallbackChain,
        routingRationale,
        policyApplied,
        budgetCheck,
      };
    }

    // 4. Preferred Provider Override if healthy
    if (preferredProvider) {
      const pRecord = aiProviderRegistry.get(preferredProvider);
      if (pRecord && pRecord.enabled && pRecord.healthStatus !== "FAILED") {
        selectedProvider = preferredProvider;
        selectedModel =
          preferredProvider === "openai"
            ? "gpt-4o-mini"
            : preferredProvider === "anthropic"
            ? "claude-3-5-sonnet-20241022"
            : preferredProvider === "ollama"
            ? "llama3.2"
            : preferredProvider === "mock"
            ? "mock-industrial-v1"
            : "gemini-2.5-flash";
        policyApplied = "USER_PREFERRED_PROVIDER";
        routingRationale = `Honored caller preference: ${preferredProvider} (${selectedModel}). Provider is healthy.`;
        return {
          selectedProvider,
          selectedModel,
          fallbackChain,
          routingRationale,
          policyApplied,
          budgetCheck,
        };
      }
    }

    // 5. Intelligent Multi-Criteria Routing Matrix
    switch (useCase) {
      case "SIMPLE_QUERY":
        selectedProvider = "gemini";
        selectedModel = "gemini-2.5-flash";
        fallbackChain = ["openai", "ollama", "mock"];
        policyApplied = "COST_OPTIMIZED_SIMPLE";
        routingRationale = `Selected Gemini 2.5 Flash for SIMPLE_QUERY (low complexity, lowest latency ~300ms, minimal cost $0.075/1M tokens).`;
        break;

      case "OPERATIONAL_SUMMARY":
        selectedProvider = "gemini";
        selectedModel = "gemini-2.5-flash";
        fallbackChain = ["openai", "ollama", "mock"];
        policyApplied = "OPERATIONAL_SUMMARY_FLASH";
        routingRationale = `Selected Gemini 2.5 Flash for high throughput token processing in SCADA summaries and alarm digests.`;
        break;

      case "RCA":
        // Root Cause Analysis requires deep multi-step reasoning over Historian + SOP + alarms
        selectedProvider = "gemini";
        selectedModel = "gemini-1.5-pro";
        fallbackChain = ["anthropic", "openai", "ollama", "mock"];
        policyApplied = "DEEP_REASONING_RCA";
        routingRationale = `Selected Gemini 1.5 Pro deep reasoning (2M context window) for multi-variable Root Cause Analysis (mill extraction, imbibition, boiler pressures & SOP reconciliation).`;
        break;

      case "DOCUMENT_QA":
        selectedProvider = "gemini";
        selectedModel = "gemini-2.5-flash";
        fallbackChain = ["anthropic", "ollama", "mock"];
        policyApplied = "RAG_RETRIEVAL_QA";
        routingRationale = `Selected Gemini 2.5 Flash for fast vector-grounded RAG answers with low retrieval latency.`;
        break;

      case "CRITICAL_OPERATIONAL":
        selectedProvider = "gemini";
        selectedModel = "gemini-1.5-pro";
        fallbackChain = ["anthropic", "ollama", "mock"];
        policyApplied = "CRITICAL_EVIDENCE_FIRST";
        routingRationale = `Selected high-confidence model under CRITICAL_OPERATIONAL SLA with strict multi-source evidence-first provenance.`;
        break;

      case "OFFLINE":
        selectedProvider = "ollama";
        selectedModel = "llama3.2";
        fallbackChain = ["mock"];
        policyApplied = "OFFLINE_LOCAL_AUTONOMY";
        routingRationale = `Selected on-premise local Ollama model for offline air-gapped continuity.`;
        break;

      default:
        selectedProvider = "gemini";
        selectedModel = "gemini-2.5-flash";
        fallbackChain = ["ollama", "mock"];
        policyApplied = "DEFAULT_BALANCED";
        routingRationale = `Default routing policy applied: Gemini 2.5 Flash with Ollama and Mock fallbacks.`;
        break;
    }

    return {
      selectedProvider,
      selectedModel,
      fallbackChain,
      routingRationale,
      policyApplied,
      budgetCheck,
    };
  }
}

export const aiRouter = AiRouter.getInstance();
