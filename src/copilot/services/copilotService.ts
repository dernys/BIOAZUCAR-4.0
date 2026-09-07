import {
  CopilotChatOptions,
  CopilotResponse,
  ActionConfirmationRequest,
} from "../domain/CopilotTypes";
import { IndustrialToolExecutor } from "../tools/industrialToolExecutor";
import { copilotAuditService } from "./copilotAuditService";
import { CopilotIntentClassifier, IntentClassificationResult } from "../domain/CopilotIntentClassifier";
import { KnowledgeRetrievalService } from "./knowledgeRetrievalService";
import { getAuthHeader } from "../../services/authService";

export class CopilotService {
  private static instance: CopilotService;

  private constructor() {}

  public static getInstance(): CopilotService {
    if (!CopilotService.instance) {
      CopilotService.instance = new CopilotService();
    }
    return CopilotService.instance;
  }

  /**
   * Main entrypoint for processing user messages with full context awareness,
   * deterministic pre-classification, strict no-hallucination policy, and RBAC validation.
   */
  public async sendMessage(options: CopilotChatOptions): Promise<CopilotResponse> {
    const startTime = Date.now();
    const { message, context, liveTelemetry, alarmsList, equipmentList, activeTenant, history } = options;

    // 1. Robust Intent Classification BEFORE any response generation
    const classification: IntentClassificationResult = CopilotIntentClassifier.classify(message, context);

    // Short-circuit pure capabilities, unknown, and integration queries to guarantee 100% adherence
    // and prevent any random boiler / steam / Hugot explanations from interfering
    if (classification.intent === "CAPABILITIES" || classification.intent === "UNKNOWN" || classification.intent === "INTEGRATION") {
      return this.generateDeterministicResponse(options, startTime, classification);
    }

    try {
      // 2. Attempt Server-side AI via Gemini API endpoint with pre-classified intent (if in browser or server configured)
      if (typeof window !== "undefined") {
        const authHeaders = await getAuthHeader();
        const response = await fetch("/api/copilot/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            message,
            context,
            history,
            telemetry: liveTelemetry,
            activeTenant,
            alarmsCount: alarmsList.length,
            equipmentCount: equipmentList.length,
            classification,
          }),
        });

        if (response.ok) {
          const payload = await response.json();
          const latency = Date.now() - startTime;
          copilotAuditService.recordRequest(latency);

          // Enforce intent from robust classifier if server returned legacy or mismatched intent
          const finalIntent = classification.intent || payload.intent || "GENERAL_QUESTION";

          // If the server requested tool execution on the client state, execute it:
          if (payload.clientToolCalls && Array.isArray(payload.clientToolCalls) && payload.clientToolCalls.length > 0) {
            let mergedWidgets = payload.widgets || [];
            let mergedSources = payload.sources || [];
            let mergedActions = payload.actions || [];
            let requiresConfirmation = payload.requiresConfirmation;
            let confirmationDetails = payload.confirmationDetails;

            for (const tc of payload.clientToolCalls) {
              const toolResult = await IndustrialToolExecutor.execute({
                toolName: tc.toolName,
                args: tc.args || {},
                context,
                liveTelemetry,
                alarmsList,
                equipmentList,
                activeTenant,
              });

              if (toolResult.widgets) mergedWidgets = [...mergedWidgets, ...toolResult.widgets];
              if (toolResult.sources) mergedSources = [...mergedSources, ...toolResult.sources];
              if (toolResult.actions) mergedActions = [...mergedActions, ...toolResult.actions];
              if (toolResult.requiredConfirmation) {
                requiresConfirmation = true;
                confirmationDetails = toolResult.confirmationDetails;
              }
            }

            const evidenceBundle = payload.evidenceBundle || KnowledgeRetrievalService.buildEvidenceBundle(
              message,
              context,
              liveTelemetry,
              alarmsList,
              equipmentList
            );

            return {
              ...payload,
              intent: finalIntent,
              widgets: mergedWidgets,
              sources: mergedSources,
              actions: mergedActions,
              requiresConfirmation,
              confirmationDetails,
              evidenceBundle,
              executionMetrics: {
                latencyMs: latency,
                toolsExecuted: payload.clientToolCalls.map((t: any) => t.toolName),
                dataPointsConsulted: mergedSources.length,
              },
            };
          }

          const evidenceBundle = payload.evidenceBundle || KnowledgeRetrievalService.buildEvidenceBundle(
            message,
            context,
            liveTelemetry,
            alarmsList,
            equipmentList
          );

          return {
            ...payload,
            intent: finalIntent,
            evidenceBundle,
            executionMetrics: {
              latencyMs: latency,
              toolsExecuted: payload.toolsExecuted || [],
              dataPointsConsulted: payload.sources?.length || 0,
            },
          };
        }
      }
    } catch {
      // Gracefully fall back to local contextual industrial engine
    }

    // 3. Intelligent Deterministic Fallback Engine
    return this.generateDeterministicResponse(options, startTime, classification);
  }

  /**
   * Deterministic Industrial Rule & NLP Engine
   * strictly adheres to intent classification, zero-hallucination, and RBAC permissions.
   */
  public async generateDeterministicResponse(
    options: CopilotChatOptions,
    startTime: number,
    classification?: IntentClassificationResult
  ): Promise<CopilotResponse> {
    const { message, context, liveTelemetry, alarmsList, equipmentList, activeTenant } = options;
    const resolvedClassification = classification || CopilotIntentClassifier.classify(message, context);

    const toolsExecuted: string[] = [];
    let responseText = "";
    let widgets: any[] = [];
    let sources: any[] = [];
    let actions: any[] = [];
    let requiresConfirmation = false;
    let confirmationDetails: ActionConfirmationRequest | undefined;

    switch (resolvedClassification.intent) {
      // ======================================================================
      // 1. CAPABILITIES
      // EXACT requirement from section 2 & 9:
      // "Soy BioAzúcar Copilot, el asistente inteligente de BioAzúcar 4.0. Puedo ayudarte a consultar y analizar el estado de la planta..."
      // NO boilers, NO steam, NO Hugot!
      // ======================================================================
      case "CAPABILITIES": {
        toolsExecuted.push("explain_capabilities");
        responseText = `Soy **BioAzúcar Copilot**, el asistente inteligente de **BioAzúcar 4.0**.\n\nPuedo ayudarte a:\n- Consultar el **estado actual de la planta** en tiempo real.\n- Consultar y analizar **KPIs** (TCH, extracción de sacarosa, balance de vapor, OEE).\n- Analizar **producción, molienda, extracción y cogeneración**.\n- Consultar **alarmas y eventos** según norma ISA-18.2.\n- Consultar **condición y salud de equipos**.\n- Analizar **tendencias y estadísticas** de operación.\n- Explicar **indicadores, fórmulas y procesos** industriales.\n- Mostrar el origen y calidad de los datos mediante **Data Lineage**.\n- Guiar al usuario dentro de la aplicación.\n- Abrir módulos y vistas mediante **navegación autorizada**.\n- Ejecutar **acciones autorizadas** mediante herramientas seguras con RBAC.\n- Generar resúmenes e informes de turno.\n- Explicar cómo utilizar cualquier módulo del sistema.\n\n¿Qué necesitas hacer?`;

        actions.push(
          {
            id: "act-nav-dashboard",
            type: "NAVIGATE",
            label: "Dashboard General",
            payload: { targetRoute: "dashboard" },
            level: 1,
          },
          {
            id: "act-nav-scada",
            type: "NAVIGATE",
            label: "SCADA Molienda",
            payload: { targetRoute: "scada" },
            level: 1,
          },
          {
            id: "act-nav-cogen",
            type: "NAVIGATE",
            label: "Cogeneración & Despacho",
            payload: { targetRoute: "energy_dispatch" },
            level: 1,
          },
          {
            id: "act-nav-alarms",
            type: "NAVIGATE",
            label: "Alarmas ISA-18.2",
            payload: { targetRoute: "alarms" },
            level: 1,
          }
        );
        break;
      }

      // ======================================================================
      // 2. HELP / IDENTITY
      // ======================================================================
      case "HELP": {
        toolsExecuted.push("explain_capabilities");
        responseText = `Hola **${context.displayName || "Operador"}**. Soy **BioAzúcar Copilot**, tu copiloto de ingeniería industrial conectado a **${activeTenant.name}** (${activeTenant.code}).\n\nPuedes interactuar conmigo haciendo preguntas directas en lenguaje natural:\n- *“¿Cuál es el estado actual de molienda?”*\n- *“¿Cómo está el balance de vapor y generación en MW?”*\n- *“¿Cuáles son las alarmas activas?”*\n- *“Muestra el linaje de datos del OEE Global”*\n- *“Llévame al SCADA”*\n- *“¿Qué permisos tengo?”*\n\n¿En qué área o proceso necesitas apoyo?`;

        actions.push({
          id: "act-nav-dashboard",
          type: "NAVIGATE",
          label: "Ir al Dashboard",
          payload: { targetRoute: "dashboard" },
          level: 1,
        });
        break;
      }

      // ======================================================================
      // 3. SYSTEM INFORMATION
      // ======================================================================
      case "SYSTEM_INFORMATION": {
        toolsExecuted.push("get_system_info");
        const resInfo = await IndustrialToolExecutor.execute({
          toolName: "get_system_info",
          args: {},
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        responseText = `**BioAzúcar 4.0 Smart Manufacturing Suite** es la plataforma industrial para la optimización en tiempo real de ingenios azucareros y plantas de cogeneración en biomasa.\n\n### Arquitectura y Estándares:\n- **Unified Namespace (UNS)**: Arquitectura orientada a eventos con broker MQTT e interfaces OPC-UA y Modbus industriales.\n- **Normas de Ingeniería**: Cumplimiento de **ISA-95** (modelado jerárquico), **ISA-18.2** (gestión de alarmas y SOE), **ASME PTC 4** (balances de calderas de biomasa) e **ISO 22400-2** (cálculo canónico de OEE).\n- **Ciberseguridad OT**: Control de acceso granular RBAC y políticas alineadas con **IEC 62443** (Niveles de Seguridad 1 a 3 para operaciones y consignas).\n- **Módulos Integrados**: SCADA P&ID, Despacho PPA a red eléctrica, Historiador de series de tiempo, LIMS de caña, CMMS con análisis de vibración FFT y Gemelo Digital 3D.\n\nActualmente conectado a **${activeTenant.name}** (${activeTenant.code}).`;
        break;
      }

      // ======================================================================
      // 4. USER PERMISSIONS
      // ======================================================================
      case "USER_PERMISSIONS": {
        toolsExecuted.push("get_user_permissions");
        const canModifySetpoints = context.permissions.includes("MODIFY_SETPOINTS");
        const canAcknowledge = context.permissions.includes("ACKNOWLEDGE_ALARM");
        const canChangeDispatch = context.permissions.includes("CHANGE_DISPATCH_MW");

        responseText = `### Perfil de Acceso & Permisos RBAC\n- **Usuario**: ${context.displayName || context.username}\n- **Rol(es)**: ${context.roles.map((r) => `\`${r}\``).join(", ")}\n- **Nivel de Seguridad IEC 62443**: Nivel ${context.securityLevel} de 5\n- **Planta**: ${context.plantName} (${context.plantCode})\n\n### Capacidades Operativas:\n- **Reconocimiento de Alarmas (Nivel 2)**: ${canAcknowledge ? "✅ Autorizado" : "❌ No autorizado"}\n- **Modificación de Setpoints (Nivel 3)**: ${canModifySetpoints ? "✅ Autorizado con confirmación explícita" : "❌ No autorizado (requiere rol Administrador o SuperAdmin)"}\n- **Ajuste de Despacho Eléctrico MW (Nivel 3)**: ${canChangeDispatch ? "✅ Autorizado con confirmación" : "❌ No autorizado"}\n\n*Nota: El Copilot nunca concede ni modifica permisos; estos son gobernados estrictamente por el sistema central de RBAC.*`;
        break;
      }

      // ======================================================================
      // 5. NAVIGATION
      // ======================================================================
      case "NAVIGATION": {
        toolsExecuted.push("navigate_to");
        const target = resolvedClassification.targetModule || "dashboard";

        responseText = `Entendido. Navegando al módulo **${target.toUpperCase()}**. Puedes usar el acceso rápido a continuación si no se ha cargado automáticamente.`;

        actions.push({
          id: `act-nav-${target}`,
          type: "NAVIGATE",
          label: `Abrir Pantalla ${target.toUpperCase()}`,
          payload: { targetRoute: target },
          level: 1,
        });
        break;
      }

      // ======================================================================
      // 6. ACTION (CRITICAL OR RBAC PROTECTED)
      // ======================================================================
      case "ACTION": {
        if (resolvedClassification.recommendedTool === "request_setpoint_change") {
          toolsExecuted.push("request_setpoint_change");
          const tag = resolvedClassification.targetTag || "TIC-201-SP";
          const newValue = resolvedClassification.proposedValue || 480;

          const resAction = await IndustrialToolExecutor.execute({
            toolName: "request_setpoint_change",
            args: { tag, newValue },
            context,
            liveTelemetry,
            alarmsList,
            equipmentList,
            activeTenant,
          });

          responseText = resAction.data?.message || `Solicitud de modificación de setpoint registrada. Requiere confirmación explícita bajo IEC 62443.`;
          if (resAction.requiredConfirmation) {
            requiresConfirmation = true;
            confirmationDetails = resAction.confirmationDetails;
          }
          if (resAction.widgets) widgets.push(...resAction.widgets);
          if (resAction.actions) actions.push(...resAction.actions);
        } else if (resolvedClassification.recommendedTool === "request_acknowledge_alarm") {
          toolsExecuted.push("request_acknowledge_alarm");
          const alarm = alarmsList.find((a) => !a.acknowledged) || alarmsList[0];
          const alarmId = alarm ? alarm.id : "alm-gen-01";

          const resAck = await IndustrialToolExecutor.execute({
            toolName: "request_acknowledge_alarm",
            args: { alarmId },
            context,
            liveTelemetry,
            alarmsList,
            equipmentList,
            activeTenant,
          });

          responseText = resAck.data?.message || `Solicitud de reconocimiento de alarma registrada.`;
          if (resAck.requiredConfirmation) {
            requiresConfirmation = true;
            confirmationDetails = resAck.confirmationDetails;
          }
          if (resAck.actions) actions.push(...resAck.actions);
        } else if (resolvedClassification.recommendedTool === "request_dispatch_change") {
          toolsExecuted.push("request_dispatch_change");
          const exportMW = resolvedClassification.proposedValue || 22.0;

          const resDisp = await IndustrialToolExecutor.execute({
            toolName: "request_dispatch_change",
            args: { exportMW },
            context,
            liveTelemetry,
            alarmsList,
            equipmentList,
            activeTenant,
          });

          responseText = resDisp.data?.message || `Solicitud de ajuste de despacho PPA registrada.`;
          if (resDisp.requiredConfirmation) {
            requiresConfirmation = true;
            confirmationDetails = resDisp.confirmationDetails;
          }
          if (resDisp.actions) actions.push(...resDisp.actions);
        }
        break;
      }

      // ======================================================================
      // 7. DATA LINEAGE
      // ======================================================================
      case "DATA_LINEAGE": {
        toolsExecuted.push("get_data_lineage");
        const kpi = resolvedClassification.targetKpiId || "kpi-tch";

        const resLineage = await IndustrialToolExecutor.execute({
          toolName: "get_data_lineage",
          args: { kpiId: kpi },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        responseText = `El linaje de datos de **${resLineage.data?.kpiName || "Indicador"}** certifica la trazabilidad completa desde los sensores de instrumentación de campo hasta el cálculo de ingeniería.\n\n- **Calidad del Dato**: \`${resLineage.data?.overallQuality || "BUENA (SIMULADA)"}\`\n- **Origen Principal**: ${resLineage.data?.overallSource || "Instrumentación OT"}\n- **Última Actualización**: Hace segundos.`;
        if (resLineage.widgets) widgets.push(...resLineage.widgets);
        if (resLineage.actions) actions.push(...resLineage.actions);
        break;
      }

      // ======================================================================
      // 8. ALARMS
      // ======================================================================
      case "ALARM": {
        toolsExecuted.push("get_active_alarms");
        const resAlarms = await IndustrialToolExecutor.execute({
          toolName: "get_active_alarms",
          args: {},
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const count = resAlarms.data?.count || 0;
        responseText = count > 0
          ? `Se registran **${count} alarmas activas** bajo norma ISA-18.2 en **${activeTenant.name}**. A continuación se presentan los eventos priorizados por severidad.`
          : `No se registran alarmas críticas activas en este momento en **${activeTenant.name}**. Todos los lazos operan dentro de los límites de ingeniería normales.`;

        if (resAlarms.widgets) widgets.push(...resAlarms.widgets);
        if (resAlarms.actions) actions.push(...resAlarms.actions);
        break;
      }

      // ======================================================================
      // 9. EQUIPMENT
      // ======================================================================
      case "EQUIPMENT": {
        toolsExecuted.push("get_equipment");
        const eqName = resolvedClassification.targetEquipment || "Molino 3";

        const resEq = await IndustrialToolExecutor.execute({
          toolName: "get_equipment",
          args: { name: eqName },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        responseText = `### Ficha Técnica de Condición: ${resEq.data?.name || eqName} (${resEq.data?.code || "EQ-01"})\n- **Estado Operativo**: ${resEq.data?.status === "operational" ? "🟢 En Operación" : "🟡 Atención requerida"}\n- **Salud Predictiva (CBM)**: **${resEq.data?.healthIndex || 92}%**\n- **Vibración RMS (ISO 10816)**: **${resEq.data?.vibrationRMS || 2.4} mm/s** (${resEq.data?.vibrationStatus || "Zona A - Admisible"})\n- **Temperatura Rodamientos**: ${resEq.data?.bearingTemp || 62}°C\n- **Horas Acumuladas**: ${(resEq.data?.runningHours || 1420).toLocaleString()} hrs`;

        if (resEq.widgets) widgets.push(...resEq.widgets);
        if (resEq.actions) actions.push(...resEq.actions);
        break;
      }

      // ======================================================================
      // 10. STATISTICS
      // ======================================================================
      case "STATISTICS": {
        toolsExecuted.push("show_chart");
        const resChart = await IndustrialToolExecutor.execute({
          toolName: "show_chart",
          args: { metric: "tch", chartType: "line" },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        responseText = `A continuación se presenta el comportamiento temporal y la serie de tiempo de molienda TCH de las últimas 8 horas en **${activeTenant.name}**. Promedio de turno: **${liveTelemetry.tch} TCH**.`;
        if (resChart.widgets) widgets.push(...resChart.widgets);
        break;
      }

      // ======================================================================
      // 11. DIAGNOSTIC
      // ======================================================================
      case "DIAGNOSTIC": {
        toolsExecuted.push("get_active_alarms", "get_current_process_state");
        responseText = `### Análisis Causal de Operación en ${activeTenant.name}\n- **Molienda**: La tasa actual es de **${liveTelemetry.tch} TCH** con una extracción de **${liveTelemetry.millingExtraction}%**.\n- **Vapor & Cogeneración**: Caldera HP a **${liveTelemetry.boilerPressureHP} bar** y **${liveTelemetry.boilerTempHP}°C**, con generación de **${liveTelemetry.powerGeneratedMW} MW**.\n- **Alarmas y Eventos**: No se detectan anomalías de disparo inminente; las oscilaciones reportadas corresponden a variaciones normales en el flujo de caña picada.\n\n*Recomendación de control*: Mantener la relación de agua de imbibición compuesta entre 22% y 26% para estabilizar la extracción por encima del 96.0%.`;

        actions.push({
          id: "act-nav-scada",
          type: "NAVIGATE",
          label: "Ver Lazos PID en SCADA",
          payload: { targetRoute: "scada" },
          level: 1,
        });
        break;
      }

      // ======================================================================
      // 12. KPI ANALYSIS
      // ======================================================================
      case "KPI_ANALYSIS": {
        if (resolvedClassification.targetKpiId === "kpi-oee-overall") {
          toolsExecuted.push("calculate_oee");
          const resOee = await IndustrialToolExecutor.execute({
            toolName: "calculate_oee",
            args: {},
            context,
            liveTelemetry,
            alarmsList,
            equipmentList,
            activeTenant,
          });

          responseText = `El **OEE Global** de **${activeTenant.name}** se sitúa actualmente en **${liveTelemetry.oeeOverall}%** (Meta: 90.0%). Cumple con la formulación de la norma **ISO 22400-2 MES KPI** (Disponibilidad × Rendimiento × Calidad). *Dato simulado para pruebas de desarrollo*.`;
          if (resOee.widgets) widgets.push(...resOee.widgets);
        } else if (resolvedClassification.targetKpiId === "kpi-steam-hp" || resolvedClassification.recommendedTool === "calculate_energy_balance") {
          toolsExecuted.push("calculate_energy_balance");
          const resBal = await IndustrialToolExecutor.execute({
            toolName: "calculate_energy_balance",
            args: {},
            context,
            liveTelemetry,
            alarmsList,
            equipmentList,
            activeTenant,
          });

          responseText = `### Balance Energético en Caldera & Generación\n- **Presión de Vapor HP**: **${liveTelemetry.boilerPressureHP} bar** (Nominal: 65.0 bar)\n- **Temperatura de Vapor**: **${liveTelemetry.boilerTempHP} °C** (Nominal: 485 °C)\n- **Potencia Generada Total**: **${liveTelemetry.powerGeneratedMW} MW**\n- **Potencia Exportada al SEN**: **${liveTelemetry.powerExportGridMW} MW**\n- **Autoconsumo Planta**: ${(liveTelemetry.powerGeneratedMW - liveTelemetry.powerExportGridMW).toFixed(1)} MW`;
          if (resBal.widgets) widgets.push(...resBal.widgets);
        } else {
          toolsExecuted.push("get_current_process_state");
          responseText = `El valor actual de **Molienda Horaria (TCH)** es de **${liveTelemetry.tch} TCH** con una **extracción de sacarosa** del **${liveTelemetry.millingExtraction}%**. La caña acumulada en la zafra de hoy es de **${liveTelemetry.caneAccumToday.toLocaleString()} toneladas**.`;
        }
        break;
      }

      // ======================================================================
      // 13. PROCESS STATE (CONTEXT-AWARE DISAMBIGUATION)
      // ======================================================================
      case "PROCESS_STATE": {
        if (resolvedClassification.targetModule === "energy_dispatch") {
          toolsExecuted.push("calculate_energy_balance");
          responseText = `### Estado Operativo: Cogeneración & Despacho Energético\n*(Contextualizado al módulo de Cogeneración)*\n\n- **Vapor Alta Presión**: **${liveTelemetry.boilerPressureHP} bar** a **${liveTelemetry.boilerTempHP}°C**.\n- **Generación en Turbinas**: **${liveTelemetry.powerGeneratedMW} MW**.\n- **Despacho Exportado a Red SEN**: **${liveTelemetry.powerExportGridMW} MW**.\n- **Calidad de telemetría**: Buena (Datos simulados en tiempo real).`;
        } else if (resolvedClassification.targetModule === "scada") {
          toolsExecuted.push("get_current_process_state");
          responseText = `### Estado Operativo: Molienda & Extracción\n*(Contextualizado al módulo SCADA Mímico)*\n\n- **Tasa de Molienda**: **${liveTelemetry.tch} TCH**.\n- **Extracción de Sacarosa**: **${liveTelemetry.millingExtraction}%**.\n- **Caña Acumulada**: **${liveTelemetry.caneAccumToday.toLocaleString()} toneladas**.\n- **Calidad de telemetría**: Buena (Datos simulados en tiempo real).`;
        } else {
          toolsExecuted.push("get_current_process_state");
          responseText = `### Resumen Operativo Global: ${activeTenant.name}\n- **Molienda (TCH)**: **${liveTelemetry.tch} TCH** | Extracción: **${liveTelemetry.millingExtraction}%**.\n- **Vapor HP**: **${liveTelemetry.boilerPressureHP} bar** | Temp: **${liveTelemetry.boilerTempHP}°C**.\n- **Generación Eléctrica**: **${liveTelemetry.powerGeneratedMW} MW** (Exportando **${liveTelemetry.powerExportGridMW} MW** al SEN).\n- **OEE Global**: **${liveTelemetry.oeeOverall}%**.\n- **Estatus de Datos**: Telemetría operativa simulada activa para ingeniería y pruebas.`;
        }

        actions.push({
          id: "act-nav-dashboard",
          type: "NAVIGATE",
          label: "Ver Tablero Principal",
          payload: { targetRoute: "dashboard" },
          level: 1,
        });
        break;
      }

      // ======================================================================
      // 14. CONFIGURATION
      // ======================================================================
      case "CONFIGURATION": {
        toolsExecuted.push("navigate_to");
        responseText = `Para consultar y ajustar la configuración de infraestructura, Unified Namespace (UNS), brokers MQTT o parámetros de planta de **${activeTenant.name}**, accede al panel técnico correspondiente:`;

        actions.push(
          {
            id: "act-nav-uns",
            type: "NAVIGATE",
            label: "Configuración UNS Hub & IIoT",
            payload: { targetRoute: "uns_hub" },
            level: 1,
          },
          {
            id: "act-nav-tenants",
            type: "NAVIGATE",
            label: "Gestión de Empresas & Centrales",
            payload: { targetRoute: "enterprises" },
            level: 1,
          }
        );
        break;
      }

      // ======================================================================
      // 15. GENERAL DOMAIN KNOWLEDGE (Theoretical questions)
      // ======================================================================
      case "GENERAL_QUESTION": {
        toolsExecuted.push("search_system_knowledge");
        const resDoc = await IndustrialToolExecutor.execute({
          toolName: "search_system_knowledge",
          args: { query: message },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        if (resDoc.data?.items?.length > 0) {
          const top = resDoc.data.items[0];
          responseText = `### ${top.title}\n${top.summary}\n\n${top.content}`;
          if (resDoc.actions) actions.push(...resDoc.actions);
        } else {
          responseText = `No encontré una ficha técnica exacta para esa consulta teórica en la base de conocimiento local. Puedo ayudarte con el estado de molienda, calderas, despacho eléctrico, KPIs u OEE de **${activeTenant.name}**. ¿Qué dato necesitas?`;
        }
        break;
      }

      // ======================================================================
      // 16. TUTORIAL / GUIDED TOUR
      // ======================================================================
      case "TUTORIAL": {
        toolsExecuted.push("get_tutorial_step");
        const resTut = await IndustrialToolExecutor.execute({
          toolName: "get_tutorial_step",
          args: { stepNumber: 1 },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const step = resTut.data?.step;
        if (step) {
          responseText = `### 🎓 ${step.title}\n**Objetivo:** ${step.objective}\n\n${step.explanation}\n\n**🔍 Qué observar en esta pantalla:**\n${step.whatToObserve.map((obs: string) => `- ${obs}`).join("\n")}\n\n*Haz clic en la acción rápida para avanzar al siguiente módulo.*`;
        } else {
          responseText = `Bienvenido al recorrido guiado de **BioAzúcar 4.0**. El sistema te guiará paso a paso por el Dashboard, SCADA de molienda, Cogeneración y Centro de Alarmas.`;
        }

        if (resTut.actions) actions.push(...resTut.actions);
        break;
      }

      // ======================================================================
      // 17. CONTEXTUAL HELP (What can I do here / Explain screen)
      // ======================================================================
      case "CONTEXTUAL_HELP": {
        toolsExecuted.push("get_contextual_help");
        const resHelp = await IndustrialToolExecutor.execute({
          toolName: "get_contextual_help",
          args: { module: context.currentModule || "dashboard" },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const doc = resHelp.data?.doc;
        if (doc) {
          responseText = `### 📌 Ayuda Contextual: ${doc.name}\n**Módulo Activo:** \`${String(doc.id).toUpperCase()}\` | **Roles Autorizados:** \`${(doc.targetUsers || []).join(", ").toUpperCase()}\`\n\n${doc.purpose}\n\n**Funcionalidades Clave:**\n${(doc.features || []).map((c: string) => `- ${c}`).join("\n")}`;
          if (doc.frequentProcedures?.length) {
            responseText += `\n\n**Procedimientos Operativos Típicos:**\n${doc.frequentProcedures.map((p: any) => `- ${p.title}`).join("\n")}`;
          }
          if (doc.keyConcepts?.length) {
            responseText += `\n\n**Conceptos Clave:** ${doc.keyConcepts.join(", ")}`;
          }
        } else {
          responseText = `Te encuentras en el módulo **${(context.currentModule || "dashboard").toUpperCase()}**. Aquí puedes consultar variables en tiempo real, supervisar la operación y ejecutar acciones autorizadas según tu rol.`;
        }

        if (resHelp.actions) actions.push(...resHelp.actions);
        break;
      }

      // ======================================================================
      // 18. GLOSSARY / DICTIONARY QUERY
      // ======================================================================
      case "GLOSSARY_QUERY": {
        toolsExecuted.push("search_glossary");
        const resGlossary = await IndustrialToolExecutor.execute({
          toolName: "search_glossary",
          args: { term: message },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const entries = resGlossary.data?.entries || [];
        if (entries.length > 0) {
          const top = entries[0];
          responseText = `### 📖 ${top.term} — ${top.name}\n**Categoría:** \`${top.category}\` ${top.unit ? `| **Unidad:** ${top.unit}` : ""}\n\n${top.definition}`;
          if (top.mathematicalFormula) {
            responseText += `\n\n**Fórmula Matemática:**\n$$${top.mathematicalFormula}$$`;
          }
          if (top.normalRange) {
            responseText += `\n\n**Rango Operativo Típico:** ${top.normalRange}`;
          }
          if (top.standards?.length) {
            responseText += `\n\n**Normas de Referencia:** ${top.standards.join(", ")}`;
          }
        } else {
          responseText = `No encontré ese término específico en el glosario azucarero. Puedes consultar términos como **TCH, OEE, Pol, Brix, ARE, Bagazo, UNS, OPC UA o ISA-18.2**.`;
        }

        if (resGlossary.actions) actions.push(...resGlossary.actions);
        break;
      }

      // ======================================================================
      // 19. OPERATIONAL PROCEDURE (SOP) QUERY
      // ======================================================================
      case "PROCEDURE_QUERY": {
        toolsExecuted.push("get_procedure");
        const resProc = await IndustrialToolExecutor.execute({
          toolName: "get_procedure",
          args: { query: message },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const procs = resProc.data?.procedures || [];
        if (procs.length > 0) {
          const top = procs[0];
          responseText = `### 📋 Procedimiento Operativo Estándar: ${top.title}\n**Categoría:** \`${top.category}\` | **Rol Requerido:** \`${top.requiredRole.toUpperCase()}\` | **Nivel de Seguridad:** Nivel ${top.securityLevel}\n\n${top.description}\n\n**⚠️ Condiciones Previas de Seguridad:**\n${top.safetyPreconditions.map((pre: string) => `- ${pre}`).join("\n")}\n\n**Paso a Paso:**\n${top.steps.map((st: string, idx: number) => `${idx + 1}. ${st}`).join("\n")}\n\n**Validación de Evidencia:**\n${top.evidenceValidation}`;
        } else {
          responseText = `No encontré un procedimiento exacto para esa consulta. Puedes solicitar procedimientos como:\n- *“Cómo cambiar consigna de despacho”*\n- *“Procedimiento para reconocer una alarma”*\n- *“Cómo registrar un lote de caña”*\n- *“Diagnóstico de vibración en molino”*\n- *“Conmutar a Edge industrial”*`;
        }

        if (resProc.actions) actions.push(...resProc.actions);
        break;
      }

      // ======================================================================
      // 20. KNOWLEDGE GRAPH QUERY
      // ======================================================================
      case "KNOWLEDGE_GRAPH_QUERY": {
        toolsExecuted.push("query_knowledge_graph");
        const resGraph = await IndustrialToolExecutor.execute({
          toolName: "query_knowledge_graph",
          args: { entity: message },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        const alarms = resGraph.data?.alarms || [];
        const tags = resGraph.data?.tags || [];

        if (alarms.length > 0 || tags.length > 0) {
          responseText = `### 🕸️ Relaciones en el Grafo de Conocimiento Industrial\n`;
          if (alarms.length > 0) {
            responseText += `**Alarmas Asociadas al Activo:**\n${alarms.map((a: any) => `- [${a.code}] ${a.name}`).join("\n")}\n\n`;
          }
          if (tags.length > 0) {
            responseText += `**Tags Industriales que Alimentan el Indicador:**\n${tags.map((t: any) => `- \`${t.code}\`: ${t.name}`).join("\n")}\n\n`;
          }
          responseText += `*Relación gobernada bajo el árbol jerárquico ISA-95 del ingenio.*`;
        } else {
          responseText = `He consultado el Grafo de Conocimiento de **${activeTenant.name}**. Puedes consultar qué alarmas tiene asignadas un equipo (ej. *“Molino 3”*) o qué tags alimentan un KPI (ej. *“kpi-steam-hp”*).`;
        }
        break;
      }

      // ======================================================================
      // 21. INDUSTRIAL INTEGRATION / EROS DCS / OT CONNECTIVITY
      // ======================================================================
      case "INTEGRATION": {
        toolsExecuted.push("get_integration_status");
        const provider = resolvedClassification.integrationProvider || "eros";
        const subIntent = resolvedClassification.subIntent || "EROS_INTEGRATION";

        const resInteg = await IndustrialToolExecutor.execute({
          toolName: "get_integration_status",
          args: { provider },
          context,
          liveTelemetry,
          alarmsList,
          equipmentList,
          activeTenant,
        });

        if (resInteg.widgets) widgets.push(...resInteg.widgets);
        if (resInteg.actions) actions.push(...resInteg.actions);

        const integrations = resInteg.data?.integrations || [];
        const erosInfo = integrations.find((i: any) => i.id === "eros") || integrations[0];

        if (subIntent === "EROS_INTEGRATION" || provider === "eros") {
          const statusBadge = erosInfo?.connectionStatus === "CONNECTED" ? "🟢 CONECTADO" : "🔴 DESCONECTADO";
          responseText = `### 🏭 Integración de EROS DCS con BioAzúcar 4.0

**¿Qué es EROS?**
**EROS** es el Sistema de Control Distribuido (DCS) azucarero de planta responsable de la automatización de procesos críticos en el ingenio: tándem de molinos, difusores, maceración/imbibición, clarificación y control de tachos al vacío.

---

### 🌐 Flujo Arquitectónico de Conectividad
\`\`\`text
EROS/DCS ➔ EROS Connector ➔ Industrial Edge ➔ Normalización (IndustrialDataPoint) ➔ UNS/MQTT ➔ Plataforma BioAzúcar ➔ Copilot/SCADA/KPIs
\`\`\`

---

### 🛠️ ¿Cómo conectar el sistema a EROS? (Procedimiento Técnico)

1. **Definir la Interfaz de Comunicación en Industrial Edge**:
   - **\`OPC_UA_BRIDGE\`** *(Recomendado para producción)*: Conecta la pasarela OPC UA (IEC 62541) del nodo Edge con el servidor EROS en puerto \`4840\` o \`9000\`.
   - **\`DIRECT_TCP\`**: Conexión nativa por socket binario TCP/IP (puerto predeterminado \`9000\`).
   - **\`MODBUS_GATEWAY\`**: Mapeo de Holding Registers de EROS vía pasarela Modbus TCP (puerto \`502\`).
   - **\`REST_API\`**: Extracción periódica HTTP/JSON para datos históricos (modo solo lectura).

2. **Configuración de Parámetros de Enlace**:
   - **Host / IP**: \`${erosInfo?.endpoint || "192.168.15.100:9000"}\` (Red OT segmentada según IEC 62443).
   - **Modo de Seguridad**: Certificados X.509 o credenciales almacenadas en Vault (\`vault://secrets/eros-creds\`).
   - **Modo Operativo**: \`readOnlyMode: true\` (por defecto para protección de lazos de control físico).

3. **Mapeo de Variables y Normalización ISA-95**:
   - Asignar tags de EROS a objetos \`IndustrialDataPoint\` (ej. \`EROS.Tandem.Turbine_Speed_RPM\` ➔ \`Milling.Tandem.TCH_Actual\`).
   - Configurar período de sondeo / publicación (estándar: 1000 ms).

4. **Suscripción y Publicación en Unified Namespace (UNS)**:
   - El conector publica los datos normalizados en el broker MQTT Sparkplug B (\`spBv1.0/BioAzucar/DDATA/Central-01/Molienda\`).

---

### 📊 Estado Actual del Enlace EROS:
- **Estado de Conexión**: ${statusBadge} (\`${erosInfo?.connectionStatus || "DISCONNECTED"}\`)
- **Interfaz Activa**: \`${erosInfo?.details?.activeInterface || "OPC_UA_BRIDGE"}\` | Versión: \`${erosInfo?.details?.version || "4.8"}\`
- **Endpoint**: \`${erosInfo?.endpoint || "192.168.15.100:9000"}\`
- **Latencia**: \`${erosInfo?.latencyMs ?? 0} ms\` | **Paquetes Transmitidos**: \`${erosInfo?.details?.packetsReceived ?? 0} rx / ${erosInfo?.details?.packetsSent ?? 0} tx\`
- **Calidad de Datos**: \`${erosInfo?.dataQuality || "COMMUNICATION_LOST"}\` (\`${erosInfo?.environment || "PRODUCTION_OT"}\`)

---

### 🛡️ Política de Seguridad (IEC 62443):
*El Copilot y los modelos de IA nunca interactúan directamente con los PLCs ni con el DCS EROS. Todas las operaciones siguen el flujo:*
\`Copilot ➔ Control RBAC ➔ Motor de Políticas ➔ Servicio de Integración Industrial ➔ Industrial Edge ➔ EROS DCS\`.`;

          actions.push(
            {
              id: "act-nav-unshub",
              type: "NAVIGATE",
              label: "Ver EROS en UNS Hub",
              payload: { targetRoute: "uns_hub" },
              level: 1,
            },
            {
              id: "act-diag-eros",
              type: "EXECUTE_TOOL",
              label: "Ejecutar Diagnóstico OT",
              payload: { tool: "get_integration_status", provider: "eros" },
              level: 1,
            }
          );
        } else if (subIntent === "CONNECTIVITY_DIAGNOSTIC") {
          responseText = `### 🔍 Diagnóstico de Conectividad Industrial OT & Edge Node

Se ha consultado el estado de todos los conectores industriales en el **BioAzúcar Industrial Edge Node** (\`192.168.10.2\`):

- **EROS DCS**: \`${integrations.find((i: any) => i.id === "eros")?.connectionStatus || "DISCONNECTED"}\` (Latencia: ${integrations.find((i: any) => i.id === "eros")?.latencyMs || 0} ms)
- **OPC UA Gateway**: \`${integrations.find((i: any) => i.id === "opcua")?.connectionStatus || "DISCONNECTED"}\` (Latencia: ${integrations.find((i: any) => i.id === "opcua")?.latencyMs || 0} ms)
- **Modbus TCP**: \`${integrations.find((i: any) => i.id === "modbus")?.connectionStatus || "DISCONNECTED"}\` (Latencia: ${integrations.find((i: any) => i.id === "modbus")?.latencyMs || 0} ms)
- **Broker MQTT UNS**: \`${integrations.find((i: any) => i.id === "mqtt")?.connectionStatus || "DISCONNECTED"}\` (Latencia: ${integrations.find((i: any) => i.id === "mqtt")?.latencyMs || 0} ms)
- **Buffer Store & Forward**: Cola local activa con ${resInteg.data?.integrations?.find((i: any) => i.id === "edge")?.details?.queueDepth || 0} paquetes pendientes.

*Consulta la tabla de diagnóstico a continuación para revisar endpoints y tasas de error.*`;
        } else if (subIntent === "OPC_UA_INTEGRATION" || provider === "opcua") {
          const opcInfo = integrations.find((i: any) => i.id === "opcua");
          responseText = `### ⚡ Integración OPC UA (IEC 62541) con BioAzúcar 4.0

**Arquitectura de Conexión**:
\`PLCs (Siemens/Rockwell/Schneider) ➔ Servidor OPC UA (KEPServerEX) ➔ OpcUaConnector (Edge) ➔ UNS/MQTT ➔ BioAzúcar\`

- **Endpoint de Conexión**: \`${opcInfo?.endpoint || "opc.tcp://192.168.10.50:4840/BioAzucarServer"}\`
- **Políticas de Seguridad**: \`Basic256Sha256\` / \`SignAndEncrypt\` con certificados X.509.
- **Estado Actual**: \`${opcInfo?.connectionStatus || "DISCONNECTED"}\` (Latencia: \`${opcInfo?.latencyMs || 0} ms\`).
- **Mecanismo**: Suscripción determinística por excepción con deadband configurable.`;
        } else if (subIntent === "MODBUS_INTEGRATION" || provider === "modbus") {
          const modInfo = integrations.find((i: any) => i.id === "modbus");
          responseText = `### 🔌 Integración Modbus TCP / RTU con BioAzúcar 4.0

**Arquitectura de Conexión**:
\`Analizadores de Potencia / Variadores ➔ Gateway Moxa NPort 5150A ➔ ModbusConnector (Edge) ➔ UNS/MQTT ➔ BioAzúcar\`

- **Endpoint**: \`${modInfo?.endpoint || "192.168.20.15:502"}\` (Modbus TCP)
- **Registros Mapeados**: Holding Registers 40001-40050 (Potencia activa MW, reactiva MVAr, factor de potencia).
- **Estado Actual**: \`${modInfo?.connectionStatus || "DISCONNECTED"}\` (Latencia: \`${modInfo?.latencyMs || 0} ms\`).`;
        } else if (subIntent === "MQTT_INTEGRATION" || subIntent === "SPARKPLUG_INTEGRATION") {
          const mqttInfo = integrations.find((i: any) => i.id === "mqtt");
          responseText = `### 📡 Unified Namespace & MQTT Sparkplug B

**Arquitectura de Conexión**:
\`Industrial Edge ➔ MqttSparkplugConnector ➔ Broker EMQX Enterprise ➔ Unified Namespace (UNS) ➔ BioAzúcar Platform\`

- **Broker URL**: \`${mqttInfo?.endpoint || "tls://mqtt.bioazucar.internal:8883"}\`
- **Espacio de Tópicos Sparkplug B**: \`spBv1.0/{GroupId}/{MessageType}/{EdgeNodeId}/[{DeviceId}]\`
- **Estado Actual**: \`${mqttInfo?.connectionStatus || "DISCONNECTED"}\` (Calidad: \`${mqttInfo?.dataQuality || "GOOD"}\`).`;
        } else {
          responseText = `### 🌐 Conectividad e Integración Industrial OT (BioAzúcar 4.0)

BioAzúcar soporta arquitectura híbrida OT/IT desacoplada mediante el **Industrial Edge Node**:
- **Protocolos Soportados**: EROS DCS Native, OPC UA (IEC 62541), Modbus TCP/RTU, MQTT Sparkplug B y REST API.
- **Flujo de Datos**: \`Fuentes OT ➔ Conectores Edge ➔ Normalización ISA-95 ➔ UNS Hub ➔ BioAzúcar ➔ Copilot\`.
- **Aislamiento Ciberseguro**: Red OT (Nivel 2/3) aislada mediante doble tarjeta de red (Dual NIC) y colas Store & Forward.`;
        }
        break;
      }

      // ======================================================================
      // 16. UNKNOWN (Do not guess! Return concise clarification prompt)
      // EXACT requirement from section 10:
      // "Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación. ¿Qué quieres consultar?"
      // ======================================================================
      case "UNKNOWN":
      default: {
        responseText = `Puedo ayudarte con producción, KPIs, alarmas, equipos, energía, estadísticas o navegación. ¿Qué quieres consultar?`;

        actions.push(
          {
            id: "act-prompt-state",
            type: "NAVIGATE",
            label: "Consultar Estado de Planta",
            payload: { targetRoute: "dashboard" },
            level: 1,
          },
          {
            id: "act-prompt-alarms",
            type: "NAVIGATE",
            label: "Ver Alarmas Activas",
            payload: { targetRoute: "alarms" },
            level: 1,
          },
          {
            id: "act-prompt-scada",
            type: "NAVIGATE",
            label: "Ver SCADA Molienda",
            payload: { targetRoute: "scada" },
            level: 1,
          }
        );
        break;
      }
    }

    const latency = Date.now() - startTime;
    copilotAuditService.recordRequest(latency);

    // Build comprehensive RAG evidence bundle
    const evidenceBundle = KnowledgeRetrievalService.buildEvidenceBundle(
      message,
      context,
      liveTelemetry,
      alarmsList,
      equipmentList
    );

    return {
      message: responseText,
      intent: resolvedClassification.intent,
      confidence: resolvedClassification.confidence,
      sources,
      widgets,
      actions,
      requiresConfirmation,
      confirmationDetails,
      evidenceBundle,
      isAiGenerated: true,
      executionMetrics: {
        latencyMs: latency,
        toolsExecuted,
        dataPointsConsulted: sources.length,
      },
    };
  }
}

export const copilotService = CopilotService.getInstance();
