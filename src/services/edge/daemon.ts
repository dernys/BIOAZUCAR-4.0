/**
 * BioAzúcar 4.0 — Standalone Industrial Edge Daemon
 * 
 * Execution entry point for running directly on an Industrial PC (IPC)
 * inside the sugar mill local network (ISA-95 Level 2/3).
 * 
 * Usage:
 *   npx tsx src/services/edge/daemon.ts
 * or via container:
 *   docker run -d --name bioazucar-edge --net=host bioazucar/edge-daemon:latest
 */

import * as crypto from "crypto";
import * as http from "http";
import * as https from "https";
import * as fs from "fs";
import { URL } from "url";
import { industrialEdge } from "./BioAzucarIndustrialEdge";
import { diskStoreAndForward } from "./DiskStoreAndForwardEngine";
import { SwingingDoorCompressor } from "./SwingingDoorCompressor";
import { IndustrialDataPoint } from "../../types";
import { edgeLogger } from "../logger/IndustrialLogger";
import { prometheusMetrics } from "../monitoring/PrometheusMetrics";

export interface EdgeDaemonConfig {
  tenantId: string;
  edgeId: string;
  edgeSecret: string;
  cloudSyncUrl: string;
  cloudSyncIntervalMs: number;
  heartbeatIntervalMs: number;
  batchSize: number;
  healthPort: number;
  otInterface: string;
  dmzInterface: string;
  tlsCaCertPath?: string;
  tlsClientCertPath?: string;
  tlsClientKeyPath?: string;
  rejectUnauthorized: boolean;
}

export const defaultDaemonConfig: EdgeDaemonConfig = {
  tenantId: process.env.BIOAZUCAR_TENANT_ID || "TENANT_AZUCAR_01",
  edgeId: process.env.BIOAZUCAR_EDGE_ID || "edge-node-tandem-1",
  edgeSecret: process.env.BIOAZUCAR_EDGE_SECRET || "bioazucar_industrial_edge_super_secret_key",
  cloudSyncUrl: process.env.BIOAZUCAR_CLOUD_URL || "http://localhost:3000/api/edge/telemetry-sync",
  cloudSyncIntervalMs: parseInt(process.env.BIOAZUCAR_SYNC_INTERVAL_MS || "2000", 10),
  heartbeatIntervalMs: parseInt(process.env.BIOAZUCAR_HEARTBEAT_MS || "10000", 10),
  batchSize: parseInt(process.env.BIOAZUCAR_BATCH_SIZE || "100", 10),
  healthPort: parseInt(process.env.BIOAZUCAR_EDGE_HEALTH_PORT || "9099", 10),
  otInterface: process.env.BIOAZUCAR_OT_IFACE || "eth0", // 192.168.10.x (PLC subnet)
  dmzInterface: process.env.BIOAZUCAR_DMZ_IFACE || "eth1", // 10.0.0.x (Plant LAN with outbound internet)
  tlsCaCertPath: process.env.BIOAZUCAR_TLS_CA_CERT,
  tlsClientCertPath: process.env.BIOAZUCAR_TLS_CLIENT_CERT,
  tlsClientKeyPath: process.env.BIOAZUCAR_TLS_CLIENT_KEY,
  rejectUnauthorized: process.env.BIOAZUCAR_TLS_INSECURE !== "true",
};

export class BioAzucarEdgeDaemon {
  private isRunning = false;
  private syncTimer: any = null;
  private heartbeatTimer: any = null;
  private healthServer: http.Server | null = null;
  private compressor = new SwingingDoorCompressor({ compDev: 0.25, compMinSeconds: 0.5 });
  private unsubscribeEdge: (() => void) | null = null;

  // Diagnostics counters
  private consecutiveErrors = 0;
  private totalTransmittedBatches = 0;
  private totalTransmittedPoints = 0;
  private lastSuccessfulSync = 0;
  private lastErrorReason: string | null = null;
  private startTime = Date.now();

  constructor(private config: EdgeDaemonConfig = defaultDaemonConfig) {}

  public async start(): Promise<void> {
    console.log("=================================================================");
    console.log("   BIOAZÚCAR 4.0 — INDUSTRIAL EDGE DAEMON (IEC 62443 L2/L3)      ");
    console.log("=================================================================");
    console.log(`[DAEMON] Tenant ID:           ${this.config.tenantId}`);
    console.log(`[DAEMON] Edge Node ID:        ${this.config.edgeId}`);
    console.log(`[DAEMON] Cloud Target:        ${this.config.cloudSyncUrl}`);
    console.log(`[DAEMON] Sync Interval:       ${this.config.cloudSyncIntervalMs} ms`);
    console.log(`[DAEMON] OT L2 Interface:     ${this.config.otInterface}`);
    console.log(`[DAEMON] DMZ L3 Interface:    ${this.config.dmzInterface}`);
    console.log(`[DAEMON] Health Watchdog:     http://0.0.0.0:${this.config.healthPort}/health`);
    console.log(`[DAEMON] Transmission Auth:   HMAC-SHA256 (300s Anti-Replay Guard)`);
    console.log("-----------------------------------------------------------------");

    this.isRunning = true;

    // 1. Initialize Industrial Edge Engine & physical connectors
    await industrialEdge.start();
    console.log("[DAEMON] Industrial Edge Engine and field connectors initialized.");

    // 2. Route all incoming OT data points into Store & Forward queue
    this.unsubscribeEdge = industrialEdge.subscribeAll((pointsMap) => {
      const points = Array.from(pointsMap.values());
      if (points.length > 0) {
        diskStoreAndForward.enqueueBatch(points);
      }
    });

    // 3. Start Secure Cloud Telemetry Ingestion Loop
    this.startSyncLoop();

    // 4. Start Local Health Watchdog Server
    this.startHealthServer();

    // 5. Register OS Signal Listeners for Graceful Shutdown
    this.registerSignalHandlers();
  }

  private startSyncLoop(): void {
    this.syncTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const batch = diskStoreAndForward.prepareBatch(this.config.batchSize);
        if (!batch || batch.points.length === 0) return;

        await this.transmitBatch(batch);
      } catch (err: any) {
        this.consecutiveErrors++;
        this.lastErrorReason = err?.message || String(err);
        console.error(`[DAEMON_SYNC_ERR] (${this.consecutiveErrors} cons errors):`, this.lastErrorReason);
      }
    }, this.config.cloudSyncIntervalMs);

    this.heartbeatTimer = setInterval(() => {
      const state = diskStoreAndForward.getState();
      const compStats = this.compressor.getStats();
      const uptimeSec = Math.round((Date.now() - this.startTime) / 1000);
      const linkStatus = this.consecutiveErrors === 0 ? "ONLINE" : `DEGRADED (${this.consecutiveErrors} errors)`;

      console.log(
        `[HEARTBEAT] Uptime: ${uptimeSec}s | Link: ${linkStatus} | Transmitted: ${this.totalTransmittedPoints} pts | Buffered: ${state.bufferedCount} pts | Savings: ${compStats.compressionRatioPercentage}%`
      );
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * Helper to perform HTTP/HTTPS requests with real mTLS (mutual TLS) certificates in Node.js
   */
  private async executeHttpRequest(
    targetUrl: string,
    headers: Record<string, string>,
    body: string
  ): Promise<{ statusCode: number; statusMessage?: string; data: string }> {
    const parsedUrl = new URL(targetUrl);
    const isHttps = parsedUrl.protocol === "https:";

    return new Promise((resolve, reject) => {
      const options: https.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : isHttps ? 443 : 80,
        path: parsedUrl.pathname + parsedUrl.search,
        method: "POST",
        headers: {
          ...headers,
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      if (isHttps) {
        options.rejectUnauthorized = this.config.rejectUnauthorized;

        // mTLS: CA Root Certificate verification
        if (this.config.tlsCaCertPath && fs.existsSync(this.config.tlsCaCertPath)) {
          try {
            options.ca = fs.readFileSync(this.config.tlsCaCertPath);
          } catch (e: any) {
            edgeLogger.warn(`Failed reading TLS CA certificate: ${e.message}`);
          }
        }

        // mTLS: Client Certificate
        if (this.config.tlsClientCertPath && fs.existsSync(this.config.tlsClientCertPath)) {
          try {
            options.cert = fs.readFileSync(this.config.tlsClientCertPath);
          } catch (e: any) {
            edgeLogger.warn(`Failed reading TLS Client certificate: ${e.message}`);
          }
        }

        // mTLS: Client Private Key
        if (this.config.tlsClientKeyPath && fs.existsSync(this.config.tlsClientKeyPath)) {
          try {
            options.key = fs.readFileSync(this.config.tlsClientKeyPath);
          } catch (e: any) {
            edgeLogger.warn(`Failed reading TLS Client key: ${e.message}`);
          }
        }
      }

      const client = isHttps ? https : http;
      const req = client.request(options, (res) => {
        let responseData = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 500,
            statusMessage: res.statusMessage,
            data: responseData,
          });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.on("timeout", () => {
        req.destroy(new Error(`Timeout connecting to ${targetUrl} (10s)`));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Transmits a batch using HMAC-SHA256 cryptographic signing and real mTLS/HTTPS
   */
  public async transmitBatch(batch: { batchId: string; points: IndustrialDataPoint[] }): Promise<boolean> {
    const timestampIso = new Date().toISOString();
    const payload = {
      batchId: batch.batchId,
      tenantId: this.config.tenantId,
      nodeId: this.config.edgeId,
      timestamp: timestampIso,
      points: batch.points,
    };
    const bodyString = JSON.stringify(payload);

    // Cryptographic signature matching server.ts verification:
    // crypto.createHmac("sha256", edgeSecret).update(`${edgeNodeId}:${edgeTimestamp}:${body}`).digest("hex")
    const signature = crypto
      .createHmac("sha256", this.config.edgeSecret)
      .update(`${this.config.edgeId}:${timestampIso}:${bodyString}`)
      .digest("hex");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-bioazucar-node-id": this.config.edgeId,
      "x-bioazucar-edge-timestamp": timestampIso,
      "x-bioazucar-edge-signature": signature,
      "x-bioazucar-tenant-id": this.config.tenantId,
    };

    const startTime = Date.now();
    try {
      const response = await this.executeHttpRequest(this.config.cloudSyncUrl, headers, bodyString);
      const latencySeconds = (Date.now() - startTime) / 1000;

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error(`HTTP ${response.statusCode} ${response.statusMessage || "Error"}: ${response.data}`);
      }

      const resData = JSON.parse(response.data || "{}") as { success?: boolean };
      if (resData.success) {
        diskStoreAndForward.acknowledgeBatch(batch.batchId);
        this.totalTransmittedBatches++;
        this.totalTransmittedPoints += batch.points.length;
        this.lastSuccessfulSync = Date.now();
        this.consecutiveErrors = 0;
        this.lastErrorReason = null;

        // Prometheus telemetry metrics
        prometheusMetrics.incCounter("bioazucar_edge_transmitted_points_total", "Puntos de telemetría transmitidos", batch.points.length, {
          node_id: this.config.edgeId,
          tenant_id: this.config.tenantId,
        });
        prometheusMetrics.incCounter("bioazucar_edge_transmitted_batches_total", "Lotes de telemetría transmitidos", 1, {
          node_id: this.config.edgeId,
          tenant_id: this.config.tenantId,
        });
        prometheusMetrics.observeLatency("bioazucar_edge_sync_latency", "Latencia de sincronización con nube", latencySeconds);
        prometheusMetrics.setGauge("bioazucar_edge_buffer_points", "Puntos en cola Store and Forward", diskStoreAndForward.getState().bufferedCount, {
          node_id: this.config.edgeId,
          tenant_id: this.config.tenantId,
        });

        edgeLogger.debug(`Batch ${batch.batchId} acknowledged (${batch.points.length} pts, ${latencySeconds.toFixed(3)}s)`);
        return true;
      } else {
        throw new Error("Cloud rejected batch acknowledgment without success flag");
      }
    } catch (sendErr: any) {
      // On network failure or HTTP 5xx, safely roll back the batch into the buffer
      diskStoreAndForward.rollbackBatch(batch.batchId);
      prometheusMetrics.incCounter("bioazucar_edge_sync_errors_total", "Errores de sincronización con nube", 1, {
        node_id: this.config.edgeId,
        tenant_id: this.config.tenantId,
      });
      edgeLogger.warn(`Transmission failed for batch ${batch.batchId}: ${sendErr.message}`);
      throw sendErr;
    }
  }

  /**
   * Local IPC Health & Metrics HTTP Watchdog (systemd, Prometheus, K8s)
   */
  private startHealthServer(): void {
    try {
      this.healthServer = http.createServer((req, res) => {
        if (req.url === "/health" || req.url === "/") {
          const isHealthy = this.isRunning && this.consecutiveErrors < 5;
          const statusPayload = {
            status: isHealthy ? "HEALTHY" : "DEGRADED",
            edgeId: this.config.edgeId,
            tenantId: this.config.tenantId,
            uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
            consecutiveErrors: this.consecutiveErrors,
            totalTransmittedPoints: this.totalTransmittedPoints,
            totalTransmittedBatches: this.totalTransmittedBatches,
            lastSuccessfulSync: this.lastSuccessfulSync ? new Date(this.lastSuccessfulSync).toISOString() : null,
            lastErrorReason: this.lastErrorReason,
            bufferState: diskStoreAndForward.getState(),
            securityStandard: "IEC-62443-4-2 SL3",
            mtlsConfigured: Boolean(this.config.tlsClientCertPath && this.config.tlsClientKeyPath),
          };

          res.writeHead(isHealthy ? 200 : 503, { "Content-Type": "application/json" });
          res.end(JSON.stringify(statusPayload, null, 2));
        } else if (req.url === "/metrics") {
          // OpenMetrics / Prometheus scrape endpoint
          const metricsData = prometheusMetrics.scrape();
          res.writeHead(200, { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" });
          res.end(metricsData);
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.healthServer.listen(this.config.healthPort, "0.0.0.0", () => {
        edgeLogger.info(`Local Health & Metrics Watchdog listening on port ${this.config.healthPort}`);
      });
    } catch (srvErr: any) {
      edgeLogger.warn(`Could not start health HTTP server: ${srvErr.message}`);
    }
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      consecutiveErrors: this.consecutiveErrors,
      totalTransmittedBatches: this.totalTransmittedBatches,
      totalTransmittedPoints: this.totalTransmittedPoints,
      lastSuccessfulSync: this.lastSuccessfulSync,
      lastErrorReason: this.lastErrorReason,
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      bufferState: diskStoreAndForward.getState(),
    };
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.unsubscribeEdge) this.unsubscribeEdge();

    if (this.healthServer) {
      try {
        this.healthServer.close();
      } catch {}
    }

    await industrialEdge.stop();
  }

  private registerSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n[DAEMON] Received ${signal}. Gracefully stopping Edge services...`);
      await this.stop();
      console.log("[DAEMON] Clean shutdown complete. Watchdog notified. Exiting.");
      process.exit(0);
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  }
}

// Auto-run if executed directly as script
if (typeof require !== "undefined" && require.main === module) {
  const daemon = new BioAzucarEdgeDaemon();
  daemon.start().catch((err) => {
    console.error("[DAEMON_FATAL]", err);
    process.exit(1);
  });
}
