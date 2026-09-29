/**
 * BioAzúcar 4.0 — BioAI Model Classification & Safety Boundary Contracts (Iteration 39)
 * ======================================================================================
 * Standards: IEC 62443-4-2 SL3 & ISA-95 Level 3 / Level 2 Boundary.
 *
 * Strict 5-tier classification of BioAI intelligence engines:
 * 1. FIRST_PRINCIPLES_PHYSICS (Hugot, Spencer-Meade, ASME PTC 4)
 * 2. STATISTICAL_EMPIRICAL (Time series, ARIMA/Holt-Winters, regressions)
 * 3. MACHINE_LEARNING (Offline trained Random Forest, XGBoost)
 * 4. EXPERT_HEURISTICS (Fuzzy logic, sugar master decision trees)
 * 5. GENERATIVE_LLM (Gemini, natural language copilot, RCA narratives)
 *
 * INVIOLABLE SAFETY BOUNDARY RULE:
 * Generative LLM models are STRICTLY FORBIDDEN from issuing setpoints, control commands,
 * or PLC instructions to the Secure Command Gateway.
 */

export type BioAiModelTier =
  | "FIRST_PRINCIPLES_PHYSICS"
  | "STATISTICAL_EMPIRICAL"
  | "MACHINE_LEARNING"
  | "EXPERT_HEURISTICS"
  | "GENERATIVE_LLM";

export type BioAiAuthorityLevel =
  | "ABSOLUTE_PHYSICAL_LIMIT"     // Level 5 - Overrides all; cannot be violated under any circumstance
  | "SUPERVISED_RECOMMENDATION"    // Level 3 - Requires Human-In-The-Loop (HITL) authorization
  | "PREDICTIVE_DIAGNOSTICS"       // Level 2 - Maintenance work orders & advisory
  | "INFORMATIVE_PLANNING"         // Level 1 - Trend reporting & inventory planning
  | "OPERATOR_ASSISTANCE_ONLY";    // Level 0 - Strictly read-only / narrative assistance

export type IndustrialCommandType =
  | "SETPOINT_CHANGE"
  | "VALVE_ADJUSTMENT"
  | "START_STOP"
  | "SPEED_ADJUSTMENT"
  | "WORK_ORDER_DRAFT"
  | "TEXT_ADVISORY"
  | "REPORT_GENERATION";

export interface PhysicalProcessVariableLimit {
  tag: string;
  variableName: string;
  unit: string;
  minAllowed: number;
  maxAllowed: number;
  criticalLowThreshold?: number;
  criticalHighThreshold?: number;
  physicalReference: string; // e.g. "E. Hugot La Sucrerie de Canne Cap. 12" / "ASME PTC 4"
}

export interface PhysicalProcessEnvelope {
  boilerPressureHpBar: PhysicalProcessVariableLimit;
  steamTemperatureC: PhysicalProcessVariableLimit;
  imbibitionWaterPercentCane: PhysicalProcessVariableLimit;
  millHydraulicPressureBar: PhysicalProcessVariableLimit;
  millSpeedRpm: PhysicalProcessVariableLimit;
  donnellyChuteLevelPercent: PhysicalProcessVariableLimit;
  bagasseMoisturePercent: PhysicalProcessVariableLimit;
  millingThroughputTch: PhysicalProcessVariableLimit;
}

export interface SafetyBoundaryRequest {
  recommendationId: string;
  modelTier: BioAiModelTier;
  modelName: string;
  commandType: IndustrialCommandType;
  targetTag?: string;
  proposedSetpoint?: number;
  currentSetpoint?: number;
  unit?: string;
  actionDescription: string;
  justification: string;
  tenantId: string;
  originator: string; // e.g. "GEMINI_COPILOT_LLM", "HUGOT_OPTIMIZER_V1", "RANDOM_FOREST_CUTTER"
}

export interface PhysicalEnvelopeCheckResult {
  passed: boolean;
  variableName?: string;
  testedValue?: number;
  minAllowed?: number;
  maxAllowed?: number;
  physicalReference?: string;
  violationSeverity: "NONE" | "WARNING" | "CRITICAL_PHYSICAL_VIOLATION";
}

export interface SafetyBoundaryEvaluation {
  recommendationId: string;
  allowed: boolean;
  blockedReason?: string;
  modelTier: BioAiModelTier;
  authorityLevel: BioAiAuthorityLevel;
  physicalEnvelopeCheck: PhysicalEnvelopeCheckResult;
  humanAuthorizationRequired: boolean;
  requiresSupervisorRole: boolean;
  canExecuteDirectly: boolean; // MUST be false for any LLM and false for setpoints without human signoff
  auditCode: string;
  safetyHash: string;
  evaluatedAt: string;
}

export interface HumanAuthorizationSignoff {
  recommendationId: string;
  authorizedByUid: string;
  authorizedByEmail: string;
  authorizedByRole: string; // Must be supervisor, administrador, or superadmin
  tenantId: string;
  signatureTimestamp: string;
  decision: "APPROVED" | "REJECTED";
  operatorNote?: string;
  verificationHash: string;
}
