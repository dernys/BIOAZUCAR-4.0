/**
 * BioAzúcar 4.0 — BioAI Safety Boundary & Physical Decoupling Engine (Iteration 39)
 * =================================================================================
 * Conforms to IEC 62443-4-2 SL3 & ISA-95 L3/L2 Boundary.
 *
 * Implements the mandatory safety flow:
 *   BioAI / ML -> Safety Evaluation -> Physical Envelope Filter (Hugot/ASME) -> Human In The Loop -> Secure Gateway -> PLC
 *
 * INVIOLABLE IEC 62443 SAFETY RULE:
 * Generative LLM models (e.g. Gemini) are strictly prohibited from issuing setpoints,
 * valve adjustments, or control commands to PLCs or the Secure Command Gateway.
 */

import { sha256Hex } from "../../../utils/cryptoUtils";
import {
  BioAiAuthorityLevel,
  BioAiModelTier,
  HumanAuthorizationSignoff,
  IndustrialCommandType,
  PhysicalEnvelopeCheckResult,
  PhysicalProcessEnvelope,
  PhysicalProcessVariableLimit,
  SafetyBoundaryEvaluation,
  SafetyBoundaryRequest,
} from "../../../types/bioaiSafety";

export class BioAiSafetyBoundaryEngine {
  private static instance: BioAiSafetyBoundaryEngine | null = null;

  private evaluationsHistory: SafetyBoundaryEvaluation[] = [];
  private signoffsHistory: HumanAuthorizationSignoff[] = [];
  private readonly maxHistoryLength = 500;

  // Canonical Physical Envelopes (First-Principles Hugot & ASME PTC 4)
  private readonly canonicalEnvelope: PhysicalProcessEnvelope = {
    boilerPressureHpBar: {
      tag: "BLR-PT-101",
      variableName: "Presión de Domo Caldera HP",
      unit: "bar",
      minAllowed: 15.0,
      maxAllowed: 67.0,
      criticalHighThreshold: 70.0,
      physicalReference: "ASME PTC 4 Fired Steam Generators & Hugot Chap. 18",
    },
    steamTemperatureC: {
      tag: "BLR-TT-102",
      variableName: "Temperatura de Vapor Sobrecalentado",
      unit: "°C",
      minAllowed: 280.0,
      maxAllowed: 520.0,
      criticalHighThreshold: 535.0,
      physicalReference: "ASME PTC 4 Section 5 — Límite Metalúrgico de Tuberías",
    },
    imbibitionWaterPercentCane: {
      tag: "MILL-FIC-201",
      variableName: "Porcentaje de Imbibición sobre Caña",
      unit: "%",
      minAllowed: 10.0,
      maxAllowed: 40.0,
      criticalHighThreshold: 45.0,
      physicalReference: "E. Hugot — La Sucrerie de Canne (Cap. 12: Imbibition Lixiviation Limit)",
    },
    millHydraulicPressureBar: {
      tag: "MILL-HYD-01",
      variableName: "Presión Hidráulica Superior de Molino",
      unit: "bar",
      minAllowed: 120.0,
      maxAllowed: 250.0,
      criticalHighThreshold: 260.0,
      physicalReference: "E. Hugot — Chap. 7: Pressure on Feed Rollers",
    },
    millSpeedRpm: {
      tag: "MILL-SIC-101",
      variableName: "Velocidad Tangencial / Giro de Maza",
      unit: "RPM",
      minAllowed: 2.0,
      maxAllowed: 8.0,
      criticalHighThreshold: 8.5,
      physicalReference: "Spencer-Meade Cane Sugar Handbook — Mill Peripheral Speed Limit",
    },
    donnellyChuteLevelPercent: {
      tag: "MILL-LIC-101",
      variableName: "Nivel de Caña en Chute Donnelly",
      unit: "%",
      minAllowed: 10.0,
      maxAllowed: 100.0,
      criticalLowThreshold: 5.0,
      physicalReference: "E. Hugot — Feed Chute Compression Head",
    },
    bagasseMoisturePercent: {
      tag: "BAG-AT-301",
      variableName: "Humedad de Bagazo Final",
      unit: "%",
      minAllowed: 44.0,
      maxAllowed: 56.0,
      criticalHighThreshold: 58.0,
      physicalReference: "ASME PTC 4 — Límite de Combustión Autosostenida en Parrilla",
    },
    millingThroughputTch: {
      tag: "MILL-WT-01",
      variableName: "Tasa de Molienda TCH",
      unit: "TCH",
      minAllowed: 50.0,
      maxAllowed: 600.0,
      criticalHighThreshold: 650.0,
      physicalReference: "E. Hugot — Capacity Rating of Rollers Formula",
    },
  };

  private constructor() {}

  public static getInstance(): BioAiSafetyBoundaryEngine {
    if (!BioAiSafetyBoundaryEngine.instance) {
      BioAiSafetyBoundaryEngine.instance = new BioAiSafetyBoundaryEngine();
    }
    return BioAiSafetyBoundaryEngine.instance;
  }

  public static resetInstance(): void {
    BioAiSafetyBoundaryEngine.instance = null;
  }

  /**
   * Returns canonical physical envelope reference
   */
  public getPhysicalEnvelope(): PhysicalProcessEnvelope {
    return { ...this.canonicalEnvelope };
  }

  /**
   * Resolves authority level based on strict BioAI model tiering
   */
  public getAuthorityLevel(tier: BioAiModelTier): BioAiAuthorityLevel {
    switch (tier) {
      case "FIRST_PRINCIPLES_PHYSICS":
        return "ABSOLUTE_PHYSICAL_LIMIT";
      case "EXPERT_HEURISTICS":
        return "SUPERVISED_RECOMMENDATION";
      case "MACHINE_LEARNING":
        return "PREDICTIVE_DIAGNOSTICS";
      case "STATISTICAL_EMPIRICAL":
        return "INFORMATIVE_PLANNING";
      case "GENERATIVE_LLM":
      default:
        return "OPERATOR_ASSISTANCE_ONLY";
    }
  }

  /**
   * Core Safety Boundary Evaluation Engine (IEC 62443 SL3)
   */
  public evaluateRecommendation(req: SafetyBoundaryRequest): SafetyBoundaryEvaluation {
    const timestamp = new Date().toISOString();
    const authorityLevel = this.getAuthorityLevel(req.modelTier);

    // =========================================================================
    // INVIOLABLE RULE 1: LLM DIRECT CONTROL BLOCK (NON-NEGOTIABLE)
    // =========================================================================
    const isControlAction =
      req.commandType === "SETPOINT_CHANGE" ||
      req.commandType === "VALVE_ADJUSTMENT" ||
      req.commandType === "START_STOP" ||
      req.commandType === "SPEED_ADJUSTMENT" ||
      req.proposedSetpoint !== undefined;

    if (req.modelTier === "GENERATIVE_LLM" && isControlAction) {
      const evaluation: SafetyBoundaryEvaluation = {
        recommendationId: req.recommendationId,
        allowed: false,
        blockedReason:
          "BLOQUEO DE SEGURIDAD IEC 62443: Los modelos generativos/LLM tienen terminantemente prohibido emitir setpoints, ajustes de válvulas o comandos de control hacia PLCs o el Secure Command Gateway.",
        modelTier: req.modelTier,
        authorityLevel,
        physicalEnvelopeCheck: {
          passed: false,
          violationSeverity: "CRITICAL_PHYSICAL_VIOLATION",
          physicalReference: "IEC 62443-3-3 SR 5.2 / BioAI Safety Boundary — LLM Actuation Prohibition",
        },
        humanAuthorizationRequired: true,
        requiresSupervisorRole: true,
        canExecuteDirectly: false,
        auditCode: "LLM_DIRECT_CONTROL_PROHIBITED",
        safetyHash: this.calculateSafetyHash(req, false, "LLM_DIRECT_CONTROL_PROHIBITED", timestamp),
        evaluatedAt: timestamp,
      };

      this.recordEvaluation(evaluation);
      return evaluation;
    }

    // =========================================================================
    // RULE 2: PHYSICAL FIRST-PRINCIPLES ENVELOPE VERIFICATION (HUGOT / ASME)
    // =========================================================================
    let envelopeCheck: PhysicalEnvelopeCheckResult = {
      passed: true,
      violationSeverity: "NONE",
    };

    if (req.proposedSetpoint !== undefined) {
      envelopeCheck = this.verifyPhysicalProcessEnvelope(
        req.targetTag,
        req.proposedSetpoint,
        req.unit
      );
    }

    if (!envelopeCheck.passed) {
      const evaluation: SafetyBoundaryEvaluation = {
        recommendationId: req.recommendationId,
        allowed: false,
        blockedReason: `VIOLACIÓN DE ENVOLVENTE FÍSICA: El valor propuesto (${envelopeCheck.testedValue} ${req.unit || ""}) infringe los límites admisibles [${envelopeCheck.minAllowed}, ${envelopeCheck.maxAllowed}] definidos por ${envelopeCheck.physicalReference}.`,
        modelTier: req.modelTier,
        authorityLevel,
        physicalEnvelopeCheck: envelopeCheck,
        humanAuthorizationRequired: true,
        requiresSupervisorRole: true,
        canExecuteDirectly: false,
        auditCode: "PHYSICAL_ENVELOPE_VIOLATION",
        safetyHash: this.calculateSafetyHash(req, false, "PHYSICAL_ENVELOPE_VIOLATION", timestamp),
        evaluatedAt: timestamp,
      };

      this.recordEvaluation(evaluation);
      return evaluation;
    }

    // =========================================================================
    // RULE 3: HUMAN IN THE LOOP (HITL) ENFORCEMENT
    // =========================================================================
    // Even if physical envelope passes, NO machine model (ML, Heuristic, Stats)
    // can write directly to PLC without Human Authorization (IEC 62443 SL3).
    const requiresHumanSignoff = isControlAction;
    const canExecuteDirectly = !isControlAction;

    const evaluation: SafetyBoundaryEvaluation = {
      recommendationId: req.recommendationId,
      allowed: true,
      modelTier: req.modelTier,
      authorityLevel,
      physicalEnvelopeCheck: envelopeCheck,
      humanAuthorizationRequired: requiresHumanSignoff,
      requiresSupervisorRole: requiresHumanSignoff,
      canExecuteDirectly,
      auditCode: "SAFETY_BOUNDARY_VERIFIED_COMPLIANT",
      safetyHash: this.calculateSafetyHash(req, true, "SAFETY_BOUNDARY_VERIFIED_COMPLIANT", timestamp),
      evaluatedAt: timestamp,
    };

    this.recordEvaluation(evaluation);
    return evaluation;
  }

  /**
   * Human-In-The-Loop Signoff Processing (IEC 62443 SL3)
   */
  public processHumanSignoff(signoff: HumanAuthorizationSignoff): {
    success: boolean;
    reason?: string;
    executablePayload?: any;
    auditCode: string;
  } {
    const priorEvaluation = this.evaluationsHistory.find(
      (e) => e.recommendationId === signoff.recommendationId
    );

    if (!priorEvaluation) {
      return {
        success: false,
        reason: "No se encontró una evaluación de seguridad previa para esta recomendación.",
        auditCode: "SIGNOFF_EVALUATION_NOT_FOUND",
      };
    }

    if (!priorEvaluation.allowed) {
      return {
        success: false,
        reason: `La recomendación fue previamente rechazada por el filtro de seguridad (${priorEvaluation.blockedReason}). Ningún operador puede forzarla.`,
        auditCode: "SIGNOFF_OVERRIDE_FORBIDDEN",
      };
    }

    // Role verification: Only Supervisor, Administrador, or Superadmin
    const normalizedRole = (signoff.authorizedByRole || "").toLowerCase().trim();
    const authorizedRoles = ["supervisor", "administrador", "superadmin"];
    if (!authorizedRoles.includes(normalizedRole)) {
      return {
        success: false,
        reason: `El rol '${signoff.authorizedByRole}' carece de privilegios para autorizar comandos de proceso (requiere Nivel 3+).`,
        auditCode: "INSUFFICIENT_ROLE_FOR_SIGNOFF",
      };
    }

    this.signoffsHistory.unshift(signoff);
    if (this.signoffsHistory.length > this.maxHistoryLength) {
      this.signoffsHistory.pop();
    }

    return {
      success: true,
      auditCode: "HUMAN_AUTHORIZATION_GRANTED",
      executablePayload: {
        recommendationId: signoff.recommendationId,
        authorizedBy: signoff.authorizedByEmail,
        authorizedRole: signoff.authorizedByRole,
        tenantId: signoff.tenantId,
        timestamp: signoff.signatureTimestamp,
        safetySeal: priorEvaluation.safetyHash,
      },
    };
  }

  /**
   * Physical Envelope Boundary Checker
   */
  public verifyPhysicalProcessEnvelope(
    targetTag?: string,
    proposedValue?: number,
    unit?: string
  ): PhysicalEnvelopeCheckResult {
    if (proposedValue === undefined || isNaN(proposedValue)) {
      return {
        passed: false,
        testedValue: proposedValue,
        violationSeverity: "CRITICAL_PHYSICAL_VIOLATION",
        physicalReference: "Validación de entrada numérica",
      };
    }

    const envelope = this.canonicalEnvelope;
    let matchedLimit: PhysicalProcessVariableLimit | null = null;

    if (targetTag) {
      const tagUpper = targetTag.toUpperCase();
      if (tagUpper.includes("BLR-PT") || tagUpper.includes("PRESSURE") || tagUpper.includes("BOILER")) {
        matchedLimit = envelope.boilerPressureHpBar;
      } else if (tagUpper.includes("BLR-TT") || tagUpper.includes("STEAM_TEMP")) {
        matchedLimit = envelope.steamTemperatureC;
      } else if (tagUpper.includes("FIC-201") || tagUpper.includes("IMBIBITION") || tagUpper.includes("IMB")) {
        matchedLimit = envelope.imbibitionWaterPercentCane;
      } else if (tagUpper.includes("HYD") || tagUpper.includes("MILL_HYD")) {
        matchedLimit = envelope.millHydraulicPressureBar;
      } else if (tagUpper.includes("SIC") || tagUpper.includes("SPEED") || tagUpper.includes("RPM")) {
        matchedLimit = envelope.millSpeedRpm;
      } else if (tagUpper.includes("LIC") || tagUpper.includes("DONNELLY") || tagUpper.includes("CHUTE")) {
        matchedLimit = envelope.donnellyChuteLevelPercent;
      } else if (tagUpper.includes("BAG") || tagUpper.includes("MOISTURE")) {
        matchedLimit = envelope.bagasseMoisturePercent;
      } else if (tagUpper.includes("TCH") || tagUpper.includes("THROUGHPUT") || tagUpper.includes("MILL-WT")) {
        matchedLimit = envelope.millingThroughputTch;
      }
    }

    // If no tag matched, try unit or heuristics
    if (!matchedLimit && unit) {
      const unitUpper = unit.toUpperCase().trim();
      if (unitUpper === "BAR") {
        matchedLimit = envelope.boilerPressureHpBar;
      } else if (unitUpper === "°C" || unitUpper === "C") {
        matchedLimit = envelope.steamTemperatureC;
      } else if (unitUpper === "RPM") {
        matchedLimit = envelope.millSpeedRpm;
      } else if (unitUpper === "TCH") {
        matchedLimit = envelope.millingThroughputTch;
      }
    }

    // Default to general boiler pressure limit if it's a pressure check
    if (!matchedLimit) {
      matchedLimit = envelope.boilerPressureHpBar;
    }

    const isOutOfRange =
      proposedValue < matchedLimit.minAllowed || proposedValue > matchedLimit.maxAllowed;

    if (isOutOfRange) {
      return {
        passed: false,
        variableName: matchedLimit.variableName,
        testedValue: proposedValue,
        minAllowed: matchedLimit.minAllowed,
        maxAllowed: matchedLimit.maxAllowed,
        physicalReference: matchedLimit.physicalReference,
        violationSeverity: "CRITICAL_PHYSICAL_VIOLATION",
      };
    }

    return {
      passed: true,
      variableName: matchedLimit.variableName,
      testedValue: proposedValue,
      minAllowed: matchedLimit.minAllowed,
      maxAllowed: matchedLimit.maxAllowed,
      physicalReference: matchedLimit.physicalReference,
      violationSeverity: "NONE",
    };
  }

  /**
   * Retrieves audit evaluation trail
   */
  public getEvaluationHistory(): SafetyBoundaryEvaluation[] {
    return [...this.evaluationsHistory];
  }

  public getSignoffHistory(): HumanAuthorizationSignoff[] {
    return [...this.signoffsHistory];
  }

  private calculateSafetyHash(
    req: SafetyBoundaryRequest,
    allowed: boolean,
    auditCode: string,
    timestamp: string
  ): string {
    const raw = `${req.recommendationId}|${req.modelTier}|${req.commandType}|${req.targetTag || ""}|${req.proposedSetpoint ?? ""}|${allowed}|${auditCode}|${timestamp}`;
    return sha256Hex(raw);
  }

  private recordEvaluation(evaluation: SafetyBoundaryEvaluation): void {
    this.evaluationsHistory.unshift(evaluation);
    if (this.evaluationsHistory.length > this.maxHistoryLength) {
      this.evaluationsHistory.pop();
    }
  }
}
