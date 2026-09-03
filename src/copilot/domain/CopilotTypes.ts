import {
  IndustrialDataPoint,
  DataQuality,
  DataSourceType,
  ProtocolType,
  UserRole,
  NavigationTab,
  TelemetryData,
  AlarmEvent,
  EquipmentItem,
  TenantEnterprise,
} from "../../types";
import { KnowledgeEvidenceBundle } from "./CopilotKnowledgeTypes";

// ============================================================================
// BIOAZÚCAR COPILOT — INDUSTRIAL DOMAIN TYPES
// ============================================================================

export type CopilotIntent =
  | "CAPABILITIES"
  | "HELP"
  | "GENERAL_QUESTION"
  | "SYSTEM_INFORMATION"
  | "PROCESS_STATE"
  | "KPI_ANALYSIS"
  | "STATISTICS"
  | "DIAGNOSTIC"
  | "ALARM"
  | "EQUIPMENT"
  | "DATA_LINEAGE"
  | "NAVIGATION"
  | "ACTION"
  | "CONFIGURATION"
  | "USER_PERMISSIONS"
  | "UNKNOWN"
  | "QUESTION"
  | "ANALYSIS"
  | "LINEAGE"
  | "CONFIRMATION"
  | "TUTORIAL"
  | "CONTEXTUAL_HELP"
  | "GLOSSARY_QUERY"
  | "PROCEDURE_QUERY"
  | "KNOWLEDGE_GRAPH_QUERY";

export type OperationSecurityLevel = 1 | 2 | 3; // 1: Read, 2: Low-Risk Write, 3: Critical

export interface CopilotUserContext {
  userId: string;
  username: string;
  displayName?: string;
  roles: UserRole[];
  permissions: string[];
  securityLevel: number;
  plantId: string;
  plantName: string;
  plantCode: string;
  areaId?: string;
  currentRoute: string;
  currentModule: NavigationTab;
  selectedEquipmentId?: string;
  selectedTag?: string;
  selectedDatePeriod?: string;
  locale: string;
  timezone: string;
  isSuperAdmin?: boolean;
}

export interface DataSourceReference {
  id: string;
  name: string;
  tag: string;
  value: number | string | boolean;
  unit: string;
  source: DataSourceType;
  protocol: ProtocolType;
  quality: DataQuality;
  deviceTimestamp: string;
  ingestionTimestamp: string;
  isSimulated: boolean;
  equipmentId?: string;
  equipmentName?: string;
  securityClearance?: number;
}

export interface ChartDataPoint {
  timestamp: string;
  label: string;
  value: number;
  target?: number;
  min?: number;
  max?: number;
  quality?: DataQuality;
}

export interface ChartWidget {
  type: "CHART";
  chartType: "line" | "bar" | "area" | "scatter";
  title: string;
  metricName: string;
  unit: string;
  period: string;
  data: ChartDataPoint[];
  source: string;
  isSimulated?: boolean;
}

export interface TableColumn {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  format?: "text" | "number" | "currency" | "percent" | "badge";
}

export interface TableWidget {
  type: "TABLE";
  title: string;
  columns: TableColumn[];
  rows: Record<string, any>[];
  statistics?: {
    average?: number | string;
    minimum?: number | string;
    maximum?: number | string;
    stdDev?: number | string;
    trend?: "UP" | "DOWN" | "STABLE";
    unit?: string;
  };
}

export interface KpiWidget {
  type: "KPI";
  kpiId: string;
  name: string;
  value: number | string;
  unit: string;
  target?: number;
  deviation?: number;
  deviationPercent?: number;
  trend?: "UP" | "DOWN" | "STABLE";
  quality: DataQuality;
  source: DataSourceType;
  formula: string;
  category: string;
  inputTagsCount: number;
  canViewLineage?: boolean;
}

export interface AlarmWidget {
  type: "ALARM";
  alarmId: string;
  equipmentName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  tag: string;
  message: string;
  currentValue: number;
  threshold: number;
  unit: string;
  timestamp: string;
  acknowledged: boolean;
  canAcknowledge?: boolean;
}

export interface EquipmentWidget {
  type: "EQUIPMENT";
  equipmentId: string;
  name: string;
  code: string;
  area: string;
  status: string;
  healthIndex: number;
  vibrationRMS?: number;
  temperatureC?: number;
  hoursRun?: number;
  activeAlarmsCount?: number;
}

export interface DataLineageWidget {
  type: "DATA_LINEAGE";
  kpiName: string;
  kpiValue: number | string | boolean;
  unit: string;
  formula: string;
  overallQuality: DataQuality;
  overallSource: DataSourceType;
  timestamp: string;
  inputTags: Array<{
    tag: string;
    tagName: string;
    value: number | string | boolean;
    unit: string;
    equipmentName: string;
    source: DataSourceType;
    protocol: ProtocolType;
    quality: DataQuality;
    timestamp: string;
    isSimulated: boolean;
  }>;
}

export interface StatisticsWidget {
  type: "STATISTICS";
  metric: string;
  period: string;
  sampleCount: number;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  p50: number;
  p95: number;
  unit: string;
  anomaliesDetected?: number;
}

export interface NavigationWidget {
  type: "NAVIGATION";
  targetRoute: NavigationTab;
  label: string;
  description?: string;
  iconName?: string;
  targetEntityId?: string;
}

export type CopilotWidget =
  | ChartWidget
  | TableWidget
  | KpiWidget
  | AlarmWidget
  | EquipmentWidget
  | DataLineageWidget
  | StatisticsWidget
  | NavigationWidget;

export interface CopilotAction {
  id: string;
  type:
    | "NAVIGATE"
    | "OPEN_LINEAGE"
    | "OPEN_EQUIPMENT"
    | "OPEN_TAG"
    | "OPEN_ALARM"
    | "ACKNOWLEDGE_ALARM"
    | "MODIFY_SETPOINT"
    | "GENERATE_REPORT";
  label: string;
  icon?: string;
  payload: Record<string, any>;
  level: OperationSecurityLevel;
  requiredPermission?: string;
  executed?: boolean;
}

export interface ActionConfirmationRequest {
  actionId: string;
  actionType: string;
  level: OperationSecurityLevel;
  targetEntity: string;
  title: string;
  description: string;
  currentValue?: string | number;
  proposedValue?: string | number;
  unit?: string;
  operationalImpact: string;
  requiredPermission: string;
  payload: Record<string, any>;
}

export interface CopilotResponse {
  message: string;
  intent: CopilotIntent;
  confidence?: number;
  sources?: DataSourceReference[];
  widgets?: CopilotWidget[];
  actions?: CopilotAction[];
  warnings?: string[];
  requiresConfirmation?: boolean;
  confirmationDetails?: ActionConfirmationRequest;
  isAiGenerated?: boolean;
  evidenceBundle?: KnowledgeEvidenceBundle;
  executionMetrics?: {
    latencyMs: number;
    toolsExecuted: string[];
    dataPointsConsulted: number;
  };
}

export interface CopilotChatOptions {
  message: string;
  context: CopilotUserContext;
  liveTelemetry: TelemetryData;
  alarmsList: AlarmEvent[];
  equipmentList: EquipmentItem[];
  activeTenant: TenantEnterprise;
  history?: Array<{ sender: "user" | "copilot"; text: string }>;
}

export interface CopilotChatMessage {
  id: string;
  sender: "user" | "copilot" | "system";
  text: string;
  timestamp: string;
  intent?: CopilotIntent;
  sources?: DataSourceReference[];
  widgets?: CopilotWidget[];
  actions?: CopilotAction[];
  warnings?: string[];
  requiresConfirmation?: boolean;
  confirmationDetails?: ActionConfirmationRequest;
  evidenceBundle?: KnowledgeEvidenceBundle;
  toolInvocations?: Array<{
    toolName: string;
    status: "RUNNING" | "COMPLETED" | "DENIED" | "FAILED";
    description: string;
  }>;
}

export interface CopilotAuditEvent {
  id: string;
  userId: string;
  userName: string;
  tenantId: string;
  sessionId: string;
  timestamp: string;
  intent: string;
  toolName?: string;
  arguments?: unknown;
  resultStatus: "SUCCESS" | "DENIED" | "ERROR";
  requiredPermission?: string;
  targetEntity?: string;
  confirmationRequired?: boolean;
  confirmationGranted?: boolean;
  clientIp?: string;
}

export interface CopilotMetrics {
  requestsTotal: number;
  toolCallsTotal: number;
  toolErrorsTotal: number;
  authDeniedTotal: number;
  confirmationsRequested: number;
  confirmationsApproved: number;
  confirmationsRejected: number;
  avgLatencyMs: number;
  tokensConsumedTotal: number;
}
