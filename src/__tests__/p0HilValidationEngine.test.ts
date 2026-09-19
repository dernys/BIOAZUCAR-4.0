/**
 * BIOAZÚCAR 4.0 — P0-07 HARDWARE-IN-THE-LOOP (HIL) VALIDATION SUITE
 * =================================================================
 * Rigorous tests for HIL validation engine:
 * - NAMUR NE 43 4-20mA current loop evaluation & failsafe trips
 * - DIN EN 60751 Pt100 Callendar-Van Dusen RTD conversions
 * - Quadrature optical encoder pulse counters & jitter detection
 * - Sugar mill tandem & cogeneration closed-loop process simulator
 * - Fault injection bus (wire break, short, hydraulic surge, encoder slip)
 * - Industrial Modbus driver loopback integration
 * - 24-Hour accelerated validation harness with zero packet loss, zero memory leaks, and <0.1% drift
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HilValidationEngine,
  Analog420mAConverter,
  Pt100RtdConverter,
  EncoderPulseConverter,
  HilProcessSimulator,
  FaultInjectionBus,
  HilChannelConfig,
} from "../services/edge/hil";
import { ModbusDriverAdapter } from "../services/edge/drivers/ModbusDriverAdapter";

describe("BioAzúcar 4.0 — [P0-07] Hardware-in-the-Loop (HIL) Validation Engine", () => {
  let engine: HilValidationEngine;

  beforeEach(() => {
    engine = HilValidationEngine.getInstance();
    engine.resetTelemetry();
  });

  describe("1. NAMUR NE 43 Analog 4-20mA Signal Conversion & Diagnostics", () => {
    const testChannel: HilChannelConfig = {
      channelId: "TEST_PRES",
      tag: "Ingenio.Molino.Presion",
      signalType: "ANALOG_4_20MA",
      description: "Test Pressure Channel",
      engineeringUnit: "bar",
      rawMin: 4.0,
      rawMax: 20.0,
      engMin: 0.0,
      engMax: 300.0,
      safetyInterlockHigh: 240.0,
    };

    it("evaluates nominal current range (3.8 - 20.5 mA) with GOOD quality and linear scaling", () => {
      // 4.0 mA -> 0 bar
      const eval4mA = Analog420mAConverter.evaluateMa(4.0, testChannel);
      expect(eval4mA.state).toBe("NORMAL");
      expect(eval4mA.quality).toBe("GOOD");
      expect(eval4mA.engineeringValue).toBe(0.0);

      // 12.0 mA -> 150 bar (50% span)
      const eval12mA = Analog420mAConverter.evaluateMa(12.0, testChannel);
      expect(eval12mA.state).toBe("NORMAL");
      expect(eval12mA.quality).toBe("GOOD");
      expect(eval12mA.engineeringValue).toBe(150.0);

      // 20.0 mA -> 300 bar (100% span)
      const eval20mA = Analog420mAConverter.evaluateMa(20.0, testChannel);
      expect(eval20mA.state).toBe("NORMAL");
      expect(eval20mA.quality).toBe("GOOD");
      expect(eval20mA.engineeringValue).toBe(300.0);
    });

    it("detects WIRE_BREAK (< 3.6 mA) according to NAMUR NE 43 standard", () => {
      const evalBreak = Analog420mAConverter.evaluateMa(2.1, testChannel);
      expect(evalBreak.state).toBe("WIRE_BREAK");
      expect(evalBreak.quality).toBe("BAD");
      expect(evalBreak.isValid).toBe(false);
      expect(evalBreak.diagnosticMessage).toContain("wire break");
    });

    it("detects UNDER_RANGE (3.6 - 3.8 mA) and OVER_RANGE (20.5 - 21.0 mA)", () => {
      const evalUnder = Analog420mAConverter.evaluateMa(3.7, testChannel);
      expect(evalUnder.state).toBe("UNDER_RANGE");
      expect(evalUnder.quality).toBe("UNCERTAIN");
      expect(evalUnder.isValid).toBe(true);

      const evalOver = Analog420mAConverter.evaluateMa(20.8, testChannel);
      expect(evalOver.state).toBe("OVER_RANGE");
      expect(evalOver.quality).toBe("UNCERTAIN");
      expect(evalOver.isValid).toBe(true);
    });

    it("detects SHORT_CIRCUIT (> 21.0 mA) according to NAMUR NE 43 standard", () => {
      const evalShort = Analog420mAConverter.evaluateMa(22.8, testChannel);
      expect(evalShort.state).toBe("SHORT_CIRCUIT");
      expect(evalShort.quality).toBe("BAD");
      expect(evalShort.isValid).toBe(false);
      expect(evalShort.diagnosticMessage).toContain("short circuit");
    });

    it("performs bidirectional engineering <-> mA conversion with zero numerical drift", () => {
      const originalEng = 210.5; // bar
      const ma = Analog420mAConverter.engineeringToMa(originalEng, testChannel);
      const evalBack = Analog420mAConverter.evaluateMa(ma, testChannel);

      expect(Math.abs(evalBack.engineeringValue - originalEng)).toBeLessThan(0.05);
    });
  });

  describe("2. DIN EN 60751 Pt100 RTD Callendar-Van Dusen Converter", () => {
    it("converts 0 °C to 100.00 Ohm and 100 °C to ~138.51 Ohm", () => {
      const r0 = Pt100RtdConverter.temperatureToResistance(0);
      expect(r0).toBe(100.0);

      const r100 = Pt100RtdConverter.temperatureToResistance(100);
      expect(r100).toBeCloseTo(138.51, 1);
    });

    it("accurately inverts resistance back to temperature with quadratic solver", () => {
      const targetTempC = 65.4;
      const resistance = Pt100RtdConverter.temperatureToResistance(targetTempC);
      const evalRtd = Pt100RtdConverter.resistanceToTemperature(resistance);

      expect(evalRtd.isValid).toBe(true);
      expect(evalRtd.quality).toBe("GOOD");
      expect(Math.abs(evalRtd.temperatureCelsius - targetTempC)).toBeLessThan(0.05);
    });

    it("identifies broken/disconnected RTD (> 400 Ohm) and short circuit (< 50 Ohm)", () => {
      const openEval = Pt100RtdConverter.resistanceToTemperature(450.0);
      expect(openEval.quality).toBe("BAD");
      expect(openEval.diagnosticMessage).toContain("Disconnected");

      const shortEval = Pt100RtdConverter.resistanceToTemperature(30.0);
      expect(shortEval.quality).toBe("BAD");
      expect(shortEval.diagnosticMessage).toContain("Short Circuit");
    });
  });

  describe("3. Optical Quadrature Encoder Converter", () => {
    it("converts pulse frequency to RPM and linear velocity for 1024 PPR encoder", () => {
      // 1024 PPR at 102.4 Hz = (102.4 * 60) / 1024 = 6.0 RPM
      const evalEncoder = EncoderPulseConverter.frequencyToRpm(102.4, 1024, 1.2);
      expect(evalEncoder.rpm).toBe(6.0);
      expect(evalEncoder.isValid).toBe(true);
      expect(evalEncoder.linearSpeedMps).toBeGreaterThan(0.3);
    });

    it("flags invalidity when encoder phase jitter exceeds 5ms", () => {
      const noisyEncoder = EncoderPulseConverter.frequencyToRpm(100.0, 1024, 1.0, 8.2);
      expect(noisyEncoder.isValid).toBe(false);
    });
  });

  describe("4. Sugar Mill Tandem & Cogeneration Process Simulator", () => {
    let simulator: HilProcessSimulator;

    beforeEach(() => {
      simulator = new HilProcessSimulator();
    });

    it("initializes with realistic industrial operational state", () => {
      const state = simulator.getCurrentState();
      expect(state.caneFeedRateTch).toBe(280.0);
      expect(state.mill1HydraulicPressureBar).toBe(210.0);
      expect(state.juiceExtractionPct).toBeGreaterThan(95.0);
      expect(state.gridFrequencyHz).toBe(60.0);
    });

    it("advances dynamic process states with closed-loop actuator response", () => {
      // Set hydraulic pressure setpoint to 225 bar
      simulator.setHydraulicPressureSetpoint(225.0);

      // Advance by 5 seconds
      for (let i = 0; i < 5; i++) {
        simulator.step(1.0);
      }

      const state = simulator.getCurrentState();
      // Hydraulic pressure should have risen towards 225 bar (tau = 1.2s)
      expect(state.mill1HydraulicPressureBar).toBeGreaterThan(220.0);
      expect(state.mill1TorqueKnm).toBeGreaterThan(900.0);
    });
  });

  describe("5. Fault Injection Bus & Failsafe Interlock Verification", () => {
    let faultBus: FaultInjectionBus;

    beforeEach(() => {
      faultBus = new FaultInjectionBus();
    });

    it("injects and clears physical wire break and hydraulic surge faults", () => {
      const fault = faultBus.injectFault("CH_M1_HYDR", "HYDRAULIC_SURGE", { surgeBar: 260.0 });
      expect(fault.channelId).toBe("CH_M1_HYDR");
      expect(faultBus.getActiveFaults().length).toBe(1);

      const cleared = faultBus.clearFault("CH_M1_HYDR");
      expect(cleared).toBe(true);
      expect(faultBus.getActiveFaults().length).toBe(0);
      expect(faultBus.getHistory().length).toBe(2); // INJECT + CLEAR
    });

    it("trips safety interlock on wire break fault during sample acquisition", () => {
      // Acquire nominal sample first
      const nominalSample = engine.acquireSample("CH_M1_HYDR");
      expect(nominalSample.quality).toBe("GOOD");
      expect(nominalSample.interlockTripped).toBe(false);

      // Inject wire break (< 3.6 mA)
      engine.getFaultBus().injectFault("CH_M1_HYDR", "WIRE_BREAK");
      const faultedSample = engine.acquireSample("CH_M1_HYDR");

      expect(faultedSample.quality).toBe("BAD");
      expect(faultedSample.interlockTripped).toBe(true);
      expect(faultedSample.interlockReason).toContain("TRIP FAILSAFE");

      // Clear fault
      engine.getFaultBus().clearFault("CH_M1_HYDR");
      const recoveredSample = engine.acquireSample("CH_M1_HYDR");
      expect(recoveredSample.quality).toBe("GOOD");
      expect(recoveredSample.interlockTripped).toBe(false);
    });
  });

  describe("6. Industrial Modbus Loopback Integration", () => {
    it("mirrors HIL telemetry to ModbusDriverAdapter registers without errors", async () => {
      const modbusDriver = new ModbusDriverAdapter({
        id: "DRV-MODBUS-HIL",
        name: "HIL Modbus Loopback",
        protocol: "MODBUS",
        endpoint: "127.0.0.1:502",
        timeoutMs: 500,
        readOnly: false,
      });

      await modbusDriver.connect();
      expect(modbusDriver.status).toBe("AUTHENTICATED");

      engine.attachModbusDriver(modbusDriver);

      const sample = engine.acquireSample("CH_M1_HYDR");
      await modbusDriver.writeTag(sample.tag, sample.engineeringValue, 3, "HIL Test Write");

      const readBack: any = await modbusDriver.readTag(sample.tag);
      const readValue = readBack && typeof readBack === "object" && "value" in readBack ? readBack.value : readBack;
      expect(readValue).toBe(sample.engineeringValue);

      await modbusDriver.disconnect();
    });
  });

  describe("7. 24-Hour Continuous Accelerated HIL Validation Harness", () => {
    it("executes 24-hour equivalent validation cycle with zero packet loss, zero leaks, and <0.1% drift", async () => {
      // Run accelerated 24 process hours (1,440 process minutes)
      const report = await engine.run24HourValidationHarness({
        simulatedSeconds: 86400,
        timeStepSeconds: 60,
        driftTolerancePct: 0.1,
        maxAllowedPacketLoss: 0,
        memoryLeakThresholdMb: 20.0,
      });

      // 1. Operational Duration Verification
      expect(report.simulatedProcessHours).toBe(24.0);
      expect(report.simulatedProcessSeconds).toBe(86400);

      // 2. Zero Packet Loss Acceptance Criterion
      expect(report.packetsLost).toBe(0);
      expect(report.packetLossRatePct).toBe(0.0);
      expect(report.packetsReceived).toBe(report.packetsTransmitted);

      // 3. Signal Drift Stability Criterion
      expect(report.driftMetrics["CH_M1_HYDR"]).toBeDefined();
      expect(report.driftMetrics["CH_M1_HYDR"].withinTolerance).toBe(true);
      expect(report.driftMetrics["CH_M1_RPM"].withinTolerance).toBe(true);
      expect(report.driftMetrics["CH_M1_TEMP"].withinTolerance).toBe(true);

      // 4. Zero Memory Leak Criterion
      expect(report.memoryMetrics.leakDetected).toBe(false);
      expect(report.memoryMetrics.heapGrowthMb).toBeLessThan(20.0);

      // 5. Fault Scenarios & Safety Interlock Trips
      expect(report.faultScenariosTested).toBe(3);
      expect(report.safetyInterlocksTripped).toBeGreaterThanOrEqual(3);
      expect(report.safetyTripsCompliant).toBe(true);

      // 6. Overall Status & IEC 62443 SL3 Cryptographic Checksum
      expect(report.status).toBe("PASSED");
      expect(report.iec62443Compliance).toBe(true);
      expect(report.chainIntegrityChecksum).toBeDefined();
      expect(report.chainIntegrityChecksum.length).toBe(64); // 256-bit hex
    }, 15000);
  });
});
