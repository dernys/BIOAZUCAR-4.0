/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — DIGITAL TWIN UNIFIED REACT STORE & HOOK
 * Single Source of Truth for 3D Visualizer, Flow Analytics, Replay & What-If
 * ============================================================================
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  DigitalTwinGlobalState,
  TwinOperationalMode,
  TwinEquipmentState,
  TwinAssetMetadata,
  TwinVariableLineage,
  ScenarioDefinition,
  ScenarioRunResult,
  HistoricalReplayConfig,
} from "../domain/DigitalTwinTypes";
import { twinStateEngine } from "../engine/TwinStateEngine";
import { assetGraphEngine } from "../engine/AssetGraphEngine";
import { whatIfScenarioEngine, WhatIfScenarioEngine } from "../engine/WhatIfScenarioEngine";
import { historicalReplayController } from "../engine/HistoricalReplayController";
import { TelemetryData, AlarmEvent, EquipmentItem } from "../../../types";

export type TwinWorkspaceTab =
  | "PROCESS_DIAGRAM"
  | "3D_SPATIAL"
  | "ASSET_GRAPH"
  | "MASS_ENERGY"
  | "WHAT_IF"
  | "DEGRADATION_RUL"
  | "OT_SYNC"
  | "HISTORICAL_REPLAY";

export interface UseDigitalTwinReturn {
  // Global State
  twinState: DigitalTwinGlobalState;
  activeTab: TwinWorkspaceTab;
  setActiveTab: (tab: TwinWorkspaceTab) => void;
  operationalMode: TwinOperationalMode;
  setOperationalMode: (mode: TwinOperationalMode) => void;

  // Asset Inspection
  selectedEquipmentId: string;
  selectEquipment: (id: string) => void;
  selectedAsset: TwinAssetMetadata | undefined;
  selectedEquipmentState: TwinEquipmentState | undefined;
  upstreamAssets: TwinAssetMetadata[];
  downstreamAssets: TwinAssetMetadata[];
  assetSensors: ReturnType<typeof assetGraphEngine.getEquipmentSensors>;
  assetActuators: ReturnType<typeof assetGraphEngine.getEquipmentActuators>;
  assetFlows: ReturnType<typeof assetGraphEngine.getEquipmentFlows>;
  selectedLineage: TwinVariableLineage | undefined;

  // What-If Prescriptive Sandbox
  availablePresets: ScenarioDefinition[];
  activeScenarioResult: ScenarioRunResult | null;
  runScenario: (scenario: ScenarioDefinition) => void;
  clearScenario: () => void;

  // Historical Replay
  replayConfig: HistoricalReplayConfig;
  playReplay: () => void;
  pauseReplay: () => void;
  stopReplay: () => void;
  setReplaySpeed: (speed: 1 | 5 | 10 | 50 | 100) => void;
  seekReplay: (isoTime: string) => void;

  // Graph Snapshot
  graphSnapshot: ReturnType<typeof assetGraphEngine.buildGraphSnapshot>;
}

const EMPTY_ALARMS: AlarmEvent[] = [];
const EMPTY_EQUIPMENT: EquipmentItem[] = [];

export function useDigitalTwin(
  telemetry?: TelemetryData,
  alarms: AlarmEvent[] = EMPTY_ALARMS,
  equipmentList: EquipmentItem[] = EMPTY_EQUIPMENT
): UseDigitalTwinReturn {
  const [twinState, setTwinState] = useState<DigitalTwinGlobalState>(() =>
    twinStateEngine.getGlobalTwinState()
  );
  const [activeTab, setActiveTab] = useState<TwinWorkspaceTab>("3D_SPATIAL");
  const [activeScenarioResult, setActiveScenarioResult] = useState<ScenarioRunResult | null>(null);
  const [replayConfig, setReplayConfig] = useState<HistoricalReplayConfig>(() =>
    historicalReplayController.getConfig()
  );

  // Sync incoming telemetry with twin state engine using stable dependencies
  useEffect(() => {
    if (telemetry) {
      twinStateEngine.updateTelemetry(telemetry, alarms, equipmentList);
    }
  }, [telemetry, alarms, equipmentList]);

  // Subscribe to central engine updates
  useEffect(() => {
    const unsub = twinStateEngine.subscribe((updatedState) => {
      setTwinState(updatedState);
    });
    return unsub;
  }, []);

  // Subscribe to historical replay updates
  useEffect(() => {
    const unsub = historicalReplayController.subscribe((cfg, tel) => {
      setReplayConfig(cfg);
      if (cfg.status === "PLAYING" || cfg.status === "PAUSED") {
        twinStateEngine.setOperationalMode("HISTORICAL_REPLAY");
      }
    });
    return unsub;
  }, []);

  const selectedEquipmentId = twinState.activeEquipmentId || "eq-caldera-1";

  const selectEquipment = useCallback((id: string) => {
    twinStateEngine.setActiveEquipment(id);
  }, []);

  const setOperationalMode = useCallback((mode: TwinOperationalMode) => {
    twinStateEngine.setOperationalMode(mode);
    if (mode === "HISTORICAL_REPLAY") {
      setActiveTab("HISTORICAL_REPLAY");
    }
  }, []);

  // Derived asset inspection metrics
  const selectedAsset = useMemo(
    () => assetGraphEngine.getAsset(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const selectedEquipmentState = twinState.equipmentStates[selectedEquipmentId];

  const upstreamAssets = useMemo(
    () => assetGraphEngine.getUpstreamEquipment(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const downstreamAssets = useMemo(
    () => assetGraphEngine.getDownstreamEquipment(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const assetSensors = useMemo(
    () => assetGraphEngine.getEquipmentSensors(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const assetActuators = useMemo(
    () => assetGraphEngine.getEquipmentActuators(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const assetFlows = useMemo(
    () => assetGraphEngine.getEquipmentFlows(selectedEquipmentId),
    [selectedEquipmentId]
  );

  const selectedLineage = useMemo(() => {
    if (assetSensors.length > 0) {
      return assetGraphEngine.resolveLineage(assetSensors[0].tagId, 0, "GOOD");
    }
    return undefined;
  }, [assetSensors]);

  // Graph Snapshot
  const graphSnapshot = useMemo(
    () => assetGraphEngine.buildGraphSnapshot(selectedEquipmentId),
    [selectedEquipmentId]
  );

  // Scenario operations
  const availablePresets = WhatIfScenarioEngine.CANONICAL_PRESETS;

  const runScenario = useCallback((scenario: ScenarioDefinition) => {
    const res = whatIfScenarioEngine.runScenario(scenario, {
      tch: telemetry?.tch || 452.4,
      bagasseMoisturePercent: telemetry?.bagasseMoisture || 48.8,
      boilerOperatingPressureBar: telemetry?.boilerPressureHP || 64.6,
      gridExportDemandMW: telemetry?.powerExportGridMW || 21.2,
    });
    setActiveScenarioResult(res);
  }, [telemetry]);

  const clearScenario = useCallback(() => {
    setActiveScenarioResult(null);
  }, []);

  // Replay controls
  const playReplay = useCallback(() => {
    historicalReplayController.play();
  }, []);

  const pauseReplay = useCallback(() => {
    historicalReplayController.pause();
  }, []);

  const stopReplay = useCallback(() => {
    historicalReplayController.stop();
    twinStateEngine.setOperationalMode("SIMULATION");
  }, []);

  const setReplaySpeed = useCallback((speed: 1 | 5 | 10 | 50 | 100) => {
    historicalReplayController.setSpeed(speed);
  }, []);

  const seekReplay = useCallback((isoTime: string) => {
    historicalReplayController.seek(isoTime);
  }, []);

  return {
    twinState,
    activeTab,
    setActiveTab,
    operationalMode: twinState.mode,
    setOperationalMode,

    selectedEquipmentId,
    selectEquipment,
    selectedAsset,
    selectedEquipmentState,
    upstreamAssets,
    downstreamAssets,
    assetSensors,
    assetActuators,
    assetFlows,
    selectedLineage,

    availablePresets,
    activeScenarioResult,
    runScenario,
    clearScenario,

    replayConfig,
    playReplay,
    pauseReplay,
    stopReplay,
    setReplaySpeed,
    seekReplay,

    graphSnapshot,
  };
}
