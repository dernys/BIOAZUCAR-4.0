import { describe, it, expect, beforeEach } from "vitest";
import {
  SecureCommandGateway,
  secureCommandGateway,
  SecureWriteCommandRequest,
} from "../services/edge/commands/SecureCommandGateway";
import { commandService } from "../services/edge/CommandService";
import { durableCommandQueue } from "../services/edge/commands/DurableCommandQueue";
import { industrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { IIndustrialDriver } from "../services/edge/drivers/IIndustrialDriver";
import { RuntimeProfileManager } from "../services/edge/config/runtimeProfile";

// Mock driver for echo verification test
class TestEchoDriver implements IIndustrialDriver {
  public id = "DRIVER-PLC-TEST";
  public name = "Test PLC Driver";
  public protocol = "SIEMENS_S7" as any;
  public status = "CONNECTED" as any;
  public config: any = { driverId: "DRIVER-PLC-TEST", protocol: "SIEMENS_S7" };
  public writtenValues = new Map<string, any>();
  public echoValues = new Map<string, any>();

  public async connect(): Promise<boolean> { return true; }
  public async disconnect(): Promise<void> {}
  public async subscribe(tag: string, options: any, callback: any): Promise<any> {
    return { subscriptionId: "sub-1", tag, unsubscribe: () => {} };
  }
  public getHealth(): any { return { healthy: true, isConnected: true, lastError: null }; }
  public async readTag(tag: string): Promise<any> {
    const val = this.echoValues.has(tag) ? this.echoValues.get(tag) : this.writtenValues.get(tag) ?? 50.0;
    return {
      tag,
      value: val,
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
    };
  }
  public async writeTag(tag: string, value: any): Promise<boolean> {
    this.writtenValues.set(tag, value);
    // default echo equals written value unless overridden
    if (!this.echoValues.has(tag)) {
      this.echoValues.set(tag, value);
    }
    return true;
  }
  public getStatus(): any { return { isConnected: true }; }
  public getDiagnostics(): any { return {}; }
}

describe("P0 Blocker: Remote Control & Secure Command Gateway E2E Suite", () => {
  const testSecret = "super-secure-industrial-test-key-32-chars-long";
  let gateway: SecureCommandGateway;
  let testDriver: TestEchoDriver;

  beforeEach(() => {
    gateway = SecureCommandGateway.getInstance();
    gateway.setHmacSecret(testSecret);
    durableCommandQueue.clearMemory();

    testDriver = new TestEchoDriver();
    industrialDriverManager.registerDriver(testDriver);

    // Reset runtime profile to SIMULATION for baseline tests
    RuntimeProfileManager.getInstance().setOverride("SIMULATION");
  });

  // 1. Full command lifecycle in DurableCommandQueue
  it("1. Debe registrar y persistir el ciclo de vida completo del comando: CREATED -> VALIDATED -> PENDING_APPROVAL -> APPROVED -> DISPATCHED -> ACKNOWLEDGED -> EXECUTED", async () => {
    const cmdId = `cmd-test-${Date.now()}`;
    const idempKey = `idemp-${cmdId}`;

    const created = durableCommandQueue.enqueue({
      commandId: cmdId,
      idempotencyKey: idempKey,
      tenantId: "TENANT_AZUCAR",
      plantId: "PLANT_01",
      areaId: "AREA_MILL",
      assetId: "MILL_01",
      tag: "Milling.Tandem_Speed_RPM",
      requestedValue: 4.5,
      oldValue: 3.5,
      unit: "RPM",
      reason: "Optimización de tasa de molienda zafra 2026",
      requester: {
        userId: "USR-OP-1",
        userName: "Operador Principal",
        role: "ingeniero_planta",
        twoFactorVerified: true,
        tenantId: "TENANT_AZUCAR",
      },
      timestamp: new Date().toISOString(),
      expiration: new Date(Date.now() + 60000).toISOString(),
      status: "CREATED",
      edgeNodeId: "EDGE-01",
      correlationId: `corr-${cmdId}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    expect(created.status).toBe("CREATED");

    // Lifecycle transitions
    durableCommandQueue.updateStatus(cmdId, "VALIDATED");
    expect(durableCommandQueue.getById(cmdId)?.status).toBe("VALIDATED");

    durableCommandQueue.updateStatus(cmdId, "PENDING_APPROVAL");
    expect(durableCommandQueue.getById(cmdId)?.status).toBe("PENDING_APPROVAL");

    durableCommandQueue.updateStatus(cmdId, "APPROVED", {
      approver: {
        userId: "USR-SUP-1",
        userName: "Jefe de Turno",
        role: "supervisor",
        approvedAt: new Date().toISOString(),
      },
    });
    expect(durableCommandQueue.getById(cmdId)?.status).toBe("APPROVED");
    expect(durableCommandQueue.getById(cmdId)?.approver?.userId).toBe("USR-SUP-1");

    durableCommandQueue.updateStatus(cmdId, "DISPATCHED");
    expect(durableCommandQueue.getById(cmdId)?.status).toBe("DISPATCHED");

    durableCommandQueue.updateStatus(cmdId, "ACKNOWLEDGED");
    expect(durableCommandQueue.getById(cmdId)?.status).toBe("ACKNOWLEDGED");

    durableCommandQueue.updateStatus(cmdId, "EXECUTED", {
      actualEchoValue: 4.5,
      echoDelta: 0.0,
      result: {
        success: true,
        message: "Comando ejecutado físicamente en PLC",
        executedAt: new Date().toISOString(),
      },
    });

    const finalRecord = durableCommandQueue.getById(cmdId);
    expect(finalRecord?.status).toBe("EXECUTED");
    expect(finalRecord?.actualEchoValue).toBe(4.5);
    expect(finalRecord?.echoDelta).toBe(0.0);
    expect(finalRecord?.result?.success).toBe(true);
  });

  // 2. Anti-replay prevention
  it("2. Debe rechazar con REJECTED_REPLAY_ATTACK cualquier reintento con un nonce ya consumido", async () => {
    const nonce = `nonce-${Date.now()}-${Math.random()}`;
    const timestamp = new Date().toISOString();
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-nonce-test-1",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 25.0,
      requester: {
        userId: "USR-ENG-1",
        role: "ingeniero_automatizacion",
        twoFactorVerified: true,
      },
      reason: "Ajuste de agua de imbibición para extracción óptima",
      timestamp,
      nonce,
    };

    const signed = gateway.signCommand(cmdReq, testSecret);

    // First execution: Success
    const res1 = await gateway.executeSecureWrite(signed);
    expect(res1.success).toBe(true);
    expect(res1.status).toBe("EXECUTED");

    // Second execution with SAME nonce: Replay attack detected
    const replayReq = { ...signed, commandId: "cmd-nonce-test-2" };
    const res2 = await gateway.executeSecureWrite(replayReq);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe("REJECTED_REPLAY_ATTACK");
  });

  // 3. Stale timestamp rejection
  it("3. Debe rechazar comandos con desfase temporal excesivo (> 30s) con REJECTED_STALE_TIMESTAMP", async () => {
    const staleTime = new Date(Date.now() - 45000).toISOString(); // 45 seconds old
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-stale-test",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 20.0,
      requester: {
        userId: "USR-ENG-1",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Comando transmitido con latencia o retraso artificial",
      timestamp: staleTime,
      nonce: `nonce-${Date.now()}`,
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_STALE_TIMESTAMP");
  });

  // 4. Cryptographic signature verification
  it("4. Debe rechazar con REJECTED_INVALID_SIGNATURE cuando el payload está adulterado o la clave HMAC es incorrecta", async () => {
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-tamper-test",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 15.0,
      requester: {
        userId: "USR-ENG-1",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Intento de modificación en tránsito de consigna industrial",
      timestamp: new Date().toISOString(),
      nonce: `nonce-${Date.now()}`,
    };

    // Sign with valid secret
    const signed = gateway.signCommand(cmdReq, testSecret);

    // Tamper with the requested value (e.g. man-in-the-middle changing 15.0 to 99.0)
    const tamperedReq = { ...signed, value: 99.0 };

    const res = await gateway.executeSecureWrite(tamperedReq);
    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_INVALID_SIGNATURE");
  });

  // 5. Critical process safety interlock
  it("5. Debe disparar enclavamiento físico (REJECTED_INTERLOCK_VIOLATION) si el nivel de domo de caldera es peligroso", async () => {
    // Set dangerous feedwater drum level (25% < 30% safe threshold)
    gateway.updateProcessContextReading("Boiler.Feedwater_Drum_Level", 25.0);

    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-interlock-test",
      tag: "Boiler1.Pressure_DBD0",
      targetDriverId: testDriver.id,
      value: 55.0,
      requester: {
        userId: "USR-ENG-1",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Aumento de presión de vapor para turbogeneración",
      timestamp: new Date().toISOString(),
      nonce: `nonce-interlock-${Date.now()}`,
      fourEyesApproval: {
        approvedByUserId: "USR-SUP-DUAL",
        approverRole: "jefe_planta",
        approvedAt: new Date().toISOString(),
      },
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_INTERLOCK_VIOLATION");
    expect(res.message).toContain("Boiler feedwater level is dangerously low");
  });

  // 6. Four-Eyes Principle for critical tags
  it("6. Debe exigir principio de cuatro ojos (REJECTED_FOUR_EYES_REQUIRED) para tags críticos como presión hidráulica o turbina", async () => {
    // Top roll hydraulic pressure is CRITICAL
    const cmdReqWithoutFourEyes: SecureWriteCommandRequest = {
      commandId: "cmd-four-eyes-1",
      tag: "Molienda.PresionHidraulica",
      targetDriverId: testDriver.id,
      value: 180.0,
      requester: {
        userId: "USR-ENG-1",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Ajuste de flotación de maza superior del molino 1",
      timestamp: new Date().toISOString(),
      nonce: `nonce-fe-1-${Date.now()}`,
    };

    const signed1 = gateway.signCommand(cmdReqWithoutFourEyes, testSecret);
    const res1 = await gateway.executeSecureWrite(signed1);
    expect(res1.success).toBe(false);
    expect(res1.status).toBe("REJECTED_FOUR_EYES_REQUIRED");

    // Attempting self-approval (requester == approver)
    const cmdReqSelfApproval: SecureWriteCommandRequest = {
      ...cmdReqWithoutFourEyes,
      commandId: "cmd-four-eyes-2",
      nonce: `nonce-fe-2-${Date.now()}`,
      fourEyesApproval: {
        approvedByUserId: "USR-ENG-1", // SAME AS REQUESTER
        approverRole: "supervisor",
        approvedAt: new Date().toISOString(),
      },
    };

    const signed2 = gateway.signCommand(cmdReqSelfApproval, testSecret);
    const res2 = await gateway.executeSecureWrite(signed2);
    expect(res2.success).toBe(false);
    expect(res2.status).toBe("REJECTED_FOUR_EYES_REQUIRED");
    expect(res2.message).toContain("El aprobador dual no puede ser el mismo usuario");
  });

  // 7. Engineering range limits
  it("7. Debe rechazar consignas que excedan los límites mecánicos/térmicos seguros (REJECTED_OUT_OF_RANGE)", async () => {
    // Max safe working pressure for boiler is 65 bar. Requesting 80 bar.
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-range-test",
      tag: "Boiler1.Pressure_DBD0",
      targetDriverId: testDriver.id,
      value: 80.0,
      requester: {
        userId: "USR-ENG-1",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Prueba fuera de rango de presión de caldera",
      timestamp: new Date().toISOString(),
      nonce: `nonce-range-${Date.now()}`,
      fourEyesApproval: {
        approvedByUserId: "USR-SUP-2",
        approverRole: "jefe_planta",
        approvedAt: new Date().toISOString(),
      },
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_OUT_OF_RANGE");
    expect(res.message).toContain("excede el límite operacional seguro");
  });

  // 8. SuperAdmin invariant
  it("8. SuperAdmin NO puede saltarse los enclavamientos físicos ni los límites de ingeniería", async () => {
    // Even SuperAdmin with 2FA cannot violate safe limits (65 bar ceiling)
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-superadmin-test",
      tag: "Boiler1.Pressure_DBD0",
      targetDriverId: testDriver.id,
      value: 75.0, // Exceeds 65 bar
      requester: {
        userId: "USR-SUPERADMIN-ROOT",
        role: "superadmin",
        twoFactorVerified: true,
      },
      reason: "Intento administrativo de sobrepasar límite de presión",
      timestamp: new Date().toISOString(),
      nonce: `nonce-sa-${Date.now()}`,
      fourEyesApproval: {
        approvedByUserId: "USR-OTHER-ADMIN",
        approverRole: "superadmin",
        approvedAt: new Date().toISOString(),
      },
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_OUT_OF_RANGE");
  });

  // 9. Multi-tenant isolation
  it("9. Debe rechazar con REJECTED_UNAUTHORIZED_ROLE cuando el tenantId del solicitante no coincide con el tenant destino", async () => {
    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-tenant-iso",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 12.0,
      tenantId: "TENANT_PLANT_A",
      requester: {
        userId: "USR-ATTACKER",
        role: "supervisor",
        twoFactorVerified: true,
        tenantId: "TENANT_PLANT_B", // MISMATCH!
      },
      reason: "Intento de comando transversal entre centrales distintos",
      timestamp: new Date().toISOString(),
      nonce: `nonce-iso-${Date.now()}`,
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_UNAUTHORIZED_ROLE");
    expect(res.message).toContain("Violación de aislamiento multi-tenant");
  });

  // 10. Read-after-write echo verification
  it("10. Debe validar verificación de eco físico (Read-After-Write) y reportar FAILED_ECHO_VERIFICATION ante discrepancia", async () => {
    // Configure driver to return echo deviation (sent 20.0, PLC echo returns 10.0)
    testDriver.echoValues.set("Maceration.Flow", 10.0);

    const cmdReq: SecureWriteCommandRequest = {
      commandId: "cmd-echo-fail",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 20.0,
      requester: {
        userId: "USR-OP",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Verificación de eco fallido por atascamiento de válvula",
      timestamp: new Date().toISOString(),
      nonce: `nonce-echo-${Date.now()}`,
    };

    const signed = gateway.signCommand(cmdReq, testSecret);
    const res = await gateway.executeSecureWrite(signed);

    expect(res.success).toBe(false);
    expect(res.status).toBe("FAILED_ECHO_VERIFICATION");
    expect(res.actualEchoValue).toBe(10.0);
    expect(res.echoDelta).toBe(10.0);
    expect(res.message).toContain("Fallo de verificación de eco");
  });

  // 11. Production Fail-Closed
  it("11. En perfil PRODUCTION, la falta de firma o el secreto por defecto debe causar Fail-Closed inmediato", async () => {
    RuntimeProfileManager.getInstance().setOverride("PRODUCTION");

    const cmdReqWithoutSig: SecureWriteCommandRequest = {
      commandId: "cmd-prod-failclosed",
      tag: "Maceration.Flow",
      targetDriverId: testDriver.id,
      value: 15.0,
      requester: {
        userId: "USR-OP",
        role: "supervisor",
        twoFactorVerified: true,
      },
      reason: "Comando sin firma emitido en entorno de producción",
      timestamp: new Date().toISOString(),
      nonce: `nonce-prod-${Date.now()}`,
    };

    const res = await gateway.executeSecureWrite(cmdReqWithoutSig);
    expect(res.success).toBe(false);
    expect(res.status).toBe("REJECTED_INVALID_SIGNATURE");
    expect(res.message).toContain("FAIL CLOSED");
  });
});
