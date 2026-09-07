import { NavigationTab } from "../../types";
import { CopilotIntent, CopilotUserContext, IntegrationSubIntent } from "./CopilotTypes";

export interface IntentClassificationResult {
  intent: CopilotIntent;
  confidence: number;
  reason: string;
  subIntent?: IntegrationSubIntent;
  integrationProvider?: string;
  industrialEntities?: string[];
  recognizedEntity?: string;
  targetModule?: NavigationTab;
  targetEquipment?: string;
  targetTag?: string;
  targetKpiId?: string;
  proposedValue?: number;
  isAmbiguous?: boolean;
  recommendedTool?: string;
  contextualDisambiguation?: string;
}

export class CopilotIntentClassifier {
  /**
   * Normalizes text removing punctuation, multiple spaces, and diacritics
   */
  public static normalize(text: string): string {
    return (text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents for robust regex matching
      .replace(/[¿?¡!.,;:()\[\]{}"'\-_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Classifies user intent with context-awareness and zero boiler bias
   */
  public static classify(message: string, context?: CopilotUserContext): IntentClassificationResult {
    const raw = (message || "").trim();
    const clean = CopilotIntentClassifier.normalize(raw);
    const activeModule = context?.currentModule || "dashboard";

    if (!clean || clean.length < 2) {
      return {
        intent: "UNKNOWN",
        confidence: 0.1,
        reason: "Mensaje vacío o demasiado corto",
      };
    }

    // ========================================================================
    // 1. CAPABILITIES & SYSTEM HELP (HIGHEST PRIORITY)
    // Questions like "¿Qué puedes hacer?", "¿Quién eres?", "Ayúdame"
    // MUST NEVER be interpreted as boiler, steam, OEE or milling queries!
    // ========================================================================
    const capabilitiesPatterns = [
      /\bque puedes hacer\b/,
      /\bque sabes hacer\b/,
      /\bcuales son tus funciones\b/,
      /\bque funciones tienes\b/,
      /\bque capacidades tienes\b/,
      /\bque tareas puedes\b/,
      /\ben que me puedes ayudar\b/,
      /\ben que me ayudas\b/,
      /\bque puedes analizar\b/,
      /\bque puedes consultar\b/,
      /\bque puedes monitorear\b/,
      /\bpara que sirves\b/,
      /\bque alcance tienes\b/,
      /\bque hace el copilot\b/,
      /\bque hace este asistente\b/,
      /\bque rol cumples\b/,
      /\bcapacidades\b/,
      /\bfeatures\b/,
      /\bque informacion tienes\b/,
      /\bque datos tienes\b/,
    ];

    for (const pattern of capabilitiesPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "CAPABILITIES",
          confidence: 0.99,
          reason: "Consulta directa sobre las capacidades y funciones de BioAzúcar Copilot",
          recommendedTool: "explain_capabilities",
        };
      }
    }

    // 2. HELP / IDENTITY
    const helpPatterns = [
      /\bquien eres\b/,
      /\bquien sos\b/,
      /\bcomo te llamas\b/,
      /\bidentificate\b/,
      /\bpresentate\b/,
      /\bayudame\b/,
      /\bnecesito ayuda\b/,
      /\bayuda\b/,
      /\bhelp\b/,
      /\bsocorro\b/,
      /\bcomo te uso\b/,
      /\bcomo interactuar contigo\b/,
      /\bcomo interactuo contigo\b/,
      /\bcomo usar el copilot\b/,
      /\bguia rapida\b/,
      /\bmanual de usuario\b/,
      /\bcomo empezar\b/,
    ];

    for (const pattern of helpPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "HELP",
          confidence: 0.98,
          reason: "Solicitud de identificación, ayuda general o guía de uso del Copilot",
          recommendedTool: "explain_capabilities",
        };
      }
    }

    // 3. SYSTEM INFORMATION (How BioAzúcar works, platform architecture)
    const systemInfoPatterns = [
      /\bcomo funciona bioazucar\b/,
      /\bque es bioazucar\b/,
      /\bcomo funciona el sistema\b/,
      /\bque es este sistema\b/,
      /\bque modulos componen\b/,
      /\barquitectura del sistema\b/,
      /\barquitectura de bioazucar\b/,
      /\bversion del sistema\b/,
      /\bque plataforma es esta\b/,
      /\bcomo esta estructurado el sistema\b/,
      /\bcomo opera bioazucar\b/,
    ];

    for (const pattern of systemInfoPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "SYSTEM_INFORMATION",
          confidence: 0.97,
          reason: "Consulta sobre la arquitectura, propósito o funcionamiento de la plataforma BioAzúcar 4.0",
          recommendedTool: "get_system_info",
        };
      }
    }

    // 3.1 TUTORIAL / GUIDED TOUR
    const tutorialPatterns = [
      /\bensename bioazucar\b/,
      /\bensenar bioazucar\b/,
      /\btour guiado\b/,
      /\brecorrido guiado\b/,
      /\biniciar tour\b/,
      /\bcomenzar tour\b/,
      /\bmodo tutorial\b/,
      /\btutorial\b/,
      /\bguiame por la plataforma\b/,
      /\bpaso a paso por bioazucar\b/,
      /\bensename a usar\b/,
    ];

    for (const pattern of tutorialPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "TUTORIAL",
          confidence: 0.98,
          reason: "Solicitud de tour guiado u onboarding interactivo por la plataforma",
          recommendedTool: "get_tutorial_step",
        };
      }
    }

    // 3.2 CONTEXTUAL HELP (What can I do here / Explain active module)
    const contextualHelpPatterns = [
      /\bque puedo hacer aqui\b/,
      /\bque se hace en esta pantalla\b/,
      /\bque se hace en este modulo\b/,
      /\bexplicame este modulo\b/,
      /\bexplicame esta pantalla\b/,
      /\bcomo uso esta vista\b/,
      /\bcomo uso esta pantalla\b/,
      /\bayuda en esta pantalla\b/,
      /\bpara que sirve esta pantalla\b/,
      /\bpara que sirve este modulo\b/,
    ];

    for (const pattern of contextualHelpPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "CONTEXTUAL_HELP",
          confidence: 0.97,
          reason: "Solicitud de ayuda contextual sobre la pantalla o módulo actualmente visible",
          recommendedTool: "get_contextual_help",
          targetModule: activeModule,
        };
      }
    }

    // 3.3 GLOSSARY / DICTIONARY QUERY
    const glossaryPatterns = [
      /\bque significa\b/,
      /\bdefinicion de\b/,
      /\bdefinir\b/,
      /\bque es el tch\b/,
      /\bque es tch\b/,
      /\bque es pol\b/,
      /\bque es brix\b/,
      /\bque es are\b/,
      /\bque es oee\b/,
      /\bque es scada\b/,
      /\bque es uns\b/,
      /\bque es opc ua\b/,
      /\bque es modbus\b/,
      /\bque es plc\b/,
      /\bque es rtu\b/,
      /\bque es dcs\b/,
      /\bque es bagazo\b/,
      /\bque es cachaza\b/,
      /\bque es meladura\b/,
      /\bque es masa cocida\b/,
      /\bque es soe\b/,
      /\bque es cbm\b/,
      /\bque es cmms\b/,
      /\bque es lims\b/,
      /\bque es ppa\b/,
      /\bque es fft\b/,
      /\bque es eros\b/,
      /\bque es el eros\b/,
      /\bque significa eros\b/,
      /\bque es industrial edge\b/,
      /\bglosario\b/,
      /\bdiccionario industrial\b/,
    ];

    for (const pattern of glossaryPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "GLOSSARY_QUERY",
          confidence: 0.96,
          reason: "Consulta de término, acrónimo o concepto en el glosario industrial",
          recommendedTool: "search_glossary",
        };
      }
    }

    // 3.4 OPERATIONAL PROCEDURE (SOP) QUERY
    const procedurePatterns = [
      /\bcomo cambio la consigna\b/,
      /\bcomo cambiar la consigna\b/,
      /\bcomo cambiar consigna\b/,
      /\bprocedimiento para\b/,
      /\bpaso a paso para\b/,
      /\bprotocolo para\b/,
      /\bcomo reconocer una alarma\b/,
      /\bcomo reconocer alarma\b/,
      /\bcomo registrar un lote\b/,
      /\bcomo registrar lote\b/,
      /\bcomo diagnosticar vibracion\b/,
      /\bcomo conmutar a edge\b/,
      /\bcomo conmutar al edge\b/,
      /\bsop\b/,
    ];

    for (const pattern of procedurePatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "PROCEDURE_QUERY",
          confidence: 0.96,
          reason: "Consulta de procedimiento operativo estándar (SOP) paso a paso",
          recommendedTool: "get_procedure",
        };
      }
    }

    // 3.5 KNOWLEDGE GRAPH QUERY
    const graphPatterns = [
      /\bque alarmas estan vinculadas\b/,
      /\bque alarmas tiene el molino\b/,
      /\bque tags alimentan el kpi\b/,
      /\bque tags alimentan\b/,
      /\brelaciones del equipo\b/,
      /\bgrafo de conocimiento\b/,
    ];

    for (const pattern of graphPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "KNOWLEDGE_GRAPH_QUERY",
          confidence: 0.95,
          reason: "Consulta relacional de entidades en el grafo de conocimiento industrial",
          recommendedTool: "query_knowledge_graph",
        };
      }
    }

    // ========================================================================
    // 3.6 INDUSTRIAL INTEGRATION & OT CONNECTIVITY (EROS, OPC UA, MODBUS, MQTT, SPARKPLUG, PLC, DCS, RTU, EDGE, UNS)
    // ========================================================================

    // Recognize industrial entities
    const detectedIndustrialEntities: string[] = [];
    if (/\beros\b/.test(clean)) detectedIndustrialEntities.push("EROS");
    if (/\b(opc ua|opcua|iec 62541)\b/.test(clean)) detectedIndustrialEntities.push("OPC UA");
    if (/\bmodbus\b/.test(clean)) detectedIndustrialEntities.push("Modbus");
    if (/\bmqtt\b/.test(clean)) detectedIndustrialEntities.push("MQTT");
    if (/\b(sparkplug|sparkplug b)\b/.test(clean)) detectedIndustrialEntities.push("Sparkplug B");
    if (/\brest\b/.test(clean)) detectedIndustrialEntities.push("REST");
    if (/\b(industrial edge|nodo edge|edge)\b/.test(clean)) detectedIndustrialEntities.push("Industrial Edge");
    if (/\buns\b|\bunified namespace\b/.test(clean)) detectedIndustrialEntities.push("UNS");
    if (/\bplc\b|\bautomata\b/.test(clean)) detectedIndustrialEntities.push("PLC");
    if (/\bdcs\b/.test(clean)) detectedIndustrialEntities.push("DCS");
    if (/\brtu\b/.test(clean)) detectedIndustrialEntities.push("RTU");
    if (/\bscada\b/.test(clean)) detectedIndustrialEntities.push("SCADA");
    if (/\bhistoriador\b|\bhistorian\b/.test(clean)) detectedIndustrialEntities.push("Historian");
    if (/\bgateway\b|\bpasarela\b/.test(clean)) detectedIndustrialEntities.push("Gateway");
    if (/\bbroker\b/.test(clean)) detectedIndustrialEntities.push("Broker");

    // 3.6.1 CONNECTIVITY DIAGNOSTICS ("¿Está conectado EROS?", "¿Por qué está desconectado?", "¿Por qué no llegan datos?", etc.)
    const connectivityDiagPatterns = [
      /\besta conectado (el )?eros\b/,
      /\besta conectado eros ahora\b/,
      /\besta conectado (el )?opc\b/,
      /\besta conectado opcua\b/,
      /\besta conectado (el )?modbus\b/,
      /\besta conectado (el )?mqtt\b/,
      /\besta conectado el sistema\b/,
      /\besta conectado el edge\b/,
      /\besta conectado el dcs\b/,
      /\bpor que eros esta desconectado\b/,
      /\bpor que esta desconectado eros\b/,
      /\bpor que opc ua esta desconectado\b/,
      /\bpor que modbus esta desconectado\b/,
      /\bno recibo datos de eros\b/,
      /\bno llegan datos de eros\b/,
      /\bno recibo datos\b/,
      /\bpor que no llegan datos\b/,
      /\bpor que no recibo datos\b/,
      /\bcomo compruebo la conexion\b/,
      /\bcomo verifico la conexion\b/,
      /\bcomo verificar la conexion\b/,
      /\bverificar conexion con eros\b/,
      /\bcomo verifico la conexion con eros\b/,
      /\bestado de la conexion con eros\b/,
      /\bestado de conexion\b/,
      /\bestado de conectividad\b/,
      /\bdiagnostico de conectividad\b/,
      /\bdiagnostico ot\b/,
      /\blatencia de enlaces\b/,
      /\blatencia ot\b/,
      /\bdiagnostico de paquetes\b/,
      /\bping en edge\b/,
      /\bestado de integracion\b/,
      /\bestado de los conectores\b/,
      /\bestado de enlaces\b/,
      /\benlaces industriales\b/,
      /\bdiagnostico de enlaces\b/,
    ];

    for (const pattern of connectivityDiagPatterns) {
      if (pattern.test(clean) && !clean.includes("eros esta en linea")) {
        const prov = clean.includes("eros") ? "eros" : clean.includes("opc") ? "opcua" : clean.includes("modbus") ? "modbus" : clean.includes("mqtt") ? "mqtt" : "all";
        return {
          intent: "INTEGRATION",
          subIntent: "CONNECTIVITY_DIAGNOSTIC",
          confidence: 0.98,
          reason: "Consulta o diagnóstico de conectividad, enlaces o recepción de datos industriales",
          integrationProvider: prov,
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 3.6.2 EROS INTEGRATION (Architecture, how to connect, configuration, requirements, mappings, graph questions)
    const erosIntegrationPatterns = [
      /\bcomo conecto el sistema a eros\b/,
      /\bcomo conecto bioazucar a eros\b/,
      /\bcomo conecto eros con bioazucar\b/,
      /\bcomo conecto eros\b/,
      /\bcomo conectar eros\b/,
      /\bcomo conectar el sistema a eros\b/,
      /\bcomo conectar bioazucar a eros\b/,
      /\bcomo conecto al eros\b/,
      /\bcomo integro eros\b/,
      /\bcomo integrar eros\b/,
      /\bcomo configuro eros\b/,
      /\bcomo configurar eros\b/,
      /\bcomo configuro el eros connector\b/,
      /\bcomo configurar el eros connector\b/,
      /\bque necesito para conectar eros\b/,
      /\bque se necesita para conectar eros\b/,
      /\brequisitos para conectar eros\b/,
      /\bque protocolo usa eros\b/,
      /\bque protocolo utiliza eros\b/,
      /\bprotocolo de eros\b/,
      /\bcomo hago la comunicacion con eros\b/,
      /\bcomunicacion con eros\b/,
      /\bcomo leo datos del eros\b/,
      /\bcomo leer datos del eros\b/,
      /\bcomo leo datos de eros\b/,
      /\bcomo llevar los datos del eros al uns\b/,
      /\bcomo llevar datos del eros al uns\b/,
      /\bcomo llevar datos de eros al uns\b/,
      /\bcomo conectar el central\b/,
      /\bcomo conectar el dcs\b/,
      /\bcomo conectar el sistema al control de planta\b/,
      /\bcomo conectar control de planta\b/,
      /\bintegracion con eros\b/,
      /\bintegracion eros\b/,
      /\bconector eros\b/,
      /\beros connector\b/,
      /\barquitectura eros\b/,
      /\bque kpis dependen de datos provenientes de eros\b/,
      /\bque kpis dependen de eros\b/,
      /\bque tags vienen de eros\b/,
      /\bque variables vienen de eros\b/,
      /\bque equipos estan asociados a eros\b/,
      /\bque equipos dependen de eros\b/,
      /\bque datos dejarian de estar disponibles si eros se desconecta\b/,
      /\bque pasa si eros se desconecta\b/,
      /\bque protocolo esta utilizando actualmente\b/,
      /\bque protocolo esta usando eros\b/,
      /\beros esta en linea\b/,
      /\beros en linea\b/,
      /\bdatos vienen de eros\b/,
      /\bparametros para conectar eros\b/,
      /\bintegrar dcs eros\b/,
      /\bconectar dcs eros\b/,
      /\bconfiguracion de eros\b/,
      /\bconector eros dcs\b/,
      /\bvincular tandem de molienda con eros\b/,
      /\binterfaz opc_ua_bridge para eros\b/,
      /\binterfaz opc ua bridge para eros\b/,
    ];

    for (const pattern of erosIntegrationPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          subIntent: "EROS_INTEGRATION",
          confidence: 0.99,
          reason: "Consulta sobre arquitectura, configuración, requerimientos o integración con el sistema EROS DCS",
          integrationProvider: "eros",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 3.6.3 OPC UA INTEGRATION
    const isOpcUaQuery =
      clean.includes("opc ua") ||
      clean.includes("opcua") ||
      clean.includes("kepserver") ||
      clean.includes("62541") ||
      clean.includes("conectar opc");

    if (isOpcUaQuery) {
      return {
        intent: "INTEGRATION",
        subIntent: "OPC_UA_INTEGRATION",
        confidence: 0.98,
        reason: "Consulta sobre integración o conectividad mediante estándar OPC UA (IEC 62541)",
        integrationProvider: "opcua",
        industrialEntities: detectedIndustrialEntities,
        targetModule: "uns_hub",
        recommendedTool: "get_integration_status",
      };
    }

    // 3.6.4 MODBUS INTEGRATION
    const isModbusQuery =
      clean.includes("modbus") ||
      clean.includes("moxa") ||
      clean.includes("holding register") ||
      clean.includes("conectar analizadores") ||
      clean.includes("puerto 502");

    if (isModbusQuery) {
      return {
        intent: "INTEGRATION",
        subIntent: "MODBUS_INTEGRATION",
        confidence: 0.98,
        reason: "Consulta sobre integración o conectividad mediante protocolo industrial Modbus TCP/RTU",
        integrationProvider: "modbus",
        industrialEntities: detectedIndustrialEntities,
        targetModule: "uns_hub",
        recommendedTool: "get_integration_status",
      };
    }

    // 3.6.5 MQTT & SPARKPLUG INTEGRATION
    const isSparkplugQuery =
      clean.includes("sparkplug") ||
      clean.includes("spbv1") ||
      clean.includes("metricas sparkplug");

    if (isSparkplugQuery) {
      return {
        intent: "INTEGRATION",
        subIntent: "SPARKPLUG_INTEGRATION",
        confidence: 0.98,
        reason: "Consulta sobre especificación MQTT Sparkplug B",
        integrationProvider: "sparkplug",
        industrialEntities: detectedIndustrialEntities,
        targetModule: "uns_hub",
        recommendedTool: "get_integration_status",
      };
    }

    const isMqttQuery =
      clean.includes("mqtt") ||
      clean.includes("emqx") ||
      clean.includes("broker uns") ||
      clean.includes("conectar broker");

    if (isMqttQuery) {
      return {
        intent: "INTEGRATION",
        subIntent: "MQTT_INTEGRATION",
        confidence: 0.98,
        reason: "Consulta sobre integración o publicación mediante broker MQTT",
        integrationProvider: "mqtt",
        industrialEntities: detectedIndustrialEntities,
        targetModule: "uns_hub",
        recommendedTool: "get_integration_status",
      };
    }

    // 3.6.6 PLC & DCS & RTU INTEGRATION
    const plcPatterns = [
      /\bcomo conecto un plc\b/,
      /\bcomo conectar un plc\b/,
      /\bcomo conecto el plc\b/,
      /\bconectar plc\b/,
      /\bintegrar plc\b/,
      /\bconectar automata\b/,
      /\bconectar siemens\b/,
      /\bconectar rockwell\b/,
    ];

    for (const pattern of plcPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          subIntent: "PLC_INTEGRATION",
          confidence: 0.98,
          reason: "Consulta sobre integración de controladores PLC a la arquitectura BioAzúcar",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    const rtuPatterns = [
      /\bcomo conecto rtu\b/,
      /\bcomo conectar rtu\b/,
      /\bintegrar rtu\b/,
      /\bconectar terminal remota\b/,
    ];

    for (const pattern of rtuPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          subIntent: "RTU_INTEGRATION",
          confidence: 0.98,
          reason: "Consulta sobre integración de unidades terminales remotas (RTU)",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 3.6.7 REST INTEGRATION
    const restPatterns = [
      /\bcomo conecto rest\b/,
      /\bcomo conectar rest\b/,
      /\bintegracion rest\b/,
      /\bapi rest industrial\b/,
      /\bconectar api rest\b/,
    ];

    for (const pattern of restPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          subIntent: "REST_INTEGRATION",
          confidence: 0.98,
          reason: "Consulta sobre integración mediante APIs REST industriales",
          integrationProvider: "rest",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 3.6.8 INDUSTRIAL EDGE & UNS DATA INGESTION
    const edgePatterns = [
      /\bcomo funciona el edge\b/,
      /\bque es el edge industrial\b/,
      /\bcomo llegan los datos al uns\b/,
      /\bcomo llegan datos al uns\b/,
      /\bflujo de datos hacia el uns\b/,
      /\bcomo funciona industrial edge\b/,
      /\bstore and forward\b/,
      /\bindustrial edge node\b/,
      /\bestado del industrial edge\b/,
      /\bnodo edge\b/,
      /\bnodo edge industrial\b/,
      /\bindustrial edge\b/,
    ];

    for (const pattern of edgePatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          subIntent: "INDUSTRIAL_EDGE",
          confidence: 0.98,
          reason: "Consulta sobre arquitectura Industrial Edge, Store & Forward y normalización de datos hacia el UNS",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 3.6.9 GENERAL PROTOCOL QUERY ("¿Qué protocolo puedo utilizar?", "¿Qué protocolos soporta?")
    const generalProtocolPatterns = [
      /\bque protocolo puedo utilizar\b/,
      /\bque protocolos puedo utilizar\b/,
      /\bque protocolo puedo usar\b/,
      /\bque protocolos soporta\b/,
      /\bque protocolos estan disponibles\b/,
      /\bque protocolos industriales\b/,
      /\bcuales son los protocolos de integracion\b/,
    ];

    for (const pattern of generalProtocolPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "INTEGRATION",
          confidence: 0.97,
          reason: "Consulta sobre protocolos industriales y conectividad soportada en BioAzúcar 4.0",
          industrialEntities: detectedIndustrialEntities,
          targetModule: "uns_hub",
          recommendedTool: "get_integration_status",
        };
      }
    }

    // 4. USER PERMISSIONS & RBAC
    const permissionsPatterns = [
      /\bque permisos tengo\b/,
      /\bmis permisos\b/,
      /\bcual es mi rol\b/,
      /\bmi rol\b/,
      /\bpuedo cambiar setpoints?\b/,
      /\bpuedo modificar setpoints?\b/,
      /\bpuedo reconocer alarmas?\b/,
      /\btengo permisos?\b/,
      /\btengo autorizacion\b/,
      /\bestoy autorizado\b/,
      /\bque puedo hacer yo\b/,
      /\bmi nivel de seguridad\b/,
      /\bnivel de seguridad iec\b/,
      /\bacceso rbac\b/,
    ];

    for (const pattern of permissionsPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "USER_PERMISSIONS",
          confidence: 0.96,
          reason: "Consulta de perfil, roles, credenciales y permisos RBAC del usuario",
          recommendedTool: "get_user_permissions",
        };
      }
    }

    // 5. CONFIGURATION
    const configPatterns = [
      /\bconfiguracion del sistema\b/,
      /\bconfigurar broker\b/,
      /\bconfigurar uns\b/,
      /\bconfigurar mqtt\b/,
      /\bconfigurar opc\b/,
      /\bparametros de planta\b/,
      /\bajustes de red\b/,
      /\bgestionar tenants\b/,
      /\bconfiguracion de planta\b/,
    ];

    for (const pattern of configPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "CONFIGURATION",
          confidence: 0.92,
          reason: "Consulta o ajuste de configuración técnica o de parámetros",
          recommendedTool: "navigate_to",
          targetModule: "uns_hub",
        };
      }
    }

    // 6. ACTION (Critical or Level 2/3 operations)
    // e.g. "cambia el setpoint a 480", "ajustar consigna", "reconocer alarma", "ack"
    const actionChangeSetpoint = /\b(cambia|cambiar|ajustar|modificar|subir|bajar|setear)\b.*\b(setpoint|consigna|meta)\b/;
    const actionAcknowledgeAlarm = /\b(reconocer|ack|silenciar|aceptar)\b.*\b(alarma|alerta)\b/;
    const actionDispatch = /\b(cambia|cambiar|ajustar|modificar)\b.*\b(despacho|exportacion|mw|ppa)\b/;

    if (actionChangeSetpoint.test(clean) || /\bcambia el setpoint\b/.test(clean)) {
      // Extract proposed value if present
      const matchNum = clean.match(/(\d+(?:\.\d+)?)/);
      const proposedValue = matchNum ? parseFloat(matchNum[1]) : undefined;
      return {
        intent: "ACTION",
        confidence: 0.95,
        reason: "Solicitud de modificación de setpoint en lazo de control industrial",
        proposedValue,
        recommendedTool: "request_setpoint_change",
      };
    }

    if (actionAcknowledgeAlarm.test(clean)) {
      return {
        intent: "ACTION",
        confidence: 0.95,
        reason: "Solicitud de reconocimiento de alarma operativa bajo ISA-18.2",
        recommendedTool: "request_acknowledge_alarm",
      };
    }

    if (actionDispatch.test(clean)) {
      const matchNum = clean.match(/(\d+(?:\.\d+)?)/);
      const proposedValue = matchNum ? parseFloat(matchNum[1]) : undefined;
      return {
        intent: "ACTION",
        confidence: 0.94,
        reason: "Solicitud de modificación de consigna de despacho eléctrico a la red",
        proposedValue,
        recommendedTool: "request_dispatch_change",
      };
    }

    // 7. NAVIGATION
    // e.g. "llévame a cogeneración", "abre molienda", "muéstrame las alarmas", "quiero ver el balance energético"
    const navigationPrefixes = [
      /\b(llevame a|ir a|abre|abrir|mostrar|muestrame|quiero ver|ver pantalla|navegar a|dirigeme a)\b/,
    ];

    const hasNavPrefix = navigationPrefixes.some((p) => p.test(clean));

    if (hasNavPrefix) {
      let targetModule: NavigationTab | undefined;

      if (clean.includes("cogeneracion") || clean.includes("despacho") || clean.includes("energia") || clean.includes("balance energetico")) {
        targetModule = "energy_dispatch";
      } else if (clean.includes("molienda") || clean.includes("scada") || clean.includes("sinoptico") || clean.includes("mimico")) {
        targetModule = "scada";
      } else if (clean.includes("alarma") || clean.includes("alerta") || clean.includes("eventos")) {
        targetModule = "alarms";
      } else if (clean.includes("equipo") || clean.includes("mantenimiento") || clean.includes("cmms")) {
        targetModule = "equipment";
      } else if (clean.includes("3d") || clean.includes("gemelo digital") || clean.includes("digital twin")) {
        targetModule = "digital_twin";
      } else if (clean.includes("lote") || clean.includes("recepcion") || clean.includes("cana") || clean.includes("lims")) {
        targetModule = "batches";
      } else if (clean.includes("uns") || clean.includes("mqtt") || clean.includes("broker") || clean.includes("iiot")) {
        targetModule = "uns_hub";
      } else if (clean.includes("historiador") || clean.includes("historian") || clean.includes("tendencias")) {
        targetModule = "historian";
      } else if (clean.includes("usuario") || clean.includes("roles") || clean.includes("rbac")) {
        targetModule = "users_roles";
      } else if (clean.includes("empresa") || clean.includes("tenant") || clean.includes("ingenios")) {
        targetModule = "enterprises";
      } else if (clean.includes("dashboard") || clean.includes("inicio") || clean.includes("principal")) {
        targetModule = "dashboard";
      }

      if (targetModule) {
        return {
          intent: "NAVIGATION",
          confidence: 0.96,
          reason: `Solicitud explícita de navegación al módulo ${targetModule.toUpperCase()}`,
          targetModule,
          recommendedTool: "navigate_to",
        };
      }
    }

    // 8. DATA LINEAGE
    // e.g. "¿De dónde viene este KPI?", "¿De dónde sale el TCH?", "origen del dato", "trazabilidad"
    const lineagePatterns = [
      /\bde donde viene\b/,
      /\bde donde sale\b/,
      /\borigen del dato\b/,
      /\bfuente del dato\b/,
      /\blinaje\b/,
      /\blineage\b/,
      /\btrazabilidad\b/,
      /\bque sensores miden\b/,
      /\bcomo se calcula este kpi\b/,
      /\bformula y calculo\b/,
      /\bcalidad del dato\b/,
    ];

    for (const pattern of lineagePatterns) {
      if (pattern.test(clean)) {
        let targetKpiId = "kpi-tch";
        if (clean.includes("oee")) targetKpiId = "kpi-oee-overall";
        else if (clean.includes("vapor") || clean.includes("caldera") || clean.includes("presion")) targetKpiId = "kpi-steam-hp";
        else if (clean.includes("mw") || clean.includes("despacho") || clean.includes("energia")) targetKpiId = "kpi-power-export";
        else if (clean.includes("extraccion") || clean.includes("sacarosa")) targetKpiId = "kpi-milling-extraction";

        return {
          intent: "DATA_LINEAGE",
          confidence: 0.95,
          reason: "Consulta de linaje de datos, instrumentación de campo y trazabilidad de cálculo",
          targetKpiId,
          recommendedTool: "get_data_lineage",
        };
      }
    }

    // 9. ALARMS
    // e.g. "¿Cuáles son las alarmas activas?", "qué alarmas hay"
    const alarmPatterns = [
      /\bcuales son las alarmas activas\b/,
      /\bque alarmas hay\b/,
      /\balarmas activas\b/,
      /\balarmas pendientes\b/,
      /\balertas criticas\b/,
      /\bdisparos de caldera\b/,
      /\beventos isa 18\b/,
      /\bsoe\b/,
    ];

    for (const pattern of alarmPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "ALARM",
          confidence: 0.96,
          reason: "Consulta de alarmas activas y eventos según norma ISA-18.2",
          recommendedTool: "get_active_alarms",
        };
      }
    }

    // 10. EQUIPMENT & CONDITION
    // e.g. "Molino 3", "Caldera 1", "Turbina", "vibración RMS", "salud de equipos"
    const equipmentPatterns = [
      /\bmolino\s*([1-6])?\b/,
      /\bcaldera\s*([1-3])?\b/,
      /\bturbogenerador\b/,
      /\bturbina\b/,
      /\bbomba\b/,
      /\bpicador\b/,
      /\bdesfibrador\b/,
      /\bvibracion\b/,
      /\bcmms\b/,
      /\borden de trabajo\b/,
      /\bestado del equipo\b/,
      /\bsalud del equipo\b/,
    ];

    for (const pattern of equipmentPatterns) {
      if (pattern.test(clean)) {
        let targetEquipment = "Molino 3";
        if (clean.includes("caldera")) targetEquipment = "Caldera 1";
        else if (clean.includes("turbo") || clean.includes("generador")) targetEquipment = "Turbogenerador";
        else if (clean.includes("molino 1")) targetEquipment = "Molino 1";
        else if (clean.includes("molino 2")) targetEquipment = "Molino 2";
        else if (clean.includes("molino 3")) targetEquipment = "Molino 3";

        return {
          intent: "EQUIPMENT",
          confidence: 0.93,
          reason: `Consulta de condición técnica y salud predictiva CBM de equipo (${targetEquipment})`,
          targetEquipment,
          recommendedTool: "get_equipment",
        };
      }
    }

    // 11. STATISTICS & TRENDS
    const statsPatterns = [
      /\bestadisticas\b/,
      /\btendencia\b/,
      /\bgrafico\b/,
      /\bhistorico\b/,
      /\bpromedio\b/,
      /\bdesviacion estandar\b/,
      /\bmaximos y minimos\b/,
      /\bcomportamiento temporal\b/,
    ];

    for (const pattern of statsPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "STATISTICS",
          confidence: 0.91,
          reason: "Consulta estadística y series de tiempo de variables operacionales",
          recommendedTool: "show_chart",
        };
      }
    }

    // 12. DIAGNOSTIC & ROOT CAUSE
    const diagnosticPatterns = [
      /\bpor que bajo\b/,
      /\bpor que cayo\b/,
      /\bcausa raiz\b/,
      /\banalisis de falla\b/,
      /\bdiagnostico\b/,
      /\bque causo la parada\b/,
      /\banomalia\b/,
    ];

    for (const pattern of diagnosticPatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "DIAGNOSTIC",
          confidence: 0.90,
          reason: "Diagnóstico causal de desviaciones o paradas en planta",
          recommendedTool: "get_active_alarms",
        };
      }
    }

    // 13. KPI ANALYSIS (Specific KPI requested)
    const kpiPatterns = [
      /\bqual es el tch\b/,
      /\bcual es el tch\b/,
      /\btch actual\b/,
      /\bextraccion de sacarosa\b/,
      /\boee actual\b/,
      /\bcual es el oee\b/,
      /\bcomo esta el oee\b/,
      /\beficiencia global\b/,
      /\bpol en cana\b/,
      /\bbrix del jugo\b/,
      /\bhumedad de bagazo\b/,
      /\bpresion de caldera\b/,
      /\btemperatura de vapor\b/,
      /\bmw exportados\b/,
    ];

    for (const pattern of kpiPatterns) {
      if (pattern.test(clean)) {
        let recommendedTool = "get_current_process_state";
        let targetKpiId = "kpi-tch";

        if (clean.includes("oee") || clean.includes("eficiencia")) {
          recommendedTool = "calculate_oee";
          targetKpiId = "kpi-oee-overall";
        } else if (clean.includes("vapor") || clean.includes("caldera") || clean.includes("mw") || clean.includes("energia")) {
          recommendedTool = "calculate_energy_balance";
          targetKpiId = "kpi-steam-hp";
        }

        return {
          intent: "KPI_ANALYSIS",
          confidence: 0.94,
          reason: "Análisis y consulta de valor actual de indicador clave (KPI)",
          targetKpiId,
          recommendedTool,
        };
      }
    }

    // 14. CONTEXTUAL DISAMBIGUATION FOR AMBIGUOUS QUESTIONS:
    // Examples:
    // - "¿Cómo está funcionando?"
    // - "¿Qué está pasando?"
    // - "¿Cómo estamos?"
    // - "¿Cómo está la planta?"
    const ambiguousStateQuestions = [
      /\bcomo esta la planta\b/,
      /\bestado de la planta\b/,
      /\bestado del central\b/,
      /\bcomo estamos\b/,
      /\bcomo esta funcionando\b/,
      /\bcomo va todo\b/,
      /\bque esta pasando\b/,
      /\bque pasa en planta\b/,
      /\bresumen operativo\b/,
      /\bproduccion actual\b/,
      /\bcomo va la operacion\b/,
    ];

    const isAmbiguousState = ambiguousStateQuestions.some((p) => p.test(clean));

    if (isAmbiguousState) {
      // Apply active module context:
      if (activeModule === "energy_dispatch") {
        return {
          intent: "PROCESS_STATE",
          confidence: 0.90,
          reason: "Pregunta sobre estado en módulo de Cogeneración/Despacho (desambiguada hacia balance de vapor y MW)",
          targetModule: "energy_dispatch",
          recommendedTool: "calculate_energy_balance",
          contextualDisambiguation: "Interpretado en el contexto de Cogeneración y Despacho Energético",
        };
      } else if (activeModule === "alarms") {
        return {
          intent: "ALARM",
          confidence: 0.92,
          reason: "Pregunta sobre estado en módulo de Alarmas (desambiguada hacia eventos ISA-18.2)",
          targetModule: "alarms",
          recommendedTool: "get_active_alarms",
          contextualDisambiguation: "Interpretado en el contexto de Alarmas y Secuencia de Eventos (SOE)",
        };
      } else if (activeModule === "equipment") {
        return {
          intent: "EQUIPMENT",
          confidence: 0.90,
          reason: "Pregunta sobre estado en módulo de Equipos/CMMS (desambiguada hacia salud de activos)",
          targetModule: "equipment",
          recommendedTool: "get_equipment",
          targetEquipment: "Molino 3",
          contextualDisambiguation: "Interpretado en el contexto de Mantenimiento y Condición de Equipos",
        };
      } else if (activeModule === "scada") {
        return {
          intent: "PROCESS_STATE",
          confidence: 0.92,
          reason: "Pregunta sobre estado en SCADA (desambiguada hacia molienda TCH y extracción)",
          targetModule: "scada",
          recommendedTool: "get_current_process_state",
          contextualDisambiguation: "Interpretado en el contexto de SCADA y Tándem de Molienda",
        };
      }

      // Default to general process state
      return {
        intent: "PROCESS_STATE",
        confidence: 0.88,
        reason: "Consulta del estado operativo global de la planta",
        recommendedTool: "get_current_process_state",
      };
    }

    // 15. GENERAL DOMAIN KNOWLEDGE (Theoretical questions)
    // e.g. "¿Qué es el bagazo?", "¿Cómo se calcula el PCI?", "¿Qué es la norma ASME PTC 4?"
    const generalKnowledgePatterns = [
      /\bque es el bagazo\b/,
      /\bque es bagazo\b/,
      /\bque es la imbibicion\b/,
      /\bcomo se calcula el pci\b/,
      /\bque es la formula de hugot\b/,
      /\bque es la norma asme\b/,
      /\bque es isa 18\b/,
      /\bque es iec 62443\b/,
      /\bque es iso 22400\b/,
      /\bque significa icumsa\b/,
    ];

    for (const pattern of generalKnowledgePatterns) {
      if (pattern.test(clean)) {
        return {
          intent: "GENERAL_QUESTION",
          confidence: 0.93,
          reason: "Pregunta conceptual sobre fundamentos de ingeniería azucarera o normas técnicas",
          recommendedTool: "search_system_knowledge",
        };
      }
    }

    // 16. Fallback checks for process terms
    if (clean.includes("molienda") || clean.includes("tch") || clean.includes("cana")) {
      return {
        intent: "PROCESS_STATE",
        confidence: 0.82,
        reason: "Mención de molienda y caña",
        recommendedTool: "get_current_process_state",
      };
    }

    if (clean.includes("vapor") || clean.includes("caldera") || clean.includes("cogen") || clean.includes("despacho")) {
      return {
        intent: "PROCESS_STATE",
        confidence: 0.82,
        reason: "Mención de vapor y generación",
        recommendedTool: "calculate_energy_balance",
      };
    }

    // 17. UNKNOWN (Do not guess! Return concise clarification prompt)
    return {
      intent: "UNKNOWN",
      confidence: 0.3,
      reason: "Intención no determinada con suficiente confianza; se requiere aclaración",
    };
  }
}
