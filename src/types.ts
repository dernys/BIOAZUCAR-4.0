export type UserRole = "administrador" | "supervisor" | "operador" | "mantenimiento";

export type PlantStatus = "OPERACION_NORMAL" | "ALERTA_PARCIAL" | "MANTENIMIENTO" | "PARADA_EMERGENCIA";

export type SimulationScenario = "NORMAL" | "VIBRACION_MOLINO3" | "CAIDA_PRESION_CALDERA" | "ALTO_BRIX_JUGOS" | "SOBRECARGA_RED_MW";

export type AlarmSeverity = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";

export type EquipmentStatus = "RUNNING" | "WARNING" | "CRITICAL" | "STANDBY" | "MAINTENANCE";

export interface TelemetryData {
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
  
  // Steam & Boilers
  boilerPressureHP: number; // Bar (e.g. 64.5 bar)
  boilerTempHP: number; // °C (e.g. 485 °C)
  steamFlowHP: number; // t/h vapor alta (e.g. 210 t/h)
  steamPressureLP: number; // Bar vapor de escape a proceso (e.g. 2.2 bar)
  steamTempLP?: number; // °C (e.g. 135 °C)
  steamFlowLP?: number;
  boilerEfficiency: number; // % (e.g. 84.8%)
  flueGasO2: number; // % O2 en chimenea (e.g. 3.6%)
  
  // Cogeneration & Power
  powerGeneratedMW: number; // MW generados (e.g. 32.4 MW)
  powerInternalMW: number; // MW consumo ingenio (e.g. 11.2 MW)
  powerExportGridMW: number; // MW exportados a la red (e.g. 21.2 MW)
  gridFrequencyHz: number; // Hz (e.g. 60.02 Hz)
  powerFactor?: number; // Cos phi (e.g. 0.94)
  gridVoltageKV: number; // kV (e.g. 138.2 kV)
  
  // Sugar & Factory Process
  clarifiedJuiceFlow: number; // m3/h (e.g. 380 m3/h)
  evaporatorSyrupBrix: number; // Brix meladura (e.g. 66.5 °Bx)
  sugarProductionTonsToday: number; // Toneladas de azúcar hoy (e.g. 865 t)
  sugarBagsToday: number; // Sacos de 50kg hoy (e.g. 17,300 sacos)
  factoryRecoveryYield: number; // Rendimiento fabril % (e.g. 11.45%)
  molassesProductionTons: number; // Toneladas melaza (e.g. 280 t)
  
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
  name: string;
  code: string;
  area: "RECEPCION" | "MOLIENDA" | "CLARIFICACION" | "EVAPORACION" | "CRISTALIZACION" | "CALDERA" | "COGENERACION" | "ENSACADO";
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
  criticality: "ALTA" | "MEDIA" | "BAJA";
}

export interface AlarmEvent {
  id: string;
  code?: string;
  timestamp: string;
  equipmentId: string;
  equipmentName: string;
  area: string;
  severity: AlarmSeverity;
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
  batchCode: string;
  truckPlate: string;
  farmOrigin: string;
  growerName: string;
  caneVariety: string;
  netWeightTons: number;
  brixPercent: number;
  polPercent: number;
  purityPercent: number;
  trashPercent: number; // Materia extraña / cogollo
  fiberPercent: number;
  cutDateTime: string;
  arrivalDateTime: string;
  millingDateTime?: string;
  status: "EN_PATIO" | "EN_MUESTREO" | "EN_MOLIENDA" | "PROCESADO" | "RECHAZADO";
  sugarYieldEstimated: number; // Toneladas azúcar estimadas
}

export interface WorkOrder {
  id: string;
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
  protocol: "OPC-UA" | "MQTT" | "MODBUS-TCP" | "PROFINET" | "REST-API";
  endpoint: string;
  ipAddress: string;
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  latencyMs: number;
  activeTagsCount: number;
  messageRateSec: number;
  lastHeartbeat: string;
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
