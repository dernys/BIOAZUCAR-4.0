import { describe, it, expect } from "vitest";
import { SwingingDoorCompressor } from "../services/edge/SwingingDoorCompressor";
import { IndustrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { IndustrialTsdbEngine } from "../services/historian/IndustrialTsdbEngine";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { SugarMillModelCalibrator } from "../services/bioai/SugarMillModelCalibrator";
import { IndustrialDataPoint } from "../types";

describe("Industrial Edge Core & Foundation Suite", () => {
  // --------------------------------------------------------------------------
  // 1. SWINGING DOOR TRELLIS (SDT) COMPRESSION
  // --------------------------------------------------------------------------
  describe("SwingingDoorCompressor", () => {
    it("compresses smooth linear trends with high data reduction ratio", () => {
      const compressor = new SwingingDoorCompressor({
        compDev: 0.5,
        compMinSeconds: 0,
        compMaxSeconds: 3600,
      });

      const now = Date.now();
      let archivedCount = 0;

      // Feed 100 strictly collinear points: y = 2x
      for (let i = 0; i < 100; i++) {
        const archived = compressor.processPoint({
          timestamp: now + i * 1000,
          value: 10 + i * 0.1, // very slow smooth drift
        });
        archivedCount += archived.length;
      }
      archivedCount += compressor.flush().length;

      const stats = compressor.getStats();
      expect(stats.totalInputPoints).toBe(100);
      expect(stats.compressionRatioPercentage).toBeGreaterThan(80); // >80% compression
      expect(archivedCount).toBeLessThanOrEqual(5);
    });

    it("captures sharp process inflection points accurately", () => {
      const compressor = new SwingingDoorCompressor({
        compDev: 0.2,
        compMinSeconds: 0,
        compMaxSeconds: 3600,
      });

      const now = Date.now();
      // Steady state at 65 bar
      compressor.processPoint({ timestamp: now, value: 65.0 });
      compressor.processPoint({ timestamp: now + 1000, value: 65.0 });
      compressor.processPoint({ timestamp: now + 2000, value: 65.0 });

      // Sudden steam pressure drop (perturbation)
      const archivedDrop = compressor.processPoint({ timestamp: now + 3000, value: 58.2 });
      expect(archivedDrop.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 2. INDUSTRIAL DATA QUALITY & ORIGIN GATE
  // --------------------------------------------------------------------------
  describe("IndustrialDataQualityGate", () => {
    const gate = IndustrialDataQualityGate.getInstance();

    const basePoint: IndustrialDataPoint = {
      id: "pt-101",
      tag: "BIO_TANDEM1_TCH",
      equipmentId: "EQ_TANDEM_01",
      areaId: "MOLIENDA",
      value: 480.5,
      unit: "TCH",
      dataType: "FLOAT",
      source: "LIVE_OT",
      protocol: "OPC-UA",
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
      sequence: 1,
      isHistorical: false,
      isSimulated: false,
      engMin: 0,
      engMax: 800,
    };

    it("passes clean real OT data in production mode", () => {
      const result = gate.audit(basePoint, true);
      expect(result.isValid).toBe(true);
      expect(result.origin).toBe("REAL");
      expect(result.score).toBeGreaterThanOrEqual(90);
    });

    it("rejects simulated data when running in strict production mode", () => {
      const simulatedPoint: IndustrialDataPoint = {
        ...basePoint,
        source: "SIMULATION",
        isSimulated: true,
        provenance: "SIMULATED_PROCESS_MODEL",
      };

      const result = gate.audit(simulatedPoint, true);
      expect(result.isValid).toBe(false);
      expect(result.origin).toBe("SIMULATED");
      expect(result.reasons.some((r) => r.includes("RECHAZO_ORIGEN"))).toBe(true);
    });

    it("flags out-of-engineering-range values", () => {
      const outOfRangePoint: IndustrialDataPoint = {
        ...basePoint,
        value: 1250, // exceeds max 800 TCH
      };

      const result = gate.audit(outOfRangePoint, false);
      expect(result.reasons.some((r) => r.includes("FUERA_DE_RANGO_MAX"))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 3. INDUSTRIAL TSDB & LTTB DOWNSAMPLING
  // --------------------------------------------------------------------------
  describe("IndustrialTsdbEngine", () => {
    const tsdb = IndustrialTsdbEngine.getInstance();

    it("downsamples 1,000 points to 50 points while preserving extrema", () => {
      const rawPoints: { x: number; y: number }[] = [];
      const now = Date.now();

      for (let i = 0; i < 1000; i++) {
        let val = Math.sin(i / 20) * 10;
        if (i === 450) val = 99.0; // Peak spike
        if (i === 720) val = -85.0; // Trough spike
        rawPoints.push({ x: now + i * 1000, y: val });
      }

      const downsampled = tsdb.downsampleLttb(rawPoints, 50);
      expect(downsampled.length).toBe(50);
      expect(downsampled[0].x).toBe(rawPoints[0].x);
      expect(downsampled[downsampled.length - 1].x).toBe(rawPoints[rawPoints.length - 1].x);

      // Verify that major peak and trough were preserved
      const hasPeak = downsampled.some((p) => p.y >= 90.0);
      const hasTrough = downsampled.some((p) => p.y <= -80.0);
      expect(hasPeak).toBe(true);
      expect(hasTrough).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. DISK STORE & FORWARD ENGINE
  // --------------------------------------------------------------------------
  describe("DiskStoreAndForwardEngine", () => {
    it("buffers points, prepares batches and confirms on cloud ACK", () => {
      const saf = new DiskStoreAndForwardEngine({ maxMemoryPoints: 1000 });

      const testPt: IndustrialDataPoint = {
        id: "pt-saf-1",
        tag: "STEAM_PRESSURE",
        equipmentId: "BOILER_01",
        areaId: "CALDERAS",
        value: 64.5,
        unit: "bar",
        dataType: "FLOAT",
        source: "LIVE_OT",
        protocol: "MODBUS-TCP",
        quality: "GOOD",
        deviceTimestamp: new Date().toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 101,
        isHistorical: false,
        isSimulated: false,
      };

      saf.setCloudConnectivity(false); // Simulate internet down
      saf.enqueue(testPt);

      expect(saf.getState().bufferedCount).toBeGreaterThanOrEqual(1);

      // Reconnect
      saf.setCloudConnectivity(true);
      const batch = saf.prepareBatch(50);
      expect(batch).not.toBeNull();
      expect(batch?.points.length).toBeGreaterThanOrEqual(1);

      // Acknowledge receipt
      const acknowledged = saf.acknowledgeBatch(batch!.batchId);
      expect(acknowledged).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. SUGAR MILL MODEL CALIBRATOR (HUGOT & ASME PTC 4)
  // --------------------------------------------------------------------------
  describe("SugarMillModelCalibrator", () => {
    const calibrator = new SugarMillModelCalibrator();

    it("calibrates Hugot compound imbibition coefficient to minimize RMSE", () => {
      const syntheticSamples = [
        { tch: 450, caneFiberPercent: 13.0, canePol: 14.5, imbibitionWaterPercentCane: 26.0, observedExtractionPercent: 96.1 },
        { tch: 480, caneFiberPercent: 13.5, canePol: 14.2, imbibitionWaterPercentCane: 28.5, observedExtractionPercent: 96.4 },
        { tch: 510, caneFiberPercent: 14.0, canePol: 13.9, imbibitionWaterPercentCane: 30.0, observedExtractionPercent: 96.7 },
      ];

      const result = calibrator.calibrateHugot(syntheticSamples);
      expect(result.calibratedKw).toBeGreaterThanOrEqual(1.5);
      expect(result.calibratedKw).toBeLessThanOrEqual(3.5);
      expect(result.meanAbsoluteError).toBeLessThan(0.8);
    });
  });
});
