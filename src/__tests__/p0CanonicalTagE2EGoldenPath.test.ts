/**
 * BIOAZÚCAR 4.0 — Canonical Tag E2E Verification & Golden Path Test Suite (P0-04)
 * 
 * Verifies the complete 15-link Industrial Golden Path defined in
 * BIOAZUCAR_MASTER_DEVELOPMENT.md (Sections 9, 16 & 25):
 * 
 *  [01] PLC_ACQUISITION           - Field instrument raw telemetry
 *  [02] EDGE_RUNTIME_INGESTION    - Edge socket framing & packet timing
 *  [03] CANONICAL_DATAPOINT       - 17-field Canonical IndustrialDataPoint contract
 *  [04] DATA_QUALITY_GATE         - Deterministic quality, range, jitter & governance audit
 *  [05] TAG_REGISTRY_RESOLUTION   - ISA-95 hierarchical path resolution
 *  [06] HISTORIAN_TSDB            - On-premise SQLite WAL persistence & range queries
 *  [07] UNS_SPARKPLUG_ENCODING    - Eclipse Sparkplug B spBv1.0 encoding & sequence
 *  [08] SCADA_SUBSCRIPTION_UPDATE - Live reactive SCADA state dictionary
 *  [09] KPI_ENGINE_EVALUATION     - Thermo-mechanical Hugot calculations
 *  [10] BIOAI_ANOMALY_EVALUATION  - Baseline operating envelope & risk scoring
 *  [11] COPILOT_GROUNDED_QUERY    - Semantic query resolution with ground truth
 *  [12] SECURE_COMMAND_GATEWAY    - Role, 2FA, anti-replay, HMAC-SHA256 signature
 *  [13] OPERATOR_FOUR_EYES        - Dual-operator authorization for critical tags
 *  [14] ACTUATOR_WRITE_AND_ECHO   - Driver write-back + Read-After-Write (echo verification)
 *  [15] IMMUTABLE_SECURITY_AUDIT  - Cryptographically chained append-only audit trail
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CanonicalTagTraceService,
  CanonicalTraceParams,
} from "../services/edge/tracing/CanonicalTagTraceService";
import { SecureCommandGateway } from "../services/edge/commands/SecureCommandGateway";
import { industrialDriverManager } from "../services/edge/drivers/IndustrialDriverManager";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";
import { LocalTimeSeriesDatabase } from "../services/edge/history/LocalTimeSeriesDatabase";

describe("BioAzúcar 4.0 — [P0-04] Canonical Tag E2E Golden Path Verification", () => {
  const CANONICAL_TAG = "IngenioCentral.Molienda.Molino1.PresionHidraulica";
  const SECRET_KEY = "BIOAZUCAR-TEST-HMAC-KEY-P0-04";

  let traceService: CanonicalTagTraceService;
  let commandGateway: SecureCommandGateway;
  let tsdb: LocalTimeSeriesDatabase;

  beforeEach(async () => {
    traceService = CanonicalTagTraceService.getInstance();
    commandGateway = SecureCommandGateway.getInstance();
    commandGateway.setHmacSecret(SECRET_KEY);
    tsdb = LocalTimeSeriesDatabase.getInstance();

    // Ensure driver is registered and connected for write tests
    const driverId = "drv-modbus-tandem";
    if (!industrialDriverManager.getDriver(driverId)) {
      const driver = new ModbusDriverAdapter({
        id: driverId,
        name: "Modbus TCP Tandem Driver",
        protocol: "MODBUS",
        endpoint: "192.168.10.10:502",
        reconnectIntervalMs: 1000,
        maxReconnectAttempts: 3,
        timeoutMs: 2000,
        readOnly: false,
        customParameters: { scale: 1, unit: "bar" },
      });
      await driver.connect();
      industrialDriverManager.registerDriver(driver);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 1: Full 15-Link Golden Path Execution
  // --------------------------------------------------------------------------
  it("executes the full 15-link Golden Path for a canonical milling hydraulic pressure tag with 100% pass rate", async () => {
    const params: CanonicalTraceParams = {
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 210.5,
      unit: "bar",
      deviceId: "DEV-M1-HYDR",
      assetId: "MOLINO-01-MASA-SUPERIOR",
      driverId: "drv-modbus-tandem",
      protocol: "MODBUS-TCP",
      runtimeProfile: "LAB",
      targetWriteValue: 215.0,
      operatorId: "op-carlos-12",
      supervisorId: "sup-alberto-88",
      secretKey: SECRET_KEY,
    };

    const report = await traceService.executeGoldenPathTrace(params);

    expect(report.allLinksPassed).toBe(true);
    expect(report.linksCount).toBe(15);
    expect(report.passedCount).toBe(15);
    expect(report.failedCount).toBe(0);
    expect(report.tagAddress).toBe(CANONICAL_TAG);
    expect(report.initialValue).toBe(210.5);
    expect(report.targetWriteValue).toBe(215.0);
    expect(report.traceId).toMatch(/^TRACE-GP-/);
    expect(report.chainIntegrityChecksum).toHaveLength(64); // SHA-256
  });

  // --------------------------------------------------------------------------
  // TEST 2: Correlation ID & Timestamp Immutability
  // --------------------------------------------------------------------------
  it("preserves traceId immutability across all 15 stages from PLC acquisition to audit trail", async () => {
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 208.0,
      unit: "bar",
      targetWriteValue: 212.0,
      secretKey: SECRET_KEY,
    });

    const rootTraceId = report.traceId;

    // Every link must bear the exact same correlationId
    report.links.forEach((link) => {
      expect(link.correlationId).toBe(rootTraceId);
      expect(link.status).toBe("PASSED");
    });
  });

  // --------------------------------------------------------------------------
  // TEST 3: 17-Field Canonical DataPoint Compliance (Link 03)
  // --------------------------------------------------------------------------
  it("certifies Link 03 creates a strictly compliant 17-attribute IndustrialDataPoint", async () => {
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 215.2,
      unit: "bar",
      secretKey: SECRET_KEY,
    });

    const link3 = report.links.find((l) => l.linkIndex === 3);
    expect(link3).toBeDefined();
    expect(link3!.status).toBe("PASSED");
    expect(link3!.details.fieldCount).toBe(17);
    expect(link3!.details.canonicalSchemaVersion).toBe("4.0.0");
  });

  // --------------------------------------------------------------------------
  // TEST 4: Data Quality Gate & ISA-95 Resolution (Links 04 & 05)
  // --------------------------------------------------------------------------
  it("certifies Link 04 quality score >= 90 and Link 05 ISA-95 hierarchical mapping", async () => {
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 211.0,
      unit: "bar",
      secretKey: SECRET_KEY,
    });

    const link4 = report.links.find((l) => l.linkIndex === 4);
    expect(link4!.status).toBe("PASSED");
    expect((link4!.details.qualityScore as number)).toBeGreaterThanOrEqual(90);
    expect(link4!.details.qualityStatus).toBe("GOOD");

    const link5 = report.links.find((l) => l.linkIndex === 5);
    expect(link5!.status).toBe("PASSED");
    const hierarchy = link5!.details.hierarchy as Record<string, string>;
    expect(hierarchy.enterprise).toBe("BioAzúcar");
    expect(hierarchy.site).toBe("IngenioCentral");
    expect(hierarchy.area).toBe("Molienda");
    expect(hierarchy.equipment).toBe("Molino1");
    expect(hierarchy.tag).toBe("PresionHidraulica");
  });

  // --------------------------------------------------------------------------
  // TEST 5: Historian TSDB & UNS Sparkplug B (Links 06 & 07)
  // --------------------------------------------------------------------------
  it("certifies Link 06 zero-loss TSDB range query and Link 07 Sparkplug B spBv1.0 encoding", async () => {
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 214.8,
      unit: "bar",
      secretKey: SECRET_KEY,
    });

    const link6 = report.links.find((l) => l.linkIndex === 6);
    expect(link6!.status).toBe("PASSED");
    expect(link6!.details.hasExactMatch).toBe(true);

    const link7 = report.links.find((l) => l.linkIndex === 7);
    expect(link7!.status).toBe("PASSED");
    expect(link7!.details.topic).toMatch(/^spBv1\.0\/IngenioCentral\/NDATA\//);
    expect(link7!.details.metricCount).toBe(1);
    expect(link7!.details.seqNumber).toBe(14);
  });

  // --------------------------------------------------------------------------
  // TEST 6: KPI Hugot, BioAI Anomaly & Copilot Grounding (Links 09, 10 & 11)
  // --------------------------------------------------------------------------
  it("certifies Link 09 Hugot extraction, Link 10 BioAI baseline scoring and Link 11 Copilot grounding", async () => {
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 210.0,
      unit: "bar",
      secretKey: SECRET_KEY,
    });

    const link9 = report.links.find((l) => l.linkIndex === 9);
    expect(link9!.status).toBe("PASSED");
    expect((link9!.details.extractionEfficiencyPercent as number)).toBeGreaterThan(95.0);

    const link10 = report.links.find((l) => l.linkIndex === 10);
    expect(link10!.status).toBe("PASSED");
    expect(link10!.details.healthState).toBe("OPTIMAL");
    expect((link10!.details.anomalyScore as number)).toBeLessThan(0.1);

    const link11 = report.links.find((l) => l.linkIndex === 11);
    expect(link11!.status).toBe("PASSED");
    expect(link11!.details.groundedValue).toBe(210.0);
    expect(link11!.details.groundingScore).toBe(1.0);
  });

  // --------------------------------------------------------------------------
  // TEST 7: Actuator Write-Back & Read-After-Write Echo Verification (Link 14)
  // --------------------------------------------------------------------------
  it("certifies Link 14 executes write-back and confirms echo verification within process delta <= 0.05 bar", async () => {
    const targetSet = 218.5;
    const report = await traceService.executeGoldenPathTrace({
      tagAddress: CANONICAL_TAG,
      rawSignalValue: 210.0,
      unit: "bar",
      targetWriteValue: targetSet,
      secretKey: SECRET_KEY,
    });

    const link14 = report.links.find((l) => l.linkIndex === 14);
    expect(link14!.status).toBe("PASSED");
    expect(link14!.details.executionStatus).toBe("EXECUTED");
    expect(link14!.details.echoVerified).toBe(true);
    expect(link14!.details.readBackValue).toBe(targetSet);
  });

  // --------------------------------------------------------------------------
  // TEST 8: Anti-Replay and Four-Eyes Protection at Link 12 & 13
  // --------------------------------------------------------------------------
  it("certifies that command replay attacks are rejected deterministically by SecureCommandGateway", async () => {
    const fixedNonce = `NONCE-REPLAY-TEST-${Date.now()}`;
    const fixedCmdId = `CMD-REPLAY-${Date.now()}`;
    const timestamp = new Date().toISOString();

    const request = {
      commandId: fixedCmdId,
      tag: CANONICAL_TAG,
      targetDriverId: "drv-modbus-tandem",
      value: 215.0,
      requester: {
        userId: "op-carlos-12",
        role: "OPERATOR",
        twoFactorVerified: true,
      },
      reason: "Prueba de seguridad anti-replay para molienda",
      timestamp,
      nonce: fixedNonce,
      fourEyesApproval: {
        approvedByUserId: "sup-alberto-88",
        approverRole: "SUPERVISOR",
        approvedAt: timestamp,
      },
    };

    const signed = commandGateway.signCommand(request, SECRET_KEY);

    // First execution: Must succeed
    const firstResult = await commandGateway.executeSecureWrite(signed);
    expect(firstResult.status).toBe("EXECUTED");

    // Second execution with identical nonce: Must trip anti-replay protection
    const replayResult = await commandGateway.executeSecureWrite(signed);
    expect(replayResult.status).toBe("REJECTED_REPLAY_ATTACK");
    expect(replayResult.success).toBe(false);
  });
});
