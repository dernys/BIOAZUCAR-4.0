/**
 * BioAzúcar 4.0 — P0-01 Industrial Discovery Engine Test Suite
 * 
 * Verifies multi-protocol industrial discovery (OPC UA, Modbus, Sparkplug B, EROS DCS)
 * and manual mapping workflows for air-gapped equipment.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { IndustrialDiscoveryEngine } from "../services/discovery/IndustrialDiscoveryEngine";
import { DiscoveryTarget, ManualImportPayload } from "../services/discovery/types";

describe("P0-01: Industrial Discovery Engine & Multi-Protocol Auto-Discovery", () => {
  let engine: IndustrialDiscoveryEngine;

  beforeEach(() => {
    IndustrialDiscoveryEngine.resetInstance();
    engine = IndustrialDiscoveryEngine.getInstance();
  });

  it("should successfully discover OPC UA servers, devices, address space nodes and tags", async () => {
    const target: DiscoveryTarget = {
      targetId: "opcua-central-01",
      name: "Servidor OPC UA Central Tándem",
      protocol: "OPC_UA",
      endpoint: "opc.tcp://192.168.10.50:4840",
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
      securityPolicy: "Basic256Sha256",
      securityMode: "SignAndEncrypt",
    };

    const job = await engine.startDiscovery(target);

    expect(job.status).toBe("COMPLETED");
    expect(job.progressPercentage).toBe(100);
    expect(job.discoveredSources).toHaveLength(1);
    expect(job.discoveredSources[0].protocol).toBe("OPC_UA");
    expect(job.discoveredSources[0].serverInfo.productName).toContain("KEPServerEX");

    expect(job.discoveredDevices.length).toBeGreaterThanOrEqual(2);
    const plcRockwell = job.discoveredDevices.find((d) => d.vendor?.includes("Rockwell"));
    expect(plcRockwell).toBeDefined();
    expect(plcRockwell?.deviceType).toBe("PLC");

    // Address space inspection
    expect(job.discoveredNodes.length).toBeGreaterThanOrEqual(4);
    const tchNode = job.discoveredNodes.find((n) => n.browseName === "TCH_Actual");
    expect(tchNode).toBeDefined();
    expect(tchNode?.engineeringUnit).toBe("TCH");
    expect(tchNode?.currentValue).toBe(420.5);

    // Tags mapped
    expect(job.discoveredTags.length).toBeGreaterThanOrEqual(4);
    const tchTag = job.discoveredTags.find((t) => t.variable === "TCH_Actual");
    expect(tchTag).toBeDefined();
    expect(tchTag?.protocol).toBe("OPC_UA");
    expect(tchTag?.originalAddress).toBe("ns=2;s=Milling.Tandem.TCH_Actual");
    expect(tchTag?.alarmInfo?.alarmEnabled).toBe(true);
  });

  it("should scan Modbus Unit IDs and discover registers for weighbridge and VFDs", async () => {
    const target: DiscoveryTarget = {
      targetId: "modbus-gateway-01",
      name: "Gateway Modbus Batey",
      protocol: "MODBUS_TCP",
      endpoint: "192.168.10.20:502",
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
      options: {
        modbusUnitIds: [1, 2],
      },
    };

    const job = await engine.startDiscovery(target);

    expect(job.status).toBe("COMPLETED");
    expect(job.discoveredSources[0].protocol).toBe("MODBUS_TCP");
    expect(job.discoveredDevices).toHaveLength(2);

    const weighbridge = job.discoveredDevices.find((d) => d.unitId === 1);
    expect(weighbridge?.deviceType).toBe("WEIGHBRIDGE_CONTROLLER");
    expect(weighbridge?.vendor).toContain("Mettler Toledo");

    const vfd = job.discoveredDevices.find((d) => d.unitId === 2);
    expect(vfd?.deviceType).toBe("VFD");

    // Register inspection
    const grossWeightTag = job.discoveredTags.find((t) => t.variable === "Weighbridge_GrossWeight");
    expect(grossWeightTag).toBeDefined();
    expect(grossWeightTag?.originalAddress).toBe("holding:40001:FLOAT32");
    expect(grossWeightTag?.engineeringUnit).toBe("t");
    expect(grossWeightTag?.currentValue).toBe(45.82);
  });

  it("should discover MQTT Sparkplug B edge nodes, devices and telemetry metrics", async () => {
    const target: DiscoveryTarget = {
      targetId: "sparkplug-broker-01",
      name: "Broker MQTT Sparkplug Clarificación",
      protocol: "SPARKPLUG_B",
      endpoint: "mqtt://192.168.1.60:1883",
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
    };

    const job = await engine.startDiscovery(target);

    expect(job.status).toBe("COMPLETED");
    expect(job.discoveredDevices[0].deviceType).toBe("SMART_TRANSMITTER");
    expect(job.discoveredTags.length).toBeGreaterThanOrEqual(3);

    const turbidityTag = job.discoveredTags.find((t) => t.variable === "Juice_Turbidity_NTU");
    expect(turbidityTag).toBeDefined();
    expect(turbidityTag?.engineeringUnit).toBe("NTU");
    expect(turbidityTag?.originalAddress).toContain("CentralAzucarero/DDATA/NodeClarificacion");
  });

  it("should discover EROS DCS control loops, vacuum and refractometer variables", async () => {
    const target: DiscoveryTarget = {
      targetId: "eros-dcs-01",
      name: "EROS DCS Tachos y Evaporadores",
      protocol: "EROS",
      endpoint: "192.168.10.80:502",
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
    };

    const job = await engine.startDiscovery(target);

    expect(job.status).toBe("COMPLETED");
    expect(job.discoveredDevices[0].deviceType).toBe("DCS");

    const vacuumTag = job.discoveredTags.find((t) => t.variable === "PAN1_VACUUM_PV");
    expect(vacuumTag).toBeDefined();
    expect(vacuumTag?.engineeringUnit).toBe("inHg");
    expect(vacuumTag?.originalAddress).toBe("EROS:PAN1:LOOP_VACUUM:PV");

    const brixTag = job.discoveredTags.find((t) => t.variable === "PAN1_BRIX_PV");
    expect(brixTag).toBeDefined();
    expect(brixTag?.engineeringUnit).toBe("°Bx");
  });

  it("should execute manual CSV import workflow for air-gapped legacy equipment", () => {
    const csvContent = `TagId,Name,Address,Variable,DataType,Unit,Min,Max,Equipment
TAG_001,Presion Caldera 2,DB20.DBD0,BOILER2_PRESS,FLOAT,bar,0,60,Caldera Bagacera 2
TAG_002,Nivel Domo Caldera 2,DB20.DBD4,BOILER2_LEVEL,FLOAT,%,0,100,Caldera Bagacera 2
TAG_003,Motor Ventilador Tiro,DB20.DBX8.0,FAN_ID_RUN,BOOL,,0,1,Caldera Bagacera 2`;

    const payload: ManualImportPayload = {
      format: "CSV",
      content: csvContent,
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
      defaultProtocol: "MANUAL_IMPORT",
    };

    const job = engine.importManualCatalog(payload);

    expect(job.status).toBe("COMPLETED");
    expect(job.discoveredTags).toHaveLength(3);
    expect(job.discoveredTags[0].canonicalName).toBe("Presion Caldera 2");
    expect(job.discoveredTags[0].originalAddress).toBe("DB20.DBD0");
    expect(job.discoveredTags[0].engineeringUnit).toBe("bar");
    expect(job.discoveredTags[0].approvalStatus).toBe("MAPPED");

    expect(job.discoveredTags[2].dataType).toBe("BOOLEAN");
  });

  it("should support manual JSON import and approval lifecycle", () => {
    const jsonContent = JSON.stringify([
      {
        name: "Caudal Agua Imbibicion",
        address: "ns=2;s=Imbibition_Flow",
        variable: "IMBIBITION_FLOW",
        dataType: "FLOAT",
        unit: "m3/h",
        min: 0,
        max: 80,
      },
    ]);

    const payload: ManualImportPayload = {
      format: "JSON",
      content: jsonContent,
      tenantId: "ingenio-central",
      siteId: "planta-azucarera-01",
    };

    const job = engine.importManualCatalog(payload);
    expect(job.discoveredTags).toHaveLength(1);
    const tagId = job.discoveredTags[0].id;

    // Verify approval workflow
    const updated = engine.updateTagApproval(tagId, "APPROVED");
    expect(updated).toBe(true);

    const tag = engine.getDiscoveredTag(tagId);
    expect(tag?.approvalStatus).toBe("APPROVED");
  });
});
