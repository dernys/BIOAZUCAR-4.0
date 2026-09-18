import { describe, it, expect } from "vitest";
import { OpcUaComplianceTestService } from "../services/edge/verification/OpcUaComplianceTestService";
import { FatAcceptanceService } from "../services/edge/verification/FatAcceptanceService";
import { SatCommissioningService } from "../services/edge/verification/SatCommissioningService";
import { ChaosTestingEngine } from "../services/edge/verification/ChaosTestingEngine";
import { Iec62443AuditService } from "../services/edge/verification/Iec62443AuditService";
import * as fs from "fs";
import * as path from "path";

describe("OLA 5: Verificación Formal FAT/SAT y Entrega Industrial", () => {
  // =========================================================================
  // I3: CONFORMIDAD OPC UA (OPC Foundation CTT)
  // =========================================================================
  describe("I3: Conformidad OPC UA (OPC Foundation Compliance Test Tool)", () => {
    const opcUaService = OpcUaComplianceTestService.getInstance();

    it("ejecuta la suite CTT y supera el umbral estricto de certificación (>95%)", () => {
      const report = opcUaService.runComplianceSuite("opc.tcp://192.168.10.30:4840");

      expect(report.totalTests).toBeGreaterThanOrEqual(10);
      expect(report.complianceRate).toBeGreaterThanOrEqual(95.0);
      expect(report.isCertified).toBe(true);
      expect(report.failedCount).toBe(0);
      expect(report.securityPoliciesTested).toContain(
        "http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256"
      );
    });

    it("valida el rechazo de SecurityMode=None y certificados autofirmados no confiables", () => {
      const report = opcUaService.runComplianceSuite();

      const rejectNoneCase = report.cases.find((c) => c.id === "CTT-SEC-001");
      expect(rejectNoneCase).toBeDefined();
      expect(rejectNoneCase?.status).toBe("PASSED");
      expect(rejectNoneCase?.actualResult).toContain("BadSecurityPolicyRejected");

      const rejectUntrustedCase = report.cases.find((c) => c.id === "CTT-CERT-001");
      expect(rejectUntrustedCase).toBeDefined();
      expect(rejectUntrustedCase?.status).toBe("PASSED");
      expect(rejectUntrustedCase?.actualResult).toContain("BadCertificateUntrusted");
    });

    it("valida suscripciones con supresión deadband y reconexión automática sin pérdida de estado", () => {
      const report = opcUaService.runComplianceSuite();

      const deadbandCase = report.cases.find((c) => c.id === "CTT-SUBS-002");
      expect(deadbandCase?.status).toBe("PASSED");

      const failoverCase = report.cases.find((c) => c.id === "CTT-FAIL-001");
      expect(failoverCase?.status).toBe("PASSED");
      expect(failoverCase?.actualResult).toContain("TransferSubscriptions exitoso");
    });
  });

  // =========================================================================
  // I17: FAT (FACTORY ACCEPTANCE TEST) EN BANCO DE PRUEBAS
  // =========================================================================
  describe("I17: FAT (Factory Acceptance Test) en Banco de Pruebas", () => {
    const fatService = FatAcceptanceService.getInstance();

    it("soporta carga extrema de 5,000 tags/segundo con latencia p99 inferior a 20ms", () => {
      const report = fatService.runFatProtocol({ tagsPerSecond: 5000, durationSeconds: 5 });

      expect(report.overallStatus).toBe("APPROVED_FOR_SITE_DELIVERY");
      expect(report.benchmark.actualTagsPerSec).toBeGreaterThanOrEqual(5000);
      expect(report.benchmark.latencyMs.p99).toBeLessThanOrEqual(20.0);
      expect(report.benchmark.ramUsageMb).toBeLessThanOrEqual(512);
    });

    it("garantiza 0 pérdida de datos ante corte violento de energía eléctrica (RPO=0) con recuperación WAL", () => {
      const report = fatService.runFatProtocol();

      expect(report.powerLossTest.dataLossCount).toBe(0);
      expect(report.powerLossTest.checksumMatches).toBe(true);
      expect(report.powerLossTest.walIntegrityStatus).toBe("PRISTINE");
      expect(report.powerLossTest.tagsRecoveredPostReboot).toBe(
        report.powerLossTest.tagsInWalJournalAtCutoff
      );

      const powerReq = report.conformanceItems.find((i) => i.code === "FAT-REQ-04");
      expect(powerReq?.status).toBe("PASS");
    });
  });

  // =========================================================================
  // I18: SAT (SITE ACCEPTANCE TEST) EN PLANTA PILOTO
  // =========================================================================
  describe("I18: SAT (Site Acceptance Test) en Planta Piloto", () => {
    const satService = SatCommissioningService.getInstance();

    it("valida variables operacionales en tándem de molinos y caldera dentro de tolerancias de diseño", () => {
      const act = satService.getSatAct();

      expect(act.sugarMillName).toContain("Central Azucarero");
      expect(act.overallResult).toBe("SAT_SUCCESSFULLY_COMMISSIONED");
      expect(act.measuredTchAverage).toBeGreaterThanOrEqual(act.millingTandemRatedTch);
      expect(act.steamPressureBar).toBeGreaterThanOrEqual(42.0);
      expect(act.powerExportMw).toBeGreaterThanOrEqual(18.0);

      // Verify all process checks are compliant
      const nonCompliant = act.processChecks.filter((c) => !c.isWithinSpec);
      expect(nonCompliant.length).toBe(0);
    });

    it("contiene firmas digitales de todas las partes clave sin observaciones pendientes", () => {
      const act = satService.getSatAct();

      expect(act.signatories.length).toBe(4);
      expect(act.signatories.every((s) => s.hasSigned)).toBe(true);
      expect(act.punchlistItems.length).toBe(0);

      // Verify signing mechanism
      const signed = satService.signSatAct("COMMISSIONING_LEAD", "Ing. Dernys (OT Lead)");
      expect(signed).toBe(true);
      expect(satService.getSatAct().signatories.find((s) => s.role === "COMMISSIONING_LEAD")?.digitalFingerprint).toContain("SHA256:");
    });
  });

  // =========================================================================
  // I19: CHAOS TESTING INDUSTRIAL & RESILIENCIA
  // =========================================================================
  describe("I19: Chaos Testing Industrial & Resiliencia", () => {
    const chaosEngine = ChaosTestingEngine.getInstance();

    it("ofrece los 5 escenarios canónicos de falla industrial", () => {
      const scenarios = chaosEngine.getScenarios();
      expect(scenarios.length).toBe(5);

      const scenarioIds = scenarios.map((s) => s.id);
      expect(scenarioIds).toContain("ETHERNET_DISCONNECT");
      expect(scenarioIds).toContain("PACKET_DROP_20PCT");
      expect(scenarioIds).toContain("CPU_STARVATION_100PCT");
      expect(scenarioIds).toContain("DISK_FULL_95PCT");
      expect(scenarioIds).toContain("EXPIRED_CERTIFICATE");
    });

    it("inyecta desconexión física Ethernet activando Store & Forward sin crash", () => {
      const res = chaosEngine.injectFault("ETHERNET_DISCONNECT");

      expect(res.systemCrashed).toBe(false);
      expect(res.gracefulDegradationVerified).toBe(true);
      expect(res.storeAndForwardEngaged).toBe(true);
      expect(res.alarmTripped).toBe("COMMUNICATION_LINK_LOST_ETH0");
      expect(res.recoveryTimeMs).toBeLessThan(500);
    });

    it("inyecta pérdida del 20% de paquetes y maneja timeouts adaptativos sin bloqueo", () => {
      const res = chaosEngine.injectFault("PACKET_DROP_20PCT");

      expect(res.systemCrashed).toBe(false);
      expect(res.gracefulDegradationVerified).toBe(true);
      expect(res.alarmTripped).toBe("HIGH_NETWORK_PACKET_LOSS_DEGRADED");
    });

    it("ejecuta la suite completa de caos y valida 100% de resiliencia con 0 fallos catastróficos", () => {
      const allResults = chaosEngine.runFullChaosSuite();

      expect(allResults.length).toBe(5);
      expect(allResults.every((r) => !r.systemCrashed)).toBe(true);
      expect(allResults.every((r) => r.gracefulDegradationVerified)).toBe(true);
      expect(allResults.every((r) => r.postRecoveryIntegrityScore === 100)).toBe(true);
    });
  });

  // =========================================================================
  // I20: MATRIZ IEC 62443 SL3 & SBOM CYCLONEDX
  // =========================================================================
  describe("I20: Paquete de Evidencia y Matriz IEC 62443 SL3", () => {
    const iecAuditService = Iec62443AuditService.getInstance();

    it("valida la matriz de trazabilidad FR1 a FR7 con 100% de cumplimiento", () => {
      const pkg = iecAuditService.generateAuditPackage();

      expect(pkg.standard).toContain("IEC 62443-3-3");
      expect(pkg.targetSecurityLevel).toBe("SL-3");
      expect(pkg.overallComplianceScorePct).toBe(100.0);
      expect(pkg.criticalVulnerabilitiesCount).toBe(0);
      expect(pkg.highVulnerabilitiesCount).toBe(0);

      // Verify all 7 Fundamental Requirements are accounted for
      const frs = pkg.requirements.map((r) => r.fundamentalRequirement);
      expect(frs.some((f) => f.includes("FR1"))).toBe(true);
      expect(frs.some((f) => f.includes("FR2"))).toBe(true);
      expect(frs.some((f) => f.includes("FR3"))).toBe(true);
      expect(frs.some((f) => f.includes("FR4"))).toBe(true);
      expect(frs.some((f) => f.includes("FR5"))).toBe(true);
      expect(frs.some((f) => f.includes("FR6"))).toBe(true);
      expect(frs.some((f) => f.includes("FR7"))).toBe(true);

      expect(pkg.requirements.every((r) => r.status === "COMPLIANT")).toBe(true);
    });

    it("genera el SBOM CycloneDX con componentes, licencias y hashes criptográficos", () => {
      const pkg = iecAuditService.generateAuditPackage();

      expect(pkg.sbomSummary.specVersion).toContain("CycloneDX");
      expect(pkg.sbomSummary.totalComponents).toBeGreaterThanOrEqual(4);

      const daemonComponent = pkg.sbomSummary.components.find(
        (c) => c.name === "bioazucar-edge-daemon"
      );
      expect(daemonComponent).toBeDefined();
      expect(daemonComponent?.hashes.SHA256).toBeDefined();
    });
  });

  // =========================================================================
  // I21: IMAGEN GOLDEN Y DESPLIEGUE AUTOMATIZADO
  // =========================================================================
  describe("I21: Imagen Golden de Producción y Despliegue Automatizado", () => {
    it("posee el script desatendido de aprovisionamiento con controles de Dual-NIC, sysctl y systemd", () => {
      const scriptPath = path.resolve(process.cwd(), "deploy/golden-image-provision.sh");
      expect(fs.existsSync(scriptPath)).toBe(true);

      const content = fs.readFileSync(scriptPath, "utf-8");
      expect(content).toContain("net.ipv4.ip_forward = 0");
      expect(content).toContain("otuser");
      expect(content).toContain("otgroup");
      expect(content).toContain("bioazucar-edge.service");
      expect(content).toContain("rsa:4096");
      expect(content).toContain("Dual-NIC");
    });
  });
});
