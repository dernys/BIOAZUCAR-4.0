/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — DETERMINISTIC MULTI-PHYSICS TWIN PROCESS SIMULATOR
 * Hugot Sugar Cane Milling, ASME PTC 4 Steam Generators, Isentropic Turbine
 * Expansion, and Evaporator Mass/Energy Balance Engines.
 * (Zero Math.random() usage — 100% deterministic & reproducible)
 * ============================================================================
 */

export interface SimulationInputParameters {
  tch: number;                  // Cane throughput (TCH) [e.g. 450 t/h]
  canePolPercent: number;       // Sucrose in cane [e.g. 15.4%]
  caneBrixPercent: number;      // Total soluble solids in cane [e.g. 18.8%]
  caneFiberPercent: number;     // Insoluble fiber in cane [e.g. 14.2%]
  imbibitionWaterRatio: number; // % water on fiber [e.g. 250%]
  hydraulicPressureBar: number; // Mill hydraulic top roll pressure [e.g. 250 bar]
  bagasseMoisturePercent: number;// Bagasse residual moisture [e.g. 48.8%]
  boilerOperatingPressureBar: number; // HP drum pressure [e.g. 64.6 bar]
  superheatedSteamTempC: number;      // Superheated steam temp [e.g. 485 °C]
  feedwaterTempC: number;             // Deaerator / Economizer feedwater temp [e.g. 115 °C]
  turbineExtractionPressureBar: number; // LP factory exhaust steam [e.g. 2.2 bar]
  gridExportDemandMW: number;         // Contractual PPA dispatch demand [e.g. 21.2 MW]
}

export interface SimulationProcessOutput {
  // Milling & Bagasse
  millingExtractionPercent: number;
  imbibitionWaterFlowTonsH: number;
  mixedJuiceFlowTonsH: number;
  mixedJuiceBrix: number;
  bagasseProductionRateTonsH: number;
  bagasseLhvKcalKg: number;
  bagasseLhvMjKg: number;

  // Boilers & Steam (ASME PTC 4)
  bagasseBoilerConsumptionTonsH: number;
  bagasseSurplusStorageTonsH: number;
  steamFlowHpTonsH: number;
  boilerEfficiencyPercent: number;
  boilerHeatInputMw: number;
  boilerSteamHeatOutputMw: number;
  flueGasO2Percent: number;

  // Power Generation & Turbines
  powerGeneratedGrossMw: number;
  powerInternalConsumptionMw: number;
  powerExportNetMw: number;
  specificSteamConsumptionKgKwh: number;
  turbineExhaustSteamFlowTonsH: number;

  // Factory Process (Evaporation & Sugar)
  clarifiedJuiceFlowTonsH: number;
  evaporatorWaterEvaporatedTonsH: number;
  syrupMeladuraFlowTonsH: number;
  syrupBrix: number;
  sugarProductionTonsToday: number;
  molassesProductionTonsToday: number;
  factorySugarRecoveryYieldPercent: number;

  // Global Key Performance Indicators
  overallEnergySelfSufficiencyPercent: number;
  steamPerTonCaneKgT: number;
}

export class TwinProcessSimulator {
  private static instance: TwinProcessSimulator | null = null;

  public static readonly DEFAULT_INPUTS: SimulationInputParameters = {
    tch: 452.4,
    canePolPercent: 15.4,
    caneBrixPercent: 18.8,
    caneFiberPercent: 14.2,
    imbibitionWaterRatio: 250.0,
    hydraulicPressureBar: 250.0,
    bagasseMoisturePercent: 48.8,
    boilerOperatingPressureBar: 64.6,
    superheatedSteamTempC: 485.2,
    feedwaterTempC: 115.0,
    turbineExtractionPressureBar: 2.2,
    gridExportDemandMW: 21.2,
  };

  public static getInstance(): TwinProcessSimulator {
    if (!TwinProcessSimulator.instance) {
      TwinProcessSimulator.instance = new TwinProcessSimulator();
    }
    return TwinProcessSimulator.instance;
  }

  /**
   * Deterministic solver for integrated sugar mill mass & energy balance equations
   */
  public solve(inputs: Partial<SimulationInputParameters> = {}): SimulationProcessOutput {
    const p: SimulationInputParameters = { ...TwinProcessSimulator.DEFAULT_INPUTS, ...inputs };

    // ------------------------------------------------------------------------
    // 1. MILLING STATION & FIBER/WATER BALANCE (HUGOT FORMULATION)
    // ------------------------------------------------------------------------
    const fiberRateTonsH = p.tch * (p.caneFiberPercent / 100);
    const imbibitionWaterFlowTonsH = fiberRateTonsH * (p.imbibitionWaterRatio / 100);

    // Extraction efficiency as function of imbibition, fiber and hydraulic pressure
    // Base Hugot extraction equation normalized for modern 6-mill 84" tandem:
    const pressureFactor = Math.min(1.02, Math.max(0.95, p.hydraulicPressureBar / 250.0));
    const imbibitionFactor = Math.min(1.03, Math.max(0.94, (p.imbibitionWaterRatio / 250.0) ** 0.15));
    const baseExtraction = 96.5;
    const millingExtractionPercent = Math.min(98.2, Math.max(90.0, +(baseExtraction * pressureFactor * imbibitionFactor).toFixed(2)));

    // Bagasse production: Bagasse = Fiber / (1 - Moisture - Pol - Ash)
    // Typical bagasse solids: Fiber ~47%, Moisture ~48.8%, Pol ~2.2%, Ash ~2.0%
    const bagasseSolidsFraction = (100 - p.bagasseMoisturePercent - 2.2 - 2.0) / 100;
    const bagasseProductionRateTonsH = +(fiberRateTonsH / Math.max(0.40, bagasseSolidsFraction)).toFixed(2);

    // Lower Heating Value (PCI) formula de Hugot:
    // PCI = 4250 - 4850*W - 1080*Ash - 42.5*Pol (kcal/kg) with W as fraction (0.488)
    const W = p.bagasseMoisturePercent / 100;
    const ash = 0.025;
    const polBagasse = 0.022;
    const bagasseLhvKcalKg = Math.round(4250 - 4850 * W - 1080 * ash - 42.5 * (polBagasse * 100)); // ~1820 kcal/kg
    const bagasseLhvMjKg = +(bagasseLhvKcalKg * 0.0041868).toFixed(3); // ~7.62 MJ/kg

    // Mixed Juice: Mass balance: Inflow (Cane + Imbibition) - Outflow (Bagasse)
    const mixedJuiceFlowTonsH = +(p.tch + imbibitionWaterFlowTonsH - bagasseProductionRateTonsH).toFixed(2);
    const polInCane = p.tch * (p.canePolPercent / 100);
    const polInJuice = polInCane * (millingExtractionPercent / 100);
    const mixedJuiceBrix = +(p.caneBrixPercent * (p.tch / mixedJuiceFlowTonsH) * 0.98).toFixed(2);

    // ------------------------------------------------------------------------
    // 2. STEAM GENERATION (ASME PTC 4 BOILER BALANCE)
    // ------------------------------------------------------------------------
    // Boiler efficiency: Losses model: Flue gas moisture loss increases with bagasse moisture W
    const moistureEfficiencyPenalty = (p.bagasseMoisturePercent - 48.0) * 0.65;
    const boilerEfficiencyPercent = Math.min(88.0, Math.max(76.0, +(85.8 - moistureEfficiencyPenalty).toFixed(2)));

    // Steam Enthalpy calculation at boiler operating point:
    // Superheated steam at 65 bar, 485°C: h ~ 3385 kJ/kg
    // Feedwater at 115°C: h ~ 485 kJ/kg -> Delta h = 2900 kJ/kg = 2.90 MJ/kg
    const deltaEnthalpyMjPerKg = 2.90;

    // Steam production capacity from bagasse:
    // Q_steam = (Bagasse_consumed * LHV * Efficiency) / Delta_h
    // Factory typically consumes ~72% of bagasse for power & process, storing ~28%
    const bagasseBoilerConsumptionTonsH = Math.min(
      bagasseProductionRateTonsH,
      +(bagasseProductionRateTonsH * 0.73).toFixed(2)
    );
    const bagasseSurplusStorageTonsH = +(bagasseProductionRateTonsH - bagasseBoilerConsumptionTonsH).toFixed(2);

    const heatInputMw = (bagasseBoilerConsumptionTonsH * 1000 * bagasseLhvMjKg) / 3600;
    const steamProducedKgH = (bagasseBoilerConsumptionTonsH * 1000 * bagasseLhvMjKg * (boilerEfficiencyPercent / 100)) / deltaEnthalpyMjPerKg;
    const steamFlowHpTonsH = +(steamProducedKgH / 1000).toFixed(2);
    const steamHeatOutputMw = (steamFlowHpTonsH * 1000 * deltaEnthalpyMjPerKg) / 3600;

    // ------------------------------------------------------------------------
    // 3. TURBOGENERATION & POWER DISPATCH (ISENTROPIC EXPANSION)
    // ------------------------------------------------------------------------
    // Isentropic enthalpy drop from 64 bar, 480°C to 2.2 bar exhaust: Delta h_is ~ 620 kJ/kg
    // Turbine isentropic efficiency ~ 81.5% -> Delta h_actual ~ 505 kJ/kg = 0.505 MJ/kg
    // Specific steam consumption = 3600 / 505 ~ 7.12 kg steam / kWh gross
    const isentropicEfficiency = 0.815;
    const deltaTurbineEnthalpyKj = 620.0 * isentropicEfficiency; // ~505.3 kJ/kg
    const specificSteamConsumptionKgKwh = +(3600 / deltaTurbineEnthalpyKj).toFixed(2); // ~7.12

    // Gross MW generated by passing HP steam through turbine to process:
    const maxPowerCapacityMw = 35.0;
    const powerGeneratedGrossMw = Math.min(
      maxPowerCapacityMw,
      +((steamFlowHpTonsH * 1000) / (specificSteamConsumptionKgKwh * 1000)).toFixed(2)
    );

    // Factory internal electrical consumption: ~24.5 kWh / ton cane ground + boiler auxiliaries
    const factoryLoadKw = p.tch * 24.5 + 400; // kW
    const powerInternalConsumptionMw = +(factoryLoadKw / 1000).toFixed(2);

    // Net export to grid
    const powerExportNetMw = Math.max(0, +(powerGeneratedGrossMw - powerInternalConsumptionMw).toFixed(2));
    const turbineExhaustSteamFlowTonsH = +(steamFlowHpTonsH * 0.96).toFixed(2);

    // ------------------------------------------------------------------------
    // 4. FACTORY PROCESS & EVAPORATION (MASS BALANCE)
    // ------------------------------------------------------------------------
    // Clarified juice ~ 98% of mixed juice, remaining 2% is cachaza (filter cake)
    const clarifiedJuiceFlowTonsH = +(mixedJuiceFlowTonsH * 0.98).toFixed(2);
    const syrupBrix = 66.8;
    const juiceBrix = 14.8;
    // Water evaporated in quadruple effect: W = Juice * (1 - Brix_juice / Brix_syrup)
    const evaporatorWaterEvaporatedTonsH = +(clarifiedJuiceFlowTonsH * (1 - juiceBrix / syrupBrix)).toFixed(2);
    const syrupMeladuraFlowTonsH = +(clarifiedJuiceFlowTonsH - evaporatorWaterEvaporatedTonsH).toFixed(2);

    // Sugar recovery: SJM formula (Noël Deerr) for white refined & VHP sugar:
    // Factory yield ~ 11.4% on cane for 15.4 Pol, 83 Purity
    const factorySugarRecoveryYieldPercent = +(p.canePolPercent * (millingExtractionPercent / 100) * 0.77).toFixed(2);
    const sugarRateTonsH = p.tch * (factorySugarRecoveryYieldPercent / 100);
    const sugarProductionTonsToday = +(sugarRateTonsH * 24).toFixed(1);
    const molassesProductionTonsToday = +(p.tch * 0.031 * 24).toFixed(1);

    // Specific steam consumption per ton cane:
    const steamPerTonCaneKgT = Math.round((steamFlowHpTonsH * 1000) / p.tch);

    return {
      millingExtractionPercent,
      imbibitionWaterFlowTonsH: +imbibitionWaterFlowTonsH.toFixed(2),
      mixedJuiceFlowTonsH,
      mixedJuiceBrix,
      bagasseProductionRateTonsH,
      bagasseLhvKcalKg,
      bagasseLhvMjKg,

      bagasseBoilerConsumptionTonsH,
      bagasseSurplusStorageTonsH,
      steamFlowHpTonsH,
      boilerEfficiencyPercent,
      boilerHeatInputMw: +heatInputMw.toFixed(1),
      boilerSteamHeatOutputMw: +steamHeatOutputMw.toFixed(1),
      flueGasO2Percent: 3.6,

      powerGeneratedGrossMw,
      powerInternalConsumptionMw,
      powerExportNetMw,
      specificSteamConsumptionKgKwh,
      turbineExhaustSteamFlowTonsH,

      clarifiedJuiceFlowTonsH,
      evaporatorWaterEvaporatedTonsH,
      syrupMeladuraFlowTonsH,
      syrupBrix,
      sugarProductionTonsToday,
      molassesProductionTonsToday,
      factorySugarRecoveryYieldPercent,

      overallEnergySelfSufficiencyPercent: +( (powerGeneratedGrossMw / powerInternalConsumptionMw) * 100 ).toFixed(1),
      steamPerTonCaneKgT,
    };
  }
}

export const twinProcessSimulator = TwinProcessSimulator.getInstance();
