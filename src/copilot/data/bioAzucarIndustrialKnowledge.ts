import { NavigationTab, UserRole } from "../../types";

export interface IndustrialOperationDomain {
  id: string;
  name: string;
  stageNumber: number;
  stageCategory:
    | "RECEPCION_MATERIA_PRIMA"
    | "EXTRACCION_MOLIENDA"
    | "PURIFICACION_CLARIFICACION"
    | "EVAPORACION_CONCENTRACION"
    | "CRISTALIZACION_AGOTAMIENTO"
    | "CENTRIFUGACION_SECADO"
    | "DESTILERIA_BIOETANOL"
    | "COGENERACION_VAPOR"
    | "TRATAMIENTO_EFLUENTES"
    | "CONTROL_CALIDAD_LIMS"
    | "MANTENIMIENTO_CONFIABILIDAD"
    | "GOBERNANZA_CIBERSEGURIDAD";
  summary: string;
  detailedProcessDescription: string;
  keyPhysicsAndChemistry: string;
  standardOperatingRanges: Array<{
    parameter: string;
    unit: string;
    nominal: number | string;
    min: number | string;
    max: number | string;
    criticalThreshold: string;
    impactOfDeviation: string;
  }>;
  controlLoopsAndActuators: Array<{
    loopTag: string;
    variableDescription: string;
    actuator: string;
    controlStrategy: string;
    tuningGuidelines: string;
  }>;
  applicableStandards: string[];
  systemModuleMapping: NavigationTab;
  roleSpecificGuidance: Record<UserRole, string>;
  perfectionRules: Array<{
    triggerCondition: string;
    recommendedAdjustment: string;
    thermodynamicBasis: string;
    expectedGain: string;
    riskMitigation: string;
  }>;
}

/**
 * Enciclopedia Industrial Canónica de BioAzúcar 4.0
 * Conocimiento exhaustivo de cada etapa del proceso azucarero, cogeneración, destilería y manufactura inteligente
 */
export const BIOAZUCAR_INDUSTRIAL_KNOWLEDGE_BASE: IndustrialOperationDomain[] = [
  // ==========================================================================
  // 1. RECEPCIÓN, MUESTREO Y PATIO DE CAÑA
  // ==========================================================================
  {
    id: "patio-recepcion-muestreo",
    name: "Recepción, Muestreo de Caña y Patio de Descarga",
    stageNumber: 1,
    stageCategory: "RECEPCION_MATERIA_PRIMA",
    summary: "Control metrológico de entrada de caña, muestreo mecanizado con sonda oblicua, determinación de Pol, Brix, Fibra, impurezas vegetales/minerales y liquidación por Azúcar Recuperable Estimado (ARE).",
    detailedProcessDescription: `El patio de caña gestiona la logística de transporte y pesaje en básculas electrónicas puente. Cada camión o tren cañero es identificado y muestreado mediante sonda oblicua hidráulica o vertical de núcleo antes de la descarga en mesas alimentadoras de 45° o volteadores laterales Hilo. La muestra ingresa al laboratorio de caña para desintegración mecánica en desfibrador martillo, prensado hidráulico o digestión húmeda Spencer-Meade para obtener jugo desintegrado. Se mide Brix por refractometría digital y Pol por polarímetro digital automatizado. Se cuantifica el porcentaje de fibra en caña y el índice de materia extraña (trash vegetal: hojas, cogollos, raicillas; trash mineral: tierra, piedras). Con estos valores se calcula el Azúcar Recuperable Estimado (ARE) para el pago justo al cañicultor según fórmulas oficiales de la zafra.`,
    keyPhysicsAndChemistry: `Digestión y refractometría: La pureza aparente ($Pureza = \\frac{Pol}{Brix} \\times 100$) evalúa la madurez de la caña. El dextrano (deterioro poscosecha por bacteria Leuconostoc mesenteroides) desvía la luz polarizada hacia la derecha generando sobreestimación de Pol y elevando la viscosidad en tachos. Materia extraña mineral (>2%) provoca desgaste abrasivo severo en cuchillas y mazas de molino.`,
    standardOperatingRanges: [
      {
        parameter: "Pol en Caña",
        unit: "%",
        nominal: 14.5,
        min: 12.0,
        max: 17.5,
        criticalThreshold: "< 11.5% indica caña inmadura o sobremadura con inversión de sacarosa",
        impactOfDeviation: "Caída drástica en rendimiento fabril y aumento de costos de molienda por tonelada de azúcar.",
      },
      {
        parameter: "Brix en Jugo de Caña",
        unit: "°Bx",
        nominal: 18.2,
        min: 15.5,
        max: 21.0,
        criticalThreshold: "< 15.0°Bx",
        impactOfDeviation: "Exceso de agua vegetal que sobrecarga el tren de evaporadores y consumo de vapor.",
      },
      {
        parameter: "Pureza de Jugo de Caña",
        unit: "%",
        nominal: 85.0,
        min: 80.0,
        max: 89.0,
        criticalThreshold: "< 78.0% indica alto contenido de azúcares reductores y coloides",
        impactOfDeviation: "Dificultad en clarificación y aumento en volumen de melaza final.",
      },
      {
        parameter: "Fibra en Caña",
        unit: "%",
        nominal: 13.5,
        min: 11.0,
        max: 16.0,
        criticalThreshold: "> 16.5% o < 10.5%",
        impactOfDeviation: "Fibra alta reduce capacidad TCH pero aporta más bagazo; fibra baja compromete el balance de vapor.",
      },
      {
        parameter: "Trash Total (Materia Extraña)",
        unit: "%",
        nominal: 3.5,
        min: 0.5,
        max: 6.0,
        criticalThreshold: "> 8.0%",
        impactOfDeviation: "Desgaste abrasivo de cuchillas, consumo inútil de agua de imbibición y arrastre de cenizas.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "WIC-101",
        variableDescription: "Pesaje dinámico en báscula de entrada",
        actuator: "Celda de carga con compensación de temperatura",
        controlStrategy: "Integración de flujo másico acumulado diario y por turno",
        tuningGuidelines: "Calibración con pesas patrón clase M1 cada 15 días o ante desvío > 0.1%.",
      },
      {
        loopTag: "SIC-102",
        variableDescription: "Velocidad de mesa alimentadora",
        actuator: "Variador de frecuencia (VFD) en motorreductor hidráulico",
        controlStrategy: "Control en cascada con el nivel de la rampa de caña picada hacia conductores",
        tuningGuidelines: "Ajuste suave de rampa de aceleración para evitar atascos y sobrecargas en motores.",
      },
    ],
    applicableStandards: ["ICUMSA GS7/8/4-1", "ISO 22400-2", "Norma Oficial Caña de Azúcar ARE"],
    systemModuleMapping: "batches",
    roleSpecificGuidance: {
      operador: "Monitorea la descarga continua en mesas alimentadoras y vigila que no ingresen piedras o piezas metálicas que dañen los picadores. Verifica que el detector de metales esté siempre activo.",
      supervisor: "Coordina los frentes de corte con el despacho de camiones en patio para mantener el stock regulador (colchón de caña) entre 3 y 5 horas de molienda nominal y evitar paradas por falta de caña.",
      analista_calidad: "Audita la representatividad de la sonda hidráulica y supervisa la determinación analítica de Pol, Brix y dextrano. Aplica penalizaciones automáticas por trash > 6%.",
      auditor_seguridad: "Verifica que el pesaje en báscula sea inmutable en base de datos y que las calibraciones de celdas de carga estén firmadas criptográficamente sin posibilidad de alteración.",
      administrador: "Revisa el balance diario de tonelaje recibido vs contratado, el ARE promedio de la zafra y el pago proyectado por liquidación cañera.",
      superadmin: "Supervisa la integridad de los datos de recepción entre todos los ingenios del grupo, configurando tolerancias y algoritmos de liquidación multi-tenant.",
      mantenimiento: "Inspecciona el desgaste de cadenas transportadoras, rodillos de mesas, cuchillas de picadores y solenoides hidráulicos de las grúas hilo.",
      observador: "Consulta reportes consolidados de camiones recibidos, tonelaje total y calidad promedio de caña recibida.",
    },
    perfectionRules: [
      {
        triggerCondition: "Trash total > 5.5% detectado en laboratorio de caña",
        recommendedAdjustment: "Ajustar ventiladores extractores de paja en el frente de corte y desviar lotes sucios a limpieza secundaria",
        thermodynamicBasis: "Cada 1% de trash mineral disminuye la extracción en 0.25% y consume 18 kg de vapor adicional por tonelada de azúcar.",
        expectedGain: "+0.35% en rendimiento sacarosa y prolongación de vida útil de cuchillas en un 40%.",
        riskMitigation: "Previene atascos mecánicos en Donnelly chute y paradas de emergencia en tándem.",
      },
    ],
  },

  // ==========================================================================
  // 2. MOLIENDA, EXTRACCIÓN Y DIFUSOR
  // ==========================================================================
  {
    id: "molienda-extraccion-difusor",
    name: "Tándem de Molienda, Extracción de Sacarosa y Difusor",
    stageNumber: 2,
    stageCategory: "EXTRACCION_MOLIENDA",
    summary: "Desfibrado de caña, tándem de molinos de 4 a 6 unidades, imbibición compuesta en contracorriente, presión hidráulica en vírgenes según Hugot, extracción >96.0% y control de humedad en bagazo.",
    detailedProcessDescription: `La caña preparada pasa por un tren o tándem de molinos (comúnmente 4 a 6 molinos de 3 o 4 mazas con maza ranurada Donnelly/Lotus). La extracción de jugo se optimiza mediante el prensado secuencial y la aplicación de agua de imbibición caliente en el último o penúltimo molino, recirculando los jugos pobres en contracorriente hacia los molinos anteriores. La presión hidráulica sobre las mazas superiores es sostenida mediante acumuladores hidroneumáticos entre 220 y 250 bar (35 a 45 toneladas por pie lineal). Alternativamente, en centrales con difusor de caña de lecho móvil, la extracción se realiza por lixiviación continua a 75-80°C con un molino desaguador de bagazo final. El bagazo resultante es transportado por conductores aéreos a la casa de calderas con humedad menor al 50% y Pol menor a 2.0%.`,
    keyPhysicsAndChemistry: `Fórmulas Canónicas de E. Hugot:
Extracción Sacarosa: $E = 100 - \\frac{100 - E_0}{1 + k_w \\cdot (W / F)}$
Donde $E_0$ es la extracción seca (68.5%), $W/F$ es el ratio agua de imbibición sobre fibra (óptimo 2.0 a 2.5), y $k_w$ es el coeficiente de imbibición compuesta (1.8 a 2.5).
Temperatura de imbibición: 60-68°C. Por encima de 70°C se disuelven ceras y gomas de la corteza provocando resbalamiento severo de las mazas y problemas de clarificación.
Abertura de mazas: Relación de entrada a salida ($E_{in}/E_{out}$) entre 1.8:1 y 2.2:1 para garantizar la compactación progresiva del colchón de bagazo.`,
    standardOperatingRanges: [
      {
        parameter: "Molienda Continua (TCH)",
        unit: "t/h",
        nominal: 450,
        min: 380,
        max: 520,
        criticalThreshold: "< 350 o > 550 t/h",
        impactOfDeviation: "TCH baja provoca desbalance de vapor en calderas; TCH excesiva satura el tándem y eleva el Pol en bagazo.",
      },
      {
        parameter: "Extracción Sacarosa en Tándem",
        unit: "%",
        nominal: 96.5,
        min: 94.5,
        max: 97.8,
        criticalThreshold: "< 95.0%",
        impactOfDeviation: "Pérdida irrecuperable de azúcar que se quema inútilmente en las calderas junto al bagazo.",
      },
      {
        parameter: "Ratio Imbibición Agua / Fibra (W/F)",
        unit: "adimensional",
        nominal: 2.2,
        min: 1.8,
        max: 2.8,
        criticalThreshold: "< 1.6 o > 3.0",
        impactOfDeviation: "Bajo W/F disminuye la extracción; alto W/F ahoga los evaporadores y consume vapor en exceso.",
      },
      {
        parameter: "Temperatura de Agua de Imbibición",
        unit: "°C",
        nominal: 64.0,
        min: 60.0,
        max: 68.0,
        criticalThreshold: "> 72.0°C o < 55.0°C",
        impactOfDeviation: ">72°C disuelve ceras causando patinaje de mazas; <55°C reduce la solubilidad y lixiviación de sacarosa.",
      },
      {
        parameter: "Presión Hidráulica en Vírgenes",
        unit: "bar",
        nominal: 235.0,
        min: 210.0,
        max: 260.0,
        criticalThreshold: "> 275.0 bar (sobrecarga mecánica) o < 190.0 bar",
        impactOfDeviation: "Peligro de fisura en ejes de mazas y sobrecalentamiento de chumaceras de bronce.",
      },
      {
        parameter: "Humedad en Bagazo Final",
        unit: "%",
        nominal: 48.5,
        min: 46.0,
        max: 51.5,
        criticalThreshold: "> 52.0%",
        impactOfDeviation: "Bagazo húmedo reduce el PCI en calderas, apaga la llama en el hogar y baja la presión de vapor.",
      },
      {
        parameter: "Pol en Bagazo Final",
        unit: "%",
        nominal: 1.75,
        min: 1.2,
        max: 2.2,
        criticalThreshold: "> 2.5%",
        impactOfDeviation: "Indica mal drenaje en ranuras de mazas o mala distribución de agua de imbibición.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "FIC-201",
        variableDescription: "Caudal de agua de imbibición",
        actuator: "Válvula de control modulante con actuador electroneumático o VFD en bomba",
        controlStrategy: "Control en cascada con el pesaje de caña (TCH) y % de fibra estimado para sostener el ratio W/F deseado",
        tuningGuidelines: "Banda proporcional moderada y tiempo integral de 15s para amortiguar oscilaciones de pesaje.",
      },
      {
        loopTag: "PIC-202",
        variableDescription: "Presión hidráulica de vírgenes",
        actuator: "Electroválvulas proporcionales en unidad de potencia hidráulica con acumuladores de nitrógeno",
        controlStrategy: "Regulación continua con corte automático por enclavamiento ante elevación desmedida de mazas",
        tuningGuidelines: "Verificar precarga de nitrógeno en acumuladores (110-130 bar a temperatura ambiente).",
      },
      {
        loopTag: "LIC-203",
        variableDescription: "Nivel en Donnelly Chutes (chutes de alimentación a molinos)",
        actuator: "VFD en motor de turbina o motor eléctrico de velocidad variable de molino",
        controlStrategy: "Control de nivel flotante mediante sensores radiométricos o de ultrasonido para alimentar a molino lleno",
        tuningGuidelines: "Mantener el chute entre 70% y 85% para evitar aire atrapado y garantizar presión de compactación.",
      },
    ],
    applicableStandards: ["Handbook of Cane Sugar Engineering (E. Hugot)", "ISO 10816-3 (Vibraciones)", "ISA-18.2"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Vigila el nivel de los Donnelly Chutes y las corrientes de los motores de molino. Si detectas patinaje de maza en Molino 4 o 5, reduce temporalmente la temperatura de imbibición a 60°C.",
      supervisor: "Equilibra el ritmo de molienda con el consumo de vapor de la fábrica. No fuerces TCH por encima del límite de tiro inducido de calderas.",
      analista_calidad: "Toma muestras horarias de bagazo final para determinar humedad y Pol. Reporta de inmediato si la humedad supera 50.5%.",
      auditor_seguridad: "Comprueba que las modificaciones de setpoint de TCH e imbibición cuenten con autorización de rol y firma en el log de auditoría criptográfico.",
      administrador: "Analiza el índice de extracción acumulado de la semana y su relación con el consumo de agua fresca en el balance global.",
      superadmin: "Configura las constantes $k_w$ y dimensiones geométricas de mazas en el calibrador de modelos de primeros principios.",
      mantenimiento: "Inspecciona la lubricación forzada de chumaceras (aceite compuesto ISO VG 680 con aditivos de extrema presión), enfriamiento por agua y estado de peines raspadores.",
      observador: "Supervisa la gráfica en vivo de TCH, extracción calculada y presión hidráulica del tándem.",
    },
    perfectionRules: [
      {
        triggerCondition: "Petición de aumento de TCH > 10% con bagazo actual > 50% de humedad",
        recommendedAdjustment: "Limitar incremento a +4% y verificar que la presión en Molino 5 sea de al menos 240 bar",
        thermodynamicBasis: "Un aumento de TCH con maza floja incrementa el colchón de bagazo sin deshidratar, elevando la humedad a >52% y asfixiando las calderas.",
        expectedGain: "Preservación del poder calorífico del bagazo y estabilidad en el cabezal de vapor de 65 bar.",
        riskMitigation: "Evita caída de presión de vapor HP y disparo por baja presión en turbogenerador.",
      },
      {
        triggerCondition: "Petición de reducción de ratio W/F a < 1.8 para ahorrar agua",
        recommendedAdjustment: "Mantener W/F en mínimo 2.1 e incrementar la recirculación de jugo de 4to a 3er molino",
        thermodynamicBasis: "Por debajo de W/F = 2.0 la curva de Hugot cae exponencialmente, perdiendo hasta 1.8% de sacarosa hacia el bagazo.",
        expectedGain: "+1.2 t de azúcar por cada 1,000 t de caña molida.",
        riskMitigation: "Previene pérdidas económicas directas por azúcar quemada en caldera.",
      },
    ],
  },

  // ==========================================================================
  // 3. CLARIFICACIÓN, ENCALADO Y SULFITACIÓN
  // ==========================================================================
  {
    id: "clarificacion-encalado-sulfitacion",
    name: "Clarificación, Encalado y Sulfitación de Jugos",
    stageNumber: 3,
    stageCategory: "PURIFICACION_CLARIFICACION",
    summary: "Purificación de jugo mixto, encalado a pH 7.0-7.2 con lechada de cal, sulfitación con SO2 para azúcar blanco, calentamiento a 103°C, clarificadores rápidos SRI/Graver y filtración de cachaza.",
    detailedProcessDescription: `El jugo mixto proveniente del tándem es tamizado en cedazos rotatorios DSM para remover bagacillo fino y pesado en básculas automáticas de jugo. En plantas que producen azúcar blanco directo, el jugo se somete a sulfitación mediante absorción de gas SO2 en columnas de contacto hasta pH 3.8-4.2 para decoloración por reducción de polifenoles y melanoidinas. Posteriormente se neutraliza mediante encalado continuo con lechada de cal (sacarato de calcio o hidróxido de calcio a 6-10 °Be) en reactores de agitación rápida hasta pH 7.0-7.2. El jugo encalado se calienta en intercambiadores de tubo y coraza de dos etapas: primarios con vapor V2/V3 a 75°C y secundarios con vapor V1 a 102-105°C para expulsar aire disuelto y coagular albúminas. Se dosifica floculante aniónico (1.5-2.5 ppm) antes de ingresar a clarificadores rápidos multitrayectoria tipo SRI o Graver con tiempo de retención de 45-60 minutos. El jugo claro sobrenadante pasa a evaporadores, mientras que el lodo o cachaza sedimentada se mezcla con bagacillo fino y se filtra en filtros rotatorios al vacío o filtros prensa con lavado de agua caliente para agotar la sacarosa residual (Pol en cachaza < 1.0%).`,
    keyPhysicsAndChemistry: `Precipitación de Fosfatos de Calcio:
$3 Ca(OH)_2 + 2 H_3PO_4 \\longrightarrow Ca_3(PO_4)_2 \\downarrow + 6 H_2O$
El fosfato tricálcico forma una red coloidal que atrapa gomas, ceras y partículas en suspensión. Se requiere un contenido mínimo de 300 ppm de $P_2O_5$ en jugo mixto; si el jugo es deficiente, se adiciona ácido fosfórico técnico.
Temperatura de ebullición previa (103°C): Indispensable para descomponer bicarbonatos y desgasificar el jugo, evitando que burbujas asciendan y rompan los flóculos en el clarificador.
pH crítico: Por debajo de pH 6.8 ocurre hidrólisis ácida (inversión de sacarosa en glucosa y fructosa); por encima de pH 7.8 ocurre descomposición alcalina de azúcares reductores formando sales solubles de calcio y colorantes oscuros.`,
    standardOperatingRanges: [
      {
        parameter: "pH de Jugo Encalado",
        unit: "pH",
        nominal: 7.15,
        min: 6.95,
        max: 7.35,
        criticalThreshold: "< 6.8 (inversión ácida) o > 7.6 (formación de color y cal soluble)",
        impactOfDeviation: "Pérdida de sacarosa por inversión o formación de sales cálcicas que incrustan evaporadores.",
      },
      {
        parameter: "Temperatura de Jugo a Clarificador",
        unit: "°C",
        nominal: 103.5,
        min: 101.5,
        max: 106.0,
        criticalThreshold: "< 99.5°C o > 108.0°C",
        impactOfDeviation: "<100°C flóculos no decantan por microburbujas; >107°C caramelización de azúcares.",
      },
      {
        parameter: "Turbidez de Jugo Claro",
        unit: "NTU",
        nominal: 18.0,
        min: 8.0,
        max: 30.0,
        criticalThreshold: "> 45.0 NTU",
        impactOfDeviation: "Jugo turbio genera meladura oscura, cristales de azúcar opacos y alto color ICUMSA.",
      },
      {
        parameter: "Dosificación de Floculante Aniónico",
        unit: "ppm",
        nominal: 2.0,
        min: 1.0,
        max: 3.5,
        criticalThreshold: "> 5.0 ppm (sobredosificación bloquea filtros)",
        impactOfDeviation: "Gasto químico innecesario y aumento de viscosidad en masas cocidas.",
      },
      {
        parameter: "Pol en Cachaza de Filtros",
        unit: "%",
        nominal: 0.85,
        min: 0.5,
        max: 1.3,
        criticalThreshold: "> 1.8%",
        impactOfDeviation: "Pérdida de azúcar en el residuo sólido enviado a campos de compostaje.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "AIC-301",
        variableDescription: "Control de pH de jugo encalado",
        actuator: "Válvula de pellizco (pinch valve) en línea de recirculación de lechada de cal",
        controlStrategy: "Control PID no lineal con compensación anticipativa (feedforward) por caudal de jugo mixto",
        tuningGuidelines: "Ganancia proporcional baja y filtro en señal de electrodo de vidrio con lavado ultrasónico automático cada 4h.",
      },
      {
        loopTag: "TIC-302",
        variableDescription: "Temperatura en calentadores de jugo secundarios",
        actuator: "Válvula de vapor V1 modulante",
        controlStrategy: "PID con lazo esclavo sobre presión de vapor en calandria del calentador",
        tuningGuidelines: "Tiempo integral de 45s para compensar inercia térmica de los haces tubulares.",
      },
    ],
    applicableStandards: ["ICUMSA GS2/3-9 Coloration", "Manual de Clarificación SRI"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Monitorea la mirilla de jugo claro a la salida del clarificador. Si observas arrastre de lodo, verifica inmediatamente la dosificación de floculante y purga las válvulas de fondo.",
      supervisor: "Supervisa la rotación de calentadores de jugo para limpieza química de incrustaciones con soda cáustica cada 10 a 14 días.",
      analista_calidad: "Realiza análisis de pH de jugo claro cada 30 minutos y cuantifica calcio residual en ppm ($CaO$).",
      auditor_seguridad: "Verifica que las alarmas de desviación de pH crítico estén activas en el sistema SCADA y registradas en el log inmutable.",
      administrador: "Evalúa el consumo de cal hidratada (kg cal/t caña) y floculante frente al presupuesto mensual de insumos.",
      superadmin: "Ajusta en el gemelo digital los coeficientes de sedimentación y curvas de compactación de lodos.",
      mantenimiento: "Inspecciona el vacío en los filtros rotatorios (mínimo -15 pulgadas de mercurio) y estado de telas filtrantes.",
      observador: "Revisa la tendencia de pH y temperatura de jugo claro en el dashboard de fábrica.",
    },
    perfectionRules: [
      {
        triggerCondition: "Desviación de pH < 6.95 con caudal de jugo en aumento",
        recommendedAdjustment: "Incrementar bombeo de cal en +8% y verificar densidad de la lechada en el tanque de preparación",
        thermodynamicBasis: "A pH 6.8 y 103°C, la velocidad de inversión de sacarosa se multiplica por 4.8 veces, perdiendo sacarosa pura.",
        expectedGain: "Evita pérdidas de hasta 150 kg de sacarosa/hora y estabiliza la decantación.",
        riskMitigation: "Previene corrosión ácida en tubos de evaporadores.",
      },
    ],
  },

  // ==========================================================================
  // 4. EVAPORACIÓN MÚLTIPLE EFECTO Y ECONOMÍA DE VAPOR
  // ==========================================================================
  {
    id: "evaporacion-multiple-efecto",
    name: "Evaporación Múltiple Efecto y Concentración de Meladura",
    stageNumber: 4,
    stageCategory: "EVAPORACION_CONCENTRACION",
    summary: "Concentración de jugo claro (14-16° Brix) a meladura (60-65° Brix) en trenes múltiple efecto (quíntuple/cuádruple), sangrías de vapor V1/V2/V3 y ahorro térmico de fábrica.",
    detailedProcessDescription: `El jugo claro ingresa a un tren de evaporadores múltiple efecto tipo calandria tubular vertical (Robert) o de película descendente (Falling Film), configurados típicamente en Quíntuple o Cuádruple efecto con pre-evaporador. El primer efecto es calentado con vapor de escape de turbinas (1.8 - 2.4 bar, 120-128°C), y cada efecto sucesivo opera a menor presión y temperatura gracias a la conexión con el sistema de vacío central (-0.85 bar en el último efecto, ebullición a 55-60°C). Se aprovecha la economía de vapor extrayendo sangrías de vapor de los primeros cuerpos: Vapor V1 para tachos de cocimiento y calentadores secundarios; Vapor V2 para calentadores primarios y destilería; Vapor V3 para desgasificación. El jugo se concentra progresivamente desde 14-16° Brix hasta obtener meladura con 62-66° Brix. La meladura final es sometida a clarificación por flotación con aire microdisuelto y polímero para remover colorantes y fósforo antes de alimentar los tachos.`,
    keyPhysicsAndChemistry: `Leyes de Rillieux para Evaporación Múltiple Efecto:
En un sistema de $N$ efectos, $1 \\text{ kg de vapor vivo}$ evapora teóricamente $N \\text{ kg de agua}$. Al sangrar vapor de un efecto $i$ para calentamiento externo, se ahorra $\\frac{i}{N}$ kg de vapor vivo por cada kg sangrado.
Consumo específico de vapor objetivo: Menor a 380 kg de vapor por tonelada de caña molida en ingenios modernos autosuficientes.
Elevación del punto de ebullición (BPE): A medida que el Brix se eleva de 15 a 65° Brix, la temperatura de ebullición aumenta entre 3°C y 6°C por encima de la del agua pura al mismo vacío.
Incrustaciones: Deposición de oxalato de calcio, sílice ($SiO_2$) y sulfatos en las paredes internas de los tubos de bronce o acero inoxidable que reducen drásticamente el coeficiente global de transferencia de calor ($U$).`,
    standardOperatingRanges: [
      {
        parameter: "Brix de Meladura de Salida",
        unit: "°Bx",
        nominal: 64.0,
        min: 60.0,
        max: 67.0,
        criticalThreshold: "< 58.0°Bx (meladura floja) o > 68.0°Bx (riesgo de cristalización en tuberías)",
        impactOfDeviation: "Meladura floja sobrecarga los tachos de cocimiento con gasto excesivo de vapor; meladura >68°Bx atasca bombas y líneas.",
      },
      {
        parameter: "Presión de Vapor de Escape a 1er Efecto",
        unit: "bar",
        nominal: 2.1,
        min: 1.8,
        max: 2.4,
        criticalThreshold: "< 1.6 bar (paraliza evaporación) o > 2.6 bar",
        impactOfDeviation: "Baja presión detiene la evaporación y obliga a frenar la molienda por saturación de tanques de jugo.",
      },
      {
        parameter: "Vacío en Último Efecto (Condensador)",
        unit: "bar g",
        nominal: -0.85,
        min: -0.82,
        max: -0.88,
        criticalThreshold: "> -0.78 bar (pérdida de vacío)",
        impactOfDeviation: "Eleva la temperatura en el último cuerpo por encima de 65°C caramelizando la sacarosa.",
      },
      {
        parameter: "Coeficiente Global de Transferencia (1er Efecto)",
        unit: "W/m²·K",
        nominal: 2400,
        min: 1600,
        max: 3000,
        criticalThreshold: "< 1400 W/m²·K indica incrustación severa",
        impactOfDeviation: "Obliga a abrir vapor directo de caldera (reductora) encareciendo el costo energético.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "AIC-401",
        variableDescription: "Brix de meladura a la salida del último efecto",
        actuator: "Válvula de extracción de meladura modulada por bomba con VFD",
        controlStrategy: "Control en cascada con el caudal de jugo claro alimentado al primer efecto y densidad refractométrica",
        tuningGuidelines: "Filtro exponencial sobre la lectura refractométrica para evitar cacería por turbulencia.",
      },
      {
        loopTag: "PIC-402",
        variableDescription: "Presión del cabezal de vapor de escape (calandria 1er efecto)",
        actuator: "Válvula reductora de vapor de vapor vivo HP a escape y válvula de venteo de escape a atmósfera",
        controlStrategy: "Control de split-range para mantener presión constante sin desperdiciar vapor a la atmósfera",
        tuningGuidelines: "Banda muerta de 0.15 bar entre cierre de desahogo y apertura de válvula reductora.",
      },
      {
        loopTag: "LIC-403",
        variableDescription: "Nivel de jugo en cada cuerpo de evaporador",
        actuator: "Válvula mariposa entre cuerpos comunicantes",
        controlStrategy: "Mantener nivel a un tercio inferior de la altura de tubos (30-35%) para máxima ebullición nucleada",
        tuningGuidelines: "Evitar inundar los tubos para no perder coeficiente de transferencia de calor.",
      },
    ],
    applicableStandards: ["Principios de Rillieux", "ASME Boiler & Pressure Vessel Code Sec VIII"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Vigila el Brix de meladura y mantén los niveles entre 28% y 35% de los tubos. Nunca permitas que el último efecto trabaje por debajo de -0.82 bar de vacío.",
      supervisor: "Verifica que el sangrado de vapor V1 cubra el 100% de la demanda de los tachos de cocimiento, evitando abrir vapor de escape en calandrias de tachos.",
      analista_calidad: "Mide el color ICUMSA de la meladura y verifica la eficiencia de la flotación de meladura (remoción de turbidez > 70%).",
      auditor_seguridad: "Comprueba el registro de horas de operación continua de cada cuerpo para programar limpiezas de incrustación reglamentarias.",
      administrador: "Monitorea el indicador de consumo específico de vapor ($kg/t$ caña) y el costo térmico fabril.",
      superadmin: "Optimiza en el simulador térmico el reparto de áreas de transferencia y puntos de sangría entre efectos.",
      mantenimiento: "Inspecciona los eyectores de vacío, bombas de condensado barométrico y estado de toberas de condensadores.",
      observador: "Visualiza el perfil térmico en cascada de los 5 efectos de evaporación en la interfaz.",
    },
    perfectionRules: [
      {
        triggerCondition: "Meladura de salida bajando a < 61° Brix durante pico de molienda",
        recommendedAdjustment: "Modular válvula de sangrado V2 y reducir alimentación de jugo claro en 5% hasta recuperar 64° Brix",
        thermodynamicBasis: "Enviar meladura a 60° Brix en lugar de 65° Brix obliga a evaporar 12.8 t adicionales de agua en los tachos al vacío con vapor de escape, colapsando el balance térmico.",
        expectedGain: "Ahorro de 14.5 t/h de vapor en casa de cocimiento y templas más rápidas.",
        riskMitigation: "Previene atascos en cristalizadores por templas mal cocidas.",
      },
    ],
  },

  // ==========================================================================
  // 5. CRISTALIZACIÓN EN TACHOS AL VACÍO Y CRISTALIZADORES
  // ==========================================================================
  {
    id: "cristalizacion-tachos-agotamiento",
    name: "Cristalización en Tachos al Vacío y Agotamiento de Mieles",
    stageNumber: 5,
    stageCategory: "CRISTALIZACION_AGOTAMIENTO",
    summary: "Esquema de tres masas cocidas (A, B, C), cocimiento al vacío (-0.85 bar, 65°C), semillamiento con magma/polvillo, cristalizadores de enfriamiento y agotamiento de melaza final (<32% pureza).",
    detailedProcessDescription: `La meladura clarificada ingresa a la casa de cocimiento, donde se realiza la cristalización por sobresaturación en evaporadores discontinuos o continuos al vacío denominados Tachos de Cocimiento (Vacuum Pans). Se opera bajo un esquema clásico de 3 templas o masas cocidas:
1. Masa Cocida A (Comercial): Alimentada con meladura y magma B; produce el Azúcar Comercial A y Miel Rica A. Brix 86-88°, pureza 82-86%.
2. Masa Cocida B (Semilla): Alimentada con Miel Rica A; produce Semilla B (para Masa A) y Miel Pobre B. Brix 89-91°, pureza 72-76%.
3. Masa Cocida C (Agotamiento): Alimentada con Miel Pobre B y pie de siembra slurry (polvillo de azúcar en alcohol isopropílico); produce Azúcar C (recirculada como magma) y Melaza Final (Miel C agotada). Brix 93-95°, pureza 56-60%.
Las masas C son descargadas a cristalizadores horizontales de enfriamiento continuo con circulación de agua fría en contracorriente, donde la solubilidad decrece forzando la sacarosa disuelta a depositarse sobre los cristales preexistentes durante 24 a 36 horas de retención, agotando la melaza final hasta alcanzar una pureza aparente menor a 32% (pureza verdadera menor a 38%).`,
    keyPhysicsAndChemistry: `Coeficiente de Sobresaturación ($SS$):
$SS = \\frac{S}{S_0}$ a la misma temperatura.
- Zona Metaestable ($1.00 < SS < 1.25$): Los cristales existentes crecen sin formación de nuevos granos falsos. Esta es la zona obligatoria de cocimiento.
- Zona Intermedia ($1.25 < SS < 1.40$): Riesgo inminente de generación de polvo y conglomerados.
- Zona Lábil ($SS > 1.40$): Formación espontánea y descontrolada de grano falso que arruina la templa.
Transmisores de consistencia y resistividad: Se emplean sondas de radiofrecuencia (microondas) o conductividad eléctrica para inferir el Brix de la masa cocida dentro del tacho independientemente de la pureza.`,
    standardOperatingRanges: [
      {
        parameter: "Pureza Aparente de Melaza Final",
        unit: "%",
        nominal: 31.0,
        min: 27.5,
        max: 33.5,
        criticalThreshold: "> 35.0%",
        impactOfDeviation: "Pérdida directa de azúcar que sale de la fábrica como melaza de bajo precio para alimento animal o destilería.",
      },
      {
        parameter: "Brix de Masa Cocida A",
        unit: "°Bx",
        nominal: 87.5,
        min: 86.0,
        max: 89.0,
        criticalThreshold: "< 85.0°Bx o > 90.5°Bx",
        impactOfDeviation: "Brix bajo produce pocos cristales y bajo rendimiento; Brix alto dificulta la descarga y centrifugado.",
      },
      {
        parameter: "Brix de Masa Cocida C",
        unit: "°Bx",
        nominal: 94.0,
        min: 92.5,
        max: 95.5,
        criticalThreshold: "< 91.0°Bx",
        impactOfDeviation: "Falta de agotamiento en cristalizadores de enfriamiento elevando la pérdida de sacarosa.",
      },
      {
        parameter: "Temperatura de Masa en Tacho",
        unit: "°C",
        nominal: 64.5,
        min: 62.0,
        max: 68.0,
        criticalThreshold: "> 70.0°C",
        impactOfDeviation: "Caramelización y aumento excesivo de color ICUMSA en el azúcar comercial.",
      },
      {
        parameter: "Vacío en Tacho al Vacío",
        unit: "bar g",
        nominal: -0.85,
        min: -0.82,
        max: -0.88,
        criticalThreshold: "> -0.78 bar g",
        impactOfDeviation: "Pérdida de vacío eleva la temperatura y desacelera la velocidad de cristalización.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "QIC-501",
        variableDescription: "Sobresaturación y consistencia por microondas en tacho",
        actuator: "Válvula modulante de alimentación de meladura / miel rica",
        controlStrategy: "Control adaptativo de alimentación para mantener $SS$ en zona metaestable (1.15 a 1.22)",
        tuningGuidelines: "Calibración de la curva de microondas según la pureza de la templa (A, B o C).",
      },
      {
        loopTag: "PIC-502",
        variableDescription: "Vacío en cuerpo de tacho",
        actuator: "Válvula mariposa de inyección de agua al condensador barométrico",
        controlStrategy: "PID con acción derivativa suave para estabilizar temperatura de ebullición a 64°C",
        tuningGuidelines: "Evitar variaciones bruscas de vacío que induzcan grano falso por sobreenfriamiento súbito.",
      },
    ],
    applicableStandards: ["ICUMSA GS2/1/3/9-15 Sugar Crystal Size", "Spencer-Meade Cane Sugar Handbook"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Revisa la prueba de vidrio con lupa de cristalización para verificar tamaño uniforme de grano y ausencia de granos falsos antes de descargar la templa.",
      supervisor: "Programa el orden de bajada de templas A para mantener el flujo constante hacia las baterías de centrífugas discontinuas.",
      analista_calidad: "Determina pureza por método de polarización refractométrica en mieles A, B y final cada turno de 8 horas.",
      auditor_seguridad: "Supervisa que los enclavamientos de seguridad por sobrepresión de vapor en calandrias de tachos estén certificados.",
      administrador: "Verifica el coeficiente de agotamiento de melaza y calcula el valor económico del azúcar recuperada.",
      superadmin: "Modela la cinética de crecimiento de cristales de sacarosa en función de viscosidad y temperatura.",
      mantenimiento: "Inspecciona el sello de las compuertas de descarga de tachos y los agitadores mecánicos internos.",
      observador: "Visualiza el estado de cocimiento de cada tacho (evaporando, semillando, alimentando, apretando, descargando).",
    },
    perfectionRules: [
      {
        triggerCondition: "Aparición de grano falso detectado por sonda en tacho de Masa A",
        recommendedAdjustment: "Inyectar vapor de lavado o agua caliente a 85°C durante 90 segundos y cerrar alimentación de meladura",
        thermodynamicBasis: "El agua caliente subsatura temporalmente el licor madre disolviendo exclusivamente los microcristales falsos sin alterar los cristales nodriza mayores.",
        expectedGain: "Evita que el azúcar comercial sea rechazada por polidispersión o bloqueo de telas en centrífugas.",
        riskMitigation: "Previene parada de centrífugas por mala purga de mieles.",
      },
    ],
  },

  // ==========================================================================
  // 6. CENTRIFUGACIÓN, SECADO Y ENVASADO
  // ==========================================================================
  {
    id: "centrifugacion-secado-envasado",
    name: "Centrifugación, Secado, Enfriamiento y Envasado de Azúcar",
    stageNumber: 6,
    stageCategory: "CENTRIFUGACION_SECADO",
    summary: "Separación mecánica de cristales y licor madre en centrífugas discontinuas/continuas, lavado con agua a 95°C y vapor a 115°C, secador rotatorio/lecho fluidizado, humedad final <0.04% y color ICUMSA.",
    detailedProcessDescription: `La masa cocida descargada de los tachos pasa a mezcladores receptores con paletas helicoidales de agitación lenta para evitar asentamiento. Desde allí alimenta las baterías de centrífugas:
- Centrífugas Discontinuas Automáticas (Batch): Utilizadas exclusivamente para Masa A de azúcar comercial. Operan con ciclos automáticos de 2.5 a 3.5 minutos que comprenden: carga controlada a baja velocidad (250 RPM), aceleración a fuerza centrífuga de 1,200 a 1,400 G, aplicación de lavado de agua desmineralizada caliente (90-95°C) mediante boquillas aspersoras para remover la película de miel adherida, lavado complementario con vapor recalentado (110-118°C) para secado y brillo, frenado regenerativo y descarga mecánica con arado rascador.
- Centrífugas Continuas de Canasta Cónica (30° a 34°): Utilizadas para masas B y C con flujo continuo y fuerza centrífuga de 2,000 G.
El azúcar húmedo descargado (humedad 0.5-1.0%) es transportado por conductores vibratorios o tolvas hacia secadores-enfriadores combinados de lecho fluidizado o tambores rotatorios en contracorriente de aire caliente filtrado (75-85°C) seguido de aire frío deshumidificado (25-30°C). El azúcar seco sale con humedad inferior a 0.04% y temperatura menor a 38°C para evitar apelmazamiento (caking) en silos y sacos de 50 kg o big bags de 1,000 kg.`,
    keyPhysicsAndChemistry: `Factor de Seguridad de Almacenamiento (Safety Factor de Roberts):
$FS = \\frac{Humedad \\%}{100 - Pol \\%} < 0.25$
Si $FS > 0.25$, el azúcar absorberá humedad atmosférica por higroscopicidad disolviendo la sacarosa superficial y alimentando bacterias y hongos que invierten el azúcar en bodega.
Color ICUMSA: Medido a 420 nm tras disolución y filtrado a 0.45 micrómetros. El azúcar blanco directo requiere ICUMSA entre 45 y 100 UI; el azúcar crudo de exportación entre 800 y 1,400 UI; y el azúcar refinado < 45 UI.`,
    standardOperatingRanges: [
      {
        parameter: "Humedad de Azúcar Terminado",
        unit: "%",
        nominal: 0.035,
        min: 0.02,
        max: 0.045,
        criticalThreshold: "> 0.050%",
        impactOfDeviation: "Apelmazamiento severo en sacos, fermentación y rechazo por clientes industriales.",
      },
      {
        parameter: "Temperatura de Azúcar a Ensacado",
        unit: "°C",
        nominal: 35.0,
        min: 28.0,
        max: 38.0,
        criticalThreshold: "> 42.0°C",
        impactOfDeviation: "Ensacar azúcar caliente causa condensación interna y formación de costras duras.",
      },
      {
        parameter: "Color ICUMSA (Azúcar Blanco Directo)",
        unit: "UI",
        nominal: 75.0,
        min: 45.0,
        max: 110.0,
        criticalThreshold: "> 130.0 UI",
        impactOfDeviation: "Descalificación comercial de grado estándar a grado inferior con penalización en precio.",
      },
      {
        parameter: "Tiempo de Ciclo Centrífuga Batch",
        unit: "segundos",
        nominal: 165,
        min: 140,
        max: 210,
        criticalThreshold: "> 240 s (cuello de botella)",
        impactOfDeviation: "Paraliza el flujo de descarga de tachos y obliga a dilatar templas.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "TIC-601",
        variableDescription: "Temperatura de aire caliente en secador de azúcar",
        actuator: "Válvula modulante de vapor a radiador de aire de secado",
        controlStrategy: "PID con limitador de temperatura máxima a 88°C para no fundir los cristales de sacarosa",
        tuningGuidelines: "Sintonización rápida para evitar sobrecalentamiento en paradas momentáneas de alimentación.",
      },
      {
        loopTag: "QIC-602",
        variableDescription: "Dosificación de agua de lavado en centrífuga batch",
        actuator: "Válvula solenoide de respuesta rápida con caudalímetro electromagnético",
        controlStrategy: "Inyección temporizada en dos pulsos durante la rampa de alta velocidad (800 y 1200 RPM)",
        tuningGuidelines: "Consumo óptimo: 1.5% a 2.5% de agua sobre el peso de masa cocida cargada.",
      },
    ],
    applicableStandards: ["ICUMSA GS2/3-9 Color Determination", "ISO 9001", "HACCP / FSSC 22000"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Inspecciona la uniformidad de las telas cribadoras de las canastas de centrífugas. Si detectas rayas de miel en la descarga de azúcar, sustituye la tela de inmediato.",
      supervisor: "Asegura el balance entre la producción de sacos por hora y la disponibilidad en silos de almacenamiento.",
      analista_calidad: "Extrae muestras de sacos cada 30 minutos para medir humedad en balanza halógena, color ICUMSA y granulometría (apertura media MA y coeficiente de variación CV).",
      auditor_seguridad: "Verifica que el sistema de detección de metales en la línea de ensacado rechace con alarma auditada cualquier contaminante ferroso o no ferroso.",
      administrador: "Revisa la eficiencia de ensacado, mermas de empaque y cumplimiento de despachos a clientes.",
      superadmin: "Configura límites de calidad y especificaciones de producto terminado por cliente corporativo.",
      mantenimiento: "Monitorea vibraciones axiales y radiales en rodamientos de centrífugas batch a 1,400 RPM según ISO 10816-3.",
      observador: "Consulta el contador acumulado de sacos producidos y toneladas métricas de azúcar blanco y crudo.",
    },
    perfectionRules: [
      {
        triggerCondition: "Color ICUMSA superior a 95 UI con humedad normal en centrífuga",
        recommendedAdjustment: "Adelantar el lavado de vapor en 4 segundos y aumentar agua de lavado en 0.4 L por ciclo",
        thermodynamicBasis: "El vapor recalentado licúa la película residual de miel de alta pureza retenida entre las aristas de los cristales sin disolver la masa cristalina.",
        expectedGain: "Reducción de 18 a 25 puntos de ICUMSA garantizando cumplimiento de especificación blanco directo.",
        riskMitigation: "Evita la disolución innecesaria de azúcar blanca recuperable.",
      },
    ],
  },

  // ==========================================================================
  // 7. DESTILERÍA Y BIOETANOL (ALCOHOL CARBURANTE)
  // ==========================================================================
  {
    id: "destileria-bioetanol-anhidro",
    name: "Destilería de Bioetanol y Alcohol Carburante Anhidro",
    stageNumber: 7,
    stageCategory: "DESTILERIA_BIOETANOL",
    summary: "Fermentación alcohólica continua o batch (Melle-Boinot) con levadura Saccharomyces cerevisiae, destilación/rectificación y deshidratación con tamices moleculares a 99.5° GL.",
    detailedProcessDescription: `La destilería convierte la melaza final (miel rica o jugo directo) en bioetanol carburante de alta pureza:
1. Preparación de Mosto: Dilución de melaza en agua tratada hasta alcanzar 18 a 22° Brix, corrección de pH a 4.2-4.6 con ácido sulfúrico para inhibir bacterias lácticas, y adición de nutrientes (sulfato de amonio, urea y fósforo).
2. Fermentación Alcohólica: Proceso con recirculación de levadura (Melle-Boinot) en cubas con enfriamiento continuo por intercambiadores de placas para disipar el calor exotérmico y mantener la temperatura a 32-34°C. Las centrífugas deslodadoras recuperan la levadura para tratamiento ácido y reinoculación. El vino fermentado alcanza una graduación alcohólica de 8.5 a 10.5% GL con rendimiento fermentativo de 88-92% Gay-Lussac.
3. Destilación y Rectificación: El vino desgasificado alimenta la columna despojadora (columna A) que separa la vinaza en el fondo y vapores alcohólicos en cabeza. Pasa a columnas de rectificación y purificación (columnas B y B1) para extraer alcohol hidratado azaotrópico a 96.0 - 96.5° GL.
4. Deshidratación Molecular: Rompimiento del azeótropo agua-etanol mediante tecnología de adsorción por oscilación de presión (PSA) con tamices moleculares de zeolita 3Å, obteniendo alcohol carburante anhidro con graduación mayor a 99.5° GL (contenido de agua menor a 0.5% en volumen).`,
    keyPhysicsAndChemistry: `Ecuación Estequiométrica de Gay-Lussac:
$C_{12}H_{22}O_{11} + H_2O \\longrightarrow 2 C_6H_{12}O_6 \\longrightarrow 4 C_2H_5OH + 4 CO_2 + 23.5 \\text{ kcal}$
Rendimiento estequiométrico máximo: $64.75 \\text{ L de etanol puro}$ por cada $100 \\text{ kg de sacarosa fermentada}$.
Adsorción por zeolita 3Å: El tamaño del poro de la zeolita sintética (3 Ángstroms) permite ingresar a la molécula de agua (diámetro cinético 2.8 Å) mientras excluye mecánicamente a la molécula de etanol (diámetro cinético 4.4 Å), logrando deshidratación en fase vapor a 115-130°C y 3-4 bar.`,
    standardOperatingRanges: [
      {
        parameter: "Graduación Alcohólica de Etanol Anhidro",
        unit: "°GL",
        nominal: 99.6,
        min: 99.3,
        max: 99.8,
        criticalThreshold: "< 99.2°GL (fuera de norma combustible)",
        impactOfDeviation: "Rechazo de cargamento por empresas petroleras distribuidoras de combustible automotriz.",
      },
      {
        parameter: "Temperatura en Cubas de Fermentación",
        unit: "°C",
        nominal: 33.0,
        min: 31.0,
        max: 34.5,
        criticalThreshold: "> 35.5°C",
        impactOfDeviation: "Muerte térmica de levaduras, pérdida de viabilidad celular y contaminación bacteriana.",
      },
      {
        parameter: "Viabilidad Celular de Levaduras",
        unit: "%",
        nominal: 88.0,
        min: 80.0,
        max: 95.0,
        criticalThreshold: "< 75.0%",
        impactOfDeviation: "Proliferación de acidez volátil (ácido acético) y fermentación estancada.",
      },
      {
        parameter: "Pérdida de Etanol en Vinaza",
        unit: "% v/v",
        nominal: 0.02,
        min: 0.005,
        max: 0.05,
        criticalThreshold: "> 0.08% v/v",
        impactOfDeviation: "Pérdida económica de producto evaporado que se va por el fondo de la columna despojadora.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "TIC-701",
        variableDescription: "Temperatura en fermentadores continuos",
        actuator: "Válvula modulante de agua de enfriamiento hacia intercambiadores de vino",
        controlStrategy: "Control en cascada con split-range sobre bombas de recirculación externa",
        tuningGuidelines: "Respuesta rápida para evitar picos de temperatura durante la fase exponencial de fermentación.",
      },
      {
        loopTag: "PIC-702",
        variableDescription: "Presión en columnas PSA de tamices moleculares",
        actuator: "Válvulas neumáticas de asiento inclinado de ciclo rápido",
        controlStrategy: "Secuencia secuencial cíclica (adsorción, despresurización, regeneración con vacío, presurización)",
        tuningGuidelines: "Verificar estanqueidad de asientos de válvulas para evitar fugas de vapor de etanol anhidro.",
      },
    ],
    applicableStandards: ["ASTM D4806 Fuel Ethanol", "NFPA 30 Flammable Liquids Code"],
    systemModuleMapping: "scada",
    roleSpecificGuidance: {
      operador: "Monitorea el ciclo de regeneración de tamices moleculares y los niveles de vinaza en la columna despojadora.",
      supervisor: "Coordina la recepción de melaza desde la casa de cocimiento con el ritmo de fermentación y capacidad en tanques de almacenamiento de alcohol.",
      analista_calidad: "Realiza cromatografía de gases para determinar contenido de agua (Karl Fischer), metanol, fusel oil y acidez total en el bioetanol.",
      auditor_seguridad: "Audita los sistemas de protección contra explosión ATEX/IECEx y las paradas de emergencia en áreas clasificadas Zona 1 y 2.",
      administrador: "Evalúa el balance económico de destilar melaza vs exportar melaza cruda según precios de paridad internacional.",
      superadmin: "Ajusta las curvas estequiométricas de conversión de azúcares a bioetanol en el gemelo digital.",
      mantenimiento: "Inspecciona los sellos mecánicos dobles presurizados de las bombas de alcohol y soplantes de CO2.",
      observador: "Visualiza la tasa de producción horaria de alcohol anhidro e hidratado.",
    },
    perfectionRules: [
      {
        triggerCondition: "Temperatura de cuba de fermentación superando 34.2°C con agua de enfriamiento al 100%",
        recommendedAdjustment: "Reducir la alimentación de melaza en 15% y acelerar la recirculación de vino refrigerado",
        thermodynamicBasis: "Por encima de 34.5°C las enzimas alcohol deshidrogenasa de Saccharomyces cerevisiae se desnaturalizan, duplicando la generación de glicerol en lugar de etanol.",
        expectedGain: "Preservación del 90% de la viabilidad celular y retorno rápido al régimen térmico seguro.",
        riskMitigation: "Previene contaminación masiva por bacterias termófilas.",
      },
    ],
  },

  // ==========================================================================
  // 8. COGENERACIÓN, CALDERAS DE BIOMASA Y DESPACHO SEN
  // ==========================================================================
  {
    id: "cogeneracion-calderas-biomasa",
    name: "Generación de Vapor HP, Combustión de Bagazo y Cogeneración Eléctrica",
    stageNumber: 8,
    stageCategory: "COGENERACION_VAPOR",
    summary: "Calderas acuotubulares de biomasa (45-65 bar, 450-500°C), balance ASME PTC 4 por método de pérdidas, O2 en chimenea 3.2-4.0%, turbogeneradores de extracción/condensación y despacho PPA al SEN.",
    detailedProcessDescription: `La planta de cogeneración de BioAzúcar aprovecha el bagazo residual de molienda como combustible renovable en calderas acuotubulares de alta presión (45 a 65 bar g, vapor sobrecalentado a 450-500°C con capacidades de 150 a 300 t/h de vapor). El bagazo es alimentado mediante distribuidores neumáticos sobre parrillas viajeras o basculantes refrigeradas. El aire primario precalentado (180-220°C) ingresa bajo la parrilla, mientras que el aire secundario se inyecta por toberas tangenciales para inducir turbulencia y completar la combustión en la zona de garganta del hogar. Los humos calientes ceden calor en el sobrecalentador, banco de generación, economizador y precalentador de aire tubular antes de pasar por precipitadores electrostáticos o lavadores húmedos (scrubbers) para capturar cenizas volantes. El vapor HP se expande en turbogeneradores de vapor sincrónicos (típicamente turbinas de condensación-extracción o contrapresión de 25 a 60 MW) acoplados a generadores eléctricos de 13.8 kV. El sistema abastece el autoconsumo fabril y exporta los excedentes a la subestación elevadora de alta tensión (115/138 kV) para despacho al Sistema Eléctrico Nacional bajo contratos PPA.`,
    keyPhysicsAndChemistry: `Balance Térmico ASME PTC 4 (Método Indirecto de Pérdidas):
Eficiencia de caldera: $\\eta = 100 - (L_{gas} + L_{hum} + L_H + L_{rad} + L_{inq})$
Poder Calorífico Inferior (PCI) del Bagazo según E. Hugot:
$PCI = 4250 - 48.5 \\cdot W - 42.5 \\cdot B - 12.0 \\cdot S \\quad (\\text{kcal/kg})$
Donde $W$ es la humedad en bagazo (%), $B$ es el porcentaje de Brix, y $S$ es el porcentaje de cenizas.
Para humedad nominal de 48.5%, el PCI ronda 1,850 kcal/kg (7.75 MJ/kg). Cada 1% de reducción de humedad en bagazo eleva la eficiencia de la caldera en aproximadamente 0.75%.
Control de Combustión & $O_2$ Trim: El $O_2$ libre en gases de chimenea debe mantenerse entre 3.2% y 4.0% (equivalente a 18-22% de exceso de aire). Menos de 2.8% genera inquemados ($CO$) y pérdidas energéticas; más de 4.5% enfría el hogar y aumenta la pérdida por calor sensible en gases secos.`,
    standardOperatingRanges: [
      {
        parameter: "Presión de Vapor HP en Cabezal",
        unit: "bar",
        nominal: 64.5,
        min: 60.0,
        max: 66.5,
        criticalThreshold: "< 58.0 bar o > 68.0 bar (apertura de válvulas de seguridad)",
        impactOfDeviation: "Baja presión disminuye la generación eléctrica en turbinas; alta presión dispara válvulas de alivio perdiendo vapor.",
      },
      {
        parameter: "Temperatura de Vapor Sobrecalentado",
        unit: "°C",
        nominal: 485.0,
        min: 465.0,
        max: 505.0,
        criticalThreshold: "> 515.0°C (daño térmico en álabes) o < 445.0°C",
        impactOfDeviation: "Temperatura excesiva funde o deforma tubos de sobrecalentador; baja temperatura produce condensación en etapas finales de turbina.",
      },
      {
        parameter: "Oxígeno Libre en Chimenea (O2 Trim)",
        unit: "%",
        nominal: 3.5,
        min: 2.8,
        max: 4.2,
        criticalThreshold: "< 2.2% (humo negro / CO) o > 5.5%",
        impactOfDeviation: "Pérdida de eficiencia térmica en caldera y riesgo de explosión en hogar por inquemados.",
      },
      {
        parameter: "Tiro en Hogar (Depresión)",
        unit: "mm H2O",
        nominal: -7.5,
        min: -12.0,
        max: -4.0,
        criticalThreshold: "> 0.0 mm H2O (presión positiva lanza llamaradas hacia compuertas)",
        impactOfDeviation: "Riesgo grave de incendio en conductores de bagazo y quemaduras a operarios.",
      },
      {
        parameter: "Potencia Exportada a la Red (Grid)",
        unit: "MW",
        nominal: 21.5,
        min: 16.0,
        max: 26.0,
        criticalThreshold: "< 14.0 MW (incumplimiento de contrato PPA)",
        impactOfDeviation: "Penalizaciones comerciales millonarias con el operador del sistema eléctrico.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "PIC-801",
        variableDescription: "Presión de vapor HP en domo de caldera",
        actuator: "Variadores de frecuencia en alimentadores rotatorios de bagazo",
        controlStrategy: "Lazo maestro de combustión con desacoplamiento cruzado y compensación por flujo de vapor",
        tuningGuidelines: "Acción integral moderada para amortiguar irregularidades en la densidad del bagazo.",
      },
      {
        loopTag: "TIC-802",
        variableDescription: "Temperatura de vapor sobrecalentado",
        actuator: "Válvula de inyección de agua desmineralizada de atemperación (desuperheater)",
        controlStrategy: "Control en cascada entre temperatura final y temperatura intermedia entre bancos de sobrecalentador",
        tuningGuidelines: "Respuesta anticipativa rápida para evitar estrés térmico en cabezales de vapor.",
      },
      {
        loopTag: "PIC-803",
        variableDescription: "Tiro en hogar (depresión de cámara de combustión)",
        actuator: "Álabes directrices (damper) o VFD del ventilador de tiro inducido (ID Fan)",
        controlStrategy: "PID de acción ultrarrápida con enclavamiento de disparo por presión positiva",
        tuningGuidelines: "Tiempo de integración < 5s; máxima prioridad de seguridad física.",
      },
      {
        loopTag: "AIC-804",
        variableDescription: "Oxígeno residual en chimenea (O2 Trim)",
        actuator: "Damper de aire forzado primario y secundario (FD Fan)",
        controlStrategy: "Optimización continua multivariable minimizando pérdidas térmicas ASME PTC 4",
        tuningGuidelines: "Curva adaptativa de O2 setpoint en función de la carga de vapor en t/h.",
      },
    ],
    applicableStandards: ["ASME PTC 4 (Fired Steam Generators)", "NFPA 85 Boiler and Combustion Hazards", "IEEE 1547 Grid Interconnection"],
    systemModuleMapping: "energy_dispatch",
    roleSpecificGuidance: {
      operador: "Monitorea continuamente el tiro en hogar (-7 mm H2O) y el nivel de domo de caldera (lazo tri-elemento). Si la presión cae por debajo de 60 bar, prioriza el vapor a turbinas reduciendo sangrías.",
      supervisor: "Gestiona el compromiso horario de despacho PPA con la subestación. Si el tándem de molienda reduce TCH, activa el consumo de bagazo del patio de almacenamiento para no caer en penalización de MW.",
      analista_calidad: "Audita la calidad del agua de alimentación a caldera (sílice < 0.02 ppm, conductividad catiónica < 0.2 uS/cm, dureza 0 ppm y oxígeno disuelto < 5 ppb en desaireador).",
      auditor_seguridad: "Verifica que las pruebas de disparo de válvulas de seguridad ASME y los enclavamientos SIL-3 de llama y nivel de domo estén auditados.",
      administrador: "Analiza el ingreso por venta de energía en el mercado PPA y spot ($ USD/MWh) y el costo de combustible por tonelada de vapor generada.",
      superadmin: "Ajusta en el modelo de combustión estequiométrica los parámetros de composición elemental de biomasa (C, H, O, N, S).",
      mantenimiento: "Inspecciona los rodamientos de ventiladores FD e ID con análisis de espectros FFT de vibración y termografía en transformadores elevadores de 13.8 a 115 kV.",
      observador: "Visualiza el sinóptico de vapor vivo, generación MW y flujo de vapor a turbogeneradores.",
    },
    perfectionRules: [
      {
        triggerCondition: "Petición de elevar setpoint de presión a > 67.5 bar con bagazo húmedo",
        recommendedAdjustment: "Fijar setpoint en 65.0 bar e incrementar temperatura de aire secundario a 195°C",
        thermodynamicBasis: "Subir a 68 bar deja solo 1 bar antes del disparo de válvulas de alivio (taradas a 69 bar). Una ráfaga de bagazo húmedo desestabiliza la llama y causará venteos masivos de vapor a la atmósfera.",
        expectedGain: "Operación estable en 32.4 MW con factor de planta del 98% sin pérdidas por venteo.",
        riskMitigation: "Elimina el riesgo de apertura no planificada de válvulas de seguridad mecánicas.",
      },
      {
        triggerCondition: "O2 libre en chimenea superior a 5.0% sostenido durante más de 15 minutos",
        recommendedAdjustment: "Reducir tiro forzado FD en 6% e incrementar temperatura de aire secundario",
        thermodynamicBasis: "Un exceso de aire del 30% ($O_2 = 5.2\\%$) incrementa las pérdidas por calor latente en gases de chimenea en 1.8%, consumiendo 4.2 t/h adicionales de bagazo.",
        expectedGain: "Ahorro de 3.8 toneladas de bagazo/hora acumulables en patio para zafra extendida.",
        riskMitigation: "Reduce la emisión de material particulado y desgaste abrasivo en economizador.",
      },
    ],
  },

  // ==========================================================================
  // 9. TRATAMIENTO DE VINAZA, BIOGÁS Y SOSTENIBILIDAD
  // ==========================================================================
  {
    id: "tratamiento-vinaza-biogas",
    name: "Tratamiento de Vinaza, Biodigestión de Biogás y Fertirriego Agronómico",
    stageNumber: 9,
    stageCategory: "TRATAMIENTO_EFLUENTES",
    summary: "Gestión de efluentes de destilería (vinaza), concentración por evaporación, biodigestión anaeróbica UASB (biogás con 65% CH4), compostaje con cachaza y fertirriego controlado.",
    detailedProcessDescription: `Por cada litro de bioetanol producido se generan entre 10 y 13 litros de vinaza con alta carga orgánica (DBO 35,000-50,000 mg/L, DQO 80,000-120,000 mg/L) y alto contenido de potasio ($K_2O$). El sistema de BioAzúcar 4.0 implementa una estrategia de economía circular en tres etapas:
1. Concentración de Vinaza: Evaporadores de película descendente impulsados por vapor residual que concentran la vinaza desde 8° Brix hasta 35-50° Brix para reducir su volumen en un 70%.
2. Biodigestión Anaeróbica en Reactores UASB (Upflow Anaerobic Sludge Blanket): Las bacterias metanogénicas transforman la materia orgánica disuelta en biogás rico en metano (60-65% CH4). El biogás se somete a desulfuración biológica para retirar ácido sulfhídrico ($H_2S < 100 \\text{ ppm}$) y se inyecta como combustible suplementario en calderas de biomasa o motogeneradores de gas.
3. Fertirriego y Compostaje: La vinaza tratada o concentrada se aplica como fertilizante orgánico líquido en campos cañeros mediante canales impermeabilizados o camiones cisterna bajo control estricto de balances de potasio en suelo, o se mezcla con cachaza y cenizas en plantas de compostaje aeróbico para producir biofertilizante sólido.`,
    keyPhysicsAndChemistry: `Metanogénesis Anaeróbica:
$C_6H_{12}O_6 \\longrightarrow 3 CH_4 + 3 CO_2$
Poder calorífico del biogás: ~5,500 kcal/m³ (23 MJ/m³ a 65% CH4).
Relación C/N en compostaje: Ajustada entre 25:1 y 30:1 mediante la mezcla homogénea de cachaza (rica en P y N) con cenizas de bagazo (ricas en sílice) y vinaza (rica en K).`,
    standardOperatingRanges: [
      {
        parameter: "Eficiencia de Remoción de DQO en Reactor UASB",
        unit: "%",
        nominal: 78.0,
        min: 70.0,
        max: 86.0,
        criticalThreshold: "< 65.0%",
        impactOfDeviation: "Sobrecarga de efluentes hacia lagunas secundarias y caída en generación de biogás.",
      },
      {
        parameter: "Concentración de Metano (CH4) en Biogás",
        unit: "%",
        nominal: 64.0,
        min: 58.0,
        max: 68.0,
        criticalThreshold: "< 52.0%",
        impactOfDeviation: "Riesgo de inestabilidad de llama al quemar en calderas.",
      },
      {
        parameter: "H2S en Biogás a la Salida de Desulfurador",
        unit: "ppm",
        nominal: 60.0,
        min: 10.0,
        max: 150.0,
        criticalThreshold: "> 250.0 ppm",
        impactOfDeviation: "Corrosión ácida extrema por formación de ácido sulfúrico en ductos de caldera.",
      },
    ],
    controlLoopsAndActuators: [
      {
        loopTag: "AIC-901",
        variableDescription: "pH en reactor UASB",
        actuator: "Dosificación de lechada de cal o bicarbonato de sodio en la recirculación",
        controlStrategy: "Mantener pH entre 6.8 y 7.4 para evitar acidificación de las arqueas metanogénicas",
        tuningGuidelines: "Frecuencia de muestreo continua con compensación de ácidos grasos volátiles (AGV).",
      },
    ],
    applicableStandards: ["Normas Ambientales de Efluentes Industriales", "EPA Guidelines for Cane Sugar Processing"],
    systemModuleMapping: "agricultural_pda",
    roleSpecificGuidance: {
      operador: "Vigila la producción horaria de biogás y la presión en el gasómetro de membrana.",
      supervisor: "Coordina la distribución de vinaza tratada hacia los frentes de fertirriego autorizados en el plan agronómico.",
      analista_calidad: "Realiza análisis de DQO, DBO, conductividad eléctrica y relación AGV/Alcalinidad en el efluente.",
      auditor_seguridad: "Audita el cumplimiento de las licencias ambientales y el registro de emisiones atmosféricas.",
      administrador: "Evalúa los créditos de carbono y el ahorro en fertilizantes químicos nitrogenados y potásicos.",
      superadmin: "Configura límites ambientales y normativas de vertido cero por jurisdicción.",
      mantenimiento: "Inspecciona los sistemas de detección de fugas de gas CH4 y parallamas en las líneas de biogás.",
      observador: "Visualiza el volumen de vinaza tratada y biogás producido en el módulo ambiental.",
    },
    perfectionRules: [
      {
        triggerCondition: "pH en reactor anaeróbico descendiendo a < 6.75",
        recommendedAdjustment: "Reducir la carga volumétrica de vinaza cruda en un 25% y dosificar solución de soda cáustica o bicarbonato",
        thermodynamicBasis: "La acidosis inhibe irreversiblemente a los microorganismos metanogénicos desestabilizando el reactor por semanas.",
        expectedGain: "Recuperación de la estabilidad biológica en 12 horas y protección del reactor.",
        riskMitigation: "Previene parada prolongada de la destilería por colapso de tratamiento de vinaza.",
      },
    ],
  },

  // ==========================================================================
  // 10. LABORATORIO LIMS Y CONTROL DE CALIDAD
  // ==========================================================================
  {
    id: "laboratorio-lims-calidad",
    name: "Laboratorio Industrial LIMS y Aseguramiento de Calidad",
    stageNumber: 10,
    stageCategory: "CONTROL_CALIDAD_LIMS",
    summary: "Monitoreo integral de jugos, meladuras, masas, azúcar comercial y aguas de caldera con polarimetría digital, refractometría, espectrofotometría ICUMSA, microbiología y calibración de instrumentos.",
    detailedProcessDescription: `El módulo LIMS (Laboratory Information Management System) centraliza todos los protocolos de muestreo y ensayos fisicoquímicos en tiempo real:
- Muestreo horario de jugo mixto, jugo clarificado, meladura, masas A, B, C y mieles.
- Determinación de Pol por polarímetro digital automatizado con tubo de flujo continuo sin uso de sales de plomo (método de clarificación fría con reactivos no tóxicos según ICUMSA).
- Brix por refractómetros digitales con prisma de zafiro y control térmico Peltier (20.0°C).
- Color ICUMSA por espectrofotometría a 420 nm con ajuste por índice de refracción y pH.
- Cenizas conductimétricas según método ICUMSA GS2/3-17.
- Dextrano y almidón para cuantificar deterioro poscosecha.
- Calidad de agua de calderas (conductividad, pH, fosfatos residuales, sílice, hierro).
- Análisis microbiológico de azúcar terminada (bacterias mesófilas, levaduras y mohos osmofílicos según normas farmacopea y alimentaria).`,
    keyPhysicsAndChemistry: `Corrección de Temperatura de Brix y Pol:
$Brix_{20} = Brix_T + f(T)$
$Pol_{20} = Pol_T \\cdot [1 - 0.000184 \\cdot (T - 20)]$
El LIMS realiza la compensación analítica algorítmica para evitar errores sistemáticos de laboratorio.`,
    standardOperatingRanges: [
      {
        parameter: "Pol de Azúcar Blanco",
        unit: "°Z",
        nominal: 99.85,
        min: 99.70,
        max: 99.95,
        criticalThreshold: "< 99.60°Z",
        impactOfDeviation: "No cumple estándar de azúcar comercial de primera calidad.",
      },
      {
        parameter: "Cenizas Conductimétricas en Blanco",
        unit: "%",
        nominal: 0.03,
        min: 0.01,
        max: 0.045,
        criticalThreshold: "> 0.055%",
        impactOfDeviation: "Afecta la solubilidad y turbidez en clientes embotelladores de bebidas carbonatadas.",
      },
      {
        parameter: "Recuento Total Mesófilos",
        unit: "UFC/10g",
        nominal: 45,
        min: 0,
        max: 150,
        criticalThreshold: "> 200 UFC/10g",
        impactOfDeviation: "Rechazo microbiológico de lote de exportación.",
      },
    ],
    controlLoopsAndActuators: [],
    applicableStandards: ["ICUMSA International Commission for Uniform Methods of Sugar Analysis", "ISO 17025 Laboratorios de Ensayo"],
    systemModuleMapping: "batches",
    roleSpecificGuidance: {
      operador: "Consulta los resultados de laboratorio para ajustar dosificaciones de floculante y tiempos de purga de tachos.",
      supervisor: "Revisa la evolución de las pérdidas indeterminadas y el balance de masa de sacarosa por turno.",
      analista_calidad: "Ingresa los resultados analíticos directamente a la plataforma con trazabilidad de instrumento y operador.",
      auditor_seguridad: "Verifica que ningún resultado analítico pueda ser sobrescrito o adulterado sin una justificación firmada.",
      administrador: "Analiza el certificado de calidad consolidado para la liberación de lotes comerciales.",
      superadmin: "Configura las tolerancias y métodos analíticos del LIMS según normativas internacionales.",
      mantenimiento: "Programa la calibración metrológica anual de balanzas, refractómetros y termopares del laboratorio.",
      observador: "Visualiza los KPIs de calidad del azúcar producido en tiempo real.",
    },
    perfectionRules: [
      {
        triggerCondition: "Dextrano en jugo mixto superior a 400 ppm",
        recommendedAdjustment: "Notificar al supervisor de patio para adelantar la molienda de frentes antiguos y dosificar enzima dextranasa en clarificación",
        thermodynamicBasis: "El dextrano eleva la viscosidad en tachos en más de 200%, duplicando el tiempo de cocimiento y bloqueando centrífugas.",
        expectedGain: "Preservación del ritmo de cocimiento y recuperación de hasta 0.4% de rendimiento fabril.",
        riskMitigation: "Previene templas gomosas y bloqueo de tamices en refinería.",
      },
    ],
  },

  // ==========================================================================
  // 11. MANTENIMIENTO INDUSTRIAL, CMMS Y CONFIABILIDAD CBM
  // ==========================================================================
  {
    id: "mantenimiento-cmms-confiabilidad",
    name: "Mantenimiento Industrial, CMMS y Monitoreo de Condición (CBM)",
    stageNumber: 11,
    stageCategory: "MANTENIMIENTO_CONFIABILIDAD",
    summary: "Órdenes de trabajo preventivas y correctivas, análisis de vibraciones ISO 10816-3 (zonas A/B/C/D), termografía en tableros, lubricación CBM, cálculo de MTBF, MTTR y disponibilidad OEE.",
    detailedProcessDescription: `El sistema CMMS (Computerized Maintenance Management System) de BioAzúcar 4.0 gobierna el ciclo de vida de los activos críticos:
- Taxonomía de activos bajo jerarquía ISA-95 (Empresa -> Planta -> Área -> Línea de Producción -> Unidad -> Equipo -> Componente).
- Monitoreo basado en condición (CBM): Adquisición de señales de acelerómetros piezoeléctricos montados en cajas de engranajes de molinos, turbinas, bombas de alimentación de calderas y ventiladores de tiro.
- Análisis espectral FFT de vibraciones: Detección temprana de desalineación (2X), desbalanceo dinámico (1X), holguras mecánicas y frecuencias de falla de rodamientos (BPFI, BPFO, BSF, FTF) clasificados según norma ISO 10816-3 en Zonas A (Excelente), B (Aceptable), C (Alerta) y D (Peligro Inminente).
- Termografía infrarroja periódica en centros de control de motores (CCM) y celdas de media tensión.
- Análisis de aceites lubricantes de extrema presión en reductores de molienda (viscosidad cSt a 40°C, índice de acidez TAN, conteo de partículas ISO 4406 y ferrografía analítica).
- Generación automática de órdenes de trabajo (OT) ante anomalías detectadas por IA o superación de umbrales con seguimiento de MTBF (Mean Time Between Failures), MTTR (Mean Time To Repair) y OEE.`,
    keyPhysicsAndChemistry: `Criterios de Severidad ISO 10816-3 (Máquinas Grupo 1 y 2 con soporte rígido):
- Zona A (< 2.8 mm/s RMS): Operación nueva o recién reparada.
- Zona B (2.8 - 4.5 mm/s RMS): Operación normal sin restricción.
- Zona C (4.5 - 7.1 mm/s RMS): Alerta de mantenimiento; monitorear tendencia y programar intervención.
- Zona D (> 7.1 mm/s RMS): Peligro inminente; riesgo de rotura catastrófica de rodamientos o eje.`,
    standardOperatingRanges: [
      {
        parameter: "Vibración RMS en Turbogenerador (ISO 10816)",
        unit: "mm/s",
        nominal: 1.8,
        min: 0.5,
        max: 3.2,
        criticalThreshold: "> 4.5 mm/s (Alarma) / > 7.1 mm/s (Disparo por vibración)",
        impactOfDeviation: "Destrucción de sellos de laberinto, roce de álabes y desastre de turbina de alta velocidad.",
      },
      {
        parameter: "Temperatura en Chumaceras de Molinos",
        unit: "°C",
        nominal: 52.0,
        min: 35.0,
        max: 65.0,
        criticalThreshold: "> 75.0°C",
        impactOfDeviation: "Fundición del metal antifricción (Babbitt) y rayado severo del cuello de la maza.",
      },
      {
        parameter: "Disponibilidad Mecánica de Fábrica (OEE)",
        unit: "%",
        nominal: 92.5,
        min: 88.0,
        max: 97.0,
        criticalThreshold: "< 85.0%",
        impactOfDeviation: "Paradas no programadas que retrasan el calendario de zafra e incrementan el costo fijo por tonelada.",
      },
    ],
    controlLoopsAndActuators: [],
    applicableStandards: ["ISO 10816-3 Severidad de Vibraciones", "ISO 14224 Confiabilidad de Datos de Mantenimiento", "ISO 55000 Gestión de Activos"],
    systemModuleMapping: "equipment",
    roleSpecificGuidance: {
      operador: "Si una alarma de vibración de Molino o Bomba de Caldera pasa a Zona C, reporta al mecánico de turno e inspecciona fugas de lubricante.",
      supervisor: "Coordina paradas programadas de mantenimiento menor durante ventanas de bajo flujo de caña.",
      analista_calidad: "Revisa que los equipos críticos de laboratorio cuenten con sus hojas de vida y calibraciones al día.",
      auditor_seguridad: "Audita los procedimientos de bloqueo y etiquetado (LOTO) en órdenes de trabajo eléctricas y mecánicas.",
      administrador: "Analiza el presupuesto de mantenimiento ejecutado vs planificado y la disponibilidad global de planta.",
      superadmin: "Configura la matriz de criticidad RCM y modelos predictivos RUL (Remaining Useful Life).",
      mantenimiento: "Ejecuta las órdenes de trabajo, registra repuestos utilizados y firma el cierre de cada mantenimiento.",
      observador: "Consulta la lista de órdenes de trabajo abiertas y el estado de salud de los activos.",
    },
    perfectionRules: [
      {
        triggerCondition: "Vibración en Molino 3 superando 5.8 mm/s RMS con incremento térmico en chumacera superior",
        recommendedAdjustment: "Reducir la presión hidráulica en vírgenes en 15 bar y verificar el caudal de la bomba de lubricación forzada",
        thermodynamicBasis: "Aliviar 15 bar reduce la carga radial en 8.2 toneladas, disipando la fricción hidrodinámica mientras se inspecciona el aceite.",
        expectedGain: "Evita la fundición del casquillo de bronce/babbitt y previene una parada forzada de 18 horas.",
        riskMitigation: "Protege la integridad mecánica del reductor planetario y la maza.",
      },
    ],
  },

  // ==========================================================================
  // 12. GOBERNANZA, CIBERSEGURIDAD IEC 62443 E IAM
  // ==========================================================================
  {
    id: "gobernanza-ciberseguridad-iam",
    name: "Gobernanza Industrial, Ciberseguridad IEC 62443 e IAM",
    stageNumber: 12,
    stageCategory: "GOBERNANZA_CIBERSEGURIDAD",
    summary: "Seguridad por diseño según IEC 62443 SL-3, modelo multi-tenant estricto, catálogo de permisos atómicos, cadena de custodia criptográfica con hash SHA-256 inmutable y gestión de sesiones.",
    detailedProcessDescription: `BioAzúcar 4.0 implementa una arquitectura de ciberseguridad industrial alineada con IEC 62443 (niveles SL-2 a SL-4):
- Segmentación de Zonas y Conductos (Purdue / ISA-95): Separación estricta entre Red OT de Planta (L2/L3) y Red Empresarial IT / Nube (L4/L5) mediante gateways perimetrales e inspección profunda de paquetes.
- Identidad y Control de Acceso (IAM): Modelo jerárquico User -> Memberships -> Tenants/Plantas/Áreas -> RoleAssignments -> Roles -> AtomicPermissions. Soporta más de 40 permisos atómicos granulares (setpoint.write, alarm.ack, plant.configure, etc.).
- Cadena de Custodia Criptográfica (Immutable Hash-Chain Audit): Cada cambio de consigna, reconocimiento de alarma o evento administrativo es sellado criptográficamente vinculando el hash del evento anterior ($Hash_{i} = \\text{SHA-256}(Hash_{i-1} + Timestamp + Actor + Action + Payload)$). Cualquier intento de modificación o borrado invalida la cadena entera detectándose manipulación.
- Doble Autorización y Human-In-The-Loop: Las acciones de control crítico (Nivel 3: cambio de setpoint, modificación de despacho PPA) requieren confirmación explícita con notas operativas y verificación estricta de permisos de usuario.`,
    keyPhysicsAndChemistry: `Criptografía y Cadena Inmutable:
$H_n = \\text{HMAC-SHA256}(K_{secret}, H_{n-1} \\parallel \\text{Payload} \\parallel \\text{Timestamp})$
Garantiza no repudio, trazabilidad forense y cumplimiento estricto con auditorías regulatorias industriales.`,
    standardOperatingRanges: [
      {
        parameter: "Integridad de la Cadena de Auditoría",
        unit: "Estado",
        nominal: "VALID",
        min: "VALID",
        max: "VALID",
        criticalThreshold: "TAMPERED / CORRUPTED",
        impactOfDeviation: "Indica intento de vulneración o alteración maliciosa de registros de seguridad.",
      },
      {
        parameter: "Sesiones Concurrentes Activas por Usuario",
        unit: "Sesiones",
        nominal: 1,
        min: 1,
        max: 3,
        criticalThreshold: "> 4 sesiones simultáneas",
        impactOfDeviation: "Posible compromiso de credenciales o uso compartido de cuentas.",
      },
      {
        parameter: "Latencia de Validación RBAC",
        unit: "ms",
        nominal: 2.5,
        min: 0.5,
        max: 8.0,
        criticalThreshold: "> 25 ms",
        impactOfDeviation: "Retardo en la autorización de comandos industriales en sala de control.",
      },
    ],
    controlLoopsAndActuators: [],
    applicableStandards: ["IEC 62443-3-3 SL-3", "NIST SP 800-82 Industrial Control Systems Security", "ISO 27001"],
    systemModuleMapping: "users_roles",
    roleSpecificGuidance: {
      operador: "Utiliza siempre tu usuario individual y credenciales intransferibles. Cada comando que envíes quedará registrado con tu firma en la auditoría inmutable.",
      supervisor: "Verifica que los permisos delegados a operadores de turno correspondan exclusivamente a su área física asignada.",
      analista_calidad: "Comprueba que la validación de certificados de calidad cuente con tu firma digital.",
      auditor_seguridad: "Ejecuta revisiones periódicas de integridad de la cadena hash y revoca inmediatamente sesiones sospechosas o inactivas.",
      administrador: "Administra las políticas de contraseñas, asignación de roles y delimitación de scopes por planta.",
      superadmin: "Gestiona el aislamiento criptográfico entre tenants empresariales y custodia la clave raíz del clúster.",
      mantenimiento: "Verifica que el acceso a consolas remotas de PLC y Edge cumpla con protocolos de doble factor (MFA/WebAuthn).",
      observador: "Visualiza el registro de auditoría en modo de solo lectura.",
    },
    perfectionRules: [
      {
        triggerCondition: "Intento de modificación de consigna crítica sin verificación previa de permisos atómicos",
        recommendedAdjustment: "Bloquear ejecución automática, solicitar elevación de privilegios o confirmación del supervisor de turno",
        thermodynamicBasis: "El estándar IEC 62443 exige el principio de menor privilegio (Least Privilege) para evitar sabotaje o error humano en lazos de alta energía.",
        expectedGain: "100% de protección contra operaciones no autorizadas o accidentales.",
        riskMitigation: "Evita daños a activos físicos y riesgos para la seguridad del personal en planta.",
      },
    ],
  },
];
