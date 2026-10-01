/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — AI BUDGET & QUOTA ENFORCEMENT ENGINE (IEC 62443 / ISA-95)
 * [P0-07] CONFIGURABLE MULTI-TIER BUDGETS & AUTOMATIC DEFENSE POLICIES
 * ============================================================================
 */

export type BudgetScope = "GLOBAL" | "TENANT" | "USER" | "MODULE" | "PROVIDER" | "MODEL";
export type BudgetStatus = "OK" | "WARNING" | "CRITICAL" | "EXCEEDED";
export type BudgetExceededAction =
  | "BLOCK"
  | "FALLBACK_TO_LOCAL"
  | "SWITCH_TO_CHEAPER_MODEL"
  | "REQUIRE_ADMIN_APPROVAL";

export interface AiBudgetRule {
  id: string;
  scope: BudgetScope;
  targetId: string; // e.g. "*" for GLOBAL, "TENANT_PORTUGUESA", "usr-01", "scada", "gemini", etc.
  displayName: string;
  monthlyBudgetUsd: number;
  currentSpendUsd: number;
  currency: "USD";
  warningThresholdPercent: number; // default 80
  criticalThresholdPercent: number; // default 90
  exceededAction: BudgetExceededAction;
  status: BudgetStatus;
  enabled: boolean;
  lastEvaluatedAt: string;
  notes?: string;
}

export interface BudgetEvaluationResult {
  allowed: boolean;
  action: "PROCEED" | BudgetExceededAction;
  reason?: string;
  matchingBudgets: Array<{
    id: string;
    scope: BudgetScope;
    targetId: string;
    budgetUsd: number;
    spendUsd: number;
    percent: number;
    status: BudgetStatus;
  }>;
}

export class AiBudgetEngine {
  private static instance: AiBudgetEngine | null = null;
  private budgets = new Map<string, AiBudgetRule>();

  private constructor() {
    this.seedDefaultBudgets();
  }

  public static getInstance(): AiBudgetEngine {
    if (!AiBudgetEngine.instance) {
      AiBudgetEngine.instance = new AiBudgetEngine();
    }
    return AiBudgetEngine.instance;
  }

  private seedDefaultBudgets(): void {
    const defaults: AiBudgetRule[] = [
      {
        id: "budget-global",
        scope: "GLOBAL",
        targetId: "*",
        displayName: "Presupuesto Global Corporativo BioAzúcar",
        monthlyBudgetUsd: 500.0,
        currentSpendUsd: 18.45,
        currency: "USD",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 90,
        exceededAction: "SWITCH_TO_CHEAPER_MODEL",
        status: "OK",
        enabled: true,
        lastEvaluatedAt: new Date().toISOString(),
        notes: "Límite global mensual de inferencia en la nube",
      },
      {
        id: "budget-tenant-portuguesa",
        scope: "TENANT",
        targetId: "TENANT_PORTUGUESA",
        displayName: "Central Portuguesa (Zafra Activa)",
        monthlyBudgetUsd: 200.0,
        currentSpendUsd: 12.8,
        currency: "USD",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 90,
        exceededAction: "FALLBACK_TO_LOCAL",
        status: "OK",
        enabled: true,
        lastEvaluatedAt: new Date().toISOString(),
      },
      {
        id: "budget-module-copilot",
        scope: "MODULE",
        targetId: "copilot",
        displayName: "Copilot & Consultas Asistidas",
        monthlyBudgetUsd: 150.0,
        currentSpendUsd: 8.35,
        currency: "USD",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 90,
        exceededAction: "SWITCH_TO_CHEAPER_MODEL",
        status: "OK",
        enabled: true,
        lastEvaluatedAt: new Date().toISOString(),
      },
      {
        id: "budget-provider-gemini",
        scope: "PROVIDER",
        targetId: "gemini",
        displayName: "Proveedor Google Gemini Cloud",
        monthlyBudgetUsd: 300.0,
        currentSpendUsd: 15.2,
        currency: "USD",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 90,
        exceededAction: "FALLBACK_TO_LOCAL",
        status: "OK",
        enabled: true,
        lastEvaluatedAt: new Date().toISOString(),
      },
    ];

    for (const b of defaults) {
      this.budgets.set(b.id, b);
    }
  }

  public getAll(): AiBudgetRule[] {
    return Array.from(this.budgets.values());
  }

  public getById(id: string): AiBudgetRule | undefined {
    return this.budgets.get(id);
  }

  public createBudget(data: Omit<AiBudgetRule, "status" | "lastEvaluatedAt">): AiBudgetRule {
    const status = this.calculateStatus(data.currentSpendUsd, data.monthlyBudgetUsd);
    const rule: AiBudgetRule = {
      ...data,
      status,
      lastEvaluatedAt: new Date().toISOString(),
    };
    this.budgets.set(rule.id, rule);
    return rule;
  }

  public updateBudget(id: string, updates: Partial<AiBudgetRule>): AiBudgetRule {
    const existing = this.budgets.get(id);
    if (!existing) {
      throw new Error(`Budget rule '${id}' not found`);
    }

    const updated: AiBudgetRule = {
      ...existing,
      ...updates,
      lastEvaluatedAt: new Date().toISOString(),
    };

    updated.status = this.calculateStatus(
      updated.currentSpendUsd,
      updated.monthlyBudgetUsd,
      updated.warningThresholdPercent,
      updated.criticalThresholdPercent
    );

    this.budgets.set(id, updated);
    return updated;
  }

  public deleteBudget(id: string): boolean {
    return this.budgets.delete(id);
  }

  private calculateStatus(
    spend: number,
    budget: number,
    warnPercent = 80,
    critPercent = 90
  ): BudgetStatus {
    if (budget <= 0) return "OK";
    const pct = (spend / budget) * 100;
    if (pct >= 100) return "EXCEEDED";
    if (pct >= critPercent) return "CRITICAL";
    if (pct >= warnPercent) return "WARNING";
    return "OK";
  }

  /**
   * Main evaluation method: checks all applicable scopes (GLOBAL, TENANT, USER, MODULE, PROVIDER, MODEL)
   */
  public evaluateBudget(params: {
    tenantId?: string;
    userId?: string;
    module?: string;
    provider?: string;
    model?: string;
    estimatedCostUsd?: number;
  }): BudgetEvaluationResult {
    const matching: BudgetEvaluationResult["matchingBudgets"] = [];
    let worstAction: BudgetExceededAction | "PROCEED" = "PROCEED";
    let blockReason: string | undefined;

    for (const rule of this.budgets.values()) {
      if (!rule.enabled) continue;

      let isMatch = false;
      if (rule.scope === "GLOBAL") isMatch = true;
      else if (rule.scope === "TENANT" && rule.targetId === params.tenantId) isMatch = true;
      else if (rule.scope === "USER" && rule.targetId === params.userId) isMatch = true;
      else if (rule.scope === "MODULE" && rule.targetId === params.module) isMatch = true;
      else if (rule.scope === "PROVIDER" && rule.targetId === params.provider) isMatch = true;
      else if (rule.scope === "MODEL" && rule.targetId === params.model) isMatch = true;

      if (!isMatch) continue;

      const projectedSpend = rule.currentSpendUsd + (params.estimatedCostUsd || 0);
      const percent = rule.monthlyBudgetUsd > 0 ? (projectedSpend / rule.monthlyBudgetUsd) * 100 : 0;
      const status = this.calculateStatus(
        projectedSpend,
        rule.monthlyBudgetUsd,
        rule.warningThresholdPercent,
        rule.criticalThresholdPercent
      );

      matching.push({
        id: rule.id,
        scope: rule.scope,
        targetId: rule.targetId,
        budgetUsd: rule.monthlyBudgetUsd,
        spendUsd: projectedSpend,
        percent: Math.round(percent * 10) / 10,
        status,
      });

      if (status === "EXCEEDED") {
        if (rule.exceededAction === "BLOCK") {
          worstAction = "BLOCK";
          blockReason = `Presupuesto excedido para ${rule.scope} (${rule.displayName}): $${projectedSpend.toFixed(2)} / $${rule.monthlyBudgetUsd.toFixed(2)} USD`;
        } else if (worstAction !== "BLOCK") {
          worstAction = rule.exceededAction;
          blockReason = `Presupuesto alcanzado para ${rule.scope} (${rule.displayName}). Aplicando política: ${rule.exceededAction}`;
        }
      }
    }

    return {
      allowed: worstAction !== "BLOCK",
      action: worstAction,
      reason: blockReason,
      matchingBudgets: matching,
    };
  }

  public recordSpend(params: {
    tenantId?: string;
    userId?: string;
    module?: string;
    provider?: string;
    model?: string;
    costUsd: number;
  }): void {
    if (params.costUsd <= 0) return;

    for (const rule of this.budgets.values()) {
      if (!rule.enabled) continue;

      let isMatch = false;
      if (rule.scope === "GLOBAL") isMatch = true;
      else if (rule.scope === "TENANT" && rule.targetId === params.tenantId) isMatch = true;
      else if (rule.scope === "USER" && rule.targetId === params.userId) isMatch = true;
      else if (rule.scope === "MODULE" && rule.targetId === params.module) isMatch = true;
      else if (rule.scope === "PROVIDER" && rule.targetId === params.provider) isMatch = true;
      else if (rule.scope === "MODEL" && rule.targetId === params.model) isMatch = true;

      if (isMatch) {
        rule.currentSpendUsd = Math.round((rule.currentSpendUsd + params.costUsd) * 1000000) / 1000000;
        rule.status = this.calculateStatus(
          rule.currentSpendUsd,
          rule.monthlyBudgetUsd,
          rule.warningThresholdPercent,
          rule.criticalThresholdPercent
        );
        rule.lastEvaluatedAt = new Date().toISOString();
        this.budgets.set(rule.id, rule);
      }
    }
  }

  public resetSpend(id: string): void {
    const rule = this.budgets.get(id);
    if (rule) {
      rule.currentSpendUsd = 0;
      rule.status = "OK";
      rule.lastEvaluatedAt = new Date().toISOString();
      this.budgets.set(id, rule);
    }
  }
}

export const aiBudgetEngine = AiBudgetEngine.getInstance();
