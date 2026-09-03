import { NavigationTab, UserRole } from "../../types";
import { TutorialStep } from "../domain/CopilotKnowledgeTypes";

// ============================================================================
// BIOAZÚCAR 4.0 — COPILOT TUTORIAL & GUIDED TOUR ENGINE
// Progressive, context-aware onboarding adapted to user role
// ============================================================================

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    stepNumber: 1,
    totalSteps: 8,
    module: "dashboard",
    title: "Paso 1/8: Panel de Control Principal (Dashboard)",
    roleAudience: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"],
    objective: "Comprender la visión consolidada del ingenio, la velocidad de molienda y la efectividad global (OEE).",
    explanation:
      "Bienvenido al **Panel Principal**. Aquí tienes la visión ejecutiva de la fábrica. En el centro verás el velocímetro de **TCH (Toneladas de Caña por Hora)** frente a la meta nominal. Abajo encontrarás el **OEE según norma ISO 22400-2**, descompuesto en Disponibilidad, Rendimiento y Calidad.",
    whatToObserve: [
      "El gauge de TCH actual indicando si estamos en zona óptima verde.",
      "El porcentaje de extracción de sacarosa en el tándem (meta > 96%).",
      "El enlace de Data Lineage al hacer clic en cualquier KPI para ver sus sensores de origen.",
    ],
    suggestedAction: {
      label: "Ir al SCADA de Molienda",
      actionType: "NAVIGATE",
      targetTab: "scada",
    },
  },
  {
    stepNumber: 2,
    totalSteps: 8,
    module: "scada",
    title: "Paso 2/8: Control de Supervisión SCADA",
    roleAudience: ["superadmin", "administrador", "supervisor", "operador"],
    objective: "Supervisar el tándem de molinos, los lazos de control PID y el flujo de extracción en vivo.",
    explanation:
      "Este es el **SCADA de Proceso**. Muestra la animación en tiempo real del tándem de 5 molinos, el flujo de caña picada, la inyección de agua de imbibición compuesta y la caída de bagazo hacia calderas.",
    whatToObserve: [
      "La velocidad (RPM) y presión hidráulica en las chumaceras de cada molino.",
      "El tren de evaporación Robert y los tachos al vacío en la sección inferior.",
      "Los lazos PID donde los administradores pueden enviar consignas de setpoint protegidas.",
    ],
    suggestedAction: {
      label: "Ir a Cogeneración & Energía",
      actionType: "NAVIGATE",
      targetTab: "energy_dispatch",
    },
  },
  {
    stepNumber: 3,
    totalSteps: 8,
    module: "energy_dispatch",
    title: "Paso 3/8: Cogeneración & Despacho Energético",
    roleAudience: ["superadmin", "administrador", "supervisor"],
    objective: "Analizar el balance térmico ASME PTC 4 y el despacho de potencia a la red nacional.",
    explanation:
      "El módulo de **Cogeneración y Despacho** supervisa la quema de bagazo en calderas acuotubulares, la producción de vapor sobrecalentado (65 bar) y la generación en turbinas para abastecer el ingenio y exportar a la red (SEN).",
    whatToObserve: [
      "El balance de masa de bagazo (consumo en calderas vs excedente a patio).",
      "La eficiencia térmica calculada con la norma ASME PTC 4 por método de pérdidas.",
      "La facturación eléctrica estimada en USD/hora según el precio spot del mercado.",
    ],
    suggestedAction: {
      label: "Ir al Centro de Alarmas",
      actionType: "NAVIGATE",
      targetTab: "alarms",
    },
  },
  {
    stepNumber: 4,
    totalSteps: 8,
    module: "alarms",
    title: "Paso 4/8: Gestión de Alarmas ISA-18.2",
    roleAudience: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"],
    objective: "Aprender a diagnosticar, reconocer y silenciar alarmas operacionales.",
    explanation:
      "El **AlarmCenter** sigue estrictamente el estándar internacional **ANSI/ISA-18.2**. Cada anomalía se clasifica por severidad (Crítica, Alta, Media, Baja) con causas probables y acciones de contingencia recomendadas.",
    whatToObserve: [
      "La tasa horaria de alarmas (la norma recomienda < 6 alarmas/hora en régimen normal).",
      "El botón 'Reconocer (ACK)' para registrar la toma de conocimiento del operador.",
      "La pestaña de Secuencia de Eventos (SOE) con resolución de milisegundos para análisis de fallas.",
    ],
    suggestedAction: {
      label: "Ir a Mantenimiento & Equipos",
      actionType: "NAVIGATE",
      targetTab: "equipment",
    },
  },
  {
    stepNumber: 5,
    totalSteps: 8,
    module: "equipment",
    title: "Paso 5/8: Mantenimiento Basado en Condición (CBM)",
    roleAudience: ["superadmin", "administrador", "supervisor", "mantenimiento"],
    objective: "Inspeccionar la salud de activos, análisis espectral de vibraciones FFT y órdenes de trabajo.",
    explanation:
      "En **Equipos & CMMS** se aplica mantenimiento predictivo continuo. Para los molinos y turbinas se dispone de un analizador espectral FFT que permite detectar desbalance (1X), desalineación (2X) o fallas de rodamientos (BPFO/BPFI) antes de una rotura catastrófica.",
    whatToObserve: [
      "El índice de salud de 0 a 100% por cada equipo.",
      "El espectro FFT interactivo en Molino 3 con los órdenes de frecuencia armónica.",
      "El gestor de órdenes de trabajo (OT) preventivas y correctivas.",
    ],
    suggestedAction: {
      label: "Ir a UNS Hub & Industrial Edge",
      actionType: "NAVIGATE",
      targetTab: "uns_hub",
    },
  },
  {
    stepNumber: 6,
    totalSteps: 8,
    module: "uns_hub",
    title: "Paso 6/8: Espacio de Nombres Unificado (UNS) & Edge",
    roleAudience: ["superadmin", "administrador", "supervisor"],
    objective: "Comprender la arquitectura IIoT, el árbol ISA-95 y la resiliencia del BioAzúcar Industrial Edge.",
    explanation:
      "El **UNS Hub** es la columna vertebral de integración. Aquí confluyen los datos de PLCs, gateways Modbus, brokers MQTT Sparkplug B y el DCS EROS en un árbol jerárquico estructurado. Incluye la consola del **BioAzúcar Industrial Edge** con cola Store & Forward para operación offline.",
    whatToObserve: [
      "La navegación del árbol ISA-95 hasta llegar a cualquier tag de campo.",
      "El estado de salud del Edge Node y el buffer Store & Forward.",
      "La posibilidad de conmutar entre el Simulador y el Edge OT real con un solo clic.",
    ],
    suggestedAction: {
      label: "Ir al Historiador",
      actionType: "NAVIGATE",
      targetTab: "historian",
    },
  },
  {
    stepNumber: 7,
    totalSteps: 8,
    module: "historian",
    title: "Paso 7/8: Historiador de Tendencias Industriales",
    roleAudience: ["superadmin", "administrador", "supervisor", "operador", "mantenimiento"],
    objective: "Analizar series de tiempo, correlacionar variables y exportar datos a CSV.",
    explanation:
      "El **Historiador** almacena el registro temporal continuo de todas las variables de planta. Permite superponer hasta 6 curvas a la vez (por ejemplo, presión de vapor vs exportación eléctrica) y calcular estadísticas instantáneas.",
    whatToObserve: [
      "Los selectores de rango rápido (1h, 4h, 12h, 24h, Semana).",
      "Las estadísticas de promedio, mínimo, máximo y desviación estándar calculadas al vuelo.",
      "El botón de exportación para descargar series de tiempo limpias a CSV.",
    ],
    suggestedAction: {
      label: "Ir a Lotes & LIMS",
      actionType: "NAVIGATE",
      targetTab: "batches",
    },
  },
  {
    stepNumber: 8,
    totalSteps: 8,
    module: "batches",
    title: "Paso 8/8: Trazabilidad de Lotes & Calidad LIMS",
    roleAudience: ["superadmin", "administrador", "supervisor", "operador"],
    objective: "Conocer el proceso de pesaje de camiones, análisis de pureza en laboratorio y liquidación de caña.",
    explanation:
      "Llegamos al final del recorrido en **Trazabilidad de Lotes**. Aquí se registra la entrada de materia prima desde las fincas cañeras, los análisis químicos de Brix, Pol y Trash, y el cálculo del Azúcar Recuperable Equivalente (ARE en kg/t) para la liquidación a productores.",
    whatToObserve: [
      "El estado de los viajes (En patio, En muestreo, En molienda, Procesado).",
      "El formulario para registrar nuevos lotes con pesaje de entrada y salida.",
      "El impacto de la calidad de la caña en el rendimiento fabril final.",
    ],
    suggestedAction: {
      label: "Finalizar Tour & Volver al Dashboard",
      actionType: "NAVIGATE",
      targetTab: "dashboard",
    },
  },
];

export class CopilotTutorialService {
  public static getStep(stepNumber: number): TutorialStep | undefined {
    return TUTORIAL_STEPS.find((s) => s.stepNumber === stepNumber);
  }

  public static getInitialStep(userRole: UserRole): TutorialStep {
    return TUTORIAL_STEPS[0];
  }

  public static getNextStep(currentStepNumber: number): TutorialStep | undefined {
    return TUTORIAL_STEPS.find((s) => s.stepNumber === currentStepNumber + 1);
  }
}
