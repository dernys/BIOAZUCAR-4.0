import React, { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { Header } from "./components/Header";
import { Navigation, NavigationTab } from "./components/Navigation";
import { DashboardOverview } from "./components/DashboardOverview";
import { ProcessFlowSCADA } from "./components/ProcessFlowSCADA";
import { DigitalTwin3D } from "./components/DigitalTwin3D";
import { EnergyDispatch } from "./components/EnergyDispatch";
import { UNSHub } from "./components/UNSHub";
import { BatchTraceability } from "./components/BatchTraceability";
import { EquipmentMaintenance } from "./components/EquipmentMaintenance";
import { HistorianTrends } from "./components/HistorianTrends";
import { AlarmCenter } from "./components/AlarmCenter";
import { AICenter } from "./components/AICenter";
import { SystemConfigVerification } from "./components/SystemConfigVerification";
import { EnterprisesManager } from "./components/EnterprisesManager";
import { UsersAndRolesManager } from "./components/UsersAndRolesManager";
import { DatabaseSyncModal } from "./components/DatabaseSyncModal";
import { RbacSecurityModal } from "./components/RbacSecurityModal";
import { AuthModal } from "./components/AuthModal";
import { CentralProvisioningWizard } from "./components/CentralProvisioningWizard";
import { DataLineageModal } from "./components/DataLineageModal";
import { BioAzucarCopilot } from "./copilot/components/BioAzucarCopilot";
import { ExecutivePresentation } from "./components/ExecutivePresentation";
import { IndustrialConnectionModal } from "./components/IndustrialConnectionModal";
import { AgriculturalPdaView } from "./components/AgriculturalPdaView";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  TelemetryData,
  UserRole,
  SimulationScenario,
  EquipmentItem,
  CaneBatch,
  WorkOrder,
  AlarmEvent,
  AuditLogEntry,
  UserAccount,
  TenantEnterprise,
  RbacRoleDefinition,
  DataLineageInfo,
} from "./types";
import { RuntimeMode } from "./services/runtime/types";
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_TELEMETRY,
  INITIAL_EQUIPMENT,
  INITIAL_BATCHES,
  INITIAL_WORK_ORDERS,
  INITIAL_ALARMS,
} from "./data/mockIndustrialData";
import { updateTelemetry } from "./services/simulationEngine";
import { dataProviderRegistry } from "./services/dataProviders/DataProviderRegistry";
import { tenantRuntimeManager } from "./services/runtime/TenantRuntimeManager";
import {
  INITIAL_TENANTS,
  initializeDatabaseIfEmpty,
  subscribeToTenants,
  subscribeToTelemetry,
  subscribeToCaneBatches,
  subscribeToWorkOrders,
  subscribeToEquipment,
  subscribeToAlarms,
  subscribeToAuditLogs,
  subscribeToUsers,
  subscribeToRoles,
  addCaneBatchToDb,
  addWorkOrderToDb,
  updateWorkOrderInDb,
  acknowledgeAlarmInDb,
  clearAlarmInDb,
  saveTelemetrySnapshot,
  logAuditEventToDb,
  checkDatabaseHealth,
} from "./services/dbService";
import { getStoredUser, setStoredUser, PREDEFINED_USERS, signOutFirebase } from "./services/authService";
import { checkRbacPermission, DEFAULT_ROLES } from "./services/rbacService";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./services/firebase";

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>("dashboard");
  const [currentUser, setCurrentUser] = useState<UserAccount>(() => getStoredUser());
  const [currentRole, setCurrentRole] = useState<UserRole>(currentUser.role);
  const [scenario, setScenario] = useState<SimulationScenario>("NORMAL");
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);
  
  // Multi-Tenant State
  const [tenants, setTenants] = useState<TenantEnterprise[]>(INITIAL_TENANTS);
  const [activeTenant, setActiveTenant] = useState<TenantEnterprise>(() => {
    return INITIAL_TENANTS[0];
  });

  // Modals state
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [isRbacModalOpen, setIsRbacModalOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isTenantsModalOpen, setIsTenantsModalOpen] = useState<boolean>(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState<boolean>(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState<boolean>(false);
  const [isIndustrialModalOpen, setIsIndustrialModalOpen] = useState<boolean>(false);
  const [selectedLineage, setSelectedLineage] = useState<DataLineageInfo | null>(null);
  const [dbLatencyMs, setDbLatencyMs] = useState<number>(24);

  // Industrial OT Runtime Mode (SIMULATION vs HYBRID vs LIVE_OT)
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>(() => {
    return tenantRuntimeManager.getRuntime(INITIAL_TENANTS[0].id).getMode();
  });

  // Core App State backed by Cloud Firestore
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);

  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(INITIAL_EQUIPMENT);
  const [batches, setBatches] = useState<CaneBatch[]>(INITIAL_BATCHES);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(INITIAL_WORK_ORDERS);
  const [alarms, setAlarms] = useState<AlarmEvent[]>(INITIAL_ALARMS);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [usersList, setUsersList] = useState<UserAccount[]>(PREDEFINED_USERS);
  const [rolesList, setRolesList] = useState<RbacRoleDefinition[]>(DEFAULT_ROLES);

  // Theme state: "dark" (default for industrial SCADA) or "light" (clean daylight mode)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("bioazucar_theme");
    return saved === "light" ? "light" : "dark";
  });

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  useEffect(() => {
    localStorage.setItem("bioazucar_theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Industrial Footer is permanently docked at bottom across all views
  const isFooterPinned = true;

  // Synchronize role change with user account
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    // Find matching predefined user or update current user role
    const matched = PREDEFINED_USERS.find((u) => u.role === newRole);
    if (matched) {
      setCurrentUser(matched);
      setStoredUser(matched);
    } else {
      const updatedUser: UserAccount = {
        ...currentUser,
        role: newRole,
        isSuperAdmin: newRole === "superadmin",
      };
      setCurrentUser(updatedUser);
      setStoredUser(updatedUser);
    }
  };

  const handleUserLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setCurrentRole(user.role);
    // If user belongs to a specific tenant, switch to it unless global superadmin
    if (user.tenantId && user.tenantId !== "GLOBAL" && user.tenantId !== "ALL") {
      const matched = tenants.find((t) => t.id === user.tenantId);
      if (matched) {
        setActiveTenant(matched);
      }
    }
  };

  const handleSelectTenant = (tenant: TenantEnterprise) => {
    setActiveTenant(tenant);
  };

  // Active alarms count for badge
  const activeAlarmsCount = (alarms || []).filter(
    (a) => a.status === "ACTIVE" || (!a.acknowledged && a.status !== "CLEARED")
  ).length;

  // Real-time Firebase Auth session sync
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.email) {
        const cleanEmail = fbUser.email.toLowerCase();
        const matched = PREDEFINED_USERS.find((u) => u.email.toLowerCase() === cleanEmail);
        if (matched) {
          const syncedUser: UserAccount = {
            ...matched,
            id: fbUser.uid,
          };
          setCurrentUser(syncedUser);
          setCurrentRole(syncedUser.role);
          setStoredUser(syncedUser);
        }
      }
    });
    return () => unsubAuth();
  }, []);

  // 1. Initial Firestore Setup & Subscriptions
  useEffect(() => {
    initializeDatabaseIfEmpty();

    const checkPing = async () => {
      const health = await checkDatabaseHealth();
      if (health.latencyMs > 0) {
        setDbLatencyMs(health.latencyMs);
      }
    };
    checkPing();
    const pingInterval = setInterval(checkPing, 10000);

    // Subscribe to tenants list
    const unsubTenants = subscribeToTenants((list) => {
      if (list && list.length > 0) {
        setTenants(list);
        // Ensure active tenant is valid
        setActiveTenant((prev) => {
          const exists = list.find((t) => t.id === prev.id);
          return exists || list[0];
        });
      }
    });

    // Subscribe to users list
    const unsubUsers = subscribeToUsers((list) => {
      if (list && list.length > 0) {
        setUsersList(list);
      }
    });

    // Subscribe to roles list
    const unsubRoles = subscribeToRoles((list) => {
      if (list && list.length > 0) {
        setRolesList(list);
      }
    });

    return () => {
      clearInterval(pingInterval);
      unsubTenants();
      unsubUsers();
      unsubRoles();
    };
  }, []);

  // 2. Multi-Tenant Reactive Data Subscriptions (Scoped to activeTenant.id)
  useEffect(() => {
    const tenantId = activeTenant.id;

    const unsubTelemetry = subscribeToTelemetry(tenantId, (data) => {
      if (data && data.tch) {
        setTelemetry((prev) => ({ ...prev, ...data }));
      }
    });

    const unsubBatches = subscribeToCaneBatches(tenantId, (list) => {
      setBatches(list || []);
    });

    const unsubWorkOrders = subscribeToWorkOrders(tenantId, (list) => {
      setWorkOrders(list || []);
    });

    const unsubEquipment = subscribeToEquipment(tenantId, (list) => {
      setEquipmentList(list || []);
    });

    const unsubAlarms = subscribeToAlarms(tenantId, (list) => {
      setAlarms(list || []);
    });

    const unsubAudit = subscribeToAuditLogs(tenantId, (list) => {
      setAuditLogs(list || []);
    });

    return () => {
      unsubTelemetry();
      unsubBatches();
      unsubWorkOrders();
      unsubEquipment();
      unsubAlarms();
      unsubAudit();
    };
  }, [activeTenant.id]);

  // Sync active tenant's OT runtime mode
  useEffect(() => {
    const runtime = tenantRuntimeManager.getRuntime(activeTenant.id);
    setRuntimeMode(runtime.getMode());
  }, [activeTenant.id]);

  // Handler for changing runtime mode via the IndustrialConnectionModal
  const handleRuntimeModeChange = (newMode: RuntimeMode) => {
    const runtime = tenantRuntimeManager.getRuntime(activeTenant.id);
    runtime.setMode(newMode);
    setRuntimeMode(newMode);
    const snap = runtime.getTelemetrySnapshot();
    setTelemetry((prev) => ({
      ...prev,
      ...snap,
      tenantId: activeTenant.id,
    }));
  };

  // 3. Real-time industrial physics simulation & OT orchestration via TenantRuntime
  useEffect(() => {
    const runtime = tenantRuntimeManager.getRuntime(activeTenant.id);
    runtime.setScenario(scenario);
    runtime.getSimulationRuntime().setSpeedMultiplier(isSimRunning ? speedMultiplier : 0);

    if (runtime.getMode() === "LIVE_OT") {
      const otConfig = runtime.getOTConfig();
      if (!otConfig.connected && !otConfig.isLiveConnection && otConfig.status !== "CONNECTED") {
        setTelemetry((prev) => ({
          ...prev,
          tenantId: activeTenant.id,
          isSimulated: false,
          provenance: "OBSERVED_OT",
          source: "LIVE_OT",
          quality: "BAD",
          simulationScenario: "NORMAL",
        }));
        return;
      }
    }

    if (!isSimRunning || speedMultiplier === 0) return;

    const interval = setInterval(() => {
      const snap = runtime.getTelemetrySnapshot();
      setTelemetry((prev) => ({
        ...prev,
        ...snap,
        tenantId: activeTenant.id,
      }));

      // Dynamically update equipment status based on scenario
      setEquipmentList((prevList) =>
        prevList.map((eq) => {
          if (eq.id.includes("molino-3") || eq.name.includes("Molino 3")) {
            const vib = scenario === "VIBRACION_MOLINO3" ? 4.8 : 2.6;
            return {
              ...eq,
              vibrationRMS: +(vib + (Math.random() * 0.2 - 0.1)).toFixed(2),
              status: vib > eq.vibrationThreshold ? "WARNING" : "RUNNING",
            };
          }
          if (eq.id.includes("caldera-1") || eq.name.includes("Caldera 1")) {
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
  }, [isSimRunning, speedMultiplier, scenario, activeTenant.id, runtimeMode]);

  // Handler to add a new batch (Persists directly to Cloud Firestore with RBAC check)
  const handleAddBatch = async (newBatch: CaneBatch) => {
    const perm = checkRbacPermission(currentRole, "ADD_CANE_BATCH");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    const batchWithTenant = {
      ...newBatch,
      tenantId: activeTenant.id,
    };

    setBatches((prev) => [batchWithTenant, ...prev]);
    try {
      await addCaneBatchToDb(batchWithTenant, currentUser);
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "CREACION_LOTE_CANE",
          module: "LIMS & Recepción Caña",
          targetId: newBatch.batchCode || newBatch.id,
          newValue: `${newBatch.netWeightTons} t | ARE: ${newBatch.areKgPerTon} kg/t`,
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error persisting batch to Firestore:", e);
    }
  };

  // Handler to add a new work order (Persists to Cloud Firestore with RBAC check)
  const handleAddWorkOrder = async (newWO: WorkOrder) => {
    const perm = checkRbacPermission(currentRole, "ADD_WORK_ORDER");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    const woWithTenant = {
      ...newWO,
      tenantId: activeTenant.id,
    };

    setWorkOrders((prev) => [woWithTenant, ...prev]);
    try {
      await addWorkOrderToDb(woWithTenant, currentUser);
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "CREACION_ORDEN_TRABAJO",
          module: "Mantenimiento CMMS",
          targetId: newWO.code || newWO.id,
          newValue: newWO.title || newWO.description,
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error persisting work order to Firestore:", e);
    }
  };

  // Handler to update a work order
  const handleUpdateWorkOrder = async (updatedWO: WorkOrder) => {
    const perm = checkRbacPermission(currentRole, "UPDATE_WORK_ORDER");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    setWorkOrders((prev) => prev.map((wo) => (wo.id === updatedWO.id ? updatedWO : wo)));
    try {
      await updateWorkOrderInDb(updatedWO.id, updatedWO, currentUser);
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "ACTUALIZACION_OT",
          module: "Mantenimiento CMMS",
          targetId: updatedWO.code || updatedWO.id,
          newValue: `Estado: ${updatedWO.status}`,
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error updating work order in Firestore:", e);
    }
  };

  // Handler to acknowledge alarm
  const handleAcknowledgeAlarm = async (alarmId: string) => {
    const perm = checkRbacPermission(currentRole, "ACKNOWLEDGE_ALARM");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    setAlarms((prev) =>
      prev.map((a) => (a.id === alarmId ? { ...a, status: "ACKNOWLEDGED" as const, acknowledged: true } : a))
    );
    try {
      await acknowledgeAlarmInDb(alarmId, currentRole, currentUser);
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "RECONOCIMIENTO_ALARMA_ISA18_2",
          module: "Centro de Alarmas SOE",
          targetId: alarmId,
          newValue: "ACKNOWLEDGED",
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error acknowledging alarm in Firestore:", e);
    }
  };

  // Handler to reset/clear alarm
  const handleClearAlarm = async (alarmId: string) => {
    const perm = checkRbacPermission(currentRole, "CLEAR_ALARM");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    setAlarms((prev) =>
      prev.map((a) => (a.id === alarmId ? { ...a, status: "CLEARED" as const } : a))
    );
    try {
      await clearAlarmInDb(alarmId, currentUser);
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "NORMALIZACION_ALARMA_RST",
          module: "Centro de Alarmas SOE",
          targetId: alarmId,
          newValue: "CLEARED",
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error clearing alarm in Firestore:", e);
    }
  };

  // Handler to update dispatch MW
  const handleDispatchUpdate = async (exportMW: number) => {
    const perm = checkRbacPermission(currentRole, "CHANGE_DISPATCH_MW");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    const updated = {
      ...telemetry,
      powerExportGridMW: exportMW,
      powerGeneratedMW: exportMW + telemetry.powerInternalMW,
    };
    setTelemetry(updated);
    try {
      await saveTelemetrySnapshot(
        {
          powerExportGridMW: exportMW,
          powerGeneratedMW: exportMW + telemetry.powerInternalMW,
        },
        activeTenant.id
      );
      await logAuditEventToDb(
        {
          userRole: currentRole,
          userName: `${currentUser.name} (${currentUser.role})`,
          action: "MODIFICACION_DESPACHO_PPA_MW",
          module: "Cogeneración Eléctrica",
          targetId: "GRID_DISPATCH_SETPOINT",
          previousValue: `${telemetry.powerExportGridMW} MW`,
          newValue: `${exportMW} MW`,
          status: "EXECUTED",
          ipAddress: "192.168.10.45",
        },
        activeTenant.id
      );
    } catch (e) {
      console.error("Error saving dispatch to Firestore:", e);
    }
  };

  // Handler to update setpoints from UNS
  const handleUpdateSetpoint = async (tag: string, value: number) => {
    const perm = checkRbacPermission(currentRole, "MODIFY_SETPOINTS");
    if (!perm.allowed) {
      alert(`Acceso denegado: ${perm.reason}`);
      return;
    }

    if (tag.includes("TCH") || tag.includes("Speed")) {
      setTelemetry((prev) => ({ ...prev, tch: value }));
      await saveTelemetrySnapshot({ tch: value }, activeTenant.id);
    } else if (tag.includes("Pressure")) {
      setTelemetry((prev) => ({ ...prev, boilerPressureHP: value }));
      await saveTelemetrySnapshot({ boilerPressureHP: value }, activeTenant.id);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950 transition-colors duration-200 ${
      theme === "light" ? "light bg-slate-100 text-slate-900" : "dark bg-slate-950 text-slate-100"
    }`}>
      {/* 1. Header (System Status, Multi-Tenant Selector, Simulation Controls, User Profile, RBAC trigger) */}
      <Header
        currentRole={currentRole}
        currentUser={currentUser}
        tenants={tenants}
        activeTenant={activeTenant}
        onSelectTenant={handleSelectTenant}
        onRoleChange={handleRoleChange}
        onOpenRbacModal={() => setIsRbacModalOpen(true)}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onOpenConfigVerification={() => setActiveTab("system_config")}
        onOpenTenantsModal={() => setIsTenantsModalOpen(true)}
        onOpenCreateTenantWizard={() => setIsCreateWizardOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
        onOpenPresentation={() => setActiveTab("presentation")}
        onOpenIndustrialConnectionModal={() => setIsIndustrialModalOpen(true)}
        runtimeMode={runtimeMode}
        telemetry={telemetry}
        scenario={scenario}
        onScenarioChange={setScenario}
        speedMultiplier={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        isSimRunning={isSimRunning}
        onToggleSim={() => setIsSimRunning((prev) => !prev)}
        alarms={alarms}
        theme={theme}
        onToggleTheme={handleToggleTheme}
      />

      {/* 2. Industrial Tab Navigation Bar with Live DB Sync Status */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeAlarmsCount={activeAlarmsCount}
        onOpenDbModal={() => setIsDbModalOpen(true)}
        dbLatencyMs={dbLatencyMs}
        currentUser={currentUser}
        currentRole={currentRole}
        theme={theme}
      />

      {/* 3. Main Operational Viewport */}
      <main className={`flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6 transition-all duration-200 ${
        isFooterPinned ? "pb-12 sm:pb-14" : ""
      }`}>
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

        {activeTab === "agricultural_pda" && (
          <ErrorBoundary fallbackTitle="Error en el Módulo Agronómico (PDA)" theme={theme}>
            <AgriculturalPdaView
              theme={theme}
              currentTenantName={activeTenant.name}
              nominalMillTch={telemetry.tch}
            />
          </ErrorBoundary>
        )}

        {activeTab === "energy_dispatch" && (
          <EnergyDispatch
            telemetry={telemetry}
            currentRole={currentRole}
            onDispatchUpdate={handleDispatchUpdate}
          />
        )}

        {activeTab === "uns_hub" && (
          <UNSHub
            telemetry={telemetry}
            currentRole={currentRole}
            onUpdateSetpoint={handleUpdateSetpoint}
          />
        )}

        {activeTab === "digital_twin" && (
          <DigitalTwin3D
            telemetry={telemetry}
            equipmentList={equipmentList}
            theme={theme}
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
            activeTenant={activeTenant}
            equipmentList={equipmentList}
            alarms={alarms}
            onNavigateToTab={setActiveTab}
            onOpenCopilot={() => setIsCopilotOpen(true)}
          />
        )}

        {activeTab === "enterprises" && (
          <EnterprisesManager
            tenants={tenants}
            activeTenant={activeTenant}
            onSelectTenant={handleSelectTenant}
            currentUser={currentUser}
            onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
            theme={theme}
          />
        )}

        {activeTab === "users_roles" && (
          <UsersAndRolesManager
            users={usersList}
            roles={rolesList}
            tenants={tenants}
            currentUser={currentUser}
            activeTenant={activeTenant}
            onSwitchUser={handleUserLoginSuccess}
          />
        )}

        {activeTab === "system_config" && (
          <SystemConfigVerification
            currentRole={currentRole}
            currentUser={currentUser}
            activeTenant={activeTenant}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === "presentation" && (
          <ExecutivePresentation
            activeTenant={activeTenant}
            telemetry={telemetry}
            equipmentList={equipmentList}
            alarms={alarms}
            onNavigateToTab={setActiveTab}
            onOpenCopilot={() => setIsCopilotOpen(true)}
          />
        )}
      </main>

      {/* 4. Industrial Footer & SCADA Status Bar — Executive Single-Line Responsive Dock */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-40 border-t h-8 sm:h-9 px-2.5 sm:px-4 text-[11px] font-mono transition-all duration-300 backdrop-blur-md ${
          theme === "light"
            ? "bg-white/95 border-slate-300 text-slate-800 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
            : "bg-slate-950/95 border-slate-800/80 text-slate-300 shadow-[0_-2px_12px_rgba(0,0,0,0.3)]"
        } flex items-center justify-between gap-2 sm:gap-4 flex-nowrap whitespace-nowrap overflow-hidden select-none`}
      >
        {/* Left Side: Firestore Live Latency & Active Tenant */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
          {/* Cloud Firestore Status */}
          <button
            type="button"
            onClick={() => setIsDbModalOpen(true)}
            className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 font-bold transition shrink-0"
            title="Ver diagnóstico y estado de sincronización Cloud Firestore"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span className="hidden sm:inline text-slate-700 dark:text-slate-400 font-semibold">Cloud Firestore:</span>
            <span>Conectado</span>
            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-normal">({dbLatencyMs}ms)</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700 shrink-0">|</span>

          {/* Active Enterprise / Tenant with graceful truncation */}
          <div className="flex items-center gap-1.5 min-w-0 overflow-hidden text-slate-800 dark:text-slate-200">
            <span className="hidden md:inline text-slate-600 dark:text-slate-400 shrink-0 font-medium">Empresa:</span>
            <span className="text-cyan-950 dark:text-cyan-400 font-bold truncate">
              {activeTenant.name}
            </span>
            <span className="hidden lg:inline text-slate-600 dark:text-slate-400 shrink-0 font-medium">
              ({activeTenant.code})
            </span>
            <span className="hidden xl:inline text-slate-600 dark:text-slate-400 shrink-0 font-normal">
              • Capacidad: {activeTenant.nominalTch} TCH / {activeTenant.powerCapacityMW} MW
            </span>
          </div>
        </div>

        {/* Right Side: Prometheus / OpenMetrics & Industrial Standards */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Prometheus Metrics Scrape Endpoint quick badge */}
          <button
            type="button"
            onClick={() => setIsIndustrialModalOpen(true)}
            className="flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 font-bold transition shrink-0"
            title="Ver estado de pasarelas industriales y métricas de Prometheus (/metrics)"
          >
            <Activity className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0 animate-pulse" />
            <span className="hidden sm:inline text-slate-700 dark:text-slate-400 font-medium">Prometheus:</span>
            <span className="bg-indigo-100 dark:bg-indigo-950/70 text-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded font-bold border border-indigo-300 dark:border-indigo-800 text-[10px]">
              /metrics:3000
            </span>
          </button>

          <span className="hidden lg:inline text-slate-300 dark:text-slate-700">|</span>

          <span className="hidden 2xl:inline text-slate-700 dark:text-slate-400 text-[10px] font-medium">
            BioAzúcar 4.0 Suite
          </span>
          <span className="hidden lg:inline text-slate-600 dark:text-slate-400 text-[10px] font-semibold">
            ISA-95 • ISA-18.2 • ASME PTC 4 • IEC 62443 SL-3
          </span>
        </div>
      </footer>

      {/* 5. Modals Rendered Cleanly at Top Hierarchy */}
      <DatabaseSyncModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        currentRole={currentRole}
      />

      <RbacSecurityModal
        isOpen={isRbacModalOpen}
        onClose={() => setIsRbacModalOpen(false)}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={handleUserLoginSuccess}
        onLogout={async () => {
          await signOutFirebase();
          const guestUser = PREDEFINED_USERS.find((u) => u.role === "operador") || PREDEFINED_USERS[3];
          setCurrentUser(guestUser);
          setCurrentRole(guestUser.role);
          setStoredUser(guestUser);
          setIsAuthModalOpen(false);
        }}
      />

      {/* AI-Assisted Central Provisioning Wizard */}
      <CentralProvisioningWizard
        isOpen={isCreateWizardOpen}
        onClose={() => setIsCreateWizardOpen(false)}
        currentUser={currentUser}
        onSuccess={(newTenant) => {
          handleSelectTenant(newTenant);
          setIsCreateWizardOpen(false);
          setIsTenantsModalOpen(false);
        }}
        theme={theme}
      />

      {/* Quick Modal for Superadmin Enterprise Management */}
      {isTenantsModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-slate-900 dark:text-slate-100">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-tech">Administrador de Empresas & Multi-Tenant</h2>
              <button
                onClick={() => setIsTenantsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <EnterprisesManager
              tenants={tenants}
              currentUser={currentUser}
              activeTenant={activeTenant}
              theme={theme}
              onOpenCreateWizard={() => {
                setIsTenantsModalOpen(false);
                setIsCreateWizardOpen(true);
              }}
              onSelectTenant={(t) => {
                handleSelectTenant(t);
                setIsTenantsModalOpen(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 6. Data Lineage Modal */}
      <DataLineageModal
        lineage={selectedLineage}
        onClose={() => setSelectedLineage(null)}
      />

      {/* 7. BioAzúcar Copilot — Industrial AI Assistant */}
      <BioAzucarCopilot
        isOpen={isCopilotOpen}
        onToggleOpen={() => setIsCopilotOpen((prev) => !prev)}
        currentUser={currentUser}
        currentRole={currentRole}
        activeTenant={activeTenant}
        activeTab={activeTab}
        telemetry={telemetry}
        alarms={alarms}
        equipmentList={equipmentList}
        onNavigate={(tab) => {
          setActiveTab(tab);
        }}
        onOpenLineageModal={(lineage) => {
          setSelectedLineage(lineage);
        }}
        onAcknowledgeAlarm={handleAcknowledgeAlarm}
        onUpdateSetpoint={handleUpdateSetpoint}
        onDispatchUpdate={handleDispatchUpdate}
        isFooterPinned={isFooterPinned}
      />

      {/* 8. Industrial OT Connection & Provenance Gateway Modal */}
      <IndustrialConnectionModal
        isOpen={isIndustrialModalOpen}
        onClose={() => setIsIndustrialModalOpen(false)}
        activeTenant={activeTenant}
        currentMode={runtimeMode}
        onModeChange={handleRuntimeModeChange}
        telemetry={telemetry}
        theme={theme}
      />
    </div>
  );
}
