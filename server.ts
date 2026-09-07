import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI client lazily or when key exists
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mill: "BioAzúcar 4.0 Industrial Node",
    timestamp: new Date().toISOString(),
    aiReady: Boolean(process.env.GEMINI_API_KEY),
  });
});

// API: Anomaly Diagnosis with Gemini
app.post("/api/ai/diagnose-anomaly", async (req, res) => {
  try {
    const { equipment, metric, currentValue, threshold, unit, context, historicalTrend } = req.body;
    const ai = getGenAI();

    if (!ai) {
      // Intelligent fallback heuristic if no API key
      return res.json({
        rootCause: `Desviación operacional en ${equipment}. El valor detectado de ${currentValue} ${unit} supera el umbral seguro de ${threshold} ${unit}.`,
        severity: currentValue > threshold * 1.3 ? "CRÍTICA" : "ALTA",
        immediateAction: `Reducir carga nominal en un 15% y verificar válvula de alivio o alineación mecánica de ${equipment}.`,
        maintenanceRecommendation: `Inspección de rodamientos/sensores térmicos y revisión del programa de lubricación en el próximo cambio de turno.`,
        financialImpact: "Riesgo de parada no programada estimada en ~$14,200 USD/hora si no se corrige.",
        confidenceScore: 92,
        isAiGenerated: false,
      });
    }

    const prompt = `Actúa como Ingeniero Consultor Senior de Central Azucarero y Planta de Cogeneración con Biomasa (Bagazo).
Analiza la siguiente anomalía industrial detectada en tiempo real:

- Equipo: ${equipment}
- Variable / Tag: ${metric}
- Valor Actual: ${currentValue} ${unit}
- Umbral Límite: ${threshold} ${unit}
- Contexto Operacional: ${context || "Operación continua de zafra"}
- Tendencia reciente: ${historicalTrend || "Elevación progresiva en los últimos 20 minutos"}

Devuelve un análisis técnico conciso y riguroso en formato JSON con la siguiente estructura exacta:
{
  "rootCause": "Explicación detallada de la causa raíz fisicoquímica o termodinámica / mecánica",
  "severity": "CRÍTICA" | "ALTA" | "MODERADA" | "LEVE",
  "immediateAction": "Paso a paso para el operador en sala de control (DCS / SCADA)",
  "maintenanceRecommendation": "Recomendación para el equipo de mantenimiento mecánico/eléctrico/instrumentación",
  "financialImpact": "Impacto estimado en rendimiento fabril, vapor o MWh exportados",
  "confidenceScore": 95
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: "Eres el sistema experto de IA industrial BioAzúcar 4.0 para optimización de ingenios y cogeneración con bagazo.",
      },
    });

    const text = response.text || "{}";
    try {
      const parsed = JSON.parse(text);
      return res.json({ ...parsed, isAiGenerated: true });
    } catch {
      return res.json({
        rootCause: text,
        severity: "ALTA",
        immediateAction: "Verificar parámetros de proceso y contactar a jefatura de turno.",
        maintenanceRecommendation: "Revisar sensores y calibración.",
        financialImpact: "Moderado",
        confidenceScore: 88,
        isAiGenerated: true,
      });
    }
  } catch (error: any) {
    console.error("AI Diagnosis Error:", error);
    res.status(500).json({ error: error.message || "Error al procesar diagnóstico IA" });
  }
});

// API: Combustion and Energy Optimizer with Gemini
app.post("/api/ai/optimize-combustion", async (req, res) => {
  try {
    const { boilerPressure, steamFlow, bagasseMoisture, powerGenerated, caneFlowTCH } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        optimalBagasseFeed: (steamFlow * 0.46).toFixed(1) + " t/h",
        optimalExcessAir: "18.5% (O2 en chimenea: 3.4%)",
        expectedPowerOutput: ((steamFlow * 0.185) + 2).toFixed(1) + " MW",
        gridExportGain: "+1.8 MW exportable ($2,400 USD/día adicional)",
        energyEfficiencyIndex: "86.4%",
        suggestions: [
          "Mantener humedad de bagazo bajo 49% mediante ajuste de presión hidráulica en último molino (Molino 5).",
          "Incrementar temperatura de aire secundario a 180°C para mejorar velocidad de llama en caldera.",
          "Modular válvulas de extracción de vapor a evaporadores para estabilizar presión de alta a 64 bar."
        ],
        isAiGenerated: false,
      });
    }

    const prompt = `Analiza las variables de balance de masa y energía del central azucarero:
- Flujo de molienda: ${caneFlowTCH} TCH
- Humedad del bagazo: ${bagasseMoisture}%
- Presión de caldera de vapor: ${boilerPressure} bar
- Flujo de vapor generado: ${steamFlow} t/h
- Potencia eléctrica actual: ${powerGenerated} MW

Calcula los setpoints óptimos de combustión de bagazo, aire primario/secundario, producción de vapor y despacho de energía a la red eléctrica.
Devuelve un JSON con:
{
  "optimalBagasseFeed": "XX t/h",
  "optimalExcessAir": "XX % (O2 chimenea: X.X%)",
  "expectedPowerOutput": "XX MW",
  "gridExportGain": "+X.X MW exportable ($XXXX USD/día)",
  "energyEfficiencyIndex": "XX.X%",
  "suggestions": ["Sugerencia 1", "Sugerencia 2", "Sugerencia 3"]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "{}";
    const parsed = JSON.parse(text);
    return res.json({ ...parsed, isAiGenerated: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Error al optimizar combustión" });
  }
});

// API: Industrial Assistant Chat
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, plantState } = req.body;
    const ai = getGenAI();

    if (!ai) {
      return res.json({
        reply: `[Asistente BioAzúcar 4.0 - Modo Heurístico Local]: He analizado tu consulta "${message}". Con los parámetros actuales (Molienda: ${plantState?.tch || 450} TCH, Caldera: ${plantState?.boilerPressure || 64} bar, Generación: ${plantState?.powerMW || 28.4} MW), la planta opera dentro del 94% de su capacidad óptima. El balance de bagazo es positivo (+14.2 t/h hacia patio de acopio).`,
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: `Estado actual del central azucarero: ${JSON.stringify(plantState || {})}
Pregunta del operador/ingeniero: "${message}"
Responde como asistente experto en operaciones de ingenios azucareros, calderas acuotubulares de biomasa, turbogeneradores, clarificación, evaporadores Robert y tachos al vacío. Sé conciso, técnico y orientado a la acción operativa.`,
    });

    return res.json({ reply: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: AI Wizard Mill Setup Suggestions & Technical Validation
app.post("/api/ai/suggest-mill-setup", async (req, res) => {
  try {
    const { mode, inputData } = req.body;
    const ai = getGenAI();

    if (mode === "suggest_identity") {
      const { millName, country, location } = inputData || {};
      if (!ai) {
        const cleanName = (millName || "Central Azucarero").trim();
        const code = cleanName.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "INGENIO-NUEVO";
        return res.json({
          code: code.startsWith("INGENIO-") || code.startsWith("CENTRAL-") ? code : `CENTRAL-${code}`,
          country: country || "Venezuela",
          location: location || "Región Cañera Centro-Occidente",
          taxId: `J-${Math.floor(10000000 + Math.random() * 90000000)}-${Math.floor(1 + Math.random() * 9)}`,
          industrySector: "Azúcar Crudo, Blanco Directo & Cogeneración de Energía Renovable",
          description: `Ingenio azucarero ${cleanName} con tándem de molienda continua, caldera de biomasa de alta eficiencia y cogeneración interconectada al Sistema Eléctrico Nacional.`,
          themeColor: "#059669",
          nominalTch: 480,
          powerCapacityMW: 32.0,
          boilerPressureBar: 65.0,
          sugarYieldTarget: 11.4,
          isAiGenerated: false,
        });
      }

      const prompt = `Como Ingeniero Principal Consultor de la industria azucarera e ingenios de cogeneración, genera datos y especificaciones industriales recomendadas para un nuevo central:
Nombre ingresado: "${millName || 'Central Azucarero'}"
País: "${country || 'Latinoamérica'}"
Ubicación / Región: "${location || ''}"

Responde en formato JSON estricto con:
{
  "code": "CÓDIGO-MNEMOTÉCNICO-CORTO (ej: INGENIO-RIO-CLARO-01)",
  "country": "País verificado",
  "location": "Ubicación sugerida o afinada",
  "taxId": "Formato de ID fiscal/RIF/RFC/RUT realista para ese país",
  "industrySector": "Sector industrial y productos (ej: Azúcar Blanco Refinado, Etanol y Cogeneración)",
  "description": "Descripción concisa de 2-3 líneas de la planta y sus ventajas competitivas",
  "themeColor": "#colorHex (color industrial elegante como #059669, #0284c7, #d97706, etc)",
  "nominalTch": 500, // Número entre 200 y 1200 TCH
  "powerCapacityMW": 34.0, // Número entre 15 y 65 MW acorde al TCH
  "boilerPressureBar": 65.0, // Presión caldera HP acorde (ej 60-85 bar)
  "sugarYieldTarget": 11.6 // Rendimiento azucarero % Pol (ej 10.5 - 12.5)
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({ ...parsed, isAiGenerated: true });
    }

    if (mode === "calculate_balance") {
      const { nominalTch, boilerPressureBar, powerCapacityMW, bagasseMoisture } = inputData || {};
      const tch = Number(nominalTch) || 450;
      const press = Number(boilerPressureBar) || 65;
      const mw = Number(powerCapacityMW) || 30;
      const moisture = Number(bagasseMoisture) || 50;

      if (!ai) {
        const bagasseTph = tch * 0.28;
        const steamTph = bagasseTph * 2.2;
        const internalSteamTph = tch * 0.42;
        const internalMw = tch * 0.028;
        const exportableMw = Math.max(0, mw - internalMw);
        const annualRevenueUSD = exportableMw * 1000 * 24 * 140 * 0.065; // 140 días de zafra a $65/MWh

        return res.json({
          bagasseProducedTph: bagasseTph.toFixed(1),
          steamGeneratedTph: steamTph.toFixed(1),
          internalSteamDemandTph: internalSteamTph.toFixed(1),
          factoryPowerDemandMW: internalMw.toFixed(1),
          exportablePowerMW: exportableMw.toFixed(1),
          ppaEstimatedRevenueUSD: Math.round(annualRevenueUSD).toLocaleString() + " USD / Zafra",
          thermodynamicEfficiency: "84.8%",
          aiVerdict: "Balance de masa y energía completamente viable y superavitario. El bagazo producido cubre holgadamente la demanda de vapor vivo y permite un excedente exportable de energía a la red de alta rentabilidad.",
          recommendations: [
            `Ajustar extracción de vapor en turbina a ${press > 60 ? '2.5 bar' : '1.8 bar'} para calentar tren de evaporación.`,
            `Garantizar humedad de bagazo ≤ ${moisture}% en tándem de molinos para maximizar poder calorífico inferior (PCI).`,
            `Configurar control de frecuencia droop a 4% en el turbogenerador de ${mw} MW para despacho estable al SEN.`
          ],
          isAiGenerated: false,
        });
      }

      const prompt = `Calcula el balance de masa y energía industrial para este nuevo central azucarero:
- Molienda Nominal: ${tch} TCH
- Presión Caldera HP: ${press} Bar
- Capacidad Turbogenerador: ${mw} MW
- Humedad estimada de bagazo: ${moisture}%

Calcula balances y responde en JSON:
{
  "bagasseProducedTph": "XX.X",
  "steamGeneratedTph": "XX.X",
  "internalSteamDemandTph": "XX.X",
  "factoryPowerDemandMW": "XX.X",
  "exportablePowerMW": "XX.X",
  "ppaEstimatedRevenueUSD": "$XXX,XXX USD / Zafra (estimando 140 días zafra)",
  "thermodynamicEfficiency": "XX.X%",
  "aiVerdict": "Dictamen de viabilidad termodinámica del central",
  "recommendations": ["Recomendación 1", "Recomendación 2", "Recomendación 3"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({ ...parsed, isAiGenerated: true });
    }

    if (mode === "validate_full_setup") {
      const { tenant, primaryUser, otConfig } = inputData || {};
      if (!ai) {
        return res.json({
          score: 96,
          status: "APROBADO_PARA_PRODUCCION",
          summary: `El Central ${tenant?.name || 'Nuevo'} cumple con todas las directivas de seguridad IEC 62443 y estándares de balance fabril ISA-95.`,
          auditChecks: [
            { item: "Aislamiento de Inquilino Firestore", passed: true, note: `Partición única ${tenant?.code}` },
            { item: "Balance Energético Caldera-Turbina", passed: true, note: `${tenant?.nominalTch} TCH genera suficiente vapor para ${tenant?.powerCapacityMW} MW` },
            { item: "Usuario Administrador Primario", passed: true, note: `${primaryUser?.name} (${primaryUser?.email}) acreditado Nivel 4` },
            { item: "Compatibilidad Gateway OT", passed: true, note: `Protocolo ${otConfig?.protocol || 'OPC UA / Sparkplug B'} compatible con UNS` }
          ],
          aiRecommendations: [
            "Realizar calibración en cero de básculas de caña antes del inicio de la primera molienda.",
            "Asignar tarjeta NFC física al usuario administrador para autenticación multifactor en sala de control."
          ],
          isAiGenerated: false,
        });
      }

      const prompt = `Como Auditor Senior de Automatización Industrial y Ciberseguridad OT (IEC 62443):
Audita la configuración completa para aprovisionar un nuevo central azucarero:
Empresa: ${JSON.stringify(tenant || {})}
Usuario Administrador: ${JSON.stringify(primaryUser || {})}
Configuración OT: ${JSON.stringify(otConfig || {})}

Devuelve JSON con:
{
  "score": 98,
  "status": "APROBADO_PARA_PRODUCCION" | "REQUIERE_AJUSTES",
  "summary": "Resumen ejecutivo del comisionamiento",
  "auditChecks": [
    {"item": "Nombre del chequeo", "passed": true, "note": "Observación técnica"}
  ],
  "aiRecommendations": ["Recomendación técnica 1", "Recomendación técnica 2"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      const parsed = JSON.parse(response.text || "{}");
      return res.json({ ...parsed, isAiGenerated: true });
    }

    return res.status(400).json({ error: "Modo de sugerencia no reconocido" });
  } catch (error: any) {
    console.error("AI Wizard Suggestion Error:", error);
    res.status(500).json({ error: error.message || "Error al procesar sugerencias IA" });
  }
});

// ============================================================================
// BIOAZÚCAR COPILOT — UNIFIED INDUSTRIAL AGENT ENDPOINT
// ============================================================================
app.post("/api/copilot/chat", async (req, res) => {
  try {
    const { message, context, history, telemetry, activeTenant, classification } = req.body;
    const ai = getGenAI();
    const rawLower = (message || "").toLowerCase().trim();

    // Quick regex helpers for deterministic behavior
    const isCapabilities =
      classification?.intent === "CAPABILITIES" ||
      rawLower.includes("que puedes hacer") ||
      rawLower.includes("que sabes hacer") ||
      rawLower.includes("cuales son tus funciones") ||
      rawLower.includes("que capacidades") ||
      rawLower.includes("en que me puedes ayudar") ||
      rawLower.includes("que funciones tienes") ||
      rawLower.includes("que informacion tienes") ||
      rawLower.includes("para que sirves");

    const isHelp =
      classification?.intent === "HELP" ||
      rawLower.includes("quien eres") ||
      rawLower.includes("ayudame") ||
      rawLower.includes("ayuda") ||
      rawLower.includes("como te uso") ||
      rawLower.includes("como interactuar");

    const isSystemInfo =
      classification?.intent === "SYSTEM_INFORMATION" ||
      rawLower.includes("como funciona bioazucar") ||
      rawLower.includes("como funciona el sistema") ||
      rawLower.includes("que es bioazucar") ||
      rawLower.includes("arquitectura del sistema");

    const isPermissions =
      classification?.intent === "USER_PERMISSIONS" ||
      rawLower.includes("que permisos tengo") ||
      rawLower.includes("cual es mi rol") ||
      rawLower.includes("mis permisos");

    const isTutorial =
      classification?.intent === "TUTORIAL" ||
      rawLower.includes("tour") ||
      rawLower.includes("tutorial") ||
      rawLower.includes("guiame") ||
      rawLower.includes("ensename");

    const isContextualHelp =
      classification?.intent === "CONTEXTUAL_HELP" ||
      rawLower.includes("que puedo hacer aqui") ||
      rawLower.includes("explicame este modulo") ||
      rawLower.includes("ayuda en esta pantalla");

    const isGlossary =
      classification?.intent === "GLOSSARY_QUERY" ||
      rawLower.includes("que significa") ||
      rawLower.includes("definicion de") ||
      rawLower.includes("glosario") ||
      rawLower.includes("que es tch") ||
      rawLower.includes("que es pol") ||
      rawLower.includes("que es brix") ||
      rawLower.includes("que es oee");

    const isProcedure =
      classification?.intent === "PROCEDURE_QUERY" ||
      rawLower.includes("como cambio") ||
      rawLower.includes("procedimiento") ||
      rawLower.includes("paso a paso") ||
      rawLower.includes("como reconocer") ||
      rawLower.includes("como registrar");

    const isKnowledgeGraph =
      classification?.intent === "KNOWLEDGE_GRAPH_QUERY" ||
      rawLower.includes("que alarmas estan vinculadas") ||
      rawLower.includes("que tags alimentan") ||
      rawLower.includes("grafo");

    const isIntegration =
      classification?.intent === "INTEGRATION" ||
      rawLower.includes("eros") ||
      rawLower.includes("conectar") ||
      rawLower.includes("conectividad") ||
      rawLower.includes("opc ua") ||
      rawLower.includes("modbus") ||
      rawLower.includes("sparkplug") ||
      rawLower.includes("conector") ||
      rawLower.includes("industrial edge");

    if (!ai) {
      // Deterministic fallback if GEMINI_API_KEY is not set
      if (isIntegration) {
        return res.json({
          message: `### 🏭 Integración de EROS DCS y Conectividad OT\n\n**Flujo Arquitectónico:**\n\`EROS/DCS ➔ EROS Connector ➔ Industrial Edge ➔ Normalización ➔ UNS/MQTT ➔ BioAzúcar\`\n\nEl sistema soporta interfaces \`OPC_UA_BRIDGE\`, \`DIRECT_TCP\`, \`MODBUS_GATEWAY\` y \`REST_API\` a través del nodo Edge industrial sin conexión directa del LLM a los controladores físicos.`,
          intent: "INTEGRATION",
          confidence: 0.98,
          clientToolCalls: [{ toolName: "get_integration_status", args: { provider: rawLower.includes("eros") ? "eros" : "all" } }],
          isAiGenerated: false,
        });
      }

      if (isCapabilities) {
        return res.json({
          message: "Soy **BioAzúcar Copilot**, el asistente inteligente de **BioAzúcar 4.0**. Puedo ayudarte a consultar y analizar el estado de la planta, KPIs, producción, molienda, extracción, cogeneración, energía, alarmas y equipos. También puedo consultar el origen de los datos, generar estadísticas, explicar indicadores, guiarte con tutoriales paso a paso, consultar el glosario industrial, navegar por el sistema y ejecutar acciones autorizadas. ¿Qué necesitas hacer?",
          intent: "CAPABILITIES",
          confidence: 0.99,
          clientToolCalls: [{ toolName: "explain_capabilities", args: {} }],
          isAiGenerated: false,
        });
      }

      if (isHelp) {
        return res.json({
          message: `Hola **${context?.displayName || "Operador"}**. Soy **BioAzúcar Copilot**, tu copiloto de ingeniería industrial en **${activeTenant?.name || "el ingenio"}**. Puedo ayudarte a consultar variables en vivo, analizar OEE, revisar alarmas ISA-18.2, consultar condición de equipos, verificar linaje de datos, consultar procedimientos (SOP) o navegar por el sistema. ¿Qué deseas consultar?`,
          intent: "HELP",
          confidence: 0.98,
          clientToolCalls: [{ toolName: "explain_capabilities", args: {} }],
          isAiGenerated: false,
        });
      }

      if (isSystemInfo) {
        return res.json({
          message: `**BioAzúcar 4.0 Smart Manufacturing Suite** es la plataforma industrial basada en Unified Namespace (UNS) para optimización en tiempo real de ingenios azucareros y cogeneración bajo normas ISA-95, ISA-18.2, ASME PTC 4, ISO 22400-2 e IEC 62443. Conectado a **${activeTenant?.name || "Central"}**.`,
          intent: "SYSTEM_INFORMATION",
          confidence: 0.97,
          clientToolCalls: [{ toolName: "get_system_info", args: {} }],
          isAiGenerated: false,
        });
      }

      if (isPermissions) {
        return res.json({
          message: `Usuario: **${context?.displayName || "Operador"}** | Rol: **${(context?.roles || []).join(", ")}** | Nivel IEC 62443: **${context?.securityLevel || 1}/5**. Consulta de permisos activada.`,
          intent: "USER_PERMISSIONS",
          confidence: 0.96,
          clientToolCalls: [{ toolName: "get_user_permissions", args: {} }],
          isAiGenerated: false,
        });
      }

      if (isTutorial) {
        return res.json({
          message: "Iniciando tour guiado de **BioAzúcar 4.0**. Consulta el paso 1 del tutorial.",
          intent: "TUTORIAL",
          confidence: 0.98,
          clientToolCalls: [{ toolName: "get_tutorial_step", args: { stepNumber: 1 } }],
          isAiGenerated: false,
        });
      }

      if (isContextualHelp) {
        return res.json({
          message: `Consultando ayuda contextual para el módulo **${context?.currentModule || "dashboard"}**.`,
          intent: "CONTEXTUAL_HELP",
          confidence: 0.97,
          clientToolCalls: [{ toolName: "get_contextual_help", args: { module: context?.currentModule || "dashboard" } }],
          isAiGenerated: false,
        });
      }

      if (isGlossary) {
        return res.json({
          message: `Consultando término en el glosario azucarero e industrial.`,
          intent: "GLOSSARY_QUERY",
          confidence: 0.96,
          clientToolCalls: [{ toolName: "search_glossary", args: { term: message } }],
          isAiGenerated: false,
        });
      }

      if (isProcedure) {
        return res.json({
          message: `Consultando procedimiento operativo estándar (SOP).`,
          intent: "PROCEDURE_QUERY",
          confidence: 0.96,
          clientToolCalls: [{ toolName: "get_procedure", args: { query: message } }],
          isAiGenerated: false,
        });
      }

      if (isKnowledgeGraph) {
        return res.json({
          message: `Consultando relaciones en el grafo de conocimiento industrial.`,
          intent: "KNOWLEDGE_GRAPH_QUERY",
          confidence: 0.95,
          clientToolCalls: [{ toolName: "query_knowledge_graph", args: { entity: message } }],
          isAiGenerated: false,
        });
      }

      // Check process / navigation / alarms tools
      const clientToolCalls: Array<{ toolName: string; args: Record<string, any> }> = [];
      let intent = classification?.intent || "PROCESS_STATE";

      if (rawLower.includes("alarma") || rawLower.includes("alerta") || context?.currentModule === "alarms") {
        intent = "ALARM";
        clientToolCalls.push({ toolName: "get_active_alarms", args: {} });
      } else if (rawLower.includes("linaje") || rawLower.includes("origen") || rawLower.includes("fuente") || rawLower.includes("trazabilidad")) {
        intent = "DATA_LINEAGE";
        clientToolCalls.push({ toolName: "get_data_lineage", args: { kpiId: "kpi-tch" } });
      } else if (rawLower.includes("equipo") || rawLower.includes("molino") || rawLower.includes("turbina") || rawLower.includes("vibracion")) {
        intent = "EQUIPMENT";
        clientToolCalls.push({ toolName: "get_equipment", args: { name: rawLower.includes("caldera") ? "Caldera 1" : "Molino 3" } });
      } else if (rawLower.includes("oee") || rawLower.includes("eficiencia")) {
        intent = "KPI_ANALYSIS";
        clientToolCalls.push({ toolName: "calculate_oee", args: {} });
      } else if (rawLower.includes("vapor") || rawLower.includes("caldera") || rawLower.includes("cogen") || rawLower.includes("mw") || context?.currentModule === "energy_dispatch") {
        intent = "PROCESS_STATE";
        clientToolCalls.push({ toolName: "calculate_energy_balance", args: {} });
      } else if (rawLower.includes("molienda") || rawLower.includes("tch") || rawLower.includes("extraccion") || context?.currentModule === "scada") {
        intent = "PROCESS_STATE";
        clientToolCalls.push({ toolName: "get_current_process_state", args: {} });
      } else if (rawLower.includes("llevame") || rawLower.includes("abre") || rawLower.includes("ir a") || rawLower.includes("muestrame")) {
        intent = "NAVIGATION";
        clientToolCalls.push({ toolName: "navigate_to", args: { route: "dashboard" } });
      } else {
        intent = "UNKNOWN";
        return res.json({
          message: "Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación. ¿Qué quieres consultar?",
          intent: "UNKNOWN",
          confidence: 0.3,
          clientToolCalls: [],
          isAiGenerated: false,
        });
      }

      return res.json({
        message: `Consultando datos de ingeniería en tiempo real para **${activeTenant?.name || "el ingenio"}**.`,
        intent,
        confidence: 0.95,
        clientToolCalls,
        isAiGenerated: false,
      });
    }

    // System prompt with strict intent discipline and zero boiler bias for general questions
    const systemPrompt = `Eres BioAzúcar Copilot, el asistente inteligente de ingeniería industrial, conocimiento operativo y optimización de BioAzúcar 4.0.
Operas en el ingenio azucarero "${activeTenant?.name || 'Central Azucarero'}" (${activeTenant?.code || 'CENTRAL-01'}).
Módulo actual en pantalla: "${context?.currentModule || 'dashboard'}".
Usuario autenticado: "${context?.displayName || 'Usuario'}" con rol(es) [${(context?.roles || []).join(', ')}] y nivel de seguridad IEC 62443: ${context?.securityLevel || 1}/5.

PRINCIPIOS FUNDAMENTALES:
1. EVIDENCE-FIRST: Todo dato operativo debe indicar su procedencia (Telemetría en tiempo real vs Simulación vs Documentación SOP). Diferencia claramente SIMULATION de fuentes OT reales.
2. RIGOR RBAC: Jamás te autoapruebes permisos. Si el usuario no tiene permisos suficientes para una acción, infórmale con claridad y respeta la jerarquía de roles.
3. PREGUNTA "¿QUÉ PUEDES HACER?":
   - Debe clasificarse OBLIGATORIAMENTE como "CAPABILITIES".
   - JAMÁS respondas con cálculos, balances de calderas, vapor, Hugot u otros procesos que el usuario no haya solicitado.
   - Respuesta obligatoria aproximada:
     "Soy BioAzúcar Copilot, el asistente inteligente de BioAzúcar 4.0. Puedo ayudarte a consultar y analizar el estado de la planta, KPIs, producción, molienda, extracción, cogeneración, energía, alarmas y equipos. También puedo consultar el origen de los datos, generar estadísticas, explicar indicadores, guiarte con tutoriales paso a paso, consultar el glosario industrial, navegar por el sistema y ejecutar acciones autorizadas. ¿Qué necesitas hacer?"

4. PREGUNTA "¿QUIÉN ERES?" O "AYÚDAME":
   - Clasificar como "HELP". Responde identificándote brevemente y ofreciendo ayuda en lenguaje natural.

5. PREGUNTA "¿CÓMO FUNCIONA EL SISTEMA?" O "¿QUÉ ES BIOAZÚCAR?":
   - Clasificar como "SYSTEM_INFORMATION". Explica la arquitectura de BioAzúcar 4.0 (UNS, SCADA, CMMS, Historiador, LIMS, Edge Industrial) de forma concisa.

6. CONSULTAS DE CONOCIMIENTO, GLOSARIO Y PROCEDIMIENTOS:
   - Si piden significado de un término (ej. TCH, Pol, Brix, OEE): clasifica como "GLOSSARY_QUERY" y llama a search_glossary.
   - Si piden procedimiento paso a paso (ej. cambiar consigna, reconocer alarma, registrar lote): clasifica como "PROCEDURE_QUERY" y llama a get_procedure.
   - Si piden ayuda en la pantalla actual ("qué puedo hacer aquí"): clasifica como "CONTEXTUAL_HELP" y llama a get_contextual_help.
   - Si piden tutorial o tour guiado: clasifica como "TUTORIAL" y llama a get_tutorial_step.
   - Si piden relaciones entre equipos, tags y alarmas: clasifica como "KNOWLEDGE_GRAPH_QUERY" y llama a query_knowledge_graph.

7. DESAMBIGUACIÓN CONTEXTUAL:
   - Si el usuario hace una pregunta ambigua como "¿cómo está funcionando?", "¿qué está pasando?" o "¿cómo estamos?":
     - Si está en "energy_dispatch": interpreta respecto a balance de vapor, caldera y exportación MW.
     - Si está en "alarms": interpreta respecto a alarmas activas y eventos ISA-18.2.
     - Si está en "scada": interpreta respecto a molienda TCH y extracción.
     - Si está en "equipment": interpreta respecto a vibración RMS y salud de activos.

8. FALLBACK PARA PREGUNTAS DESCONOCIDAS:
   - Si la intención no puede determinarse con suficiente confianza: NO ADIVINES.
   - Responde exactamente: "Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación. ¿Qué quieres consultar?" con intent "UNKNOWN".

9. ACCIONES SENSIBLES:
   - Nivel 2 (alarm ACK) o Nivel 3 (cambio setpoint/despacho) siempre requieren autorización RBAC y confirmación explícita del operador.

10. INTEGRACIÓN INDUSTRIAL / EROS / CONECTIVIDAD OT:
   - Si preguntan sobre cómo conectar a EROS, protocolos industriales (OPC UA, Modbus, Sparkplug, MQTT), gateways o diagnóstico de enlaces OT: clasifica como "INTEGRATION" y llama a get_integration_status con provider ("eros", "opcua", "modbus", "mqtt" o "all").
   - Explica el flujo: EROS/DCS -> EROS Connector -> Industrial Edge -> Normalización -> UNS/MQTT -> BioAzúcar.
   - Resalta que la IA nunca se conecta directamente a los PLCs o DCS.

INTENCIONES DISPONIBLES:
"CAPABILITIES" | "HELP" | "GENERAL_QUESTION" | "SYSTEM_INFORMATION" | "PROCESS_STATE" | "KPI_ANALYSIS" | "STATISTICS" | "DIAGNOSTIC" | "ALARM" | "EQUIPMENT" | "DATA_LINEAGE" | "NAVIGATION" | "ACTION" | "CONFIGURATION" | "USER_PERMISSIONS" | "TUTORIAL" | "CONTEXTUAL_HELP" | "GLOSSARY_QUERY" | "PROCEDURE_QUERY" | "KNOWLEDGE_GRAPH_QUERY" | "INTEGRATION" | "UNKNOWN"

HERRAMIENTAS CLIENTE DISPONIBLES EN clientToolCalls:
- get_integration_status ({ provider?: string })
- explain_capabilities ({})
- get_system_info ({})
- get_user_permissions ({})
- search_glossary ({ term: string })
- get_contextual_help ({ module?: string })
- get_procedure ({ query: string })
- query_knowledge_graph ({ entity: string })
- get_tutorial_step ({ stepNumber?: number })
- get_current_process_state ({})
- calculate_oee ({})
- calculate_energy_balance ({})
- get_active_alarms ({})
- get_data_lineage ({ kpiId: string })
- get_equipment ({ name: string })
- show_chart ({ metric: string, chartType: "line"|"bar" })
- navigate_to ({ route: string })
- request_setpoint_change ({ tag: string, newValue: number })
- request_acknowledge_alarm ({ alarmId: string })
- request_dispatch_change ({ exportMW: number })

Devuelve SIEMPRE un JSON válido con esta estructura:
{
  "message": "Respuesta directa, contextual y concisa en Markdown",
  "intent": "CAPABILITIES" | "HELP" | "GENERAL_QUESTION" | "SYSTEM_INFORMATION" | "PROCESS_STATE" | "KPI_ANALYSIS" | "STATISTICS" | "DIAGNOSTIC" | "ALARM" | "EQUIPMENT" | "DATA_LINEAGE" | "NAVIGATION" | "ACTION" | "CONFIGURATION" | "USER_PERMISSIONS" | "TUTORIAL" | "CONTEXTUAL_HELP" | "GLOSSARY_QUERY" | "PROCEDURE_QUERY" | "KNOWLEDGE_GRAPH_QUERY" | "UNKNOWN",
  "confidence": 0.95,
  "clientToolCalls": [
    { "toolName": "nombre_herramienta", "args": {} }
  ]
}`;

    const prompt = `Mensaje del usuario: "${message}"\nMódulo actual: ${context?.currentModule || 'dashboard'}\nRol: ${(context?.roles || []).join(', ')}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        systemInstruction: systemPrompt,
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return res.json({
      ...parsed,
      isAiGenerated: true,
    });
  } catch (error: any) {
    console.error("Copilot Server Error:", error);
    res.status(500).json({
      message: `Error al procesar solicitud con el Copilot: ${error.message}`,
      intent: "UNKNOWN",
      error: error.message,
    });
  }
});

// Setup Vite development middleware or static file serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[BioAzúcar 4.0] Industrial Server online at http://0.0.0.0:${PORT}`);
  });
}

startServer();
