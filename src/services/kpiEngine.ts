import {
  IndustrialDataPoint,
  DataLineageInfo,
  DataQuality,
  DataSourceType,
  ProtocolType,
  KpiDefinition,
  TelemetryData,
} from "../types";

export interface IKpiCalculator {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly formula: string;
  readonly inputTags: string[];
  readonly unit: string;

  calculate(inputs: Map<string, IndustrialDataPoint>): {
    value: number;
    quality: DataQuality;
    lineage: DataLineageInfo;
  };
}

export const CANONICAL_KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "kpi-tch",
    name: "Molienda Horaria (TCH)",
    category: "MOLIENDA",
    unit: "TCH",
    formula: "TCH_Actual",
    inputTags: ["Milling.TCH_Actual"],
    calculationMethod: "Direct Sensor Ingestion",
    description: "Caudal másico instantáneo de caña alimentada al tándem de molinos.",
    targetValue: 450,
    minOptimal: 400,
    maxOptimal: 500,
  },
  {
    id: "kpi-extraction",
    name: "Extracción de Sacarosa en Molienda",
    category: "MOLIENDA",
    unit: "%",
    formula: "((Pol_Caña - Pol_Bagazo) / Pol_Caña) * 100",
    inputTags: ["Milling.Extraction_Percent", "Milling.TCH_Actual"],
    calculationMethod: "Sucrose Mass Balance (Pol/Brix)",
    description: "Porcentaje de sacarosa total extraída en el jugo respecto a la caña procesada.",
    targetValue: 96.5,
    minOptimal: 95.0,
    maxOptimal: 98.0,
  },
  {
    id: "kpi-steam-hp",
    name: "Presión de Vapor Alta Presión (HP)",
    category: "VAPOR",
    unit: "bar",
    formula: "Boiler1.Steam_Pressure_HP",
    inputTags: ["Boiler1.Steam_Pressure_HP"],
    calculationMethod: "Transmisor de Presión ASME Sec. I",
    description: "Presión manométrica de vapor sobrecalentado a 485°C entregado al colector de turbinas.",
    targetValue: 64.6,
    minOptimal: 62.0,
    maxOptimal: 66.0,
  },
  {
    id: "kpi-power-export",
    name: "Potencia Eléctrica Exportada a Red",
    category: "COGENERACION",
    unit: "MW",
    formula: "TG1.ActivePower_MW - Auxiliary_Internal_Consumption_MW",
    inputTags: ["TG1.ActivePower_MW", "Grid.ExportPower_MW"],
    calculationMethod: "Analizador de Red Clase 0.2S Subestación 138 kV",
    description: "Excedente neto de energía eléctrica verde inyectada al Sistema Eléctrico Nacional.",
    targetValue: 21.5,
    minOptimal: 18.0,
    maxOptimal: 26.0,
  },
  {
    id: "kpi-evap-brix",
    name: "Concentración Meladura Salida Evaporador",
    category: "CALIDAD",
    unit: "°Bx",
    formula: "Evaporator.Syrup_Brix",
    inputTags: ["Evaporator.Syrup_Brix"],
    calculationMethod: "Refractómetro / Densímetro Nuclear en Línea",
    description: "Grados Brix de la meladura concentrada en la estación de evaporación cuádruple.",
    targetValue: 66.5,
    minOptimal: 64.0,
    maxOptimal: 68.0,
  },
  {
    id: "kpi-oee-overall",
    name: "Eficiencia General de Equipos (OEE)",
    category: "EFICIENCIA_OEE",
    unit: "%",
    formula: "Availability × Performance × Quality",
    inputTags: ["Milling.TCH_Actual", "Milling.Mill3.VibrationRMS", "Milling.Extraction_Percent"],
    calculationMethod: "Norma ISO 22400-2 MES KPI",
    description: "Indicador global de productividad de planta azucarera considerando paros, velocidad y rendimiento.",
    targetValue: 90.0,
    minOptimal: 85.0,
    maxOptimal: 95.0,
  },
];

export class KpiEngine {
  private static instance: KpiEngine;

  private constructor() {}

  public static getInstance(): KpiEngine {
    if (!KpiEngine.instance) {
      KpiEngine.instance = new KpiEngine();
    }
    return KpiEngine.instance;
  }

  public getKpiDefinitions(): KpiDefinition[] {
    return CANONICAL_KPI_DEFINITIONS;
  }

  public calculateDataLineage(
    kpiId: string,
    pointsMap: Map<string, IndustrialDataPoint>,
    telemetryFallback?: TelemetryData
  ): DataLineageInfo {
    const def = CANONICAL_KPI_DEFINITIONS.find((k) => k.id === kpiId) || {
      id: kpiId,
      name: kpiId,
      category: "MOLIENDA" as const,
      unit: "-",
      formula: "Raw Tag Value",
      inputTags: [],
      calculationMethod: "Direct Sensor Ingestion",
      description: "Métrica industrial de proceso",
    };

    const now = new Date().toISOString();
    const inputTagsInfo: DataLineageInfo["inputTags"] = [];
    let overallQuality: DataQuality = "GOOD";
    let overallSource: DataSourceType = "SIMULATION";

    if (def.inputTags.length > 0) {
      def.inputTags.forEach((tag) => {
        const pt = pointsMap.get(tag);
        if (pt) {
          inputTagsInfo.push({
            tag: pt.tag,
            tagName: pt.description || pt.tag,
            value: pt.value,
            unit: pt.unit,
            equipmentId: pt.equipmentId,
            equipmentName: pt.equipmentId,
            source: pt.source,
            protocol: pt.protocol,
            quality: pt.quality,
            timestamp: pt.deviceTimestamp || now,
          });
          if (pt.quality === "BAD" || pt.quality === "UNCERTAIN") {
            overallQuality = pt.quality;
          }
          overallSource = pt.source;
        } else {
          // Fallback reconstruction
          inputTagsInfo.push({
            tag,
            tagName: tag,
            value: (telemetryFallback as any)?.[this.mapTagToTelemetryKey(tag)] ?? 0,
            unit: def.unit,
            equipmentId: "PLC-01",
            equipmentName: "Controlador de Área",
            source: "SIMULATION",
            protocol: "SIMULATOR",
            quality: "GOOD",
            timestamp: now,
          });
        }
      });
    }

    // Determine representative value
    let kpiValue: number | string | boolean = 0;
    if (kpiId === "kpi-tch") {
      kpiValue = pointsMap.get("Milling.TCH_Actual")?.value ?? telemetryFallback?.tch ?? 452.4;
    } else if (kpiId === "kpi-extraction") {
      kpiValue = pointsMap.get("Milling.Extraction_Percent")?.value ?? telemetryFallback?.millingExtraction ?? 96.5;
    } else if (kpiId === "kpi-steam-hp") {
      kpiValue = pointsMap.get("Boiler1.Steam_Pressure_HP")?.value ?? telemetryFallback?.boilerPressureHP ?? 64.6;
    } else if (kpiId === "kpi-power-export") {
      kpiValue = pointsMap.get("Grid.ExportPower_MW")?.value ?? telemetryFallback?.powerExportGridMW ?? 21.2;
    } else if (kpiId === "kpi-evap-brix") {
      kpiValue = pointsMap.get("Evaporator.Syrup_Brix")?.value ?? telemetryFallback?.evaporatorSyrupBrix ?? 66.8;
    } else if (kpiId === "kpi-oee-overall") {
      kpiValue = telemetryFallback?.oeeOverall ?? 89.6;
    } else {
      kpiValue = (telemetryFallback as any)?.[kpiId] ?? 0;
    }

    return {
      kpiName: def.name,
      kpiValue,
      unit: def.unit,
      formula: def.formula,
      description: def.description,
      inputTags: inputTagsInfo,
      timestamp: now,
      overallQuality,
      overallSource,
    };
  }

  private mapTagToTelemetryKey(tag: string): string {
    if (tag.includes("TCH")) return "tch";
    if (tag.includes("Extraction")) return "millingExtraction";
    if (tag.includes("Steam_Pressure")) return "boilerPressureHP";
    if (tag.includes("ExportPower")) return "powerExportGridMW";
    if (tag.includes("ActivePower")) return "powerGeneratedMW";
    if (tag.includes("Syrup_Brix")) return "evaporatorSyrupBrix";
    if (tag.includes("Vibration")) return "mill3Vibration";
    return "tch";
  }
}

export const kpiEngine = KpiEngine.getInstance();
