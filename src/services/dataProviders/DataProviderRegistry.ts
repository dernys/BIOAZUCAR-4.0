import {
  IndustrialDataPoint,
  DataSourceType,
  ProtocolType,
  ConnectionDiagnostics,
} from "../../types";
import { IIndustrialDataProvider } from "./IIndustrialDataProvider";
import { SimulationDataProvider } from "./SimulationDataProvider";
import { OpcUaDataProvider } from "./OpcUaDataProvider";
import { MqttSparkplugProvider } from "./MqttSparkplugProvider";
import { ModbusDataProvider } from "./ModbusDataProvider";
import { ErosDataProvider } from "./ErosDataProvider";
import { RestDataProvider } from "./RestDataProvider";
import { EdgeDataProvider } from "./EdgeDataProvider";

export class DataProviderRegistry {
  private static instance: DataProviderRegistry;

  private providers = new Map<string, IIndustrialDataProvider>();
  private activeProviderId: string;
  private changeListeners = new Set<(provider: IIndustrialDataProvider) => void>();

  private constructor() {
    // Register standard providers
    const sim = new SimulationDataProvider();
    const edge = new EdgeDataProvider();
    const opcua = new OpcUaDataProvider();
    const mqtt = new MqttSparkplugProvider();
    const modbus = new ModbusDataProvider();
    const eros = new ErosDataProvider();
    const rest = new RestDataProvider();

    this.providers.set(sim.id, sim);
    this.providers.set(edge.id, edge);
    this.providers.set(opcua.id, opcua);
    this.providers.set(mqtt.id, mqtt);
    this.providers.set(modbus.id, modbus);
    this.providers.set(eros.id, eros);
    this.providers.set(rest.id, rest);

    // Default to Simulation provider
    this.activeProviderId = sim.id;
    sim.connect();
  }

  public static getInstance(): DataProviderRegistry {
    if (!DataProviderRegistry.instance) {
      DataProviderRegistry.instance = new DataProviderRegistry();
    }
    return DataProviderRegistry.instance;
  }

  public getActiveProvider(): IIndustrialDataProvider {
    return this.providers.get(this.activeProviderId)!;
  }

  public getSimulationProvider(): SimulationDataProvider {
    return this.providers.get("provider-simulation-canonical") as SimulationDataProvider;
  }

  public getAllProviders(): IIndustrialDataProvider[] {
    return Array.from(this.providers.values());
  }

  public async setActiveProvider(providerId: string): Promise<boolean> {
    const nextProvider = this.providers.get(providerId);
    if (!nextProvider) return false;

    const currentProvider = this.getActiveProvider();
    if (currentProvider.id === providerId) return true;

    // Disconnect previous
    await currentProvider.disconnect();

    // Connect next
    this.activeProviderId = providerId;
    await nextProvider.connect();

    // Notify listeners
    this.changeListeners.forEach((listener) => listener(nextProvider));
    return true;
  }

  public onActiveProviderChange(listener: (provider: IIndustrialDataProvider) => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }
}

export const dataProviderRegistry = DataProviderRegistry.getInstance();
