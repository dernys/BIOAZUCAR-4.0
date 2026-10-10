import { describe, it, expect, beforeEach } from "vitest";
import {
  TwinProcessSimulator,
  twinProcessSimulator,
} from "../services/digitaltwin/engine/TwinProcessSimulator";
import {
  WhatIfScenarioEngine,
  whatIfScenarioEngine,
} from "../services/digitaltwin/engine/WhatIfScenarioEngine";
import {
  HistoricalReplayController,
  historicalReplayController,
} from "../services/digitaltwin/engine/HistoricalReplayController";
import {
  AssetGraphEngine,
  assetGraphEngine,
} from "../services/digitaltwin/engine/AssetGraphEngine";
import {
  TwinStateEngine,
} from "../services/digitaltwin/engine/TwinStateEngine";
import {
  CANONICAL_TWIN_ASSETS,
  CANONICAL_TWIN_SENSORS,
  CANONICAL_TWIN_ACTUATORS,
  CANONICAL_TWIN_FLOWS,
} from "../services/digitaltwin/domain/TwinAssetCatalog";
import {
  ScenarioDefinition,
  EquipmentOperationalState,
} from "../services/digitaltwin/domain/DigitalTwinTypes";
import { TelemetryData } from "../types";

describe("BIOAZÚCAR 4.0 — DIGITAL TWIN INDUSTRIAL ENGINE SUITE", () => {
  beforeEach(() => {
    TwinStateEngine.resetInstance();
  });

  describe("1. Domain Model & Asset Taxonomy (ISA-95 & ISO 23247)", () => {
    it("defines canonical assets covering whole sugar mill & cogeneration cycle", () => {
      expect(CANONICAL_TWIN_ASSETS.length).toBeGreaterThanOrEqual(8);

      const assetIds = CANONICAL_TWIN_ASSETS.map((a) => a.id);
      expect(assetIds).toContain("eq-patio-cana");
      expect(assetIds).toContain("eq-preparacion");
      expect(assetIds).toContain("eq-molino-1");
      expect(assetIds).toContain("eq-molino-6");
      expect(assetIds).toContain("eq-caldera-1");
      expect(assetIds).toContain("eq-turbina-1");
      expect(assetIds).toContain("eq-subestacion");
      expect(assetIds).toContain("eq-clarificador");
      expect(assetIds).toContain("eq-evaporadores");
      expect(assetIds).toContain("eq-secador-ensacado");

      for (const asset of CANONICAL_TWIN_ASSETS) {
        expect(asset.id).toBeTruthy();
        expect(asset.code).toBeTruthy();
        expect(asset.name).toBeTruthy();
        expect(asset.isa95Level).toBe("EQUIPMENT");
        expect(asset.designCapacity.nominalValue).toBeGreaterThan(0);
        expect(asset.designCapacity.unit).toBeTruthy();
      }
    });

    it("verifies sensors and actuators linked to physical industrial tags", () => {
      expect(CANONICAL_TWIN_SENSORS.length).toBeGreaterThanOrEqual(10);
      expect(CANONICAL_TWIN_ACTUATORS.length).toBeGreaterThanOrEqual(4);

      for (const sensor of CANONICAL_TWIN_SENSORS) {
        expect(sensor.tagId).toBeTruthy();
        expect(sensor.plcMemoryAddress).toBeTruthy();
        expect(sensor.protocol).toBeTruthy();
        expect(sensor.engineeringUnit).toBeTruthy();
        expect(sensor.rangeMax).toBeGreaterThan(sensor.rangeMin);
      }
    });

    it("verifies material and energy flow network consistency", () => {
      expect(CANONICAL_TWIN_FLOWS.length).toBeGreaterThanOrEqual(8);

      const materialFlows = CANONICAL_TWIN_FLOWS.filter((f) => f.flowType === "MATERIAL");
      const energyFlows = CANONICAL_TWIN_FLOWS.filter((f) => f.flowType === "ENERGY");

      expect(materialFlows.length).toBeGreaterThanOrEqual(5);
      expect(energyFlows.length).toBeGreaterThanOrEqual(3);

      for (const flow of CANONICAL_TWIN_FLOWS) {
        expect(flow.sourceEquipmentId).toBeTruthy();
        expect(flow.targetEquipmentId).toBeTruthy();
        expect(flow.nominalRate).toBeGreaterThan(0);
        expect(flow.rateUnit).toBeTruthy();
      }
    });
  });

  describe("2. Deterministic Process Simulation Engine (Multi-Physics)", () => {
    it("computes Hugot and ASME PTC 4 balances with zero Math.random() usage", () => {
      const run1 = twinProcessSimulator.solve({ tch: 450.0 });
      const run2 = twinProcessSimulator.solve({ tch: 450.0 });

      // Deterministic requirement: identical inputs MUST produce identical outputs
      expect(run1).toEqual(run2);
      expect(run1.millingExtractionPercent).toBeGreaterThan(90);
      expect(run1.millingExtractionPercent).toBeLessThanOrEqual(99);
      expect(run1.bagasseProductionRateTonsH).toBeGreaterThan(100);
      expect(run1.steamFlowHpTonsH).toBeGreaterThan(150);
      expect(run1.powerGeneratedGrossMw).toBeGreaterThan(20);
      expect(run1.sugarProductionTonsToday).toBeGreaterThan(500);
    });

    it("predicts higher steam and power when cane throughput (TCH) increases", () => {
      const base = twinProcessSimulator.solve({ tch: 400.0 });
      const higher = twinProcessSimulator.solve({ tch: 500.0 });

      expect(higher.mixedJuiceFlowTonsH).toBeGreaterThan(base.mixedJuiceFlowTonsH);
      expect(higher.bagasseProductionRateTonsH).toBeGreaterThan(base.bagasseProductionRateTonsH);
      expect(higher.steamFlowHpTonsH).toBeGreaterThan(base.steamFlowHpTonsH);
      expect(higher.powerGeneratedGrossMw).toBeGreaterThan(base.powerGeneratedGrossMw);
      expect(higher.sugarProductionTonsToday).toBeGreaterThan(base.sugarProductionTonsToday);
    });

    it("penalizes boiler efficiency and steam output when bagasse moisture increases", () => {
      const dry = twinProcessSimulator.solve({ bagasseMoisturePercent: 47.0 });
      const wet = twinProcessSimulator.solve({ bagasseMoisturePercent: 52.0 });

      expect(wet.boilerEfficiencyPercent).toBeLessThan(dry.boilerEfficiencyPercent);
      expect(wet.bagasseLhvKcalKg).toBeLessThan(dry.bagasseLhvKcalKg);
      expect(wet.steamFlowHpTonsH).toBeLessThan(dry.steamFlowHpTonsH);
    });
  });

  describe("3. Prescriptive What-If Scenario Sandbox", () => {
    it("executes scenarios and calculates accurate baseline vs scenario deltas", () => {
      const scenario: ScenarioDefinition = {
        id: "test-scen",
        name: "Test High Throughput",
        description: "Test scenario with +15% TCH",
        overrides: [{ parameterKey: "TCH", baselineValue: 450.0, targetValue: 517.5, unit: "TCH" }],
        createdAt: new Date().toISOString(),
        createdBy: "QA Test",
      };

      const result = whatIfScenarioEngine.runScenario(scenario, {
        tch: 450.0,
        bagasseMoisturePercent: 48.8,
        boilerOperatingPressureBar: 64.6,
        gridExportDemandMW: 21.2,
      });

      expect(result.scenarioId).toBe("test-scen");
      expect(result.comparisonMetrics.length).toBeGreaterThan(0);

      const tchMetric = result.comparisonMetrics.find((m) => m.kpiId === "kpi-tch");
      expect(tchMetric).toBeDefined();
      expect(tchMetric?.scenario).toBe(517.5);
      expect(tchMetric?.deltaAbsolute).toBe(67.5);
      expect(tchMetric?.deltaPercent).toBe(15.0);
    });

    it("identifies potential alarms when equipment design limits are exceeded", () => {
      const extremeScenario: ScenarioDefinition = {
        id: "scen-extreme",
        name: "Extreme Overload",
        description: "TCH beyond maximum safe limit (600 TCH)",
        overrides: [{ parameterKey: "TCH", baselineValue: 450.0, targetValue: 600.0, unit: "TCH" }],
        createdAt: new Date().toISOString(),
        createdBy: "Stress Test",
      };

      const result = whatIfScenarioEngine.runScenario(extremeScenario);
      expect(result.potentialAlarms.length).toBeGreaterThan(0);
      expect(result.potentialAlarms.some((a) => a.severity === "CRITICAL" || a.severity === "HIGH")).toBe(true);
    });
  });

  describe("4. Historical Replay Engine (Deterministic Time-Travel)", () => {
    it("supports play, pause, stop, speed multipliers and time seeking", () => {
      const controller = HistoricalReplayController.getInstance();

      controller.stop();
      expect(controller.getConfig().status).toBe("STOPPED");

      controller.play();
      expect(controller.getConfig().status).toBe("PLAYING");

      controller.pause();
      expect(controller.getConfig().status).toBe("PAUSED");

      controller.setSpeed(10);
      expect(controller.getConfig().playbackSpeed).toBe(10);

      controller.setSpeed(50);
      expect(controller.getConfig().playbackSpeed).toBe(50);

      // Seek to valid time within configured window
      const startMs = new Date(controller.getConfig().startTimeIso).getTime();
      const endMs = new Date(controller.getConfig().endTimeIso).getTime();
      const targetIso = new Date(startMs + (endMs - startMs) / 2).toISOString();
      controller.seek(targetIso);
      expect(controller.getConfig().currentPlaybackTimeIso).toBe(targetIso);

      controller.stop();
      expect(controller.getConfig().status).toBe("STOPPED");
    });

    it("reconstructs deterministic telemetry and equipment states for a given timestamp", () => {
      const controller = HistoricalReplayController.getInstance();
      const reconstructedTel = controller.getReconstructedTelemetry();

      expect(reconstructedTel.tch).toBeGreaterThan(300);
      expect(reconstructedTel.steamFlowHP).toBeGreaterThan(150);
      expect(reconstructedTel.bagasseMoisture).toBeGreaterThan(40);

      const states = controller.getReconstructedEquipmentStates();
      expect(Object.keys(states).length).toBeGreaterThanOrEqual(CANONICAL_TWIN_ASSETS.length);
      for (const eqId of Object.keys(states)) {
        expect(states[eqId].stateSince).toBeTruthy();
        expect(states[eqId].stateConfidence).toBeGreaterThan(0.9);
      }
    });
  });

  describe("5. Asset Topology & Process Graph Engine", () => {
    it("resolves upstream and downstream equipment dependencies across the mill", () => {
      const molino1Downstream = assetGraphEngine.getDownstreamEquipment("eq-molino-1");
      expect(molino1Downstream.length).toBeGreaterThan(0);

      const calderaUpstream = assetGraphEngine.getUpstreamEquipment("eq-caldera-1");
      expect(calderaUpstream.some((e) => e.id === "eq-molino-6")).toBe(true);

      const turbinaUpstream = assetGraphEngine.getUpstreamEquipment("eq-turbina-1");
      expect(turbinaUpstream.some((e) => e.id === "eq-caldera-1")).toBe(true);

      const subestacionUpstream = assetGraphEngine.getUpstreamEquipment("eq-subestacion");
      expect(subestacionUpstream.some((e) => e.id === "eq-turbina-1")).toBe(true);
    });

    it("retrieves sensor, actuator, and flow maps for any asset in the plant", () => {
      const boilerSensors = assetGraphEngine.getEquipmentSensors("eq-caldera-1");
      expect(boilerSensors.length).toBeGreaterThanOrEqual(2);
      expect(boilerSensors.some((s) => s.measurementType === "PRESSURE")).toBe(true);
      expect(boilerSensors.some((s) => s.measurementType === "TEMPERATURE")).toBe(true);

      const boilerActuators = assetGraphEngine.getEquipmentActuators("eq-caldera-1");
      expect(boilerActuators.length).toBeGreaterThan(0);

      const boilerFlows = assetGraphEngine.getEquipmentFlows("eq-caldera-1");
      expect(boilerFlows.incoming.length).toBeGreaterThan(0);
      expect(boilerFlows.outgoing.length).toBeGreaterThan(0);
    });

    it("resolves cryptographic lineage and OT provenance chain for tags", () => {
      const lineage = assetGraphEngine.resolveLineage("Boiler1.Steam_Pressure_HP", 64.6, "GOOD");
      expect(lineage).toBeDefined();
      expect(lineage?.chain.equipmentCode).toBe("CALD-BIO-001");
      expect(lineage?.chain.protocol).toBe("OPC_UA");
      expect(lineage?.chain.driverId).toContain("opc_ua");
      expect(lineage?.quality).toBe("GOOD");
    });
  });

  describe("6. Twin State Engine & Data Quality Propagation (Rule 8 & 9)", () => {
    it("maintains strict data quality taxonomy (GOOD, UNCERTAIN, BAD, SIMULATED)", () => {
      const engine = TwinStateEngine.getInstance();
      const state = engine.getGlobalTwinState();

      expect(state.dataQualitySummary.totalTags).toBeGreaterThan(0);
      expect(state.dataQualitySummary.overallQualityPercentage).toBeGreaterThanOrEqual(0);
      expect(state.dataQualitySummary.overallQualityPercentage).toBeLessThanOrEqual(100);
      expect(state.mode).toBeDefined();
    });

    it("updates equipment operational state and detects vibration / pressure faults", () => {
      const engine = TwinStateEngine.getInstance();

      const telemetryNormal = {
        tch: 450,
        bagasseMoisture: 48.8,
        boilerPressureHP: 64.6,
        steamFlowHP: 211.5,
        powerGeneratedMW: 32.4,
        powerInternalMW: 11.2,
        powerExportGridMW: 21.2,
        gridFrequencyHz: 60.0,
        gridVoltageKV: 138.0,
        clarifiedJuiceFlow: 380,
        evaporatorSyrupBrix: 66.5,
        sugarProductionTonsToday: 865,
        sugarBagsToday: 17300,
        factoryRecoveryYield: 11.45,
        molassesProductionTons: 280,
        oeeOverall: 89.6,
        oeeAvailability: 93.4,
        oeePerformance: 96.8,
        oeeQuality: 99.1,
        mill3Vibration: 2.1,
      } as unknown as TelemetryData;

      engine.updateTelemetry(telemetryNormal);
      let globalState = engine.getGlobalTwinState();
      expect(globalState.equipmentStates["eq-molino-3"].currentState).toBe("RUNNING");
      expect(globalState.equipmentStates["eq-caldera-1"].currentState).toBe("RUNNING");

      // High vibration on mill 3 -> WARNING
      const telemetryWarning: TelemetryData = {
        ...telemetryNormal,
        mill3Vibration: 4.8,
      };
      engine.updateTelemetry(telemetryWarning);
      globalState = engine.getGlobalTwinState();
      expect(globalState.equipmentStates["eq-molino-3"].currentState).toBe("WARNING");

      // Excess boiler pressure -> FAULT
      const telemetryFault: TelemetryData = {
        ...telemetryNormal,
        boilerPressureHP: 68.2,
      };
      engine.updateTelemetry(telemetryFault);
      globalState = engine.getGlobalTwinState();
      expect(globalState.equipmentStates["eq-caldera-1"].currentState).toBe("FAULT");
    });

    it("respects operational modes without confusing SIMULATED with LIVE_OT", () => {
      const engine = TwinStateEngine.getInstance();

      engine.setOperationalMode("SIMULATION");
      expect(engine.getGlobalTwinState().mode).toBe("SIMULATION");

      engine.setOperationalMode("PRODUCTION");
      expect(engine.getGlobalTwinState().mode).toBe("PRODUCTION");

      engine.setOperationalMode("HISTORICAL_REPLAY");
      expect(engine.getGlobalTwinState().mode).toBe("HISTORICAL_REPLAY");

      engine.setOperationalMode("HYBRID");
      expect(engine.getGlobalTwinState().mode).toBe("HYBRID");

      engine.setOperationalMode("WAITING_FOR_COMMISSIONING");
      expect(engine.getGlobalTwinState().mode).toBe("WAITING_FOR_COMMISSIONING");
    });
  });
});
