import { describe, it, expect } from "vitest";
import { CopilotIntentClassifier } from "../copilot/domain/CopilotIntentClassifier";
import { copilotService } from "../copilot/services/copilotService";
import { copilotContextService } from "../copilot/services/copilotContextService";
import { INITIAL_TELEMETRY } from "../data/mockIndustrialData";
import { INITIAL_TENANTS } from "../services/dbService";
import { PREDEFINED_USERS } from "../services/authService";

describe("BioAzúcar Copilot — Intent Classification, Context Awareness & Anti-Slop Tests", () => {
  const adminUser = PREDEFINED_USERS[0];
  const operatorUser = PREDEFINED_USERS.find((u) => u.role === "operador") || PREDEFINED_USERS[3];
  const activeTenant = INITIAL_TENANTS[0];

  const baseContext = copilotContextService.buildContext(
    adminUser,
    "administrador",
    activeTenant,
    "dashboard"
  );

  // ==========================================================================
  // 1. INTENT CLASSIFICATION AUDIT
  // ==========================================================================
  describe("Intent Classification Rules", () => {
    it("MUST classify '¿Qué puedes hacer?' strictly as CAPABILITIES and never as process/boiler", () => {
      const queries = [
        "¿Qué puedes hacer?",
        "que puedes hacer",
        "¿Qué sabes hacer?",
        "¿Cuáles son tus funciones?",
        "¿Qué capacidades tienes?",
        "¿En qué me puedes ayudar?",
        "¿Qué tareas puedes realizar?",
        "¿Qué información tienes?",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, baseContext);
        expect(result.intent).toBe("CAPABILITIES");
        expect(result.confidence).toBeGreaterThan(0.9);
      }
    });

    it("MUST classify '¿Quién eres?' and 'Ayúdame' as HELP", () => {
      const queries = [
        "¿Quién eres?",
        "quien eres",
        "Ayúdame",
        "ayuda",
        "necesito ayuda",
        "¿Cómo te uso?",
        "¿Cómo interactuar contigo?",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, baseContext);
        expect(result.intent).toBe("HELP");
      }
    });

    it("MUST classify '¿Cómo funciona el sistema?' and '¿Qué es BioAzúcar?' as SYSTEM_INFORMATION", () => {
      const queries = [
        "¿Cómo funciona BioAzúcar?",
        "¿Qué es BioAzúcar?",
        "¿Cómo funciona el sistema?",
        "arquitectura del sistema",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, baseContext);
        expect(result.intent).toBe("SYSTEM_INFORMATION");
      }
    });

    it("MUST classify questions about user permissions as USER_PERMISSIONS", () => {
      const queries = [
        "¿Qué permisos tengo?",
        "¿Cuál es mi rol?",
        "mis permisos",
        "¿Puedo cambiar setpoints?",
      ];

      for (const q of queries) {
        const result = CopilotIntentClassifier.classify(q, baseContext);
        expect(result.intent).toBe("USER_PERMISSIONS");
      }
    });

    it("MUST classify navigation requests as NAVIGATION with targetModule", () => {
      expect(CopilotIntentClassifier.classify("llévame a cogeneración", baseContext).targetModule).toBe("energy_dispatch");
      expect(CopilotIntentClassifier.classify("abre molienda", baseContext).targetModule).toBe("scada");
      expect(CopilotIntentClassifier.classify("muéstrame las alarmas", baseContext).targetModule).toBe("alarms");
      expect(CopilotIntentClassifier.classify("quiero ver el historiador", baseContext).targetModule).toBe("historian");
    });

    it("MUST classify data lineage queries as DATA_LINEAGE", () => {
      const result = CopilotIntentClassifier.classify("¿De dónde viene este KPI?", baseContext);
      expect(result.intent).toBe("DATA_LINEAGE");
      expect(result.targetKpiId).toBeDefined();

      const resultOee = CopilotIntentClassifier.classify("Muestra el origen del dato OEE", baseContext);
      expect(resultOee.intent).toBe("DATA_LINEAGE");
      expect(resultOee.targetKpiId).toBe("kpi-oee-overall");
    });

    it("MUST classify setpoint change requests as ACTION with proposedValue", () => {
      const result = CopilotIntentClassifier.classify("cambia el setpoint a 480", baseContext);
      expect(result.intent).toBe("ACTION");
      expect(result.proposedValue).toBe(480);
      expect(result.recommendedTool).toBe("request_setpoint_change");
    });
  });

  // ==========================================================================
  // 2. CONTEXTUAL DISAMBIGUATION (Active Module Awareness)
  // ==========================================================================
  describe("Contextual Disambiguation", () => {
    it("disambiguates '¿cómo está funcionando?' in energy_dispatch towards cogeneration/steam", () => {
      const cogenContext = copilotContextService.buildContext(
        adminUser,
        "administrador",
        activeTenant,
        "energy_dispatch"
      );

      const result = CopilotIntentClassifier.classify("¿cómo está funcionando?", cogenContext);
      expect(result.intent).toBe("PROCESS_STATE");
      expect(result.targetModule).toBe("energy_dispatch");
      expect(result.recommendedTool).toBe("calculate_energy_balance");
    });

    it("disambiguates '¿qué está pasando?' in alarms towards alarm events", () => {
      const alarmContext = copilotContextService.buildContext(
        adminUser,
        "administrador",
        activeTenant,
        "alarms"
      );

      const result = CopilotIntentClassifier.classify("¿qué está pasando?", alarmContext);
      expect(result.intent).toBe("ALARM");
      expect(result.recommendedTool).toBe("get_active_alarms");
    });

    it("disambiguates '¿cómo estamos?' in scada towards milling and tandem", () => {
      const scadaContext = copilotContextService.buildContext(
        adminUser,
        "administrador",
        activeTenant,
        "scada"
      );

      const result = CopilotIntentClassifier.classify("¿cómo estamos?", scadaContext);
      expect(result.intent).toBe("PROCESS_STATE");
      expect(result.targetModule).toBe("scada");
      expect(result.recommendedTool).toBe("get_current_process_state");
    });
  });

  // ==========================================================================
  // 3. ZERO-SLOP / ZERO-BOILER BIAS FOR GENERAL CAPABILITIES (E2E)
  // ==========================================================================
  describe("Response Content & Zero Boiler Hallucination", () => {
    it("MUST return official capabilities response when asked '¿Qué puedes hacer?' without unsolicited boiler lectures", async () => {
      const response = await copilotService.sendMessage({
        message: "¿Qué puedes hacer?",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("CAPABILITIES");

      // Verify required capability topics are mentioned
      expect(response.message).toContain("BioAzúcar Copilot");
      expect(response.message).toContain("estado actual de la planta");
      expect(response.message).toContain("KPIs");
      expect(response.message).toContain("alarmas");
      expect(response.message).toContain("equipos");
      expect(response.message).toContain("Data Lineage");
      expect(response.message).toContain("navegación autorizada");
      expect(response.message).toContain("acciones autorizadas");

      // STRICT NEGATIVE TEST: Must NOT begin with or dump boiler thermodynamics or Hugot formulas
      const lower = response.message.toLowerCase();
      expect(lower).not.toContain("hugot");
      expect(lower).not.toContain("asme ptc 4");
      expect(lower).not.toContain("1850 kcal");
      expect(lower).not.toContain("parrilla viajera");
      expect(lower).not.toContain("humedad de bagazo en 50%");
    });

    it("MUST return concise clarification prompt when query is completely unknown without guessing", async () => {
      const response = await copilotService.sendMessage({
        message: "xyz qwerty 12345678",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("UNKNOWN");
      expect(response.message).toContain("Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación. ¿Qué quieres consultar?");
    });

    it("MUST report real or simulated data clearly when querying process state", async () => {
      const response = await copilotService.sendMessage({
        message: "¿Cuál es el estado actual de la molienda?",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("PROCESS_STATE");
      expect(response.message).toContain(`${INITIAL_TELEMETRY.tch} TCH`);
    });

    it("MUST enforce confirmation workflow when user requests setpoint change", async () => {
      const response = await copilotService.sendMessage({
        message: "cambia el setpoint a 480",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("ACTION");
      expect(response.requiresConfirmation).toBe(true);
      expect(response.confirmationDetails).toBeDefined();
      expect(response.confirmationDetails?.level).toBe(3);
    });

    it("MUST provide complete Prometheus scrape SOP when asked how to lift and verify /metrics", async () => {
      const response = await copilotService.sendMessage({
        message: "cómo levantar y verificar el scrape de Prometheus mediante el endpoint /metrics",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("PROMETHEUS_METRICS");
      expect(response.message).toContain("GET /metrics");
      expect(response.message).toContain("curl -i http://localhost:3000/metrics");
      expect(response.message).toContain("bioazucar_milling_tch");
      expect(response.message).toContain("prometheus.yml");
      expect(response.message).toContain("scrape_interval: 15s");
      expect(response.message).toContain("targets: ['127.0.0.1:3000']");
    });

    it("MUST provide rigorous Hugot milling and ASME PTC 4 thermal balance calibration", async () => {
      const response = await copilotService.sendMessage({
        message: "calibrar los lazos de control de molienda según las fórmulas de E. Hugot y el balance térmico ASME PTC 4",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("MODEL_CALIBRATION");
      expect(response.message).toContain("E. Hugot");
      expect(response.message).toContain("100 - E_0");
      expect(response.message).toContain("SugarMillModelCalibrator");
      expect(response.message).toContain("ASME PTC 4");
      expect(response.message).toContain("PCI");
      expect(response.message).toContain("220 - 250 bar");
    });

    it("MUST provide industrial Edge Daemon deployment guide with official repository", async () => {
      const response = await copilotService.sendMessage({
        message: "despliegue y configuración del INDUSTRIAL EDGE DAEMON",
        context: baseContext,
        liveTelemetry: INITIAL_TELEMETRY,
        alarmsList: [],
        equipmentList: [],
        activeTenant,
      });

      expect(response.intent).toBe("EDGE_DAEMON_DEPLOYMENT");
      expect(response.message).toContain("https://github.com/dernys/BIOAZUCAR-4.0");
      expect(response.message).toContain("deploy/deploy-edge.sh");
      expect(response.message).toContain("/etc/bioazucar/edge.env");
      expect(response.message).toContain("bioazucar-edge.service");
    });
  });
});
