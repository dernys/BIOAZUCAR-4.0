/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — LOCAL AI COMPUTE COST MODEL (OLLAMA / EDGE ON-PREMISE)
 * [P0-15] HARDWARE POWER CONSUMPTION & RUNTIME ELECTRICAL COST ACCOUNTING
 * ============================================================================
 */

export interface HardwareProfile {
  id: string;
  name: string;
  tdpWatts: number;
  averageLoadFactor: number; // e.g. 0.75 under inference
  deviceType: "GPU_DATACENTER" | "GPU_WORKSTATION" | "SOC_EMBEDDED" | "CPU_SERVER";
}

export const STANDARD_HARDWARE_PROFILES: Record<string, HardwareProfile> = {
  RTX_4090: {
    id: "RTX_4090",
    name: "NVIDIA GeForce RTX 4090 24GB (Edge Workstation)",
    tdpWatts: 450,
    averageLoadFactor: 0.8,
    deviceType: "GPU_WORKSTATION",
  },
  A100_80GB: {
    id: "A100_80GB",
    name: "NVIDIA A100 Tensor Core 80GB (Plant Local Server)",
    tdpWatts: 400,
    averageLoadFactor: 0.75,
    deviceType: "GPU_DATACENTER",
  },
  APPLE_M3_MAX: {
    id: "APPLE_M3_MAX",
    name: "Apple M3 Max 128GB Unified Memory (Control Room Host)",
    tdpWatts: 100,
    averageLoadFactor: 0.65,
    deviceType: "SOC_EMBEDDED",
  },
  XEON_EDGE: {
    id: "XEON_EDGE",
    name: "Intel Xeon Gold 6430 CPU-only Edge IPC",
    tdpWatts: 270,
    averageLoadFactor: 0.7,
    deviceType: "CPU_SERVER",
  },
};

export interface LocalComputeConfig {
  hardwareId: string;
  electricityRateUsdPerKWh: number; // e.g. $0.12 / kWh industrial tariff
  customWatts?: number;
}

export class LocalAiComputeModel {
  private static instance: LocalAiComputeModel | null = null;
  private config: LocalComputeConfig = {
    hardwareId: "RTX_4090",
    electricityRateUsdPerKWh: 0.12, // Industrial standard average
  };

  private constructor() {}

  public static getInstance(): LocalAiComputeModel {
    if (!LocalAiComputeModel.instance) {
      LocalAiComputeModel.instance = new LocalAiComputeModel();
    }
    return LocalAiComputeModel.instance;
  }

  public getConfig(): LocalComputeConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<LocalComputeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public calculateComputeCost(durationMs: number): {
    powerWatts: number;
    kwhConsumed: number;
    localComputeCostUsd: number;
    hardwareName: string;
    electricityRateUsdPerKWh: number;
  } {
    const profile = STANDARD_HARDWARE_PROFILES[this.config.hardwareId] || STANDARD_HARDWARE_PROFILES.RTX_4090;
    const effectiveWatts = this.config.customWatts || (profile.tdpWatts * profile.averageLoadFactor);

    const durationSeconds = Math.max(0, durationMs / 1000);
    const hours = durationSeconds / 3600;
    const kwhConsumed = (effectiveWatts / 1000) * hours;
    const localComputeCostUsd = kwhConsumed * this.config.electricityRateUsdPerKWh;

    return {
      powerWatts: Math.round(effectiveWatts),
      kwhConsumed: Math.round(kwhConsumed * 1000000) / 1000000,
      localComputeCostUsd: Math.round(localComputeCostUsd * 1000000) / 1000000,
      hardwareName: profile.name,
      electricityRateUsdPerKWh: this.config.electricityRateUsdPerKWh,
    };
  }
}

export const localAiComputeModel = LocalAiComputeModel.getInstance();
