import { describe, it, expect } from "vitest";
import { AlarmEvent, TenantEnterprise } from "../types";
import { INITIAL_TENANTS, INITIAL_ALARMS } from "../services/dbService";

describe("Multi-Tenancy & ISA-18.2 Alarm Lifecycle", () => {
  it("should have valid initial industrial tenant BIOAZUCAR-DEMO with simulation configuration", () => {
    expect(INITIAL_TENANTS.length).toBeGreaterThanOrEqual(1);
    const tenant1 = INITIAL_TENANTS[0];
    expect(tenant1.code).toBe("BIOAZUCAR-DEMO");
    expect(tenant1.nominalTch).toBeGreaterThan(300);
    expect(tenant1.powerCapacityMW).toBeGreaterThan(15);
    expect(tenant1.status).toBe("ACTIVE");
    expect(tenant1.runtimeMode).toBe("SIMULATION");
    expect(tenant1.simulationEnabled).toBe(true);
  });

  it("should correctly identify active vs acknowledged vs cleared alarms", () => {
    const testAlarms: AlarmEvent[] = [
      {
        id: "alm-1",
        code: "ALM-VIB-M3",
        timestamp: "2026-08-28 14:32:10",
        equipmentId: "eq-02",
        equipmentName: "Molino 3",
        area: "Molienda",
        severity: "CRITICA",
        tag: "MILL3_VIB_RMS",
        message: "Vibración excesiva",
        currentValue: 4.8,
        threshold: 4.5,
        unit: "mm/s",
        acknowledged: false,
        shelved: false,
        possibleCause: "Desgaste",
        recommendedAction: "Inspeccionar",
        status: "ACTIVE",
      },
      {
        id: "alm-2",
        code: "ALM-BOILER-O2",
        timestamp: "2026-08-28 14:15:00",
        equipmentId: "eq-05",
        equipmentName: "Caldera Biomasa",
        area: "Vapor",
        severity: "ALTA",
        tag: "BOILER_FLUE_O2",
        message: "Exceso de O2",
        currentValue: 5.4,
        threshold: 4.5,
        unit: "%",
        acknowledged: true,
        acknowledgedBy: "Supervisor (Carlos)",
        acknowledgedAt: "2026-08-28 14:16:00",
        shelved: false,
        possibleCause: "Tiro forzado",
        recommendedAction: "Ajustar dampers",
        status: "ACKNOWLEDGED",
      },
      {
        id: "alm-3",
        code: "ALM-BRIX-SYRUP",
        timestamp: "2026-08-28 13:00:00",
        equipmentId: "eq-04",
        equipmentName: "Evaporador Quíntuple",
        area: "Evaporación",
        severity: "MEDIA",
        tag: "EVAP_SYRUP_BRIX",
        message: "Brix bajo",
        currentValue: 64.0,
        threshold: 65.0,
        unit: "°Bx",
        acknowledged: true,
        shelved: false,
        possibleCause: "Flujo vapor",
        recommendedAction: "Verificar",
        status: "CLEARED",
      },
    ];

    const activeCount = testAlarms.filter(
      (a) => a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED")
    ).length;
    expect(activeCount).toBe(1);

    const criticalCount = testAlarms.filter(
      (a) => (a.severity === "CRITICA" || a.severity === "CRITICAL") && a.status === "ACTIVE"
    ).length;
    expect(criticalCount).toBe(1);
  });
});
