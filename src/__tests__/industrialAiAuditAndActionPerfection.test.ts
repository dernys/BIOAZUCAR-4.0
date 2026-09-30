import { describe, it, expect, beforeEach } from "vitest";
import { copilotKnowledgeService } from "../copilot/services/copilotKnowledgeService";
import {
  BIOAZUCAR_INDUSTRIAL_KNOWLEDGE_BASE,
  IndustrialOperationDomain,
} from "../copilot/data/bioAzucarIndustrialKnowledge";
import {
  roleAdaptiveLanguageEngine,
  ROLE_PERSONA_PROFILES,
} from "../copilot/services/RoleAdaptiveLanguageEngine";
import { actionAdvisoryService } from "../copilot/services/ActionAdvisoryService";
import { IndustrialToolExecutor } from "../copilot/tools/industrialToolExecutor";
import { checkToolAuthorization } from "../copilot/domain/CopilotPermissions";
import { UserRole, TelemetryData } from "../types";

describe("BioAzúcar 4.0 — Auditoría Completa de IA Industrial, BioAI & Copilot", () => {
  const mockTelemetry: TelemetryData = {
    tch: 450,
    millingExtraction: 96.5,
    boilerPressureHP: 64.5,
    steamFlowHP: 210,
    powerGeneratedMW: 32.4,
    powerExportGridMW: 21.2,
    powerInternalMW: 11.2,
    bagasseMoisture: 48.5,
    oeeOverall: 91.2,
    canePol: 14.8,
    spotPriceMWh: 78.5,
    isSimulated: false,
    provenance: "REAL_OT_PLC",
  } as unknown as TelemetryData;

  const mockActiveTenant = {
    id: "TENANT_PORTUGUESA",
    name: "Central Azucarero Portuguesa",
    code: "SOBERANIA",
    nominalTch: 450,
  } as any;

  describe("1. Cobertura Absoluta del Conocimiento Industrial (§1-§12)", () => {
    it("debe contener las 12 etapas operativas completas del ingenio azucarero y derivados", () => {
      const domains = copilotKnowledgeService.getAllIndustrialDomains();
      expect(domains.length).toBeGreaterThanOrEqual(12);

      const categories = domains.map((d) => d.stageCategory);
      expect(categories).toContain("RECEPCION_MATERIA_PRIMA");
      expect(categories).toContain("EXTRACCION_MOLIENDA");
      expect(categories).toContain("PURIFICACION_CLARIFICACION");
      expect(categories).toContain("EVAPORACION_CONCENTRACION");
      expect(categories).toContain("CRISTALIZACION_AGOTAMIENTO");
      expect(categories).toContain("CENTRIFUGACION_SECADO");
      expect(categories).toContain("DESTILERIA_BIOETANOL");
      expect(categories).toContain("COGENERACION_VAPOR");
      expect(categories).toContain("TRATAMIENTO_EFLUENTES");
      expect(categories).toContain("CONTROL_CALIDAD_LIMS");
      expect(categories).toContain("MANTENIMIENTO_CONFIABILIDAD");
      expect(categories).toContain("GOBERNANZA_CIBERSEGURIDAD");
    });

    it("cada dominio industrial debe incluir leyes físicas/químicas, lazos de control y rangos de operación", () => {
      const domains = copilotKnowledgeService.getAllIndustrialDomains();
      domains.forEach((dom) => {
        expect(dom.id).toBeDefined();
        expect(dom.name).toBeDefined();
        expect(dom.summary.length).toBeGreaterThan(20);
        expect(dom.detailedProcessDescription.length).toBeGreaterThan(50);
        expect(dom.keyPhysicsAndChemistry.length).toBeGreaterThan(20);
        expect(dom.standardOperatingRanges.length).toBeGreaterThanOrEqual(1);
        expect(dom.applicableStandards.length).toBeGreaterThanOrEqual(1);
        expect(dom.perfectionRules.length).toBeGreaterThanOrEqual(1);
      });
    });

    it("debe buscar y encontrar conocimiento específico de molienda Hugot, ASME PTC 4 y clarificación", () => {
      const hugotMatch = copilotKnowledgeService.searchIndustrialDomains("molienda extraccion hugot bagazo");
      expect(hugotMatch.length).toBeGreaterThanOrEqual(1);
      expect(hugotMatch[0].keyPhysicsAndChemistry).toContain("Hugot");

      const asmeMatch = copilotKnowledgeService.searchIndustrialDomains("calderas vapor asme ptc 4 biomasa");
      expect(asmeMatch.length).toBeGreaterThanOrEqual(1);
      expect(asmeMatch[0].keyPhysicsAndChemistry).toContain("ASME PTC 4");

      const clarifMatch = copilotKnowledgeService.searchIndustrialDomains("clarificacion encalado ph fosfatos");
      expect(clarifMatch.length).toBeGreaterThanOrEqual(1);
      expect(clarifMatch[0].name).toContain("Clarificación");
    });
  });

  describe("2. Adaptación Certera de Lenguaje y Persona por Rol (§4)", () => {
    const rolesToTest: UserRole[] = [
      "operador",
      "supervisor",
      "analista_calidad",
      "auditor_seguridad",
      "administrador",
      "superadmin",
      "mantenimiento",
    ];

    it("debe disponer de perfiles lingüísticos y de enfoque diferenciados para cada rol", () => {
      rolesToTest.forEach((role) => {
        const profile = roleAdaptiveLanguageEngine.getProfile(role);
        expect(profile.role).toBe(role);
        expect(profile.roleTitle).toBeDefined();
        expect(profile.tone).toBeDefined();
        expect(profile.focusAreas.length).toBeGreaterThanOrEqual(3);
        expect(profile.vocabulary.length).toBeGreaterThanOrEqual(4);
        expect(profile.systemInstructionModifier).toContain("ADAPTACIÓN OBLIGATORIA");
      });
    });

    it("el rol operador debe priorizar consignas, alarmas inmediatas y DCS", () => {
      const op = roleAdaptiveLanguageEngine.getProfile("operador");
      expect(op.tone).toContain("operacional");
      expect(op.vocabulary).toContain("setpoint");
      expect(op.vocabulary).toContain("enclavamiento");
      expect(op.focusAreas.some((f) => f.includes("Setpoints"))).toBe(true);
    });

    it("el rol analista_calidad debe priorizar polarimetría, ICUMSA, Brix y dextrano", () => {
      const lab = roleAdaptiveLanguageEngine.getProfile("analista_calidad");
      expect(lab.vocabulary).toContain("ICUMSA");
      expect(lab.vocabulary).toContain("Brix refractométrico");
      expect(lab.vocabulary).toContain("dextrano");
    });

    it("el rol auditor_seguridad debe priorizar IEC 62443 y hash chain inmutable", () => {
      const aud = roleAdaptiveLanguageEngine.getProfile("auditor_seguridad");
      expect(aud.vocabulary).toContain("IEC 62443");
      expect(aud.vocabulary).toContain("hash SHA-256");
      expect(aud.vocabulary).toContain("registro inmutable");
    });
  });

  describe("3. Capa de Sugerencias de Perfeccionamiento y Autorización (§5)", () => {
    it("debe generar sugerencia de perfeccionamiento estequiométrica ante petición de aumento de TCH", () => {
      const res = actionAdvisoryService.evaluateAction(
        "request_setpoint_change",
        { tag: "Milling.TCH_Setpoint", newValue: 510 },
        ["operador", "administrador"],
        ["MODIFY_SETPOINTS"],
        mockTelemetry,
        [],
        [],
        mockActiveTenant,
        4,
        false
      );

      expect(res.allowed).toBe(true);
      expect(res.confirmationDetails.perfectionSuggestion).toBeDefined();

      const perf = res.confirmationDetails.perfectionSuggestion!;
      expect(perf.originalValue).toBe(510);
      expect(perf.recommendedValue).toBeLessThan(510); // Recomienda 473 TCH óptimo
      expect(perf.rationale).toContain("capacidad de evaporación");
      expect(perf.efficiencyGain).toBeDefined();
      expect(perf.riskMitigation).toBeDefined();
      expect(perf.thermodynamicBasis).toContain("Hugot");
    });

    it("debe advertir y perfeccionar la consigna de caldera si excede margen seguro a válvulas de alivio", () => {
      const res = actionAdvisoryService.evaluateAction(
        "request_setpoint_change",
        { tag: "Boiler.Pressure_Setpoint", newValue: 68.0 },
        ["administrador"],
        ["MODIFY_SETPOINTS"],
        mockTelemetry,
        [],
        [],
        mockActiveTenant,
        4,
        false
      );

      expect(res.allowed).toBe(true);
      const perf = res.confirmationDetails.perfectionSuggestion!;
      expect(perf.originalValue).toBe(68.0);
      expect(perf.recommendedValue).toBe(65.0); // Recomienda 65 bar seguro
      expect(perf.rationale).toContain("válvulas de alivio");
      expect(perf.thermodynamicBasis).toContain("ASME PTC 4");
    });

    it("debe validar despacho eléctrico y acotar a potencia disponible neta", () => {
      const res = actionAdvisoryService.evaluateAction(
        "request_dispatch_change",
        { exportMW: 26.0 },
        ["supervisor"],
        ["CHANGE_DISPATCH_MW"],
        mockTelemetry,
        [],
        [],
        mockActiveTenant,
        3,
        false
      );

      expect(res.allowed).toBe(true);
      const perf = res.confirmationDetails.perfectionSuggestion!;
      expect(perf.recommendedValue).toBeLessThanOrEqual(21.2); // Acotado por excedente real
    });

    it("debe denegar y bloquear la acción si el usuario carece de rol/clearance suficiente", () => {
      const res = actionAdvisoryService.evaluateAction(
        "request_setpoint_change",
        { tag: "Milling.TCH_Setpoint", newValue: 480 },
        ["observador"], // Observador no puede modificar setpoints
        ["VIEW_TELEMETRY"],
        mockTelemetry,
        [],
        [],
        mockActiveTenant,
        1,
        false
      );

      expect(res.allowed).toBe(false);
      expect(res.denialReason).toContain("no tiene autorización");
    });
  });

  describe("4. Integración E2E en IndustrialToolExecutor (§5)", () => {
    it("debe adjuntar los detalles de perfeccionamiento en confirmationDetails al solicitar cambio de setpoint", async () => {
      const toolResult = await IndustrialToolExecutor.execute({
        toolName: "request_setpoint_change",
        args: { tag: "Milling.TCH_Setpoint", newValue: 500 },
        context: {
          userId: "usr-admin-01",
          username: "admin_fábrica",
          roles: ["administrador"],
          permissions: ["MODIFY_SETPOINTS"],
          securityLevel: 4,
          plantId: "TENANT_PORTUGUESA",
          plantName: "Central Portuguesa",
          plantCode: "SOBERANIA",
          currentRoute: "/scada",
          currentModule: "scada",
          locale: "es",
          timezone: "America/Caracas",
        },
        liveTelemetry: mockTelemetry,
        alarmsList: [],
        equipmentList: [],
        activeTenant: mockActiveTenant,
      });

      expect(toolResult.success).toBe(true);
      expect(toolResult.requiredConfirmation).toBe(true);
      expect(toolResult.confirmationDetails).toBeDefined();
      expect(toolResult.confirmationDetails.payload.perfectionSuggestion).toBeDefined();
      expect(toolResult.confirmationDetails.payload.perfectionSuggestion.recommendedValue).toBeDefined();
    });
  });
});
