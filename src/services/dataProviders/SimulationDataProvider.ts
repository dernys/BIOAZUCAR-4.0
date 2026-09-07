import {
  IndustrialDataPoint,
  IndustrialTagDefinition,
  ConnectionDiagnostics,
  DataSourceType,
  ProtocolType,
  SimulationScenario,
  TelemetryData,
} from "../../types";
import { tenantRuntimeManager } from "../runtime/TenantRuntimeManager";
import {
  IIndustrialDataProvider,
  DataSubscriptionCallback,
  BatchSubscriptionCallback,
  TagWriteRequest,
  TagWriteResult,
} from "./IIndustrialDataProvider";

export class SimulationDataProvider implements IIndustrialDataProvider {
  readonly id = "provider-simulation-canonical";
  readonly name = "BioAzúcar Dynamic Process Simulator";
  readonly source: DataSourceType = "SIMULATION";
  readonly protocol: ProtocolType = "SIMULATOR";

  private connected: boolean = false;
  private timerId: any = null;
  private scanIntervalMs: number = 1000;
  private scenario: SimulationScenario = "NORMAL";
  private speedMultiplier: number = 1.0;
  private sequenceCounter: number = 0;
  private startTime: number = Date.now();

  private tagSubscribers = new Map<string, Set<DataSubscriptionCallback>>();
  private allSubscribers = new Set<BatchSubscriptionCallback>();

  // Current values memory store
  private currentPoints = new Map<string, IndustrialDataPoint>();

  // Internal state variables for coherent mass & energy balance
  private simState = {
    tch: 452.4,
    caneAccum: 8420.5,
    caneBrix: 18.8,
    canePol: 15.4,
    millingExtraction: 96.5,
    imbibitionWaterFlow: 85.8,
    bagasseProductionRate: 134.2,
    bagasseBoilerConsumption: 97.5,
    bagasseYardStorageRate: 36.7,
    bagasseMoisture: 48.8,
    bagasseStockTotal: 24530.0,
    boilerPressureHP: 64.6,
    boilerTempHP: 485.2,
    steamFlowHP: 211.5,
    steamPressureLP: 2.2,
    boilerEfficiency: 85.2,
    flueGasO2: 3.6,
    powerGeneratedMW: 32.5,
    powerInternalMW: 11.3,
    powerExportGridMW: 21.2,
    gridFrequencyHz: 60.02,
    gridVoltageKV: 138.1,
    clarifiedJuiceFlow: 382.0,
    evaporatorSyrupBrix: 66.8,
    sugarProductionTonsToday: 862.4,
    sugarBagsToday: 17248,
    factoryRecoveryYield: 11.42,
    molassesProductionTons: 279.5,
    oeeOverall: 89.6,
    oeeAvailability: 93.4,
    oeePerformance: 96.8,
    oeeQuality: 99.1,
    mill3Vibration: 2.4,
  };

  constructor() {
    this.initTagPoints();
  }

  public setScenario(scenario: SimulationScenario) {
    this.scenario = scenario;
    tenantRuntimeManager.getRuntime("BIOAZUCAR-DEMO").setScenario(scenario);
  }

  public getScenario(): SimulationScenario {
    return tenantRuntimeManager.getRuntime("BIOAZUCAR-DEMO").getSimulationConfig().scenario || this.scenario;
  }

  public setSpeedMultiplier(speed: number) {
    this.speedMultiplier = Math.max(0.1, Math.min(10, speed));
    tenantRuntimeManager.getRuntime("BIOAZUCAR-DEMO").getSimulationRuntime().setSpeedMultiplier(speed);
  }

  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  async connect(): Promise<boolean> {
    if (this.connected) return true;
    this.connected = true;
    this.startSimulationLoop();
    return true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async readTag(tagAddress: string): Promise<IndustrialDataPoint | null> {
    return this.currentPoints.get(tagAddress) || null;
  }

  async readManyTags(tagAddresses: string[]): Promise<Map<string, IndustrialDataPoint>> {
    const result = new Map<string, IndustrialDataPoint>();
    for (const tag of tagAddresses) {
      const pt = this.currentPoints.get(tag);
      if (pt) result.set(tag, pt);
    }
    return result;
  }

  subscribeTag(tagAddress: string, callback: DataSubscriptionCallback): () => void {
    if (!this.tagSubscribers.has(tagAddress)) {
      this.tagSubscribers.set(tagAddress, new Set());
    }
    this.tagSubscribers.get(tagAddress)!.add(callback);

    // Initial dispatch if point exists
    const current = this.currentPoints.get(tagAddress);
    if (current) {
      callback(current);
    }

    return () => {
      this.tagSubscribers.get(tagAddress)?.delete(callback);
    };
  }

  subscribeAll(callback: BatchSubscriptionCallback): () => void {
    this.allSubscribers.add(callback);
    // Initial dispatch
    callback(Array.from(this.currentPoints.values()));

    return () => {
      this.allSubscribers.delete(callback);
    };
  }

  async writeTag(request: TagWriteRequest): Promise<TagWriteResult> {
    const now = new Date().toISOString();
    const existing = this.currentPoints.get(request.tag);

    if (request.securityClearanceLevel < 2) {
      return {
        success: false,
        tag: request.tag,
        newValue: request.value,
        timestamp: now,
        source: this.source,
        message: "Nivel de autorización insuficiente para escritura OT/PLC (Requiere Nivel >= 2)",
      };
    }

    const prevVal = existing ? existing.value : undefined;

    // Apply value to sim state if recognized
    const numVal = Number(request.value);
    if (!isNaN(numVal)) {
      if (request.tag.includes("TCH") || request.tag.includes("Milling.TCH")) {
        this.simState.tch = numVal;
      } else if (request.tag.includes("Boiler.HP_Pressure") || request.tag.includes("BOILER_PRESS")) {
        this.simState.boilerPressureHP = numVal;
      } else if (request.tag.includes("Grid.ExportPower_MW") || request.tag.includes("DISPATCH")) {
        this.simState.powerExportGridMW = numVal;
      }
    }

    // Update point
    if (existing) {
      existing.value = request.value;
      existing.deviceTimestamp = now;
      existing.ingestionTimestamp = now;
    }

    return {
      success: true,
      tag: request.tag,
      previousValue: prevVal,
      newValue: request.value,
      timestamp: now,
      source: this.source,
      message: `Escritura de setpoint aplicada con éxito en Simulador Canónico (${request.tag} = ${request.value})`,
    };
  }

  async getDiagnostics(): Promise<ConnectionDiagnostics> {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    return {
      connected: this.connected,
      status: this.connected ? "SIMULATION" : "OFFLINE",
      protocol: this.protocol,
      source: this.source,
      lastPingMs: 1,
      packetsReceived: this.sequenceCounter,
      packetsSent: this.sequenceCounter,
      errorRatePercent: 0,
      uptimeSeconds: uptime,
      serverTime: new Date().toISOString(),
    };
  }

  async browseTags(): Promise<IndustrialTagDefinition[]> {
    return Array.from(this.currentPoints.values()).map((p) => ({
      id: `tag-${p.tag}`,
      name: p.description || p.tag,
      description: p.description || "",
      area: p.areaId,
      equipmentId: p.equipmentId,
      equipmentName: p.equipmentId,
      variable: p.tag,
      unit: p.unit,
      dataType: p.dataType,
      source: "SIMULATION",
      protocol: "SIMULATOR",
      address: p.tag,
      accessMode: "READ_WRITE",
      scanRateMs: this.scanIntervalMs,
      deadband: 0.1,
      engMin: p.engMin ?? 0,
      engMax: p.engMax ?? 1000,
      historization: true,
      alarmEnabled: true,
      securityLevel: 2,
      status: "ACTIVE",
    }));
  }

  // Generate TelemetryData snapshot for backward compatibility with UI components
  public getTelemetrySnapshot(): TelemetryData {
    return tenantRuntimeManager.getRuntime("BIOAZUCAR-DEMO").getTelemetrySnapshot();
  }

  private startSimulationLoop() {
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.tick();
    }, this.scanIntervalMs);
  }

  private tick() {
    this.sequenceCounter++;
    const now = new Date().toISOString();
    const jitter = (amount: number) => (Math.random() - 0.5) * 2 * amount;
    const dtHours = (this.scanIntervalMs / 3600000) * this.speedMultiplier;

    // Coherent scenario dynamics
    let baseTch = 450;
    let vibM3 = 2.4;
    let boilerPress = 64.6;
    let boilerO2 = 3.6;
    let boilerEff = 85.2;
    let syrupBrix = 66.8;
    let exportMW = 21.4;

    switch (this.scenario) {
      case "VIBRACION_MOLINO3":
        baseTch = 410;
        vibM3 = 5.4 + jitter(0.4);
        break;
      case "CAIDA_PRESION_CALDERA":
        boilerPress = 54.2 + jitter(1.5);
        boilerO2 = 5.2 + jitter(0.3);
        boilerEff = 78.5;
        break;
      case "ALTO_BRIX_JUGOS":
        syrupBrix = 71.5 + jitter(0.5);
        baseTch = 435;
        break;
      case "SOBRECARGA_RED_MW":
        exportMW = 24.8 + jitter(0.3);
        baseTch = 480;
        boilerPress = 66.0;
        break;
      case "NORMAL":
      default:
        baseTch = 452;
        vibM3 = 2.4 + jitter(0.15);
        boilerPress = 64.6 + jitter(0.3);
        break;
    }

    const currentTCH = Math.max(0, baseTch + jitter(4));
    this.simState.tch = currentTCH;
    this.simState.caneAccum += currentTCH * dtHours;

    // Mass & Energy balance equations
    const bagasseProd = currentTCH * 0.295;
    const bagasseCons = (boilerPress / 64.6) * 98.0 + jitter(1.0);
    this.simState.bagasseProductionRate = bagasseProd;
    this.simState.bagasseBoilerConsumption = bagasseCons;
    this.simState.bagasseYardStorageRate = bagasseProd - bagasseCons;
    this.simState.bagasseStockTotal += (bagasseProd - bagasseCons) * dtHours;

    this.simState.boilerPressureHP = boilerPress;
    this.simState.boilerEfficiency = boilerEff;
    this.simState.flueGasO2 = boilerO2;
    this.simState.steamFlowHP = bagasseCons * 2.15 + jitter(2.0);

    this.simState.powerExportGridMW = exportMW;
    this.simState.powerGeneratedMW = exportMW + this.simState.powerInternalMW;

    this.simState.evaporatorSyrupBrix = syrupBrix;
    this.simState.mill3Vibration = vibM3;

    const sugarProduced = currentTCH * (this.simState.factoryRecoveryYield / 100) * dtHours;
    this.simState.sugarProductionTonsToday += sugarProduced;
    this.simState.sugarBagsToday = Math.floor(this.simState.sugarProductionTonsToday * 20);

    // Update canonical data points
    const updatedPoints: IndustrialDataPoint[] = [];

    const updatePoint = (
      tag: string,
      equipmentId: string,
      areaId: string,
      value: number | string | boolean,
      unit: string,
      dataType: "FLOAT" | "INTEGER" | "BOOLEAN" | "STRING",
      engMin: number,
      engMax: number,
      description: string
    ) => {
      const pt: IndustrialDataPoint = {
        id: `dp-${tag}`,
        tag,
        equipmentId,
        areaId,
        value,
        unit,
        dataType,
        source: "SIMULATION",
        protocol: "SIMULATOR",
        quality: "GOOD",
        deviceTimestamp: now,
        ingestionTimestamp: now,
        sequence: this.sequenceCounter,
        isHistorical: false,
        isSimulated: true,
        engMin,
        engMax,
        description,
      };
      this.currentPoints.set(tag, pt);
      updatedPoints.push(pt);

      // Notify tag subscribers
      const subs = this.tagSubscribers.get(tag);
      if (subs) {
        subs.forEach((cb) => cb(pt));
      }
    };

    updatePoint("Milling.TCH_Actual", "eq-molino-1", "MOLIENDA", +currentTCH.toFixed(1), "TCH", "FLOAT", 0, 600, "Flujo de Molienda Caña");
    updatePoint("Milling.CaneAccum_Today", "eq-molino-1", "MOLIENDA", +this.simState.caneAccum.toFixed(1), "t", "FLOAT", 0, 20000, "Caña Acumulada Hoy");
    updatePoint("Milling.Extraction_Percent", "eq-molino-1", "MOLIENDA", +this.simState.millingExtraction.toFixed(1), "%", "FLOAT", 80, 100, "Extracción Sacarosa Tándem");
    updatePoint("Milling.Mill3.VibrationRMS", "eq-molino-3", "MOLIENDA", +vibM3.toFixed(2), "mm/s", "FLOAT", 0, 10, "Vibración Molino 3 Chumacera");
    updatePoint("Boiler1.Steam_Pressure_HP", "eq-caldera-1", "CALDERA", +boilerPress.toFixed(1), "bar", "FLOAT", 0, 100, "Presión Vapor Alta Caldera 1");
    updatePoint("Boiler1.Steam_Flow_HP", "eq-caldera-1", "CALDERA", +this.simState.steamFlowHP.toFixed(1), "t/h", "FLOAT", 0, 300, "Flujo Vapor Alta Caldera 1");
    updatePoint("Boiler1.Flue_O2", "eq-caldera-1", "CALDERA", +boilerO2.toFixed(1), "% O2", "FLOAT", 0, 10, "Exceso O2 Chimenea Caldera");
    updatePoint("TG1.ActivePower_MW", "eq-turbina-1", "COGENERACION", +this.simState.powerGeneratedMW.toFixed(1), "MW", "FLOAT", 0, 50, "Potencia Eléctrica Generada TG1");
    updatePoint("Grid.ExportPower_MW", "eq-turbina-1", "COGENERACION", +exportMW.toFixed(1), "MW", "FLOAT", 0, 40, "Potencia Eléctrica Exportada a Red");
    updatePoint("Evaporator.Syrup_Brix", "eq-evaporadores", "EVAPORACION", +syrupBrix.toFixed(1), "°Bx", "FLOAT", 40, 80, "Grados Brix Meladura Salida");
    updatePoint("Sugar.Production_Tons_Today", "eq-secador-ensacado", "ENSACADO", +this.simState.sugarProductionTonsToday.toFixed(1), "t", "FLOAT", 0, 3000, "Azúcar Producido Acumulado Hoy");
    updatePoint("Sugar.Bags_Count_Today", "eq-secador-ensacado", "ENSACADO", this.simState.sugarBagsToday, "sacos", "INTEGER", 0, 60000, "Sacos 50kg Producidos Hoy");

    // Notify all-subscribers
    this.allSubscribers.forEach((cb) => cb(updatedPoints));
  }

  private initTagPoints() {
    const now = new Date().toISOString();
    const defaults = [
      { tag: "Milling.TCH_Actual", eq: "eq-molino-1", area: "MOLIENDA", val: 452.4, unit: "TCH", dt: "FLOAT" as const, min: 0, max: 600, desc: "Flujo de Molienda Caña" },
      { tag: "Milling.CaneAccum_Today", eq: "eq-molino-1", area: "MOLIENDA", val: 8420.5, unit: "t", dt: "FLOAT" as const, min: 0, max: 20000, desc: "Caña Acumulada Hoy" },
      { tag: "Milling.Extraction_Percent", eq: "eq-molino-1", area: "MOLIENDA", val: 96.5, unit: "%", dt: "FLOAT" as const, min: 80, max: 100, desc: "Extracción Sacarosa Tándem" },
      { tag: "Milling.Mill3.VibrationRMS", eq: "eq-molino-3", area: "MOLIENDA", val: 2.4, unit: "mm/s", dt: "FLOAT" as const, min: 0, max: 10, desc: "Vibración Molino 3 Chumacera" },
      { tag: "Boiler1.Steam_Pressure_HP", eq: "eq-caldera-1", area: "CALDERA", val: 64.6, unit: "bar", dt: "FLOAT" as const, min: 0, max: 100, desc: "Presión Vapor Alta Caldera 1" },
      { tag: "Boiler1.Steam_Flow_HP", eq: "eq-caldera-1", area: "CALDERA", val: 211.5, unit: "t/h", dt: "FLOAT" as const, min: 0, max: 300, desc: "Flujo Vapor Alta Caldera 1" },
      { tag: "TG1.ActivePower_MW", eq: "eq-turbina-1", area: "COGENERACION", val: 32.5, unit: "MW", dt: "FLOAT" as const, min: 0, max: 50, desc: "Potencia Eléctrica Generada TG1" },
      { tag: "Grid.ExportPower_MW", eq: "eq-turbina-1", area: "COGENERACION", val: 21.2, unit: "MW", dt: "FLOAT" as const, min: 0, max: 40, desc: "Potencia Eléctrica Exportada a Red" },
      { tag: "Evaporator.Syrup_Brix", eq: "eq-evaporadores", area: "EVAPORACION", val: 66.8, unit: "°Bx", dt: "FLOAT" as const, min: 40, max: 80, desc: "Grados Brix Meladura Salida" },
    ];

    defaults.forEach((d) => {
      this.currentPoints.set(d.tag, {
        id: `dp-${d.tag}`,
        tag: d.tag,
        equipmentId: d.eq,
        areaId: d.area,
        value: d.val,
        unit: d.unit,
        dataType: d.dt,
        source: "SIMULATION",
        protocol: "SIMULATOR",
        quality: "GOOD",
        deviceTimestamp: now,
        ingestionTimestamp: now,
        sequence: 0,
        isHistorical: false,
        isSimulated: true,
        engMin: d.min,
        engMax: d.max,
        description: d.desc,
      });
    });
  }
}
