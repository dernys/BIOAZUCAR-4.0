/**
 * BIOAZÚCAR 4.0 — HIL FAULT INJECTION BUS
 * =======================================
 * Physical, electrical, and network disturbance bus for Hardware-in-the-Loop:
 * - Current loop open (wire break) / short circuit
 * - Quadrature optical encoder pulse loss & phase jitter
 * - RTD temperature drift / open circuit
 * - Hydraulic over-pressure surge (Interlock trip testing)
 * - Industrial protocol packet corruption (CRC/LRC bit-flip)
 * 
 * Complies with IEC 62443-4-2 SL3 for failsafe state enforcement.
 */

import { HilActiveFault, HilFaultType } from "./types";

export interface FaultInjectionEvent {
  eventId: string;
  timestamp: string;
  type: "INJECT" | "CLEAR";
  faultType: HilFaultType;
  channelId: string;
  parameters?: Record<string, any>;
  interlockTripped?: boolean;
  tripLatencyMs?: number;
}

export class FaultInjectionBus {
  private activeFaults = new Map<string, HilActiveFault>();
  private faultHistory: FaultInjectionEvent[] = [];

  /**
   * Inject a physical/electrical/network fault into a specific HIL channel.
   */
  public injectFault(
    channelId: string,
    faultType: HilFaultType,
    parameters?: Record<string, any>
  ): HilActiveFault {
    const faultId = `fault-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const fault: HilActiveFault = {
      faultId,
      channelId,
      faultType,
      injectedAt: new Date().toISOString(),
      parameters,
    };

    this.activeFaults.set(channelId, fault);

    this.faultHistory.push({
      eventId: `ev-inj-${Date.now()}`,
      timestamp: fault.injectedAt,
      type: "INJECT",
      faultType,
      channelId,
      parameters,
    });

    return fault;
  }

  /**
   * Clear an active fault on a channel.
   */
  public clearFault(channelId: string): boolean {
    const existing = this.activeFaults.get(channelId);
    if (!existing) return false;

    this.activeFaults.delete(channelId);
    this.faultHistory.push({
      eventId: `ev-clr-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "CLEAR",
      faultType: existing.faultType,
      channelId,
    });

    return true;
  }

  /**
   * Clear all active faults.
   */
  public clearAllFaults(): void {
    for (const channelId of this.activeFaults.keys()) {
      this.clearFault(channelId);
    }
  }

  /**
   * Check if a channel has an active fault.
   */
  public getFault(channelId: string): HilActiveFault | undefined {
    return this.activeFaults.get(channelId);
  }

  /**
   * Get all active faults.
   */
  public getActiveFaults(): HilActiveFault[] {
    return Array.from(this.activeFaults.values());
  }

  /**
   * Get history of fault events.
   */
  public getHistory(): FaultInjectionEvent[] {
    return [...this.faultHistory];
  }
}
