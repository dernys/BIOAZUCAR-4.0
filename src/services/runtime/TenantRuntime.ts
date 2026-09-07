import {
  TelemetryData,
  AlarmEvent,
  EquipmentItem,
  IndustrialDataPoint,
  SimulationScenario,
} from "../../types";
import {
  RuntimeMode,
  TenantConfiguration,
  OTConfig,
  SimulationConfig,
  HistorianRecord,
  RuntimeStatus,
} from "./types";
import { IndustrialSimulationRuntime } from "./IndustrialSimulationRuntime";
import { createDefaultTenantConfig } from "./defaultTenantConfig";

export class TenantRuntime {
  public readonly tenantId: string;
  private mode: RuntimeMode;
  private config: TenantConfiguration;
  private simulationRuntime: IndustrialSimulationRuntime;
  private simulationConfig: SimulationConfig;
  private otConfig: OTConfig;
  private startTime: number = Date.now();
  private alarms: AlarmEvent[] = [];

  constructor(
    tenantId: string,
    initialMode: RuntimeMode = "SIMULATION",
    customConfig?: Partial<TenantConfiguration>
  ) {
    this.tenantId = tenantId;
    this.mode = initialMode;
    this.config = {
      ...createDefaultTenantConfig(tenantId),
      ...customConfig,
    };

    this.simulationConfig = {
      enabled: initialMode === "SIMULATION" || initialMode === "HYBRID",
      scenario: "NORMAL",
      speedMultiplier: 1.0,
      autoStart: true,
      historianEnabled: true,
      alarmGenerationEnabled: true,
    };

    this.otConfig = {
      endpointUrl: "opc.tcp://edge-gw.bioazucar.local:4840",
      protocol: "OPC-UA",
      securityPolicy: "Basic256Sha256",
      securityMode: "SignAndEncrypt",
      authMode: "Certificate",
      status: "WAITING_FOR_COMMISSIONING",
      reconnectIntervalMs: 5000,
      isLiveConnection: false,
    };

    this.simulationRuntime = new IndustrialSimulationRuntime(tenantId, this.config);
    this.initializeAlarms();
  }

  private initializeAlarms(): void {
    this.alarms = [
      {
        id: `alm-${this.tenantId}-01`,
        code: "ALM-VIB-M3",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        equipmentId: "eq-molino-3",
        equipmentName: "Molino 3 - Tándem de Molienda",
        tag: "MILL.03.VIBRATION_RMS",
        severity: "ALTA",
        message: "Vibración anormal detectada en chumacera superior de Molino 3",
        status: "ACTIVE",
        area: "Molienda",
        acknowledged: false,
        shelved: false,
        currentValue: 4.85,
        threshold: 4.5,
        unit: "mm/s",
        possibleCause: "Falla de lubricación o desbalance mecánico en maza superior",
        recommendedAction: "Inspeccionar lubricación forzada y alineamiento de copla Cardan",
        suggestedAction: "Inspeccionar lubricación forzada y alineamiento de copla Cardan",
        interlockActive: true,
      },
    ];
  }

  public getMode(): RuntimeMode {
    return this.mode;
  }

  public setMode(newMode: RuntimeMode): void {
    this.mode = newMode;
    if (newMode === "SIMULATION") {
      this.simulationConfig.enabled = true;
      this.simulationRuntime.setRunning(true);
    } else if (newMode === "LIVE_OT") {
      this.simulationConfig.enabled = false;
      this.simulationRuntime.setRunning(false);
      if (!this.otConfig.isLiveConnection) {
        this.otConfig.status = "WAITING_FOR_COMMISSIONING";
      }
    }
  }

  public getConfiguration(): TenantConfiguration {
    return this.config;
  }

  public updateConfiguration(partial: Partial<TenantConfiguration>): void {
    this.config = {
      ...this.config,
      ...partial,
    };
  }

  public getSimulationRuntime(): IndustrialSimulationRuntime {
    return this.simulationRuntime;
  }

  public getSimulationConfig(): SimulationConfig {
    return this.simulationConfig;
  }

  public getOTConfig(): OTConfig {
    return this.otConfig;
  }

  public setOTConfig(config: Partial<OTConfig>): void {
    this.otConfig = {
      ...this.otConfig,
      ...config,
    };
  }

  public setScenario(scenario: SimulationScenario): void {
    this.simulationConfig.scenario = scenario;
    this.simulationRuntime.setScenario(scenario);
    this.updateAlarmsForScenario(scenario);
  }

  private updateAlarmsForScenario(scenario: SimulationScenario): void {
    if (scenario === "VIBRACION_MOLINO3") {
      const existing = this.alarms.find((a) => a.code === "ALM-VIB-M3");
      if (existing) {
        existing.status = "ACTIVE";
        existing.currentValue = 4.85;
      } else {
        this.alarms.push({
          id: `alm-${this.tenantId}-vib`,
          code: "ALM-VIB-M3",
          timestamp: new Date().toISOString(),
          equipmentId: "eq-molino-3",
          equipmentName: "Molino 3 - Tándem de Molienda",
          tag: "MILL.03.VIBRATION_RMS",
          severity: "ALTA",
          message: "Vibración anormal detectada en chumacera superior de Molino 3",
          status: "ACTIVE",
          area: "Molienda",
          acknowledged: false,
          shelved: false,
          currentValue: 4.85,
          threshold: 4.5,
          unit: "mm/s",
          possibleCause: "Falla de lubricación o desbalance mecánico en maza superior",
          recommendedAction: "Inspeccionar lubricación forzada y alineamiento",
          suggestedAction: "Inspeccionar lubricación forzada y alineamiento",
          interlockActive: true,
        });
      }
    } else if (scenario === "CAIDA_PRESION_CALDERA") {
      this.alarms.push({
        id: `alm-${this.tenantId}-press`,
        code: "ALM-BLR-P-LOW",
        timestamp: new Date().toISOString(),
        equipmentId: "eq-caldera-1",
        equipmentName: "Caldera HP de Biomasa 1",
        tag: "BOILER.01.PRESSURE",
        severity: "CRITICA",
        message: "Presión de vapor sobrecalentado HP por debajo de límite seguro (53 bar)",
        status: "ACTIVE",
        area: "Generación de Vapor",
        acknowledged: false,
        shelved: false,
        currentValue: 52.4,
        threshold: 55.0,
        unit: "bar",
        possibleCause: "Humedad excesiva en bagazo o falla de alimentación",
        recommendedAction: "Verificar alimentación de bagazo e integridad de tiro inducido",
        suggestedAction: "Verificar alimentación de bagazo e integridad de tiro inducido",
        interlockActive: true,
      });
    } else if (scenario === "NORMAL") {
      // Clear critical alarms or mark as ACK
      this.alarms.forEach((a) => {
        if (a.status === "ACTIVE") {
          a.status = "CLEARED";
        }
      });
    }
  }

  /**
   * Return real-time telemetry snapshot strictly observing current runtime mode
   */
  public getTelemetrySnapshot(): TelemetryData {
    if (this.mode === "SIMULATION" || this.mode === "HYBRID") {
      return this.simulationRuntime.step(1.0);
    }

    if (this.mode === "LIVE_OT") {
      // Strict honesty constraint: If OT is not connected, report WAITING_FOR_COMMISSIONING
      if (!this.otConfig.isLiveConnection || this.otConfig.status !== "CONNECTED") {
        return {
          timestamp: new Date().toISOString(),
          tch: 0,
          caneAccumToday: 0,
          caneBrix: 0,
          canePol: 0,
          canePurity: 0,
          millingExtraction: 0,
          imbibitionWaterFlow: 0,
          bagasseProductionRate: 0,
          bagasseBoilerConsumption: 0,
          bagasseYardStorageRate: 0,
          bagasseMoisture: 0,
          bagasseStockTotal: 0,
          boilerPressureHP: 0,
          boilerTempHP: 0,
          steamFlowHP: 0,
          steamPressureLP: 0,
          steamTempLP: 0,
          boilerEfficiency: 0,
          flueGasO2: 0,
          powerGeneratedMW: 0,
          powerInternalMW: 0,
          powerExportGridMW: 0,
          gridFrequencyHz: 0,
          powerFactor: 0,
          gridVoltageKV: 0,
          clarifiedJuiceFlow: 0,
          evaporatorSyrupBrix: 0,
          sugarProductionTonsToday: 0,
          sugarBagsToday: 0,
          factoryRecoveryYield: 0,
          molassesProductionTons: 0,
          oeeOverall: 0,
          oeeAvailability: 0,
          oeePerformance: 0,
          oeeQuality: 0,
          mill3Vibration: 0,
          simulationScenario: "NORMAL",
          isSimulated: false,
          provenance: "OBSERVED_OT",
          source: "LIVE_OT: NO LIVE OT DATA (WAITING_FOR_COMMISSIONING)",
          quality: "UNCERTAIN",
        };
      }
    }

    return this.simulationRuntime.toTelemetry();
  }

  public getTagValue(tagAddress: string): IndustrialDataPoint | null {
    const cleanTag = tagAddress.trim().toUpperCase();
    const dataPoints = this.simulationRuntime.toDataPoints();

    const match = dataPoints.find(
      (dp) => dp.tag.toUpperCase() === cleanTag || dp.tag.toUpperCase().includes(cleanTag)
    );

    if (match) {
      if (this.mode === "LIVE_OT" && !this.otConfig.isLiveConnection) {
        return {
          ...match,
          value: 0,
          quality: "UNCERTAIN",
          isSimulated: false,
          source: "OPC_UA",
          provenance: "OBSERVED_OT",
        };
      }
      return match;
    }

    return null;
  }

  public getAllTags(): IndustrialDataPoint[] {
    if (this.mode === "LIVE_OT" && !this.otConfig.isLiveConnection) {
      return [];
    }
    return this.simulationRuntime.toDataPoints();
  }

  public getAlarms(): AlarmEvent[] {
    return this.alarms;
  }

  public getHistorianRecords(tag?: string, limit: number = 50): HistorianRecord[] {
    return this.simulationRuntime.getHistorianRecords(tag, limit);
  }

  public getRuntimeStatus(): RuntimeStatus {
    const t = this.getTelemetrySnapshot();
    const activeAlarms = this.alarms.filter((a) => a.status === "ACTIVE").length;
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    return {
      tenantId: this.tenantId,
      tenantName: this.config.identity.name,
      mode: this.mode,
      isSimulated: this.mode === "SIMULATION" || this.mode === "HYBRID",
      simulationScenario: this.simulationConfig.scenario,
      simulationRunning: this.simulationRuntime.isSimulationRunning(),
      otStatus: this.otConfig.status,
      otMessage:
        this.mode === "LIVE_OT" && !this.otConfig.isLiveConnection
          ? "NO LIVE OT DATA - WAITING_FOR_COMMISSIONING"
          : undefined,
      activeAlarmsCount: activeAlarms,
      telemetryTimestamp: t.timestamp,
      uptimeSeconds: uptime,
      historianPointsCount: this.getHistorianRecords(undefined, 1000).length,
    };
  }
}
