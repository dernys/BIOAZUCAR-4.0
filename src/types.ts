export type UserRole = "superadmin" | "administrador" | "supervisor" | "operador" | "mantenimiento" | string;

export type PlantStatus = "OPERACION_NORMAL" | "ALERTA_PARCIAL" | "MANTENIMIENTO" | "PARADA_EMERGENCIA";

export type SimulationScenario = "NORMAL" | "VIBRACION_MOLINO3" | "CAIDA_PRESION_CALDERA" | "ALTO_BRIX_JUGOS" | "SOBRECARGA_RED_MW";

export type AlarmSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

export type EquipmentStatus = "RUNNING" | "WARNING" | "CRITICAL" | "STANDBY" | "MAINTENANCE";

export type NavigationTab =
  | "dashboard"
  | "scada"
  | "digital_twin"
  | "energy_dispatch"
  | "uns_hub"
  | "batches"
  | "equipment"
  | "historian"
  | "alarms"
  | "ai_center"
  | "system_config"
  | "enterprises"
  | "users_roles";

export type NavTabId = NavigationTab;

export interface TenantEnterprise {
  id: string;
  name: string;
  code: string;
  country: string;
  location: string;
  taxId: string;
  nominalTch: number; // Toneladas de caña por hora capacidad
  powerCapacityMW: number; // Potencia instalada MW
  boilerPressureBar: number; // Presión vapor HP nominal
  industrySector: string;
  status: "ACTIVE" | "MAINTENANCE" | "OFFSEASON" | "SUSPENDED";
  primaryAdminEmail: string;
  primaryContactPhone: string;
  createdAt: string;
  logoUrl?: string;
  themeColor?: string;
  description?: string;
  sugarYieldTarget?: number; // % Rendimiento
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId: string; // Tenant ID or "GLOBAL" / "ALL" for Superadmin
  department: string;
  badgeCode: string;
  isSuperAdmin?: boolean;
  lastLogin?: string;
  avatar?: string;
  securityLevel: number;
  phone?: string;
  isActive?: boolean;
  passwordHash?: string;
}

export interface SystemParameterConfig {
  id: string;
  category: "PLC_SCADA" | "IIOT_GATEWAYS" | "FIRESTORE_DB" | "SECURITY_RBAC" | "STEAM_ENERGY" | "QUALITY_LIMS" | "ENTERPRISE";
  name: string;
  key: string;
  currentValue: string | number | boolean;
  defaultValue: string | number | boolean;
  unit?: string;
  description: string;
  minLimit?: number;
  maxLimit?: number;
  status: "OPTIMAL" | "ATTENTION" | "VERIFIED" | "LOCKED";
  lastVerified: string;
  verifiedBy: string;
  tenantId?: string;
}

export interface TelemetryData {
  tenantId?: string;
  timestamp?: string;
  // Cane & Milling
  tch: number; // Toneladas de Caña por Hora (e.g. 450 TCH)
  caneAccumToday: number; // Toneladas acumuladas hoy (e.g. 8,420 t)
  caneBrix: number; // % Grados Brix jugo crudo (e.g. 18.5%)
  canePol: number; // % Pol sacarosa (e.g. 15.2%)
  canePurity: number; // Pureza % (e.g. 86.2%)
  caneFiber?: number; // % Fibra en caña
  millingExtraction: number; // Extracción % (e.g. 96.4%)
  imbibitionWaterFlow: number; // Agua de imbibición m3/h (e.g. 85 m3/h)
  
  // Bagasse & Biomass
  bagasseProductionRate: number; // t/h producidas (e.g. 135 t/h)
  bagasseBoilerConsumption: number; // t/h quemadas en caldera (e.g. 98 t/h)
  bagasseYardStorageRate: number; // t/h excedente a patio (e.g. 37 t/h)
  bagasseMoisture: number; // % Humedad bagazo (e.g. 48.8%)
  bagasseStockTotal?: number; // Toneladas en stock patio (e.g. 24,500 t)
  bagasseStockTotalTons?: number;
  
  // Steam & Boilers (ASME PTC 4)
  boilerPressureHP: number; // Bar (e.g. 64.5 bar)
  boilerTempHP: number; // °C (e.g. 485 °C)
  steamFlowHP: number; // t/h vapor alta (e.g. 210 t/h)
  steamPressureLP: number; // Bar vapor de escape a proceso (e.g. 2.2 bar)
  steamTempLP?: number; // °C (e.g. 135 °C)
  steamFlowLP?: number;
  boilerEfficiency: number; // % (e.g. 84.8%)
  flueGasO2: number; // % O2 en chimenea (e.g. 3.6%)
  flueGasTemp?: number; // °C (e.g. 162 °C)
  excessAirPercent?: number; // % Exceso de aire (e.g. 20.8%)
  bagasseLHV?: number; // kcal/kg Poder Calorífico Inferior
  
  // Cogeneration & Power Market
  powerGeneratedMW: number; // MW generados (e.g. 32.4 MW)
  powerInternalMW: number; // MW consumo ingenio (e.g. 11.2 MW)
  powerExportGridMW: number; // MW exportados a la red (e.g. 21.2 MW)
  gridFrequencyHz: number; // Hz (e.g. 60.02 Hz)
  powerFactor?: number; // Cos phi (e.g. 0.94)
  gridVoltageKV: number; // kV (e.g. 138.2 kV)
  spotPriceMWh?: number; // USD / MWh (e.g. $84.50)
  revenuePerHourUSD?: number; // USD/hora por venta eléctrica
  ppaContractMW?: number; // MW comprometidos por contrato
  
  // Sugar & Factory Process
  clarifiedJuiceFlow: number; // m3/h (e.g. 380 m3/h)
  evaporatorSyrupBrix: number; // Brix meladura (e.g. 66.5 °Bx)
  sugarProductionTonsToday: number; // Toneladas de azúcar hoy (e.g. 865 t)
  sugarBagsToday: number; // Sacos de 50kg hoy (e.g. 17,300 sacos)
  factoryRecoveryYield: number; // Rendimiento fabril % (e.g. 11.45%)
  molassesProductionTons: number; // Toneladas melaza (e.g. 280 t)
  massecuiteBrix?: number; // °Bx masa cocida en tachos
  vacuumPanPressureBar?: number; // Bar vacío en tachos (-0.85 bar)
  
  // Overall Equipment Effectiveness (OEE)
  oeeOverall: number; // % (e.g. 89.6%)
  oeeAvailability: number; // % (e.g. 93.4%)
  oeePerformance: number; // % (e.g. 96.8%)
  oeeQuality: number; // % (e.g. 99.1%)

  // Additional Diagnostic fields
  mill3Vibration?: number;
  boiler1Pressure?: number;
  simulationScenario?: string;
}

export interface EquipmentItem {
  id: string;
  tenantId?: string;
  name: string;
  code: string;
  area: "RECEPCION" | "MOLIENDA" | "CLARIFICACION" | "EVAPORACION" | "CRISTALIZACION" | "CALDERA" | "COGENERACION" | "ENSACADO" | string;
  status: EquipmentStatus;
  healthIndex: number; // 0 - 100%
  vibrationRMS: number; // mm/s
  vibrationThreshold: number; // mm/s
  temperatureC: number; // °C
  tempThreshold: number; // °C
  loadPercentage: number; // %
  hoursRun: number;
  lastMaintenance: string;
  nextMaintenance: string;
  plcTag: string;
  opcUaNode: string;
  description: string;
  criticality: "ALTA" | "MEDIA" | "BAJA" | "CRITICO_A" | "ESENCIAL_B" | "ESTANDAR_C";
}

export interface AlarmEvent {
  id: string;
  tenantId?: string;
  code?: string;
  timestamp: string;
  equipmentId: string;
  equipmentName: string;
  area: string;
  severity: AlarmSeverity | "CRITICAL" | "WARNING" | "INFO";
  tag: string;
  message: string;
  currentValue: number;
  value?: number;
  threshold: number;
  unit: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  shelved: boolean;
  possibleCause: string;
  recommendedAction: string;
  status?: "ACTIVE" | "ACKNOWLEDGED" | "CLEARED";
}

export interface CaneBatch {
  id: string;
  tenantId?: string;
  batchCode: string;
  truckPlate: string;
  driverName?: string;
  farmOrigin: string;
  lotSector?: string;
  growerName: string;
  caneVariety: string;
  grossWeightTons?: number;
  tareWeightTons?: number;
  netWeightTons: number;
  brixPercent: number;
  polPercent: number;
  purityPercent: number;
  trashPercent: number; // Materia extraña / cogollo %
  fiberPercent: number;
  dextranPpm?: number; // Dextrano ppm (deterioro microbiano)
  areKgPerTon?: number; // Azúcar Recuperable Equivalente (kg/t)
  canePaymentIndexUSD?: number; // Liquidación ($ USD / t)
  cutDateTime: string;
  arrivalDateTime: string;
  millingDateTime?: string;
  status: "EN_PATIO" | "EN_MUESTREO" | "EN_MOLIENDA" | "PROCESADO" | "RECHAZADO";
  sugarYieldEstimated: number; // Toneladas azúcar estimadas
}

export interface WorkOrder {
  id: string;
  tenantId?: string;
  code: string;
  equipmentId: string;
  equipmentName: string;
  title: string;
  type: "PREVENTIVO" | "CORRECTIVO" | "PREDICTIVO" | "LUBRICACION";
  priority: "URGENTE" | "ALTA" | "MEDIA" | "BAJA";
  status: "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "CANCELADA";
  assignedTo: string;
  createdDate: string;
  dueDate: string;
  estimatedHours: number;
  description: string;
  tasks: { id: string; text: string; done: boolean }[];
}

export interface IIoTNode {
  id: string;
  name: string;
  protocol: "OPC-UA" | "MQTT-SPARKPLUG" | "MODBUS-TCP" | "PROFINET" | "IEC-61850" | "MQTT" | "REST-API";
  endpoint: string;
  ipAddress: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  latencyMs: number;
  activeTagsCount: number;
  messageRateSec: number;
  lastHeartbeat: string;
  compressionRatio?: string;
  securityMode?: "None" | "SignAndEncrypt (Basic256Sha256)" | "TLS 1.3 / mTLS";
}

export interface ProcessTag {
  id: string;
  nodeId: string;
  tagAddress: string;
  name: string;
  area: string;
  unit: string;
  dataType: "FLOAT" | "INT" | "BOOL" | "STRING";
  currentValue: number | string | boolean;
  scanRateMs: number;
  highAlarm?: number;
  lowAlarm?: number;
  status: "GOOD" | "BAD" | "UNCERTAIN";
  unsTopic?: string; // Unified Namespace path
  deadbandPercent?: number;
}

export interface UNSNodeItem {
  id: string;
  topic: string;
  name: string;
  area: string;
  level: "Enterprise" | "Site" | "Area" | "Line" | "WorkCenter" | "Tag";
  currentValue: number | string | boolean;
  unit: string;
  datatype: string;
  quality: "GOOD" | "BAD" | "UNCERTAIN";
  timestamp: string;
  sparkplugMetricType: "Float" | "Int32" | "Boolean" | "String" | "DataSet";
  protocolSource: string;
}

export interface VibrationFFTPeak {
  frequencyHz: number;
  orderRPM: number; // e.g. 1.0X, 2.0X, 3.5X, BPFO
  amplitudeRMS: number; // mm/s
  faultType: "NORMAL" | "DESBALANCE_1X" | "DESALINEACION_2X" | "DEFECTO_PISTA_EXTERNA_BPFO" | "DEFECTO_PISTA_INTERNA_BPFI" | "HOLGURA_MECANICA";
  severity: "NORMAL" | "ALERTA" | "CRITICA";
}

export interface AIDiagnosticResult {
  id: string;
  timestamp: string;
  equipment: string;
  metric: string;
  currentValue: number;
  threshold: number;
  unit: string;
  rootCause: string;
  severity: "CRÍTICA" | "ALTA" | "MODERADA" | "LEVE";
  immediateAction: string;
  maintenanceRecommendation: string;
  financialImpact: string;
  confidenceScore: number;
  isAiGenerated: boolean;
}

export interface RbacRoleDefinition {
  id?: string;
  role: UserRole;
  title: string;
  description: string;
  badgeColor: string;
  canWriteSetpoints: boolean;
  canAcknowledgeAlarms: boolean;
  canShelveAlarms: boolean;
  canCreateWorkOrders: boolean;
  canApproveWorkOrders: boolean;
  canChangeDispatchMW: boolean;
  canExportHistorian: boolean;
  canAddCaneBatches: boolean;
  canModifyPlantParams: boolean;
  canAccessAiCenter: boolean;
  canManageTenants?: boolean;
  canManageUsers?: boolean;
  securityClearanceLevel: number;
  tenantId?: string;
  isSystem?: boolean;
}

export interface AuditLogEntry {
  id: string;
  tenantId?: string;
  timestamp: string;
  userRole: UserRole;
  userName: string;
  action: string;
  module: string;
  targetId: string;
  previousValue?: string;
  newValue?: string;
  status: "AUTHORIZED" | "DENIED" | "EXECUTED";
  ipAddress: string;
}

// ---------------------------------------------------------
// CANONICAL INDUSTRIAL DATA ARCHITECTURE (IEC 62443 / ISA-95)
// ---------------------------------------------------------

export type DataQuality =
  | "GOOD"
  | "UNCERTAIN"
  | "BAD"
  | "STALE"
  | "COMMUNICATION_LOST"
  | "SIMULATED"
  | "OUT_OF_RANGE"
  | "SUBSTITUTED"
  | "NOT_CONFIGURED";

export type DataSourceType =
  | "SIMULATION"
  | "OPC_UA"
  | "MQTT"
  | "SPARKPLUG"
  | "MODBUS"
  | "EROS"
  | "REST"
  | "EDGE";

export type ProtocolType =
  | "OPC-UA"
  | "MQTT"
  | "MQTT-SPARKPLUG"
  | "MODBUS-TCP"
  | "MODBUS-RTU"
  | "EROS-NATIVE"
  | "REST-API"
  | "IEC-61850"
  | "SIMULATOR";

export type OperationalPermission =
  | "READ"
  | "ANALYZE"
  | "ACKNOWLEDGE"
  | "OPERATE"
  | "CONTROL"
  | "ADMIN";

export type IEC62443SecurityLevel = "SL1" | "SL2" | "SL3" | "SL4";

export type NetworkZoneType =
  | "ZONE_0_FIELD"
  | "ZONE_1_BASIC_CONTROL"
  | "ZONE_2_SUPERVISORY"
  | "ZONE_3_OPERATIONS_DMZ"
  | "ZONE_4_ENTERPRISE";

export interface IndustrialDataPoint {
  id: string;
  tag: string;
  equipmentId: string;
  assetId?: string;
  siteId?: string;
  areaId: string;
  tenantId?: string;
  value: number | string | boolean;
  unit: string;
  dataType: "FLOAT" | "INTEGER" | "BOOLEAN" | "STRING";
  source: DataSourceType;
  protocol: ProtocolType;
  quality: DataQuality;
  qualityReason?: string;
  deviceTimestamp: string;
  ingestionTimestamp: string;
  sequence: number;
  sequenceNumber?: number;
  isHistorical: boolean;
  isSimulated: boolean;
  securityClearanceLevel?: number;
  engMin?: number;
  engMax?: number;
  description?: string;
  correlationId?: string;
}

export interface IndustrialTagDefinition {
  id: string;
  name: string;
  description: string;
  area: string;
  equipmentId: string;
  equipmentName: string;
  variable: string;
  unit: string;
  dataType: "FLOAT" | "INTEGER" | "BOOLEAN" | "STRING";
  source: DataSourceType;
  protocol: ProtocolType;
  address: string; // e.g. "ns=2;s=Mill1.TCH_Actual", "DB10.DBD4", "EROS.MOLINO.TCH"
  accessMode: "READ" | "READ_WRITE";
  scanRateMs: number;
  deadband: number;
  engMin: number;
  engMax: number;
  historization: boolean;
  alarmEnabled: boolean;
  highAlarm?: number;
  lowAlarm?: number;
  highHighAlarm?: number;
  lowLowAlarm?: number;
  securityLevel: number; // 1 to 5
  qualityRules?: string;
  status: "ACTIVE" | "INACTIVE" | "DEPRECATED";
  tenantId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OTConnectionConfig {
  id: string;
  name: string;
  type: "PLC" | "GATEWAY" | "SCADA" | "OPC_UA_SERVER" | "MQTT_BROKER" | "MODBUS_DEVICE" | "EROS_ADAPTER";
  host: string;
  port: number;
  protocol: ProtocolType;
  security: "NONE" | "TLS_1_2" | "TLS_1_3" | "BASIC_256_SHA256" | "SIGN_ENCRYPT";
  certificateRef?: string;
  credentialsRef?: string;
  timeoutMs: number;
  retryPolicy: string;
  heartbeatIntervalSec: number;
  status: "ONLINE" | "OFFLINE" | "DEGRADED" | "SIMULATION";
  lastHeartbeat: string;
  latencyMs: number;
  activeTagsCount: number;
  messageRateSec: number;
  tenantId?: string;
  description?: string;
  endpoints?: string[];
}

export interface KpiDefinition {
  id: string;
  name: string;
  category: "MOLIENDA" | "VAPOR" | "COGENERACION" | "CALIDAD" | "EFICIENCIA_OEE";
  unit: string;
  formula: string;
  inputTags: string[];
  calculationMethod: string;
  description: string;
  targetValue?: number;
  minOptimal?: number;
  maxOptimal?: number;
  tenantId?: string;
}

export interface DataLineageInfo {
  kpiName: string;
  kpiValue: number | string | boolean;
  unit: string;
  formula: string;
  description?: string;
  inputTags: Array<{
    tag: string;
    tagName: string;
    value: number | string | boolean;
    unit: string;
    equipmentId: string;
    equipmentName: string;
    source: DataSourceType;
    protocol: ProtocolType;
    quality: DataQuality;
    timestamp: string;
  }>;
  timestamp: string;
  overallQuality: DataQuality;
  overallSource: DataSourceType;
}

export interface ConnectionDiagnostics {
  connected: boolean;
  status: "ONLINE" | "OFFLINE" | "DEGRADED" | "SIMULATION";
  protocol: ProtocolType;
  source: DataSourceType;
  lastPingMs: number;
  packetsReceived: number;
  packetsSent: number;
  errorRatePercent: number;
  uptimeSeconds: number;
  serverTime: string;
}

