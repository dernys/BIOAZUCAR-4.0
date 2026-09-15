import { describe, it, expect } from "vitest";
import { tagManagementService } from "../services/tagManagementService";
import { otInfrastructureService } from "../services/otInfrastructureService";
import { ErosAdapterPlaceholder } from "../services/erosConnector";

describe("Tag Management & OT Infrastructure Services (ISA-95 / IEC 62443)", () => {
  it("TagManagementService performs CRUD and logs audit entries", async () => {
    const user = { role: "administrador" as const, name: "Admin OT" };

    const initialTags = await tagManagementService.getTags();
    expect(initialTags.length).toBeGreaterThan(0);

    // Create Tag
    const created = await tagManagementService.createTag(
      {
        name: "Presión Aceite Reductor 1",
        description: "Presión hidráulica de lubricación",
        area: "MOLIENDA",
        equipmentId: "eq-molino-1",
        equipmentName: "Molino 01",
        variable: "Oil_Pressure_Bar",
        unit: "bar",
        dataType: "FLOAT",
        source: "SIMULATION",
        protocol: "SIMULATOR",
        address: "ns=2;s=Milling.Mill1.LubeOilPressure",
        accessMode: "READ",
        scanRateMs: 1000,
        deadband: 0.1,
        engMin: 0,
        engMax: 10,
        historization: true,
        alarmEnabled: true,
        highAlarm: 6.0,
        lowAlarm: 2.0,
        securityLevel: 2,
        status: "ACTIVE",
        tenantId: "TENANT_AZUCAR_01",
      },
      user
    );

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Presión Aceite Reductor 1");

    // Update Tag
    const updated = await tagManagementService.updateTag(
      created.id,
      { highAlarm: 6.5 },
      user
    );
    expect(updated?.highAlarm).toBe(6.5);

    // Delete Tag
    const deleted = await tagManagementService.deleteTag(created.id, user);
    expect(deleted).toBe(true);

    const check = await tagManagementService.getTagById(created.id);
    expect(check).toBeNull();
  });

  it("OTInfrastructureService manages connection configs and diagnostic pings", async () => {
    const user = { role: "administrador" as const, name: "Admin OT" };

    const connections = await otInfrastructureService.getConnections();
    expect(connections.length).toBeGreaterThan(0);

    const firstConn = connections[0];
    const testDiag = await otInfrastructureService.testConnection(firstConn.id);
    expect(testDiag.connected).toBe(true);
    expect(testDiag.status).toBe("SIMULATION");

    // Register new PLC
    const newPLC = await otInfrastructureService.createConnection(
      {
        name: "PLC Secador de Azúcar",
        type: "PLC",
        host: "192.168.10.45",
        port: 102,
        protocol: "OPC-UA",
        security: "SIGN_ENCRYPT",
        timeoutMs: 2000,
        retryPolicy: "EXPONENTIAL_BACKOFF",
        heartbeatIntervalSec: 5,
        latencyMs: 8,
        activeTagsCount: 30,
        messageRateSec: 100,
        tenantId: "TENANT_AZUCAR_01",
        description: "Control de secador rotativo y temperatura",
      },
      user
    );

    expect(newPLC.id).toBeDefined();
    expect(newPLC.name).toBe("PLC Secador de Azúcar");

    // Cleanup
    await otInfrastructureService.deleteConnection(newPLC.id, user);
  });

  it("ErosAdapterPlaceholder fulfills IErosConnector interface safely in development", async () => {
    const adapter = new ErosAdapterPlaceholder();
    expect(adapter.connectorId).toBe("eros-adapter-unlinked");
    expect(adapter.status).toBe("CONFIGURATION_PENDING");

    const diag = await adapter.getHealthDiagnostics();
    expect(diag.connected).toBe(false);
    expect(diag.source).toBe("EROS");

    const writeRes = await adapter.writeRawSetpoint("EROS.MOLINO.SPEED", 50, "BADGE-123");
    expect(writeRes.success).toBe(false);
    expect(writeRes.message).toContain("Adaptador EROS en estado de espera");
  });

  it("IndustrialConnectorRuntime marks unverified EROS connection as PROTOCOL_SPEC_REQUIRED without simulating fake success", async () => {
    const { industrialConnectorRuntime } = await import("../services/dataProviders/IndustrialConnectorRuntime");
    const res = await industrialConnectorRuntime.testPhysicalConnection({
      id: "conn-eros-sugar-test",
      tenantId: "TENANT_AZUCAR_01",
      siteId: "SITE_01",
      name: "Molino Central EROS Native",
      protocol: "EROS",
      endpoint: "tcp://192.168.20.10:9000",
      gatewayId: "gw-01",
      status: "CONFIGURED",
      criticality: "CRITICAL",
      readOnly: true,
      enabled: true,
      expectedIntervalMs: 1000,
      maxSilenceMs: 5000,
      latencyBudgetMs: 500,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configVersion: "1.0.0",
      isDemoSimulation: false,
    });

    expect(res.status).toBe("PROTOCOL_SPEC_REQUIRED");
    expect(res.isPhysicalSuccess).toBe(false);
    expect(res.errorMessage).toContain("PROTOCOL_SPEC_REQUIRED");
    expect(res.errorMessage).toContain("especificar la pasarela física");
  });

  it("TagManagementService executes tag read/write tests safely, enforcing engineering ranges and RBAC", async () => {
    const user = { role: "OPERATOR" as const, name: "Operador Molino" };
    const tags = await tagManagementService.getTags();
    expect(tags.length).toBeGreaterThan(0);
    const targetTag = tags[0]; // Flujo de Molienda TCH, engMin: 0, engMax: 600, READ_WRITE

    // 1. Successful READ test
    const readResult = await tagManagementService.testTagOperation({
      tagId: targetTag.id,
      operation: "READ",
      user,
    });
    expect(readResult.success).toBe(true);
    expect(readResult.quality).toBe("GOOD");
    expect(typeof readResult.value).toBe("number");

    // 2. Successful WRITE test within engineering limits
    const writeResult = await tagManagementService.testTagOperation({
      tagId: targetTag.id,
      operation: "WRITE",
      user,
      writeValue: 450,
      reason: "Ajuste operativo de molienda",
    });
    expect(writeResult.success).toBe(true);
    expect(writeResult.quality).toBe("GOOD");
    expect(writeResult.value).toBe(450);

    // 3. Failed WRITE test exceeding engineering maximum
    const outOfBoundsResult = await tagManagementService.testTagOperation({
      tagId: targetTag.id,
      operation: "WRITE",
      user,
      writeValue: 9999, // Exceeds engMax 600
      reason: "Prueba fuera de rango",
    });
    expect(outOfBoundsResult.success).toBe(false);
    expect(outOfBoundsResult.quality).toBe("BAD");
    expect(outOfBoundsResult.message).toContain("Violación de límite de ingeniería");
  });
});
