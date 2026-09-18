import { describe, it, expect, beforeEach, vi } from "vitest";
import { OfflineSyncManager } from "../services/offline/OfflineSyncManager";
import { DualNicManager } from "../services/edge/network/DualNicManager";
import { ZeroTrustAccessController } from "../services/edge/security/ZeroTrustAccessController";
import { CisBenchmarkHardeningService } from "../services/edge/security/CisBenchmarkHardeningService";

describe("OLA 4: Hardening de Infraestructura IPC, Dual-NIC y Modo Offline", () => {
  // ===========================================================================
  // I10: APLICACIÓN SCADA/MES OFFLINE-FIRST
  // ===========================================================================
  describe("I10: OfflineSyncManager (Operación SCADA Autónoma & Reconciliación)", () => {
    let offlineManager: OfflineSyncManager;

    beforeEach(() => {
      offlineManager = OfflineSyncManager.getInstance();
      offlineManager.resetQueue();
      offlineManager.setConnectivityState(true);
    });

    it("debe encolar mutaciones locales durante corte de enlace sin perder datos", () => {
      offlineManager.setConnectivityState(false);
      expect(offlineManager.getStatus().isOnline).toBe(false);

      const entry1 = offlineManager.enqueueOperation({
        collection: "telemetry",
        operation: "LOG_MEASUREMENT",
        payload: { sensor: "NIVEL_DOMO_CALDERA", value: 52.8, unit: "%" },
        author: { userId: "op_01", role: "operador", deviceId: "IPC_TANDEM_01" },
      });

      const entry2 = offlineManager.enqueueOperation({
        collection: "work_orders",
        operation: "UPDATE",
        payload: { orderId: "WO-2026-001", status: "EN_PROCESO" },
        author: { userId: "sup_01", role: "supervisor", deviceId: "HMI_MOLIENDA" },
      });

      const status = offlineManager.getStatus();
      expect(status.pendingCount).toBe(2);
      expect(entry1.syncStatus).toBe("PENDING");
      expect(entry1.logicalClock).toBeGreaterThan(0);
      expect(entry2.logicalClock).toBeGreaterThan(entry1.logicalClock);
    });

    it("debe sincronizar por lotes determinísticamente al restaurar o disparar la sincronización", async () => {
      offlineManager.setConnectivityState(false);

      offlineManager.enqueueOperation({
        collection: "telemetry",
        operation: "LOG_MEASUREMENT",
        payload: { sensor: "PRESION_VAPOR_VIVO", value: 44.2, unit: "bar" },
        author: { userId: "op_02", role: "operador", deviceId: "IPC_TANDEM_01" },
      });

      expect(offlineManager.getStatus().pendingCount).toBe(1);

      // Ejecutar sincronización de lote
      const syncResult = await offlineManager.triggerSynchronization();
      expect(syncResult.syncedCount).toBe(1);

      const status = offlineManager.getStatus();
      expect(status.pendingCount).toBe(0);
      expect(status.syncedCount).toBeGreaterThanOrEqual(1);
      expect(status.lastSyncTimestamp).toBeTypeOf("number");
    });

    it("debe aplicar la política Edge-Authoritative para mediciones físicas en conflicto", () => {
      offlineManager.setConnectivityState(false);

      const entry = offlineManager.enqueueOperation({
        collection: "telemetry",
        operation: "LOG_MEASUREMENT",
        payload: { sensor: "BRIX_JUGO_CLARIFICADO", value: 16.4 },
        author: { userId: "lab_01", role: "operador", deviceId: "LAB_PDA" },
      });

      // Resolver conflicto priorizando el borde industrial
      const resolved = offlineManager.resolveConflict(entry.id, "KEEP_LOCAL_EDGE");
      expect(resolved).toBe(true);

      const pending = offlineManager.getPendingEntries();
      const target = pending.find((p) => p.id === entry.id);
      expect(target?.syncStatus).toBe("CONFLICT_RESOLVED");
      expect(target?.conflictResolutionNote).toContain("Edge Local");
    });
  });

  // ===========================================================================
  // I11: SEGMENTACIÓN DUAL-NIC Y REGLAS DE FIREWALL
  // ===========================================================================
  describe("I11: DualNicManager (Segmentación OT/DMZ & IEC 62443 FR5)", () => {
    let dualNicManager: DualNicManager;

    beforeEach(() => {
      dualNicManager = DualNicManager.getInstance();
      dualNicManager.setKernelIpForward(0);
    });

    it("debe validar que la interfaz eth0 OT esté aislada y sin default gateway", () => {
      const { eth0 } = dualNicManager.getInterfaceConfigs();
      expect(eth0.interfaceName).toBe("eth0");
      expect(eth0.zone).toBe("OT_PLANT");
      expect(eth0.gateway).toBeNull();
      expect(eth0.allowedPorts).toEqual([502, 802, 4840, 102, 44818]);
    });

    it("debe validar que la interfaz eth1 DMZ sólo permita conductos de egreso TLS 443 / 8883", () => {
      const { eth1 } = dualNicManager.getInterfaceConfigs();
      expect(eth1.interfaceName).toBe("eth1");
      expect(eth1.zone).toBe("DMZ_SUPERVISORY");
      expect(eth1.gateway).toBe("10.0.50.1");
      expect(eth1.allowedPorts).toContain(443);
      expect(eth1.allowedPorts).toContain(8883);
    });

    it("debe auditar y penalizar severamente si el kernel tiene ip_forward = 1", () => {
      // Estado normal: ip_forward = 0
      let audit = dualNicManager.auditDualNicCompliance();
      expect(audit.ipForwardingDisabled).toBe(true);
      expect(audit.complianceScore).toBe(100);
      expect(audit.violations.length).toBe(0);

      // Simular violación de seguridad crítica
      dualNicManager.setKernelIpForward(1);
      audit = dualNicManager.auditDualNicCompliance();
      expect(audit.ipForwardingDisabled).toBe(false);
      expect(audit.complianceScore).toBeLessThan(70);
      expect(audit.violations.some((v) => v.includes("net.ipv4.ip_forward"))).toBe(true);
    });

    it("debe generar un script de iptables con política FORWARD DROP y conductos industriales", () => {
      const script = dualNicManager.generateIptablesRulesScript();
      expect(script).toContain("iptables -P FORWARD DROP");
      expect(script).toContain("iptables -P INPUT DROP");
      expect(script).toContain("dport 502");
      expect(script).toContain("dport 4840");
      expect(script).toContain("dport 102");
      expect(script).toContain("net.ipv4.ip_forward = 0");
    });
  });

  // ===========================================================================
  // I12: ACCESO REMOTO SEGURO ZERO-TRUST
  // ===========================================================================
  describe("I12: ZeroTrustAccessController (Bastión Jump Host & Emergency Lockdown)", () => {
    let ztController: ZeroTrustAccessController;

    beforeEach(() => {
      ztController = ZeroTrustAccessController.getInstance();
      ztController.clearEmergencyLockdown("test_admin");
    });

    it("debe autorizar una sesión efímera si cumple con Jump Host, MFA y Orden de Trabajo", () => {
      const result = ztController.requestSession({
        engineerId: "eng_siemens_99",
        engineerName: "Ing. Sofia Valdés",
        role: "AUTOMATION_SPECIALIST",
        bastionIp: "10.0.50.254", // Whitelisted
        clientCertificateThumbprint: "SHA256:55:12:AA:BB:CC",
        workOrderRef: "WO-2026-CALDERA-INSPECTION",
        targetDevice: "PLC-CALDERA-DOMO (192.168.10.21)",
        ttlMinutes: 30,
        mfaToken: "749102",
      });

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
      expect(result.session?.status).toBe("ACTIVE");
      expect(result.session?.mfaVerified).toBe(true);
      expect(result.session?.expiresAt).toBeGreaterThan(Date.now());
    });

    it("debe rechazar accesos desde IPs de Jump Host no autorizadas", () => {
      const result = ztController.requestSession({
        engineerId: "hacker_01",
        engineerName: "Unknown",
        role: "VENDOR_SUPPORT",
        bastionIp: "192.168.1.99", // NOT whitelisted
        clientCertificateThumbprint: "SHA256:00:00",
        workOrderRef: "WO-2026-TEST",
        targetDevice: "PLC-01",
        ttlMinutes: 30,
        mfaToken: "123456",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("UNAUTHORIZED_BASTION_IP");
    });

    it("debe registrar comandos ejecutados con trazabilidad forense", () => {
      const sessions = ztController.getSessions();
      const activeSession = sessions.find((s) => s.status === "ACTIVE");
      expect(activeSession).toBeDefined();

      if (activeSession) {
        const logged = ztController.logSessionCommand(
          activeSession.sessionId,
          "SET_PID_GAIN Kp=3.5",
          "DB10.DBD14",
          "EXECUTED",
          "Ajuste de lazo cerrado de nivel de domo"
        );
        expect(logged).toBe(true);

        const logs = ztController.getCommandAuditLogs(activeSession.sessionId);
        expect(logs.some((l) => l.commandText.includes("SET_PID_GAIN"))).toBe(true);
      }
    });

    it("debe permitir revocación instantánea individual y Emergency Plant Lockdown", () => {
      // 1. Lockdown
      const lockdownRes = ztController.triggerEmergencyPlantLockdown(
        "Alarma de intrusión perimetral en sala de control",
        "admin_sec"
      );

      expect(lockdownRes.terminatedCount).toBeGreaterThanOrEqual(1);
      expect(ztController.getStatus().isLockdownActive).toBe(true);

      // 2. Intentar nueva sesión durante lockdown debe fallar
      const attempt = ztController.requestSession({
        engineerId: "eng_01",
        engineerName: "Ing. Pedro",
        role: "PLANT_ENGINEER",
        bastionIp: "10.0.50.254",
        clientCertificateThumbprint: "SHA256:11",
        workOrderRef: "WO-2026-001",
        targetDevice: "PLC-01",
        ttlMinutes: 15,
        mfaToken: "998877",
      });

      expect(attempt.success).toBe(false);
      expect(attempt.error).toContain("EMERGENCY_LOCKDOWN_ACTIVE");
    });
  });

  // ===========================================================================
  // I13: HARDENING CIS BENCHMARK DEL SISTEMA OPERATIVO DEL IPC
  // ===========================================================================
  describe("I13: CisBenchmarkHardeningService (CIS Linux Benchmark & IEC 62443-4-2)", () => {
    let cisService: CisBenchmarkHardeningService;

    beforeEach(() => {
      cisService = CisBenchmarkHardeningService.getInstance();
      cisService.clearOverrides();
    });

    it("debe evaluar los 7 controles críticos de seguridad del IPC y calificar Grade A", () => {
      const report = cisService.runAudit();
      expect(report.checks.length).toBe(7);
      expect(report.overallScore).toBe(100);
      expect(report.grade).toBe("COMPLIANT_GRADE_A");
      expect(report.failedCount).toBe(0);

      // Validar presencia de controles específicos
      const checkIds = report.checks.map((c) => c.id);
      expect(checkIds).toContain("CIS-1.1.1"); // Non-root otuser
      expect(checkIds).toContain("CIS-1.6.1"); // AppArmor
      expect(checkIds).toContain("CIS-1.1.18"); // USB mass storage block
      expect(checkIds).toContain("CIS-2.2.1"); // Chrony NTS
      expect(checkIds).toContain("CIS-3.1.1"); // IP forward disabled
    });

    it("debe degradar la calificación si se detectan controles no conformes", () => {
      cisService.setCheckOverride("CIS-1.1.18", "FAIL"); // USB no bloqueado
      cisService.setCheckOverride("CIS-3.1.1", "FAIL"); // IP forward habilitado
      cisService.setCheckOverride("CIS-1.6.1", "FAIL"); // Sin AppArmor

      const report = cisService.runAudit();
      expect(report.failedCount).toBe(3);
      expect(report.overallScore).toBeLessThan(70);
      expect(report.grade).toBe("NON_COMPLIANT_GRADE_C");
    });
  });
});
