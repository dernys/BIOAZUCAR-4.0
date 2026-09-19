/**
 * BIOAZÚCAR 4.0 — HARDWARE-IN-THE-LOOP (HIL) VALIDATION SYSTEM
 * ============================================================
 * Type definitions, signal specifications, electrical models (NAMUR NE 43),
 * process simulators, and 24-hour test harness contracts.
 * 
 * Standards Compliance:
 * - IEC 62443-4-2 SL3: System integrity, fault tolerance, failsafe states
 * - NAMUR NE 43: Standardization of analog 4-20mA signal ranges and fault diagnostics
 * - ISA-95: Enterprise-Control System Integration
 * - DIN EN 60751: Industrial platinum resistance thermometers (Pt100 RTD)
 */

export type HilSignalType =
  | "ANALOG_4_20MA"
  | "ENCODER_PULSE_KHZ"
  | "RTD_PT100"
  | "DISCRETE_24V";

/**
 * NAMUR NE 43 Signal Classification for 4-20 mA Loops:
 * - < 3.6 mA: Failure / Wire Break (Open circuit)
 * - 3.6 mA to 3.8 mA: Under-range (Measurement valid but below span)
 * - 3.8 mA to 20.5 mA: Normal Operating Range
 * - 20.5 mA to 21.0 mA: Over-range (Measurement valid but above span)
 * - > 21.0 mA: Failure / Sensor Short Circuit
 */
export type NamurNe43State =
  | "WIRE_BREAK"
  | "UNDER_RANGE"
  | "NORMAL"
  | "OVER_RANGE"
  | "SHORT_CIRCUIT";

export type HilFaultType =
  | "WIRE_BREAK"
  | "SENSOR_SHORT"
  | "ENCODER_SLIP"
  | "RTD_DRIFT"
  | "HYDRAULIC_SURGE"
  | "PACKET_CORRUPTION";

export interface HilChannelConfig {
  channelId: string;
  tag: string;
  signalType: HilSignalType;
  description: string;
  engineeringUnit: string;
  rawMin: number;      // e.g. 4.0 mA, 0 Hz, 100.0 Ohm
  rawMax: number;      // e.g. 20.0 mA, 10000 Hz, 175.84 Ohm
  engMin: number;      // e.g. 0.0 bar, 0.0 RPM, 0.0 °C
  engMax: number;      // e.g. 300.0 bar, 12.0 RPM, 200.0 °C
  safetyInterlockLow?: number;
  safetyInterlockHigh?: number;
  pulsesPerRevolution?: number; // For quadrature encoders
}

export interface NamurSignalEvaluation {
  currentMa: number;
  engineeringValue: number;
  state: NamurNe43State;
  isValid: boolean;
  quality: "GOOD" | "BAD" | "UNCERTAIN";
  diagnosticMessage: string;
}

export interface Pt100Evaluation {
  resistanceOhms: number;
  temperatureCelsius: number;
  isValid: boolean;
  quality: "GOOD" | "BAD" | "UNCERTAIN";
  diagnosticMessage: string;
}

export interface EncoderEvaluation {
  frequencyHz: number;
  rpm: number;
  linearSpeedMps: number;
  pulsesCounted: number;
  jitterMs: number;
  isValid: boolean;
}

export interface HilActiveFault {
  faultId: string;
  channelId: string;
  faultType: HilFaultType;
  injectedAt: string;
  parameters?: Record<string, any>;
}

export interface HilProcessState {
  timestamp: string;
  caneFeedRateTch: number;          // 250 - 320 TCH
  caneChuteLevelPct: number;        // 60 - 95 %
  mill1RollRpm: number;             // 3.5 - 6.0 RPM
  mill1HydraulicPressureBar: number;// 200 - 230 bar
  mill1TorqueKnm: number;           // 850 - 1200 kNm
  mill1BearingTempC: number;        // 55 - 75 °C
  imbibitionWaterFlowM3h: number;   // 60 - 85 m3/h
  juiceBrix: number;                // 18.5 - 22.0 °Bx
  juiceExtractionPct: number;       // 95.0 - 97.5 %
  boilerSteamPressureBar: number;   // 60 - 65 bar
  boilerSteamTempC: number;         // 475 - 490 °C
  turbogeneratorPowerMw: number;    // 18.0 - 24.0 MW
  gridFrequencyHz: number;          // 59.95 - 60.05 Hz
}

export interface HilHarnessConfig {
  simulatedSeconds: number;       // 86,400 for 24-hour cycle
  timeStepSeconds: number;        // Process dt (e.g. 1s)
  cyclesPerStep: number;          // Micro-cycles
  driftTolerancePct: number;      // Max allowed drift over 24h (default: 0.1%)
  maxAllowedPacketLoss: number;   // 0
  memoryLeakThresholdMb: number;  // Max heap growth (default: 15 MB)
}

export interface HilChannelDriftMetrics {
  channelId: string;
  tag: string;
  initialValue: number;
  finalValue: number;
  minValue: number;
  maxValue: number;
  meanValue: number;
  standardDeviation: number;
  driftPercentage: number;
  withinTolerance: boolean;
}

export interface Hil24HourHarnessReport {
  executionId: string;
  startedAt: string;
  completedAt: string;
  simulatedProcessHours: number;
  simulatedProcessSeconds: number;
  wallClockDurationMs: number;
  totalDataPointsIngested: number;
  packetsTransmitted: number;
  packetsReceived: number;
  packetsLost: number;
  packetLossRatePct: number;
  driftMetrics: Record<string, HilChannelDriftMetrics>;
  memoryMetrics: {
    initialHeapUsedBytes: number;
    finalHeapUsedBytes: number;
    heapGrowthBytes: number;
    heapGrowthMb: number;
    leakDetected: boolean;
  };
  faultScenariosTested: number;
  safetyInterlocksTripped: number;
  safetyTripsCompliant: boolean;
  iec62443Compliance: boolean;
  chainIntegrityChecksum: string;
  status: "PASSED" | "FAILED";
  summaryNotes: string[];
}
