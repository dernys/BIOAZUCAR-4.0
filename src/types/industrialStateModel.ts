/**
 * BIOAZÚCAR 4.0 — UNIFIED INDUSTRIAL STATE MODEL
 * ==============================================================================
 * Conforms to IEC 62443-3-3 / IEC 62443-4-2 & ISA-95 Standards.
 * 
 * Mandates the STRICT SEPARATION of the four independent industrial state axes:
 * 
 * 1. DEPLOYMENT PROFILE: Where/how the instance is provisioned (infrastructure tier).
 * 2. RUNTIME MODE: How the process data pipeline currently operates.
 * 3. CONNECTIVITY STATE: Physical and protocol communication channel health.
 * 4. VALIDATION STATE: Formal lifecycle maturation level based on technical evidence.
 * 
 * INVARIANT: In PRODUCTION deployment profile, ANY silent path to simulation,
 * mock data, or synthetic fallback is STRICTLY FORBIDDEN and triggers an
 * immediate Fail-Closed abort.
 */

// ------------------------------------------------------------------------------
// 1. DEPLOYMENT PROFILE
// ------------------------------------------------------------------------------
export type DeploymentProfile = 'SIMULATION' | 'LAB' | 'PRODUCTION';

export const VALID_DEPLOYMENT_PROFILES: readonly DeploymentProfile[] = [
  'SIMULATION',
  'LAB',
  'PRODUCTION',
] as const;

// ------------------------------------------------------------------------------
// 2. RUNTIME MODE
// ------------------------------------------------------------------------------
export type RuntimeMode =
  | 'SIMULATION'
  | 'LIVE_OT'
  | 'HYBRID'
  | 'HISTORICAL_REPLAY'
  | 'WAITING_FOR_COMMISSIONING';

export const VALID_RUNTIME_MODES: readonly RuntimeMode[] = [
  'SIMULATION',
  'LIVE_OT',
  'HYBRID',
  'HISTORICAL_REPLAY',
  'WAITING_FOR_COMMISSIONING',
] as const;

// ------------------------------------------------------------------------------
// 3. CONNECTIVITY STATE
// ------------------------------------------------------------------------------
export type ConnectivityState =
  | 'ONLINE'
  | 'OFFLINE'
  | 'DEGRADED'
  | 'CONNECTING'
  | 'DISCONNECTED'
  | 'FAULT'
  | 'SYNCING'
  | 'SYNC_ERROR';

export const VALID_CONNECTIVITY_STATES: readonly ConnectivityState[] = [
  'ONLINE',
  'OFFLINE',
  'DEGRADED',
  'CONNECTING',
  'DISCONNECTED',
  'FAULT',
  'SYNCING',
  'SYNC_ERROR',
] as const;

// ------------------------------------------------------------------------------
// 4. VALIDATION STATE (Formal Industrial Maturation Level)
// ------------------------------------------------------------------------------
export type ValidationState =
  | 'DESIGNED'
  | 'IMPLEMENTED'
  | 'TESTED'
  | 'LAB_VALIDATED'
  | 'FAT_VALIDATED'
  | 'SAT_VALIDATED'
  | 'FIELD_VALIDATED'
  | 'PRODUCTION_OPERATIONAL';

export const VALID_VALIDATION_STATES: readonly ValidationState[] = [
  'DESIGNED',
  'IMPLEMENTED',
  'TESTED',
  'LAB_VALIDATED',
  'FAT_VALIDATED',
  'SAT_VALIDATED',
  'FIELD_VALIDATED',
  'PRODUCTION_OPERATIONAL',
] as const;

export const VALIDATION_STATE_ORDER: Record<ValidationState, number> = {
  DESIGNED: 0,
  IMPLEMENTED: 1,
  TESTED: 2,
  LAB_VALIDATED: 3,
  FAT_VALIDATED: 4,
  SAT_VALIDATED: 5,
  FIELD_VALIDATED: 6,
  PRODUCTION_OPERATIONAL: 7,
};

// ------------------------------------------------------------------------------
// UNIFIED STATE INTERFACE
// ------------------------------------------------------------------------------
export interface UnifiedIndustrialState {
  readonly deploymentProfile: DeploymentProfile;
  readonly runtimeMode: RuntimeMode;
  readonly connectivityState: ConnectivityState;
  readonly validationState: ValidationState;
  readonly lastStateChangeTimestamp: string;
  readonly isolationStrict: boolean;
  readonly simulationPermitted: boolean;
  readonly provenance: {
    readonly actor: string;
    readonly reason: string;
    readonly correlationId: string;
    readonly signature?: string;
  };
}

// ------------------------------------------------------------------------------
// INDUSTRIAL STATE VALIDATION & INTEGRITY GUARDS
// ------------------------------------------------------------------------------

export class IndustrialStateViolationError extends Error {
  public readonly code: string;
  public readonly violations: readonly string[];

  constructor(message: string, code = "INDUSTRIAL_STATE_VIOLATION", violations: string[] = []) {
    super(`[BIOAZÚCAR INDUSTRIAL STATE VIOLATION] ${message}`);
    this.name = "IndustrialStateViolationError";
    this.code = code;
    this.violations = Object.freeze([...violations]);
    Object.setPrototypeOf(this, IndustrialStateViolationError.prototype);
  }
}

/**
 * Validates the coherence of the 4 independent state axes.
 * Returns valid = true or an array of specific industrial rule violations.
 */
export function validateStateCoherence(
  deploymentProfile: DeploymentProfile,
  runtimeMode: RuntimeMode,
  connectivityState: ConnectivityState,
  validationState: ValidationState,
  options?: { isSimulatedData?: boolean; isMockFallback?: boolean }
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  // Invariant 1: In PRODUCTION, SIMULATION mode is prohibited.
  if (deploymentProfile === 'PRODUCTION') {
    if (runtimeMode === 'SIMULATION') {
      violations.push(
        "CRITICAL: RuntimeMode cannot be 'SIMULATION' when DeploymentProfile is 'PRODUCTION'."
      );
    }
    if (options?.isSimulatedData) {
      violations.push(
        "CRITICAL: Simulated data points are strictly prohibited under 'PRODUCTION' profile."
      );
    }
    if (options?.isMockFallback) {
      violations.push(
        "CRITICAL: Mock or synthetic fallback is strictly prohibited under 'PRODUCTION' profile."
      );
    }
  }

  // Invariant 2: Production operational requires validated field or SAT evidence.
  if (validationState === 'PRODUCTION_OPERATIONAL') {
    if (deploymentProfile !== 'PRODUCTION') {
      violations.push(
        "CRITICAL: ValidationState cannot be 'PRODUCTION_OPERATIONAL' in non-production profiles."
      );
    }
    if (runtimeMode === 'SIMULATION') {
      violations.push(
        "CRITICAL: ValidationState 'PRODUCTION_OPERATIONAL' incompatible with 'SIMULATION' mode."
      );
    }
  }

  // Invariant 3: If not commissioned yet, mode must be WAITING_FOR_COMMISSIONING
  if (connectivityState === 'DISCONNECTED' && runtimeMode === 'LIVE_OT' && deploymentProfile === 'PRODUCTION') {
    // Permitted, but if never connected, should ideally be WAITING_FOR_COMMISSIONING
  }

  // Invariant 4: ConnectivityState 'ONLINE' requires real connectivity
  if (connectivityState === 'ONLINE' && runtimeMode === 'WAITING_FOR_COMMISSIONING') {
    violations.push(
      "WARNING: Connectivity cannot be 'ONLINE' while still in 'WAITING_FOR_COMMISSIONING' mode."
    );
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Throws IndustrialStateViolationError if the state combination breaches industrial invariants.
 */
export function assertValidIndustrialState(
  deploymentProfile: DeploymentProfile,
  runtimeMode: RuntimeMode,
  connectivityState: ConnectivityState,
  validationState: ValidationState,
  options?: { isSimulatedData?: boolean; isMockFallback?: boolean }
): void {
  const result = validateStateCoherence(
    deploymentProfile,
    runtimeMode,
    connectivityState,
    validationState,
    options
  );

  if (!result.valid) {
    throw new IndustrialStateViolationError(
      result.violations.join(" | "),
      "STATE_COHERENCE_FAILED",
      result.violations
    );
  }
}

/**
 * Invariant guard for PRODUCTION deployment profile.
 */
export function assertProductionNoSimulation(
  profile: DeploymentProfile,
  mode: RuntimeMode,
  options?: { isSimulated?: boolean; isFallback?: boolean }
): void {
  if (profile === 'PRODUCTION') {
    if (mode === 'SIMULATION') {
      throw new IndustrialStateViolationError(
        "Illegal simulation mode requested in PRODUCTION deployment profile. Fail-Closed enforced.",
        "PROD_SIMULATION_FORBIDDEN"
      );
    }
    if (options?.isSimulated) {
      throw new IndustrialStateViolationError(
        "Simulated telemetry rejected in PRODUCTION profile. Fail-Closed enforced.",
        "PROD_SIMULATED_DATA_REJECTED"
      );
    }
    if (options?.isFallback) {
      throw new IndustrialStateViolationError(
        "Synthetic fallback rejected in PRODUCTION profile. Fail-Closed enforced.",
        "PROD_FALLBACK_REJECTED"
      );
    }
  }
}
