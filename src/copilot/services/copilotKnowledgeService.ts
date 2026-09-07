import { NavigationTab, UserRole } from "../../types";
import { BIOAZUCAR_GLOSSARY } from "../data/bioAzucarGlossary";
import { BIOAZUCAR_MODULE_DOCS } from "../data/bioAzucarModuleDocs";
import { BIOAZUCAR_PROCEDURES } from "../data/bioAzucarProcedures";
import { BioAzucarKnowledgeGraph, KNOWLEDGE_GRAPH_NODES, KNOWLEDGE_GRAPH_EDGES } from "../data/bioAzucarKnowledgeGraph";
import { KnowledgeRetrievalService } from "./knowledgeRetrievalService";
import {
  IndustrialGlossaryEntry,
  ModuleDocumentation,
  OperationalProcedure,
  KnowledgeGraphNode,
  TutorialStep,
} from "../domain/CopilotKnowledgeTypes";
import { TUTORIAL_STEPS, CopilotTutorialService } from "./copilotTutorialService";

export interface KnowledgeItem {
  id: string;
  category: "PROCESS" | "EQUIPMENT" | "KPI" | "MODULE" | "ALARM_STANDARD" | "PROCEDURE" | "SECURITY" | "ARCHITECTURE";
  title: string;
  keywords: string[];
  summary: string;
  detailedContent: string;
  relatedModule?: NavigationTab;
  standards?: string[];
}

export const BIOAZUCAR_KNOWLEDGE_BASE: KnowledgeItem[] = [
  // --------------------------------------------------------------------------
  // COPILOT CAPABILITIES & PLATFORM HELP
  // --------------------------------------------------------------------------
  {
    id: "kn-copilot-capabilities",
    category: "MODULE",
    title: "Capacidades de BioAzúcar Copilot",
    keywords: ["copilot", "capacidades", "funciones", "ayuda", "alcance", "que puedes hacer", "asistente", "ai"],
    summary: "Asistente inteligente de ingeniería para BioAzúcar 4.0: consulta de estado en tiempo real, KPIs, alarmas, equipos, data lineage, navegación y acciones con RBAC.",
    detailedContent: `### Capacidades Reales de BioAzúcar Copilot
- **Consultar estado actual de la planta**: Molienda TCH, vapor, energía y OEE en tiempo real.
- **Consultar y analizar KPIs**: TCH, extracción, eficiencia de calderas, potencia generada y exportada.
- **Consultar alarmas y eventos**: Resumen bajo norma ISA-18.2 con prioridades y secuencias de eventos (SOE).
- **Consultar equipos**: Condición técnica, vibración RMS (ISO 10816) y órdenes de trabajo en CMMS.
- **Trazabilidad y Data Lineage**: Muestra el origen exacto, instrumentación de campo y calidad de cada indicador.
- **Navegación autorizada**: Abre pantallas y módulos como SCADA, Historiador, Despacho, LIMS o UNS Hub.
- **Acciones autorizadas**: Modificación segura de setpoints y consignas previa validación RBAC y confirmación explícita.
- **Explicar indicadores y módulos**: Documentación de fórmulas, cálculos y uso de la plataforma.`,
    relatedModule: "dashboard",
  },
  {
    id: "kn-platform-overview",
    category: "MODULE",
    title: "Plataforma BioAzúcar 4.0 Smart Manufacturing",
    keywords: ["sistema", "plataforma", "bioazucar", "como funciona", "arquitectura", "uns", "modulos"],
    summary: "Suite industrial basada en Unified Namespace (UNS) para la transformación digital y optimización en tiempo real de ingenios azucareros.",
    detailedContent: `### Arquitectura de BioAzúcar 4.0
- **Unified Namespace (UNS)**: Arquitectura orientada a eventos con broker MQTT e interfaces OPC-UA y Modbus.
- **Normas Soportadas**: ISA-95 (jerarquía de planta), ISA-18.2 (alarmas), ASME PTC 4 (calderas de biomasa), ISO 22400-2 (OEE canónico) e IEC 62443 (ciberseguridad OT).
- **Módulos**: Dashboard Ejecutivo, Sinóptico SCADA P&ID, Despacho de Energía & PPA, Gestión de Alarmas, Salud de Activos CMMS, Historiador, LIMS de Recepción de Caña y Gemelo Digital 3D.`,
    relatedModule: "dashboard",
  },

  // --------------------------------------------------------------------------
  // PROCESS KNOWLEDGE
  // --------------------------------------------------------------------------
  {
    id: "kn-milling-process",
    category: "PROCESS",
    title: "Proceso de Extracción & Tándem de Molienda",
    keywords: ["molienda", "tandem", "tch", "extraccion", "bagazo", "imbibicion", "pol", "brix", "jugo"],
    summary: "El tándem de molienda extrae el jugo rico en sacarosa de la caña mediante preparación mecánica y prensado secuencial con agua de imbibición compuesta.",
    detailedContent: `### Extracción en Tándem de Molinos
1. **Preparación de Caña**: Los niveladores y picadores (cuchillas rotativas y desfibrador) rompen las celdas de caña logrando un Índice de Preparación (Open Cell) > 88%.
2. **Extracción y Prensado**: La caña pasa por una batería de molinos de 4 o 6 mazas bajo presión hidráulica constante (2,500 - 3,200 psi).
3. **Imbibición Compuesta**: Se inyecta agua caliente (65-75°C) en el penúltimo y último molino a razón de 20-30% sobre el peso de caña, recirculando los jugos pobres en contracorriente para maximizar la lixiviación de sacarosa.
4. **Subproductos**:
   - **Jugo Mixto**: Enviado a tamices DSM y posterior estación de pesaje/clarificación.
   - **Bagazo Final**: Enviado a calderas como biocombustible renovable con humedad objetivo < 50%.`,
    relatedModule: "scada",
    standards: ["ICUMSA", "ISSCT Guidelines"],
  },
  {
    id: "kn-boiler-steam-generation",
    category: "PROCESS",
    title: "Generación de Vapor en Calderas Acuotubulares con Biomasa",
    keywords: ["caldera", "vapor", "hp", "bagazo", "combustion", "presion", "temperatura", "asme", "ptc4", "supercalentador"],
    summary: "Las calderas acuotubulares de biomasa queman bagazo húmedo en parrilla viajera o pinhole para generar vapor sobrecalentado a alta presión (45 - 85 bar) y alta temperatura (450 - 510°C).",
    detailedContent: `### Ciclo Termodinámico de Vapor BioAzúcar 4.0
- **Combustión de Bagazo**: El bagazo ingresa con ~48-50% de humedad. El Poder Calorífico Inferior (PCI) oscila entre 1,750 y 1,950 kcal/kg según la fórmula de Hugot: $PCI = 4250 - 48.5H - 12S$.
- **Control de Exceso de Aire**: Optimizado entre 15% y 25% de exceso ($O_2$ en humos de chimenea entre 3.0% y 4.2%) para garantizar combustión completa sin enfriar el hogar.
- **Vapor Sobrecalentado HP**: Se expande en turbogeneradores de contrapresión y condensación-extracción para generar electricidad y suministrar vapor de escape LP (1.8 - 2.5 bar) a los evaporadores y tachos.
- **Eficiencia ASME PTC 4**: Evaluada por método de pérdidas (pérdidas por humedad en combustible, calor latente en gases de chimenea, inquemados y radiación).`,
    relatedModule: "energy_dispatch",
    standards: ["ASME PTC 4 Fired Steam Generators", "NFPA 85 Boiler and Combustion Hazards Code"],
  },
  {
    id: "kn-cogeneration-power-market",
    category: "PROCESS",
    title: "Cogeneración Eléctrica y Despacho al Sistema Eléctrico Nacional (SEN)",
    keywords: ["cogeneracion", "potencia", "mw", "grid", "red", "despacho", "ppa", "spot", "frecuencia", "subestacion"],
    summary: "Sistema de generación eléctrica sincrónica interconectada que abastece el autoconsumo fabril del ingenio y exporta excedentes de energía limpia a la red de alta tensión (115/138 kV).",
    detailedContent: `### Cogeneración con Turbinas de Vapor
- **Turbinas de Condensación-Extracción**: Permiten modular el flujo de vapor extraído a proceso según la molienda (TCH) y condensar el exceso en un condensador de superficie para maximizar los MW generados.
- **Despacho PPA vs Spot**: Los contratos de compra de energía (PPA) fijan compromisos firmes de potencia horaria con penalizaciones por incumplimiento. El excedente se transa al precio spot horario.
- **Estabilidad de Red**: El turbogenerador opera con estatismo (droop) del 4-5% y regulador automático de tensión (AVR) para mantener el factor de potencia entre 0.92 y 0.98 inductivo.`,
    relatedModule: "energy_dispatch",
    standards: ["IEEE 1547", "IEC 60034 Generators", "Código de Red Eléctrica Nacional"],
  },
  {
    id: "kn-evaporation-crystallization",
    category: "PROCESS",
    title: "Clarificación, Evaporación Cuádruple y Cristalización",
    keywords: ["clarificacion", "evaporador", "meladura", "brix", "tacho", "vacio", "masa cocida", "centrifugas", "azucar"],
    summary: "Purificación del jugo de caña, concentración térmica en evaporadores múltiple efecto y cristalización al vacío para obtener azúcar comercial y melaza agotada.",
    detailedContent: `### Estación de Fabril y Cristalización
1. **Clarificación y Encalado**: Encalado a pH 7.2 - 7.6, calentamiento a 103°C y decantación en clarificadores continuos con floculante para remover no-azúcares y coloides.
2. **Evaporación Múltiple Efecto**: Tren de evaporadores tipo Robert que concentran el jugo claro (14-16 °Bx) hasta meladura (65-68 °Bx) aprovechando en cascada el vapor de escape y los vapores de sangría (V1, V2).
3. **Cristalización en Tachos**: Cocimiento al vacío (-0.85 bar, 65°C) en esquema de 3 templas (A, B, C).
4. **Centrifugación y Secado**: Separación de cristales de sacarosa mediante centrífugas batch y continuas con lavado de agua y vapor, seguido de secado en tambor rotatorio hasta humedad < 0.04%.`,
    relatedModule: "scada",
    standards: ["ICUMSA Sugar Color & Purity Standards"],
  },

  // --------------------------------------------------------------------------
  // KPI DEFINITIONS & FORMULAS
  // --------------------------------------------------------------------------
  {
    id: "kn-kpi-oee-definition",
    category: "KPI",
    title: "Definición y Cálculo del OEE Global (ISO 22400-2)",
    keywords: ["oee", "eficiencia", "disponibilidad", "rendimiento", "calidad", "iso22400", "formula"],
    summary: "El Overall Equipment Effectiveness (OEE) mide la efectividad global de la fábrica integrando Disponibilidad, Rendimiento y Calidad.",
    detailedContent: `### Fórmula y Factores OEE
$$OEE = \\text{Disponibilidad} \\times \\text{Rendimiento} \\times \\text{Calidad}$$

1. **Disponibilidad ($A$)**:
   $$A = \\frac{\\text{Tiempo de Operación Real}}{\\text{Tiempo Planificado de Zafra}} \\times 100\\%$$
   *Afectado por:* Paradas por falta de caña, fallas mecánicas en molinos, disparos de caldera o problemas eléctricos.

2. **Rendimiento ($P$)**:
   $$P = \\frac{\\text{TCH Real}}{\\text{TCH Capacidad Nominal}} \\times 100\\%$$
   *Afectado por:* Reducción de velocidad en molienda, atascamientos de caña o desbalance de vapor.

3. **Calidad ($Q$)**:
   $$Q = \\frac{\\text{Extracción de Sacarosa Real}}{\\text{Extracción Sacarosa Meta (96.5\\%)}} \\times 100\\%$$
   *Afectado por:* Pérdidas de Pol en bagazo, alta humedad de bagazo o arrastres en condensados.`,
    relatedModule: "dashboard",
    standards: ["ISO 22400-2:2014 MES KPIs"],
  },
  {
    id: "kn-kpi-tch-definition",
    category: "KPI",
    title: "Molienda Horaria (TCH) y Extracción de Sacarosa",
    keywords: ["tch", "toneladas", "molienda", "extraccion", "formula", "pol", "are"],
    summary: "Caudal instantáneo de molienda en toneladas de caña por hora (TCH) y porcentaje de sacarosa recuperada en tándem.",
    detailedContent: `### Molienda Horaria & Extracción
- **TCH**: Medido en básculas integradoras de banda transportadora de caña picada antes del Molino 1.
- **Extracción de Sacarosa (%)**:
  $$\\text{Extracción} = \\left(1 - \\frac{\\text{Pol\\% Bagazo} \\times \\text{Fibra\\% Caña}}{\\text{Pol\\% Caña} \\times \\text{Fibra\\% Bagazo}}\\right) \\times 100$$
- **Rango Óptimo**: 400 - 500 TCH nominal con extracción superior al 96.0%.`,
    relatedModule: "dashboard",
  },

  // --------------------------------------------------------------------------
  // MODULE CAPABILITIES & USER HELP
  // --------------------------------------------------------------------------
  {
    id: "kn-module-dashboard",
    category: "MODULE",
    title: "Módulo Dashboard KPI & OEE",
    keywords: ["dashboard", "kpi", "modulo", "resumen", "oee", "produccion"],
    summary: "Panel ejecutivo y de jefatura de turno con métricas críticas en tiempo real, velocímetro de TCH, OEE y balances consolidados.",
    detailedContent: `### Funcionalidades del Dashboard
- **Métricas Primarias**: Molienda (TCH), Extracción (%), Presión Caldera (bar), Generación Eléctrica (MW), OEE Global.
- **Selector de Inquilino / Central**: Permite conmutar entre diferentes plantas azucareras con aislamiento multi-tenant.
- **Linaje de Datos**: Haciendo clic en cualquier tarjeta de KPI o solicitándolo en Copilot se despliega el origen y calidad de cada dato.`,
    relatedModule: "dashboard",
  },
  {
    id: "kn-module-scada",
    category: "MODULE",
    title: "Módulo Sinóptico SCADA / Mímico de Proceso",
    keywords: ["scada", "sinoptico", "mimico", "flujo", "lazos", "pid", "animacion"],
    summary: "Diagrama de flujo de proceso animado con lazos de control PID, transmisores en vivo y estados visuales de molienda, calderas, turbinas y evaporación.",
    detailedContent: `### Capacidades del Módulo SCADA
- **Diagrama P&ID**: Muestra el flujo completo desde recepción de caña hasta ensacado de azúcar y despacho de energía.
- **Monitoreo de Lazos PID**: Lectura en tiempo real de SP, PV y CV en calderas, molinos y tachos.
- **Alertas Visuales**: Los equipos con anomalías o alarmas críticas titilan en rojo o ámbar.`,
    relatedModule: "scada",
  },
  {
    id: "kn-module-energy-dispatch",
    category: "MODULE",
    title: "Módulo Energía & Calderas (ASME PTC 4 / PPA)",
    keywords: ["energia", "cogeneracion", "calderas", "despacho", "ppa", "spot", "asme"],
    summary: "Supervisión termodinámica de calderas acuotubulares, turbinas de vapor y control de despacho de potencia activa a la red.",
    detailedContent: `### Capacidades del Módulo de Energía
- **Balance Térmico ASME PTC 4**: Cálculo en vivo de eficiencia térmica de calderas de biomasa.
- **Gestión de Despacho PPA**: Modificación y consigna de MW exportables (requiere rol de Supervisor, Administrador o Superadmin).
- **Ingresos por Venta Eléctrica**: Proyección financiera en USD/hora basada en precio spot y contratos.`,
    relatedModule: "energy_dispatch",
  },
  {
    id: "kn-module-uns-hub",
    category: "MODULE",
    title: "Módulo UNS Hub & Arquitectura IIoT OT/IT",
    keywords: ["uns", "iiot", "sparkplug", "opcua", "modbus", "mqtt", "topics", "setpoints"],
    summary: "Unified Namespace jerárquico bajo ISA-95 con mensajería MQTT Sparkplug B y visualización de nodos IIoT.",
    detailedContent: `### Unified Namespace (UNS) Hub
- **Jerarquía ISA-95**: \`Enterprise/Site/Area/Line/WorkCenter/Tag\`.
- **Nodos IIoT**: Monitoreo de latencia, tasa de mensajes/seg y estado de gateways OPC-UA, MQTT Broker, Modbus TCP y EROS.
- **Escritura de Setpoints**: Permite inyectar consignas autorizadas a los controladores de planta.`,
    relatedModule: "uns_hub",
  },
  {
    id: "kn-module-alarms",
    category: "MODULE",
    title: "Módulo Centro de Alarmas ISA-18.2 & SOE",
    keywords: ["alarmas", "isa182", "soe", "reconocer", "critica", "alta", "eventos"],
    summary: "Consola de gestión de alarmas según norma ISA-18.2 con secuencia de eventos (SOE) y trazabilidad de causa raíz.",
    detailedContent: `### Centro de Alarmas ISA-18.2
- **Severidades**: CRÍTICA (Disparo o riesgo humano), ALTA (Desviación severa), MEDIA, BAJA (Informativa).
- **Flujo de Vida**: ACTIVA -> RECONOCIDA -> DESPEJADA -> ARCHIVADA.
- **Acciones**: Reconocer (Acknowledge) o Silenciar (Shelve) con registro auditado en Cloud Firestore.`,
    relatedModule: "alarms",
    standards: ["ANSI/ISA-18.2-2016 Management of Alarm Systems"],
  },
  {
    id: "kn-module-equipment",
    category: "MODULE",
    title: "Módulo CBM & CMMS (Mantenimiento Basado en Condición)",
    keywords: ["mantenimiento", "cbm", "cmms", "vibracion", "fft", "ordenes", "ot", "rodamientos"],
    summary: "Diagnóstico predictivo de vibración con análisis espectral FFT y gestión de órdenes de trabajo de mantenimiento.",
    detailedContent: `### Mantenimiento Predictivo & CMMS
- **Espectros de Vibración FFT**: Detección de armónicos 1X (desbalance), 2X (desalineación) y frecuencias de falla de pistas de rodamientos (BPFO, BPFI).
- **Órdenes de Trabajo**: Creación, asignación, ejecución y cierre de OTs preventivas y correctivas.`,
    relatedModule: "equipment",
    standards: ["ISO 10816-3 Vibration Severity"],
  },

  // --------------------------------------------------------------------------
  // STANDARDS & CYBERSECURITY
  // --------------------------------------------------------------------------
  {
    id: "kn-security-iec62443",
    category: "SECURITY",
    title: "Normativa de Ciberseguridad Industrial IEC 62443 & RBAC",
    keywords: ["ciberseguridad", "iec62443", "rbac", "seguridad", "niveles", "clearance", "superadmin"],
    summary: "Matriz de control de acceso basada en roles y niveles de seguridad (SL-1 a SL-4) para proteger la red de control OT.",
    detailedContent: `### Arquitectura de Seguridad IEC 62443 en BioAzúcar
- **Nivel 1 (Operador/Observador)**: Solo lectura de telemetría y variables.
- **Nivel 2 (Operador Certificado)**: Reconocimiento de alarmas operacionales.
- **Nivel 3 (Supervisor de Turno)**: Modificación de consignas de despacho y asignación de OTs.
- **Nivel 4 (Administrador de Planta)**: Modificación de setpoints de proceso, límites de alarma y configuración.
- **Nivel 5 (Super Administrador Global)**: Creación de nuevos ingenios, gestión de usuarios raíz y configuración OT profunda.`,
    relatedModule: "users_roles",
    standards: ["IEC 62443 Industrial Network and System Security"],
  },
  {
    id: "kn-industrial-edge-arch",
    category: "ARCHITECTURE",
    title: "Arquitectura Industrial Edge & OT (IEC 62443 / DMZ)",
    keywords: ["edge", "industrial edge", "dmz", "ot", "conectores", "opc ua", "modbus", "store and forward", "resiliencia"],
    summary: "Arquitectura OT -> Edge -> Industrial DMZ -> Cloud Platform que aísla los PLCs de Internet garantizando resiliencia con Store & Forward.",
    detailedContent: `### BioAzúcar Industrial Edge Node
- **Segmentación de Red**: Dos tarjetas de red (Dual NIC) para aislar la red de control (Nivel 2) de la red corporativa (Nivel 4).
- **Conectores Industriales**:
  * **OPC UA Client (IEC 62541)**: Suscripción a tags determinísticos con seguridad Basic256Sha256.
  * **Modbus TCP Master**: Adquisición de analizadores de potencia y variadores.
  * **EROS DCS Native Adapter**: Conexión al sistema distribuido azucarero.
  * **MQTT Sparkplug B Gateway**: Publicación de telemetría hacia el broker UNS.
- **Store & Forward**: Buffer FIFO local persistente para acumular telemetría sin pérdida durante interrupciones de conectividad.
- **Command Service**: Validador criptográfico y de rangos de ingeniería para telemandos protegidos.`,
    relatedModule: "uns_hub",
    standards: ["IEC 62443-4-2", "NIST SP 800-82"],
  },
  {
    id: "kn-eros-integration",
    category: "ARCHITECTURE",
    title: "Integración de EROS DCS y BioAzúcar 4.0",
    keywords: ["eros", "conectar eros", "integracion eros", "dcs", "molienda", "eros connector", "interfaz eros", "bridge", "pasos conectar"],
    summary: "Arquitectura y procedimiento para conectar e integrar el sistema de control distribuido EROS DCS al nodo Industrial Edge y al Unified Namespace (UNS).",
    detailedContent: `### Integración de EROS DCS con BioAzúcar 4.0
- **¿Qué es EROS?**: Es un Sistema de Control Distribuido (DCS) azucarero especializado en la automatización del tándem de molinos, difusores, clarificación y tachos al vacío.
- **Flujo Arquitectónico Real**:
  \`EROS/DCS\` ➔ \`EROS Connector\` ➔ \`Industrial Edge\` ➔ \`Normalización de Datos\` ➔ \`IndustrialDataPoint\` ➔ \`UNS/MQTT Sparkplug B\` ➔ \`BioAzúcar Platform\` ➔ \`Copilot / SCADA / KPIs\`
- **Interfaces Disponibles en ErosConnector**:
  1. \`OPC_UA_BRIDGE\`: Conexión mediante pasarela OPC UA (IEC 62541) hacia el servidor EROS (Recomendado para producción).
  2. \`DIRECT_TCP\`: Protocolo nativo TCP/IP sobre socket binario (puerto estándar 9000).
  3. \`MODBUS_GATEWAY\`: Mapeo de Holding Registers de EROS a través de gateway Modbus TCP.
  4. \`REST_API\`: Adquisición HTTP/JSON para exportación histórica (modo solo lectura).
- **Parámetros Requeridos**:
  * Host / IP del servidor EROS (ej. \`192.168.15.100\`).
  * Puerto de enlace (ej. \`9000\` o \`4840\`).
  * Interfaz activa (\`OPC_UA_BRIDGE\`, \`DIRECT_TCP\`, \`MODBUS_GATEWAY\` o \`REST_API\`).
  * Credenciales protegidas en Vault (\`vault://secrets/eros-creds\`).
  * Bandera \`readOnlyMode\` (por defecto \`true\` para seguridad física de planta).
- **Aislamiento de Ciberseguridad (IEC 62443)**:
  El Copilot o los modelos de IA **NUNCA** se conectan directamente a EROS ni a ningún PLC de campo. Toda consulta o acción viaja a través de:
  \`Copilot\` ➔ \`Validación RBAC\` ➔ \`Motor de Políticas\` ➔ \`Servicio de Integración Industrial\` ➔ \`Industrial Edge Node\` ➔ \`EROS DCS\`.`,
    relatedModule: "uns_hub",
    standards: ["IEC 62443", "ISA-95 Level 2-3", "ISA-18.2"],
  },
  {
    id: "kn-opcua-integration",
    category: "ARCHITECTURE",
    title: "Conectividad OPC UA (IEC 62541)",
    keywords: ["opc ua", "opcua", "conectar opc", "kepserver", "iec 62541", "suscripciones", "monitored items"],
    summary: "Integración segura cliente-servidor OPC UA con cifrado Basic256Sha256, certificados X.509 y suscripciones determinísticas.",
    detailedContent: `### Conector OPC UA en BioAzúcar Industrial Edge
- **Estándar**: IEC 62541.
- **Endpoint por defecto**: \`opc.tcp://192.168.10.50:4840/BioAzucarServer\`.
- **Modo de Seguridad**: \`SignAndEncrypt\` con política \`Basic256Sha256\` o \`Aes128_Sha256_RsaOaep\`.
- **Autenticación**: Certificados X.509 (\`vault://certs/opcua-edge-client.der\`).
- **Mecanismo de Adquisición**: Suscripción por excepción con deadband y buffer en edge para eliminar sondeo ineficiente.`,
    relatedModule: "uns_hub",
    standards: ["IEC 62541"],
  },
  {
    id: "kn-modbus-integration",
    category: "ARCHITECTURE",
    title: "Conectividad Modbus TCP / RTU",
    keywords: ["modbus", "modbus tcp", "moxa", "holding registers", "conectar modbus", "analizadores"],
    summary: "Adquisición de registros Modbus para analizadores de redes eléctricas, variadores y balanzas con concentradores Moxa.",
    detailedContent: `### Conector Modbus en BioAzúcar Industrial Edge
- **Modo**: Modbus TCP (puerto 502) / Modbus RTU sobre pasarela serial Moxa NPort.
- **Polling Determinístico**: Ciclo configurable de 500 ms a 2000 ms.
- **Mapeo**: Registros de entrada (FC04) y Holding Registers (FC03) convertidos automáticamente a \`IndustrialDataPoint\` con metadatos de calidad.`,
    relatedModule: "uns_hub",
    standards: ["Modbus Application Protocol V1.1b"],
  },
  {
    id: "kn-mqtt-sparkplug-integration",
    category: "ARCHITECTURE",
    title: "Unified Namespace (UNS) y MQTT Sparkplug B",
    keywords: ["mqtt", "sparkplug", "sparkplug b", "uns", "broker", "emqx", "topicos", "payload protobuf"],
    summary: "Transporte de telemetría hacia el Unified Namespace con especificación Sparkplug B sobre broker MQTT empresarial.",
    detailedContent: `### Publicador Sparkplug B en BioAzúcar Industrial Edge
- **Broker**: \`tls://mqtt.bioazucar.internal:8883\` (EMQX Enterprise con TLS v1.3).
- **Estructura de Tópicos**: \`spBv1.0/{GroupId}/{MessageType}/{EdgeNodeId}/[{DeviceId}]\`.
- **Ciclo de Vida**: Gestión automatizada de mensajes NBIRTH, NDATA, NDEATH, DBIRTH, DDATA, DDEATH con secuencia de paquetes bdSeq para detectar pérdida de enlace en tiempo real.`,
    relatedModule: "uns_hub",
    standards: ["Eclipse Sparkplug B 2.2 / 3.0", "ISO/IEC 20922"],
  },
];

export class CopilotKnowledgeService {
  private static instance: CopilotKnowledgeService;

  private constructor() {}

  public static getInstance(): CopilotKnowledgeService {
    if (!CopilotKnowledgeService.instance) {
      CopilotKnowledgeService.instance = new CopilotKnowledgeService();
    }
    return CopilotKnowledgeService.instance;
  }

  public searchKnowledge(query: string, limit = 4): KnowledgeItem[] {
    const cleanQuery = query.toLowerCase().trim();
    if (!cleanQuery) return BIOAZUCAR_KNOWLEDGE_BASE.slice(0, limit);

    const terms = cleanQuery.split(/\s+/).filter((t) => t.length > 2);

    const scored = BIOAZUCAR_KNOWLEDGE_BASE.map((item) => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const summaryLower = item.summary.toLowerCase();
      const contentLower = item.detailedContent.toLowerCase();

      // Exact title match
      if (titleLower.includes(cleanQuery)) score += 50;

      terms.forEach((term) => {
        if (titleLower.includes(term)) score += 15;
        if (item.keywords.some((kw) => kw.includes(term))) score += 10;
        if (summaryLower.includes(term)) score += 5;
        if (contentLower.includes(term)) score += 2;
      });

      return { item, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.item);
  }

  public getByModule(module: NavigationTab): KnowledgeItem[] {
    return BIOAZUCAR_KNOWLEDGE_BASE.filter((k) => k.relatedModule === module);
  }

  public getById(id: string): KnowledgeItem | undefined {
    return BIOAZUCAR_KNOWLEDGE_BASE.find((k) => k.id === id);
  }

  // --- GLOSSARY DELEGATES ---
  public getGlossaryTerm(term: string): IndustrialGlossaryEntry | undefined {
    const clean = term.toLowerCase().trim();
    return BIOAZUCAR_GLOSSARY.find(
      (g) => g.term.toLowerCase() === clean || g.aliases.some((a) => a.toLowerCase() === clean)
    );
  }

  public searchGlossary(query: string, activeModule?: NavigationTab, limit = 3): IndustrialGlossaryEntry[] {
    return KnowledgeRetrievalService.retrieveGlossaryTerms(query, activeModule, limit);
  }

  // --- MODULE DOCS DELEGATES ---
  public getModuleDoc(module: NavigationTab): ModuleDocumentation | undefined {
    return BIOAZUCAR_MODULE_DOCS[module];
  }

  public searchModuleDoc(query: string, currentModule?: NavigationTab): ModuleDocumentation | undefined {
    return KnowledgeRetrievalService.retrieveModuleDocumentation(query, currentModule);
  }

  // --- PROCEDURES DELEGATES ---
  public getProcedure(id: string): OperationalProcedure | undefined {
    return BIOAZUCAR_PROCEDURES.find((p) => p.id === id);
  }

  public searchProcedures(query: string, limit = 2): OperationalProcedure[] {
    return KnowledgeRetrievalService.retrieveProcedures(query, undefined, limit);
  }

  // --- KNOWLEDGE GRAPH DELEGATES ---
  public queryGraphAlarmsForEquipment(equipmentName: string): KnowledgeGraphNode[] {
    return BioAzucarKnowledgeGraph.getAlarmsForEquipment(equipmentName);
  }

  public queryGraphTagsForKpi(kpiId: string): KnowledgeGraphNode[] {
    return BioAzucarKnowledgeGraph.getTagsForKpi(kpiId);
  }

  public queryGraphEquipmentForAlarm(alarmCode: string): KnowledgeGraphNode | undefined {
    return BioAzucarKnowledgeGraph.getEquipmentForAlarm(alarmCode);
  }

  public queryGraphRelated(entityId: string) {
    return BioAzucarKnowledgeGraph.getRelatedEntities(entityId);
  }

  // --- TUTORIAL DELEGATES ---
  public getTutorialStep(stepNumber: number): TutorialStep | undefined {
    return CopilotTutorialService.getStep(stepNumber);
  }

  public getInitialTutorialStep(role: UserRole): TutorialStep {
    return CopilotTutorialService.getInitialStep(role);
  }

  public getNextTutorialStep(currentStep: number): TutorialStep | undefined {
    return CopilotTutorialService.getNextStep(currentStep);
  }
}

export const copilotKnowledgeService = CopilotKnowledgeService.getInstance();
