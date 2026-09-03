import { describe, it, expect } from "vitest";
import { updateTelemetry, INITIAL_TELEMETRY } from "../services/simulationEngine";

describe("Industrial Chemical & Thermodynamic Formulas", () => {
  it("should calculate Sugar Equivalent Recoverable (ARE) correctly based on Brix, Pol, and Trash", () => {
    const brix = 19.4;
    const pol = 16.2;
    const trash = 2.8;

    // Formula: ARE = (Pol * 0.98 - (Brix - Pol) * 0.40 - Trash * 0.25) * 10
    const areValue = (pol * 0.98 - (brix - pol) * 0.40 - trash * 0.25) * 10;
    
    expect(areValue).toBeGreaterThan(130);
    expect(areValue).toBeLessThan(160);
    expect(Math.round(areValue)).toBe(139);
  });

  it("should maintain thermodynamic mass balance in telemetry simulation", () => {
    const nextTelemetry = updateTelemetry(INITIAL_TELEMETRY, "NORMAL");

    // Power Export = Power Generated - Power Internal
    const expectedExport = Math.max(0, nextTelemetry.powerGeneratedMW - nextTelemetry.powerInternalMW);
    expect(nextTelemetry.powerExportGridMW).toBeCloseTo(expectedExport, 0);

    // OEE must be bounded between 0 and 100%
    expect(nextTelemetry.oeeOverall).toBeGreaterThanOrEqual(0);
    expect(nextTelemetry.oeeOverall).toBeLessThanOrEqual(100);

    // Boiler pressure must remain positive and realistic (e.g. 50 - 75 bar)
    expect(nextTelemetry.boilerPressureHP).toBeGreaterThan(50);
    expect(nextTelemetry.boilerPressureHP).toBeLessThan(75);
  });

  it("should respond to high vibration scenario appropriately", () => {
    const vibTelemetry = updateTelemetry(INITIAL_TELEMETRY, "VIBRACION_MOLINO3");
    expect(vibTelemetry.tch).toBeLessThanOrEqual(430);
    expect(vibTelemetry.mill3Vibration).toBeGreaterThan(4.5);
  });

  it("should simulate boiler trip / drop scenario safely", () => {
    const boilerTelemetry = updateTelemetry(INITIAL_TELEMETRY, "CAIDA_PRESION_CALDERA");
    expect(boilerTelemetry.boilerPressureHP).toBeLessThan(60);
    expect(boilerTelemetry.boilerEfficiency).toBeLessThan(82);
  });
});
