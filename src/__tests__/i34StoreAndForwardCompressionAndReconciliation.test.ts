/**
 * BioAzúcar 4.0 — Iteration I34: Store & Forward Compression & Process Reconciliation Test Suite
 * ==============================================================================================
 * Spec Reference: developer_roadmap.md (Section 2.2, Section 4, Section 9, P1-01 & P1-02)
 * 
 * Verifies:
 * 1. [P1-01] Multi-algorithm High-Density Compression (Brotli, Gzip, Deflate, Raw).
 * 2. [P1-01] Deterministic CRC-32 and SHA-256 tamper-evident integrity checking.
 * 3. [P1-01] Integration into DiskStoreAndForwardEngine with SQLite WAL.
 * 4. [P1-01] Cold power-loss recovery with transparent decompression.
 * 5. [P1-02] Floor physical safety override arbitration (ISA-84 / IEC 61511).
 * 6. [P1-02] Monotonic sequence ordering and gap detection.
 * 7. [P1-02] Clock skew and drift analysis (>5000ms degraded to UNCERTAIN).
 * 8. [P1-02] Historical backfill routing without SCADA live cache overwrite.
 * 9. [P1-02] Semantic ISA-95 equipment state transition to RUNNING_RECONCILED.
 * 10. [P1-02] Cryptographic tamper-seal verification with SHA-256.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  StoreAndForwardCompressor,
  CompressionAlgorithm,
} from "../services/edge/storeAndForward/StoreAndForwardCompressor";
import {
  SemanticProcessConflictReconciler,
  ReconciliationReport,
} from "../services/semantic/SemanticProcessConflictReconciler";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { IndustrialDataPoint } from "../types/industrialDataPoint";
import fs from "fs";
import path from "path";

describe("Iteration I34: Store & Forward Compression & Process Reconciliation [P1-01 / P1-02]", () => {
  const TEST_DB_PATH = "./data/test-saf-compression.sqlite";
  const TEST_JOURNAL_PATH = "./data/test-saf-compression-journal.json";

  const createSamplePoint = (overrides: Partial<IndustrialDataPoint> = {}): IndustrialDataPoint => ({
    runtimeMode: "PRODUCTION",
    sourceType: "PLC",
    sourceId: "PLC-MOLINO-01",
    driverId: "drv-modbus-01",
    protocol: "MODBUS_TCP",
    deviceId: "DEV-TANDEM-M1",
    assetId: "MOLINO-01-MASA-SUPERIOR",
    tagId: "BioAzucar.Molienda.Molino1.PresionHidraulica",
    value: 210.5,
    engineeringUnit: "bar",
    dataType: "FLOAT32",
    deviceTimestamp: new Date().toISOString(),
    ingestionTimestamp: new Date().toISOString(),
    sequence: 1001,
    quality: "GOOD",
    qualityReason: "NORMAL",
    calibrationState: "CALIBRATED",
    schemaVersion: "4.0.0",
    ...overrides,
  });

  const cleanupTestFiles = () => {
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(`${TEST_DB_PATH}-wal`)) fs.unlinkSync(`${TEST_DB_PATH}-wal`);
      if (fs.existsSync(`${TEST_DB_PATH}-shm`)) fs.unlinkSync(`${TEST_DB_PATH}-shm`);
      if (fs.existsSync(TEST_JOURNAL_PATH)) fs.unlinkSync(TEST_JOURNAL_PATH);
    } catch {
      // Ignored
    }
  };

  beforeEach(() => {
    cleanupTestFiles();
    StoreAndForwardCompressor.resetInstance();
    SemanticProcessConflictReconciler.resetInstance();
  });

  afterEach(() => {
    cleanupTestFiles();
  });

  // =========================================================================
  // [P1-01] STORE & FORWARD COMPRESSION ENGINE TESTS
  // =========================================================================

  describe("[P1-01] Store & Forward High-Density Compression", () => {
    it("1. Debe comprimir y descomprimir una cadena con Brotli y verificar integridad CRC-32", () => {
      const compressor = StoreAndForwardCompressor.getInstance();
      const input = JSON.stringify({
        tag: "BioAzucar.Molienda.Molino1.PresionHidraulica",
        value: 210.5,
        unit: "bar",
        timestamp: "2026-09-24T16:00:00.000Z",
        repetitions: "telemetry_telemetry_telemetry_telemetry_telemetry_telemetry",
      });

      const envelope = compressor.compressString(input, { algorithm: "BROTLI" });
      expect(envelope.isCompressed).toBe(true);
      expect(envelope.algorithm).toBe("BROTLI");
      expect(envelope.compressedSizeBytes).toBeLessThan(envelope.originalSizeBytes);
      expect(envelope.compressionRatioPct).toBeGreaterThan(30);

      const decompressed = compressor.decompressString(envelope.encodedPayload);
      expect(decompressed).toBe(input);
    });

    it("2. Debe comprimir y descomprimir con GZIP y DEFLATE", () => {
      const compressor = StoreAndForwardCompressor.getInstance();
      const input = JSON.stringify({
        plant: "Central Jesus Menendez",
        boiler: "CALDERA-01",
        pressureBar: 45.2,
        steamFlowTh: 120.5,
        buffer: "ABCD".repeat(40),
      });

      // GZIP
      const gzipEnv = compressor.compressString(input, { algorithm: "GZIP" });
      expect(gzipEnv.isCompressed).toBe(true);
      expect(gzipEnv.algorithm).toBe("GZIP");
      expect(compressor.decompressString(gzipEnv.encodedPayload)).toBe(input);

      // DEFLATE
      const deflateEnv = compressor.compressString(input, { algorithm: "DEFLATE" });
      expect(deflateEnv.isCompressed).toBe(true);
      expect(deflateEnv.algorithm).toBe("DEFLATE");
      expect(compressor.decompressString(deflateEnv.encodedPayload)).toBe(input);
    });

    it("3. Debe detectar corrupción de datos mediante CRC-32 y rechazar payload alterado", () => {
      const compressor = StoreAndForwardCompressor.getInstance();
      const input = "Muestras de Telemetría Industrial de Molienda Tándem 1";
      const env = compressor.compressString(input, { algorithm: "BROTLI" });

      // Corrupt the payload by replacing characters in the base64 segment
      const parts = env.encodedPayload.split(":");
      parts[4] = "CorruptedBase64Payload==";
      const corruptedPayload = parts.join(":");

      expect(() => {
        compressor.decompressString(corruptedPayload);
      }).toThrow();
    });

    it("4. Debe comprimir un lote completo de 50 IndustrialDataPoints con ratio de reducción > 65%", () => {
      const compressor = StoreAndForwardCompressor.getInstance();
      const points: IndustrialDataPoint[] = Array.from({ length: 50 }, (_, i) =>
        createSamplePoint({
          sequence: 1000 + i,
          value: 200 + (i % 10),
          tagId: `BioAzucar.Molienda.Molino1.Sensor_${(i % 5) + 1}`,
        })
      );

      const batchEnvelope = compressor.compressBatch(points, "batch-test-01", { algorithm: "BROTLI" });
      expect(batchEnvelope.count).toBe(50);
      expect(batchEnvelope.isCompressed).toBe(true);
      expect(batchEnvelope.compressionRatioPct).toBeGreaterThan(65);
      expect(batchEnvelope.sha256).toHaveLength(64);

      const decompressedPoints = compressor.decompressBatch(batchEnvelope.encodedPayload);
      expect(decompressedPoints).toHaveLength(50);
      expect(decompressedPoints[0].tagId).toBe(points[0].tagId);
      expect(decompressedPoints[49].sequence).toBe(1049);
    });

    it("5. Debe acumular métricas del motor de compresión y registrar bytes ahorrados", () => {
      const compressor = StoreAndForwardCompressor.getInstance();
      compressor.resetMetrics();

      const pt = createSamplePoint();
      compressor.compressDataPoint(pt);

      const metrics = compressor.getMetrics();
      expect(metrics.totalPointsProcessed).toBeGreaterThan(0);
      expect(metrics.totalOriginalBytes).toBeGreaterThan(0);
      expect(metrics.overallBytesSaved).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // INTEGRACIÓN CON DISK STORE & FORWARD ENGINE
  // =========================================================================

  describe("[P1-01] Integración de Compresión en DiskStoreAndForwardEngine", () => {
    it("6. Debe almacenar puntos comprimidos en SQLite WAL y recuperarlos en frío íntegramente", () => {
      const engine = new DiskStoreAndForwardEngine({
        sqliteDbPath: TEST_DB_PATH,
        diskJournalPath: TEST_JOURNAL_PATH,
        enableCompression: true,
        compressionAlgorithm: "BROTLI",
        verifyIntegrityOnBoot: false,
      });

      expect(engine.isCompressionEnabled()).toBe(true);

      const pt1 = createSamplePoint({ sequence: 101, value: 212.0 });
      const pt2 = createSamplePoint({ sequence: 102, value: 213.5 });
      engine.enqueue(pt1);
      engine.enqueue(pt2);

      // Verify that engine queue length has 2 points
      expect(engine.getQueueLength()).toBe(2);

      // Perform cold power-loss recovery
      const stats = engine.executeColdPowerRecovery();
      expect(stats.integrityOk).toBe(true);
      expect(stats.restoredPoints).toBe(2);

      const buffered = engine.getBufferedPoints();
      expect(buffered).toHaveLength(2);
      expect(buffered[0].value).toBe(212.0);
      expect(buffered[1].value).toBe(213.5);
    });

    it("7. Debe permitir el cambio dinámico de algoritmo de compresión", () => {
      const engine = new DiskStoreAndForwardEngine({
        sqliteDbPath: TEST_DB_PATH,
        diskJournalPath: TEST_JOURNAL_PATH,
        enableCompression: false,
        verifyIntegrityOnBoot: false,
      });

      expect(engine.isCompressionEnabled()).toBe(false);
      engine.setCompression(true, "GZIP");
      expect(engine.isCompressionEnabled()).toBe(true);
      expect(engine.getCompressionAlgorithm()).toBe("GZIP");
    });
  });

  // =========================================================================
  // [P1-02] SEMANTIC INDUSTRIAL PROCESS CONFLICT RECONCILER TESTS
  // =========================================================================

  describe("[P1-02] Semantic Process Conflict Reconciler", () => {
    it("8. Debe arbitrar FLOOR_SAFETY_OVERRIDE dando precedencia absoluta a señales de parada física de planta", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance();

      // Normal live setpoint from central supervisory
      const liveNormal = createSamplePoint({
        tagId: "BioAzucar.Molienda.Molino1.ESTOP_INTERLOCK",
        value: false,
        deviceTimestamp: "2026-09-24T15:00:00.000Z",
      });
      reconciler.setLiveScadaPoint(liveNormal);

      // S&F delayed batch containing local physical safety trip
      const safetyTripPoint = createSamplePoint({
        tagId: "BioAzucar.Molienda.Molino1.ESTOP_INTERLOCK",
        value: true,
        deviceTimestamp: "2026-09-24T15:00:05.000Z",
        qualityReason: "NORMAL",
      });

      const { reconciledPoints, report } = reconciler.reconcileBatch([safetyTripPoint]);

      expect(reconciledPoints).toHaveLength(1);
      expect(report.conflictsResolved.some((c) => c.conflictType === "FLOOR_SAFETY_OVERRIDE")).toBe(true);

      // Live SCADA must be updated to the safety override
      const currentLive = reconciler.getLiveScadaPoint("BioAzucar.Molienda.Molino1.ESTOP_INTERLOCK");
      expect(currentLive?.value).toBe(true);
    });

    it("9. Debe detectar saltos de secuencia monotónica (SEQUENCE_GAP_DETECTED)", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance();

      const pt1 = createSamplePoint({ sequence: 100 });
      const pt2 = createSamplePoint({ sequence: 105 }); // gap of 4 points

      const { report } = reconciler.reconcileBatch([pt1, pt2]);

      expect(report.sequenceGaps).toHaveLength(1);
      expect(report.sequenceGaps[0].expectedSequence).toBe(101);
      expect(report.sequenceGaps[0].receivedSequence).toBe(105);
      expect(report.sequenceGaps[0].missingCount).toBe(4);
    });

    it("10. Debe rutear muestras históricas tardías hacia Historian sin desplazar estado vivo en SCADA", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance();

      // SCADA already received fresh point at T = 12:00:00
      const currentFresh = createSamplePoint({
        tagId: "BioAzucar.Molienda.Molino1.VelocidadMaza",
        value: 4.8,
        deviceTimestamp: "2026-09-24T12:00:00.000Z",
      });
      reconciler.setLiveScadaPoint(currentFresh);

      // S&F batch brings point from T = 11:30:00 (half hour earlier)
      const oldQueuedPoint = createSamplePoint({
        tagId: "BioAzucar.Molienda.Molino1.VelocidadMaza",
        value: 3.9,
        deviceTimestamp: "2026-09-24T11:30:00.000Z",
      });

      const { historianBackfill, report } = reconciler.reconcileBatch([oldQueuedPoint]);

      expect(historianBackfill).toHaveLength(1);
      expect(report.scadaLivePreservedCount).toBe(1);
      expect(report.conflictsResolved.some((c) => c.conflictType === "LATE_HISTORICAL_VS_LIVE_SCADA")).toBe(true);

      // SCADA must remain at 4.8, not overwritten by 3.9
      const scadaLive = reconciler.getLiveScadaPoint("BioAzucar.Molienda.Molino1.VelocidadMaza");
      expect(scadaLive?.value).toBe(4.8);
    });

    it("11. Debe degradar a UNCERTAIN si el reloj del dispositivo supera el umbral de drift de 5000ms", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance({
        maxAllowedClockDriftMs: 5000,
      });

      // Point with timestamp from 30 seconds ago (30,000ms drift)
      const driftedPoint = createSamplePoint({
        tagId: "BioAzucar.Molienda.Molino1.NivelChute",
        deviceTimestamp: new Date(Date.now() - 30000).toISOString(),
        quality: "GOOD",
      });

      const { reconciledPoints, report } = reconciler.reconcileBatch([driftedPoint]);
      expect(reconciledPoints[0].quality).toBe("UNCERTAIN");
      expect(report.clockSkewAnalysis.driftThresholdExceededCount).toBe(1);
      expect(report.conflictsResolved.some((c) => c.conflictType === "CLOCK_DRIFT_SKEW")).toBe(true);
    });

    it("12. Debe reconciliar equipos ISA-95 y transicionarlos a RUNNING_RECONCILED", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance();
      const pt = createSamplePoint({
        deviceId: "DEV-TANDEM-M1",
      });

      const { report } = reconciler.reconcileBatch([pt]);
      const eqConflict = report.conflictsResolved.find(
        (c) => c.conflictType === "SEMANTIC_STATE_TRANSITION"
      );
      expect(eqConflict).toBeDefined();
      expect(eqConflict?.resolvedValue).toBe("RUNNING_RECONCILED");
    });

    it("13. Debe generar un Acta Oficial con Sello Criptográfico SHA-256 inmutable y verificar su firma", () => {
      const reconciler = SemanticProcessConflictReconciler.getInstance();
      const pts = [createSamplePoint({ sequence: 1 }), createSamplePoint({ sequence: 2 })];

      const { report } = reconciler.reconcileBatch(pts, {
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "MOLIENDA",
      });

      expect(report.reportId.startsWith("REC-")).toBe(true);
      expect(report.tamperSealSha256).toHaveLength(64);
      expect(reconciler.verifyReportSeal(report)).toBe(true);

      // Tampering test: altering batchCount must invalidate the seal
      const tamperedReport: ReconciliationReport = {
        ...report,
        batchCount: 9999,
      };
      expect(reconciler.verifyReportSeal(tamperedReport)).toBe(false);
    });
  });
});
