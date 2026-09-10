/**
 * BioAzúcar 4.0 — Canonical Hugot Mechanical & Thermodynamic Sugar Engineering Engine
 * 
 * Implements authoritative mathematical equations from Émile Hugot
 * ("Handbook of Cane Sugar Engineering", Elsevier) for milling tandems,
 * sucrose extraction curves, and bagasse combustion energetics.
 */

export interface HugotMillingTandemParams {
  rollDiameterMeters: number; // D (e.g. 1.10 m for 43" roll)
  rollLengthMeters: number; // L (e.g. 2.13 m for 84" roll)
  rollRpm: number; // n (e.g. 4.2 RPM)
  numberOfMills: number; // N (e.g. 5 mills in tandem)
  canePreparationFactor?: number; // c: 1.0 (knives only), 1.25 (heavy shredder / fibrador)
}

export interface HugotExtractionParams {
  dryExtractionE0: number; // E0: dry extraction without imbibition (typically 68.0%)
  imbibitionCoeffKw: number; // kw: Hugot compound imbibition coefficient (1.8 to 2.8)
  imbibitionWaterPercentCane: number; // W: % imbibition water on cane (e.g. 28.0%)
  caneFiberPercent: number; // F: % fiber on cane (e.g. 13.5%)
}

export interface HugotBagassePciParams {
  moisturePercent: number; // H: % moisture (typically 48.0% - 52.0%)
  solidsBrixPercent: number; // S: % soluble solids / Brix (typically 2.0% - 3.5%)
  polPercent?: number; // P: % sucrose / Pol (typically 1.5% - 2.5%)
}

export interface HugotCapacityResult {
  nominalTch: number; // Rated capacity in metric tonnes cane per hour
  volumetricCapacityM3PerHr: number; // Peripheral roll displacement
  recommendedPowerKwPerMill: number; // Minimum recommended motor power per mill
  totalTandemPowerKw: number; // Total shaft drive power required
}

export interface HugotExtractionResult {
  extractionPercent: number; // % sucrose extraction (Pol extraction)
  lostPolInBagassePercent: number; // 100 - extraction
  waterToFiberRatio: number; // W / F ratio
  bagassePercentCaneEstimated: number; // Estimated bagasse % cane
}

export interface HugotBagasseEnergeticsResult {
  pciKcalPerKg: number; // Lower Heating Value (PCI) in kcal/kg
  pciMjPerKg: number; // Lower Heating Value (PCI) in MJ/kg
  equivalentSteamPerTonBagasse: number; // Tonnes of high-pressure steam at 82% boiler efficiency
}

/**
 * 1. Hugot Milling Tandem Capacity Formula:
 *    C = 0.9 * c * n * (1 - 0.06 * D) * L * D^2 * sqrt(N)
 *    where:
 *      c: Cane preparation index (1.0 knived, 1.25 shredded)
 *      n: Roll rotational speed (RPM)
 *      D: Roll diameter (meters)
 *      L: Roll length (meters)
 *      N: Number of mills in tandem
 */
export function calculateHugotMillingCapacity(params: HugotMillingTandemParams): HugotCapacityResult {
  const { rollDiameterMeters: D, rollLengthMeters: L, rollRpm: n, numberOfMills: N } = params;
  const c = params.canePreparationFactor ?? 1.25;

  if (D <= 0 || L <= 0 || n <= 0 || N <= 0) {
    throw new Error("Invalid Hugot parameters: Diameter, length, RPM, and mill count must be positive");
  }

  // Hugot empirical equation calibrated for metric units (meters and metric tonnes/hr)
  const nominalTch = 9.5 * c * n * (1 - 0.06 * D) * L * (D * D) * Math.sqrt(N);

  // Volumetric roll displacement: pi * D * L * (peripheral speed)
  const peripheralSpeedMPerSec = (Math.PI * D * n) / 60;
  const volumetricCapacityM3PerHr = Math.PI * D * L * (peripheralSpeedMPerSec * 3600) * 0.04;

  // Power thumb-rule from Hugot: approx 6.5 to 8.5 kW per TCH per mill
  const recommendedPowerKwPerMill = Math.round((nominalTch * 7.5) / Math.max(1, N));
  const totalTandemPowerKw = recommendedPowerKwPerMill * N;

  return {
    nominalTch: Math.round(nominalTch * 10) / 10,
    volumetricCapacityM3PerHr: Math.round(volumetricCapacityM3PerHr * 10) / 10,
    recommendedPowerKwPerMill,
    totalTandemPowerKw,
  };
}

/**
 * 2. Hugot Compound Imbibition Sucrose Extraction Equation:
 *    E = 100 - (100 - E0) / (1 + kw * (W / F))
 */
export function calculateHugotExtraction(params: HugotExtractionParams): HugotExtractionResult {
  const { dryExtractionE0, imbibitionCoeffKw, imbibitionWaterPercentCane, caneFiberPercent } = params;

  if (caneFiberPercent <= 0) {
    throw new Error("Cane fiber percentage must be greater than zero");
  }

  const waterToFiberRatio = imbibitionWaterPercentCane / caneFiberPercent;
  const extractionPercent = 100 - (100 - dryExtractionE0) / (1 + imbibitionCoeffKw * waterToFiberRatio);
  const lostPolInBagassePercent = Math.max(0, 100 - extractionPercent);

  // Bagasse % cane approx = Fiber / (1 - Moisture) ≈ Fiber / 0.5 = 2.0 * Fiber
  const bagassePercentCaneEstimated = caneFiberPercent / 0.49;

  return {
    extractionPercent: Math.round(extractionPercent * 100) / 100,
    lostPolInBagassePercent: Math.round(lostPolInBagassePercent * 100) / 100,
    waterToFiberRatio: Math.round(waterToFiberRatio * 100) / 100,
    bagassePercentCaneEstimated: Math.round(bagassePercentCaneEstimated * 10) / 10,
  };
}

/**
 * 3. Hugot Bagasse Lower Heating Value (Poder Calorífico Inferior - PCI):
 *    PCI = 4250 - 48.5 * H - 12 * S - 42.5 * P [kcal/kg]
 *    where:
 *      H: Moisture % (Humedad)
 *      S: Soluble solids % (Brix)
 *      P: Sucrose % (Pol)
 */
export function calculateHugotBagassePci(params: HugotBagassePciParams): HugotBagasseEnergeticsResult {
  const { moisturePercent: H, solidsBrixPercent: S } = params;
  const P = params.polPercent ?? (S * 0.82); // Default pol approx 82% of brix

  if (H < 0 || H > 80) {
    throw new Error("Bagasse moisture percentage out of physical limits (0-80%)");
  }

  const pciKcalPerKg = 4250 - (48.5 * H) - (12 * S) - (42.5 * P);
  const pciMjPerKg = pciKcalPerKg * 0.0041868;

  // Tonnes of high pressure steam (65 bar, 485°C, enthalpy approx 780 kcal/kg - feedwater 120 kcal/kg = 660 kcal/kg net)
  // At 82% boiler efficiency: steam = (pci * 0.82) / 660
  const equivalentSteamPerTonBagasse = Math.max(0, (pciKcalPerKg * 0.82) / 660);

  return {
    pciKcalPerKg: Math.round(pciKcalPerKg * 10) / 10,
    pciMjPerKg: Math.round(pciMjPerKg * 100) / 100,
    equivalentSteamPerTonBagasse: Math.round(equivalentSteamPerTonBagasse * 100) / 100,
  };
}

/**
 * 4. Hugot Optimal Imbibition Water Calculator:
 * Balances sucrose extraction revenue gain against evaporator steam cost.
 */
export function calculateOptimalImbibitionWater(
  caneFiberPercent: number,
  sugarPriceUsdPerTon: number = 420,
  steamCostUsdPerTon: number = 12
): {
  recommendedWaterPercentCane: number;
  expectedExtractionPercent: number;
  netMarginalGainUsdPerTonCane: number;
} {
  let optimalWater = 25.0;
  let maxNetGain = -Infinity;
  let bestExtraction = 95.0;

  for (let w = 15.0; w <= 45.0; w += 1.0) {
    const ext = calculateHugotExtraction({
      dryExtractionE0: 68.0,
      imbibitionCoeffKw: 2.2,
      imbibitionWaterPercentCane: w,
      caneFiberPercent,
    }).extractionPercent;

    // Incremental sugar recovered: baseline at w=15%
    const baselineExt = 92.5;
    const extraSugarTonsPerTonCane = ((ext - baselineExt) / 100) * 0.135 * 0.85; // pol recovery
    const sugarRevenue = extraSugarTonsPerTonCane * sugarPriceUsdPerTon;

    // Evaporator steam cost: each additional 1% water on cane requires ~0.25 tonnes steam in quíntuple
    const extraSteamTons = ((w - 15.0) / 100) * 0.25;
    const steamCost = extraSteamTons * steamCostUsdPerTon;

    // Physical hydraulic tandem limit: water > 32% on cane causes roll slipping and bagasse floating
    const rollSlippageLoss = w > 30 ? Math.pow(w - 30, 1.7) * 0.4 : 0;

    const netGain = sugarRevenue - steamCost - rollSlippageLoss;
    if (netGain > maxNetGain) {
      maxNetGain = netGain;
      optimalWater = w;
      bestExtraction = ext;
    }
  }

  return {
    recommendedWaterPercentCane: optimalWater,
    expectedExtractionPercent: bestExtraction,
    netMarginalGainUsdPerTonCane: Math.round(maxNetGain * 100) / 100,
  };
}
