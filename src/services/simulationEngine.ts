import { TelemetryData } from "../types";

export type SimulationScenario =
  | "NORMAL"
  | "VIBRACION_MOLINO3"
  | "ALERTA_CALDERA"
  | "BAGAZO_HUMEDO"
  | "PICO_EXPORTACION"
  | "PARADA_DESFIBRADORA";

export const INITIAL_TELEMETRY: TelemetryData = {
  timestamp: new Date().toISOString(),
  tch: 452.4,
  caneAccumToday: 8420.5,
  caneBrix: 18.8,
  canePol: 15.4,
  canePurity: 86.6,
  millingExtraction: 96.5,
  imbibitionWaterFlow: 85.8,

  bagasseProductionRate: 134.2,
  bagasseBoilerConsumption: 97.5,
  bagasseYardStorageRate: 36.7,
  bagasseMoisture: 48.8,
  bagasseStockTotal: 24530.0,

  boilerPressureHP: 64.6,
  boilerTempHP: 485.2,
  steamFlowHP: 211.5,
  steamPressureLP: 2.2,
  steamTempLP: 134.8,
  boilerEfficiency: 85.2,
  flueGasO2: 3.6,

  powerGeneratedMW: 32.5,
  powerInternalMW: 11.3,
  powerExportGridMW: 21.2,
  gridFrequencyHz: 60.02,
  powerFactor: 0.94,
  gridVoltageKV: 138.1,

  clarifiedJuiceFlow: 382.0,
  evaporatorSyrupBrix: 66.8,
  sugarProductionTonsToday: 862.4,
  sugarBagsToday: 17248,
  factoryRecoveryYield: 11.42,
  molassesProductionTons: 279.5,

  oeeOverall: 89.6,
  oeeAvailability: 93.4,
  oeePerformance: 96.8,
  oeeQuality: 99.1,
};

export function updateTelemetry(
  prev: TelemetryData,
  scenario: SimulationScenario,
  speedMultiplier: number = 1
): TelemetryData {
  // Stochastic noise function
  const jitter = (amount: number) => (Math.random() - 0.5) * 2 * amount;

  let baseTCH = 450;
  let bagasseMoist = 48.8;
  let boilerPress = 64.5;
  let boilerO2 = 3.6;
  let extraction = 96.5;
  let boilerEff = 85.2;
  let vibMill3 = 2.8;

  switch (scenario) {
    case "VIBRACION_MOLINO3":
      baseTCH = 410;
      vibMill3 = 5.4 + jitter(0.4);
      break;
    case "ALERTA_CALDERA":
      boilerPress = 54.2 + jitter(1.5);
      boilerO2 = 5.2 + jitter(0.3);
      boilerEff = 78.5;
      break;
    case "BAGAZO_HUMEDO":
      bagasseMoist = 53.8 + jitter(0.5);
      boilerEff = 79.2;
      boilerPress = 59.8;
      break;
    case "PICO_EXPORTACION":
      baseTCH = 480;
      boilerPress = 66.0;
      break;
    case "PARADA_DESFIBRADORA":
      baseTCH = 0;
      extraction = 0;
      break;
    case "NORMAL":
    default:
      baseTCH = 452;
      break;
  }

  const tch = baseTCH > 0 ? Math.max(0, baseTCH + jitter(6)) : 0;
  const dtHours = (1.5 / 3600) * speedMultiplier;
  const caneAccumToday = prev.caneAccumToday + (tch * dtHours);

  // Mass balance formulas:
  // Bagasse is roughly 29.5% of cane weight
  const bagasseProductionRate = +(tch * 0.296).toFixed(1);
  const bagasseBoilerConsumption = +(
    tch > 0 ? Math.min(bagasseProductionRate, 96 + jitter(2.5)) : 20
  ).toFixed(1);
  const bagasseYardStorageRate = +(bagasseProductionRate - bagasseBoilerConsumption).toFixed(1);
  const bagasseStockTotal = +(
    prev.bagasseStockTotal + (bagasseYardStorageRate * dtHours)
  ).toFixed(1);

  // Steam generation from bagasse burnt
  const steamFlowHP = +(
    (bagasseBoilerConsumption * 2.15 * (boilerEff / 85)) + jitter(2)
  ).toFixed(1);
  const boilerPressureHP = +(boilerPress + jitter(0.3)).toFixed(1);
  const boilerTempHP = +(485 + jitter(2.5)).toFixed(1);
  const flueGasO2 = +(boilerO2 + jitter(0.15)).toFixed(2);

  // Cogeneration Power output (MW)
  const powerGeneratedMW = +(
    (steamFlowHP * 0.154) + jitter(0.4)
  ).toFixed(2);
  const powerInternalMW = +(
    (tch > 0 ? 11.2 + (tch / 450) * 0.8 : 3.5) + jitter(0.2)
  ).toFixed(2);
  const powerExportGridMW = +(
    Math.max(0, powerGeneratedMW - powerInternalMW)
  ).toFixed(2);

  // Sugar output
  const caneBrix = +(18.8 + jitter(0.2)).toFixed(2);
  const canePol = +(15.4 + jitter(0.15)).toFixed(2);
  const canePurity = +((canePol / caneBrix) * 100).toFixed(1);
  const factoryRecoveryYield = +(11.4 + jitter(0.1)).toFixed(2);
  const sugarProductionTonsToday = +(
    prev.sugarProductionTonsToday + (tch * (factoryRecoveryYield / 100) * dtHours)
  ).toFixed(2);
  const sugarBagsToday = Math.floor(sugarProductionTonsToday * 20); // 50kg bags
  const molassesProductionTons = +(
    prev.molassesProductionTons + (tch * 0.033 * dtHours)
  ).toFixed(2);

  // OEE
  const oeeAvailability = scenario === "PARADA_DESFIBRADORA" ? 42.0 : +(93.2 + jitter(0.5)).toFixed(1);
  const oeePerformance = scenario === "BAGAZO_HUMEDO" ? 84.5 : +(96.5 + jitter(0.4)).toFixed(1);
  const oeeQuality = +(99.0 + jitter(0.2)).toFixed(1);
  const oeeOverall = +(
    (oeeAvailability * oeePerformance * oeeQuality) / 10000
  ).toFixed(1);

  return {
    timestamp: new Date().toISOString(),
    tch: +tch.toFixed(1),
    caneAccumToday: +caneAccumToday.toFixed(1),
    caneBrix,
    canePol,
    canePurity,
    millingExtraction: +(extraction + jitter(0.2)).toFixed(1),
    imbibitionWaterFlow: +(85.5 + jitter(1.5)).toFixed(1),

    bagasseProductionRate,
    bagasseBoilerConsumption,
    bagasseYardStorageRate,
    bagasseMoisture: +(bagasseMoist + jitter(0.2)).toFixed(1),
    bagasseStockTotal,

    boilerPressureHP,
    boilerTempHP,
    steamFlowHP,
    steamPressureLP: +(2.2 + jitter(0.05)).toFixed(2),
    steamTempLP: +(135 + jitter(1.2)).toFixed(1),
    boilerEfficiency: +(boilerEff + jitter(0.3)).toFixed(1),
    flueGasO2,

    powerGeneratedMW,
    powerInternalMW,
    powerExportGridMW,
    gridFrequencyHz: +(60.0 + jitter(0.03)).toFixed(2),
    powerFactor: +(0.94 + jitter(0.01)).toFixed(2),
    gridVoltageKV: +(138.0 + jitter(0.4)).toFixed(1),

    clarifiedJuiceFlow: +(tch * 0.84 + jitter(2)).toFixed(1),
    evaporatorSyrupBrix: +(66.8 + jitter(0.3)).toFixed(1),
    sugarProductionTonsToday,
    sugarBagsToday,
    factoryRecoveryYield,
    molassesProductionTons,

    oeeOverall,
    oeeAvailability,
    oeePerformance,
    oeeQuality,
  };
}
