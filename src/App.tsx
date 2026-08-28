import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Navigation, NavigationTab } from "./components/Navigation";
import { DashboardOverview } from "./components/DashboardOverview";
import { ProcessFlowSCADA } from "./components/ProcessFlowSCADA";
import { DigitalTwin3D } from "./components/DigitalTwin3D";
import { BatchTraceability } from "./components/BatchTraceability";
import { EquipmentMaintenance } from "./components/EquipmentMaintenance";
import { HistorianTrends } from "./components/HistorianTrends";
import { AlarmCenter } from "./components/AlarmCenter";
import { AICenter } from "./components/AICenter";
import {
  TelemetryData,
  UserRole,
  SimulationScenario,
  EquipmentItem,
  CaneBatch,
  WorkOrder,
  AlarmEvent,
} from "./types";
import {
  initialTelemetry,
  initialEquipment,
  initialCaneBatches,
  initialWorkOrders,
  initialAlarms,
} from "./data/mockIndustrialData";
import { updateTelemetry } from "./services/simulationEngine";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [currentRole, setCurrentRole] = useState<UserRole>("supervisor");
  const [scenario, setScenario] = useState<SimulationScenario>("VIBRACION_MOLINO3");
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);

  // Core App State
  const [telemetry, setTelemetry] = useState<TelemetryData>(initialTelemetry);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(initialEquipment);
  const [batches, setBatches] = useState<CaneBatch[]>(initialCaneBatches);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(initialWorkOrders);
  const [alarms, setAlarms] = useState<AlarmEvent[]>(initialAlarms);

  // Active alarms count for badge
  const activeAlarmsCount = (alarms || []).filter(
    (a) => a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED")
  ).length;

  // Real-time industrial physics simulation loop
  useEffect(() => {
    if (!isSimRunning || speedMultiplier === 0) return;

    const interval = setInterval(() => {
      setTelemetry((prev) => updateTelemetry(prev, scenario, speedMultiplier));

      // Dynamically update Molino 3 vibration based on scenario
      setEquipmentList((prevList) =>
        prevList.map((eq) => {
          if (eq.id === "eq-molino-3") {
            const vib = scenario === "VIBRACION_MOLINO3" ? 4.8 : 2.6;
            return {
              ...eq,
              vibrationRMS: +(vib + (Math.random() * 0.2 - 0.1)).toFixed(2),
              status: vib > eq.vibrationThreshold ? "WARNING" : "RUNNING",
            };
          }
          if (eq.id === "eq-caldera-1") {
            const p = scenario === "CAIDA_PRESION_CALDERA" ? 54.0 : 64.5;
            return {
              ...eq,
              status: p < 58 ? "WARNING" : "RUNNING",
            };
          }
          return eq;
        })
      );
    }, 1500);

    return () => clearInterval(interval);
  }, [isSimRunning, speedMultiplier, scenario]);

  // Handler to add a new batch
  const handleAddBatch = (newBatch: CaneBatch) => {
    setBatches((prev) => [newBatch, ...prev]);
  };

  // Handler to add a new work order
  const handleAddWorkOrder = (newWO: WorkOrder) => {
    setWorkOrders((prev) => [newWO, ...prev]);
  };

  // Handler to update a work order
  const handleUpdateWorkOrder = (updatedWO: WorkOrder) => {
    setWorkOrders((prev) => prev.map((wo) => (wo.id === updatedWO.id ? updatedWO : wo)));
  };

  // Handler to acknowledge alarm
  const handleAcknowledgeAlarm = (alarmId: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === alarmId ? { ...a, status: "ACKNOWLEDGED" as const } : a))
    );
  };

  // Handler to reset/clear alarm
  const handleClearAlarm = (alarmId: string) => {
    setAlarms((prev) =>
      prev.map((a) => (a.id === alarmId ? { ...a, status: "CLEARED" as const } : a))
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Header (System Status, Simulation Controls, Role Switcher) */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        scenario={scenario}
        onScenarioChange={setScenario}
        speedMultiplier={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        isSimRunning={isSimRunning}
        onToggleSim={() => setIsSimRunning((prev) => !prev)}
        alarms={alarms}
      />

      {/* 2. Industrial Tab Navigation Bar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeAlarmsCount={activeAlarmsCount}
      />

      {/* 3. Main Operational Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {activeTab === "dashboard" && (
          <DashboardOverview
            telemetry={telemetry}
            currentRole={currentRole}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === "scada" && (
          <ProcessFlowSCADA
            telemetry={telemetry}
            equipmentList={equipmentList}
            currentRole={currentRole}
          />
        )}

        {activeTab === "digital_twin" && (
          <DigitalTwin3D
            telemetry={telemetry}
            equipmentList={equipmentList}
          />
        )}

        {activeTab === "batches" && (
          <BatchTraceability
            batches={batches}
            onAddBatch={handleAddBatch}
            currentRole={currentRole}
          />
        )}

        {activeTab === "equipment" && (
          <EquipmentMaintenance
            equipmentList={equipmentList}
            workOrders={workOrders}
            onAddWorkOrder={handleAddWorkOrder}
            onUpdateWorkOrder={handleUpdateWorkOrder}
            currentRole={currentRole}
          />
        )}

        {activeTab === "historian" && (
          <HistorianTrends
            telemetry={telemetry}
            currentRole={currentRole}
          />
        )}

        {activeTab === "alarms" && (
          <AlarmCenter
            alarms={alarms}
            onAcknowledgeAlarm={handleAcknowledgeAlarm}
            onClearAlarm={handleClearAlarm}
            currentRole={currentRole}
          />
        )}

        {activeTab === "ai_center" && (
          <AICenter
            telemetry={telemetry}
            currentRole={currentRole}
          />
        )}
      </main>

      {/* 4. Industrial Footer & SCADA Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-3 px-4 sm:px-6 text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            PLC S7-1500 / DCS DeltaV: Online
          </span>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            Normas: ISA-88 (Lotes) • ISA-95 (MES/ERP) • ISA-18.2 (Alarmas) • ISO 10816 (Vibraciones)
          </span>
        </div>
        <div>
          <span>BioAzúcar 4.0 Industrial Edge Suite • Licencia Corporativa Planta 01</span>
        </div>
      </footer>
    </div>
  );
}
