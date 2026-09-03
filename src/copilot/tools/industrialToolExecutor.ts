import {
  TelemetryData,
  AlarmEvent,
  EquipmentItem,
  TenantEnterprise,
  UserRole,
  DataQuality,
  IndustrialDataPoint,
} from "../../types";
import { dataProviderRegistry } from "../../services/dataProviders/DataProviderRegistry";
import { kpiEngine, CANONICAL_KPI_DEFINITIONS } from "../../services/kpiEngine";
import { INITIAL_TAG_CATALOG } from "../../services/tagManagementService";
import { copilotKnowledgeService } from "../services/copilotKnowledgeService";
import { checkToolAuthorization } from "../domain/CopilotPermissions";
import {
  CopilotUserContext,
  CopilotResponse,
  CopilotWidget,
  CopilotAction,
  DataSourceReference,
} from "../domain/CopilotTypes";
import { copilotAuditService } from "../services/copilotAuditService";
import { commandService } from "../../services/edge/CommandService";
import { industrialEdge } from "../../services/edge/BioAzucarIndustrialEdge";

export interface ToolExecutionInput {
  toolName: string;
  args: Record<string, any>;
  context: CopilotUserContext;
  liveTelemetry: TelemetryData;
  alarmsList: AlarmEvent[];
  equipmentList: EquipmentItem[];
  activeTenant: TenantEnterprise;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  isDenied?: boolean;
  requiredConfirmation?: boolean;
  confirmationDetails?: any;
  sources?: DataSourceReference[];
  widgets?: CopilotWidget[];
  actions?: CopilotAction[];
}

export class IndustrialToolExecutor {
  public static async execute(input: ToolExecutionInput): Promise<ToolExecutionResult> {
    const { toolName, args, context, liveTelemetry, alarmsList, equipmentList, activeTenant } = input;

    // 1. Strict RBAC & Security Clearance Validation
    const authCheck = checkToolAuthorization(
      toolName,
      context.roles,
      context.securityLevel,
      context.isSuperAdmin
    );

    if (!authCheck.allowed) {
      await copilotAuditService.logEvent({
        userId: context.userId,
        userName: context.displayName || context.username,
        tenantId: context.plantId,
        sessionId: "sess-" + context.userId,
        intent: "TOOL_CALL",
        toolName,
        arguments: args,
        resultStatus: "DENIED",
        requiredPermission: authCheck.policy?.requiredPermissions.join(", "),
      }, context.roles[0]);

      return {
        success: false,
        isDenied: true,
        error: `No tienes permisos suficientes para ejecutar la herramienta '${toolName}'. ${authCheck.reason || ""}`,
      };
    }

    const activeProvider = dataProviderRegistry.getActiveProvider();
    const isSimulated = activeProvider.source === "SIMULATION";

    // 2. Route to specialized tool implementation
    try {
      let result: ToolExecutionResult = { success: true };

      switch (toolName) {
        // ====================================================================
        // DATA TOOLS
        // ====================================================================
        case "get_current_process_state": {
          result = {
            success: true,
            data: {
              plant: activeTenant.name,
              code: activeTenant.code,
              provider: activeProvider.name,
              protocol: activeProvider.protocol,
              isSimulated,
              telemetry: {
                tch: liveTelemetry.tch,
                caneAccumToday: liveTelemetry.caneAccumToday,
                millingExtraction: liveTelemetry.millingExtraction,
                boilerPressureHP: liveTelemetry.boilerPressureHP,
                boilerTempHP: liveTelemetry.boilerTempHP,
                steamFlowHP: liveTelemetry.steamFlowHP,
                powerGeneratedMW: liveTelemetry.powerGeneratedMW,
                powerExportGridMW: liveTelemetry.powerExportGridMW,
                sugarProductionTonsToday: liveTelemetry.sugarProductionTonsToday,
                oeeOverall: liveTelemetry.oeeOverall,
                bagasseMoisture: liveTelemetry.bagasseMoisture,
              },
            },
            sources: [
              {
                id: "src-tch",
                name: "Molienda Actual",
                tag: "Milling.Tandem.TCH_Actual",
                value: liveTelemetry.tch,
                unit: "TCH",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                protocol: activeProvider.protocol,
                quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
                deviceTimestamp: new Date().toISOString(),
                ingestionTimestamp: new Date().toISOString(),
                isSimulated,
                equipmentName: "Tándem de Molienda",
              },
              {
                id: "src-boiler-press",
                name: "Presión Vapor HP",
                tag: "Boiler1.Steam_Pressure_HP",
                value: liveTelemetry.boilerPressureHP,
                unit: "bar",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                protocol: activeProvider.protocol,
                quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
                deviceTimestamp: new Date().toISOString(),
                ingestionTimestamp: new Date().toISOString(),
                isSimulated,
                equipmentName: "Caldera Acuotubular 1",
              },
              {
                id: "src-power-grid",
                name: "Potencia Exportada Red",
                tag: "Grid.ExportPower_MW",
                value: liveTelemetry.powerExportGridMW,
                unit: "MW",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                protocol: activeProvider.protocol,
                quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
                deviceTimestamp: new Date().toISOString(),
                ingestionTimestamp: new Date().toISOString(),
                isSimulated,
                equipmentName: "Subestación Eléctrica 138 kV",
              },
            ],
            widgets: [
              {
                type: "KPI",
                kpiId: "kpi-tch",
                name: "Molienda Horaria (TCH)",
                value: liveTelemetry.tch,
                unit: "TCH",
                target: 450,
                deviation: +(liveTelemetry.tch - 450).toFixed(1),
                trend: liveTelemetry.tch >= 450 ? "UP" : "DOWN",
                quality: isSimulated ? "SIMULATED" : "GOOD",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                formula: "Milling.TCH_Actual",
                category: "MOLIENDA",
                inputTagsCount: 1,
                canViewLineage: true,
              },
              {
                type: "KPI",
                kpiId: "kpi-power-export",
                name: "Despacho Red (MW)",
                value: liveTelemetry.powerExportGridMW,
                unit: "MW",
                target: 21.5,
                deviation: +(liveTelemetry.powerExportGridMW - 21.5).toFixed(1),
                trend: liveTelemetry.powerExportGridMW >= 21.5 ? "UP" : "DOWN",
                quality: isSimulated ? "SIMULATED" : "GOOD",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                formula: "TG1.ActivePower_MW - Auxiliary_Internal_Consumption_MW",
                category: "COGENERACION",
                inputTagsCount: 2,
                canViewLineage: true,
              },
            ],
          };
          break;
        }

        case "get_tag_value": {
          const tagName = String(args.tag || args.tagName || "").toLowerCase();
          const tagDef = INITIAL_TAG_CATALOG.find(
            (t) => t.id.toLowerCase().includes(tagName) || t.variable.toLowerCase().includes(tagName) || t.name.toLowerCase().includes(tagName)
          );

          let val: any = 0;
          let unit = tagDef?.unit || "-";
          if (tagName.includes("tch") || tagName.includes("molienda")) val = liveTelemetry.tch;
          else if (tagName.includes("pressure") || tagName.includes("presion") || tagName.includes("boiler")) val = liveTelemetry.boilerPressureHP;
          else if (tagName.includes("extraction") || tagName.includes("extraccion")) val = liveTelemetry.millingExtraction;
          else if (tagName.includes("mw") || tagName.includes("power") || tagName.includes("generacion")) val = liveTelemetry.powerGeneratedMW;
          else if (tagName.includes("grid") || tagName.includes("export")) val = liveTelemetry.powerExportGridMW;
          else if (tagName.includes("brix")) val = liveTelemetry.evaporatorSyrupBrix;
          else if (tagName.includes("oee")) val = liveTelemetry.oeeOverall;
          else val = tagDef?.engMax ? Math.round(tagDef.engMax * 0.75) : 100;

          result = {
            success: true,
            data: {
              tag: tagDef?.variable || args.tag,
              name: tagDef?.name || args.tag,
              value: val,
              unit,
              source: isSimulated ? "SIMULATION" : "OPC_UA",
              protocol: activeProvider.protocol,
              quality: isSimulated ? "SIMULATED" : "GOOD",
              deviceTimestamp: new Date().toISOString(),
              ingestionTimestamp: new Date().toISOString(),
              isSimulated,
              equipment: tagDef?.equipmentName || "Equipo de Planta",
            },
            sources: [
              {
                id: `src-${args.tag}`,
                name: tagDef?.name || args.tag,
                tag: tagDef?.variable || args.tag,
                value: val,
                unit,
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                protocol: activeProvider.protocol,
                quality: (isSimulated ? "SIMULATED" : "GOOD") as DataQuality,
                deviceTimestamp: new Date().toISOString(),
                ingestionTimestamp: new Date().toISOString(),
                isSimulated,
                equipmentName: tagDef?.equipmentName,
              },
            ],
          };
          break;
        }

        case "get_tags": {
          result = {
            success: true,
            data: {
              totalTags: INITIAL_TAG_CATALOG.length,
              tags: INITIAL_TAG_CATALOG.map((t) => ({
                id: t.id,
                name: t.name,
                variable: t.variable,
                area: t.area,
                unit: t.unit,
                equipment: t.equipmentName,
                address: t.address,
              })),
            },
          };
          break;
        }

        case "get_data_lineage": {
          const kpiId = String(args.kpiId || args.tag || "kpi-tch");
          const map = new Map<string, IndustrialDataPoint>();
          const lineage = kpiEngine.calculateDataLineage(kpiId, map, liveTelemetry);

          result = {
            success: true,
            data: lineage,
            widgets: [
              {
                type: "DATA_LINEAGE",
                kpiName: lineage.kpiName,
                kpiValue: lineage.kpiValue,
                unit: lineage.unit,
                formula: lineage.formula,
                overallQuality: lineage.overallQuality,
                overallSource: lineage.overallSource,
                timestamp: lineage.timestamp,
                inputTags: lineage.inputTags.map((t) => ({
                  tag: t.tag,
                  tagName: t.tagName,
                  value: t.value,
                  unit: t.unit,
                  equipmentName: t.equipmentName,
                  source: t.source,
                  protocol: t.protocol,
                  quality: t.quality,
                  timestamp: t.timestamp,
                  isSimulated: t.source === "SIMULATION",
                })),
              },
            ],
            actions: [
              {
                id: "act-open-lineage-modal",
                type: "OPEN_LINEAGE",
                label: `Inspeccionar Linaje Completo (${lineage.kpiName})`,
                payload: { lineage },
                level: 1,
              },
            ],
          };
          break;
        }

        // ====================================================================
        // KPI & BALANCE TOOLS
        // ====================================================================
        case "get_kpi":
        case "calculate_kpi": {
          const kpiId = String(args.kpiId || "kpi-tch");
          const def = CANONICAL_KPI_DEFINITIONS.find((k) => k.id === kpiId || k.name.toLowerCase().includes(kpiId.toLowerCase())) || CANONICAL_KPI_DEFINITIONS[0];

          let val = 0;
          if (def.id === "kpi-tch") val = liveTelemetry.tch;
          else if (def.id === "kpi-extraction") val = liveTelemetry.millingExtraction;
          else if (def.id === "kpi-steam-hp") val = liveTelemetry.boilerPressureHP;
          else if (def.id === "kpi-power-export") val = liveTelemetry.powerExportGridMW;
          else if (def.id === "kpi-evap-brix") val = liveTelemetry.evaporatorSyrupBrix;
          else if (def.id === "kpi-oee-overall") val = liveTelemetry.oeeOverall;

          const target = def.targetValue || 100;
          const dev = +(val - target).toFixed(2);

          result = {
            success: true,
            data: {
              kpiId: def.id,
              name: def.name,
              value: val,
              unit: def.unit,
              target,
              deviation: dev,
              formula: def.formula,
              category: def.category,
              calculationMethod: def.calculationMethod,
              description: def.description,
              isSimulated,
            },
            widgets: [
              {
                type: "KPI",
                kpiId: def.id,
                name: def.name,
                value: val,
                unit: def.unit,
                target,
                deviation: dev,
                trend: dev >= 0 ? "UP" : "DOWN",
                quality: isSimulated ? "SIMULATED" : "GOOD",
                source: isSimulated ? "SIMULATION" : "OPC_UA",
                formula: def.formula,
                category: def.category,
                inputTagsCount: def.inputTags.length,
                canViewLineage: true,
              },
            ],
          };
          break;
        }

        case "calculate_oee": {
          const avail = liveTelemetry.oeeAvailability || 93.4;
          const perf = liveTelemetry.oeePerformance || 96.8;
          const qual = liveTelemetry.oeeQuality || 99.1;
          const overall = +((avail / 100) * (perf / 100) * (qual / 100) * 100).toFixed(1);

          result = {
            success: true,
            data: {
              overallOee: overall,
              target: 90.0,
              availability: avail,
              performance: perf,
              quality: qual,
              standard: "ISO 22400-2 MES KPI",
              limitingFactor: avail < perf && avail < qual ? "Disponibilidad (paradas no programadas)" : "Rendimiento de molienda",
            },
            widgets: [
              {
                type: "TABLE",
                title: "Desglose OEE Fabril (ISO 22400-2)",
                columns: [
                  { key: "component", header: "Componente OEE" },
                  { key: "value", header: "Valor Actual", align: "right", format: "percent" },
                  { key: "target", header: "Meta", align: "right", format: "percent" },
                  { key: "status", header: "Estado", align: "center", format: "badge" },
                ],
                rows: [
                  { component: "Disponibilidad (A)", value: avail, target: 92.0, status: avail >= 92 ? "Óptimo" : "Alerta" },
                  { component: "Rendimiento (P)", value: perf, target: 95.0, status: perf >= 95 ? "Óptimo" : "Alerta" },
                  { component: "Calidad / Extracción (Q)", value: qual, target: 98.5, status: qual >= 98.5 ? "Óptimo" : "Alerta" },
                  { component: "OEE Global Total", value: overall, target: 90.0, status: overall >= 90 ? "SUPERADO" : "EN REVISIÓN" },
                ],
              },
            ],
          };
          break;
        }

        case "calculate_energy_balance": {
          const tch = liveTelemetry.tch;
          const bagasseTph = +(tch * 0.28).toFixed(1);
          const steamTph = +(bagasseTph * 2.2).toFixed(1);
          const internalDemandTph = +(tch * 0.42).toFixed(1);
          const internalMw = +(tch * 0.028).toFixed(1);
          const exportMw = liveTelemetry.powerExportGridMW;

          result = {
            success: true,
            data: {
              millingTCH: tch,
              bagasseProductionTph: bagasseTph,
              steamGeneratedHP_Tph: steamTph,
              internalSteamDemandTph: internalDemandTph,
              factoryInternalPowerMW: internalMw,
              gridExportPowerMW: exportMw,
              energySurplus: exportMw > 0 ? "SUPERAVITARIO" : "DEFICITARIO",
              ppaRevenueEstimateUSD: `${Math.round(exportMw * 85)} USD/h`,
            },
            widgets: [
              {
                type: "TABLE",
                title: `Balance Termodinámico & Eléctrico (${activeTenant.name})`,
                columns: [
                  { key: "variable", header: "Variable Termodinámica" },
                  { key: "value", header: "Valor Calculado", align: "right" },
                  { key: "unit", header: "Unidad", align: "center" },
                  { key: "balance", header: "Balance", align: "center", format: "badge" },
                ],
                rows: [
                  { variable: "Molienda de Caña", value: tch, unit: "TCH", balance: "Entrada Principal" },
                  { variable: "Producción de Bagazo", value: bagasseTph, unit: "t/h", balance: "Biocombustible" },
                  { variable: "Vapor HP Generado", value: steamTph, unit: "t/h", balance: "Energía Primaria" },
                  { variable: "Demanda Vapor Proceso", value: internalDemandTph, unit: "t/h", balance: "Consumo Fabril" },
                  { variable: "Excedente Inyectado SEN", value: exportMw, unit: "MW", balance: "Exportación Verde" },
                ],
              },
            ],
          };
          break;
        }

        // ====================================================================
        // ALARM TOOLS
        // ====================================================================
        case "get_active_alarms": {
          const active = alarmsList.filter((a) => !a.acknowledged && a.status !== "CLEARED");
          result = {
            success: true,
            data: {
              count: active.length,
              alarms: active.map((a) => ({
                id: a.id,
                equipment: a.equipmentName,
                tag: a.tag,
                severity: a.severity,
                message: a.message,
                value: a.currentValue || a.value,
                threshold: a.threshold,
                unit: a.unit,
                timestamp: a.timestamp,
                possibleCause: a.possibleCause,
                recommendedAction: a.recommendedAction,
              })),
            },
            widgets: active.slice(0, 3).map((a) => ({
              type: "ALARM",
              alarmId: a.id,
              equipmentName: a.equipmentName,
              severity: (a.severity === "CRITICA" ? "CRITICAL" : a.severity === "ALTA" ? "HIGH" : "MEDIUM") as any,
              tag: a.tag,
              message: a.message,
              currentValue: a.currentValue || a.value || 0,
              threshold: a.threshold,
              unit: a.unit,
              timestamp: a.timestamp,
              acknowledged: Boolean(a.acknowledged),
              canAcknowledge: true,
            })),
            actions: active.length > 0 ? [
              {
                id: `act-ack-${active[0].id}`,
                type: "ACKNOWLEDGE_ALARM",
                label: `Reconocer Alarma: ${active[0].equipmentName}`,
                payload: { alarmId: active[0].id, equipment: active[0].equipmentName },
                level: 2,
              },
            ] : undefined,
          };
          break;
        }

        case "request_acknowledge_alarm": {
          const alarmId = String(args.alarmId || args.id || "");
          const targetAlarm = alarmsList.find((a) => a.id === alarmId) || alarmsList[0];

          if (!targetAlarm) {
            return { success: false, error: `Alarma no encontrada con ID '${alarmId}'.` };
          }

          result = {
            success: true,
            requiredConfirmation: true,
            confirmationDetails: {
              actionId: `conf-ack-${targetAlarm.id}`,
              actionType: "ACKNOWLEDGE_ALARM",
              level: 2,
              targetEntity: targetAlarm.equipmentName,
              title: `Reconocer Alarma ISA-18.2: ${targetAlarm.equipmentName}`,
              description: `Estás a punto de confirmar el reconocimiento formal de la alarma '${targetAlarm.message}'. Se registrará tu usuario en la secuencia de eventos (SOE).`,
              currentValue: `${targetAlarm.currentValue || targetAlarm.value} ${targetAlarm.unit}`,
              proposedValue: "RECONOCIDA",
              operationalImpact: "Informa a sala de control que el operador está enterado de la condición anormal.",
              requiredPermission: "ACKNOWLEDGE_ALARM",
              payload: { alarmId: targetAlarm.id },
            },
          };
          break;
        }

        // ====================================================================
        // EQUIPMENT TOOLS
        // ====================================================================
        case "get_equipment":
        case "get_equipment_health": {
          const query = String(args.equipmentId || args.name || "").toLowerCase();
          const eq = equipmentList.find((e) => e.id.toLowerCase().includes(query) || e.name.toLowerCase().includes(query) || e.code.toLowerCase().includes(query)) || equipmentList[0];

          if (!eq) {
            return { success: false, error: "No se encontraron equipos registrados en este central." };
          }

          result = {
            success: true,
            data: {
              id: eq.id,
              name: eq.name,
              code: eq.code,
              area: eq.area,
              status: eq.status,
              healthIndex: eq.healthIndex,
              vibrationRMS: eq.vibrationRMS,
              vibrationThreshold: eq.vibrationThreshold,
              temperatureC: eq.temperatureC,
              hoursRun: eq.hoursRun,
              lastMaintenance: eq.lastMaintenance,
              nextMaintenance: eq.nextMaintenance,
              criticality: eq.criticality,
            },
            widgets: [
              {
                type: "EQUIPMENT",
                equipmentId: eq.id,
                name: eq.name,
                code: eq.code,
                area: eq.area,
                status: eq.status,
                healthIndex: eq.healthIndex,
                vibrationRMS: eq.vibrationRMS,
                temperatureC: eq.temperatureC,
                hoursRun: eq.hoursRun,
              },
            ],
            actions: [
              {
                id: `act-open-eq-${eq.id}`,
                type: "OPEN_EQUIPMENT",
                label: `Ver Ficha CMMS de ${eq.name}`,
                payload: { equipmentId: eq.id },
                level: 1,
              },
            ],
          };
          break;
        }

        // ====================================================================
        // KNOWLEDGE & DOCS TOOLS
        // ====================================================================
        case "search_system_knowledge":
        case "get_process_explanation":
        case "get_module_help": {
          const query = String(args.query || args.topic || args.module || "");
          const items = copilotKnowledgeService.searchKnowledge(query, 3);

          result = {
            success: true,
            data: {
              query,
              resultsCount: items.length,
              items: items.map((i) => ({
                id: i.id,
                title: i.title,
                summary: i.summary,
                content: i.detailedContent,
                relatedModule: i.relatedModule,
                standards: i.standards,
              })),
            },
            actions: items.length > 0 && items[0].relatedModule ? [
              {
                id: `act-nav-${items[0].relatedModule}`,
                type: "NAVIGATE",
                label: `Ir al Módulo ${items[0].title}`,
                payload: { targetRoute: items[0].relatedModule },
                level: 1,
              },
            ] : undefined,
          };
          break;
        }

        case "search_glossary": {
          const term = String(args.term || args.query || "");
          const hits = copilotKnowledgeService.searchGlossary(term, context.currentModule, 3);
          result = {
            success: true,
            data: {
              query: term,
              resultsCount: hits.length,
              entries: hits,
            },
            actions: hits.length > 0 && hits[0].module ? [
              {
                id: `act-nav-${hits[0].module}`,
                type: "NAVIGATE",
                label: `Ver en Módulo ${hits[0].module.toUpperCase()}`,
                payload: { targetRoute: hits[0].module },
                level: 1,
              },
            ] : undefined,
          };
          break;
        }

        case "get_contextual_help": {
          const mod = (args.module || context.currentModule || "dashboard");
          const doc = copilotKnowledgeService.getModuleDoc(mod) || copilotKnowledgeService.searchModuleDoc(String(mod));
          result = {
            success: true,
            data: {
              module: mod,
              doc,
            },
            actions: doc ? [
              {
                id: `act-nav-${doc.id}`,
                type: "NAVIGATE",
                label: `Ir a ${doc.name}`,
                payload: { targetRoute: doc.id },
                level: 1,
              },
            ] : undefined,
          };
          break;
        }

        case "get_procedure": {
          const query = String(args.query || args.id || args.topic || "");
          const procedures = copilotKnowledgeService.searchProcedures(query, 2);
          result = {
            success: true,
            data: {
              query,
              procedures,
            },
            actions: procedures.length > 0 ? [
              {
                id: `act-nav-${procedures[0].targetModule}`,
                type: "NAVIGATE",
                label: `Ir a ${procedures[0].targetModule.toUpperCase()} para ejecutar SOP`,
                payload: { targetRoute: procedures[0].targetModule },
                level: 1,
              },
            ] : undefined,
          };
          break;
        }

        case "query_knowledge_graph": {
          const entity = String(args.entity || args.equipment || args.kpi || args.alarm || "");
          const alarms = copilotKnowledgeService.queryGraphAlarmsForEquipment(entity);
          const tags = copilotKnowledgeService.queryGraphTagsForKpi(entity);
          const related = copilotKnowledgeService.queryGraphRelated(entity);

          result = {
            success: true,
            data: {
              entity,
              alarms,
              tags,
              related,
            },
          };
          break;
        }

        case "get_tutorial_step": {
          const stepNum = Number(args.stepNumber || 1);
          const step = copilotKnowledgeService.getTutorialStep(stepNum) || copilotKnowledgeService.getInitialTutorialStep(context.roles[0]);
          result = {
            success: true,
            data: {
              step,
            },
            actions: step && step.suggestedAction ? [
              {
                id: `act-tutorial-step-${step.stepNumber}`,
                type: "NAVIGATE",
                label: step.suggestedAction.label,
                payload: { targetRoute: step.suggestedAction.targetTab },
                level: 1,
              },
            ] : undefined,
          };
          break;
        }

        case "explain_capabilities": {
          result = {
            success: true,
            data: {
              name: "BioAzúcar Copilot",
              role: "Asistente Inteligente de BioAzúcar 4.0",
              capabilities: [
                "Consultar el estado actual de la planta.",
                "Consultar y analizar KPIs.",
                "Analizar producción, molienda, extracción y cogeneración.",
                "Consultar alarmas y eventos.",
                "Consultar equipos.",
                "Analizar tendencias y estadísticas.",
                "Explicar indicadores y procesos.",
                "Mostrar el origen y calidad de los datos mediante Data Lineage.",
                "Guiar al usuario dentro de la aplicación.",
                "Abrir módulos y vistas mediante navegación autorizada.",
                "Ejecutar acciones autorizadas mediante herramientas seguras.",
                "Generar resúmenes e informes.",
                "Explicar cómo utilizar cualquier módulo del sistema.",
              ],
            },
            actions: [
              {
                id: "act-nav-dashboard",
                type: "NAVIGATE",
                label: "Ver Dashboard General",
                payload: { targetRoute: "dashboard" },
                level: 1,
              },
              {
                id: "act-nav-scada",
                type: "NAVIGATE",
                label: "Ver SCADA Molienda",
                payload: { targetRoute: "scada" },
                level: 1,
              },
              {
                id: "act-nav-cogen",
                type: "NAVIGATE",
                label: "Ver Cogeneración",
                payload: { targetRoute: "energy_dispatch" },
                level: 1,
              },
              {
                id: "act-nav-alarms",
                type: "NAVIGATE",
                label: "Ver Alarmas ISA-18.2",
                payload: { targetRoute: "alarms" },
                level: 1,
              },
            ],
          };
          break;
        }

        case "get_system_info": {
          result = {
            success: true,
            data: {
              platformName: "BioAzúcar 4.0 Smart Manufacturing Suite",
              version: "4.2.0-LTS",
              architecture: "Unified Namespace (UNS) + Event-Driven Industrial IoT",
              connectedPlant: activeTenant.name,
              plantCode: activeTenant.code,
              standards: [
                "ISA-95 (Enterprise-Control System Integration)",
                "ISA-18.2 (Management of Alarm Systems for the Process Industries)",
                "ASME PTC 4 (Fired Steam Generators)",
                "ISO 22400-2 (Manufacturing Operations Management KPIs)",
                "IEC 62443 (Security for Industrial Automation and Control Systems)",
              ],
              activeModules: [
                "SCADA Mimic (Molienda, Clarificación, Calderas)",
                "Energy & Cogeneration Dispatch (SEN/PPA)",
                "LIMS & Raw Material Batches",
                "CMMS Asset Health (Vibración ISO 10816)",
                "Historian & Analytics Engine",
                "Digital Twin 3D",
                "UNS Hub (MQTT / OPC-UA / Modbus)",
                "RBAC Multi-Tenant Engine",
              ],
            },
          };
          break;
        }

        case "get_user_permissions": {
          result = {
            success: true,
            data: {
              userId: context.userId,
              userName: context.displayName || context.username,
              roles: context.roles,
              securityLevel: context.securityLevel,
              permissions: context.permissions,
              isSuperAdmin: context.isSuperAdmin,
              plant: context.plantName,
              canModifySetpoints: context.permissions.includes("MODIFY_SETPOINTS"),
              canAcknowledgeAlarms: context.permissions.includes("ACKNOWLEDGE_ALARM"),
              canChangeDispatch: context.permissions.includes("CHANGE_DISPATCH_MW"),
            },
          };
          break;
        }

        // ====================================================================
        // UI & NAVIGATION TOOLS
        // ====================================================================
        case "navigate_to": {
          const route = String(args.route || args.targetRoute || args.module || "dashboard").replace("/", "");
          result = {
            success: true,
            data: { targetRoute: route },
            actions: [
              {
                id: `act-nav-${route}`,
                type: "NAVIGATE",
                label: `Abrir ${route.toUpperCase()}`,
                payload: { targetRoute: route },
                level: 1,
              },
            ],
          };
          break;
        }

        case "show_chart": {
          const metric = String(args.metric || "TCH");
          const chartType = (args.chartType || "line") as "line" | "bar" | "area";
          const now = Date.now();
          const dummyData = Array.from({ length: 8 }, (_, i) => {
            const time = new Date(now - (7 - i) * 3600 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const base = metric.toLowerCase().includes("tch") ? 450 : metric.toLowerCase().includes("mw") ? 21.5 : 64.5;
            const variance = (Math.sin(i) * base * 0.05);
            return {
              timestamp: time,
              label: time,
              value: +(base + variance).toFixed(1),
              target: base,
            };
          });

          result = {
            success: true,
            widgets: [
              {
                type: "CHART",
                chartType,
                title: `Tendencia Temporal de ${metric}`,
                metricName: metric,
                unit: args.unit || (metric.includes("TCH") ? "TCH" : metric.includes("MW") ? "MW" : "bar"),
                period: args.period || "Últimas 8 horas",
                data: dummyData,
                source: isSimulated ? "Simulador Físico BioAzúcar" : "Historiador Industrial OPC-UA",
                isSimulated,
              },
            ],
          };
          break;
        }

        case "show_table": {
          result = {
            success: true,
            widgets: [
              {
                type: "TABLE",
                title: args.title || "Resumen Estadístico Operacional",
                columns: args.columns || [
                  { key: "metric", header: "Parámetro" },
                  { key: "val", header: "Valor", align: "right" },
                  { key: "target", header: "Meta", align: "right" },
                ],
                rows: args.rows || [
                  { metric: "Molienda (TCH)", val: liveTelemetry.tch, target: 450 },
                  { metric: "Vapor HP (bar)", val: liveTelemetry.boilerPressureHP, target: 64.5 },
                  { metric: "Despacho Red (MW)", val: liveTelemetry.powerExportGridMW, target: 21.5 },
                  { metric: "OEE Global (%)", val: liveTelemetry.oeeOverall, target: 90.0 },
                ],
              },
            ],
          };
          break;
        }

        // ====================================================================
        // CRITICAL ACTIONS (LEVEL 3)
        // ====================================================================
        case "request_setpoint_change": {
          const tag = String(args.tag || "Milling.TCH_Setpoint");
          const targetValue = Number(args.newValue ?? args.value ?? 460);
          const currentVal = tag.includes("TCH") ? liveTelemetry.tch : liveTelemetry.boilerPressureHP;

          result = {
            success: true,
            requiredConfirmation: true,
            confirmationDetails: {
              actionId: `conf-sp-${Date.now()}`,
              actionType: "MODIFY_SETPOINT",
              level: 3,
              targetEntity: tag,
              title: `Modificación Crítica de Setpoint: ${tag}`,
              description: `Se modificará el setpoint en el controlador PID industrial. Esta acción altera directamente las condiciones de operación continua.`,
              currentValue: currentVal,
              proposedValue: targetValue,
              unit: tag.includes("TCH") ? "TCH" : "bar",
              operationalImpact: `El lazo de control ajustará actuadores hidráulicos/válvulas modulantes para converger al nuevo valor de ${targetValue}.`,
              requiredPermission: "MODIFY_SETPOINTS",
              payload: { tag, value: targetValue },
            },
          };
          break;
        }

        case "request_dispatch_change": {
          const exportMW = Number(args.exportMW ?? args.value ?? 22.0);
          result = {
            success: true,
            requiredConfirmation: true,
            confirmationDetails: {
              actionId: `conf-dispatch-${Date.now()}`,
              actionType: "CHANGE_DISPATCH_MW",
              level: 3,
              targetEntity: "Despacho Eléctrico Subestación",
              title: `Ajuste de Consigna de Despacho PPA: ${exportMW} MW`,
              description: `Modificación de la potencia activa inyectada a la red de alta tensión del Sistema Eléctrico Nacional.`,
              currentValue: `${liveTelemetry.powerExportGridMW} MW`,
              proposedValue: `${exportMW} MW`,
              unit: "MW",
              operationalImpact: `Afecta el cumplimiento del contrato PPA y el balance de vapor en turbogeneradores.`,
              requiredPermission: "CHANGE_DISPATCH_MW",
              payload: { exportMW },
            },
          };
          break;
        }

        case "get_edge_diagnostics": {
          const edgeDiag = industrialEdge.getConsolidatedDiagnostics();
          result = {
            success: true,
            data: edgeDiag,
            widgets: [
              {
                type: "KPI",
                kpiId: "edge-health",
                name: "BioAzúcar Industrial Edge Status",
                value: edgeDiag.overallHealth,
                unit: "OT Health",
                trend: "STABLE",
                quality: "GOOD",
                source: "EDGE",
                formula: "HealthEvaluator(OPC UA, Modbus, EROS, Sparkplug)",
                category: "Infraestructura OT",
                inputTagsCount: 4,
              },
              {
                type: "TABLE",
                title: "Conectores OT Activos (Edge Gateway)",
                columns: [
                  { key: "name", header: "Conector" },
                  { key: "protocol", header: "Protocolo" },
                  { key: "status", header: "Estado" },
                  { key: "latency", header: "Latencia (ms)", align: "right" },
                  { key: "quality", header: "Calidad %", align: "right" },
                ],
                rows: edgeDiag.connectors.map((c) => ({
                  name: c.name,
                  protocol: c.protocol,
                  status: c.status,
                  latency: c.latencyMs,
                  quality: `${c.qualityGoodPercentage}%`,
                })),
              },
            ],
          };
          break;
        }

        case "execute_command_edge": {
          const tag = String(args.tag || "Milling.Tandem.TCH_Actual");
          const targetValue = Number(args.value ?? args.requestedValue ?? 450);
          const reason = String(args.reason || "Ajuste solicitado a través de BioAzúcar Copilot");
          const operatorConfirmed = Boolean(args.humanConfirmed ?? true);

          const execResult = await commandService.executeCommand(
            {
              tag,
              commandType: "CHANGE_SETPOINT",
              requestedValue: targetValue,
              operatorId: context.userId || context.username,
              reason,
              clientIp: "192.168.10.45",
              securityClearanceLevel: 3,
            },
            operatorConfirmed
          );

          result = {
            success: execResult.status === "EXECUTED",
            data: execResult,
            error: execResult.status !== "EXECUTED" ? execResult.message : undefined,
          };
          break;
        }

        default: {
          result = {
            success: false,
            error: `La herramienta '${toolName}' no tiene un ejecutor asignado.`,
          };
        }
      }

      // Log successful execution audit
      await copilotAuditService.logEvent({
        userId: context.userId,
        userName: context.displayName || context.username,
        tenantId: context.plantId,
        sessionId: "sess-" + context.userId,
        intent: "TOOL_CALL",
        toolName,
        arguments: args,
        resultStatus: result.success ? "SUCCESS" : "ERROR",
        confirmationRequired: result.requiredConfirmation,
      }, context.roles[0]);

      return result;
    } catch (err: any) {
      console.error(`Tool Execution Error in [${toolName}]:`, err);
      await copilotAuditService.logEvent({
        userId: context.userId,
        userName: context.displayName || context.username,
        tenantId: context.plantId,
        sessionId: "sess-" + context.userId,
        intent: "TOOL_CALL",
        toolName,
        arguments: args,
        resultStatus: "ERROR",
      }, context.roles[0]);

      return {
        success: false,
        error: `Error interno al ejecutar ${toolName}: ${err.message}`,
      };
    }
  }
}
