import { describe, it, expect, beforeEach } from "vitest";
import {
  Tandem1CommissioningProtocolEngine,
  TANDEM1_CRITICAL_TAGS,
} from "../services/edge/verification/Tandem1CommissioningProtocolEngine";

describe("Iteración I31 / FAT-02: Protocolo de Comisionamiento FAT / SAT Tándem #1", () => {
  let engine: Tandem1CommissioningProtocolEngine;

  beforeEach(() => {
    engine = Tandem1CommissioningProtocolEngine.getInstance();
    engine.resetForTesting();
  });

  describe("Capa 1: Catálogo y Especificación de los 25 Tags Críticos de Molienda", () => {
    it("debe contener exactamente los 25 tags canónicos del Tándem #1 según DOCS/FAT_SAT_COMMISSIONING_TANDEM1.md", () => {
      const tags = engine.getTags();
      expect(tags.length).toBe(25);
      expect(TANDEM1_CRITICAL_TAGS.length).toBe(25);

      // Validar tags esenciales de molienda y preparación
      const tagFeed = tags.find((t) => t.unsTag === "TANDEM1/MILL_FEED/TCH");
      expect(tagFeed).toBeDefined();
      expect(tagFeed?.rangeMax).toBe(800);
      expect(tagFeed?.protocol).toBe("Modbus TCP");

      const tagDesfib = tags.find((t) => t.unsTag === "TANDEM1/PREPARATION/DESFIBRADOR_RPM");
      expect(tagDesfib).toBeDefined();
      expect(tagDesfib?.rangeMax).toBe(1500);
      expect(tagDesfib?.protocol).toBe("OPC UA");

      const tagHydPress1 = tags.find((t) => t.unsTag === "TANDEM1/MILL1/HYDRAULIC_PRESS_BAR");
      expect(tagHydPress1).toBeDefined();
      expect(tagHydPress1?.rangeMax).toBe(350);

      const tagExtHugot = tags.find((t) => t.unsTag === "TANDEM1/EXTRACTION/SUCROSE_EXT_PCT");
      expect(tagExtHugot).toBeDefined();
      expect(tagExtHugot?.rangeMin).toBe(90);
      expect(tagExtHugot?.rangeMax).toBe(98);
    });

    it("debe garantizar que cada tag tenga tolerancias y rangos válidos", () => {
      const tags = engine.getTags();
      for (const t of tags) {
        expect(t.rangeMax).toBeGreaterThan(t.rangeMin);
        expect(t.frequencySec).toBeGreaterThan(0);
        expect(t.tolerance).toBeDefined();
        expect(["CRITICAL", "HIGH", "MEDIUM"]).toContain(t.criticality);
      }
    });
  });

  describe("Capa 2: Etapa 1 - Verificación de Capa Física y Red (Dual NIC)", () => {
    it("debe validar el aislamiento VLAN y latencia SLA < 2.0 ms", () => {
      const res = engine.executeStage1Network();
      expect(res.passed).toBe(true);
      expect(res.vlanSegregationVerified).toBe(true);
      expect(res.pingLatencyMs).toBeLessThan(2.0);
      expect(res.latencySlaMet).toBe(true);
      expect(res.ipForwardingDisabled).toBe(true);
    });
  });

  describe("Capa 3: Etapa 2 - Calibración y Loop Check de los 25 Tags", () => {
    it("debe calibrar exitosamente los 25 tags en los 3 puntos de prueba (4mA, 12mA, 20mA)", () => {
      const res = engine.executeStage2LoopCheck();
      expect(res.passed).toBe(true);
      expect(res.totalTags).toBe(25);
      expect(res.passedTags).toBe(25);
      expect(res.tagResults.length).toBe(25);

      for (const tagRes of res.tagResults) {
        expect(tagRes.overallPassed).toBe(true);
        expect(tagRes.calibrationPoints.length).toBe(3);
        expect(tagRes.calibrationPoints.every((p) => p.passed)).toBe(true);
      }
    });

    it("debe detectar y marcar NO CONFORME si un tag de presión hidráulica excede la tolerancia", () => {
      // Inyectar falla en tag #5 (TANDEM1/MILL1/HYDRAULIC_PRESS_BAR)
      const res = engine.executeStage2LoopCheck({ simulateErrorTagIndex: 5 });
      expect(res.passed).toBe(false);
      expect(res.passedTags).toBe(24);

      const failedTag = res.tagResults.find((r) => r.spec.index === 5);
      expect(failedTag).toBeDefined();
      expect(failedTag?.overallPassed).toBe(false);
      expect(failedTag?.notes).toContain("excede");
    });
  });

  describe("Capa 4: Etapa 3 - Validación de Compresión SDT (Swinging Door)", () => {
    it("debe verificar que la tasa de compresión SDT sea >= 80% y capture escalón transitorio", () => {
      const res = engine.executeStage3SdtCompression();
      expect(res.passed).toBe(true);
      expect(res.compressionRatioPct).toBeGreaterThanOrEqual(80.0);
      expect(res.compressionSlaMet).toBe(true);
      expect(res.stepResponseCaptured).toBe(true);
      expect(res.stepResponseLatencyMs).toBeLessThan(50);
    });
  });

  describe("Capa 5: Etapa 4 - Resiliencia de Desconexión WAN (Store & Forward)", () => {
    it("debe verificar cero pérdida de datos tras 15 minutos de corte WAN y drenado post-reconexión", () => {
      const res = engine.executeStage4WanResilience();
      expect(res.passed).toBe(true);
      expect(res.outageDurationSec).toBe(900);
      expect(res.pointsGeneratedDuringOutage).toBe(45000);
      expect(res.pointsPersistedToWal).toBe(45000);
      expect(res.pointsDrainedPostReconnect).toBe(45000);
      expect(res.dataLossCount).toBe(0);
      expect(res.orderIntegrityPreserved).toBe(true);
    });
  });

  describe("Capa 6: Etapa 5 - Gating de Calidad BioAI y Detección de Datos Simulados", () => {
    it("debe rechazar el 100% de datos marcados como SIMULATED en modo productivo", () => {
      const res = engine.executeStage5BioAiQuality();
      expect(res.passed).toBe(true);
      expect(res.rejectionRatePct).toBe(100.0);
      expect(res.hugotModelPreserved).toBe(true);
    });
  });

  describe("Capa 7: Protocolo E2E, Sello Criptográfico SHA-256 y Firma de Acta Oficial", () => {
    it("debe ejecutar el protocolo completo y emitir el Acta Oficial aprobada", () => {
      const cert = engine.runFullProtocol({
        millName: "Central Azucarero Portuguesa",
        auditorName: "Ing. Carlos Mendoza (TÜV Rheinland)",
        otArchitectName: "Ing. Dernys (BioAzúcar 4.0)",
        millSuperintendentName: "Ing. Marcos Vielma (Superintendente)",
      });

      expect(cert.overallStatus).toBe("CONFORME_APROBADO_COMERCIAL");
      expect(cert.conformanceHashSha256.length).toBe(64);
      expect(cert.signatories.length).toBe(3);
      expect(cert.standardsComplied.length).toBeGreaterThanOrEqual(4);

      // Verificar que el certificado se almacena en memoria
      const retrieved = engine.getCertificate(cert.certificateId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.actNumber).toBe(cert.actNumber);

      // Verificar integridad criptográfica de firmas y hash
      const isValid = engine.verifyCertificateIntegrity(cert);
      expect(isValid).toBe(true);
    });

    it("debe detectar alteraciones maliciosas (tampering) en los datos del acta", () => {
      const cert = engine.runFullProtocol({
        millName: "Central Azucarero Portuguesa",
      });

      expect(engine.verifyCertificateIntegrity(cert)).toBe(true);

      // Alterar datos para simular falsificación
      const tamperedCert = JSON.parse(JSON.stringify(cert));
      tamperedCert.stage4WanResilience.dataLossCount = 15; // Inyectar pérdida oculta

      const isValidAfterTamper = engine.verifyCertificateIntegrity(tamperedCert);
      expect(isValidAfterTamper).toBe(false);
    });

    it("debe rechazar la emisión formal si alguna de las etapas falla", () => {
      const cert = engine.runFullProtocol({
        simulateFailureInStage2Tag: 18, // Refractómetro Brix descalibrado
      });

      expect(cert.overallStatus).toBe("NO_CONFORME_RECHAZADO");
      expect(cert.stage2Calibration.passed).toBe(false);
    });

    it("debe rechazar la verificación de integridad si la firma HMAC de un firmante fue falsificada", () => {
      const cert = engine.runFullProtocol({
        millName: "Central Azucarero Portuguesa",
      });

      const forgedCert = JSON.parse(JSON.stringify(cert));
      forgedCert.signatories[0].signatureHmac = "deadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef12345678";

      const isValid = engine.verifyCertificateIntegrity(forgedCert);
      expect(isValid).toBe(false);
    });

    it("debe recuperar el certificado por su actNumber tanto como por su certificateId", () => {
      const cert = engine.runFullProtocol({
        millName: "Ingenio Río Guanare",
      });

      const byCertId = engine.getCertificate(cert.certificateId);
      const byActNum = engine.getCertificate(cert.actNumber);

      expect(byCertId).toBeDefined();
      expect(byActNum).toBeDefined();
      expect(byCertId?.certificateId).toBe(byActNum?.certificateId);
    });

    it("debe validar la segregación de protocolos Modbus TCP y OPC UA en los 25 tags", () => {
      const tags = engine.getTags();
      const modbusTags = tags.filter((t) => t.protocol === "Modbus TCP");
      const opcUaTags = tags.filter((t) => t.protocol === "OPC UA");

      expect(modbusTags.length).toBeGreaterThan(0);
      expect(opcUaTags.length).toBeGreaterThan(0);
      expect(modbusTags.length + opcUaTags.length).toBe(25);

      // Todos los tags Modbus deben tener dirección Reg
      for (const t of modbusTags) {
        expect(t.address).toContain("Reg");
      }

      // Todos los tags OPC UA deben tener Namespace ns=2
      for (const t of opcUaTags) {
        expect(t.address).toContain("ns=2;s=");
      }
    });

    it("debe verificar que todos los tags críticos tengan frecuencias de muestreo sub-segundo o <= 5s", () => {
      const tags = engine.getTags();
      for (const t of tags) {
        expect(t.frequencySec).toBeLessThanOrEqual(5.0);
        expect(t.frequencySec).toBeGreaterThanOrEqual(0.1);
      }
    });

    it("debe limpiar los certificados almacenados al invocar resetForTesting", () => {
      const cert = engine.runFullProtocol();
      expect(engine.getCertificate(cert.certificateId)).toBeDefined();

      engine.resetForTesting();
      expect(engine.getCertificate(cert.certificateId)).toBeUndefined();
    });
  });
});
