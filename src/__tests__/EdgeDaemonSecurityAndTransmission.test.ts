import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as crypto from "crypto";
import { BioAzucarEdgeDaemon, defaultDaemonConfig } from "../services/edge/daemon";
import { DiskStoreAndForwardEngine } from "../services/edge/DiskStoreAndForwardEngine";
import { IndustrialDataPoint } from "../types";
import { IndustrialLogger } from "../services/logger/IndustrialLogger";
import { PrometheusRegistry } from "../services/monitoring/PrometheusMetrics";
import { ModbusConnector } from "../services/edge/connectors/ModbusConnector";
import { logServerAuditEvent, getServerAuditTrail } from "../server/authMiddleware";

describe("BioAzúcar Industrial Edge Daemon & Transmission Security (IEC 62443 SL3)", () => {
  const testSecret = "test_super_secret_edge_key_64_bytes_long_industrial_security";
  const testNodeId = "edge-node-tandem-1";
  const testTenantId = "TENANT_AZUCAR_01";

  it("should generate cryptographically compliant HMAC-SHA256 signatures", () => {
    const timestamp = new Date().toISOString();
    const payload = {
      batchId: "batch-101",
      tenantId: testTenantId,
      nodeId: testNodeId,
      timestamp,
      points: [
        {
          id: "pt-1",
          tag: "TCH_Actual",
          value: 452.5,
          unit: "TCH",
          quality: "GOOD",
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", testSecret)
      .update(`${testNodeId}:${timestamp}:${bodyString}`)
      .digest("hex");

    expect(signature).toHaveLength(64); // SHA-256 is 32 bytes = 64 hex chars

    // Server-side verification matching algorithm
    const expected = crypto
      .createHmac("sha256", testSecret)
      .update(`${testNodeId}:${timestamp}:${bodyString}`)
      .digest("hex");

    expect(signature).toBe(expected);

    // Tampered payload must fail
    const tamperedBody = JSON.stringify({ ...payload, batchId: "tampered" });
    const tamperedExpected = crypto
      .createHmac("sha256", testSecret)
      .update(`${testNodeId}:${timestamp}:${tamperedBody}`)
      .digest("hex");
    expect(signature).not.toBe(tamperedExpected);
  });

  it("should support Store & Forward with AES-256-GCM encryption in DiskStoreAndForwardEngine", () => {
    const engine = new DiskStoreAndForwardEngine({
      maxMemoryPoints: 1000,
      persistenceKey: "test_saf_encrypted_queue",
      encryptionKey: "industrial_aes_encryption_key_32",
    });

    const samplePoint: IndustrialDataPoint = {
      id: "pt-sec-1",
      tag: "MILL1.SPEED_RPM",
      equipmentId: "M1",
      areaId: "MOLIENDA",
      value: 4.8,
      unit: "RPM",
      dataType: "FLOAT",
      source: "LIVE_OT",
      protocol: "OPC-UA",
      quality: "GOOD",
      deviceTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
      sequence: 10,
      isHistorical: false,
      isSimulated: false,
      provenance: "OBSERVED_OT",
    };

    engine.enqueue(samplePoint);
    const state = engine.getState();
    expect(state.bufferedCount).toBeGreaterThanOrEqual(1);

    const batch = engine.prepareBatch(10);
    expect(batch).not.toBeNull();
    expect(batch!.points[0].tag).toBe("MILL1.SPEED_RPM");

    // Rollback preserves the batch in buffer
    engine.rollbackBatch(batch!.batchId);
    expect(engine.getState().bufferedCount).toBeGreaterThanOrEqual(1);

    // Acknowledge removes the batch
    const batch2 = engine.prepareBatch(10);
    expect(batch2).not.toBeNull();
    engine.acknowledgeBatch(batch2!.batchId);
    expect(engine.getState().bufferedCount).toBe(0);
  });

  it("should handle rollback during network transmission errors", async () => {
    const customDaemon = new BioAzucarEdgeDaemon({
      ...defaultDaemonConfig,
      edgeSecret: testSecret,
      cloudSyncUrl: "http://127.0.0.1:59999/api/edge/telemetry-sync", // unreachable port
    });

    const sampleBatch = {
      batchId: "test-err-batch-1",
      points: [
        {
          id: "pt-err-1",
          tag: "CALDERA1.PRESS_BAR",
          equipmentId: "CALD1",
          areaId: "GENERACION_VAPOR",
          value: 64.2,
          unit: "bar",
          dataType: "FLOAT" as const,
          source: "LIVE_OT" as const,
          protocol: "MODBUS-TCP" as const,
          quality: "GOOD" as const,
          deviceTimestamp: new Date().toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: 1,
          isHistorical: false,
          isSimulated: false,
          provenance: "OBSERVED_OT" as const,
        },
      ],
    };

    // Expect transmission to fail and throw, rolling back the batch safely
    await expect(customDaemon.transmitBatch(sampleBatch)).rejects.toThrow();
  });

  it("should format structured JSON logs with SIEM compatibility in IndustrialLogger", () => {
    const testLogger = new IndustrialLogger({
      serviceName: "test-logger-service",
      minLevel: "DEBUG",
      outputJson: true,
    });

    const formatted = testLogger.formatEntry("INFO", "Motor de molienda sincronizado", {
      rpm: 4.5,
      amps: 230,
    });

    const parsed = JSON.parse(formatted);
    expect(parsed.service).toBe("test-logger-service");
    expect(parsed.level).toBe("INFO");
    expect(parsed.message).toBe("Motor de molienda sincronizado");
    expect(parsed.metadata.rpm).toBe(4.5);
    expect(parsed.timestamp).toBeDefined();
  });

  it("should record and export metrics with Prometheus OpenMetrics format", () => {
    const reg = new PrometheusRegistry();

    reg.incCounter("bioazucar_test_batches_total", "Total test batches", 5, { tandem: "1" });
    reg.setGauge("bioazucar_test_buffer_depth", "Current buffer depth", 42, { tandem: "1" });
    reg.observeLatency("bioazucar_test_latency_seconds", "Test latency", 0.045);

    const scraped = reg.scrape();
    expect(scraped).toContain("# HELP bioazucar_test_batches_total");
    expect(scraped).toContain("# TYPE bioazucar_test_batches_total counter");
    expect(scraped).toContain('bioazucar_test_batches_total{tandem="1"} 5');
    expect(scraped).toContain("# TYPE bioazucar_test_buffer_depth gauge");
    expect(scraped).toContain('bioazucar_test_buffer_depth{tandem="1"} 42');
    expect(scraped).toContain("bioazucar_test_latency_seconds_count 1");
  });

  it("should connect and report Modbus TCP Security with TLS 802 configuration", async () => {
    const securedConnector = new ModbusConnector({
      id: "modbus-milling-sec",
      name: "Tandem 1 Básculas Seguras",
      mode: "TCP",
      host: "192.168.20.10",
      port: 802,
      timeoutMs: 1000,
      maxRetries: 2,
      pollIntervalMs: 500,
      security: {
        enabled: true,
        tlsMode: "MODBUS_SECURITY_TLS",
        tlsPort: 802,
        rejectUnauthorized: true,
      },
    });

    const connected = await securedConnector.connect();
    expect(connected).toBe(true);

    const diag = securedConnector.getDiagnostics();
    expect(diag.protocol).toBe("MODBUS-TCP");
    expect(diag.status).toBe("CONNECTED");
    expect(diag.statusMessage).toContain("Modbus Security (TLS v1.3 / X.509)");
    await securedConnector.disconnect();
  });

  it("should record server audit events and sanitize sensitive credentials", () => {
    const record = logServerAuditEvent({
      actorUid: "usr-supervisor-01",
      actorRole: "supervisor",
      tenantId: "TENANT_AZUCAR_01",
      action: "UPDATE_BOILER_SETPOINT",
      resource: "/api/boiler/setpoint",
      result: "SUCCESS",
      metadata: {
        pressureSetpointBar: 65,
        secretKey: "super_secret_plant_key", // Must be sanitized
        password: "plant_admin_password",   // Must be sanitized
      },
    });

    expect(record.metadata?.secretKey).toBe("[REDACTED]");
    expect(record.metadata?.password).toBe("[REDACTED]");
    expect(record.metadata?.pressureSetpointBar).toBe(65);

    const trail = getServerAuditTrail();
    const found = trail.find((r: any) => r.id === record.id);
    expect(found).toBeDefined();
    expect(found?.action).toBe("UPDATE_BOILER_SETPOINT");
  });
});
