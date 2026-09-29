/**
 * BIOAZÚCAR 4.0 — ITERATION 39 TEST SUITE
 * ==============================================================================
 * Iteration I39: Separación Rigurosa de Modelos BioAI: Física vs Heurística vs ML vs LLM
 * Standards: IEC 62443-4-2 SL3, ISA-95 L3/L2 Boundary, ASME PTC 4, E. Hugot Cane Sugar Engineering
 *
 * Verifies:
 * 1. 5-Tier BioAI Model Classification & Authority Level Hierarchy.
 * 2. Inviolable Rule: Generative LLM Models Strictly Blocked from Issuing Setpoints or Control Commands.
 * 3. First-Principles Hugot & ASME PTC 4 Physical Process Envelope Filtering.
 * 4. Human-In-The-Loop (HITL) Mandatory Authorization for Machine Recommendations.
 * 5. Deterministic SHA-256 Cryptographic Safety Seal.
 * 6. SuperAdmin Credentials Lifecycle: Environment variable in dev/test, explicit creation/promotion in production.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { BioAiSafetyBoundaryEngine } from "../services/bioai/safety/BioAiSafetyBoundaryEngine";
import { SuperAdminCredentialsService } from "../services/security/SuperAdminCredentialsService";
import {
  SafetyBoundaryRequest,
  HumanAuthorizationSignoff,
} from "../types/bioaiSafety";

describe("BioAzúcar 4.0 — Iteration 39: BioAI Safety Boundary & Physical Decoupling", () => {
  let safetyEngine: BioAiSafetyBoundaryEngine;
  let credService: SuperAdminCredentialsService;

  beforeEach(() => {
    BioAiSafetyBoundaryEngine.resetInstance();
    SuperAdminCredentialsService.resetInstance();
    safetyEngine = BioAiSafetyBoundaryEngine.getInstance();
    credService = SuperAdminCredentialsService.getInstance();
  });

  afterEach(() => {
    BioAiSafetyBoundaryEngine.resetInstance();
    SuperAdminCredentialsService.resetInstance();
  });

  // ============================================================================
  // SUITE 1: BIOAI 5-TIER CLASSIFICATION & AUTHORITY HIERARCHY
  // ============================================================================
  describe("Suite 1: BioAI Model 5-Tier Classification & Authority Levels", () => {
    it("assigns ABSOLUTE_PHYSICAL_LIMIT (Level 5) to FIRST_PRINCIPLES_PHYSICS models", () => {
      const authority = safetyEngine.getAuthorityLevel("FIRST_PRINCIPLES_PHYSICS");
      expect(authority).toBe("ABSOLUTE_PHYSICAL_LIMIT");
    });

    it("assigns SUPERVISED_RECOMMENDATION (Level 3) to EXPERT_HEURISTICS models", () => {
      const authority = safetyEngine.getAuthorityLevel("EXPERT_HEURISTICS");
      expect(authority).toBe("SUPERVISED_RECOMMENDATION");
    });

    it("assigns PREDICTIVE_DIAGNOSTICS (Level 2) to MACHINE_LEARNING models", () => {
      const authority = safetyEngine.getAuthorityLevel("MACHINE_LEARNING");
      expect(authority).toBe("PREDICTIVE_DIAGNOSTICS");
    });

    it("assigns INFORMATIVE_PLANNING (Level 1) to STATISTICAL_EMPIRICAL models", () => {
      const authority = safetyEngine.getAuthorityLevel("STATISTICAL_EMPIRICAL");
      expect(authority).toBe("INFORMATIVE_PLANNING");
    });

    it("assigns OPERATOR_ASSISTANCE_ONLY (Level 0) to GENERATIVE_LLM models", () => {
      const authority = safetyEngine.getAuthorityLevel("GENERATIVE_LLM");
      expect(authority).toBe("OPERATOR_ASSISTANCE_ONLY");
    });
  });

  // ============================================================================
  // SUITE 2: INVIOLABLE LLM CONTROL BLOCK (SAFETY BOUNDARY)
  // ============================================================================
  describe("Suite 2: Inviolable LLM Direct Control Block (IEC 62443 SL3)", () => {
    it("MUST immediately BLOCK any LLM attempt to emit a setpoint change", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "llm-illegal-setpoint-01",
        modelTier: "GENERATIVE_LLM",
        modelName: "Gemini-2.5-Flash-Industrial-Copilot",
        commandType: "SETPOINT_CHANGE",
        targetTag: "BLR-PT-101",
        proposedSetpoint: 62.5,
        unit: "bar",
        actionDescription: "Subir presión de caldera para compensar carga",
        justification: "Texto sugerido por modelo de lenguaje",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "GEMINI_COPILOT_LLM",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("LLM_DIRECT_CONTROL_PROHIBITED");
      expect(evalResult.canExecuteDirectly).toBe(false);
      expect(evalResult.blockedReason).toContain("Los modelos generativos/LLM tienen terminantemente prohibido");
      expect(evalResult.safetyHash).toHaveLength(64); // SHA-256 seal
    });

    it("MUST immediately BLOCK any LLM attempt to trigger valve or speed adjustment", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "llm-illegal-valve-02",
        modelTier: "GENERATIVE_LLM",
        modelName: "Gemini-2.5-Flash-Industrial-Copilot",
        commandType: "VALVE_ADJUSTMENT",
        targetTag: "MILL-FIC-201",
        proposedSetpoint: 30.0,
        unit: "%",
        actionDescription: "Abrir válvula de imbibición",
        justification: "Resumen conversacional de copilot",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "GEMINI_COPILOT_LLM",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("LLM_DIRECT_CONTROL_PROHIBITED");
      expect(evalResult.canExecuteDirectly).toBe(false);
    });

    it("PERMITS LLM to generate pure textual advisory and explanations without actuation", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "llm-legal-advisory-03",
        modelTier: "GENERATIVE_LLM",
        modelName: "Gemini-2.5-Flash-Industrial-Copilot",
        commandType: "TEXT_ADVISORY",
        actionDescription: "Resumen operativo del turno matutino",
        justification: "Explicación de variabilidad térmica en calandria",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "GEMINI_COPILOT_LLM",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(true);
      expect(evalResult.authorityLevel).toBe("OPERATOR_ASSISTANCE_ONLY");
      expect(evalResult.auditCode).toBe("SAFETY_BOUNDARY_VERIFIED_COMPLIANT");
    });
  });

  // ============================================================================
  // SUITE 3: FIRST-PRINCIPLES PHYSICAL ENVELOPE FILTER (HUGOT / ASME PTC 4)
  // ============================================================================
  describe("Suite 3: First-Principles Physical Process Envelope Filter", () => {
    it("BLOCKS boiler pressure exceeding ASME PTC 4 maximum limit (> 67 bar)", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-overpressure-01",
        modelTier: "MACHINE_LEARNING",
        modelName: "XGBoost-Steam-Optimizer",
        commandType: "SETPOINT_CHANGE",
        targetTag: "BLR-PT-101",
        proposedSetpoint: 74.0, // Limit is 67.0 bar
        unit: "bar",
        actionDescription: "Aumentar presión de caldera",
        justification: "Maximizar potencia de turbina",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("PHYSICAL_ENVELOPE_VIOLATION");
      expect(evalResult.physicalEnvelopeCheck.passed).toBe(false);
      expect(evalResult.physicalEnvelopeCheck.violationSeverity).toBe("CRITICAL_PHYSICAL_VIOLATION");
      expect(evalResult.blockedReason).toContain("ASME PTC 4");
    });

    it("BLOCKS boiler pressure below minimum stability limit (< 15 bar)", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "heuristic-underpressure-02",
        modelTier: "EXPERT_HEURISTICS",
        modelName: "PanBoilingRulesEngine",
        commandType: "SETPOINT_CHANGE",
        targetTag: "BLR-PT-101",
        proposedSetpoint: 11.5, // Min is 15.0 bar
        unit: "bar",
        actionDescription: "Bajar presión de domo",
        justification: "Modo ahorro de bagazo",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "HEURISTIC_AGENT",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("PHYSICAL_ENVELOPE_VIOLATION");
      expect(evalResult.physicalEnvelopeCheck.passed).toBe(false);
    });

    it("BLOCKS imbibition water ratio exceeding Hugot Chapter 12 limit (> 40% on cane)", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-over-imbibition-03",
        modelTier: "MACHINE_LEARNING",
        modelName: "RandomForest-Extraction-Maximizer",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-FIC-201",
        proposedSetpoint: 52.0, // Max allowed is 40.0%
        unit: "%",
        actionDescription: "Incrementar agua de imbibición al 52%",
        justification: "Aumentar extracción a 98%",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("PHYSICAL_ENVELOPE_VIOLATION");
      expect(evalResult.blockedReason).toContain("E. Hugot");
    });

    it("BLOCKS mill hydraulic pressure exceeding 250 bar (E. Hugot Chapter 7)", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-over-hydraulic-04",
        modelTier: "MACHINE_LEARNING",
        modelName: "HydraulicPressureTuner",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-HYD-01",
        proposedSetpoint: 295.0, // Max allowed is 250.0 bar
        unit: "bar",
        actionDescription: "Elevar presión sobre mazas",
        justification: "Reducir humedad de bagazo",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.auditCode).toBe("PHYSICAL_ENVELOPE_VIOLATION");
    });

    it("ACCEPTS setpoints strictly compliant with thermodynamic & mechanical boundaries", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "physics-optimal-05",
        modelTier: "FIRST_PRINCIPLES_PHYSICS",
        modelName: "HugotSpencerMassBalanceEngine",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-FIC-201",
        proposedSetpoint: 28.5, // Within [10.0, 40.0]
        unit: "%",
        actionDescription: "Ajuste de imbibición a 28.5% sobre caña",
        justification: "Punto estequiométrico de extracción óptima",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "FIRST_PRINCIPLES_PHYSICS",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(true);
      expect(evalResult.physicalEnvelopeCheck.passed).toBe(true);
      expect(evalResult.auditCode).toBe("SAFETY_BOUNDARY_VERIFIED_COMPLIANT");
    });
  });

  // ============================================================================
  // SUITE 4: HUMAN IN THE LOOP (HITL) GATEWAY & CRYPTOGRAPHIC SEAL
  // ============================================================================
  describe("Suite 4: Human In The Loop (HITL) Authorization & Safety Seals", () => {
    it("MANDATES Human Authorization for all machine-generated setpoints", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-rec-valid-01",
        modelTier: "MACHINE_LEARNING",
        modelName: "MillRPMOptimizer",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-SIC-101",
        proposedSetpoint: 4.5, // Within [2.0, 8.0] RPM
        unit: "RPM",
        actionDescription: "Modular velocidad a 4.5 RPM",
        justification: "Disminuir fatiga mecánica",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      const evalResult = safetyEngine.evaluateRecommendation(request);

      expect(evalResult.allowed).toBe(true);
      expect(evalResult.humanAuthorizationRequired).toBe(true);
      expect(evalResult.canExecuteDirectly).toBe(false);
      expect(evalResult.requiresSupervisorRole).toBe(true);
    });

    it("REJECTS authorization from operator lacking supervisor/admin role (Level 2)", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-rec-hitl-02",
        modelTier: "MACHINE_LEARNING",
        modelName: "MillRPMOptimizer",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-SIC-101",
        proposedSetpoint: 4.2,
        unit: "RPM",
        actionDescription: "Modular velocidad a 4.2 RPM",
        justification: "Optimización",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      safetyEngine.evaluateRecommendation(request);

      const signoff: HumanAuthorizationSignoff = {
        recommendationId: "ml-rec-hitl-02",
        authorizedByUid: "usr-operator-01",
        authorizedByEmail: "operador@bioazucar.com",
        authorizedByRole: "operador", // Insufficient role!
        tenantId: "BIOAZUCAR-DEMO",
        signatureTimestamp: new Date().toISOString(),
        decision: "APPROVED",
        verificationHash: "hash-01",
      };

      const result = safetyEngine.processHumanSignoff(signoff);

      expect(result.success).toBe(false);
      expect(result.auditCode).toBe("INSUFFICIENT_ROLE_FOR_SIGNOFF");
      expect(result.reason).toContain("carece de privilegios");
    });

    it("APPROVES authorization when signed by Supervisor, Administrador, or SuperAdmin", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "ml-rec-hitl-03",
        modelTier: "MACHINE_LEARNING",
        modelName: "MillRPMOptimizer",
        commandType: "SETPOINT_CHANGE",
        targetTag: "MILL-SIC-101",
        proposedSetpoint: 4.2,
        unit: "RPM",
        actionDescription: "Modular velocidad a 4.2 RPM",
        justification: "Optimización aprobada",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "ML_AGENT",
      };

      safetyEngine.evaluateRecommendation(request);

      const signoff: HumanAuthorizationSignoff = {
        recommendationId: "ml-rec-hitl-03",
        authorizedByUid: "usr-sup-01",
        authorizedByEmail: "supervisor@bioazucar.com",
        authorizedByRole: "supervisor",
        tenantId: "BIOAZUCAR-DEMO",
        signatureTimestamp: new Date().toISOString(),
        decision: "APPROVED",
        operatorNote: "Revisado con jefe de molienda",
        verificationHash: "hash-02",
      };

      const result = safetyEngine.processHumanSignoff(signoff);

      expect(result.success).toBe(true);
      expect(result.auditCode).toBe("HUMAN_AUTHORIZATION_GRANTED");
      expect(result.executablePayload).toBeDefined();
      expect(result.executablePayload.safetySeal).toHaveLength(64);
    });

    it("PROHIBITS human signoff from overriding a physical envelope or LLM rejection", () => {
      const request: SafetyBoundaryRequest = {
        recommendationId: "llm-blocked-rec-04",
        modelTier: "GENERATIVE_LLM",
        modelName: "Gemini-Copilot",
        commandType: "SETPOINT_CHANGE",
        targetTag: "BLR-PT-101",
        proposedSetpoint: 75.0, // Double violation: LLM + Overpressure
        unit: "bar",
        actionDescription: "Subir presión a 75 bar",
        justification: "LLM hallucination",
        tenantId: "BIOAZUCAR-DEMO",
        originator: "GEMINI_COPILOT_LLM",
      };

      safetyEngine.evaluateRecommendation(request);

      const signoff: HumanAuthorizationSignoff = {
        recommendationId: "llm-blocked-rec-04",
        authorizedByUid: "usr-admin-01",
        authorizedByEmail: "admin@bioazucar.com",
        authorizedByRole: "administrador",
        tenantId: "BIOAZUCAR-DEMO",
        signatureTimestamp: new Date().toISOString(),
        decision: "APPROVED",
        verificationHash: "hash-03",
      };

      const result = safetyEngine.processHumanSignoff(signoff);

      expect(result.success).toBe(false);
      expect(result.auditCode).toBe("SIGNOFF_OVERRIDE_FORBIDDEN");
      expect(result.reason).toContain("fue previamente rechazada por el filtro de seguridad");
    });
  });

  // ============================================================================
  // SUITE 5: SUPERADMIN CREDENTIALS & PRODUCTION DEPLOYMENT LIFECYCLE
  // ============================================================================
  describe("Suite 5: SuperAdmin Credentials & Production Deployment Lifecycle", () => {
    it("retrieves configured superadmin email from environment variable", () => {
      const email = credService.getSuperAdminEmail();
      expect(email).toBe("ing.dernys@gmail.com");
    });

    it("reads superadmin password from environment variable in DEV/TEST mode", () => {
      const devPass = credService.getDevelopmentConfiguredPassword();
      expect(devPass).toBeDefined();
      expect(devPass).toBe("BioAzucarSuperAdmin2026!#Dev");
    });

    it("enforces IEC 62443-4-2 password complexity rules", () => {
      // Too short (< 12)
      const shortRes = credService.validatePasswordComplexity("Short1!Aa");
      expect(shortRes.isValid).toBe(false);
      expect(shortRes.errors.some((e) => e.includes("mínima de 12"))).toBe(true);

      // No uppercase
      const noUpperRes = credService.validatePasswordComplexity("bioazucar2026!#lower");
      expect(noUpperRes.isValid).toBe(false);

      // No digits
      const noDigitsRes = credService.validatePasswordComplexity("BioAzucarSpecial!#NoDigits");
      expect(noDigitsRes.isValid).toBe(false);

      // No symbols
      const noSymbolsRes = credService.validatePasswordComplexity("BioAzucar2026NoSymbols");
      expect(noSymbolsRes.isValid).toBe(false);

      // Default blocked word
      const blockedRes = credService.validatePasswordComplexity("Superadmin2026!#ValidLen");
      expect(blockedRes.isValid).toBe(false);
      expect(blockedRes.errors.some((e) => e.includes("predeterminados"))).toBe(true);

      // Fully valid password
      const validRes = credService.validatePasswordComplexity("BioAzucar4.0$ecureDeploy2026!");
      expect(validRes.isValid).toBe(true);
      expect(validRes.errors).toHaveLength(0);
      expect(validRes.entropyScore).toBeGreaterThanOrEqual(60);
    });

    it("promotes development environment variable password to production when valid", () => {
      const promoteRes = credService.promoteDevPasswordToProduction();
      expect(promoteRes.success).toBe(true);
      expect(promoteRes.message).toContain("establecida y sellada exitosamente");
      expect(credService.isProductionPasswordSet()).toBe(true);
    });

    it("verifies superadmin credentials successfully with the promoted/established password", () => {
      credService.promoteDevPasswordToProduction();

      const validVerification = credService.verifyCredentials(
        "ing.dernys@gmail.com",
        "BioAzucarSuperAdmin2026!#Dev"
      );
      expect(validVerification.success).toBe(true);

      const wrongPassVerification = credService.verifyCredentials(
        "ing.dernys@gmail.com",
        "WrongPassword123!"
      );
      expect(wrongPassVerification.success).toBe(false);
      expect(wrongPassVerification.reason).toContain("inválidas");

      const wrongEmailVerification = credService.verifyCredentials(
        "attacker@other.com",
        "BioAzucarSuperAdmin2026!#Dev"
      );
      expect(wrongEmailVerification.success).toBe(false);
      expect(wrongEmailVerification.reason).toContain("no corresponde al SuperAdmin");
    });

    it("returns consistent status snapshot for auditing", () => {
      const status = credService.getStatus();
      expect(status.email).toBe("ing.dernys@gmail.com");
      expect(status.hasEnvPassword).toBe(true);
      expect(status.securityStandard).toContain("IEC 62443");
    });
  });
});
