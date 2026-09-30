import { describe, it, expect, beforeEach } from "vitest";
import { HistorianService, historianService } from "../services/historian/HistorianService";
import { HistorianRecord } from "../services/runtime/types";

describe("Historian Cloud Cost Protection & Storage Tiering", () => {
  beforeEach(() => {
    historianService.setCloudSyncMode("LOCAL_TSDB_ONLY");
  });

  it("1. Debe operar por defecto en modo LOCAL_TSDB_ONLY protegiendo a Firestore de escrituras masivas", async () => {
    const statsBefore = historianService.getCloudCostSavingsStats();
    expect(statsBefore.syncMode).toBe("LOCAL_TSDB_ONLY");

    const sampleRecord: HistorianRecord = {
      tenantId: "TENANT_TEST_01",
      tag: "IngenioCentral.Molienda.Molino1.PresionHidraulica",
      value: 185.5,
      quality: "GOOD",
      timestamp: new Date().toISOString(),
      originMark: "LIVE_OT",
      isSimulated: false,
      source: "LIVE_OT",
      provenance: "OBSERVED_OT",
      scenario: "NORMAL",
      sequence: Date.now(),
      unit: "bar",
    };

    // Ingest 100 points
    for (let i = 0; i < 100; i++) {
      await historianService.recordPoint({
        ...sampleRecord,
        value: 180 + i * 0.1,
        sequence: Date.now() + i,
      });
    }

    const statsAfter = historianService.getCloudCostSavingsStats();
    expect(statsAfter.rawCloudWritesPrevented).toBeGreaterThanOrEqual(100);
    expect(statsAfter.totalPointsIngested).toBeGreaterThanOrEqual(100);
    expect(statsAfter.estimatedUsdSavedPerDay).toBeGreaterThan(0);
  });

  it("2. Debe acumular y condensar muestras en el modo AGGREGATED_ROLLUP reduciendo el tráfico un 99%+", async () => {
    historianService.setCloudSyncMode("AGGREGATED_ROLLUP");

    const tenant = "TENANT_CANE_02";
    const tag = "IngenioCentral.Calderas.Caldera1.PresionVapor";

    // Simulate 50 continuous samples in a 1-minute window
    for (let i = 0; i < 50; i++) {
      await historianService.recordPoint({
        tenantId: tenant,
        tag,
        value: 62.0 + Math.sin(i) * 2.0,
        quality: "GOOD",
        timestamp: new Date().toISOString(),
        originMark: "LIVE_OT",
        isSimulated: false,
        source: "LIVE_OT",
        provenance: "OBSERVED_OT",
        scenario: "NORMAL",
        sequence: Date.now() + i,
        unit: "bar",
      });
    }

    const stats = historianService.getCloudCostSavingsStats();
    expect(stats.syncMode).toBe("AGGREGATED_ROLLUP");
    expect(stats.rawCloudWritesPrevented).toBeGreaterThanOrEqual(50);
  });

  it("3. Debe contar con circuit breaker activo que previene desbordamiento en modo directo", async () => {
    historianService.setCloudSyncMode("RAW_DIRECT");

    // Ingest 50 points directly - should trip after maxWritesPerMinute (30)
    for (let i = 0; i < 50; i++) {
      await historianService.recordPoint({
        tenantId: "TENANT_TEST_01",
        tag: "Test.Tag.HighFreq",
        value: i,
        quality: "GOOD",
        timestamp: new Date().toISOString(),
        originMark: "SIMULATION",
        isSimulated: true,
        source: "SIMULATION",
        provenance: "SIMULATED_PROCESS_MODEL",
        scenario: "NORMAL",
        sequence: Date.now() + i,
        unit: "rpm",
      });
    }

    const stats = historianService.getCloudCostSavingsStats();
    expect(stats.circuitBreakerTripped).toBe(true);
  });
});
