import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EdgeHistorian } from "../services/edge/history/EdgeHistorian";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";
import { industrialTsdbEngine } from "../services/historian/IndustrialTsdbEngine";
import { diskStoreAndForward } from "../services/edge/DiskStoreAndForwardEngine";
import { IndustrialDataPoint } from "../types";
import fs from "fs";
import path from "path";

describe("P0 Blocker: Unified Industrial Edge Historian E2E Suite", () => {
  const testDbDir = "./data/test-e2e-historian";
  const testDbPath = path.join(testDbDir, "edge-tsdb-e2e.sqlite");
  let historian: EdgeHistorian;

  beforeEach(() => {
    if (fs.existsSync(testDbDir)) {
      try {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      } catch {}
    }
    fs.mkdirSync(testDbDir, { recursive: true });

    historian = EdgeHistorian.getInstance();
    historian.configureStorage(testDbPath);
    industrialTsdbEngine.clearMemoryCache();
    diskStoreAndForward.clearForTesting();
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    } catch {}
  });

  // 1. Ingestión → SQLite
  it("1. Debe persistir la telemetría canónica directamente en SQLite WAL con campos completos", () => {
    const now = Date.now();
    const point: IndustrialDataPoint = {
      tag: "Boiler1.Drum_Level",
      value: 54.2,
      engValue: 54.2,
      quality: "GOOD",
      deviceTimestamp: new Date(now).toISOString(),
      edgeIngestionTimestamp: new Date(now + 2).toISOString(),
      tenantId: "TENANT_CENTRAL_01",
      engineeringUnit: "%",
      sequence: 1001,
      isSimulated: false,
      origin: "LIVE_OT",
      provenance: "OBSERVED_OT",
    };

    const res = historian.ingest([point]);
    expect(res.accepted).toBe(1);
    expect(res.rejected).toBe(0);

    // Verify row count in SQLite WAL
    expect(historian.getTotalRowCount()).toBeGreaterThanOrEqual(1);

    // Verify exact disk record
    const records = historian.querySeries("Boiler1.Drum_Level", now - 1000, now + 1000, {
      tenantId: "TENANT_CENTRAL_01",
      preferDisk: true,
    });
    expect(records.length).toBe(1);
    expect(records[0].value).toBe(54.2);
    expect(records[0].quality).toBe("GOOD");
    expect(records[0].isSimulated).toBe(false);
  });

  // 2. Recuperación después de restart
  it("2. Debe recuperar todo el historial tras un reinicio de proceso (re-opening SQLite WAL)", () => {
    const t0 = Date.now();
    for (let i = 0; i < 10; i++) {
      historian.ingest([
        {
          tag: "Turbine.Power_MW",
          value: 18.0 + i * 0.5,
          engValue: 18.0 + i * 0.5,
          quality: "GOOD",
          deviceTimestamp: new Date(t0 + i * 1000).toISOString(),
          tenantId: "TENANT_AZUCAR",
          engineeringUnit: "MW",
          sequence: i + 1,
        },
      ]);
    }
    expect(historian.getTotalRowCount()).toBe(10);
    historian.flushWal();

    // Simulate process restart: create a fresh LocalTimeSeriesDatabase instance pointing to the same file
    const restartedDb = LocalTimeSeriesDatabase.getInstance();
    restartedDb.configureSqlite(testDbPath);

    // Query restarted DB directly from disk
    const rowsAfterRestart = restartedDb.queryRaw("Turbine.Power_MW", t0 - 1000, t0 + 20000, {
      tenantId: "TENANT_AZUCAR",
    });
    expect(rowsAfterRestart.length).toBe(10);
    expect(rowsAfterRestart[0].value).toBe(18.0);
    expect(rowsAfterRestart[9].value).toBe(22.5);
  });

  // 3. Recuperación después de power-loss simulation
  it("3. Debe mantener la integridad ACID tras una simulación de corte repentino de energía (simulateSuddenPowerLoss)", () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) {
      historian.ingest([
        {
          tag: "Mill.Hydraulic_Pressure",
          value: 210.0 + i,
          quality: "GOOD",
          deviceTimestamp: new Date(t0 + i * 100).toISOString(),
          tenantId: "TENANT_CENTRAL_01",
          sequence: i,
        },
      ]);
    }

    // Simulate sudden power loss
    historian.simulateSuddenPowerLoss();

    // Verify disk integrity
    const integrity = historian.verifyIntegrity();
    expect(integrity.ok).toBe(true);

    // Data persisted in WAL is intact
    const afterCrash = historian.querySeries("Mill.Hydraulic_Pressure", t0 - 100, t0 + 1000, {
      tenantId: "TENANT_CENTRAL_01",
      preferDisk: true,
    });
    expect(afterCrash.length).toBe(5);
  });

  // 4. Consulta fría desde SQLite
  it("4. Debe responder a consultas frías leyendo directamente de SQLite cuando la RAM está vacía", () => {
    const t0 = Date.now();
    historian.ingest([
      {
        tag: "ColdQuery.Tag",
        value: 99.9,
        quality: "GOOD",
        deviceTimestamp: new Date(t0).toISOString(),
        tenantId: "TENANT_COLD",
      },
    ]);

    // Clear RAM cache completely
    industrialTsdbEngine.clearMemoryCache();

    // Perform cold query
    const coldResults = historian.querySeries("ColdQuery.Tag", t0 - 500, t0 + 500, {
      tenantId: "TENANT_COLD",
      preferDisk: true,
    });
    expect(coldResults.length).toBe(1);
    expect(coldResults[0].value).toBe(99.9);
  });

  // 5. Cache RAM coherente con SQLite
  it("5. Debe mantener la cache de alta velocidad (TSDB / LTTB) coherente con los datos de SQLite", () => {
    const t0 = Date.now();
    for (let i = 0; i < 20; i++) {
      historian.ingest([
        {
          tag: "Coherent.Tag",
          value: 50.0 + Math.sin(i),
          quality: "GOOD",
          deviceTimestamp: new Date(t0 + i * 1000).toISOString(),
          tenantId: "TENANT_COHERENT",
        },
      ]);
    }

    // RAM query
    const ramResults = historian.querySeries("Coherent.Tag", t0 - 500, t0 + 30000, {
      tenantId: "TENANT_COHERENT",
      preferDisk: false,
    });

    // SQLite query
    const diskResults = historian.querySeries("Coherent.Tag", t0 - 500, t0 + 30000, {
      tenantId: "TENANT_COHERENT",
      preferDisk: true,
    });

    expect(ramResults.length).toBe(diskResults.length);
    expect(ramResults.length).toBe(20);
    for (let i = 0; i < ramResults.length; i++) {
      expect(ramResults[i].value).toBe(diskResults[i].value);
      expect(ramResults[i].timestamp).toBe(diskResults[i].timestamp);
    }
  });

  // 6. Tenant isolation
  it("6. Debe garantizar estricto aislamiento multi-tenant en consultas históricas", () => {
    const t0 = Date.now();
    // Tenant A
    historian.ingest([
      {
        tag: "Confidential.Yield",
        value: 88.5,
        quality: "GOOD",
        deviceTimestamp: new Date(t0).toISOString(),
        tenantId: "TENANT_A",
      },
    ]);

    // Tenant B
    historian.ingest([
      {
        tag: "Confidential.Yield",
        value: 94.2,
        quality: "GOOD",
        deviceTimestamp: new Date(t0).toISOString(),
        tenantId: "TENANT_B",
      },
    ]);

    // Query as Tenant A
    const tenantARes = historian.querySeries("Confidential.Yield", t0 - 1000, t0 + 1000, {
      tenantId: "TENANT_A",
      preferDisk: true,
    });
    expect(tenantARes.length).toBe(1);
    expect(tenantARes[0].value).toBe(88.5);

    // Query as Tenant B
    const tenantBRes = historian.querySeries("Confidential.Yield", t0 - 1000, t0 + 1000, {
      tenantId: "TENANT_B",
      preferDisk: true,
    });
    expect(tenantBRes.length).toBe(1);
    expect(tenantBRes[0].value).toBe(94.2);
  });

  // 7. Event-time correcto
  it("7. Debe indexar y ordenar por event-time (sourceTimestamp) incluso con llegada desordenada", () => {
    const t0 = 1700000000000;
    // Arrives out of chronological order
    historian.ingest([
      {
        tag: "OutOfOrder.Tag",
        value: 300,
        quality: "GOOD",
        deviceTimestamp: new Date(t0 + 3000).toISOString(), // t+3s
        tenantId: "GLOBAL",
      },
      {
        tag: "OutOfOrder.Tag",
        value: 100,
        quality: "GOOD",
        deviceTimestamp: new Date(t0 + 1000).toISOString(), // t+1s
        tenantId: "GLOBAL",
      },
      {
        tag: "OutOfOrder.Tag",
        value: 200,
        quality: "GOOD",
        deviceTimestamp: new Date(t0 + 2000).toISOString(), // t+2s
        tenantId: "GLOBAL",
      },
    ]);

    const results = historian.querySeries("OutOfOrder.Tag", t0, t0 + 5000, {
      tenantId: "GLOBAL",
      preferDisk: true,
    });

    expect(results.length).toBe(3);
    // Ordered strictly by event-time
    expect(results[0].value).toBe(100);
    expect(results[1].value).toBe(200);
    expect(results[2].value).toBe(300);
  });

  // 8. No pérdida/duplicación durante Store & Forward
  it("8. Debe coordinar la persistencia local con Store & Forward sin pérdida ni duplicación de puntos", () => {
    const t0 = Date.now();
    const points: IndustrialDataPoint[] = [];
    for (let i = 0; i < 15; i++) {
      points.push({
        tag: "SafCoordination.Tag",
        value: 10 + i,
        quality: "GOOD",
        deviceTimestamp: new Date(t0 + i * 50).toISOString(),
        tenantId: "TENANT_SAF",
        sequence: i + 1,
      });
    }

    const ingestResult = historian.ingest(points);
    expect(ingestResult.accepted).toBe(15);

    // Verify stored in SQLite WAL
    expect(historian.getTotalRowCount()).toBe(15);

    // Verify enqueued in Store & Forward buffer exactly once
    const safState = diskStoreAndForward.getBufferState();
    expect(safState.bufferedCount).toBe(15);

    // Drain from S&F buffer and verify no duplicates or drops
    const batch = diskStoreAndForward.prepareBatch(20);
    expect(batch).not.toBeNull();
    expect(batch!.points.length).toBe(15);
    diskStoreAndForward.acknowledgeBatch(batch!.batchId);
    expect(diskStoreAndForward.getState().bufferedCount).toBe(0);

    // Re-verify that draining S&F does NOT delete historical authority from SQLite WAL
    const stillInWal = historian.querySeries("SafCoordination.Tag", t0 - 100, t0 + 2000, {
      tenantId: "TENANT_SAF",
      preferDisk: true,
    });
    expect(stillInWal.length).toBe(15);
  });
});
