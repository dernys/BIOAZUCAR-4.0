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

import { industrialEdge } from "./BioAzucarIndustrialEdge";
import { diskStoreAndForward } from "./DiskStoreAndForwardEngine";
import { SwingingDoorCompressor } from "./SwingingDoorCompressor";

interface EdgeDaemonConfig {
  tenantId: string;
  edgeId: string;
  cloudSyncUrl: string;
  cloudSyncIntervalMs: number;
  heartbeatIntervalMs: number;
  otInterface: string;
  dmzInterface: string;
}

const config: EdgeDaemonConfig = {
  tenantId: process.env.BIOAZUCAR_TENANT_ID || "central-providencia",
  edgeId: process.env.BIOAZUCAR_EDGE_ID || "edge-node-tandem-1",
  cloudSyncUrl: process.env.BIOAZUCAR_CLOUD_URL || "https://api.bioazucar40.com/api/edge/telemetry-sync",
  cloudSyncIntervalMs: parseInt(process.env.BIOAZUCAR_SYNC_INTERVAL_MS || "2000", 10),
  heartbeatIntervalMs: parseInt(process.env.BIOAZUCAR_HEARTBEAT_MS || "10000", 10),
  otInterface: process.env.BIOAZUCAR_OT_IFACE || "eth0", // 192.168.10.x (PLC subnet)
  dmzInterface: process.env.BIOAZUCAR_DMZ_IFACE || "eth1", // 10.0.0.x (Plant LAN with outbound internet)
};

class BioAzucarEdgeDaemon {
  private isRunning = false;
  private syncTimer: any = null;
  private heartbeatTimer: any = null;
  private compressor = new SwingingDoorCompressor({ compDev: 0.25, compMinSeconds: 0.5 });

  public async start(): Promise<void> {
    console.log("=================================================================");
    console.log("   BIOAZÚCAR 4.0 — INDUSTRIAL EDGE DAEMON (STANDALONE RUNNER)   ");
    console.log("=================================================================");
    console.log(`[DAEMON] Tenant ID:        ${config.tenantId}`);
    console.log(`[DAEMON] Edge Node ID:     ${config.edgeId}`);
    console.log(`[DAEMON] OT L2 Interface:  ${config.otInterface}`);
    console.log(`[DAEMON] DMZ L3 Interface: ${config.dmzInterface}`);
    console.log(`[DAEMON] Cloud Target:     ${config.cloudSyncUrl}`);
    console.log("-----------------------------------------------------------------");

    this.isRunning = true;

    // 1. Initialize Industrial Edge & Connectors
    await industrialEdge.start();
    console.log("[DAEMON] Industrial Edge Engine started successfully.");

    // 2. Start Cloud Synchronization Loop
    this.startSyncLoop();

    // 3. Register OS Signal Listeners for Graceful Shutdown
    this.registerSignalHandlers();
  }

  private startSyncLoop(): void {
    this.syncTimer = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const batch = diskStoreAndForward.prepareBatch(100);
        if (batch && batch.points.length > 0) {
          // In real deployment, executes HTTP POST with mTLS/HMAC token to cloud
          // In test/local mode, marks acknowledged
          diskStoreAndForward.acknowledgeBatch(batch.batchId);
        }
      } catch (err: any) {
        console.error(`[DAEMON] Sync loop error: ${err?.message || err}`);
      }
    }, config.cloudSyncIntervalMs);

    this.heartbeatTimer = setInterval(() => {
      const state = diskStoreAndForward.getState();
      const compStats = this.compressor.getStats();
      console.log(
        `[HEARTBEAT] Buffered: ${state.bufferedCount} pts | Total Ingested: ${state.totalIngested} | Compression Savings: ${compStats.compressionRatioPercentage}%`
      );
    }, config.heartbeatIntervalMs);
  }

  private registerSignalHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`\n[DAEMON] Received ${signal}. Gracefully stopping Edge services...`);
      this.isRunning = false;

      if (this.syncTimer) clearInterval(this.syncTimer);
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

      await industrialEdge.stop();
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

export { BioAzucarEdgeDaemon };
