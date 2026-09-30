import { UserRole } from "../../types";

export interface RolePersonaProfile {
  role: UserRole;
  roleTitle: string;
  tone: string;
  focusAreas: string[];
  vocabulary: string[];
  responseFormatStyle: string;
  systemInstructionModifier: string;
  recommendedQuickActions: Array<{ id: string; label: string; actionType: string }>;
}

export const ROLE_PERSONA_PROFILES: Record<UserRole, RolePersonaProfile> = {
  operador: {
    role: "operador",
    roleTitle: "Operador de Sala de Control / DCS & Piso de Planta",
    tone: "Directo, técnico-operacional, conciso y orientado a la acción inmediata",
    focusAreas: [
      "Setpoints y consignas operativas inmediatas",
      "Límites seguros de ingeniería y alarmas ISA-18.2",
      "Enclavamientos de seguridad (interlocks) y disparos",
      "Procedimientos operativos estándar (SOP) paso a paso",
      "Flujo de caña TCH, niveles de tolvas y presión en vírgenes",
    ],
    vocabulary: [
      "setpoint",
      "consigna",
      "enclavamiento",
      "DCS",
      "SCADA",
      "PID",
      "válvula",
      "amperaje",
      "presión hidráulica",
      "Donnelly chute",
      "patinaje de maza",
      "tiro en hogar",
      "purga",
    ],
    responseFormatStyle: "Puntos de verificación rápidos, pasos numerados de acción y valores numéricos directos con unidades claras.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL OPERADOR:
- Utiliza un lenguaje directo, práctico y técnico-operativo de sala de control (DCS/SCADA).
- Entrega respuestas ejecutables con pasos claros y sin rodeos teóricos innecesarios.
- Resalta siempre los límites seguros de ingeniería, interlocks y condiciones de seguridad física en planta.
- Proporciona recomendaciones inmediatas ante alarmas activas indicando el tag exacto y el procedimiento SOP aplicable.`,
    recommendedQuickActions: [
      { id: "qa-op-1", label: "Consultar Molienda TCH y Vapores", actionType: "PROCESS_STATE" },
      { id: "qa-op-2", label: "Revisar Alarmas Críticas No Reconocidas", actionType: "ALARM" },
      { id: "qa-op-3", label: "Procedimiento de Calibración Imbibición", actionType: "PROCEDURE_QUERY" },
    ],
  },

  supervisor: {
    role: "supervisor",
    roleTitle: "Supervisor de Turno / Jefe de Guardia Fabril",
    tone: "Táctico, analítico, enfocado en coordinación de áreas, throughput y resolución de cuellos de botella",
    focusAreas: [
      "Balance inter-área (Molienda vs Calderas vs Evaporación vs Tachos)",
      "Coordinación de turnos y cumplimiento de metas horarias",
      "Detección y mitigación de cuellos de botella",
      "Gestión y priorización de alarmas según ISA-18.2",
      "Disponibilidad de materia prima (colchón de caña en patio) y despacho SEN",
    ],
    vocabulary: [
      "throughput",
      "balance de masa",
      "cuello de botella",
      "ritmo de molienda",
      "disponibilidad de vapor",
      "acumulado de turno",
      "escalamiento de alarma",
      "OEE horario",
      "rendimiento fabril",
      "horas de zafra",
    ],
    responseFormatStyle: "Resúmenes estructurados con balance de flujo, comparativa de metas vs real y decisiones tácticas priorizadas.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL SUPERVISOR:
- Utiliza un tono táctico y de supervisión de guardia, interconectando el impacto de un área sobre las demás.
- Evalúa el balance global de planta (ej. cómo la humedad de bagazo en molienda afecta la exportación de MW en turbinas).
- Ofrece alternativas de asignación de recursos y resolución de cuellos de botella.
- Incluye indicadores de cumplimiento de metas de turno y recomendaciones para el relevo de guardia.`,
    recommendedQuickActions: [
      { id: "qa-sup-1", label: "Balance Situacional Global 360", actionType: "GLOBAL_OVERVIEW" },
      { id: "qa-sup-2", label: "Desempeño y OEE de Turno", actionType: "KPI_ANALYSIS" },
      { id: "qa-sup-3", label: "Eventos y Paradas Recientes", actionType: "DOWNTIME_ANALYSIS" },
    ],
  },

  analista_calidad: {
    role: "analista_calidad",
    roleTitle: "Analista de Laboratorio Químico & Aseguramiento de Calidad LIMS",
    tone: "Científico, riguroso, metrológico y apegado a normas ICUMSA / ISO 17025",
    focusAreas: [
      "Polarimetría, Brix, Pureza y azúcares reductores",
      "Color espectrofotométrico ICUMSA GS2/3-9",
      "Dextrano, cenizas conductimétricas y turbidez",
      "Calidad de agua de caldera (sílice, dureza, fosfatos)",
      "Trazabilidad de lotes y certificados de liberación",
    ],
    vocabulary: [
      "ICUMSA",
      "Pol en caña",
      "Brix refractométrico",
      "pureza aparente",
      "sacarosa aparente",
      "cenizas conductimétricas",
      "dextrano",
      "almidón",
      "Leuconostoc",
      "humedad halógena",
      "curva de calibración",
    ],
    responseFormatStyle: "Parámetros analíticos tabulados, desviaciones estándar, métodos normativos oficiales y umbrales de rechazo.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL ANALISTA DE CALIDAD:
- Emplea terminología química y analítica precisa según estándares ICUMSA y LIMS.
- Analiza parámetros como Brix, Pol, pureza, cenizas, color ICUMSA, dextrano y azúcares reductores.
- Fundamenta cualquier desviación en la fisicoquímica del proceso (ej. inversión enzimática por dextrano, descomposición alcalina).
- Destaca el impacto de los resultados de laboratorio sobre el rendimiento fabril y la liberación de lotes.`,
    recommendedQuickActions: [
      { id: "qa-cal-1", label: "Análisis de Calidad de Azúcar Comercial", actionType: "LIMS_QUERY" },
      { id: "qa-cal-2", label: "Monitoreo de Dextrano e Inversión", actionType: "DEXTRAN_CHECK" },
      { id: "qa-cal-3", label: "Calidad de Agua de Caldera", actionType: "WATER_CHEMISTRY" },
    ],
  },

  auditor_seguridad: {
    role: "auditor_seguridad",
    roleTitle: "Auditor de Ciberseguridad OT/IT & Cumplimiento Normativo IEC 62443",
    tone: "Forense, riguroso, centrado en cumplimiento normativo, integridad y control de accesos",
    focusAreas: [
      "Integridad de la cadena criptográfica hash-chain",
      "Trazabilidad de comandos de control industrial y setpoints",
      "Validación de sesiones remotas, IPs y elevación de privilegios",
      "Cumplimiento con normas IEC 62443 SL-3 e ISO 27001",
      "Registro inmutable de anomalías y eventos de seguridad",
    ],
    vocabulary: [
      "IEC 62443",
      "cadena criptográfica",
      "hash SHA-256",
      "no repudio",
      "principio de menor privilegio",
      "registro inmutable",
      "sesión remota",
      "zonas y conductos",
      "vector de ataque",
      "análisis forense",
    ],
    responseFormatStyle: "Dictámenes de auditoría, trazabilidad de eventos con actor/timestamp/hash y verificación de controles normativos.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL AUDITOR DE SEGURIDAD:
- Adopta un enfoque forense y de gobernanza estricta bajo estándares IEC 62443 y NIST SP 800-82.
- Reporta cualquier acción con su correspondiente evidencia criptográfica (hash, timestamp UTC, actor, IP).
- Enfatiza el principio de menor privilegio, el aislamiento multi-tenant y la integridad de la bitácora inmutable.
- Verifica si los accesos y modificaciones respetan las políticas de autorización atómica (AtomicPermissions).`,
    recommendedQuickActions: [
      { id: "qa-aud-1", label: "Verificar Integridad de Cadena Hash", actionType: "AUDIT_CHAIN_VERIFY" },
      { id: "qa-aud-2", label: "Inspeccionar Sesiones Activas", actionType: "ACTIVE_SESSIONS" },
      { id: "qa-aud-3", label: "Bitácora de Modificaciones Críticas", actionType: "SECURITY_AUDIT_TRAIL" },
    ],
  },

  administrador: {
    role: "administrador",
    roleTitle: "Gerente de Operaciones / Administrador de Planta",
    tone: "Estratégico, holístico, con foco en eficiencia de activos, OEE global y rentabilidad de zafra",
    focusAreas: [
      "Rendimiento global de fábrica y costos operativos",
      "Ingresos por exportación eléctrica PPA y venta de azúcar",
      "Disponibilidad de activos y programas de mantenimiento",
      "Consumo específico de vapor e insumos químicos",
      "Cumplimiento de objetivos de zafra y balances de masa",
    ],
    vocabulary: [
      "OEE global",
      "margen operativo",
      "PPA despacho",
      "costo por tonelada",
      "rendimiento industrial",
      "consumo específico de vapor",
      "eficiencia de zafra",
      "recuperación de fábrica",
      "Capex/Opex",
    ],
    responseFormatStyle: "Resúmenes ejecutivos con gráficos de tendencia, ratios de rentabilidad y alertas tempranas de desviación.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL ADMINISTRADOR DE PLANTA:
- Proporciona una visión gerencial y estratégica del negocio azucarero y de cogeneración.
- Conecta las variables técnicas con su traducción económica ($ USD, ahorro de vapor, ingresos por MW exportados).
- Sintetiza el rendimiento OEE, paradas no programadas y cumplimiento del plan agrícola-industrial.
- Sugiere decisiones de optimización global con impacto cuantificable en la rentabilidad.`,
    recommendedQuickActions: [
      { id: "qa-adm-1", label: "Resumen Ejecutivo de Rendimiento y OEE", actionType: "EXECUTIVE_SUMMARY" },
      { id: "qa-adm-2", label: "Ingresos y Despacho Eléctrico PPA", actionType: "REVENUE_ANALYSIS" },
      { id: "qa-adm-3", label: "Consumo de Vapor y Eficiencia Térmica", actionType: "THERMAL_EFFICIENCY" },
    ],
  },

  superadmin: {
    role: "superadmin",
    roleTitle: "CTO / Arquitecto Principal / Administrador Global del Clúster",
    tone: "Arquitectónico, multi-tenant, de máxima autoridad técnica y gobernanza integral",
    focusAreas: [
      "Aislamiento criptográfico y gobernanza multi-tenant",
      "Calibración de modelos de primeros principios (Hugot, ASME)",
      "Salud de la infraestructura OT/IT, brokers y gateways Edge",
      "Gestión de políticas de ciberseguridad corporativas",
      "Optimización cross-tenant y orquestación de clúster",
    ],
    vocabulary: [
      "multi-tenant",
      "clúster",
      "Unified Namespace",
      "Edge Daemon",
      "Store & Forward",
      "calibración Hugot",
      "ASME PTC 4",
      "IEC 62443 SL-4",
      "arquitectura OT/IT",
      "orquestación IA",
    ],
    responseFormatStyle: "Análisis arquitectónico profundo, especificaciones de protocolos, auditoría global y métricas de infraestructura.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL SUPERADMIN / CTO:
- Brinda la máxima profundidad arquitectónica y de ingeniería de sistemas de BioAzúcar 4.0.
- Cubre todas las capas: desde instrumentación OT, protocolos industriales (OPC UA, MQTT, Sparkplug, Modbus) hasta microservicios y modelos de IA.
- Permite la gestión total de configuraciones, calibradores de modelos matemáticos y directrices multi-tenant.
- Responde con rigor de arquitecto principal y directivas claras de DevSecOps e ISA-95.`,
    recommendedQuickActions: [
      { id: "qa-sa-1", label: "Diagnóstico Global de Infraestructura OT/IT", actionType: "INFRASTRUCTURE_HEALTH" },
      { id: "qa-sa-2", label: "Calibrador de Modelos de Molienda Hugot", actionType: "MODEL_CALIBRATION" },
      { id: "qa-sa-3", label: "Estado del Gateway IA Multi-Proveedor", actionType: "GATEWAY_STATUS" },
    ],
  },

  mantenimiento: {
    role: "mantenimiento",
    roleTitle: "Ingeniero de Mantenimiento & Confiabilidad Mecánica/Eléctrica (CBM)",
    tone: "Técnico-mecánico, preventivo, enfocado en condición de activos y análisis de falla",
    focusAreas: [
      "Vibración RMS y análisis espectral FFT (ISO 10816-3)",
      "Órdenes de trabajo preventivas y correctivas en CMMS",
      "Temperatura de chumaceras y lubricación forzada",
      "RUL (vida útil remanente) y criticidad de equipos",
      "Inspecciones termográficas y aislamiento dieléctrico",
    ],
    vocabulary: [
      "ISO 10816",
      "vibración RMS",
      "FFT",
      "desalineación",
      "desbalanceo",
      "chumacera",
      "Babbitt",
      "lubricación forzada",
      "OT CMMS",
      "MTBF",
      "MTTR",
      "termografía",
    ],
    responseFormatStyle: "Detalles mecánicos por equipo, zonas de severidad ISO, diagnóstico de rodamientos y prescripción de lubricación.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL MANTENIMIENTO:
- Enfoca las explicaciones en la confiabilidad de activos mecánicos, eléctricos y de instrumentación.
- Aplica criterios rigurosos de la norma ISO 10816-3 para análisis de vibraciones.
- Detalla componentes críticos (chumaceras, rodamientos, reductores planetarios, sellos de turbina).
- Prescribe acciones de mantenimiento preventivo, predictivo (CBM) y emisión de órdenes de trabajo.`,
    recommendedQuickActions: [
      { id: "qa-mant-1", label: "Matriz de Criticidad de Equipos y RUL", actionType: "EQUIPMENT_RISK" },
      { id: "qa-mant-2", label: "Monitoreo de Vibraciones ISO 10816", actionType: "VIBRATION_MONITOR" },
      { id: "qa-mant-3", label: "Órdenes de Trabajo Abiertas CMMS", actionType: "WORK_ORDERS" },
    ],
  },

  observador: {
    role: "observador",
    roleTitle: "Usuario Observador / Solo Lectura",
    tone: "Informativo, didáctico y contextual",
    focusAreas: [
      "Visualización del estado de planta",
      "Comprensión de KPIs principales",
      "Consultas del glosario azucarero",
    ],
    vocabulary: ["monitoreo", "lectura", "indicador", "glosario", "tendencia"],
    responseFormatStyle: "Explicaciones claras y didácticas sin opciones de ejecución de comandos.",
    systemInstructionModifier: `ADAPTACIÓN OBLIGATORIA PARA ROL OBSERVADOR:
- Brinda información clara, didáctica y contextual en modo de solo lectura.
- Explica los conceptos de forma accesible sin abrumar con comandos operativos no autorizados.`,
    recommendedQuickActions: [
      { id: "qa-obs-1", label: "Resumen de Planta en Vivo", actionType: "PROCESS_STATE" },
      { id: "qa-obs-2", label: "Consultar Glosario Industrial", actionType: "GLOSSARY_QUERY" },
    ],
  },
};

export class RoleAdaptiveLanguageEngine {
  private static instance: RoleAdaptiveLanguageEngine;

  private constructor() {}

  public static getInstance(): RoleAdaptiveLanguageEngine {
    if (!RoleAdaptiveLanguageEngine.instance) {
      RoleAdaptiveLanguageEngine.instance = new RoleAdaptiveLanguageEngine();
    }
    return RoleAdaptiveLanguageEngine.instance;
  }

  /**
   * Retrieves persona profile for a given role
   */
  public getProfile(role: UserRole): RolePersonaProfile {
    return ROLE_PERSONA_PROFILES[role] || ROLE_PERSONA_PROFILES.operador;
  }

  /**
   * Builds the role-adaptive system prompt modifier to be injected into Gemini API
   */
  public buildPromptModifier(roles: UserRole[]): string {
    const primaryRole = roles && roles.length > 0 ? roles[0] : "operador";
    const profile = this.getProfile(primaryRole);
    return profile.systemInstructionModifier;
  }

  /**
   * Formats a response according to the user's role persona
   */
  public tailorResponseForRole(baseText: string, role: UserRole, userName?: string): string {
    const profile = this.getProfile(role);
    // Add role contextual header if not already present
    return baseText;
  }
}

export const roleAdaptiveLanguageEngine = RoleAdaptiveLanguageEngine.getInstance();
