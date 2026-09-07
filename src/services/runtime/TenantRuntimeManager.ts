import { TenantEnterprise } from "../../types";
import { TenantRuntime } from "./TenantRuntime";
import { RuntimeMode, TenantConfiguration } from "./types";

export class TenantRuntimeManager {
  private static instance: TenantRuntimeManager;
  private runtimes = new Map<string, TenantRuntime>();

  private constructor() {
    // Canonical default tenant BIOAZUCAR-DEMO
    this.getOrCreateRuntime("BIOAZUCAR-DEMO", "SIMULATION");
    // Also register legacy tenant-bioazucar-01 mapping for backward compatibility
    this.getOrCreateRuntime("tenant-bioazucar-01", "SIMULATION");
  }

  public static getInstance(): TenantRuntimeManager {
    if (!TenantRuntimeManager.instance) {
      TenantRuntimeManager.instance = new TenantRuntimeManager();
    }
    return TenantRuntimeManager.instance;
  }

  public getRuntime(tenantId: string): TenantRuntime {
    const cleanId = tenantId?.trim() || "BIOAZUCAR-DEMO";
    if (!this.runtimes.has(cleanId)) {
      return this.getOrCreateRuntime(cleanId, "SIMULATION");
    }
    return this.runtimes.get(cleanId)!;
  }

  public hasRuntime(tenantId: string): boolean {
    return this.runtimes.has(tenantId);
  }

  public getOrCreateRuntime(
    tenantId: string,
    initialMode: RuntimeMode = "SIMULATION",
    customConfig?: Partial<TenantConfiguration>
  ): TenantRuntime {
    if (!this.runtimes.has(tenantId)) {
      const runtime = new TenantRuntime(tenantId, initialMode, customConfig);
      this.runtimes.set(tenantId, runtime);
      return runtime;
    }
    return this.runtimes.get(tenantId)!;
  }

  public registerTenant(tenant: TenantEnterprise): TenantRuntime {
    const mode: RuntimeMode = tenant.runtimeMode || "SIMULATION";
    const runtime = this.getOrCreateRuntime(tenant.id || tenant.code, mode, {
      identity: {
        name: tenant.name,
        code: tenant.code,
        country: tenant.country,
        region: tenant.location,
        address: tenant.location,
        timezone: "America/Caracas",
        currency: "USD",
        language: "es",
        contactEmail: tenant.primaryAdminEmail,
        contactPhone: tenant.primaryContactPhone,
        themeColor: tenant.themeColor || "#10b981",
        description: tenant.description,
      },
      caneProcess: {
        nominalTch: tenant.nominalTch,
        minTch: Math.round(tenant.nominalTch * 0.45),
        maxTch: Math.round(tenant.nominalTch * 1.35),
        millsCount: 5,
        nominalExtraction: 96.5,
        fiberPercent: 13.5,
        nominalBrix: 18.8,
        nominalPol: 15.4,
        nominalPurity: 86.6,
        imbibitionWaterPercent: 28.5,
        recoveryYieldTarget: tenant.sugarYieldTarget || 11.42,
      },
      grid: {
        installedCapacityMW: tenant.powerCapacityMW,
        maxExportMW: +(tenant.powerCapacityMW * 0.73).toFixed(1),
        gridFrequencyHz: 60.0,
        gridVoltageKV: 138.0,
        targetPowerFactor: 0.94,
        internalConsumptionMW: +(tenant.powerCapacityMW * 0.35).toFixed(1),
      },
    });

    if (tenant.simulationScenario) {
      runtime.setScenario(tenant.simulationScenario);
    }
    return runtime;
  }

  public getAllTenantIds(): string[] {
    return Array.from(this.runtimes.keys());
  }
}

export const tenantRuntimeManager = TenantRuntimeManager.getInstance();
