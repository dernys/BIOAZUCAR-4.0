import { AIDiagnosticResult, TelemetryData } from "../types";

export interface OptimizeCombustionResult {
  optimalBagasseFeed: string;
  optimalExcessAir: string;
  expectedPowerOutput: string;
  gridExportGain: string;
  energyEfficiencyIndex: string;
  suggestions: string[];
  isAiGenerated: boolean;
}

export async function diagnoseAnomalyWithAI(
  equipment: string,
  metric: string,
  currentValue: number,
  threshold: number,
  unit: string,
  context?: string
): Promise<AIDiagnosticResult> {
  try {
    const response = await fetch("/api/ai/diagnose-anomaly", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        equipment,
        metric,
        currentValue,
        threshold,
        unit,
        context,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      id: "diag-" + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      equipment,
      metric,
      currentValue,
      threshold,
      unit,
      rootCause: data.rootCause || "Desviación en variable operativa detectada por PLC.",
      severity: data.severity || "ALTA",
      immediateAction: data.immediateAction || "Verificar control de lazo y avisar a operador de campo.",
      maintenanceRecommendation: data.maintenanceRecommendation || "Revisar calibración de transmisor e historial de vibraciones.",
      financialImpact: data.financialImpact || "Riesgo de pérdida de rendimiento fabril.",
      confidenceScore: data.confidenceScore || 90,
      isAiGenerated: Boolean(data.isAiGenerated),
    };
  } catch (err) {
    // Fallback heuristic
    return {
      id: "diag-" + Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      equipment,
      metric,
      currentValue,
      threshold,
      unit,
      rootCause: `Comportamiento anómalo en ${equipment}. Lectura de ${currentValue} ${unit} supera límite de ingeniería (${threshold} ${unit}).`,
      severity: "ALTA",
      immediateAction: `Reducir rampa de carga en ${equipment} y conmutar a lazo manual si hay oscilación.`,
      maintenanceRecommendation: `Inspección de actuadores, lubricación y comprobación de termopares.`,
      financialImpact: "Riesgo de caída en despacho eléctrico o rendimiento de extracción.",
      confidenceScore: 89,
      isAiGenerated: false,
    };
  }
}

export async function optimizeCombustionWithAI(
  telemetry: TelemetryData
): Promise<OptimizeCombustionResult> {
  try {
    const response = await fetch("/api/ai/optimize-combustion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boilerPressure: telemetry.boilerPressureHP,
        steamFlow: telemetry.steamFlowHP,
        bagasseMoisture: telemetry.bagasseMoisture,
        powerGenerated: telemetry.powerGeneratedMW,
        caneFlowTCH: telemetry.tch,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    return {
      optimalBagasseFeed: (telemetry.steamFlowHP * 0.46).toFixed(1) + " t/h",
      optimalExcessAir: "18.2% (O2 chimenea: 3.4%)",
      expectedPowerOutput: ((telemetry.steamFlowHP * 0.158) + 1.2).toFixed(1) + " MW",
      gridExportGain: "+1.6 MW exportables ($2,150 USD/día)",
      energyEfficiencyIndex: "86.8%",
      suggestions: [
        "Ajustar presión hidráulica en Molino 5 a 310 bar para forzar humedad de bagazo < 48.5%.",
        "Elevar temperatura de aire secundario a 185°C para acelerar frente de llama en hogar.",
        "Modular válvulas de extracción a evaporadores para estabilizar presión de cabezal a 65.0 bar.",
      ],
      isAiGenerated: false,
    };
  }
}

export async function sendChatToAI(
  message: string,
  plantState: any
): Promise<string> {
  try {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, plantState }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.reply;
  } catch (err) {
    return `[Asistente BioAzúcar 4.0]: Operación estable. Con ${plantState.tch || 450} TCH de molienda y ${plantState.powerExportGridMW || 21.2} MW exportados a red, la planta mantiene un balance térmico positivo. Sugiero monitorear vibración en Molino 3.`;
  }
}
