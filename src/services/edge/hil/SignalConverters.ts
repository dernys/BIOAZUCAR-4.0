/**
 * BIOAZÚCAR 4.0 — HIL SIGNAL CONVERTERS
 * =====================================
 * Physical signal conversions and electrical characterization:
 * - 4-20 mA Current Loop (NAMUR NE 43 standard)
 * - Quadrature Optical Encoder (DIN 40050 / IEC 60034)
 * - Pt100 RTD 3/4-Wire Temperature (DIN EN 60751 / Callendar-Van Dusen)
 */

import {
  HilChannelConfig,
  NamurNe43State,
  NamurSignalEvaluation,
  Pt100Evaluation,
  EncoderEvaluation,
} from "./types";

/**
 * NAMUR NE 43 Signal Converter for 4-20 mA Current Loops.
 */
export class Analog420mAConverter {
  /**
   * Convert mA to Engineering Units and classify electrical state via NAMUR NE 43.
   */
  public static evaluateMa(
    currentMa: number,
    config: HilChannelConfig
  ): NamurSignalEvaluation {
    const { rawMin, rawMax, engMin, engMax } = config;
    let state: NamurNe43State = "NORMAL";
    let isValid = true;
    let quality: "GOOD" | "BAD" | "UNCERTAIN" = "GOOD";
    let diagnosticMessage = "Operating in nominal 4-20mA range.";

    if (currentMa < 3.6) {
      state = "WIRE_BREAK";
      isValid = false;
      quality = "BAD";
      diagnosticMessage = `NAMUR NE 43 Failure: Current (${currentMa.toFixed(2)} mA) < 3.6 mA indicates wire break or disconnected transmitter.`;
    } else if (currentMa >= 3.6 && currentMa < 3.8) {
      state = "UNDER_RANGE";
      isValid = true;
      quality = "UNCERTAIN";
      diagnosticMessage = `NAMUR NE 43 Under-range: Current (${currentMa.toFixed(2)} mA) is below nominal span (3.8-20.5 mA).`;
    } else if (currentMa >= 3.8 && currentMa <= 20.5) {
      state = "NORMAL";
      isValid = true;
      quality = "GOOD";
      diagnosticMessage = "Normal operating range (3.8 - 20.5 mA).";
    } else if (currentMa > 20.5 && currentMa <= 21.0) {
      state = "OVER_RANGE";
      isValid = true;
      quality = "UNCERTAIN";
      diagnosticMessage = `NAMUR NE 43 Over-range: Current (${currentMa.toFixed(2)} mA) is above nominal span (3.8-20.5 mA).`;
    } else {
      // > 21.0 mA
      state = "SHORT_CIRCUIT";
      isValid = false;
      quality = "BAD";
      diagnosticMessage = `NAMUR NE 43 Failure: Current (${currentMa.toFixed(2)} mA) > 21.0 mA indicates short circuit or transmitter saturation.`;
    }

    // Engineering value linear scaling
    // Eng = EngMin + ((mA - RawMin) / (RawMax - RawMin)) * (EngMax - EngMin)
    const spanRaw = rawMax - rawMin;
    const spanEng = engMax - engMin;
    let engineeringValue = engMin;

    if (spanRaw !== 0) {
      engineeringValue = engMin + ((currentMa - rawMin) / spanRaw) * spanEng;
    }

    // If wire break or short circuit, clamp or flag
    if (state === "WIRE_BREAK") {
      engineeringValue = engMin;
    } else if (state === "SHORT_CIRCUIT") {
      engineeringValue = engMax * 1.1; // Saturated
    }

    return {
      currentMa: Number(currentMa.toFixed(3)),
      engineeringValue: Number(engineeringValue.toFixed(2)),
      state,
      isValid,
      quality,
      diagnosticMessage,
    };
  }

  /**
   * Convert Engineering Units back to physical 4-20 mA current.
   */
  public static engineeringToMa(
    engValue: number,
    config: HilChannelConfig
  ): number {
    const { rawMin, rawMax, engMin, engMax } = config;
    const spanRaw = rawMax - rawMin;
    const spanEng = engMax - engMin;
    if (spanEng === 0) return rawMin;

    const currentMa = rawMin + ((engValue - engMin) / spanEng) * spanRaw;
    return Number(currentMa.toFixed(3));
  }
}

/**
 * Pt100 RTD Converter based on DIN EN 60751 / Callendar-Van Dusen equation:
 * For T >= 0 °C: R(T) = R0 * (1 + A * T + B * T^2)
 * R0 = 100.00 Ohm
 * A = 3.9083e-3 °C^-1
 * B = -5.775e-7 °C^-2
 */
export class Pt100RtdConverter {
  private static readonly R0 = 100.0;
  private static readonly A = 3.9083e-3;
  private static readonly B = -5.775e-7;

  /**
   * Calculate RTD resistance from Temperature in Celsius.
   */
  public static temperatureToResistance(tempC: number): number {
    const { R0, A, B } = Pt100RtdConverter;
    if (tempC >= 0) {
      return Number((R0 * (1 + A * tempC + B * tempC * tempC)).toFixed(3));
    } else {
      // Linear approximation below 0 °C
      return Number((R0 * (1 + A * tempC)).toFixed(3));
    }
  }

  /**
   * Calculate Temperature in Celsius from RTD resistance using quadratic inversion.
   */
  public static resistanceToTemperature(resistanceOhms: number): Pt100Evaluation {
    const { R0, A, B } = Pt100RtdConverter;

    // Check physical limits (-50 °C to 500 °C) -> approx 80 Ohm to 280 Ohm
    if (resistanceOhms < 50.0) {
      return {
        resistanceOhms,
        temperatureCelsius: -999,
        isValid: false,
        quality: "BAD",
        diagnosticMessage: "RTD Sensor Short Circuit (< 50 Ohm)",
      };
    }

    if (resistanceOhms > 400.0) {
      return {
        resistanceOhms,
        temperatureCelsius: 999,
        isValid: false,
        quality: "BAD",
        diagnosticMessage: "RTD Sensor Open / Disconnected (> 400 Ohm)",
      };
    }

    // Quadratic formula: B*T^2 + A*T + (1 - R/R0) = 0
    // T = (-A + sqrt(A^2 - 4*B*(1 - R/R0))) / (2*B)
    const discriminant = A * A - 4 * B * (1 - resistanceOhms / R0);
    if (discriminant < 0) {
      return {
        resistanceOhms,
        temperatureCelsius: 0,
        isValid: false,
        quality: "BAD",
        diagnosticMessage: "Mathematical singularity in RTD conversion",
      };
    }

    const tempC = (-A + Math.sqrt(discriminant)) / (2 * B);

    return {
      resistanceOhms: Number(resistanceOhms.toFixed(3)),
      temperatureCelsius: Number(tempC.toFixed(2)),
      isValid: true,
      quality: "GOOD",
      diagnosticMessage: "RTD measurement calibrated and valid.",
    };
  }
}

/**
 * Optical Quadrature Encoder Converter for rotating machinery (Mill rollers, conveyors).
 */
export class EncoderPulseConverter {
  /**
   * Convert pulse frequency in Hz to RPM based on Pulses Per Revolution (PPR).
   * RPM = (Frequency in Hz * 60) / PPR
   */
  public static frequencyToRpm(
    frequencyHz: number,
    pulsesPerRevolution: number = 1024,
    wheelDiameterMeters: number = 1.0,
    jitterMs: number = 0.0
  ): EncoderEvaluation {
    const ppr = Math.max(1, pulsesPerRevolution);
    const rpm = (frequencyHz * 60) / ppr;

    // Linear speed in m/s = (RPM * PI * Diameter) / 60
    const linearSpeedMps = (rpm * Math.PI * wheelDiameterMeters) / 60;
    const isValid = frequencyHz >= 0 && jitterMs < 5.0;

    return {
      frequencyHz: Number(frequencyHz.toFixed(1)),
      rpm: Number(rpm.toFixed(2)),
      linearSpeedMps: Number(linearSpeedMps.toFixed(3)),
      pulsesCounted: Math.round(frequencyHz),
      jitterMs: Number(jitterMs.toFixed(2)),
      isValid,
    };
  }

  /**
   * Convert RPM to pulse frequency in Hz.
   */
  public static rpmToFrequency(
    rpm: number,
    pulsesPerRevolution: number = 1024
  ): number {
    return Number(((rpm * pulsesPerRevolution) / 60).toFixed(1));
  }
}
