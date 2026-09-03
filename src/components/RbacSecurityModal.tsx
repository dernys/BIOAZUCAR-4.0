import React, { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Key,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  AlertTriangle,
  Server,
  Activity,
  Layers,
  Sparkles,
  ExternalLink,
  Zap,
  Play,
  RotateCcw,
  Crown
} from "lucide-react";
import { UserRole, AuditLogEntry } from "../types";
import { INITIAL_RBAC_ROLES, INITIAL_AUDIT_LOGS } from "../data/mockIndustrialData";
import {
  checkRbacPermission,
  getRoleBadgeInfo,
  RbacAction,
  RBAC_RULES,
} from "../services/rbacService";
import { subscribeToAuditLogs } from "../services/dbService";

interface RbacSecurityModalProps {
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const RbacSecurityModal: React.FC<RbacSecurityModalProps> = ({
  currentRole,
  onRoleChange,
  isOpen,
  onClose,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<"MATRIX" | "SIMULATOR" | "AUDIT" | "SSO_ARCHITECTURE">("MATRIX");
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(INITIAL_AUDIT_LOGS);
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [testAction, setTestAction] = useState<RbacAction>("ADD_CANE_BATCH");

  useEffect(() => {
    if (isOpen) {
      const unsubscribe = subscribeToAuditLogs((logs) => {
        if (logs && logs.length > 0) {
          setAuditLogs(logs);
        }
      });
      return () => unsubscribe();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentRoleDef = INITIAL_RBAC_ROLES.find((r) => r.role === currentRole) || INITIAL_RBAC_ROLES[0];
  const roleBadge = getRoleBadgeInfo(currentRole);
  const simulatedPermission = checkRbacPermission(currentRole, testAction);
  const testRule = RBAC_RULES[testAction] || {
    allowedRoles: ["administrador", "superadmin"],
    description: "Acción de control",
    minClearance: 4,
    module: "Sistema",
  };

  const filteredLogs = auditLogs.filter(
    (log) => filterRole === "ALL" || log.userRole === filterRole
  );

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 border border-purple-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white font-tech uppercase tracking-wide">
                  Seguridad Industrial & Control de Acceso RBAC
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  IEC 62443-3-3 COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                Matriz de privilegios de planta, trazabilidad inmutable y validación de seguridad de operaciones OT
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

        {/* User Role Quick Switcher & Active Clearance Banner */}
        <div className="p-4 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Rol Activo en Sesión:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {INITIAL_RBAC_ROLES.map((r) => {
                const isActive = r.role === currentRole;
                const isSuper = r.role === "superadmin";
                return (
                  <button
                    key={r.role}
                    onClick={() => onRoleChange(r.role)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      isActive
                        ? `${r.badgeColor} ring-1 ring-white/20 shadow-md`
                        : "bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800"
                    }`}
                  >
                    {isSuper && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    <span className="capitalize">{r.role}</span>
                    {isActive && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500">Nivel de Seguridad: </span>
              <span className="text-amber-400 font-bold">Nivel {currentRoleDef.securityClearanceLevel} ({currentRole === "superadmin" ? "Root Global" : "SIL-2/3"})</span>
            </div>
            <div className="bg-slate-900 px-3 py-1 rounded-lg border border-slate-800 text-slate-300">
              <span className="text-slate-500">Token JWT: </span>
              <span className="text-emerald-400 font-bold">mTLS Validado</span>
            </div>
          </div>
        </div>

        {/* Sub Navigation Tabs */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900 text-xs">
          <button
            onClick={() => setActiveSubTab("MATRIX")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "MATRIX"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Matriz de Privilegios
          </button>
          <button
            onClick={() => setActiveSubTab("SIMULATOR")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "SIMULATOR"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Simulador de Clearance OT
          </button>
          <button
            onClick={() => setActiveSubTab("AUDIT")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "AUDIT"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Registro de Auditoría ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveSubTab("SSO_ARCHITECTURE")}
            className={`pb-2.5 px-3 font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeSubTab === "SSO_ARCHITECTURE"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Integración OT/IT
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs scrollbar-thin">
          {/* TAB 1: PERMISSION MATRIX */}
          {activeSubTab === "MATRIX" && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-white uppercase">
                    Capacidades del Rol Actual ({currentRoleDef.title})
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mb-3 font-sans">{currentRoleDef.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${currentRoleDef.canWriteSetpoints ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                    <span>Escritura Setpoints</span>
                    {currentRoleDef.canWriteSetpoints ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${currentRoleDef.canChangeDispatchMW ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                    <span>Despacho Eléctrico MW</span>
                    {currentRoleDef.canChangeDispatchMW ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${currentRoleDef.canApproveWorkOrders ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                    <span>Aprobar OTs Mantenimiento</span>
                    {currentRoleDef.canApproveWorkOrders ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                  <div className={`p-2.5 rounded-lg border flex items-center justify-between ${currentRoleDef.canShelveAlarms ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-300" : "bg-slate-900 border-slate-800 text-slate-500"}`}>
                    <span>Silenciar Alarmas (Shelve)</span>
                    {currentRoleDef.canShelveAlarms ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-500" />}
                  </div>
                </div>
              </div>

              {/* Complete RBAC Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Operación Crítica de Planta</th>
                      <th className="p-3 text-center text-amber-300">Superadmin</th>
                      <th className="p-3 text-center">Administrador</th>
                      <th className="p-3 text-center">Supervisor</th>
                      <th className="p-3 text-center">Operador DCS</th>
                      <th className="p-3 text-center">Mantenimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    <tr>
                      <td className="p-3 font-sans">Registro de Caña Báscula & Core Sampler</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Modulación de Molienda TCH & Imbibición</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-cyan-400 font-bold">✓ ±5% Rango</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Fijación de Despacho MW & Contrato Spot</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✗ Solo Lectura</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Reconocimiento (ACK) de Alarmas ISA-18.2</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Normalizar (RST) y Silenciar Alarmas</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✗ Requiere Sup.</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Crear / Actualizar Órdenes de Mantenimiento</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-cyan-400 font-bold">✓ Solo Crear</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Diagnóstico/Ejecución</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-sans">Configuración Global & Restablecer Base de Datos</td>
                      <td className="p-3 text-center text-amber-300 font-bold">✓ Root Global</td>
                      <td className="p-3 text-center text-emerald-400 font-bold">✓ Total</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                      <td className="p-3 text-center text-slate-600">✗ Bloqueado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: RBAC PERMISSION SIMULATOR */}
          {activeSubTab === "SIMULATOR" && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-bold uppercase">Evaluador de Autorización en Tiempo Real</span>
                  </div>
                  <span className="text-slate-400">Rol Evaluado: <strong className="text-emerald-300 uppercase">{currentRole}</strong></span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Selecciona cualquier acción de escritura del sistema para probar en tiempo real la respuesta de la capa RBAC y Firestore Security Rules.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Acción de Planta a Evaluar:</label>
                    <select
                      value={testAction}
                      onChange={(e) => setTestAction(e.target.value as RbacAction)}
                      className="w-full bg-slate-900 text-xs text-slate-200 p-2.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="ADD_CANE_BATCH">addCaneBatchToDb (Registrar Lote de Caña)</option>
                      <option value="UPDATE_CANE_BATCH">updateCaneBatchInDb (Modificar LIMS / ARE)</option>
                      <option value="DELETE_CANE_BATCH">deleteCaneBatch (Eliminar Lote Caña)</option>
                      <option value="UPDATE_WORK_ORDER">updateWorkOrderInDb (Actualizar/Cerrar OT CMMS)</option>
                      <option value="ADD_WORK_ORDER">addWorkOrderToDb (Crear Orden de Trabajo)</option>
                      <option value="APPROVE_WORK_ORDER">approveWorkOrder (Aprobar y Validar OT)</option>
                      <option value="CHANGE_DISPATCH_MW">changeDispatchMW (Fijar Despacho a Red)</option>
                      <option value="MODIFY_SETPOINTS">modifySetpoints (Escribir Consignas PID)</option>
                      <option value="ACKNOWLEDGE_ALARM">acknowledgeAlarm (Reconocer Alarma ACK)</option>
                      <option value="CLEAR_ALARM">clearAlarm (Normalizar Alarma RST)</option>
                      <option value="SHELVE_ALARM">shelveAlarm (Silenciar Alarma)</option>
                      <option value="RESET_DATABASE">resetDatabase (Restablecer Colecciones)</option>
                      <option value="EXPORT_HISTORIAN">exportHistorian (Descargar Series Temporales)</option>
                    </select>
                  </div>

                  <div className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                    simulatedPermission.allowed
                      ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                      : "bg-rose-950/30 border-rose-500/40 text-rose-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      {simulatedPermission.allowed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <span className="font-bold uppercase tracking-wider">
                        {simulatedPermission.allowed ? "ACCESO AUTORIZADO (200 OK)" : "ACCESO DENEGADO (403 FORBIDDEN)"}
                      </span>
                    </div>

                    <p className="text-[11px] font-sans mt-2">
                      {simulatedPermission.allowed
                        ? currentRole === "superadmin"
                          ? "Superadmin posee autorización global irrestricta en todos los subsistemas."
                          : `El rol '${currentRole.toUpperCase()}' cumple con los requisitos del módulo '${testRule.module}'.`
                        : simulatedPermission.reason}
                    </p>

                    <div className="mt-2 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Nivel Mínimo: {testRule.minClearance}</span>
                      <span>Roles Válidos: {testRule.allowedRoles.join(", ")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT LOG */}
          {activeSubTab === "AUDIT" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-sans">
                  Registro inmutable de transacciones, ejecuciones y denegaciones de seguridad (IEC 62443 Audit Trail)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Filtrar:</span>
                  <select
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                    className="bg-slate-950 text-xs text-slate-200 px-2.5 py-1 rounded-lg border border-slate-700 focus:outline-none"
                  >
                    <option value="ALL">Todos los roles</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="administrador">Administrador</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="operador">Operador DCS</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2.5">Timestamp</th>
                      <th className="p-2.5">Usuario & Rol</th>
                      <th className="p-2.5">Acción / Módulo</th>
                      <th className="p-2.5">Detalle Modificación</th>
                      <th className="p-2.5 text-center">Estado</th>
                      <th className="p-2.5">IP Origen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-900/40 transition">
                        <td className="p-2.5 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                        <td className="p-2.5">
                          <div className="text-white font-bold">{log.userName}</div>
                          <div className="text-[10px] text-slate-500 capitalize">{log.userRole}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="text-cyan-300 font-semibold">{log.action}</div>
                          <div className="text-[10px] text-slate-400">{log.module}</div>
                        </td>
                        <td className="p-2.5">
                          <span className="text-slate-400">{log.previousValue}</span>
                          {log.previousValue && <span className="text-slate-600 mx-1">→</span>}
                          <span className="text-emerald-400 font-bold">{log.newValue}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === "AUTHORIZED" || log.status === "EXECUTED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-500 text-[11px]">{log.ipAddress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: SSO & REAL ENTERPRISE INTEGRATION */}
          {activeSubTab === "SSO_ARCHITECTURE" && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <Users className="w-4 h-4" />
                    Identity Provider (IdP)
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                    Soporte para Microsoft Entra ID (Azure AD), Keycloak OpenID Connect y Okta con tokens firmados RS256.
                  </p>
                  <span className="inline-block text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                    SAML 2.0 / OIDC
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Lock className="w-4 h-4" />
                    mTLS Industrial Gateway
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                    Certificados X.509 de cliente/servidor con cifrado AES-256 para comunicación bidireccional SCADA/UNS.
                  </p>
                  <span className="inline-block text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                    TLS 1.3 / OPC UA Security
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                    <Server className="w-4 h-4" />
                    Zona DMZ & Firewall OT
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed font-sans">
                    Segmentación Purdue Model Nivel 3.5 con proxy inverso NGINX y broker MQTT aislado de Internet pública.
                  </p>
                  <span className="inline-block text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                    IEC 62443 Conduit Zone
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold uppercase">Cadena de Integración y Flujo de Autenticación</span>
                  <span className="text-emerald-400 font-bold text-[11px]">JWT Activo: expira en 07h 42m</span>
                </div>
                <div className="p-3 bg-slate-900 rounded-lg text-slate-300 font-mono text-[11px] space-y-1">
                  <div>1. Operador inicia sesión en HMI / Panel Web $\rightarrow$ Redirige a IdP corporativo (Azure AD / Keycloak).</div>
                  <div>2. IdP emite token JWT con claims `roles: ["SUPERVISOR_TURNO", "DISPATCH_AUTHORITY"]`.</div>
                  <div>3. API Gateway valida firma pública RSA, verifica IP en lista blanca de subred OT y autoriza endpoint.</div>
                  <div>4. Cada acción de escritura en PLC genera evento firmado en el Log de Auditoría con hash criptográfico SHA-256.</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            BioAzúcar 4.0 RBAC Security Module • Cifrado AES-256 GCM • IEC 62443-3-3
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shadow-lg shadow-emerald-500/20"
          >
            Aceptar & Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
