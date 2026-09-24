/**
 * BIOAZÚCAR 4.0 — UNIFIED FIELD VALIDATION HARNESS (FLD-01 & FLD-02)
 * ===================================================================
 * Co-simulation and Field Validation Coordinator:
 * - Couples Tandem Mill bagasse production with Biomass Boiler steam generation.
 * - Executes automated SAT acceptance procedures with cryptographically sealed acts.
 */

import { FieldTandemValidationService, TandemFieldCommissioningAct } from "./FieldTandemValidationService";
import { FieldBoilerValidationService, BoilerFieldCommissioningAct } from "./FieldBoilerValidationService";
import crypto from "crypto";

export interface UnifiedFieldCommissioningPackage {
  packageId: string;
  facility: string;
  timestamp: string;
  tandemAct: TandemFieldCommissioningAct;
  boilerAct: BoilerFieldCommissioningAct;
  steamBagasseMassBalance: {
    caneCrushedTch: number;
    bagasseProducedTch: number;
    bagasseConsumedBoilerTch: number;
    surplusBagasseTch: number;
    highPressureSteamGeneratedTph: number;
    turbineMillingSteamDemandTph: number;
    cogenExportMw: number;
    massBalanceClosed: boolean;
  };
  overallFieldReadiness: "APROBADO_PARA_ZAFRA" | "RECHAZADO";
  masterVerificationSealSha256: string;
}

export class FieldValidationHarness {
  private static instance: FieldValidationHarness | null = null;
  private tandemService = FieldTandemValidationService.getInstance();
  private boilerService = FieldBoilerValidationService.getInstance();
  private packages = new Map<string, UnifiedFieldCommissioningPackage>();

  private constructor() {}

  public static getInstance(): FieldValidationHarness {
    if (!FieldValidationHarness.instance) {
      FieldValidationHarness.instance = new FieldValidationHarness();
    }
    return FieldValidationHarness.instance;
  }

  public runUnifiedCommissioning(facilityName: string = "Central Azucarero Portuguesa"): UnifiedFieldCommissioningPackage {
    const timestamp = new Date().toISOString();
    const packageId = `PKG-FIELD-SAT-${Date.now().toString(36).toUpperCase()}`;

    // 1. Ejecutar validación de campo en Tándem
    const tandemAct = this.tandemService.runTandemFieldCommissioning({ millName: facilityName });

    // 2. Ejecutar validación de campo en Caldera de Bagazo
    const boilerAct = this.boilerService.runBoilerFieldCommissioning({ millName: facilityName });

    // 3. Balance de Masa y Energía Acoplado
    // Caña: 480 TCH -> Bagazo: ~28% de caña = 134.4 TCH
    const caneCrushed = tandemAct.hotCommissioningSnapshot.caneFeedRateTch;
    const bagasseProduced = Number((caneCrushed * 0.28).toFixed(1));
    // Caldera de 125 t/h vapor consume ~ 55 TCH bagazo a 49.5% humedad
    const bagasseConsumedBoiler = 55.0;
    const surplusBagasse = Number((bagasseProduced - bagasseConsumedBoiler).toFixed(1));
    const steamGenerated = boilerAct.hotCommissioningSnapshot.steamFlowTonsPerHour;
    const turbineSteamDemand = 45.0; // Vapor requerido para turbinas de molino
    const cogenExportMw = Number(((steamGenerated - turbineSteamDemand) * 0.25).toFixed(1));

    const massBalanceClosed = surplusBagasse > 0 && steamGenerated >= turbineSteamDemand;
    const overallPassed =
      tandemAct.overallStatus === "CONFORME_APROBADO_CAMPO" &&
      boilerAct.overallStatus === "CONFORME_APROBADO_CAMPO" &&
      massBalanceClosed;

    const payload = JSON.stringify({
      packageId,
      facility: facilityName,
      tandemActHash: tandemAct.conformanceHashSha256,
      boilerActHash: boilerAct.conformanceHashSha256,
      massBalanceClosed,
      timestamp,
    });

    const masterVerificationSealSha256 = crypto
      .createHash("sha256")
      .update(payload)
      .digest("hex");

    const pkg: UnifiedFieldCommissioningPackage = {
      packageId,
      facility: facilityName,
      timestamp,
      tandemAct,
      boilerAct,
      steamBagasseMassBalance: {
        caneCrushedTch: caneCrushed,
        bagasseProducedTch: bagasseProduced,
        bagasseConsumedBoilerTch: bagasseConsumedBoiler,
        surplusBagasseTch: surplusBagasse,
        highPressureSteamGeneratedTph: steamGenerated,
        turbineMillingSteamDemandTph: turbineSteamDemand,
        cogenExportMw,
        massBalanceClosed,
      },
      overallFieldReadiness: overallPassed ? "APROBADO_PARA_ZAFRA" : "RECHAZADO",
      masterVerificationSealSha256,
    };

    this.packages.set(packageId, pkg);
    return pkg;
  }

  public getPackage(packageId: string): UnifiedFieldCommissioningPackage | undefined {
    return this.packages.get(packageId);
  }

  public resetForTesting(): void {
    this.packages.clear();
    this.tandemService.resetForTesting();
    this.boilerService.resetForTesting();
  }
}
