import { describe, it, expect, beforeEach } from "vitest";
import { SimulationDataProvider } from "../services/dataProviders/SimulationDataProvider";
import { OpcUaDataProvider } from "../services/dataProviders/OpcUaDataProvider";
import { MqttSparkplugProvider } from "../services/dataProviders/MqttSparkplugProvider";
import { ModbusDataProvider } from "../services/dataProviders/ModbusDataProvider";
import { ErosDataProvider } from "../services/dataProviders/ErosDataProvider";
import { RestDataProvider } from "../services/dataProviders/RestDataProvider";
import { DataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";

describe("Industrial Data Provider Layer (Provider / Adapter Pattern)", () => {
  let simProvider: SimulationDataProvider;

  beforeEach(() => {
    simProvider = new SimulationDataProvider();
  });

  it("SimulationDataProvider connects and reports proper status and diagnostics", async () => {
    const connected = await simProvider.connect();
    expect(connected).toBe(true);
    expect(simProvider.isConnected()).toBe(true);

    const diag = await simProvider.getDiagnostics();
    expect(diag.connected).toBe(true);
    expect(diag.status).toBe("SIMULATION");
    expect(diag.protocol).toBe("SIMULATOR");
    expect(diag.source).toBe("SIMULATION");

    await simProvider.disconnect();
    expect(simProvider.isConnected()).toBe(false);
  });

  it("SimulationDataProvider reads canonical tags with standard contract", async () => {
    await simProvider.connect();

    const tchPoint = await simProvider.readTag("Milling.TCH_Actual");
    expect(tchPoint).not.toBeNull();
    expect(tchPoint?.tag).toBe("Milling.TCH_Actual");
    expect(tchPoint?.unit).toBe("TCH");
    expect(tchPoint?.source).toBe("SIMULATION");
    expect(tchPoint?.quality).toBe("GOOD");
    expect(tchPoint?.isSimulated).toBe(true);

    const many = await simProvider.readManyTags([
      "Milling.TCH_Actual",
      "Boiler1.Steam_Pressure_HP",
    ]);
    expect(many.size).toBe(2);
    expect(many.get("Boiler1.Steam_Pressure_HP")?.unit).toBe("bar");
  });

  it("SimulationDataProvider respects RBAC security level during write operations", async () => {
    await simProvider.connect();

    // Insufficient clearance (Level 1)
    const deniedResult = await simProvider.writeTag({
      tag: "Milling.TCH_Actual",
      value: 480,
      operatorId: "USR-01",
      operatorRole: "operador",
      reason: "Prueba sin autorización",
      securityClearanceLevel: 1,
    });
    expect(deniedResult.success).toBe(false);
    expect(deniedResult.message).toContain("Nivel de autorización insuficiente");

    // Authorized clearance (Level 2)
    const authorizedResult = await simProvider.writeTag({
      tag: "Milling.TCH_Actual",
      value: 480,
      operatorId: "USR-02",
      operatorRole: "supervisor",
      reason: "Ajuste de molienda autorizado",
      securityClearanceLevel: 2,
    });
    expect(authorizedResult.success).toBe(true);
    expect(authorizedResult.newValue).toBe(480);
  });

  it("SimulationDataProvider publishes tags on subscription", async () => {
    await simProvider.connect();

    let receivedPoint: any = null;
    const unsub = simProvider.subscribeTag("Milling.TCH_Actual", (pt) => {
      receivedPoint = pt;
    });

    expect(receivedPoint).not.toBeNull();
    expect(receivedPoint.tag).toBe("Milling.TCH_Actual");
    unsub();
  });

  it("Physical adapters (OPC-UA, MQTT, Modbus, EROS, REST) safely report sandbox offline state", async () => {
    const opcua = new OpcUaDataProvider();
    const opcConnect = await opcua.connect();
    expect(opcConnect).toBe(false);
    expect(opcua.source).toBe("OPC_UA");

    const opcDiag = await opcua.getDiagnostics();
    expect(opcDiag.status).toBe("OFFLINE");

    const mqtt = new MqttSparkplugProvider();
    expect(mqtt.source).toBe("MQTT");
    expect(mqtt.protocol).toBe("MQTT-SPARKPLUG");

    const modbus = new ModbusDataProvider();
    expect(modbus.source).toBe("MODBUS");

    const eros = new ErosDataProvider();
    expect(eros.source).toBe("EROS");

    const rest = new RestDataProvider();
    expect(rest.source).toBe("REST");
  });

  it("DataProviderRegistry switches active provider and notifies listeners", async () => {
    const registry = DataProviderRegistry.getInstance();
    expect(registry.getActiveProvider()).toBeDefined();

    let notifiedProvider: any = null;
    const unsub = registry.onActiveProviderChange((p) => {
      notifiedProvider = p;
    });

    const switched = await registry.setActiveProvider("provider-opcua-main");
    expect(switched).toBe(true);
    expect(registry.getActiveProvider().source).toBe("OPC_UA");
    expect(notifiedProvider?.source).toBe("OPC_UA");

    // Switch back to simulation
    await registry.setActiveProvider("provider-simulation-canonical");
    expect(registry.getActiveProvider().source).toBe("SIMULATION");
    unsub();
  });
});
