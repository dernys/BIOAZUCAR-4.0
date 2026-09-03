import React, { useState, useEffect, useMemo } from "react";
import {
  Database,
  CheckCircle2,
  RefreshCw,
  Server,
  Activity,
  Layers,
  Wrench,
  ShieldAlert,
  Clock,
  Zap,
  ArrowUpRight,
  HardDrive,
  Cpu,
  Trash2,
  Plus,
  Lock,
  ShieldCheck,
  AlertTriangle,
  FileText,
} from "lucide-react";
import {
  checkDatabaseHealth,
  DatabaseHealthInfo,
  resetDatabaseToFactoryRealData,
  addCaneBatchToDb,
  addWorkOrderToDb,
  logAuditEventToDb,
} from "../services/dbService";
import { CaneBatch, WorkOrder, UserRole } from "../types";
import { checkRbacPermission, getRoleBadgeInfo } from "../services/rbacService";

interface DatabaseSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

export const DatabaseSyncModal: React.FC<DatabaseSyncModalProps> = ({
  isOpen,
  onClose,
  currentRole,
}) => {
  const [dbHealth, setDbHealth] = useState<DatabaseHealthInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const rbacReset = useMemo(
    () => checkRbacPermission(currentRole, "RESET_DATABASE"),
    [currentRole]
  );
  const rbacBatch = useMemo(
    () => checkRbacPermission(currentRole, "ADD_CANE_BATCH"),
    [currentRole]
  );
  const roleBadge = getRoleBadgeInfo(currentRole);

  const fetchHealth = async () => {
    setIsLoading(true);
    const health = await checkDatabaseHealth();
    setDbHealth(health);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
      const interval = setInterval(fetchHealth, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateQuickBatch = async () => {
    if (!rbacBatch.allowed) {
      setActionMessage({
        type: "error",
        text: `Acceso denegado: El rol '${currentRole.toUpperCase()}' no tiene permisos para insertar lotes de caña.`,
      });
      setTimeout(() => setActionMessage(null), 4000);
      return;
    }

    try {
      const randomTon = +(45 + Math.random() * 25).toFixed(1);
      const randomBrix = +(18.5 + Math.random() * 3.5).toFixed(2);
      const randomPol = +(15.0 + Math.random() * 3.0).toFixed(2);
      const purity = +((randomPol / randomBrix) * 100).toFixed(1);
      const are = +(randomPol * 10.2 - 20.5).toFixed(1);
      const batchCode = `LOT-REAL-${Math.floor(1000 + Math.random() * 9000)}`;

      const newBatch: CaneBatch = {
        id: `bat-${Date.now()}`,
        batchCode,
        truckPlate: `TRK-${Math.floor(1000 + Math.random() * 9000)}`,
        farmOrigin: "Hacienda El Porvenir - Tablón 04",
        growerName: "Agropecuaria Central S.A.",
        caneVariety: "CP 72-2086",
        grossWeightTons: +(randomTon + 18).toFixed(1),
        tareWeightTons: 18.0,
        netWeightTons: randomTon,
        brixPercent: randomBrix,
        polPercent: randomPol,
        purityPercent: purity,
        fiberPercent: 13.5,
        trashPercent: +(3.0 + Math.random() * 2).toFixed(1),
        dextranPpm: 120,
        areKgPerTon: are,
        canePaymentIndexUSD: +(are * 0.38).toFixed(2),
        cutDateTime: new Date(Date.now() - 3600000 * 3).toISOString().slice(0, 16).replace("T", " "),
        arrivalDateTime: new Date().toISOString().slice(0, 16).replace("T", " "),
        status: "EN_MUESTREO",
        sugarYieldEstimated: +(randomTon * (are / 1000)).toFixed(2),
      };

      await addCaneBatchToDb(newBatch, currentRole);
      await logAuditEventToDb({
        userRole: currentRole,
        userName: `Usuario (${currentRole.toUpperCase()})`,
        action: "REGISTRO_LOTE_FIRESTORE",
        module: "LIMS & Recepción",
        targetId: newBatch.batchCode,
        newValue: `${newBatch.netWeightTons} t / ARE ${newBatch.areKgPerTon} kg/t`,
        status: "EXECUTED",
        ipAddress: "192.168.10.24",
      });

      setActionMessage({
        type: "success",
        text: `Lote ${newBatch.batchCode} insertado exitosamente en Cloud Firestore`,
      });
      setTimeout(() => setActionMessage(null), 4000);
      fetchHealth();
    } catch (e: any) {
      console.error(e);
      setActionMessage({
        type: "error",
        text: e.message || "Error al insertar en base de datos",
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleResetFactory = async () => {
    if (!rbacReset.allowed) {
      setActionMessage({
        type: "error",
        text: `Acceso denegado: El rol '${currentRole.toUpperCase()}' no puede restablecer la base de datos. Se requiere rol 'Administrador'.`,
      });
      setShowConfirmReset(false);
      setTimeout(() => setActionMessage(null), 4000);
      return;
    }

    setIsResetting(true);
    try {
      await resetDatabaseToFactoryRealData(currentRole);
      await logAuditEventToDb({
        userRole: currentRole,
        userName: `Admin (${currentRole.toUpperCase()})`,
        action: "RESTABLECER_BD_FABRICA",
        module: "Firestore Database Engine",
        targetId: "GLOBAL_RESTORE",
        newValue: "Factory Initial State",
        status: "EXECUTED",
        ipAddress: "192.168.10.1",
      });
      setActionMessage({
        type: "success",
        text: "Base de datos Firestore restablecida con datos base de zafra",
      });
      setTimeout(() => setActionMessage(null), 4000);
      setShowConfirmReset(false);
      fetchHealth();
    } catch (e: any) {
      console.error(e);
      setActionMessage({
        type: "error",
        text: e.message || "Error al restablecer base de datos",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-tech uppercase tracking-wide">
                  Motor de Datos Cloud Firestore
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  REAL-TIME SYNC
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Monitor de persistencia, sincronización bidireccional y telemetría de latencia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs transition"
          >
            ✕
          </button>
        </div>

        {/* User Role & Health Status Banner */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Usuario Activo:</span>
            <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${roleBadge.color}`}>
              {roleBadge.label} ({roleBadge.clearance})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-emerald-400 font-bold">ONLINE</span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300">{dbHealth?.latencyMs || 28} ms</span>
            </div>

            <button
              onClick={fetchHealth}
              disabled={isLoading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refrescar estado de colecciones"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Message Banner */}
        {actionMessage && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl border text-xs flex items-center gap-2 ${
              actionMessage.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-sans">{actionMessage.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Firestore Connection Info Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                <Server className="w-4 h-4" /> Parámetros de Instancia Firestore
              </span>
              <span className="text-[10px] text-slate-500">Sincronizado: {dbHealth?.lastSyncTime || "Ahora"}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 block text-[10px]">Database ID:</span>
                <span className="text-white font-bold truncate block">{dbHealth?.databaseId || "ai-studio-bioazcar40smartm-7390a107"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Project ID:</span>
                <span className="text-white font-bold truncate block">{dbHealth?.projectId || "gen-lang-client-0176485490"}</span>
              </div>
            </div>
          </div>

          {/* Real-time Collections Statistics */}
          <div className="space-y-2">
            <span className="text-slate-400 font-bold block text-[11px]">Colecciones Activas en la Nube:</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">cane_batches</span>
                <span className="text-lg font-bold text-emerald-400">{dbHealth?.batchesCount ?? 0}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Lotes Recepción</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">work_orders</span>
                <span className="text-lg font-bold text-cyan-400">{dbHealth?.workOrdersCount ?? 0}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Órdenes CMMS</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">equipment</span>
                <span className="text-lg font-bold text-amber-400">{dbHealth?.equipmentCount ?? 0}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Activos Industriales</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">alarms</span>
                <span className="text-lg font-bold text-rose-400">{dbHealth?.alarmsCount ?? 0}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Alarmas ISA-18.2</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">audit_logs</span>
                <span className="text-lg font-bold text-purple-400">{dbHealth?.auditLogsCount ?? 0}</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Registros Auditoría</span>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-slate-500 block text-[10px]">telemetry</span>
                <span className="text-lg font-bold text-emerald-400">1</span>
                <span className="text-[9px] text-slate-400 block mt-0.5">Snapshot En Tiempo Real</span>
              </div>
            </div>
          </div>

          {/* Quick Database Test Actions */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <span className="text-slate-400 font-bold block text-[11px]">Acciones de Prueba & Mantenimiento:</span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleCreateQuickBatch}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition shadow-md ${
                  rbacBatch.allowed
                    ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-500/40"
                }`}
                title={rbacBatch.allowed ? "Insertar registro de prueba" : rbacBatch.reason}
              >
                {rbacBatch.allowed ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                <span>Insertar Lote de Prueba en Firestore</span>
              </button>

              {!showConfirmReset ? (
                <button
                  onClick={() => setShowConfirmReset(true)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                    rbacReset.allowed
                      ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  }`}
                  title={rbacReset.allowed ? "Restablecer a fábrica" : rbacReset.reason}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Restablecer Colecciones de Fábrica</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-rose-950/40 p-1.5 rounded-lg border border-rose-500/40">
                  <span className="text-[11px] text-rose-300">¿Confirmar reinicio?</span>
                  <button
                    onClick={handleResetFactory}
                    disabled={isResetting}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
                  >
                    {isResetting ? "Reiniciando..." : "Sí, Restablecer"}
                  </button>
                  <button
                    onClick={() => setShowConfirmReset(false)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-[10px] text-slate-500">
            Cloud Firestore v11.x • Motor NoSQL de Alta Disponibilidad
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
