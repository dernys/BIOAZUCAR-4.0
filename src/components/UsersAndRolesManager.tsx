import React, { useState } from "react";
import {
  Users,
  Shield,
  Key,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Unlock,
  Building,
  Mail,
  Phone,
  Layers,
  Search,
  Filter,
  Eye,
  EyeOff,
  Save,
  X,
  RefreshCw,
  Sliders,
  Check,
  Award,
  FileText,
  UserCheck,
  Zap,
  Activity,
  Cpu
} from "lucide-react";
import { UserAccount, RbacRoleDefinition, UserRole, TenantEnterprise } from "../types";
import {
  createUserInDb,
  updateUserInDb,
  deleteUserInDb,
  createRoleInDb,
  updateRoleInDb,
  deleteRoleInDb,
} from "../services/dbService";
import { RBAC_RULES, getRoleBadgeInfo, RbacAction } from "../services/rbacService";

interface UsersAndRolesManagerProps {
  users?: UserAccount[];
  roles?: RbacRoleDefinition[];
  tenants?: TenantEnterprise[];
  currentUser: UserAccount;
  activeTenant?: TenantEnterprise;
  onSwitchUser?: (user: UserAccount) => void;
}

export const UsersAndRolesManager: React.FC<UsersAndRolesManagerProps> = ({
  users = [],
  roles = [],
  tenants = [],
  currentUser,
  activeTenant,
  onSwitchUser,
}) => {
  const [activeTab, setActiveTab] = useState<"users" | "roles" | "matrix">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");

  // Feedback State
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // User Modals State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [userFormData, setUserFormData] = useState<Omit<UserAccount, "id">>({
    name: "",
    email: "",
    password: "",
    role: "operador",
    securityLevel: "SIL-1",
    department: "Operaciones DCS",
    badgeNumber: "DCS-000",
    phone: "+58 255 000-0000",
    isSuperAdmin: false,
    isActive: true,
    tenantId: "tenant-bioazucar-01",
  });

  // Role Modals State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRoleDefinition | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [roleFormData, setRoleFormData] = useState<Omit<RbacRoleDefinition, "id">>({
    role: "operador" as UserRole,
    title: "",
    description: "",
    badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    securityClearanceLevel: 2,
    canWriteSetpoints: false,
    canAcknowledgeAlarms: true,
    canShelveAlarms: false,
    canCreateWorkOrders: true,
    canApproveWorkOrders: false,
    canChangeDispatchMW: false,
    canExportHistorian: false,
    canAddCaneBatches: true,
    canModifyPlantParams: false,
    canAccessAiCenter: false,
    canManageTenants: false,
    canManageUsers: false,
    isSystem: false,
    tenantId: "GLOBAL",
  });

  const isSuperAdmin = currentUser.isSuperAdmin || currentUser.role === "superadmin";

  // ----------------------------------------------------
  // USER HANDLERS
  // ----------------------------------------------------

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: "",
      email: "",
      password: "User" + Math.floor(1000 + Math.random() * 9000) + "*",
      role: "operador",
      securityLevel: "SIL-1",
      department: "Operaciones DCS",
      badgeNumber: "DCS-" + Math.floor(100 + Math.random() * 900),
      phone: "+58 255 " + Math.floor(100 + Math.random() * 900) + "-" + Math.floor(1000 + Math.random() * 9000),
      isSuperAdmin: false,
      isActive: true,
      tenantId: currentUser.tenantId || "tenant-bioazucar-01",
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setUserFormData({
      name: u.name,
      email: u.email,
      password: (u as any).password || (u as any).passwordHash || "••••••••",
      role: u.role,
      securityLevel: u.securityLevel,
      department: u.department,
      badgeNumber: u.badgeCode || (u as any).badgeNumber || "",
      phone: u.phone,
      isSuperAdmin: !!u.isSuperAdmin,
      isActive: u.isActive !== undefined ? u.isActive : true,
      tenantId: u.tenantId || "tenant-bioazucar-01",
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingUser) {
        await updateUserInDb(editingUser.id, userFormData, currentUser);
        setFeedback({ text: `Usuario "${userFormData.name}" actualizado exitosamente.`, type: "success" });
      } else {
        await createUserInDb(userFormData, currentUser);
        setFeedback({ text: `Usuario "${userFormData.name}" creado exitosamente en Cloud Firestore.`, type: "success" });
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al procesar usuario.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsProcessing(true);
    try {
      await deleteUserInDb(userId, currentUser);
      setFeedback({ text: "Usuario eliminado correctamente.", type: "success" });
      setDeletingUserId(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar usuario.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleToggleUserStatus = async (user: UserAccount) => {
    try {
      const nextStatus = !user.isActive;
      await updateUserInDb(user.id, { isActive: nextStatus }, currentUser);
      setFeedback({
        text: `Estado de ${user.name} cambiado a ${nextStatus ? "ACTIVO" : "INACTIVO"}.`,
        type: "success",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al cambiar estado.", type: "error" });
    }
  };

  // ----------------------------------------------------
  // ROLE HANDLERS
  // ----------------------------------------------------

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      role: ("rol_custom_" + Date.now().toString().slice(-4)) as UserRole,
      title: "",
      description: "",
      badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
      securityClearanceLevel: 2,
      canWriteSetpoints: false,
      canAcknowledgeAlarms: true,
      canShelveAlarms: false,
      canCreateWorkOrders: true,
      canApproveWorkOrders: false,
      canChangeDispatchMW: false,
      canExportHistorian: true,
      canAddCaneBatches: false,
      canModifyPlantParams: false,
      canAccessAiCenter: true,
      canManageTenants: false,
      canManageUsers: false,
      isSystem: false,
      tenantId: "GLOBAL",
    });
    setIsRoleModalOpen(true);
  };

  const handleOpenEditRole = (r: RbacRoleDefinition) => {
    setEditingRole(r);
    setRoleFormData({
      role: r.role,
      title: r.title,
      description: r.description,
      badgeColor: r.badgeColor,
      securityClearanceLevel: r.securityClearanceLevel,
      canWriteSetpoints: !!r.canWriteSetpoints,
      canAcknowledgeAlarms: !!r.canAcknowledgeAlarms,
      canShelveAlarms: !!r.canShelveAlarms,
      canCreateWorkOrders: !!r.canCreateWorkOrders,
      canApproveWorkOrders: !!r.canApproveWorkOrders,
      canChangeDispatchMW: !!r.canChangeDispatchMW,
      canExportHistorian: !!r.canExportHistorian,
      canAddCaneBatches: !!r.canAddCaneBatches,
      canModifyPlantParams: !!r.canModifyPlantParams,
      canAccessAiCenter: !!r.canAccessAiCenter,
      canManageTenants: !!r.canManageTenants,
      canManageUsers: !!r.canManageUsers,
      isSystem: !!r.isSystem,
      tenantId: r.tenantId || "GLOBAL",
    });
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingRole) {
        await updateRoleInDb(editingRole.id, roleFormData, currentUser);
        setFeedback({ text: `Rol "${roleFormData.title}" actualizado exitosamente.`, type: "success" });
      } else {
        await createRoleInDb(roleFormData, currentUser);
        setFeedback({ text: `Nuevo rol "${roleFormData.title}" creado exitosamente en Cloud Firestore.`, type: "success" });
      }
      setIsRoleModalOpen(false);
      setEditingRole(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al procesar el rol.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setIsProcessing(true);
    try {
      await deleteRoleInDb(roleId, currentUser);
      setFeedback({ text: "Rol eliminado de la matriz RBAC.", type: "success" });
      setDeletingRoleId(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar el rol.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.badgeNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchTenant = tenantFilter === "ALL" || u.tenantId === tenantFilter || u.tenantId === "GLOBAL";
    return matchSearch && matchRole && matchTenant;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white font-tech tracking-wide uppercase">
                  Gestión de Usuarios, Roles & Matriz RBAC
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                  IEC 62443 / ISA-99 Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Control de acceso granular, privilegios SCADA, niveles de seguridad SIL y aislamiento multi-tenant.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenCreateUser}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-purple-600/20 font-mono"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </button>

            {isSuperAdmin && (
              <button
                onClick={handleOpenCreateRole}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl flex items-center gap-2 transition font-mono"
              >
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Nuevo Rol RBAC</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-800 pb-0">
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "users"
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Directorio de Usuarios ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("roles")}
            className={`px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "roles"
                ? "border-cyan-500 text-cyan-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Definición de Roles & Capacidades ({roles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("matrix")}
            className={`px-4 py-2.5 text-xs font-mono font-bold flex items-center gap-2 border-b-2 transition ${
              activeTab === "matrix"
                ? "border-emerald-500 text-emerald-300"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Matriz de Acciones SCADA / OT</span>
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: USERS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo, ficha o departamento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Rol:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todos los Roles</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.role}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span>Inquilino:</span>
                <select
                  value={tenantFilter}
                  onChange={(e) => setTenantFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todas las Empresas</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
                    <th className="py-3 px-4">Usuario / Credenciales</th>
                    <th className="py-3 px-4">Rol & Nivel SIL</th>
                    <th className="py-3 px-4">Empresa / Ingenio</th>
                    <th className="py-3 px-4">Departamento & Ficha</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const badge = getRoleBadgeInfo(u.role);
                    const tenantObj = tenants.find((t) => t.id === u.tenantId);
                    const isCurrent = currentUser.id === u.id;

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-850 transition ${
                          isCurrent ? "bg-purple-950/20" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                              {u.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{u.name}</span>
                                {isCurrent && (
                                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.2 rounded-full border border-purple-500/30">
                                    Sesión Actual
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {u.securityLevel || badge.clearance}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="text-slate-300 font-bold truncate max-w-[180px]">
                              {u.isSuperAdmin || u.tenantId === "GLOBAL"
                                ? "Acceso Global Multi-Tenant"
                                : tenantObj?.name || u.tenantId}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div>
                            <span className="text-slate-200 block">{u.department}</span>
                            <span className="text-[10px] text-slate-400">Ficha: {u.badgeNumber}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 transition ${
                              u.isActive !== false
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30"
                            }`}
                          >
                            {u.isActive !== false ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            <span>{u.isActive !== false ? "Activo" : "Inactivo"}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onSwitchUser(u)}
                              disabled={isCurrent}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-purple-900/50 text-slate-300 hover:text-purple-200 border border-slate-700 text-[11px] transition disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Probar sesión como este usuario"
                            >
                              Conmutar
                            </button>

                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                              title="Editar Usuario"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            {u.id !== "usr-superadmin" && (
                              <button
                                onClick={() => setDeletingUserId(u.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700 transition"
                                title="Eliminar Usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLES & CAPABILITIES (CRUD) */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => {
              const isSuper = r.role === "superadmin";
              return (
                <div
                  key={r.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg relative"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white font-tech uppercase">{r.title}</h3>
                          <span className="text-[11px] font-mono text-cyan-400">{r.role}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        Nivel {r.securityClearanceLevel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-3 font-mono leading-relaxed line-clamp-2">
                      {r.description}
                    </p>

                    {/* Permissions Grid */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5 font-mono text-[11px]">
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Ajustar Setpoints / Consignas:</span>
                        <span className={r.canWriteSetpoints ? "text-emerald-400 font-bold" : "text-slate-600"}>
                          {r.canWriteSetpoints ? "✓ SÍ" : "✕ NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Reconocer / Silenciar Alarmas:</span>
                        <span className={r.canAcknowledgeAlarms ? "text-emerald-400 font-bold" : "text-slate-600"}>
                          {r.canAcknowledgeAlarms ? "✓ SÍ" : "✕ NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Aprobar Órdenes CMMS:</span>
                        <span className={r.canApproveWorkOrders ? "text-emerald-400 font-bold" : "text-slate-600"}>
                          {r.canApproveWorkOrders ? "✓ SÍ" : "✕ NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Modificar Parámetros de Planta:</span>
                        <span className={r.canModifyPlantParams ? "text-emerald-400 font-bold" : "text-slate-600"}>
                          {r.canModifyPlantParams ? "✓ SÍ" : "✕ NO"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-300">
                        <span>Gestión Multi-Tenant / Empresas:</span>
                        <span className={r.canManageTenants ? "text-amber-400 font-bold" : "text-slate-600"}>
                          {r.canManageTenants ? "✓ SUPERADMIN" : "✕ NO"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleOpenEditRole(r)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono flex items-center gap-1.5 transition border border-slate-700"
                    >
                      <Edit className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Editar Privilegios</span>
                    </button>

                    {!r.isSystem && isSuperAdmin && (
                      <button
                        onClick={() => setDeletingRoleId(r.id)}
                        className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: RBAC MATRIX */}
      {activeTab === "matrix" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-5 font-mono text-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase font-tech">
                Matriz de Control de Acceso por Acción Operacional
              </h3>
              <p className="text-xs text-slate-400">
                Reglas formales de control de seguridad industrial para operaciones críticas SCADA, CMMS y LIMS.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <th className="py-2.5 px-3">Código de Acción</th>
                  <th className="py-2.5 px-3">Módulo Funcional</th>
                  <th className="py-2.5 px-3">Descripción de Operación</th>
                  <th className="py-2.5 px-3">Nivel Mínimo</th>
                  <th className="py-2.5 px-3">Roles Autorizados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {Object.entries(RBAC_RULES).map(([key, rule]) => (
                  <tr key={key} className="hover:bg-slate-850 transition">
                    <td className="py-2.5 px-3 font-bold text-cyan-400">{key}</td>
                    <td className="py-2.5 px-3 text-slate-300">{rule.module}</td>
                    <td className="py-2.5 px-3 text-slate-400">{rule.description}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold border border-slate-700">
                        Nivel {rule.minClearance}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap gap-1">
                        {rule.allowedRoles.map((ar) => (
                          <span
                            key={ar}
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          >
                            {ar}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USER CREATE / EDIT MODAL */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8 font-mono text-xs">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-tech uppercase">
                    {editingUser ? "Editar Usuario Industrial" : "Registrar Nuevo Usuario"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Definición de credenciales, nivel SIL y asignación de empresa.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-slate-300 font-bold block mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ing. Rafael Meneses"
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Correo Electrónico *</label>
                  <input
                    type="email"
                    required
                    placeholder="usuario@bioazucar.com"
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Contraseña de Acceso *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 pr-9 text-slate-200 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Rol en el Sistema *</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-cyan-300 font-bold focus:outline-none focus:border-purple-500"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.role}>
                        {r.title} (Nivel {r.securityClearanceLevel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Empresa / Ingenio *</label>
                  <select
                    value={userFormData.tenantId}
                    onChange={(e) => setUserFormData({ ...userFormData, tenantId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-emerald-300 font-bold focus:outline-none focus:border-purple-500"
                  >
                    {isSuperAdmin && <option value="GLOBAL">Acceso Global (Todas las Plantas)</option>}
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Departamento</label>
                  <input
                    type="text"
                    value={userFormData.department}
                    onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Número de Ficha / Badge</label>
                  <input
                    type="text"
                    value={userFormData.badgeNumber}
                    onChange={(e) => setUserFormData({ ...userFormData, badgeNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Nivel SIL / Seguridad</label>
                  <input
                    type="text"
                    value={userFormData.securityLevel}
                    onChange={(e) => setUserFormData({ ...userFormData, securityLevel: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Teléfono Móvil</label>
                  <input
                    type="text"
                    value={userFormData.phone}
                    onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-purple-600/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingUser ? "Guardar Cambios" : "Crear Usuario"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ROLE CREATE / EDIT MODAL */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8 font-mono text-xs">
            <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-tech uppercase">
                    {editingRole ? "Editar Definición de Rol RBAC" : "Crear Nuevo Rol Personalizado"}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Configuración de permisos atómicos y nivel de autorización SCADA.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Título del Rol *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Ingeniero de Procesos Senior"
                    value={roleFormData.title}
                    onChange={(e) => setRoleFormData({ ...roleFormData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Nivel de Despeje (1 al 5) *</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    required
                    value={roleFormData.securityClearanceLevel}
                    onChange={(e) => setRoleFormData({ ...roleFormData, securityClearanceLevel: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-300 block mb-1">Descripción del Alcance Operacional</label>
                  <textarea
                    rows={2}
                    value={roleFormData.description}
                    onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* Individual Capability Checkboxes */}
              <div className="pt-3 border-t border-slate-800">
                <span className="text-xs font-bold text-cyan-400 block mb-3 uppercase tracking-wider">
                  Matriz de Permisos & Capacidades Individuales
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canWriteSetpoints}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canWriteSetpoints: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Modificar Setpoints / Consignas SCADA</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canAcknowledgeAlarms}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canAcknowledgeAlarms: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Reconocer Alarmas (ACK ISA-18.2)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canShelveAlarms}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canShelveAlarms: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Inhibir / Silenciar Alarmas (Shelve)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canCreateWorkOrders}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canCreateWorkOrders: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Crear Órdenes de Trabajo CMMS</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canApproveWorkOrders}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canApproveWorkOrders: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Aprobar & Cerrar Órdenes CMMS</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canChangeDispatchMW}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canChangeDispatchMW: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Ajustar Despacho MW al SEN</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canAddCaneBatches}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canAddCaneBatches: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Registrar Lotes LIMS en Báscula</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canModifyPlantParams}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canModifyPlantParams: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Modificar Parámetros de Planta</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canManageUsers}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canManageUsers: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Gestión de Usuarios & RBAC</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <input
                      type="checkbox"
                      checked={roleFormData.canManageTenants}
                      onChange={(e) => setRoleFormData({ ...roleFormData, canManageTenants: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-slate-200">Gestión de Empresas Multi-Tenant</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-50 shadow-lg shadow-cyan-600/20"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingRole ? "Guardar Definición" : "Crear Rol"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION */}
      {deletingUserId && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-tech uppercase">Confirmar Baja de Usuario</h3>
            </div>
            <p className="text-slate-300 mb-6">
              ¿Está seguro de que desea eliminar la cuenta de usuario seleccionada? Perderá el acceso de inmediato a la plataforma SCADA.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingUserId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteUser(deletingUserId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Usuario</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ROLE CONFIRMATION */}
      {deletingRoleId && (
        <div className="fixed inset-0 z-[120] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 font-mono text-xs">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white font-tech uppercase">Eliminar Definición de Rol</h3>
            </div>
            <p className="text-slate-300 mb-6">
              ¿Está seguro de que desea remover este rol personalizado de la matriz RBAC?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeletingRoleId(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteRole(deletingRoleId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl flex items-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                <span>Eliminar Rol</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
