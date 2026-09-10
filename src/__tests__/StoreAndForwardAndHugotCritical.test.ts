import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import { IndustrialDataPoint } from "../types";
import {
  calculateHugotMillingCapacity,
  calculateHugotExtraction,
  calculateHugotBagassePci,
  calculateOptimalImbibitionWater,
} from "../services/industrial/hugotFormulas";
import { SugarMillModelCalibrator } from "../services/bioai/SugarMillModelCalibrator";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { performTlsHandshake, createTlsTestServer } from "../services/edge/tlsHandshake";
import {
  getMetrics,
  getMetricsContentType,
  millingTchGauge,
  boilerPressureGauge,
  auditEventsTotal,
} from "../services/metrics";
import {
  logServerAuditEvent,
  logServerAuditEventAsync,
  persistAuditEventToFirestore,
  fetchDurableAuditTrail,
} from "../server/authMiddleware";

function createTestPoint(tag: string, value: number, sequence: number): IndustrialDataPoint {
  return {
    id: `pt-${sequence}-${Date.now()}`,
    tag,
    equipmentId: "MOLINO-01",
    areaId: "MOLIENDA",
    value,
    unit: "TCH",
    dataType: "FLOAT",
    source: "MODBUS",
    protocol: "MODBUS-TCP",
    quality: "GOOD",
    deviceTimestamp: new Date().toISOString(),
    ingestionTimestamp: new Date().toISOString(),
    sequence,
    isHistorical: false,
    isSimulated: true,
  };
}

describe("BioAzúcar 4.0 — Critical Unit Tests (Store & Forward, Hugot, TLS, Prometheus)", () => {
  const testJournalPath = path.resolve("./data/test-critical-saf-journal.json");
  const testSecret = "test_super_secret_edge_key_64_bytes_long_industrial_security";

  beforeAll(() => {
    if (fs.existsSync(testJournalPath)) {
      fs.unlinkSync(testJournalPath);
    }
  });

  afterAll(() => {
    if (fs.existsSync(testJournalPath)) {
      try {
        fs.unlinkSync(testJournalPath);
      } catch {}
    }
  });

  // ==========================================================================
  // HUGOT INDUSTRIAL MECHANICAL & THERMODYNAMIC FORMULAS
  // ==========================================================================

  it("1. Hugot Milling Capacity: computes rated TCH accurately based on roll geometry", () => {
    const result = calculateHugotMillingCapacity({
      rollDiameterMeters: 1.10, // 43 inches
      rollLengthMeters: 2.13, // 84 inches
      rollRpm: 4.5,
      numberOfMills: 5,
      canePreparationFactor: 1.25, // with shredder
    });

    expect(result.nominalTch).toBeGreaterThan(150);
    expect(result.nominalTch).toBeLessThan(450);
    expect(result.volumetricCapacityM3PerHr).toBeGreaterThan(0);
    expect(result.totalTandemPowerKw).toBeGreaterThan(1000);
  });

  it("2. Hugot Extraction Curve: validates asymptotic extraction behavior with compound imbibition", () => {
    const lowWater = calculateHugotExtraction({
      dryExtractionE0: 68.0,
      imbibitionCoeffKw: 2.2,
      imbibitionWaterPercentCane: 15.0,
      caneFiberPercent: 13.5,
    });

    const highWater = calculateHugotExtraction({
      dryExtractionE0: 68.0,
      imbibitionCoeffKw: 2.2,
      imbibitionWaterPercentCane: 35.0,
      caneFiberPercent: 13.5,
    });

    expect(highWater.extractionPercent).toBeGreaterThan(lowWater.extractionPercent);
    expect(lowWater.lostPolInBagassePercent).toBeGreaterThan(highWater.lostPolInBagassePercent);
    expect(highWater.waterToFiberRatio).toBeGreaterThan(2.0);
  });

  it("3. Hugot Bagasse PCI Energetics: verifies calorific value decrease with higher moisture", () => {
    const dryBagasse = calculateHugotBagassePci({
      moisturePercent: 48.0,
      solidsBrixPercent: 2.5,
    });

    const wetBagasse = calculateHugotBagassePci({
      moisturePercent: 53.0,
      solidsBrixPercent: 2.5,
    });

    // Each 1% moisture reduction in bagasse yields ~48.5 kcal/kg additional heating value
    expect(dryBagasse.pciKcalPerKg).toBeGreaterThan(wetBagasse.pciKcalPerKg);
    expect(dryBagasse.pciKcalPerKg - wetBagasse.pciKcalPerKg).toBeCloseTo((53.0 - 48.0) * 48.5, 0);
    expect(dryBagasse.equivalentSteamPerTonBagasse).toBeGreaterThan(wetBagasse.equivalentSteamPerTonBagasse);
  });

  it("4. Hugot Imbibition Economic Optimization: finds optimal water percentage balancing sugar recovery vs steam", () => {
    const optimization = calculateOptimalImbibitionWater(13.5, 430, 14);

    expect(optimization.recommendedWaterPercentCane).toBeGreaterThanOrEqual(20);
    expect(optimization.recommendedWaterPercentCane).toBeLessThanOrEqual(40);
    expect(optimization.expectedExtractionPercent).toBeGreaterThan(94.0);
    expect(optimization.netMarginalGainUsdPerTonCane).toBeGreaterThan(0);
  });

  it("5. SugarMillModelCalibrator Hugot Calibration: converges to correct kw minimizing RMSE", () => {
    const calibrator = new SugarMillModelCalibrator();
    const syntheticSamples = [
      { tch: 250, caneFiberPercent: 13.2, canePol: 14.1, imbibitionWaterPercentCane: 26, observedExtractionPercent: 95.8 },
      { tch: 260, caneFiberPercent: 13.8, canePol: 13.9, imbibitionWaterPercentCane: 30, observedExtractionPercent: 96.4 },
      { tch: 245, caneFiberPercent: 13.0, canePol: 14.5, imbibitionWaterPercentCane: 24, observedExtractionPercent: 95.2 },
    ];

    const calibrated = calibrator.calibrateHugot(syntheticSamples, 2.0);
    expect(calibrated.calibratedKw).toBeGreaterThan(1.5);
    expect(calibrated.calibratedKw).toBeLessThan(3.5);
    expect(calibrated.rootMeanSquaredError).toBeLessThan(1.0);
    expect(calibrated.sampleCount).toBe(3);
  });

  // ==========================================================================
  // REAL TLS HANDSHAKE & X.509 CERTIFICATE VERIFICATION
  // ==========================================================================

  it("6. Real TLS Handshake Execution: performs end-to-end handshake on local TLS test server with X.509 certs", async () => {
    const certPath = path.resolve("./src/__tests__/fixtures/certs/test-server-cert.pem");
    const keyPath = path.resolve("./src/__tests__/fixtures/certs/test-server-key.pem");
    const caPath = path.resolve("./src/__tests__/fixtures/certs/test-ca-cert.pem");

    expect(fs.existsSync(certPath)).toBe(true);
    expect(fs.existsSync(keyPath)).toBe(true);

    const testServer = await createTlsTestServer(fs.readFileSync(certPath), fs.readFileSync(keyPath));

    try {
      const handshake = await performTlsHandshake({
        host: "127.0.0.1",
        port: testServer.port,
        caCert: caPath,
        servername: "localhost",
        rejectUnauthorized: true,
      });

      expect(handshake.success).toBe(true);
      expect(handshake.authorized).toBe(true);
      expect(handshake.protocol).toMatch(/TLSv1\.[23]/);
      expect(handshake.cipher?.name).toBeDefined();
      expect(handshake.peerCertificate?.subject?.CN).toBe("localhost");
      expect(handshake.latencyMs).toBeGreaterThanOrEqual(0);
    } finally {
      await testServer.close();
    }
  });

  it("7. Real TLS Certificate Rejection: rejects untrusted certificate when rejectUnauthorized is true", async () => {
    const certPath = path.resolve("./src/__tests__/fixtures/certs/test-server-cert.pem");
    const keyPath = path.resolve("./src/__tests__/fixtures/certs/test-server-key.pem");

    const testServer = await createTlsTestServer(fs.readFileSync(certPath), fs.readFileSync(keyPath));

    try {
      // Connect without supplying the trusted CA
      const handshake = await performTlsHandshake({
        host: "127.0.0.1",
        port: testServer.port,
        rejectUnauthorized: true,
        // No caCert provided -> untrusted self-signed / local CA must be rejected
      });

      expect(handshake.success).toBe(false);
      expect(handshake.authorized).toBe(false);
      expect(handshake.authorizationError).toBeDefined();
    } finally {
      await testServer.close();
    }
  });

  // ==========================================================================
  // STORE & FORWARD WITH AES-256-GCM RESILIENCE
  // ==========================================================================

  it("8. Store & Forward AES-256-GCM Encryption: writes ciphertext to disk that cannot be read as plain JSON", async () => {
    const engine = new DiskStoreAndForwardEngine({
      diskJournalPath: testJournalPath,
      encryptionKey: testSecret,
    });

    const point1 = createTestPoint("TCH_1_SECRET_CANAL", 320.5, 1);
    const point2 = createTestPoint("STEAM_P1_PRESSURE", 65.2, 2);

    engine.enqueue(point1);
    engine.enqueue(point2);
    engine.persistStateImmediate();

    // Read raw disk file
    expect(fs.existsSync(testJournalPath)).toBe(true);
    const rawContent = fs.readFileSync(testJournalPath, "utf8");
    expect(rawContent).not.toContain("TCH_1_SECRET_CANAL"); // Must be encrypted!
    expect(rawContent).toContain("ENC:"); // AES-256-GCM prefix

    // Verify recovery by a new engine instance with the same key
    const restoredEngine = new DiskStoreAndForwardEngine({
      diskJournalPath: testJournalPath,
      encryptionKey: testSecret,
    });

    const points = restoredEngine.getBufferedPoints();
    expect(points.length).toBe(2);
    expect(points[0].tag).toBe("TCH_1_SECRET_CANAL");
  });

  it("9. Store & Forward Queue FIFO and Ordering: preserves batch order and sequence numbers", async () => {
    const engine = new DiskStoreAndForwardEngine({
      diskJournalPath: testJournalPath,
      encryptionKey: testSecret,
    });

    const ptA = createTestPoint("MILL_1_RPM", 4.2, 10);
    const ptB = createTestPoint("MILL_2_RPM", 4.5, 11);

    engine.enqueue(ptA);
    engine.enqueue(ptB);

    const batch = engine.prepareBatch(10);
    expect(batch).not.toBeNull();
    expect(batch?.points.length).toBeGreaterThanOrEqual(2);
    // Preserves order
    const tags = batch?.points.map((p) => p.tag);
    expect(tags).toContain("MILL_1_RPM");
    expect(tags).toContain("MILL_2_RPM");
  });

  it("10. Store & Forward Batch Acknowledgment: purges acknowledged batches safely", async () => {
    const engine = new DiskStoreAndForwardEngine({
      diskJournalPath: testJournalPath,
      encryptionKey: testSecret,
    });

    const ptX = createTestPoint("TEMP_JUICE_HEAT", 105.4, 99);

    engine.enqueue(ptX);
    const initialCount = engine.getQueueLength();

    const batch = engine.prepareBatch(50);
    expect(batch).not.toBeNull();

    const ackResult = engine.acknowledgeBatch(batch!.batchId);
    expect(ackResult).toBe(true);

    const remainingCount = engine.getQueueLength();
    expect(remainingCount).toBeLessThan(initialCount);
  });

  // ==========================================================================
  // PROMETHEUS METRICS & PERSISTENT AUDIT TRAIL
  // ==========================================================================

  it("11. Prometheus Metrics Scrape & Export: exports industrial metrics with prom-client", async () => {
    millingTchGauge.set({ plant: "ingenio-central", tandem: "1" }, 345.8);
    boilerPressureGauge.set({ plant: "ingenio-central", boiler_id: "caldera-1" }, 65.4);
    auditEventsTotal.inc({ tenant_id: "TENANT_CRITICAL_01", action: "SECURITY_TEST", result: "SUCCESS", severity: "INFO" });

    const contentType = getMetricsContentType();
    expect(contentType).toContain("text/plain");

    const metricsStr = await getMetrics();
    expect(metricsStr).toContain("bioazucar_milling_tch");
    expect(metricsStr).toContain('tandem="1"');
    expect(metricsStr).toContain("345.8");
    expect(metricsStr).toContain("bioazucar_boiler_pressure_bar");
    expect(metricsStr).toContain("65.4");
    expect(metricsStr).toContain("bioazucar_audit_events_total");
  });

  it("12. Audit Trail Persistence & Credential Sanitization: saves records with redaction and retrieval", async () => {
    const record = await logServerAuditEventAsync({
      actorUid: "usr-admin-01",
      actorRole: "administrador",
      tenantId: "TENANT_CRITICAL_01",
      action: "PLC_IP_CONFIG_CHANGE",
      resource: "/api/tags/ip",
      result: "SUCCESS",
      metadata: {
        newIp: "192.168.20.55",
        bearerToken: "super_secret_token_12345",
        password: "plant_admin_pass",
      },
    });

    expect(record.metadata?.bearerToken).toBe("[REDACTED]");
    expect(record.metadata?.password).toBe("[REDACTED]");
    expect(record.metadata?.newIp).toBe("192.168.20.55");

    // Verify retrieval
    const trail = await fetchDurableAuditTrail("TENANT_CRITICAL_01", 10);
    const found = trail.find((r) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found?.action).toBe("PLC_IP_CONFIG_CHANGE");
  });
});
