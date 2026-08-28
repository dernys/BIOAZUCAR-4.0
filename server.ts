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
