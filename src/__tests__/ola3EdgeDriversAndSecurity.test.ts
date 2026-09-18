/**
 * BioAzúcar 4.0 — Test Suite: Ola 3
 * 
 * Validates:
 *  - I5: Modbus Security (TLS over port 802, certificate role verification, RBAC).
 *  - I7: Adaptadores de Planta (DCS EROS, Siemens S7 ISO-on-TCP, Allen-Bradley CIP).
 *  - I16: Gateway de Comandos Seguros (Role + 2FA, Interlocks físicos, 4-Ojos, HMAC, Read-After-Write).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { ErosDriverAdapter } from "../services/edge/drivers/ErosDriverAdapter";
import { SiemensS7DriverAdapter } from "../services/edge/drivers/SiemensS7DriverAdapter";
import { EtherNetIpDriverAdapter } from "../services/edge/drivers/EtherNetIpDriverAdapter";
import { industrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import {
  secureCommandGateway,
  SecureWriteCommandRequest,
} from "../services/edge/commands/SecureCommandGateway";

describe("BIOAZÚCAR 4.0 — OLA 3: ADAPTADORES DE PLANTA Y SEGURIDAD", () => {
  beforeEach(() => {
    industrialDriverManager.resetRegistry();
  });

  // ==========================================================================
  // ITERACIÓN I5: Modbus Security (TLS sobre Puerto 802)
  // ==========================================================================
  describe("I5: Modbus Security (TLS/802, mTLS y RBAC)", () => {
    it("autodetects Modbus Security when port 802 is configured", () => {
      const driver = new ModbusDriverAdapter({
        id: "modbus-sec-01",
        name: "Central Mill Modbus Security Gateway",
        protocol: "MODBUS-TCP",
        endpoint: "10.0.4.50:802",
      });

      expect(driver.isSecurityEnabled()).toBe(true);
      expect(driver.getSecurityConfig()?.tlsPort).toBe(802);
    });

    it("rejects mTLS connection if mutual authentication is required and client cert is missing", async () => {
      const driver = new ModbusDriverAdapter({
        id: "modbus-sec-02",
        name: "Strict mTLS Gateway",
        protocol: "MODBUS-TCP",
        endpoint: "10.0.4.50:802",
        customParameters: {
          requireMutualAuth: true,
          // clientCert not provided
        },
      });

      const connected = await driver.connect();
      expect(connected).toBe(false);
      expect(driver.status).toBe("FAULTED");

      const diag = await driver.getDiagnostics();
      expect(diag.lastError?.code).toBe("MODBUS_SECURITY_MTLS_FAILED");
    });

    it("enforces Modbus Security RBAC: blocks Operator from writing security/admin registers", async () => {
      const driver = new ModbusDriverAdapter({
        id: "modbus-sec-03",
        name: "RBAC Test Gateway",
        protocol: "MODBUS-TCP",
        endpoint: "10.0.4.50:802",
        customParameters: {
          requireMutualAuth: true,
          clientCert: "CERT_SHA256_OPERATOR_MILL",
          securityRole: "Operator",
        },
      });

      await driver.connect();
      expect(driver.status).toBe("AUTHENTICATED");
      expect(driver.getActiveSecurityRole()).toBe("Operator");

      // Operator writing to protected security tag should be blocked
      await expect(
        driver.writeTag("SECURITY_CONFIG_ENABLE", 1, 2, "Attempt to toggle security")
      ).rejects.toThrow(/Modbus Security RBAC Violation/);

      // Operator writing to high system register (>49000) should be blocked
      await expect(
        driver.writeTag("49500", 1, 2, "Attempt to write system register")
      ).rejects.toThrow(/Role 'Operator' cannot write protected system register/);
    });

    it("allows Administrator to write configuration registers", async () => {
      const driver = new ModbusDriverAdapter({
        id: "modbus-sec-04",
        name: "Admin Gateway",
        protocol: "MODBUS-TCP",
        endpoint: "10.0.4.50:802",
        customParameters: {
          requireMutualAuth: true,
          clientCert: "CERT_SHA256_ADMIN",
          securityRole: "Administrator",
        },
      });

      await driver.connect();
      const writeOk = await driver.writeTag(
        "SECURITY_POLICY_REG",
        100,
        3,
        "Admin updating security policy threshold"
      );
      expect(writeOk).toBe(true);
    });
  });

  // ==========================================================================
  // ITERACIÓN I7: Adaptadores para DCS EROS y PLCs
  // ==========================================================================
  describe("I7: Adaptador DCS EROS", () => {
    it("parses DCS EROS address syntax correctly", () => {
      const addr1 = ErosDriverAdapter.parseErosAddress("DB10.DBD14");
      expect(addr1.dbNumber).toBe(10);
      expect(addr1.areaType).toBe("D");
      expect(addr1.offset).toBe(14);

      const addr2 = ErosDriverAdapter.parseErosAddress("DB2.DBX0.5");
      expect(addr2.dbNumber).toBe(2);
      expect(addr2.areaType).toBe("X");
      expect(addr2.offset).toBe(0);
      expect(addr2.bitIndex).toBe(5);

      expect(() => ErosDriverAdapter.parseErosAddress("INVALID_SYNTAX")).toThrow();
    });

    it("reads and writes DCS EROS tags and evaluates health", async () => {
      const erosDriver = new ErosDriverAdapter({
        id: "eros-tandem-1",
        name: "Milling Tandem DCS EROS",
        protocol: "EROS",
        endpoint: "192.168.10.100:5000",
      });

      await erosDriver.connect();
      expect(erosDriver.status).toBe("AUTHENTICATED");

      // Read alias tag
      const dp = await erosDriver.readTag("Milling.EROS.Tandem_Speed_RPM");
      expect(dp.value).toBe(4.8);
      expect(dp.unit).toBe("RPM");
      expect(dp.quality).toBe("GOOD");

      // Write tag with clearance and justification
      const written = await erosDriver.writeTag(
        "Milling.EROS.Tandem_Speed_RPM",
        5.2,
        2,
        "Ajuste de molienda por incremento de caña fresca"
      );
      expect(written).toBe(true);

      const updated = await erosDriver.readTag("Milling.EROS.Tandem_Speed_RPM");
      expect(updated.value).toBe(5.2);

      const health = await erosDriver.checkHealth();
      expect(health.status).toBe("AUTHENTICATED");
      expect(health.lastError).toBeNull();
    });
  });

  describe("I7: Adaptador Siemens S7 (ISO-on-TCP RFC 1006)", () => {
    it("parses S7 DB, Input, Output, and Flag memory syntax", () => {
      const parsedDb = SiemensS7DriverAdapter.parseS7Address("DB1.DBD0");
      expect(parsedDb.area).toBe("DB");
      expect(parsedDb.dbNumber).toBe(1);
      expect(parsedDb.dataType).toBe("REAL");
      expect(parsedDb.byteOffset).toBe(0);

      const parsedInput = SiemensS7DriverAdapter.parseS7Address("IW0");
      expect(parsedInput.area).toBe("INPUTS");
      expect(parsedInput.dataType).toBe("WORD");
      expect(parsedInput.byteOffset).toBe(0);

      const parsedBit = SiemensS7DriverAdapter.parseS7Address("Q0.0");
      expect(parsedBit.area).toBe("OUTPUTS");
      expect(parsedBit.dataType).toBe("BOOL");
      expect(parsedBit.bitOffset).toBe(0);
    });

    it("connects with configurable rack/slot and reads steam pressure", async () => {
      const s7Driver = new SiemensS7DriverAdapter({
        id: "s7-boiler-1",
        name: "Boiler 1 Siemens S7-1500",
        protocol: "SIEMENS_S7",
        endpoint: "192.168.1.15:102",
        customParameters: { rack: 0, slot: 1 },
      });

      expect(s7Driver.getRack()).toBe(0);
      expect(s7Driver.getSlot()).toBe(1);

      await s7Driver.connect();
      expect(s7Driver.status).toBe("AUTHENTICATED");

      const dp = await s7Driver.readTag("DB1.DBD0");
      expect(dp.value).toBe(64.5);
      expect(dp.unit).toBe("bar");

      // Write new setpoint
      await s7Driver.writeTag("DB1.DBD0", 63.8, 2, "Rampa de enfriamiento programada");
      const readBack = await s7Driver.readTag("DB1.DBD0");
      expect(readBack.value).toBe(63.8);
    });
  });

  describe("I7: Adaptador Rockwell Allen-Bradley EtherNet/IP (CIP)", () => {
    it("registers CIP session and reads symbolic tags", async () => {
      const cipDriver = new EtherNetIpDriverAdapter({
        id: "cip-boilers",
        name: "ControlLogix CIP Gateway",
        protocol: "ETHERNET_IP",
        endpoint: "10.0.1.20:44818",
      });

      await cipDriver.connect();
      expect(cipDriver.status).toBe("AUTHENTICATED");
      expect(cipDriver.getSessionHandle()).toBeGreaterThan(0);

      const dp = await cipDriver.readTag("Boiler_1_Main_Steam_Pressure");
      expect(dp.value).toBe(64.2);
      expect(dp.unit).toBe("bar");

      await cipDriver.writeTag(
        "Boiler_1_Main_Steam_Pressure",
        62.5,
        2,
        "Reducción por demanda de vapor estabilizada"
      );
      const readAgain = await cipDriver.readTag("Boiler_1_Main_Steam_Pressure");
      expect(readAgain.value).toBe(62.5);
    });

    it("instantiates adapters dynamically via IndustrialDriverManager", () => {
      const s7 = industrialDriverManager.createAndRegisterDriver({
        id: "dyn-s7",
        name: "Dynamic S7",
        protocol: "SIEMENS_S7",
        endpoint: "192.168.2.10:102",
      });
      expect(s7.protocol).toBe("SIEMENS_S7");

      const eros = industrialDriverManager.createAndRegisterDriver({
        id: "dyn-eros",
        name: "Dynamic EROS",
        protocol: "EROS",
        endpoint: "192.168.2.11:5000",
      });
      expect(eros.protocol).toBe("EROS");

      const cip = industrialDriverManager.createAndRegisterDriver({
        id: "dyn-cip",
        name: "Dynamic CIP",
        protocol: "ETHERNET_IP",
        endpoint: "192.168.2.12:44818",
      });
      expect(cip.protocol).toBe("ETHERNET_IP");

      expect(industrialDriverManager.getAllDrivers().length).toBe(3);
    });
  });

  // ==========================================================================
  // ITERACIÓN I16: Gateway de Comandos Seguros (Tag Write Interlocks)
  // ==========================================================================
  describe("I16: Gateway de Comandos Seguros", () => {
    let s7Driver: SiemensS7DriverAdapter;

    beforeEach(async () => {
      s7Driver = new SiemensS7DriverAdapter({
        id: "s7-boiler-interlock",
        name: "Boiler S7 with Interlocks",
        protocol: "SIEMENS_S7",
        endpoint: "192.168.1.10:102",
      });
      await s7Driver.connect();
      industrialDriverManager.registerDriver(s7Driver);
    });

    it("rejects command if operational reason is missing or too short", async () => {
      const req: SecureWriteCommandRequest = {
        commandId: "cmd-001",
        tag: "DB1.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 60.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: true,
        },
        reason: "short", // < 10 chars
        timestamp: new Date().toISOString(),
        nonce: "nonce-001",
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED_INVALID_REASON");
    });

    it("rejects command if 2FA authentication is missing", async () => {
      const req: SecureWriteCommandRequest = {
        commandId: "cmd-002",
        tag: "DB1.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 60.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: false, // 2FA NOT verified
        },
        reason: "Ajuste de presión según demanda de turbina",
        timestamp: new Date().toISOString(),
        nonce: "nonce-002",
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED_MISSING_2FA");
    });

    it("rejects unauthorized operator role without Four-Eyes approval", async () => {
      const req: SecureWriteCommandRequest = {
        commandId: "cmd-003",
        tag: "DB1.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 60.0,
        requester: {
          userId: "usr-op-01",
          role: "operador", // Operator without four-eyes
          twoFactorVerified: true,
        },
        reason: "Operador intentando cambiar consigna de caldera",
        timestamp: new Date().toISOString(),
        nonce: "nonce-003",
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED_UNAUTHORIZED_ROLE");
    });

    it("rejects anti-replay violation when the same nonce is presented twice", async () => {
      const timestamp = new Date().toISOString();
      const nonce = "nonce-replay-001";
      const sig = secureCommandGateway.generateHmacSignature(
        "cmd-004",
        "Maceration.Flow.DBD30",
        25.0,
        timestamp,
        nonce
      );

      // Register driver for maceration tag
      const erosDriver = new ErosDriverAdapter({
        id: "eros-maceration",
        name: "EROS Maceration",
        protocol: "EROS",
        endpoint: "10.0.0.1:5000",
      });
      await erosDriver.connect();
      industrialDriverManager.registerDriver(erosDriver);

      const req: SecureWriteCommandRequest = {
        commandId: "cmd-004",
        tag: "Maceration.Flow.DBD30",
        targetDriverId: "eros-maceration",
        value: 25.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: true,
        },
        reason: "Aumento de agua de imbibición para extracción",
        timestamp,
        nonce,
        signature: sig,
      };

      // First run succeeds
      const firstRes = await secureCommandGateway.executeSecureWrite(req);
      expect(firstRes.success).toBe(true);

      // Second run with same nonce fails due to replay detection
      const replayRes = await secureCommandGateway.executeSecureWrite(req);
      expect(replayRes.success).toBe(false);
      expect(replayRes.status).toBe("REJECTED_REPLAY_ATTACK");
    });

    it("trips physical safety interlock when boiler feedwater level is dangerously low", async () => {
      // Set boiler feedwater level below safe threshold (< 30%)
      secureCommandGateway.updateProcessContextReading("Boiler.Feedwater_Drum_Level", 22.0);

      const timestamp = new Date().toISOString();
      const nonce = "nonce-interlock-01";
      const sig = secureCommandGateway.generateHmacSignature(
        "cmd-005",
        "Boiler.Main.Pressure.DBD0",
        62.0,
        timestamp,
        nonce
      );

      const req: SecureWriteCommandRequest = {
        commandId: "cmd-005",
        tag: "Boiler.Main.Pressure.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 62.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: true,
        },
        reason: "Subir presión de vapor por alta molienda",
        timestamp,
        nonce,
        signature: sig,
        fourEyesApproval: {
          approvedByUserId: "usr-eng-02",
          approverRole: "ingeniero_automatizacion",
          approvedAt: timestamp,
        },
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED_INTERLOCK_VIOLATION");
      expect(res.message).toContain("Boiler feedwater level is dangerously low");
    });

    it("enforces Four-Eyes principle: prevents requester from approving their own critical command", async () => {
      // Restore safe level
      secureCommandGateway.updateProcessContextReading("Boiler.Feedwater_Drum_Level", 55.0);

      const timestamp = new Date().toISOString();
      const nonce = "nonce-self-approve-01";
      const sig = secureCommandGateway.generateHmacSignature(
        "cmd-006",
        "Boiler.Main.Pressure.DBD0",
        62.0,
        timestamp,
        nonce
      );

      const req: SecureWriteCommandRequest = {
        commandId: "cmd-006",
        tag: "Boiler.Main.Pressure.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 62.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: true,
        },
        reason: "Aumento de presión con auto-aprobación inválida",
        timestamp,
        nonce,
        signature: sig,
        fourEyesApproval: {
          approvedByUserId: "usr-sup-01", // SAME USER!
          approverRole: "supervisor",
          approvedAt: timestamp,
        },
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(false);
      expect(res.status).toBe("REJECTED_FOUR_EYES_REQUIRED");
      expect(res.message).toContain("El aprobador dual no puede ser el mismo usuario");
    });

    it("successfully executes write with Read-After-Write echo verification when all safety criteria pass", async () => {
      secureCommandGateway.updateProcessContextReading("Boiler.Feedwater_Drum_Level", 55.0);

      const timestamp = new Date().toISOString();
      const nonce = "nonce-success-01";
      const sig = secureCommandGateway.generateHmacSignature(
        "cmd-007",
        "Boiler.Main.Pressure.DBD0",
        62.0,
        timestamp,
        nonce
      );

      const req: SecureWriteCommandRequest = {
        commandId: "cmd-007",
        tag: "Boiler.Main.Pressure.DBD0",
        targetDriverId: "s7-boiler-interlock",
        value: 62.0,
        requester: {
          userId: "usr-sup-01",
          role: "supervisor",
          twoFactorVerified: true,
        },
        reason: "Ajuste de presión debidamente justificado y firmado",
        timestamp,
        nonce,
        signature: sig,
        fourEyesApproval: {
          approvedByUserId: "usr-eng-02", // Different approver
          approverRole: "ingeniero_automatizacion",
          approvedAt: timestamp,
        },
      };

      const res = await secureCommandGateway.executeSecureWrite(req);
      expect(res.success).toBe(true);
      expect(res.status).toBe("EXECUTED");
      expect(res.actualEchoValue).toBe(62.0);
      expect(res.echoDelta).toBe(0);
      expect(res.signatureVerified).toBe(true);
    });
  });
});
