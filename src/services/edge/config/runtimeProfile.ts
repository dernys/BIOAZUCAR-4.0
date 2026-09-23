/**
 * BioAzúcar 4.0 — Industrial Runtime Profiles & Fail-Closed Enforcement Engine (I22)
 * 
 * Spec Reference: developer_roadmap.md Section 1.4, Section 4.3 & Iteration I22
 * 
 * Establishes the authoritative architectural boundary between:
 *   - SIMULATION (Digital Twin, automated tests, offline sandbox, demos)
 *   - LAB (Reference servers, Hardware-in-the-Loop [HIL], test benches)
 *   - PRODUCTION (Physical plant OT connection, zero synthetic fallback, Fail-Closed)
 * 
 * Strict Invariants:
 *  1. Single Authoritative Source: process.env.INDUSTRIAL_RUNTIME_PROFILE.
 *  2. Any null, empty, unknown, or ambiguous configuration triggers FAIL CLOSED.
 *  3. In PRODUCTION: Any mock driver, synthetic provider, random generator, fake timestamp,
 *     or silent fallback triggers immediate abort (Fail-Closed).
 *  4. No automatic conversion: PRODUCTION cannot silently downgrade to LAB or SIMULATION.
 */

export type IndustrialRuntimeProfile = 'SIMULATION' | 'LAB' | 'PRODUCTION';

export class FatalRuntimeConfigError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code = "FATAL_RUNTIME_CONFIG_ERROR", details?: Record<string, any>) {
    super(`[BIOAZÚCAR INDUSTRIAL RUNTIME FATAL] ${message}`);
    this.name = "FatalRuntimeConfigError";
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, FatalRuntimeConfigError.prototype);
  }
}

export interface ProductionValidationContext {
  driverId?: string;
  driverType?: string;
  isSimulated?: boolean;
  isMock?: boolean;
  isSimulatedFallback?: boolean;
  hasRandomGenerator?: boolean;
  hasFakeTimestamps?: boolean;
  providerType?: string;
  protocol?: string;
  endpoint?: string;
  runtimeProfile?: string;
  allowSimulation?: boolean;
}

export class RuntimeProfileManager {
  private static instance: RuntimeProfileManager;
  private overrideProfile: IndustrialRuntimeProfile | null = null;
  private isExitSuppressedForTesting = false;

  private constructor() {}

  public static getInstance(): RuntimeProfileManager {
    if (!RuntimeProfileManager.instance) {
      RuntimeProfileManager.instance = new RuntimeProfileManager();
    }
    return RuntimeProfileManager.instance;
  }

  /**
   * For testing purposes: allows unit test runner to capture fail-closed without killing the test worker.
   */
  public suppressExitForTesting(suppress: boolean): void {
    this.isExitSuppressedForTesting = suppress;
  }

  /**
   * For testing purposes: explicitly sets the runtime profile in memory.
   */
  public setOverride(profile: IndustrialRuntimeProfile | null): void {
    this.overrideProfile = profile;
  }

  /**
   * Resets runtime profile overrides and restores pristine state.
   */
  public reset(): void {
    this.overrideProfile = null;
  }

  public resetForTesting(): void {
    this.reset();
  }

  /**
   * Deterministically validates and returns a runtime profile.
   * If invalid, null, undefined, empty or ambiguous, FAILS CLOSED.
   */
  public validateProfile(rawProfile: unknown): IndustrialRuntimeProfile {
    if (rawProfile === null || rawProfile === undefined) {
      return this.failClosed(
        "Runtime profile is null or undefined. A valid INDUSTRIAL_RUNTIME_PROFILE ('SIMULATION' | 'LAB' | 'PRODUCTION') is mandatory.",
        "RUNTIME_PROFILE_UNDEFINED"
      );
    }

    if (typeof rawProfile !== "string" || rawProfile.trim().length === 0) {
      return this.failClosed(
        "Runtime profile is empty or not a string. Must be 'SIMULATION' | 'LAB' | 'PRODUCTION'.",
        "RUNTIME_PROFILE_EMPTY"
      );
    }

    const trimmed = rawProfile.trim();

    // Check for ambiguous / mixed values
    if (trimmed.includes(",") || trimmed.includes(";") || trimmed.includes("|") || trimmed.includes("&")) {
      return this.failClosed(
        `Ambiguous runtime profile definition detected: '${trimmed}'. Multiple runtime profiles are strictly forbidden.`,
        "RUNTIME_PROFILE_AMBIGUOUS"
      );
    }

    // Check for legacy contradictory environment flags
    if (typeof process !== "undefined" && process.env) {
      const allowSim = process.env.ALLOW_SIMULATION;
      if (trimmed === "PRODUCTION" && allowSim === "true") {
        return this.failClosed(
          "Ambiguous configuration: INDUSTRIAL_RUNTIME_PROFILE is PRODUCTION but ALLOW_SIMULATION is true. Production must fail closed.",
          "RUNTIME_PROFILE_CONTRADICTORY_ENV"
        );
      }
    }

    switch (trimmed) {
      case "SIMULATION":
        return "SIMULATION";
      case "LAB":
        return "LAB";
      case "PRODUCTION":
        return "PRODUCTION";
      default:
        return this.failClosed(
          `Unknown or unsupported runtime profile '${trimmed}'. Valid options: 'SIMULATION', 'LAB', 'PRODUCTION'.`,
          "RUNTIME_PROFILE_UNKNOWN"
        );
    }
  }

  /**
   * Obtains the authoritative runtime profile for the active process.
   * Priority:
   *  1. Explicit test override (if configured via setOverride).
   *  2. process.env.INDUSTRIAL_RUNTIME_PROFILE.
   *  3. In test runners (NODE_ENV=test / VITEST=true) where no profile is set,
   *     defaults safely to 'SIMULATION' to preserve existing test runs.
   *  4. Otherwise, triggers FAIL CLOSED.
   */
  public getActiveProfile(): IndustrialRuntimeProfile {
    if (this.overrideProfile) {
      return this.validateProfile(this.overrideProfile);
    }

    const envVar = typeof process !== "undefined" ? process.env?.INDUSTRIAL_RUNTIME_PROFILE : undefined;
    if (envVar !== undefined && envVar !== null) {
      return this.validateProfile(envVar);
    }

    // Vitest / Jest safe fallback for pre-existing legacy test suites
    if (typeof process !== "undefined") {
      const isTestEnv = process.env?.NODE_ENV === "test" || process.env?.VITEST === "true";
      if (isTestEnv) {
        return "SIMULATION";
      }
    }

    // If not in automated test environment and env var is missing: FAIL CLOSED
    return this.failClosed(
      "Missing INDUSTRIAL_RUNTIME_PROFILE environment variable. Execution halted (FAIL CLOSED).",
      "RUNTIME_PROFILE_MISSING"
    );
  }

  /**
   * Asserts that a driver or provider configuration is valid for PRODUCTION.
   * Enforces the absolute prohibition of mocks, synthetic fallbacks, and random generators in PRODUCTION.
   */
  public assertProductionSafety(ctx: ProductionValidationContext): void {
    const profile = this.getActiveProfile();
    if (profile !== "PRODUCTION") {
      return; // Permitted under SIMULATION and LAB
    }

    if (ctx.isMock || ctx.driverType === "MOCK" || ctx.providerType === "MOCK") {
      this.failClosed(
        `FAIL CLOSED: Mock driver or mock provider '${ctx.driverId || "unknown"}' is strictly prohibited in PRODUCTION profile.`,
        "PRODUCTION_MOCK_PROHIBITED",
        ctx
      );
    }

    if (ctx.isSimulated || ctx.driverType === "SIMULATOR" || ctx.providerType === "SIMULATION") {
      this.failClosed(
        `FAIL CLOSED: Simulation driver or synthetic provider '${ctx.driverId || "unknown"}' is strictly prohibited in PRODUCTION profile.`,
        "PRODUCTION_SIMULATION_PROHIBITED",
        ctx
      );
    }

    if (ctx.isSimulatedFallback === true) {
      this.failClosed(
        `FAIL CLOSED: Silent simulated fallback is strictly prohibited on driver '${ctx.driverId || "unknown"}' in PRODUCTION profile.`,
        "PRODUCTION_FALLBACK_PROHIBITED",
        ctx
      );
    }

    if (ctx.hasRandomGenerator === true) {
      this.failClosed(
        `FAIL CLOSED: Pseudo-random data generation detected in '${ctx.driverId || "unknown"}'. Random data is strictly prohibited in PRODUCTION profile.`,
        "PRODUCTION_RANDOM_DATA_PROHIBITED",
        ctx
      );
    }

    if (ctx.hasFakeTimestamps === true) {
      this.failClosed(
        `FAIL CLOSED: Artificial/fake timestamp generation detected in '${ctx.driverId || "unknown"}'. Genuine device timestamps are required in PRODUCTION.`,
        "PRODUCTION_FAKE_TIMESTAMPS_PROHIBITED",
        ctx
      );
    }

    if (ctx.endpoint) {
      const ep = ctx.endpoint.toLowerCase();
      if (
        ep.includes("localhost") ||
        ep.includes("127.0.0.1") ||
        ep.includes("::1") ||
        ep.includes("mock") ||
        ep.includes("simulated")
      ) {
        this.failClosed(
          `FAIL CLOSED: Loopback or mock endpoint '${ctx.endpoint}' is prohibited for driver '${ctx.driverId || "unknown"}' in PRODUCTION profile.`,
          "PRODUCTION_LOOPBACK_ENDPOINT_PROHIBITED",
          ctx
        );
      }
    }
  }

  /**
   * Triggers the Fail-Closed termination.
   */
  private failClosed(message: string, code: string, details?: Record<string, any>): never {
    const error = new FatalRuntimeConfigError(message, code, details);
    const isTestEnvironment =
      this.isExitSuppressedForTesting ||
      (typeof process !== "undefined" &&
        (process.env?.NODE_ENV === "test" || process.env?.VITEST === "true"));

    if (!isTestEnvironment) {
      console.error(`\n=================================================================`);
      console.error(`[BIOAZÚCAR 4.0 FATAL] FAIL-CLOSED ACTIVATED`);
      console.error(`Reason: ${message}`);
      console.error(`Code:   ${code}`);
      if (details) {
        console.error(`Details:`, JSON.stringify(details, null, 2));
      }
      console.error(`=================================================================\n`);
    }

    // In a live production node process (when not suppressed by test harness), abort process immediately
    if (
      !isTestEnvironment &&
      typeof process !== "undefined" &&
      typeof process.exit === "function"
    ) {
      process.exit(1);
    }

    throw error;
  }
}

const manager = RuntimeProfileManager.getInstance();

export function getRuntimeProfile(): IndustrialRuntimeProfile {
  return manager.getActiveProfile();
}

export function validateRuntimeProfile(raw: unknown): IndustrialRuntimeProfile {
  return manager.validateProfile(raw);
}

export function assertValidProductionEnvironment(context: ProductionValidationContext): void {
  manager.assertProductionSafety(context);
}

export function setRuntimeProfileOverride(profile: IndustrialRuntimeProfile | null): void {
  manager.setOverride(profile);
}

export function suppressExitForTesting(suppress: boolean): void {
  manager.suppressExitForTesting(suppress);
}

export function resetRuntimeProfile(): void {
  manager.reset();
}

export function isSimulation(): boolean {
  return getRuntimeProfile() === "SIMULATION";
}

export function isLab(): boolean {
  return getRuntimeProfile() === "LAB";
}

export function isProduction(): boolean {
  return getRuntimeProfile() === "PRODUCTION";
}
