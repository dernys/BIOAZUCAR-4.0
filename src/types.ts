import type {
  IndustrialDataPoint,
  IndustrialRuntimeMode,
  IndustrialSourceType,
  IndustrialDataType,
  IndustrialDataQuality,
  IndustrialQualityReason,
  IndustrialCalibrationState,
  CanonicalIndustrialProtocol,
  IndustrialProtocol,
} from "./types/industrialDataPoint";

export type {
  IndustrialDataPoint,
  IndustrialRuntimeMode,
  IndustrialSourceType,
  IndustrialDataType,
  IndustrialDataQuality,
  IndustrialQualityReason,
  IndustrialCalibrationState,
  CanonicalIndustrialProtocol,
  IndustrialProtocol,
};
export {
  assertCanonicalDataPoint,
  validateIndustrialDataPoint,
  createCanonicalDataPoint,
  normalizeProtocol,
  CANONICAL_SCHEMA_VERSION,
} from "./types/industrialDataPoint";

export type UserRole = "superadmin" | "administrador" | "supervisor" | "operador" | "mantenimiento" | string;

export type PlantStatus = "OPERACION_NORMAL" | "ALERTA_PARCIAL" | "MANTENIMIENTO" | "PARADA_EMERGENCIA";

export type SimulationScenario =
  | "NORMAL"
  | "VIBRACION_MOLINO3"
  | "ALERTA_CALDERA"
  | "CAIDA_PRESION_CALDERA"
  | "BAGAZO_HUMEDO"
  | "PICO_EXPORTACION"
  | "PARADA_DESFIBRADORA"
  | "ALTO_BRIX_JUGOS"
  | "SOBRECARGA_RED_MW";

export type AlarmSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

export type EquipmentStatus = "RUNNING" | "WARNING" | "CRITICAL" | "STANDBY" | "MAINTENANCE";

export type NavigationTab =
  | "dashboard"
  | "scada"
  | "digital_twin"
  | "energy_dispatch"
  | "agricultural_pda"
  | "uns_hub"
  | "batches"
  | "equipment"
  | "historian"
  | "alarms"
  | "ai_center"
  | "system_config"
  | "enterprises"
  | "users_roles"
  | "presentation"
  | "industrial_connections"
  | "sat_fat_acceptance"
  | "commissioning_coverage";

export type NavTabId = NavigationTab;

export type OperationalMode = "SIMULATED" | "LIVE" | "HYBRID";

export type OperationalStatus =
  | "DRAFT"
  | "CONFIGURED"
  | "COMMISSIONING"
  | "CONNECTED"
  | "VALIDATED"
  | "OPERATIONAL"
  | "DEGRADED"
  | "OFFLINE"
  | "SUSPENDED";

export interface SubsystemsOperationalMode {
  scada?: "REAL" | "SIMULATED";
  opcua?: "REAL" | "SIMULATED";
  bascula?: "REAL" | "SIMULATED";
  lims?: "REAL" | "SIMULATED";
  agriculture?: "REAL" | "SIMULATED";
  energy?: "REAL" | "SIMULATED";
  maintenance?: "REAL" | "SIMULATED";
  [key: string]: "REAL" | "SIMULATED" | undefined;
}

export interface TenantPhysicalEvidence {
  hasActiveGateway: boolean;
  gatewayId?: string;
  lastHeartbeatTimestamp?: string;
  lastValidatedDataTimestamp?: string;
  activeTagsReceivingCount: number;
  isSimulatedDataOnly: boolean;
  dataQualityPassRate: number; // 0-100%
  validationErrors?: string[];
  
  // Real Commissioning Evidence metadata
  commissioningId?: string;
  connectionId?: string;
  protocol?: IndustrialProtocol;
  latencyMs?: number;
  continuityRatePercent?: number;
  storeAndForwardVerified?: boolean;
  reconnectVerified?: boolean;
  commissionedAt?: string;
  commissionedBy?: string;
  evidenceHash?: string;
  originRuntime?: "INDUSTRIAL_EDGE_DAEMON" | "CENTRAL_GATEWAY" | "LOCAL_RUNTIME" | "SIMULATION";
}

// ============================================================================
// PHASE 2 & 3: CONNECTION REGISTRY & INDUSTRIAL TAG REGISTRY CANONICAL MODELS
// ============================================================================

export type ConnectionStatus =
  | "NOT_CONFIGURED"
  | "CONFIGURED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTHENTICATED"
  | "READ_TEST_OK"
  | "RECEIVING"
  | "VALIDATED"
  | "DEGRADED"
  | "OFFLINE"
  | "FAILED"
  | "ERROR"
  | "PROTOCOL_SPEC_REQUIRED";

export type CriticalityLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface ConnectionRegistryEntry {
  id: string;
  tenantId: string;
  siteId: string;
  areaId?: string;
  name: string;
  protocol: IndustrialProtocol;
  endpoint: string;
  gatewayId: string;
  status: ConnectionStatus;
  criticality: CriticalityLevel;
  readOnly: boolean; // Must be true by default for OT safety
  enabled: boolean;
  securityProfile?: {
    securityPolicy?: string;
    securityMode?: string;
    tlsVersion?: string;
    authType?: "ANONYMOUS" | "CERTIFICATE" | "TOKEN" | "BASIC_AUTH";
  };
  certificateRef?: string; // Secret reference - never raw certs/keys
  secretRef?: string;      // Secret reference - never raw passwords/tokens
  expectedIntervalMs: number;
  maxSilenceMs: number;    // Must be strictly greater than expectedIntervalMs
  latencyBudgetMs: number;
  lastHeartbeatTimestamp?: string | null;
  lastDataTimestamp?: string | null;
  createdAt: string;
  updatedAt: string;
  configVersion: string;
  isDemoSimulation?: boolean; // Explicit flag separating demo/simulation fixtures from physical connections
}

export type TagDataType =
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "STRING"
  | "FLOAT"
  | "INT"
  | "BOOL";

export interface EngineeringRange {
  min: number;
  max: number;
  warningLow?: number;
  warningHigh?: number;
  alarmLow?: number;
  alarmHigh?: number;
}

export interface TagQualityRules {
  enforceRange?: boolean;
  maxRateOfChange?: number;
  staleAfterMs?: number;
  expectedValueRegex?: string;
}

export type TagSignedness = "SIGNED" | "UNSIGNED";
export type TagEndianness = "BIG_ENDIAN" | "LITTLE_ENDIAN" | "MID_BIG_ENDIAN" | "MID_LITTLE_ENDIAN";
export type TagSamplingMode = "POLLING" | "SUBSCRIPTION" | "ON_CHANGE";

// ISA-95 Physical & Functional Hierarchy Models
export interface IndustrialSite {
  id: string;
  tenantId: string;
  name: string;
  code: string;
  location?: string;
}

export interface IndustrialArea {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  code: string;
  description?: string;
}

export interface IndustrialProcessCell {
  id: string;
  tenantId: string;
  siteId: string;
  areaId: string;
  name: string;
  code: string;
}

export interface IndustrialAsset {
  id: string;
  tenantId: string;
  siteId: string;
  areaId: string;
  processCellId?: string;
  name: string;
  code: string;
  type?: string;
}

export interface IndustrialGateway {
  id: string;
  tenantId: string;
  siteId: string;
  name: string;
  ipAddress: string;
  hardwareModel?: string;
  osVersion?: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
}

// Device Engineering Model
export type IndustrialDeviceType =
  | "PLC"
  | "DCS"
  | "RTU"
  | "SMART_TRANSMITTER"
  | "DRIVE_VFD"
  | "POWER_METER"
  | "GATEWAY_MODULE";

export interface IndustrialDeviceDefinition {
  id: string;
  tenantId: string;
  siteId: string;
  areaId: string;
  processCellId?: string;
  assetId?: string;
  connectionId: string;
  name: string;
  deviceType: IndustrialDeviceType;
  vendor?: string;
  model?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  busAddress?: string | number; // e.g. Modbus Unit ID (1..247) or Profibus/DeviceNet node
  rack?: number;
  slot?: number;
  ipAddress?: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED" | "CONFIGURED" | "UNREACHABLE";
  criticality?: CriticalityLevel;
  tagsCount?: number;
  enabled?: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface IndustrialTagDefinition {
  id: string;
  tenantId?: string;
  siteId?: string;
  areaId?: string;
  processCellId?: string;
  assetId?: string;
  connectionId?: string;
  deviceId?: string;
  deviceName?: string;
  canonicalName?: string; // Unique per tenant/site/area/asset
  displayName?: string;
  sourceSystem?: string;
  sourceAddress?: string; // Required for physical protocols
  protocol?: IndustrialProtocol;
  dataType?: TagDataType;
  signedness?: TagSignedness;
  endianness?: TagEndianness;
  unit?: string;
  scale?: number;
  offset?: number;
  readable?: boolean;
  writable?: boolean; // Must be false by default
  samplingMode?: TagSamplingMode;
  samplingIntervalMs?: number;
  deadband?: number;
  staleTimeoutMs?: number;
  engineeringRange?: EngineeringRange; // Optional for non-numeric types
  qualityRules?: TagQualityRules;
  historianEnabled?: boolean;
  dashboardEnabled?: boolean;
  aiEnabled?: boolean;
  analyticsEnabled?: boolean;
  prometheusEnabled?: boolean;
  criticality?: CriticalityLevel;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  version?: string;

  // Legacy compatibility fields
  name?: string;
  description?: string;
  area?: string;
  equipmentId?: string;
  equipmentName?: string;
  variable?: string;
  source?: DataSourceType;
  address?: string;
  accessMode?: "READ" | "READ_WRITE";
  scanRateMs?: number;
  engMin?: number;
  engMax?: number;
  historization?: boolean;
  alarmEnabled?: boolean;
  highAlarm?: number;
  lowAlarm?: number;
  highHighAlarm?: number;
  lowLowAlarm?: number;
  securityLevel?: number;
  status?: "ACTIVE" | "INACTIVE" | "DEPRECATED";
}

export type TagSampleQuality = "GOOD" | "BAD" | "UNCERTAIN";
export type TagSampleAvailability = "AVAILABLE" | "STALE" | "UNAVAILABLE";
export type TagSampleValidationStatus = "PENDING" | "PASSED" | "REJECTED";
export type TagSampleOrigin = "LIVE_OT" | "SIMULATED" | "CALCULATED" | "IMPORTED" | "HISTORICAL";

export interface IndustrialTagSample {
  tagId: string;
  tenantId: string;
  siteId?: string;
  areaId?: string;
  assetId?: string;
  connectionId: string;
  canonicalName?: string;
  protocol?: IndustrialProtocol;
  sourceAddress?: string;

  value: number | boolean | string;
  unit?: string;

  // Explicitly decoupled quality vs availability
  quality: TagSampleQuality;
  availability: TagSampleAvailability;
  validationStatus: TagSampleValidationStatus;

  // Provenance & Devices
  origin: TagSampleOrigin;
  sourceSystem: string;
  sourceDevice: string;
  gatewayId?: string;

  // Three-stage temporal provenance
  sourceTimestamp: string;    // Sensor / PLC generation time
  gatewayTimestamp: string;   // Edge gateway reception time
  ingestionTimestamp: string; // Central backend ingestion time

  validationScore?: number; // Informational only
  validationNotes?: string;
}

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

  // Modelo Operacional Extendido (Fase 1)
  operationalMode?: OperationalMode;
  operationalStatus?: OperationalStatus;
  subsystemsMode?: SubsystemsOperationalMode;
  lastPhysicalEvidence?: TenantPhysicalEvidence;

  // Campos Legacy mantenidos para compatibilidad hacia atrás
  runtimeMode?: "SIMULATION" | "LIVE_OT" | "HYBRID" | "HISTORICAL_REPLAY";
  simulationEnabled?: boolean;
  simulationScenario?: SimulationScenario;
  otStatus?: "WAITING_FOR_COMMISSIONING" | "CONNECTED" | "DISCONNECTED" | "ERROR" | "RECONNECTING";

  // Especificaciones reales de molienda y tándem
  millCount?: number; // Número de molinos en tándem (ej. 5 o 6)
  rollerDiameterM?: number; // Diámetro de mazas en metros (ej. 1.07 m)
  rollerLengthM?: number; // Longitud de mazas en metros (ej. 2.13 m)
  nominalRpm?: number; // RPM de molienda nominal (ej. 4.5 RPM)
  imbibitionWaterRatio?: number; // % Imbibición sobre caña (ej. 28%)
  fiberPercentCane?: number; // % Fibra en caña (ej. 13.5%)

  // Calderas de Biomasa & Vapor HP real
  boilerSteamFlowTph?: number; // Flujo nominal de vapor HP (t/h, ej. 120 t/h)
  steamSuperheatTempC?: number; // Temperatura vapor sobrecalentado °C (ej. 480 °C)
  bagasseMoistureExpected?: number; // % Humedad nominal de bagazo (ej. 49.5%)

  // Conexiones OT y Protocolos Reales
  otProtocol?: "OPC_UA" | "MODBUS_TCP" | "MQTT_SPARKPLUG_B" | "SIEMENS_S7";
  otEndpointUrl?: string; // Endpoint URL (opc.tcp://..., mqtts://..., etc.)
  otPort?: number; // Puerto de comunicación (4840, 502, 8883, 102)
  otSecurityPolicy?: string; // Security Policy (Basic256Sha256 / Aes128_Sha256 / None)
  otSecurityMode?: string; // Mode (SignAndEncrypt / Sign / None)
  otGatewayHost?: string; // Dirección IP del gateway Edge industrial
  otTagsPrefix?: string; // Prefijo de topics UNS ISA-95
  unsTopicRoot?: string; // Topic raíz UNS ISA-95 (ej. bioazucar/central-01)

  // Observabilidad Prometheus / OpenMetrics
  prometheusMetricsPath?: string; // Ruta de métricas (/metrics)
  prometheusScrapePort?: number; // Puerto de métricas (3000)
  prometheusScrapeIntervalSec?: number; // Intervalo de scraping en segundos (15s)
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

export interface TenantMembership {
  id: string;
  userId: string;
  tenantId: string;
  role: UserRole;
  permissions: string[];
  securityLevel: number;
  status: "ACTIVE" | "SUSPENDED" | "INVITED";
  createdAt: string;
  assignedBy?: string;
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

  // Provenance & Simulation Metadata (IEC 62443 / ISA-95 Audit Standard)
  isSimulated?: boolean;
  provenance?: "SIMULATED_PROCESS_MODEL" | "LIVE_OT_GATEWAY" | "HISTORICAL_REPLAY" | string;
  source?: string;
  quality?: "GOOD" | "BAD" | "UNCERTAIN" | "SIMULATED";
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
  shelvedUntil?: string;
  shelvedAt?: string;
  shelvedBy?: string;
  shelveReason?: string;
  shelveDurationMinutes?: number;
  suppressionState?: "UNSUPPRESSED" | "SHELVED" | "SUPPRESSED_BY_DESIGN" | "OUT_OF_SERVICE";
  isaState?: "NORMAL" | "UNACK_ALARM" | "ACK_ALARM" | "RTN_UNACK" | "SHELVED_ACTIVE" | "SHELVED_CLEARED";
  interlockActive?: boolean;
  possibleCause: string;
  recommendedAction: string;
  suggestedAction?: string;
  status?: "ACTIVE" | "ACKNOWLEDGED" | "CLEARED";
}

export type CaneBatchStatus =
  | "RECEPCIONADO"
  | "EN_BASCULA"
  | "EN_PATIO"
  | "EN_MUESTREO"
  | "EN_MOLIENDA"
  | "PROCESADO"
  | "RECHAZADO";

export interface CaneBatch {
  id: string;
  tenantId?: string;
  campaignId?: string;                 // Temporal root anchor
  plotId?: string;                     // Trace back to field plot
  harvestOrderId?: string;             // Trace back to harvest order
  dispatchId?: string;                 // Trace back to road dispatch
  truckId?: string;
  weighingTicketId?: string;
  receptionId?: string;
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
  weighedDateTime?: string;
  millingDateTime?: string;
  status: CaneBatchStatus;
  sugarYieldEstimated: number; // Toneladas azúcar estimadas
  weighingProvenance?: "MEASURED_SCALE" | "SIMULATED_SCALE" | "CALCULATED" | "IMPORTED";
  // Data Governance
  dataClassification?: "OPERATIONAL_DATA" | "CONFIDENTIAL_FINANCIAL" | "MASTER_DATA" | "AUDIT_RECORD";
  dataOrigin?: "SCADA" | "LIMS" | "MANUAL" | "CALCULATED" | "SYSTEM" | "USER_ENTRY";
  dataQuality?: "VALIDATED" | "UNVERIFIED" | "INCOMPLETE" | "ESTIMATED" | "DERIVED";
  syncStatus?: "LOCAL_DRAFT" | "SYNCING" | "SYNCED" | "SYNC_ERROR" | "OFFLINE";
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type WorkOrderStatus =
  | "DRAFT"
  | "PLANNED"
  | "APPROVED"
  | "ASSIGNED"
  | "DISPATCHED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "VERIFIED"
  | "CLOSED"
  // Legacy Spanish statuses
  | "PENDIENTE"
  | "EN_PROCESO"
  | "COMPLETADA"
  | "CANCELADA";

export interface WorkOrder {
  id: string;
  tenantId?: string;
  campaignId?: string;                 // Temporal root anchor
  plotId?: string;
  requirementId?: string;              // Trace back to AgroWorkRequirement
  operationCategory?: string;
  code: string;
  equipmentId: string;
  equipmentName: string;
  title: string;
  type: "PREVENTIVO" | "CORRECTIVO" | "PREDICTIVO" | "LUBRICACION";
  priority: "URGENTE" | "ALTA" | "MEDIA" | "BAJA";
  status: WorkOrderStatus;
  assignedTo: string;
  createdDate: string;
  dueDate: string;
  estimatedHours: number;
  estimatedDurationHours?: number;
  description: string;
  tasks: { id: string; text: string; done: boolean }[];
  // Data Governance
  dataClassification?: "OPERATIONAL_DATA" | "CONFIDENTIAL_FINANCIAL" | "MASTER_DATA" | "AUDIT_RECORD";
  dataOrigin?: "SCADA" | "LIMS" | "MANUAL" | "CALCULATED" | "SYSTEM" | "USER_ENTRY";
  dataQuality?: "VALIDATED" | "UNVERIFIED" | "INCOMPLETE" | "ESTIMATED" | "DERIVED";
  syncStatus?: "LOCAL_DRAFT" | "SYNCING" | "SYNCED" | "SYNC_ERROR" | "OFFLINE";
  version?: string;
  updatedAt?: string;
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
  | "EDGE"
  | "LIVE_OT";

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

