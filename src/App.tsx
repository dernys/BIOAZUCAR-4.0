import React, { useState, useEffect } from "react";
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
import { INITIAL_AUDIT_LOGS, INITIAL_TELEMETRY } from "./data/mockIndustrialData";
import { updateTelemetry } from "./services/simulationEngine";
import { dataProviderRegistry } from "./services/dataProviders/DataProviderRegistry";
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
import { getStoredUser, setStoredUser, PREDEFINED_USERS } from "./services/authService";
import { checkRbacPermission, DEFAULT_ROLES } from "./services/rbacService";

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
  const [selectedLineage, setSelectedLineage] = useState<DataLineageInfo | null>(null);
  const [dbLatencyMs, setDbLatencyMs] = useState<number>(24);

  // Core App State backed by Cloud Firestore
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);

  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [batches, setBatches] = useState<CaneBatch[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [alarms, setAlarms] = useState<AlarmEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [usersList, setUsersList] = useState<UserAccount[]>(PREDEFINED_USERS);
  const [rolesList, setRolesList] = useState<RbacRoleDefinition[]>(DEFAULT_ROLES);

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

  // 3. Real-time industrial physics simulation loop via Canonical DataProvider
  useEffect(() => {
    const simProvider = dataProviderRegistry.getSimulationProvider();
    simProvider.setScenario(scenario);
    simProvider.setSpeedMultiplier(isSimRunning ? speedMultiplier : 0);

    if (!isSimRunning || speedMultiplier === 0) return;

    const interval = setInterval(() => {
      const snap = simProvider.getTelemetrySnapshot();
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
  }, [isSimRunning, speedMultiplier, scenario, activeTenant.id]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
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
        scenario={scenario}
        onScenarioChange={setScenario}
        speedMultiplier={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        isSimRunning={isSimRunning}
        onToggleSim={() => setIsSimRunning((prev) => !prev)}
        alarms={alarms}
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
      />

      {/* 3. Main Operational Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-6 space-y-6">
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

        {activeTab === "enterprises" && (
          <EnterprisesManager
            tenants={tenants}
            activeTenant={activeTenant}
            onSelectTenant={handleSelectTenant}
            currentUser={currentUser}
            onOpenCreateWizard={() => setIsCreateWizardOpen(true)}
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
      </main>

      {/* 4. Industrial Footer & SCADA Status Bar */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-3 px-4 sm:px-6 text-xs text-slate-500 font-mono flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDbModalOpen(true)}
            className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Cloud Firestore: Conectado ({dbLatencyMs}ms)</span>
          </button>
          <span className="hidden sm:inline text-slate-600">|</span>
          <span className="hidden sm:inline text-slate-400">
            Empresa Activa: <strong className="text-cyan-400">{activeTenant.name} ({activeTenant.code})</strong> • Capacidad: {activeTenant.nominalTch} TCH / {activeTenant.powerCapacityMW} MW
          </span>
        </div>
        <div>
          <span>BioAzúcar 4.0 Multi-Tenant Suite • IEC 62443 SL-3</span>
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
        onLogout={() => {
          handleRoleChange("observador");
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
      />

      {/* Quick Modal for Superadmin Enterprise Management */}
      {isTenantsModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white font-tech">Administrador de Empresas & Multi-Tenant</h2>
              <button
                onClick={() => setIsTenantsModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <EnterprisesManager
              tenants={tenants}
              currentUser={currentUser}
              activeTenant={activeTenant}
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
      />
    </div>
  );
}
