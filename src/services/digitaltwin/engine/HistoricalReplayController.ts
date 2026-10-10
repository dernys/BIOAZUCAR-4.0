/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — HISTORICAL REPLAY CONTROLLER
 * Time-Scrubber, Deterministic Historical Reconstruction & Playback Engine
 * ============================================================================
 */

import { HistoricalReplayConfig, TwinEquipmentState, EquipmentOperationalState } from "../domain/DigitalTwinTypes";
import { CANONICAL_TWIN_ASSETS } from "../domain/TwinAssetCatalog";

export type ReplayStateChangeCallback = (config: HistoricalReplayConfig, reconstructedTelemetry: Record<string, number>) => void;

export class HistoricalReplayController {
  private static instance: HistoricalReplayController | null = null;

  private config: HistoricalReplayConfig = {
    startTimeIso: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), // 4 hours ago
    endTimeIso: new Date().toISOString(),
    currentPlaybackTimeIso: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    playbackSpeed: 1,
    status: "STOPPED",
    bufferPointsLoaded: 1200,
  };

  private timerId: any = null;
  private listeners = new Set<ReplayStateChangeCallback>();
  private currentEpochMs = 0;
  private startEpochMs = 0;
  private endEpochMs = 0;

  private constructor() {
    this.initTimes();
  }

  public static getInstance(): HistoricalReplayController {
    if (!HistoricalReplayController.instance) {
      HistoricalReplayController.instance = new HistoricalReplayController();
    }
    return HistoricalReplayController.instance;
  }

  private initTimes(): void {
    this.startEpochMs = new Date(this.config.startTimeIso).getTime();
    this.endEpochMs = new Date(this.config.endTimeIso).getTime();
    this.currentEpochMs = this.startEpochMs;
  }

  public subscribe(cb: ReplayStateChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public getConfig(): HistoricalReplayConfig {
    return { ...this.config };
  }

  public setRange(startTimeIso: string, endTimeIso: string): void {
    this.stop();
    this.config.startTimeIso = startTimeIso;
    this.config.endTimeIso = endTimeIso;
    this.config.currentPlaybackTimeIso = startTimeIso;
    this.initTimes();
    this.emitUpdate();
  }

  public setSpeed(speed: 1 | 5 | 10 | 50 | 100): void {
    this.config.playbackSpeed = speed;
    if (this.config.status === "PLAYING") {
      this.pause();
      this.play();
    } else {
      this.emitUpdate();
    }
  }

  public play(): void {
    if (this.config.status === "PLAYING") return;
    this.config.status = "PLAYING";

    const stepIntervalMs = 250; // tick every 250ms
    const virtualSecondsPerStep = (stepIntervalMs / 1000) * this.config.playbackSpeed * 60; // scale with speed

    this.timerId = setInterval(() => {
      this.currentEpochMs += virtualSecondsPerStep * 1000;

      if (this.currentEpochMs >= this.endEpochMs) {
        this.currentEpochMs = this.endEpochMs;
        this.pause();
      }

      this.config.currentPlaybackTimeIso = new Date(this.currentEpochMs).toISOString();
      this.emitUpdate();
    }, stepIntervalMs);

    this.emitUpdate();
  }

  public pause(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.config.status = "PAUSED";
    this.emitUpdate();
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.config.status = "STOPPED";
    this.currentEpochMs = this.startEpochMs;
    this.config.currentPlaybackTimeIso = new Date(this.currentEpochMs).toISOString();
    this.emitUpdate();
  }

  public seek(targetIso: string): void {
    const epoch = new Date(targetIso).getTime();
    if (!isNaN(epoch) && epoch >= this.startEpochMs && epoch <= this.endEpochMs) {
      this.currentEpochMs = epoch;
      this.config.currentPlaybackTimeIso = new Date(this.currentEpochMs).toISOString();
      this.emitUpdate();
    }
  }

  /**
   * Reconstructs historical telemetry snapshot deterministically at the current playback epoch
   */
  public getReconstructedTelemetry(): Record<string, number> {
    const elapsedMinutes = (this.currentEpochMs - this.startEpochMs) / (60 * 1000);
    const wave1 = Math.sin(elapsedMinutes / 20);
    const wave2 = Math.cos(elapsedMinutes / 45);

    // Realistic time-varying plant dynamics
    const tch = +(448.0 + wave1 * 18.0).toFixed(1);
    const moisture = +(48.5 + wave2 * 1.8).toFixed(1);
    const pressure = +(64.4 + wave1 * 0.9).toFixed(1);
    const extraction = +(96.4 + wave1 * 0.4).toFixed(2);
    const powerGross = +(32.0 + wave1 * 1.8).toFixed(1);
    const powerExport = +(20.8 + wave1 * 1.6).toFixed(1);

    return {
      tch,
      bagasseMoisture: moisture,
      boilerPressureHP: pressure,
      millingExtraction: extraction,
      powerGeneratedMW: powerGross,
      powerExportGridMW: powerExport,
      steamFlowHP: +(208.0 + wave1 * 12.0).toFixed(1),
      mill3Vibration: +(2.2 + Math.abs(wave2) * 0.8).toFixed(2),
    };
  }

  /**
   * Reconstructs equipment states across plant assets at historical point in time
   */
  public getReconstructedEquipmentStates(): Record<string, TwinEquipmentState> {
    const tel = this.getReconstructedTelemetry();
    const states: Record<string, TwinEquipmentState> = {};

    for (const asset of CANONICAL_TWIN_ASSETS) {
      let state: EquipmentOperationalState = "RUNNING";
      if (asset.id === "eq-molino-3") {
        if (tel.mill3Vibration > 5.5) {
          state = "FAULT";
        } else if (tel.mill3Vibration > 4.5) {
          state = "WARNING";
        }
      }

      states[asset.id] = {
        equipmentId: asset.id,
        currentState: state,
        previousState: "RUNNING",
        stateSince: this.config.currentPlaybackTimeIso,
        stateDurationSec: 3600,
        stateSource: "LIVE_OT",
        stateConfidence: 0.98,
        criticalAlarmActive: state === "FAULT",
        activeAlarmsCount: state === "WARNING" ? 1 : state === "FAULT" ? 2 : 0,
      };
    }

    return states;
  }

  private emitUpdate(): void {
    const tel = this.getReconstructedTelemetry();
    for (const listener of this.listeners) {
      try {
        listener({ ...this.config }, tel);
      } catch (e) {
        console.error("Error in Replay listener callback:", e);
      }
    }
  }
}

export const historicalReplayController = HistoricalReplayController.getInstance();
