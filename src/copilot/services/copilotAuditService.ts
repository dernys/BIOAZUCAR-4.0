import { CopilotAuditEvent, CopilotMetrics } from "../domain/CopilotTypes";
import { logAuditEventToDb } from "../../services/dbService";
import { UserRole } from "../../types";

export class CopilotAuditService {
  private static instance: CopilotAuditService;
  private sessionEvents: CopilotAuditEvent[] = [];
  private metrics: CopilotMetrics = {
    requestsTotal: 0,
    toolCallsTotal: 0,
    toolErrorsTotal: 0,
    authDeniedTotal: 0,
    confirmationsRequested: 0,
    confirmationsApproved: 0,
    confirmationsRejected: 0,
    avgLatencyMs: 0,
    tokensConsumedTotal: 0,
  };

  private listeners = new Set<(event: CopilotAuditEvent) => void>();

  private constructor() {}

  public static getInstance(): CopilotAuditService {
    if (!CopilotAuditService.instance) {
      CopilotAuditService.instance = new CopilotAuditService();
    }
    return CopilotAuditService.instance;
  }

  public async logEvent(
    event: Omit<CopilotAuditEvent, "id" | "timestamp">,
    userRole: UserRole = "operador"
  ): Promise<CopilotAuditEvent> {
    const fullEvent: CopilotAuditEvent = {
      ...event,
      id: `copilot-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };

    this.sessionEvents.unshift(fullEvent);
    if (this.sessionEvents.length > 200) {
      this.sessionEvents.pop();
    }

    // Update internal metrics
    if (event.resultStatus === "DENIED") {
      this.metrics.authDeniedTotal++;
    } else if (event.resultStatus === "ERROR") {
      this.metrics.toolErrorsTotal++;
    }
    if (event.toolName) {
      this.metrics.toolCallsTotal++;
    }
    if (event.confirmationRequired) {
      this.metrics.confirmationsRequested++;
    }

    // Persist to Cloud Firestore audit collection if write operation or denied
    try {
      if (event.toolName && (event.confirmationRequired || event.resultStatus === "DENIED")) {
        await logAuditEventToDb(
          {
            userRole,
            userName: fullEvent.userName || "Copilot User",
            action: `COPILOT_${event.toolName.toUpperCase()}`,
            module: "BioAzúcar Copilot AI",
            targetId: fullEvent.targetEntity || event.toolName,
            newValue: JSON.stringify(event.arguments || {}),
            status: event.resultStatus === "DENIED" ? "DENIED" : "EXECUTED",
            ipAddress: fullEvent.clientIp || "127.0.0.1",
          },
          fullEvent.tenantId
        );
      }
    } catch (e) {
      console.warn("Could not log Copilot audit to Firestore:", e);
    }

    this.listeners.forEach((l) => l(fullEvent));
    return fullEvent;
  }

  public recordRequest(latencyMs: number): void {
    this.metrics.requestsTotal++;
    this.metrics.avgLatencyMs = Math.round(
      (this.metrics.avgLatencyMs * (this.metrics.requestsTotal - 1) + latencyMs) / this.metrics.requestsTotal
    );
  }

  public recordConfirmationOutcome(approved: boolean): void {
    if (approved) {
      this.metrics.confirmationsApproved++;
    } else {
      this.metrics.confirmationsRejected++;
    }
  }

  public getSessionEvents(): CopilotAuditEvent[] {
    return [...this.sessionEvents];
  }

  public getMetrics(): CopilotMetrics {
    return { ...this.metrics };
  }

  public subscribe(listener: (event: CopilotAuditEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const copilotAuditService = CopilotAuditService.getInstance();
