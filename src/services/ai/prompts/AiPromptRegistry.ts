/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — INDUSTRIAL AI PROMPT REGISTRY & GOVERNANCE (IEC 62443 SL3)
 * [P0-13] AUDITED PROMPT VERSIONING, VARIABLE INTERPOLATION & LIFECYCLE GATES
 * ============================================================================
 */

export type PromptLifecycleStatus = "DRAFT" | "TEST" | "APPROVED" | "ACTIVE" | "ARCHIVED";

export interface PromptDefinition {
  promptId: string;
  version: string;
  displayName: string;
  purpose: string;
  targetModel: string;
  systemPrompt: string;
  templateBody?: string;
  variables: string[];
  tools: string[];
  temperature: number;
  maxOutputTokens: number;
  status: PromptLifecycleStatus;
  createdBy: string;
  approvedBy?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export const INITIAL_PROMPT_CATALOG: PromptDefinition[] = [
  {
    promptId: "prompt-copilot-industrial-core",
    version: "2.4.0",
    displayName: "Copilot Ingeniero Industrial Principal",
    purpose: "Asistente operativo de planta para diagnóstico de molienda, calderas y turbogeneración",
    targetModel: "gemini-2.5-flash",
    systemPrompt: `Eres el Asistente Experto Industrial de BioAzúcar 4.0.
Actúas bajo la normativa IEC 62443 SL3 e ISA-95 L3/L4.
SIEMPRE debes respaldar tus afirmaciones con telemetría real o del historiador mediante llamadas a herramientas controladas.
NUNCA inventes setpoints ni valores de sensores. Si los datos no están disponibles, indícalo claramente.
Clasifica todas tus fuentes como REAL, SIMULATED, HISTORICAL, RAG o HEURISTIC.`,
    variables: ["plantName", "currentRole", "currentModule", "nominalTch"],
    tools: [
      "queryHistorian",
      "getLivePlantState",
      "getAlarms",
      "getEquipmentState",
      "getProduction",
      "getEnergy",
      "searchRag",
    ],
    temperature: 0.2,
    maxOutputTokens: 2048,
    status: "ACTIVE",
    createdBy: "admin@bioazucar.com",
    approvedBy: "ciberseguridad@bioazucar.com",
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2026-03-10T00:00:00Z",
  },
  {
    promptId: "prompt-rca-extraction-anomaly",
    version: "1.2.0",
    displayName: "Análisis Causa Raíz: Caída de Extracción en Molinos",
    purpose: "Diagnóstico causal multifactorial de pérdidas de extracción en tándem de molienda",
    targetModel: "gemini-1.5-pro",
    systemPrompt: `Eres el motor experto de Análisis de Causa Raíz (RCA) para el tándem de molienda de BioAzúcar 4.0.
Cuando se te consulte por caída en la extracción de sacarosa (% Pol en bagazo o extracción reducida), debes correlacionar:
1. TCH (toneladas de caña por hora) vs capacidad nominal.
2. Tasa de agua de imbibición % caña y temperatura del agua.
3. Presión hidráulica en chumaceras superiores de los molinos.
4. Torque y corriente de accionamientos/turbinas.
5. Humedad de bagazo residual.
6. Historial de paradas y órdenes de mantenimiento recientes.
Formula conclusiones con nivel de certeza e hipótesis ordenadas por probabilidad.`,
    variables: ["millTandemId", "timeWindowHours", "baselineExtractionRate"],
    tools: ["queryHistorian", "getAlarms", "getMaintenance", "searchRag", "calculate"],
    temperature: 0.1,
    maxOutputTokens: 3072,
    status: "ACTIVE",
    createdBy: "ingeniero.jefe@bioazucar.com",
    approvedBy: "director.operaciones@bioazucar.com",
    effectiveFrom: "2025-06-01T00:00:00Z",
    createdAt: "2025-06-01T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
  {
    promptId: "prompt-combustion-optimizer",
    version: "1.0.5",
    displayName: "Optimizador de Combustión ASME PTC 4",
    purpose: "Cálculo de consignas de bagazo, aire forzado e inducido para calderas acuotubulares",
    targetModel: "gemini-2.5-flash",
    systemPrompt: `Eres el optimizador térmico de calderas de vapor de alta presión.
Calcula el exceso de aire estequiométrico y la velocidad de alimentadores de bagazo minimizando CO no quemado y maximizando eficiencia térmica según ASME PTC 4.`,
    variables: ["boilerId", "steamPressureBar", "o2FlueGasPercent"],
    tools: ["getBoilerState", "calculate", "comparePeriods"],
    temperature: 0.15,
    maxOutputTokens: 1024,
    status: "ACTIVE",
    createdBy: "ingeniero.energia@bioazucar.com",
    approvedBy: "superadmin@bioazucar.com",
    effectiveFrom: "2025-03-01T00:00:00Z",
    createdAt: "2025-03-01T00:00:00Z",
    updatedAt: "2026-01-20T00:00:00Z",
  },
];

export class AiPromptRegistry {
  private static instance: AiPromptRegistry | null = null;
  private prompts = new Map<string, PromptDefinition>();

  private constructor() {
    for (const p of INITIAL_PROMPT_CATALOG) {
      this.prompts.set(p.promptId, { ...p });
    }
  }

  public static getInstance(): AiPromptRegistry {
    if (!AiPromptRegistry.instance) {
      AiPromptRegistry.instance = new AiPromptRegistry();
    }
    return AiPromptRegistry.instance;
  }

  public getAll(): PromptDefinition[] {
    return Array.from(this.prompts.values());
  }

  public getById(promptId: string): PromptDefinition | undefined {
    return this.prompts.get(promptId);
  }

  public getActivePrompt(promptId: string): PromptDefinition | undefined {
    const p = this.prompts.get(promptId);
    return p && p.status === "ACTIVE" ? p : undefined;
  }

  public createPrompt(data: Omit<PromptDefinition, "createdAt" | "updatedAt">): PromptDefinition {
    if (this.prompts.has(data.promptId)) {
      throw new Error(`Prompt ID '${data.promptId}' already exists.`);
    }

    const now = new Date().toISOString();
    const prompt: PromptDefinition = {
      ...data,
      status: data.status || "DRAFT",
      createdAt: now,
      updatedAt: now,
    };

    this.prompts.set(prompt.promptId, prompt);
    return prompt;
  }

  public updatePrompt(promptId: string, updates: Partial<PromptDefinition>): PromptDefinition {
    const existing = this.prompts.get(promptId);
    if (!existing) {
      throw new Error(`Prompt '${promptId}' not found.`);
    }

    // Safety guard: Promoting to ACTIVE in production requires approver
    if (updates.status === "ACTIVE" && !updates.approvedBy && !existing.approvedBy) {
      throw new Error("No se puede promover un prompt a ACTIVE sin una firma de aprobación (approvedBy).");
    }

    const updated: PromptDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.prompts.set(promptId, updated);
    return updated;
  }

  public deletePrompt(promptId: string): boolean {
    return this.prompts.delete(promptId);
  }

  public interpolate(promptId: string, variables: Record<string, string | number>): string {
    const p = this.prompts.get(promptId);
    if (!p) throw new Error(`Prompt ${promptId} not found`);

    let text = p.templateBody || p.systemPrompt;
    for (const [key, val] of Object.entries(variables)) {
      text = text.replaceAll(`{{${key}}}`, String(val));
    }
    return text;
  }
}

export const aiPromptRegistry = AiPromptRegistry.getInstance();
