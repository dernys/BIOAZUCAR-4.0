/**
 * BioAzúcar 4.0 — Industrial Structured Logger (IEC 62443 / SIEM Compliant)
 * 
 * Generates JSON-formatted logs optimized for ingestion by Splunk, Elasticsearch,
 * Grafana Loki, and industrial SCADA historians.
 */

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "AUDIT" | "SECURITY";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  tenantId?: string;
  nodeId?: string;
  eventCode?: string;
  message: string;
  metadata?: Record<string, any>;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  serviceName: string;
  tenantId?: string;
  nodeId?: string;
  minLevel?: LogLevel;
  logFilePath?: string;
  outputJson?: boolean;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 10,
  INFO: 20,
  AUDIT: 25,
  SECURITY: 30,
  WARN: 40,
  ERROR: 50,
};

function getNodeModules(): { fs: any; path: any } | null {
  if (typeof window === "undefined" && typeof process !== "undefined" && process.versions?.node) {
    try {
      const nodeRequire =
        typeof (globalThis as any).__non_webpack_require__ !== "undefined"
          ? (globalThis as any).__non_webpack_require__
          : eval("require");
      return {
        fs: nodeRequire("fs"),
        path: nodeRequire("path"),
      };
    } catch {
      return null;
    }
  }
  return null;
}

export class IndustrialLogger {
  private serviceName: string;
  private tenantId: string;
  private nodeId: string;
  private minLevel: LogLevel;
  private logFilePath: string | null = null;
  private outputJson: boolean;

  constructor(config: LoggerConfig) {
    this.serviceName = config.serviceName || "bioazucar-industrial";
    this.tenantId = config.tenantId || process.env?.BIOAZUCAR_TENANT_ID || "TENANT_AZUCAR_01";
    this.nodeId = config.nodeId || process.env?.BIOAZUCAR_EDGE_ID || "node-01";
    this.minLevel = config.minLevel || (process.env?.NODE_ENV === "production" ? "INFO" : "DEBUG");
    this.outputJson = config.outputJson ?? (process.env?.NODE_ENV === "production" || process.env?.BIOAZUCAR_LOG_JSON === "true");

    const envPath = process.env?.BIOAZUCAR_LOG_FILE;
    this.logFilePath = config.logFilePath || envPath || null;
  }

  public debug(message: string, metadata?: Record<string, any>, eventCode?: string): void {
    this.log("DEBUG", message, metadata, eventCode);
  }

  public info(message: string, metadata?: Record<string, any>, eventCode?: string): void {
    this.log("INFO", message, metadata, eventCode);
  }

  public warn(message: string, metadata?: Record<string, any>, eventCode?: string): void {
    this.log("WARN", message, metadata, eventCode);
  }

  public error(message: string, err?: any, metadata?: Record<string, any>, eventCode?: string): void {
    const errorDetails = err
      ? {
          name: err.name || "Error",
          message: err.message || String(err),
          stack: err.stack,
        }
      : undefined;

    this.log("ERROR", message, { ...metadata, ...(err && !err.stack ? { rawError: String(err) } : {}) }, eventCode, errorDetails);
  }

  public formatEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    eventCode?: string
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      tenantId: this.tenantId,
      nodeId: this.nodeId,
      eventCode: eventCode || `${this.serviceName.toUpperCase()}_${level}`,
      message,
      metadata,
    };
    return JSON.stringify(entry);
  }

  public audit(
    actionOrMessage: string,
    actorOrMeta?: string | Record<string, any>,
    result?: "SUCCESS" | "DENIED" | "FAILURE" | "ERROR",
    metadata?: Record<string, any>
  ): void {
    if (typeof actorOrMeta === "string") {
      this.log("AUDIT", `[AUDIT] ${actionOrMessage} by ${actorOrMeta} -> ${result || "SUCCESS"}`, {
        action: actionOrMessage,
        actor: actorOrMeta,
        result: result || "SUCCESS",
        ...metadata,
      }, "AUDIT_EVENT");
    } else {
      this.log("AUDIT", actionOrMessage, actorOrMeta, "AUDIT_EVENT");
    }
  }

  public security(threatType: string, message: string, metadata?: Record<string, any>): void {
    this.log("SECURITY", `[SECURITY ALERT: ${threatType}] ${message}`, {
      threatType,
      ...metadata,
    }, "SECURITY_ALERT");
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    eventCode?: string,
    error?: LogEntry["error"]
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      tenantId: this.tenantId,
      nodeId: this.nodeId,
      eventCode: eventCode || `${this.serviceName.toUpperCase()}_${level}`,
      message,
      metadata,
      error,
    };

    const jsonString = JSON.stringify(entry);

    // Console output
    if (this.outputJson) {
      if (level === "ERROR" || level === "SECURITY") {
        console.error(jsonString);
      } else if (level === "WARN") {
        console.warn(jsonString);
      } else {
        console.log(jsonString);
      }
    } else {
      const colorTag = level === "ERROR" ? "\x1b[31m" : level === "WARN" ? "\x1b[33m" : level === "SECURITY" ? "\x1b[35m" : "\x1b[36m";
      const reset = "\x1b[0m";
      console.log(`${colorTag}[${entry.timestamp}] [${level}] [${this.serviceName}]${reset} ${message}`, metadata ? metadata : "");
    }

    // Node.js persistent file append
    this.appendToFile(jsonString + "\n");
  }

  private appendToFile(line: string): void {
    if (!this.logFilePath) return;

    const mods = getNodeModules();
    if (mods) {
      try {
        const { fs, path } = mods;
        const dir = path.dirname(this.logFilePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.appendFileSync(this.logFilePath, line, { mode: 0o640 });
      } catch {
        // Silently ignore disk logging errors to avoid crashing main loop
      }
    }
  }
}

export const edgeLogger = new IndustrialLogger({
  serviceName: "bioazucar-edge",
  logFilePath: process.env.BIOAZUCAR_LOG_FILE || "./logs/edge-daemon.log",
});

export const cloudLogger = new IndustrialLogger({
  serviceName: "bioazucar-cloud",
  logFilePath: process.env.BIOAZUCAR_CLOUD_LOG_FILE || "./logs/cloud-server.log",
});

export const systemLogger = cloudLogger;
