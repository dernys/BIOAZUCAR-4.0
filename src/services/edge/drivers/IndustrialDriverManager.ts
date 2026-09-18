/**
 * BioAzúcar 4.0 — Industrial Driver Manager (I1 / I8)
 * 
 * Central registry, life-cycle supervisor and health aggregator for all OT drivers.
 * Guarantees that all data ingested from any driver passes through the Data Quality Engine
 * before reaching the Store & Forward queue or SCADA telemetry bus.
 */

import {
  IIndustrialDriver,
  DriverConfig,
  DriverHealth,
  DriverDiagnostics,
  TagSubscriptionHandle,
  TagSubscriptionOptions,
  TagSubscriptionCallback,
} from "./IIndustrialDriver";
import { IndustrialProtocol, IndustrialDataPoint } from "../../../types";
import { dataQualityEngine } from "../dataQualityEngine";
import { OpcUaDriverAdapter } from "./OpcUaDriverAdapter";
import { ModbusDriverAdapter } from "./ModbusDriverAdapter";
import { MqttSparkplugDriverAdapter } from "./MqttSparkplugDriverAdapter";
import { ErosDriverAdapter } from "./ErosDriverAdapter";
import { SiemensS7DriverAdapter } from "./SiemensS7DriverAdapter";
import { EtherNetIpDriverAdapter } from "./EtherNetIpDriverAdapter";

export class IndustrialDriverManager {
  private static instance: IndustrialDriverManager;

  private drivers = new Map<string, IIndustrialDriver>();

  private constructor() {}

  public static getInstance(): IndustrialDriverManager {
    if (!IndustrialDriverManager.instance) {
      IndustrialDriverManager.instance = new IndustrialDriverManager();
    }
    return IndustrialDriverManager.instance;
  }

  /**
   * Registers a driver instance into the runtime.
   */
  public registerDriver(driver: IIndustrialDriver): void {
    if (this.drivers.has(driver.id)) {
      console.warn(`[DriverManager] Overwriting existing driver registration: ${driver.id}`);
    }
    this.drivers.set(driver.id, driver);
  }

  /**
   * Unregisters and disconnects a driver.
   */
  public async unregisterDriver(driverId: string): Promise<boolean> {
    const driver = this.drivers.get(driverId);
    if (!driver) return false;

    try {
      await driver.disconnect();
    } catch (err) {
      console.error(`[DriverManager] Error disconnecting driver ${driverId} during unregister:`, err);
    }
    return this.drivers.delete(driverId);
  }

  /**
   * Clears all registered drivers.
   */
  public clearAll(): void {
    this.drivers.clear();
  }

  public getDriver(driverId: string): IIndustrialDriver | undefined {
    return this.drivers.get(driverId);
  }

  public getAllDrivers(): IIndustrialDriver[] {
    return Array.from(this.drivers.values());
  }

  /**
   * Factory method to create and register an adapter by protocol.
   */
  public createAndRegisterDriver(config: DriverConfig): IIndustrialDriver {
    let driver: IIndustrialDriver;

    switch (config.protocol) {
      case "OPC_UA":
      case "OPC-UA":
        driver = new OpcUaDriverAdapter(config);
        break;
      case "MODBUS":
      case "MODBUS-TCP":
      case "MODBUS-RTU":
        driver = new ModbusDriverAdapter(config);
        break;
      case "MQTT":
      case "SPARKPLUG":
      case "MQTT-SPARKPLUG":
        driver = new MqttSparkplugDriverAdapter(config);
        break;
      case "EROS":
        driver = new ErosDriverAdapter(config);
        break;
      case "SIEMENS_S7":
      case "SIEMENS-S7":
        driver = new SiemensS7DriverAdapter(config);
        break;
      case "ETHERNET_IP":
      case "ALLEN_BRADLEY":
        driver = new EtherNetIpDriverAdapter(config);
        break;
      default:
        // Default to Modbus for backward-compatible industrial endpoints
        driver = new ModbusDriverAdapter(config);
        break;
    }

    this.registerDriver(driver);
    return driver;
  }

  public getDriversByProtocol(protocol: IndustrialProtocol): IIndustrialDriver[] {
    return Array.from(this.drivers.values()).filter((d) => d.protocol === protocol);
  }

  /**
   * Connects all registered drivers in parallel.
   */
  public async connectAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const promises = Array.from(this.drivers.entries()).map(async ([id, driver]) => {
      try {
        const success = await driver.connect();
        results[id] = success;
      } catch (err) {
        console.error(`[DriverManager] Failed to connect driver ${id}:`, err);
        results[id] = false;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Disconnects all registered drivers gracefully.
   */
  public async disconnectAll(): Promise<void> {
    const promises = Array.from(this.drivers.values()).map(async (driver) => {
      try {
        await driver.disconnect();
      } catch (err) {
        console.error(`[DriverManager] Failed to disconnect driver ${driver.id}:`, err);
      }
    });
    await Promise.all(promises);
  }

  /**
   * Reads a tag through the designated driver and evaluates quality deterministically.
   */
  public async readTag(driverId: string, tag: string): Promise<IndustrialDataPoint> {
    const driver = this.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver with ID '${driverId}' not registered`);
    }

    const rawDataPoint = await driver.readTag(tag);
    // Enforce canonical data quality gate
    const audit = dataQualityEngine.evaluate(rawDataPoint);
    return audit.normalizedPoint;
  }

  /**
   * Writes a setpoint or digital command through the designated driver.
   */
  public async writeTag(
    driverId: string,
    tag: string,
    value: number | string | boolean,
    clearanceLevel?: number,
    justification?: string
  ): Promise<boolean> {
    const driver = this.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver with ID '${driverId}' not registered`);
    }

    return driver.writeTag(tag, value, clearanceLevel, justification);
  }

  /**
   * Subscribes to tag telemetry through the designated driver, ensuring every event is quality audited.
   */
  public async subscribe(
    driverId: string,
    tag: string,
    options: TagSubscriptionOptions,
    callback: TagSubscriptionCallback
  ): Promise<TagSubscriptionHandle> {
    const driver = this.drivers.get(driverId);
    if (!driver) {
      throw new Error(`Driver with ID '${driverId}' not registered`);
    }

    // Wrap callback with quality audit
    const auditedCallback: TagSubscriptionCallback = (rawPoint) => {
      const audited = dataQualityEngine.evaluate(rawPoint);
      callback(audited.normalizedPoint);
    };

    return driver.subscribe(tag, options, auditedCallback);
  }

  /**
   * Aggregates health reports across all registered drivers.
   */
  public getAllHealth(): DriverHealth[] {
    return Array.from(this.drivers.values()).map((d) => d.getHealth());
  }

  /**
   * Aggregates diagnostic statistics for all drivers.
   */
  public getAllDiagnostics(): DriverDiagnostics[] {
    return Array.from(this.drivers.values()).map((d) => d.getDiagnostics());
  }

  /**
   * Computes consolidated telemetry metrics for Prometheus and Edge Daemon supervision.
   */
  public getAggregatedMetrics(): {
    totalDrivers: number;
    activeDrivers: number;
    totalReadSuccess: number;
    totalReadErrors: number;
    totalWriteSuccess: number;
    totalWriteErrors: number;
    avgLatencyMs: number;
  } {
    const healthList = this.getAllHealth();
    let totalReads = 0;
    let totalReadErrors = 0;
    let totalWrites = 0;
    let totalWriteErrors = 0;
    let sumLatency = 0;
    let activeDrivers = 0;

    for (const h of healthList) {
      totalReads += h.readSuccessCount;
      totalReadErrors += h.readErrorCount;
      totalWrites += h.writeSuccessCount;
      totalWriteErrors += h.writeErrorCount;
      sumLatency += h.avgLatencyMs;
      if (h.status === "CONNECTED" || h.status === "AUTHENTICATED") {
        activeDrivers++;
      }
    }

    return {
      totalDrivers: this.drivers.size,
      activeDrivers,
      totalReadSuccess: totalReads,
      totalReadErrors: totalReadErrors,
      totalWriteSuccess: totalWrites,
      totalWriteErrors: totalWriteErrors,
      avgLatencyMs: healthList.length > 0 ? Number((sumLatency / healthList.length).toFixed(2)) : 0,
    };
  }

  /**
   * Resets driver registry (test lifecycle).
   */
  public resetRegistry(): void {
    this.drivers.clear();
  }
}

export const industrialDriverManager = IndustrialDriverManager.getInstance();
