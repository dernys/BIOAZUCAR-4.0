import {
  SimulationScenario,
  TelemetryData,
  IndustrialDataPoint,
  DataQuality,
  DataSourceType,
} from "../../types";
import { TenantConfiguration, HistorianRecord } from "./types";

export interface ScenarioDefinition {
  scenarioId: SimulationScenario;
  name: string;
  description: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  durationSeconds: number;
  affectedTags: string[];
  initialConditions: Record<string, number>;
  dynamicEffects: (elapsedSec: number, state: IndustrialState) => void;
  alarmEffects: Array<{ tag: string; severity: "CRITICA" | "ALTA" | "MEDIA"; message: string }>;
  equipmentEffects: Array<{ equipmentId: string; status: "RUNNING" | "WARNING" | "FAULT"; vibrationRMS?: number }>;
}

export interface IndustrialState {
  timestamp: string;
  tch: number;
  caneAccumToday: number;
  caneBrix: number;
  canePol: number;
  canePurity: number;
  millingExtraction: number;
  imbibitionWaterFlow: number;

  bagasseProductionRate: number;
  bagasseBoilerConsumption: number;
  bagasseYardStorageRate: number;
  bagasseMoisture: number;
  bagasseStockTotal: number;

  boilerPressureHP: number;
  boilerTempHP: number;
  steamFlowHP: number;
  steamPressureLP: number;
  steamTempLP: number;
  boilerEfficiency: number;
  flueGasO2: number;

  powerGeneratedMW: number;
  powerInternalMW: number;
  powerExportGridMW: number;
  gridFrequencyHz: number;
  powerFactor: number;
  gridVoltageKV: number;

  clarifiedJuiceFlow: number;
  evaporatorSyrupBrix: number;
  sugarProductionTonsToday: number;
  sugarBagsToday: number;
  factoryRecoveryYield: number;
  molassesProductionTons: number;

  oeeOverall: number;
  oeeAvailability: number;
  oeePerformance: number;
  oeeQuality: number;
  mill3Vibration: number;

  sequence: number;
}

export class IndustrialSimulationRuntime {
  private tenantId: string;
  private config: TenantConfiguration;
  private scenario: SimulationScenario = "NORMAL";
  private speedMultiplier: number = 1.0;
  private isRunning: boolean = true;
  private scenarioStartTime: number = Date.now();
  private state: IndustrialState;
  private historianBuffer: HistorianRecord[] = [];
  private maxHistorianBufferSize: number = 5000;
  private sequenceCounter: number = 0;

  constructor(tenantId: string, config: TenantConfiguration) {
    this.tenantId = tenantId;
    this.config = config;
    this.state = this.getInitialState();
  }

  private getInitialState(): IndustrialState {
    const cp = this.config.caneProcess;
    const bg = this.config.bagasse;
    const b = this.config.boilers;
    const g = this.config.grid;

    return {
      timestamp: new Date().toISOString(),
      tch: cp.nominalTch,
      caneAccumToday: 8420.5,
      caneBrix: cp.nominalBrix,
      canePol: cp.nominalPol,
      canePurity: cp.nominalPurity,
      millingExtraction: cp.nominalExtraction,
      imbibitionWaterFlow: cp.nominalTch * (cp.imbibitionWaterPercent / 100) * 0.67,

      bagasseProductionRate: cp.nominalTch * bg.productionFactor,
      bagasseBoilerConsumption: cp.nominalTch * bg.consumptionFactor,
      bagasseYardStorageRate: cp.nominalTch * (bg.productionFactor - bg.consumptionFactor),
      bagasseMoisture: bg.nominalMoisture,
      bagasseStockTotal: bg.initialStockTons,

      boilerPressureHP: b.designPressureBar * 0.994,
      boilerTempHP: b.designTempC,
      steamFlowHP: 211.5,
      steamPressureLP: 2.2,
      steamTempLP: 134.8,
      boilerEfficiency: b.nominalEfficiency,
      flueGasO2: b.targetO2Percent,

      powerGeneratedMW: g.installedCapacityMW * 0.99,
      powerInternalMW: g.internalConsumptionMW,
      powerExportGridMW: g.installedCapacityMW * 0.99 - g.internalConsumptionMW,
      gridFrequencyHz: g.gridFrequencyHz + 0.02,
      powerFactor: g.targetPowerFactor,
      gridVoltageKV: g.gridVoltageKV + 0.1,

      clarifiedJuiceFlow: cp.nominalTch * 0.85,
      evaporatorSyrupBrix: this.config.sugar.syrupBrixTarget,
      sugarProductionTonsToday: 862.4,
      sugarBagsToday: 17248,
      factoryRecoveryYield: cp.recoveryYieldTarget,
      molassesProductionTons: 279.5,

      oeeOverall: 89.6,
      oeeAvailability: 93.4,
      oeePerformance: 96.8,
      oeeQuality: 99.1,
      mill3Vibration: 2.4,

      sequence: 0,
    };
  }

  public setScenario(scenario: SimulationScenario): void {
    if (this.scenario !== scenario) {
      this.scenario = scenario;
      this.scenarioStartTime = Date.now();
    }
  }

  public getScenario(): SimulationScenario {
    return this.scenario;
  }

  public setSpeedMultiplier(speed: number): void {
    this.speedMultiplier = Math.max(0, Math.min(10, speed));
  }

  public getSpeedMultiplier(): number {
    return this.speedMultiplier;
  }

  public setRunning(running: boolean): void {
    this.isRunning = running;
  }

  public isSimulationRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Advance physical state by dt seconds, applying mass/energy conservation equations
   * and temporal evolution of the active scenario.
   */
  public step(dtSeconds: number = 1.0): TelemetryData {
    if (!this.isRunning || this.speedMultiplier === 0) {
      return this.toTelemetry();
    }

    const dt = dtSeconds * this.speedMultiplier;
    this.sequenceCounter++;
    this.state.sequence = this.sequenceCounter;
    this.state.timestamp = new Date().toISOString();

    const elapsedScenarioSec = (Date.now() - this.scenarioStartTime) / 1000;
    const jitter = (mag: number) => (Math.random() - 0.5) * 2 * mag;

    // 1. Nominal Base Process Variables
    const baseTch = this.config.caneProcess.nominalTch;

    // 2. Apply Scenario Effects
    switch (this.scenario) {
      case "NORMAL":
        this.state.tch = baseTch + jitter(6.0);
        this.state.mill3Vibration = Math.max(1.8, 2.4 + jitter(0.15));
        this.state.boilerPressureHP = 64.6 + jitter(0.3);
        this.state.boilerTempHP = 485.0 + jitter(1.5);
        this.state.flueGasO2 = 3.6 + jitter(0.1);
        this.state.bagasseMoisture = 48.8 + jitter(0.2);
        this.state.evaporatorSyrupBrix = 66.8 + jitter(0.2);
        break;

      case "VIBRACION_MOLINO3": {
        // Progressive ramp of mechanical vibration on mill 3
        const progress = Math.min(1.0, elapsedScenarioSec / 30);
        this.state.mill3Vibration = 2.4 + progress * (4.85 - 2.4) + jitter(0.15);
        this.state.tch = baseTch - progress * 25.0 + jitter(4.0); // operator slightly derates
        this.state.millingExtraction = 96.5 - progress * 1.2;
        break;
      }

      case "ALERTA_CALDERA": {
        // Incomplete combustion: O2 drops, temperature rises
        const progress = Math.min(1.0, elapsedScenarioSec / 25);
        this.state.flueGasO2 = Math.max(1.6, 3.6 - progress * 1.8 + jitter(0.1));
        this.state.boilerTempHP = 485.0 + progress * 18.0 + jitter(2.0);
        this.state.boilerEfficiency = Math.max(78.0, 85.2 - progress * 4.5);
        break;
      }

      case "CAIDA_PRESION_CALDERA": {
        // Severe boiler pressure loss due to steam demand / fuel hitch
        const progress = Math.min(1.0, elapsedScenarioSec / 45);
        this.state.boilerPressureHP = Math.max(52.0, 64.6 - progress * 11.2 + jitter(0.4));
        this.state.steamFlowHP = Math.max(165.0, 211.5 - progress * 35.0 + jitter(2.0));
        break;
      }

      case "BAGAZO_HUMEDO": {
        // Wet bagasse: high moisture, drop in LHV and boiler output
        const progress = Math.min(1.0, elapsedScenarioSec / 35);
        this.state.bagasseMoisture = Math.min(54.2, 48.8 + progress * 4.8 + jitter(0.2));
        this.state.boilerEfficiency = Math.max(79.0, 85.2 - progress * 5.0);
        this.state.boilerPressureHP = Math.max(58.0, 64.6 - progress * 5.5 + jitter(0.3));
        break;
      }

      case "PICO_EXPORTACION": {
        // High electric export into grid
        const progress = Math.min(1.0, elapsedScenarioSec / 20);
        this.state.powerGeneratedMW = Math.min(34.8, 32.5 + progress * 2.2 + jitter(0.15));
        this.state.powerExportGridMW = Math.min(23.8, 21.2 + progress * 2.4 + jitter(0.15));
        this.state.powerFactor = 0.96;
        break;
      }

      case "PARADA_DESFIBRADORA": {
        // Shredder trip: TCH falls rapidly to near zero, extraction halts
        const progress = Math.min(1.0, elapsedScenarioSec / 15);
        this.state.tch = Math.max(0, baseTch * (1 - progress) + jitter(2.0));
        this.state.imbibitionWaterFlow = Math.max(0, 85.8 * (1 - progress));
        this.state.clarifiedJuiceFlow = Math.max(0, 382.0 * (1 - progress));
        this.state.oeeAvailability = Math.max(65.0, 93.4 - progress * 25.0);
        break;
      }

      case "ALTO_BRIX_JUGOS": {
        // High sugar concentration in syrup
        const progress = Math.min(1.0, elapsedScenarioSec / 30);
        this.state.evaporatorSyrupBrix = Math.min(73.5, 66.8 + progress * 5.8 + jitter(0.2));
        this.state.caneBrix = 19.8 + progress * 1.5;
        this.state.canePol = 16.5 + progress * 1.2;
        break;
      }

      case "SOBRECARGA_RED_MW": {
        // Grid frequency and voltage dip due to external utility grid transient
        this.state.gridFrequencyHz = 59.82 + jitter(0.04);
        this.state.gridVoltageKV = 135.2 + jitter(0.5);
        this.state.powerFactor = 0.88;
        break;
      }
    }

    // 3. Coherent Physical Conservation Laws
    // Cane integration
    const tonsAdded = (this.state.tch / 3600) * dt;
    this.state.caneAccumToday += tonsAdded;

    // Mass balances
    this.state.bagasseProductionRate = +(this.state.tch * this.config.bagasse.productionFactor).toFixed(1);
    this.state.bagasseBoilerConsumption = +(
      (this.state.steamFlowHP * 0.46) *
      (this.state.bagasseMoisture / this.config.bagasse.nominalMoisture)
    ).toFixed(1);
    this.state.bagasseYardStorageRate = +(
      this.state.bagasseProductionRate - this.state.bagasseBoilerConsumption
    ).toFixed(1);
    this.state.bagasseStockTotal += +((this.state.bagasseYardStorageRate / 3600) * dt).toFixed(2);

    // Steam & Power generation
    if (this.scenario !== "PICO_EXPORTACION" && this.scenario !== "CAIDA_PRESION_CALDERA") {
      this.state.steamFlowHP = +(this.state.boilerPressureHP * 3.27 + jitter(1.5)).toFixed(1);
      this.state.powerGeneratedMW = +(this.state.steamFlowHP * 0.1537 + jitter(0.15)).toFixed(2);
      this.state.powerInternalMW = +(10.2 + (this.state.tch / 450) * 1.1 + jitter(0.08)).toFixed(2);
      this.state.powerExportGridMW = +(
        this.state.powerGeneratedMW - this.state.powerInternalMW
      ).toFixed(2);
    }

    // Juice & Sugar production
    if (this.scenario !== "PARADA_DESFIBRADORA") {
      this.state.clarifiedJuiceFlow = +(this.state.tch * 0.848 + jitter(1.2)).toFixed(1);
      const sugarTonsProduced = tonsAdded * (this.state.factoryRecoveryYield / 100);
      this.state.sugarProductionTonsToday += sugarTonsProduced;
      this.state.sugarBagsToday = Math.round(this.state.sugarProductionTonsToday * 20);
      this.state.molassesProductionTons += tonsAdded * this.config.sugar.molassesFactor;
    }

    // OEE Calculation
    this.state.oeeOverall = +(
      (this.state.oeeAvailability * this.state.oeePerformance * this.state.oeeQuality) /
      10000
    ).toFixed(1);

    // 4. Record to Historian Buffer if enabled
    this.recordSampleToHistorian();

    return this.toTelemetry();
  }

  private recordSampleToHistorian(): void {
    const timestamp = this.state.timestamp;
    const seq = this.state.sequence;
    const sc = this.scenario;

    const sampleTags: Array<{ tag: string; val: number; unit: string }> = [
      { tag: "MILL.TANDEM.TCH", val: this.state.tch, unit: "t/h" },
      { tag: "BOILER.01.PRESSURE", val: this.state.boilerPressureHP, unit: "bar" },
      { tag: "BOILER.01.TEMP", val: this.state.boilerTempHP, unit: "°C" },
      { tag: "BOILER.01.STEAM_FLOW", val: this.state.steamFlowHP, unit: "t/h" },
      { tag: "TURBINE.01.POWER_MW", val: this.state.powerGeneratedMW, unit: "MW" },
      { tag: "GRID.SUBSTATION.EXPORT_MW", val: this.state.powerExportGridMW, unit: "MW" },
      { tag: "MILL.03.VIBRATION_RMS", val: this.state.mill3Vibration, unit: "mm/s" },
      { tag: "BAGASSE.MOISTURE", val: this.state.bagasseMoisture, unit: "%" },
      { tag: "EVAPORATOR.SYRUP_BRIX", val: this.state.evaporatorSyrupBrix, unit: "°Bx" },
    ];

    for (const st of sampleTags) {
      const record: HistorianRecord = {
        id: `hist-${this.tenantId}-${st.tag}-${seq}`,
        timestamp,
        tenantId: this.tenantId,
        tag: st.tag,
        value: st.val,
        unit: st.unit,
        quality: "GOOD",
        source: "SIMULATION",
        provenance: "SIMULATED_PROCESS_MODEL",
        isSimulated: true,
        scenario: sc,
        sequence: seq,
      };

      this.historianBuffer.push(record);
    }

    // Keep buffer within configured capacity
    if (this.historianBuffer.length > this.maxHistorianBufferSize) {
      this.historianBuffer.splice(0, this.historianBuffer.length - this.maxHistorianBufferSize);
    }
  }

  public getHistorianRecords(tag?: string, limit: number = 50): HistorianRecord[] {
    let filtered = this.historianBuffer;
    if (tag) {
      const cleanTag = tag.trim().toUpperCase();
      filtered = filtered.filter(
        (r) => r.tag.toUpperCase() === cleanTag || r.tag.toUpperCase().includes(cleanTag)
      );
    }
    return filtered.slice(-limit);
  }

  public toTelemetry(): TelemetryData {
    return {
      timestamp: this.state.timestamp,
      tch: +this.state.tch.toFixed(1),
      caneAccumToday: +this.state.caneAccumToday.toFixed(1),
      caneBrix: +this.state.caneBrix.toFixed(1),
      canePol: +this.state.canePol.toFixed(1),
      canePurity: +this.state.canePurity.toFixed(1),
      millingExtraction: +this.state.millingExtraction.toFixed(2),
      imbibitionWaterFlow: +this.state.imbibitionWaterFlow.toFixed(1),

      bagasseProductionRate: +this.state.bagasseProductionRate.toFixed(1),
      bagasseBoilerConsumption: +this.state.bagasseBoilerConsumption.toFixed(1),
      bagasseYardStorageRate: +this.state.bagasseYardStorageRate.toFixed(1),
      bagasseMoisture: +this.state.bagasseMoisture.toFixed(1),
      bagasseStockTotal: +this.state.bagasseStockTotal.toFixed(1),

      boilerPressureHP: +this.state.boilerPressureHP.toFixed(1),
      boilerTempHP: +this.state.boilerTempHP.toFixed(1),
      steamFlowHP: +this.state.steamFlowHP.toFixed(1),
      steamPressureLP: +this.state.steamPressureLP.toFixed(2),
      steamTempLP: +this.state.steamTempLP.toFixed(1),
      boilerEfficiency: +this.state.boilerEfficiency.toFixed(1),
      flueGasO2: +this.state.flueGasO2.toFixed(2),

      powerGeneratedMW: +this.state.powerGeneratedMW.toFixed(2),
      powerInternalMW: +this.state.powerInternalMW.toFixed(2),
      powerExportGridMW: +this.state.powerExportGridMW.toFixed(2),
      gridFrequencyHz: +this.state.gridFrequencyHz.toFixed(2),
      powerFactor: +this.state.powerFactor.toFixed(2),
      gridVoltageKV: +this.state.gridVoltageKV.toFixed(1),

      clarifiedJuiceFlow: +this.state.clarifiedJuiceFlow.toFixed(1),
      evaporatorSyrupBrix: +this.state.evaporatorSyrupBrix.toFixed(1),
      sugarProductionTonsToday: +this.state.sugarProductionTonsToday.toFixed(1),
      sugarBagsToday: this.state.sugarBagsToday,
      factoryRecoveryYield: +this.state.factoryRecoveryYield.toFixed(2),
      molassesProductionTons: +this.state.molassesProductionTons.toFixed(1),

      oeeOverall: +this.state.oeeOverall.toFixed(1),
      oeeAvailability: +this.state.oeeAvailability.toFixed(1),
      oeePerformance: +this.state.oeePerformance.toFixed(1),
      oeeQuality: +this.state.oeeQuality.toFixed(1),
      mill3Vibration: +this.state.mill3Vibration.toFixed(2),

      simulationScenario: this.scenario,
      isSimulated: true,
      provenance: "SIMULATED_PROCESS_MODEL",
      source: "BioAzúcar Industrial Simulation Runtime",
      quality: "SIMULATED",
    };
  }

  public toDataPoints(): IndustrialDataPoint[] {
    const t = this.toTelemetry();
    const ts = t.timestamp;

    return [
      {
        id: `dp-${this.tenantId}-tch`,
        tag: "MILL.TANDEM.TCH",
        equipmentId: "eq-molino-3",
        areaId: "AREA_MOLIENDA",
        value: t.tch,
        unit: "t/h",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 1,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-boiler-press`,
        tag: "BOILER.01.PRESSURE",
        equipmentId: "eq-caldera-1",
        areaId: "AREA_VAPOR_CALDERAS",
        value: t.boilerPressureHP,
        unit: "bar",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 2,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-steam-flow`,
        tag: "BOILER.01.STEAM_FLOW",
        equipmentId: "eq-caldera-1",
        areaId: "AREA_VAPOR_CALDERAS",
        value: t.steamFlowHP,
        unit: "t/h",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 3,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-power-mw`,
        tag: "TURBINE.01.POWER_MW",
        equipmentId: "eq-turbina-1",
        areaId: "AREA_COGENERACION",
        value: t.powerGeneratedMW,
        unit: "MW",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 4,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-export-mw`,
        tag: "GRID.SUBSTATION.EXPORT_MW",
        equipmentId: "eq-turbina-1",
        areaId: "AREA_COGENERACION",
        value: t.powerExportGridMW,
        unit: "MW",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 5,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-mill3-vib`,
        tag: "MILL.03.VIBRATION_RMS",
        equipmentId: "eq-molino-3",
        areaId: "AREA_MOLIENDA",
        value: t.mill3Vibration,
        unit: "mm/s",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 6,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
      {
        id: `dp-${this.tenantId}-syrup-brix`,
        tag: "EVAPORATOR.SYRUP_BRIX",
        equipmentId: "eq-evaporador-cuadruple",
        areaId: "AREA_FABRICA_AZUCAR",
        value: t.evaporatorSyrupBrix,
        unit: "°Bx",
        dataType: "FLOAT",
        protocol: "SIMULATOR",
        quality: "SIMULATED",
        deviceTimestamp: ts,
        sourceTimestamp: ts,
        ingestionTimestamp: ts,
        sequence: 7,
        isHistorical: false,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      },
    ];
  }
}
