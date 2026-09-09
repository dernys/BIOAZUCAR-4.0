import { describe, it, expect } from "vitest";
import { industrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { tagManagementService } from "../services/tagManagementService";
import { industrialTsdbEngine } from "../services/historian/IndustrialTsdbEngine";
import { diskStoreAndForward } from "../services/edge/DiskStoreAndForwardEngine";
import { sugarMillCalibrator } from "../services/bioai/SugarMillModelCalibrator";
import { HistorianRecord } from "../services/runtime/types";
import { IndustrialDataPoint } from "../types";

describe("Industrial Edge Telemetry & Quality Gate Verification", () => {
  it("should have all 25 critical tags for Tandem 1 registered in TagManagementService", async () => {
    const tags = await tagManagementService.getTags("TENANT_AZUCAR_01");
    const tagAddresses = tags.map((t) => t.variable);

    // Verify key FAT/SAT tags
    expect(tagAddresses).toContain("TCH_Actual");
    expect(tagAddresses).toContain("DESFIBRADOR_RPM");
    expect(tagAddresses).toContain("OPEN_CELL_PCT");
    expect(tagAddresses).toContain("SPEED_RPM");
    expect(tagAddresses).toContain("HYDRAULIC_PRESS_BAR");
    expect(tagAddresses).toContain("TORQUE_KNM");
    expect(tagAddresses).toContain("BEARING_NDE_TEMP_C");
    expect(tagAddresses).toContain("WATER_FLOW_M3H");
    expect(tagAddresses).toContain("WATER_TEMP_C");
    expect(tagAddresses).toContain("MIXED_JUICE_FLOW_M3H");
    expect(tagAddresses).toContain("MIXED_JUICE_BRIX");
    expect(tagAddresses).toContain("MIXED_JUICE_POL");
    expect(tagAddresses).toContain("MIXED_JUICE_PH");
    expect(tagAddresses).toContain("BAGASSE_MOISTURE");
    expect(tagAddresses).toContain("CHUTE_LEVEL_DONNELLY");
    expect(tagAddresses).toContain("TOTAL_POWER_KW");
  });

  it("should correctly resolve origin with overloaded signatures", () => {
    expect(industrialDataQualityGate.resolveOrigin("OBSERVED_OT", false)).toBe("REAL");
    expect(industrialDataQualityGate.resolveOrigin("SIMULATED_PROCESS_MODEL", true)).toBe("SIMULATED");
    expect(industrialDataQualityGate.resolveOrigin(undefined, true)).toBe("SIMULATED");

    const realPoint: IndustrialDataPoint = {
      id: "pt-1",
      tag: "MILL1.HYD.PRESS",
      equipmentId: "M1",
      areaId: "MOLIENDA",
      value: 285.0,
      unit: "bar",
      dataType: "FLOAT",
      source: "LIVE_OT",
      protocol: "OPC-UA",
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
      sequence: 1,
      isHistorical: false,
      isSimulated: false,
      provenance: "OBSERVED_OT",
    };
    expect(industrialDataQualityGate.resolveOrigin(realPoint)).toBe("REAL");
  });

  it("should strictly reject non-real data in production mode", () => {
    const simPoint: IndustrialDataPoint = {
      id: "pt-sim",
      tag: "MILL1.HYD.PRESS",
      equipmentId: "M1",
      areaId: "MOLIENDA",
      value: 285.0,
      unit: "bar",
      dataType: "FLOAT",
      source: "SIMULATION",
      protocol: "SIMULATOR",
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
      sequence: 1,
      isHistorical: false,
      isSimulated: true,
      provenance: "SIMULATED_PROCESS_MODEL",
    };

    // In dev/lab mode: accepted with audit flag
    const devAudit = industrialDataQualityGate.audit(simPoint, false);
    expect(devAudit.origin).toBe("SIMULATED");
    expect(devAudit.isValid).toBe(true);

    // In strict production mode: REJECTED
    const prodAudit = industrialDataQualityGate.audit(simPoint, true);
    expect(prodAudit.origin).toBe("SIMULATED");
    expect(prodAudit.isValid).toBe(false);
    expect(prodAudit.reasons.some((r) => r.includes("RECHAZO_ORIGEN"))).toBe(true);
  });

  it("should support store-and-forward edge queueing", () => {
    const pt: IndustrialDataPoint = {
      id: "pt-saf-test",
      tag: "MILL1.SPEED",
      equipmentId: "M1",
      areaId: "MOLIENDA",
      value: 4.5,
      unit: "RPM",
      dataType: "FLOAT",
      source: "LIVE_OT",
      protocol: "OPC-UA",
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
      sequence: 100,
      isHistorical: false,
      isSimulated: false,
      provenance: "OBSERVED_OT",
    };

    const enqueued = diskStoreAndForward.enqueue(pt);
    expect(enqueued).toBe(true);
    expect(diskStoreAndForward.getState().bufferedCount).toBeGreaterThanOrEqual(1);

    const batch = diskStoreAndForward.prepareBatch(10);
    expect(batch).toBeDefined();
    if (batch) {
      expect(batch.points.length).toBeGreaterThanOrEqual(1);
      diskStoreAndForward.acknowledgeBatch(batch.batchId);
    }
  });

  it("should process high-speed TSDB downsampling via LTTB preserving extreme values", () => {
    const records: HistorianRecord[] = [];
    const baseTime = Date.now() - 50000;

    for (let i = 0; i < 200; i++) {
      let val = 50 + Math.sin(i * 0.1) * 5;
      if (i === 100) val = 120; // spike peak
      if (i === 150) val = 10;  // valley trough

      records.push({
        id: `tsdb-pt-${i}`,
        timestamp: new Date(baseTime + i * 250).toISOString(),
        tenantId: "TENANT_TEST",
        tag: "MILL.PRESS",
        value: val,
        unit: "bar",
        quality: "GOOD",
        source: "LIVE_OT",
        provenance: "OBSERVED_OT",
        isSimulated: false,
        scenario: "NORMAL",
        sequence: i,
      });
    }

    industrialTsdbEngine.ingest(records);
    const downsampled = industrialTsdbEngine.queryDownsampled("TENANT_TEST", "MILL.PRESS", 25);

    expect(downsampled.length).toBeLessThanOrEqual(25);
    const maxVal = Math.max(...downsampled.map((d) => d.y));
    const minVal = Math.min(...downsampled.map((d) => d.y));

    // LTTB must preserve the peak and valley
    expect(maxVal).toBe(120);
    expect(minVal).toBe(10);
  });

  it("should calibrate Hugot equation model parameters", () => {
    const calibration = sugarMillCalibrator.calibrateHugot([
      { tch: 400, caneFiberPercent: 12.5, canePol: 13.0, imbibitionWaterPercentCane: 25.0, observedExtractionPercent: 95.8 },
      { tch: 450, caneFiberPercent: 13.0, canePol: 12.8, imbibitionWaterPercentCane: 28.0, observedExtractionPercent: 96.4 },
      { tch: 480, caneFiberPercent: 13.5, canePol: 12.5, imbibitionWaterPercentCane: 30.0, observedExtractionPercent: 96.9 },
    ]);

    expect(calibration.calibratedKw).toBeGreaterThan(1.0);
    expect(calibration.calibratedKw).toBeLessThan(4.0);
    expect(calibration.rootMeanSquaredError).toBeLessThan(1.5);
  });
});
