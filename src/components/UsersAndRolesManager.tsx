import React, { useState, useEffect, useMemo } from "react";
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
  Cpu,
  Copy,
  LogOut,
  Clock,
  Laptop,
  Globe,
  Radio,
  Download,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import {
  UserAccount,
  RbacRoleDefinition,
  UserRole,
  TenantEnterprise,
  AuditLogEntry,
} from "../types";
import {
  AtomicPermission,
  PermissionCatalogItem,
  AccessScopeAssignment,
  UserSessionRecord,
  EffectivePermissionRecord,
  CANONICAL_PERMISSION_CATALOG,
  ROLE_ATOMIC_PERMISSIONS,
  PermissionRiskLevel,
} from "../types/securityPrincipal";
import { SecurityAdminService } from "../services/securityAdminService";
import { getRoleBadgeInfo, RBAC_RULES, RbacAction } from "../services/rbacService";

export type SecurityConsoleTab =
  | "users"
  | "roles"
  | "permissions"
  | "matrix"
  | "assignments"
  | "effective"
  | "sessions"
  | "audit";

interface UsersAndRolesManagerProps {
  users?: UserAccount[];
  roles?: RbacRoleDefinition[];
  tenants?: TenantEnterprise[];
  currentUser: UserAccount;
  activeTenant?: TenantEnterprise;
  onSwitchUser?: (user: UserAccount) => void;
  initialTab?: SecurityConsoleTab;
}

export const UsersAndRolesManager: React.FC<UsersAndRolesManagerProps> = ({
  users: propUsers = [],
  roles: propRoles = [],
  tenants = [],
  currentUser,
  activeTenant,
  onSwitchUser,
  initialTab = "users",
}) => {
  const [activeTab, setActiveTab] = useState<SecurityConsoleTab>(initialTab);
  const [usersList, setUsersList] = useState<UserAccount[]>(propUsers);
  const [rolesList, setRolesList] = useState<RbacRoleDefinition[]>(propRoles);
  const [assignmentsList, setAssignmentsList] = useState<AccessScopeAssignment[]>([]);
  const [sessionsList, setSessionsList] = useState<UserSessionRecord[]>([]);
  const [auditList, setAuditList] = useState<AuditLogEntry[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionCatalogItem[]>(CANONICAL_PERMISSION_CATALOG);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [tenantFilter, setTenantFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [permModuleFilter, setPermModuleFilter] = useState<string>("ALL");
  const [permRiskFilter, setPermRiskFilter] = useState<string>("ALL");
  const [auditActionFilter, setAuditActionFilter] = useState<string>("ALL");

  // Feedback State
  const [feedback, setFeedback] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Effective Permissions Inspector State
  const [selectedUserForEffective, setSelectedUserForEffective] = useState<string>(currentUser.id);
  const [effectivePerms, setEffectivePerms] = useState<EffectivePermissionRecord[]>([]);

  // Simulator State
  const [simPermission, setSimPermission] = useState<string>("setpoint.write");
  const [simPlant, setSimPlant] = useState<string>("planta-01");
  const [simResult, setSimResult] = useState<{ allowed: boolean; reason: string } | null>(null);

  // User Modals State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userFormData, setUserFormData] = useState<Omit<UserAccount, "id">>({
    name: "",
    lastName: "",
    email: "",
    role: "operador",
    securityLevel: 2,
    department: "Operaciones DCS",
    badgeCode: "DCS-000",
    phone: "+58 255 000-0000",
    isSuperAdmin: false,
    isActive: true,
    status: "ACTIVE",
    tenantId: activeTenant?.id || "BIOAZUCAR-DEMO",
    plantId: "planta-principal",
    areaId: "molienda",
    scope: "TENANT",
  });

  // Role Modals State
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRoleDefinition | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [duplicateRoleTarget, setDuplicateRoleTarget] = useState<RbacRoleDefinition | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
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
    permissions: [],
    scope: "TENANT",
    isActive: true,
  });

  // Assignment Modal State
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [assignmentFormData, setAssignmentFormData] = useState({
    userId: "",
    roleId: "role-operador",
    tenantId: activeTenant?.id || "BIOAZUCAR-DEMO",
    plantId: "planta-principal",
    areaId: "tandem-molienda",
    scopeType: "PLANT" as "GLOBAL" | "TENANT" | "PLANT" | "AREA",
  });

  // Audit Detail Modal
  const [inspectAuditEntry, setInspectAuditEntry] = useState<AuditLogEntry | null>(null);

  // Security Access Flag
  const isSuperAdmin = Boolean(currentUser.isSuperAdmin) && currentUser.role === "superadmin";

  // Sync prop changes
  useEffect(() => {
    if (propUsers && propUsers.length > 0) setUsersList(propUsers);
  }, [propUsers]);

  useEffect(() => {
    if (propRoles && propRoles.length > 0) setRolesList(propRoles);
  }, [propRoles]);

  // Load initial backend data
  const loadConsoleData = async () => {
    setIsLoadingData(true);
    try {
      const [u, r, p, a, s, aud] = await Promise.all([
        SecurityAdminService.fetchUsers(activeTenant?.id),
        SecurityAdminService.fetchRoles(activeTenant?.id),
        SecurityAdminService.fetchPermissionCatalog(),
        SecurityAdminService.fetchAssignments(activeTenant?.id),
        SecurityAdminService.fetchSessions(activeTenant?.id),
        SecurityAdminService.fetchAuditTrail(activeTenant?.id),
      ]);
      setUsersList(u);
      setRolesList(r);
      setPermissionCatalog(p);
      setAssignmentsList(a);
      setSessionsList(s);
      setAuditList(aud);
    } catch (_err) {
      // Handled inside service fallbacks
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadConsoleData();
  }, [activeTenant?.id]);

  // Load effective permissions when selected user changes
  useEffect(() => {
    if (selectedUserForEffective) {
      SecurityAdminService.fetchEffectivePermissions(selectedUserForEffective).then((res) => {
        setEffectivePerms(res);
      });
    }
  }, [selectedUserForEffective, usersList, rolesList]);

  // Run simulator
  const handleRunSimulator = () => {
    const user = usersList.find((u) => u.id === selectedUserForEffective);
    if (!user) return;
    const isSuper = user.role === "superadmin" || user.isSuperAdmin;
    if (isSuper) {
      setSimResult({
        allowed: true,
        reason: `AUTORIZADO: El usuario cuenta con clearance Nivel 5 (Root Global). Su rol '${user.role}' sobrepasa cualquier frontera de scope.`,
      });
      return;
    }

    const roleDef = rolesList.find((r) => r.role === user.role);
    const hasPerm =
      roleDef?.permissions?.includes(simPermission) ||
      ROLE_ATOMIC_PERMISSIONS[user.role]?.includes(simPermission as AtomicPermission);

    if (!hasPerm) {
      setSimResult({
        allowed: false,
        reason: `DENEGADO (403): El rol '${roleDef?.title || user.role}' no posee el permiso atómico '${simPermission}'.`,
      });
      return;
    }

    // Check scope match
    const userAssignments = assignmentsList.filter((a) => a.userId === user.id && a.status === "ACTIVE");
    const hasGlobalScope = user.scope === "GLOBAL" || userAssignments.some((a) => a.scopeType === "GLOBAL");
    const hasPlantScope =
      hasGlobalScope ||
      user.scope === "TENANT" ||
      userAssignments.some((a) => a.plantId === simPlant || a.scopeType === "TENANT");

    if (hasPlantScope) {
      setSimResult({
        allowed: true,
        reason: `AUTORIZADO: El usuario posee el permiso '${simPermission}' y cuenta con asignación de Scope válida sobre '${simPlant}'.`,
      });
    } else {
      setSimResult({
        allowed: false,
        reason: `DENEGADO POR FRONTERA DE SCOPE (403): El usuario tiene permiso '${simPermission}', pero su asignación está confinada fuera de la planta '${simPlant}'.`,
      });
    }
  };

  // ----------------------------------------------------
  // USER HANDLERS
  // ----------------------------------------------------

  const handleOpenCreateUser = () => {
    setEditingUser(null);
    setUserFormData({
      name: "",
      lastName: "",
      email: "",
      role: "operador",
      securityLevel: 2,
      department: "Operaciones DCS",
      badgeCode: "DCS-" + Math.floor(100 + Math.random() * 900),
      phone: "+58 255 000-0000",
      isSuperAdmin: false,
      isActive: true,
      status: "ACTIVE",
      tenantId: activeTenant?.id || "BIOAZUCAR-DEMO",
      plantId: "planta-principal",
      areaId: "molienda",
      scope: "TENANT",
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u: UserAccount) => {
    setEditingUser(u);
    setUserFormData({
      name: u.name,
      lastName: u.lastName || "",
      email: u.email,
      role: u.role,
      securityLevel: u.securityLevel || 2,
      department: u.department || "Operaciones",
      badgeCode: u.badgeCode || "OP-000",
      phone: u.phone || "+58 255 000-0000",
      isSuperAdmin: !!u.isSuperAdmin,
      isActive: u.isActive !== undefined ? u.isActive : true,
      status: u.status || "ACTIVE",
      tenantId: u.tenantId || activeTenant?.id || "BIOAZUCAR-DEMO",
      plantId: u.plantId || "planta-principal",
      areaId: u.areaId || "molienda",
      scope: u.scope || "TENANT",
    });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingUser) {
        const updated = await SecurityAdminService.updateUser(editingUser.id, userFormData, currentUser);
        setUsersList((prev) => prev.map((u) => (u.id === editingUser.id ? updated : u)));
        setFeedback({ text: `Usuario "${userFormData.name}" actualizado exitosamente.`, type: "success" });
      } else {
        const created = await SecurityAdminService.createUser(userFormData, currentUser);
        setUsersList((prev) => [...prev, created]);
        setFeedback({ text: `Usuario "${userFormData.name}" creado con éxito.`, type: "success" });
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
      await SecurityAdminService.deleteUser(userId, currentUser);
      setUsersList((prev) => prev.filter((u) => u.id !== userId));
      setFeedback({ text: "Usuario eliminado de forma segura y auditada.", type: "success" });
      setDeletingUserId(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar usuario.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleToggleUserStatus = async (user: UserAccount, targetStatus: "ACTIVE" | "INACTIVE" | "LOCKED") => {
    try {
      const updated = await SecurityAdminService.toggleUserStatus(user.id, targetStatus, currentUser);
      setUsersList((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
      setFeedback({
        text: `Estado de ${user.name} actualizado a ${targetStatus}.`,
        type: "success",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al cambiar estado.", type: "error" });
    }
  };

  const handleResetAccess = async (user: UserAccount) => {
    try {
      const res = await SecurityAdminService.resetUserAccess(user.id, currentUser);
      setFeedback({
        text: `Acceso temporal para ${user.name}: Token [${res.tempToken}] válido hasta ${new Date(res.expiresAt).toLocaleTimeString()}.`,
        type: "info",
      });
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al restablecer acceso.", type: "error" });
    }
  };

  // ----------------------------------------------------
  // ROLE HANDLERS
  // ----------------------------------------------------

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({
      role: ("rol_" + Date.now().toString().slice(-4)) as UserRole,
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
      tenantId: activeTenant?.id || "GLOBAL",
      permissions: ["plant.read", "alarm.ack"],
      scope: "TENANT",
      isActive: true,
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
      permissions: r.permissions || ROLE_ATOMIC_PERMISSIONS[r.role] || [],
      scope: r.scope || "TENANT",
      isActive: r.isActive !== undefined ? r.isActive : true,
    });
    setIsRoleModalOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (editingRole && editingRole.id) {
        const updated = await SecurityAdminService.updateRole(editingRole.id, roleFormData, currentUser);
        setRolesList((prev) => prev.map((r) => (r.id === editingRole.id ? updated : r)));
        setFeedback({ text: `Rol "${roleFormData.title}" actualizado exitosamente.`, type: "success" });
      } else {
        const created = await SecurityAdminService.createRole(roleFormData, currentUser);
        setRolesList((prev) => [...prev, created]);
        setFeedback({ text: `Rol "${roleFormData.title}" creado con éxito.`, type: "success" });
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

  const handleDuplicateRole = async () => {
    if (!duplicateRoleTarget || !duplicateRoleTarget.id) return;
    setIsProcessing(true);
    try {
      const cloned = await SecurityAdminService.duplicateRole(
        duplicateRoleTarget.id,
        duplicateTitle || `${duplicateRoleTarget.title} (Clon)`,
        currentUser
      );
      setRolesList((prev) => [...prev, cloned]);
      setFeedback({ text: `Rol "${cloned.title}" duplicado exitosamente.`, type: "success" });
      setDuplicateRoleTarget(null);
      setDuplicateTitle("");
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al duplicar rol.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setIsProcessing(true);
    try {
      await SecurityAdminService.deleteRole(roleId, currentUser);
      setRolesList((prev) => prev.filter((r) => r.id !== roleId));
      setFeedback({ text: "Rol eliminado de la matriz RBAC.", type: "success" });
      setDeletingRoleId(null);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar el rol.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  // Toggle single atomic permission for a role in Matrix View
  const handleToggleRolePermission = async (role: RbacRoleDefinition, permKey: AtomicPermission) => {
    if (role.isSystem && !isSuperAdmin) {
      setFeedback({ text: "Los roles del sistema base solo pueden ser ajustados por el SuperAdmin.", type: "error" });
      return;
    }
    const currentPerms = role.permissions || ROLE_ATOMIC_PERMISSIONS[role.role] || [];
    const hasIt = currentPerms.includes(permKey);
    const updatedPerms = hasIt ? currentPerms.filter((p) => p !== permKey) : [...currentPerms, permKey];

    try {
      if (role.id) {
        const updated = await SecurityAdminService.updateRole(role.id, { permissions: updatedPerms }, currentUser);
        setRolesList((prev) => prev.map((r) => (r.id === role.id ? updated : r)));
        setFeedback({
          text: `Permiso "${permKey}" ${hasIt ? "revocado" : "concedido"} para "${role.title}".`,
          type: "success",
        });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al actualizar permiso.", type: "error" });
    }
  };

  // ----------------------------------------------------
  // SESSIONS HANDLERS
  // ----------------------------------------------------

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await SecurityAdminService.revokeSession(sessionId);
      setSessionsList((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, status: "REVOKED", revokedAt: new Date().toISOString() } : s))
      );
      setFeedback({ text: `Sesión ${sessionId} revocada inmediatamente.`, type: "success" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al revocar sesión.", type: "error" });
    }
  };

  const handleRevokeAllSessions = async (userId: string) => {
    try {
      const count = await SecurityAdminService.revokeAllSessions(userId);
      setSessionsList((prev) =>
        prev.map((s) =>
          s.userId === userId && s.status === "ACTIVE"
            ? { ...s, status: "REVOKED", revokedAt: new Date().toISOString() }
            : s
        )
      );
      setFeedback({ text: `Se han revocado ${count} sesiones activas del usuario.`, type: "success" });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al revocar sesiones.", type: "error" });
    }
  };

  // ----------------------------------------------------
  // ASSIGNMENTS HANDLERS
  // ----------------------------------------------------

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignmentFormData.userId) return;
    const targetUser = usersList.find((u) => u.id === assignmentFormData.userId);
    const targetRole = rolesList.find((r) => r.id === assignmentFormData.roleId || r.role === assignmentFormData.roleId);

    try {
      const newAsg = await SecurityAdminService.createAssignment({
        userId: assignmentFormData.userId,
        userName: targetUser?.name || "Usuario",
        userEmail: targetUser?.email || "",
        roleId: assignmentFormData.roleId,
        role: targetRole?.role || "operador",
        tenantId: assignmentFormData.tenantId,
        plantId: assignmentFormData.plantId,
        areaId: assignmentFormData.areaId,
        scopeType: assignmentFormData.scopeType,
        assignedBy: currentUser.email || currentUser.name,
        status: "ACTIVE",
      });
      setAssignmentsList((prev) => [...prev, newAsg]);
      setFeedback({ text: "Asignación de acceso y scope creada exitosamente.", type: "success" });
      setIsAssignmentModalOpen(false);
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al crear asignación.", type: "error" });
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await SecurityAdminService.deleteAssignment(id);
      setAssignmentsList((prev) => prev.filter((a) => a.id !== id));
      setFeedback({ text: "Asignación de scope revocada.", type: "success" });
    } catch (err: any) {
      setFeedback({ text: err.message || "Error al eliminar asignación.", type: "error" });
    }
  };

  // Filtered lists
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.lastName && u.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.badgeCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase());
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchTenant = tenantFilter === "ALL" || u.tenantId === tenantFilter || u.tenantId === "GLOBAL";
      const matchStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.isActive) ||
        (statusFilter === "INACTIVE" && !u.isActive) ||
        (statusFilter === "LOCKED" && u.status === "LOCKED");
      return matchSearch && matchRole && matchTenant && matchStatus;
    });
  }, [usersList, searchTerm, roleFilter, tenantFilter, statusFilter]);

  const filteredRoles = useMemo(() => {
    return rolesList.filter((r) => {
      const matchSearch =
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTenant = tenantFilter === "ALL" || !r.tenantId || r.tenantId === "GLOBAL" || r.tenantId === tenantFilter;
      return matchSearch && matchTenant;
    });
  }, [rolesList, searchTerm, tenantFilter]);

  const filteredPermissions = useMemo(() => {
    return permissionCatalog.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchModule = permModuleFilter === "ALL" || p.module === permModuleFilter;
      const matchRisk = permRiskFilter === "ALL" || p.riskLevel === permRiskFilter;
      return matchSearch && matchModule && matchRisk;
    });
  }, [permissionCatalog, searchTerm, permModuleFilter, permRiskFilter]);

  const filteredAudit = useMemo(() => {
    return auditList.filter((a) => {
      const matchSearch =
        a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a.actorEmail && a.actorEmail.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchAction = auditActionFilter === "ALL" || a.action === auditActionFilter;
      return matchSearch && matchAction;
    });
  }, [auditList, searchTerm, auditActionFilter]);

  // Distinct modules for filter
  const allModules = useMemo(() => {
    return Array.from(new Set(permissionCatalog.map((p) => p.module)));
  }, [permissionCatalog]);

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* HEADER BANNER WITH COMPLIANCE & MULTI-TENANT CONTEXT           */}
      {/* ============================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shadow-lg shadow-purple-500/10 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-white font-tech tracking-wide uppercase">
                  Consola de Seguridad & Gobierno IAM
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
                  IEC 62443 SL3 / ISA-95
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                  Tenant: {activeTenant?.name || "Global Clúster"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Aislamiento estricto, modelo User → Membership → RoleAssignment → AtomicPermission, sesiones en tiempo real y auditoría inmutable.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={loadConsoleData}
              disabled={isLoadingData}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs rounded-xl flex items-center gap-1.5 transition font-mono"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingData ? "animate-spin" : ""}`} />
              <span>Sincronizar</span>
            </button>

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

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase text-slate-400">Total Usuarios</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-white font-mono">{usersList.length}</span>
              <span className="text-[11px] text-emerald-400 font-mono">
                ({usersList.filter((u) => u.isActive).length} Activos)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase text-slate-400">Roles Definidos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-purple-300 font-mono">{rolesList.length}</span>
              <span className="text-[11px] text-slate-400 font-mono">
                ({rolesList.filter((r) => r.isSystem).length} Sistema)
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase text-slate-400">Sesiones Activas</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-cyan-300 font-mono">
                {sessionsList.filter((s) => s.status === "ACTIVE").length}
              </span>
              <span className="text-[11px] text-cyan-400 font-mono">En Vivo</span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
            <span className="text-[10px] font-mono uppercase text-slate-400">Catálogo Permisos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold text-amber-300 font-mono">{permissionCatalog.length}</span>
              <span className="text-[11px] text-amber-400 font-mono">Atómicos</span>
            </div>
          </div>
        </div>

        {/* Console 8 Tabs Navigation */}
        <div className="flex items-center gap-1 mt-6 border-b border-slate-800 overflow-x-auto no-scrollbar">
          {[
            { id: "users", label: "Usuarios", count: usersList.length, icon: Users },
            { id: "roles", label: "Roles", count: rolesList.length, icon: Shield },
            { id: "permissions", label: "Catálogo Permisos", count: permissionCatalog.length, icon: Key },
            { id: "matrix", label: "Matriz RBAC", icon: Sliders },
            { id: "assignments", label: "Asignaciones & Scope", count: assignmentsList.length, icon: Layers },
            { id: "effective", label: "Permisos Efectivos", icon: Eye },
            { id: "sessions", label: "Sesiones", count: sessionsList.filter((s) => s.status === "ACTIVE").length, icon: Radio },
            { id: "audit", label: "Auditoría IAM", count: auditList.length, icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as SecurityConsoleTab);
                  setSearchTerm("");
                }}
                className={`px-3.5 py-2.5 text-xs font-mono font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                  isSelected
                    ? "border-purple-500 text-purple-300 bg-purple-500/10"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? "bg-purple-500/30 text-purple-200" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in duration-200 ${
            feedback.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
              : feedback.type === "info"
              ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
              : "bg-rose-500/15 border-rose-500/40 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : feedback.type === "info" ? (
              <Key className="w-4 h-4 text-cyan-400 shrink-0" />
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

      {/* ============================================================== */}
      {/* TAB 1: USERS DIRECTORY (CRUD COMPLETO & SECURITY ACTIONS)      */}
      {/* ============================================================== */}
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

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Rol:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todos los Roles</option>
                  {rolesList.map((r) => (
                    <option key={r.id || r.role} value={r.role}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span>Estado:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="ACTIVE">Activos</option>
                  <option value="INACTIVE">Inactivos</option>
                  <option value="LOCKED">Bloqueados</option>
                </select>
              </div>

              {isSuperAdmin && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                  <span>Empresa:</span>
                  <select
                    value={tenantFilter}
                    onChange={(e) => setTenantFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                  >
                    <option value="ALL">Todas las Empresas</option>
                    <option value="GLOBAL">GLOBAL / Root</option>
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Identidad & Ficha</th>
                    <th className="py-3 px-4">Rol & Nivel SIL</th>
                    <th className="py-3 px-4">Tenant / Planta</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Último Acceso</th>
                    <th className="py-3 px-4 text-right">Acciones de Seguridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-mono">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No se encontraron usuarios bajo los criterios seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const badgeInfo = getRoleBadgeInfo(u.role);
                      const isTargetSuper = u.role === "superadmin" || u.isSuperAdmin;
                      const userActiveSessions = sessionsList.filter((s) => s.userId === u.id && s.status === "ACTIVE");

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                                {u.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                                  <span>{u.name} {u.lastName || ""}</span>
                                  {isTargetSuper && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{u.email}</span>
                                  <span>•</span>
                                  <span className="text-slate-500">Ficha: {u.badgeCode}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${badgeInfo.color}`}>
                                {badgeInfo.label}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                SIL-{u.securityLevel || 1} • Clearance {u.securityLevel || 1}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-300 text-[11px]">{u.tenantId}</div>
                            <div className="text-[10px] text-slate-500">{u.plantId || "Principal"} / {u.areaId || "General"}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                u.status === "LOCKED"
                                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                  : u.isActive
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : "bg-slate-700/40 text-slate-400 border-slate-600"
                              }`}
                            >
                              {u.status === "LOCKED" ? "BLOQUEADO" : u.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                            <div>{u.lastLogin || "Nunca"}</div>
                            {userActiveSessions.length > 0 && (
                              <div className="text-[10px] text-cyan-400 flex items-center gap-1 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                                <span>{userActiveSessions.length} sesión(es) activa(s)</span>
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* View Effective Permissions */}
                              <button
                                onClick={() => {
                                  setSelectedUserForEffective(u.id);
                                  setActiveTab("effective");
                                }}
                                title="Inspeccionar Permisos Efectivos"
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded-lg transition"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Reset Access */}
                              <button
                                onClick={() => handleResetAccess(u)}
                                title="Restablecer Acceso / OTP"
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg transition"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Toggle Status */}
                              <button
                                onClick={() => handleToggleUserStatus(u, u.isActive ? "INACTIVE" : "ACTIVE")}
                                title={u.isActive ? "Desactivar Usuario" : "Activar Usuario"}
                                className={`p-1.5 hover:bg-slate-800 rounded-lg transition ${
                                  u.isActive ? "text-slate-400 hover:text-amber-400" : "text-emerald-400 hover:text-emerald-300"
                                }`}
                              >
                                {u.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>

                              {/* Revoke All Sessions */}
                              {userActiveSessions.length > 0 && (
                                <button
                                  onClick={() => handleRevokeAllSessions(u.id)}
                                  title="Revocar todas las sesiones"
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded-lg transition"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Edit User */}
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                title="Editar Usuario"
                                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-purple-300 rounded-lg transition"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>

                              {/* Switch Active Identity */}
                              {onSwitchUser && (
                                <button
                                  onClick={() => onSwitchUser(u)}
                                  title="Simular/Cambiar a este usuario"
                                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded-lg transition"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Delete User */}
                              <button
                                onClick={() => setDeletingUserId(u.id)}
                                title="Eliminar Usuario"
                                disabled={isTargetSuper}
                                className={`p-1.5 hover:bg-slate-800 rounded-lg transition ${
                                  isTargetSuper
                                    ? "text-slate-600 cursor-not-allowed"
                                    : "text-slate-400 hover:text-rose-400"
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: ROLES & CAPABILITIES (SYSTEM VS CUSTOM, DUPLICATE)      */}
      {/* ============================================================== */}
      {activeTab === "roles" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map((role) => {
              const assignedUsersCount = usersList.filter((u) => u.role === role.role).length;
              const rolePermissions = role.permissions || ROLE_ATOMIC_PERMISSIONS[role.role] || [];

              return (
                <div
                  key={role.id || role.role}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white text-sm">{role.title}</h3>
                          {role.isSystem ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold border border-slate-700">
                              SISTEMA
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                              CUSTOM
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-purple-400">{role.role}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${role.badgeColor}`}>
                        Nivel {role.securityClearanceLevel}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mt-2.5 leading-relaxed line-clamp-3">
                      {role.description}
                    </p>

                    <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Usuarios asignados:</span>
                      <span className="font-bold text-emerald-400">{assignedUsersCount}</span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Permisos atómicos:</span>
                      <span className="font-bold text-cyan-400">{rolePermissions.length}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setDuplicateRoleTarget(role);
                          setDuplicateTitle(`${role.title} (Copia)`);
                        }}
                        title="Duplicar Rol"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition font-mono"
                      >
                        <Copy className="w-3 h-3 text-cyan-400" />
                        <span>Clonar</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditRole(role)}
                        title="Editar Rol"
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg flex items-center gap-1 transition font-mono"
                      >
                        <Edit className="w-3 h-3 text-purple-400" />
                        <span>Editar</span>
                      </button>
                    </div>

                    {!role.isSystem && (
                      <button
                        onClick={() => setDeletingRoleId(role.id || role.role)}
                        title="Eliminar Rol Personalizado"
                        className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
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

      {/* ============================================================== */}
      {/* TAB 3: CANONICAL PERMISSIONS CATALOG (40+ ATOMIC PERMS)        */}
      {/* ============================================================== */}
      {activeTab === "permissions" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar permiso, clave atómica o descripción..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span>Módulo:</span>
                <select
                  value={permModuleFilter}
                  onChange={(e) => setPermModuleFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todos los Módulos ({allModules.length})</option>
                  {allModules.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <span>Riesgo:</span>
                <select
                  value={permRiskFilter}
                  onChange={(e) => setPermRiskFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  <option value="ALL">Todos los Niveles</option>
                  <option value="BAJO">Bajo</option>
                  <option value="MEDIO">Medio</option>
                  <option value="ALTO">Alto</option>
                  <option value="CRITICO">Crítico</option>
                </select>
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredPermissions.map((perm) => {
              const riskColor =
                perm.riskLevel === "CRITICO"
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : perm.riskLevel === "ALTO"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : perm.riskLevel === "MEDIO"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";

              return (
                <div
                  key={perm.key}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                      {perm.key}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${riskColor}`}>
                      {perm.riskLevel}
                    </span>
                  </div>

                  <h4 className="font-bold text-slate-200 text-xs mt-2.5">{perm.name}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{perm.description}</p>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Módulo: {perm.module}</span>
                    <span className="text-slate-400">Scope: {perm.scopeType}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: INTERACTIVE VISUAL MATRIX (TOGGLEABLE & PERSISTENT)      */}
      {/* ============================================================== */}
      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-white text-sm">Matriz de Acciones SCADA / OT & Permisos Atómicos</h3>
                <p className="text-xs text-slate-400">
                  Haga clic en las casillas para conceder o retirar permisos atómicos en tiempo real. Los cambios se persisten inmediatamente en la base de datos y generan registros criptográficos de auditoría.
                </p>
              </div>
              <span className="text-[11px] text-cyan-400 font-mono">
                {rolesList.length} Roles × {permissionCatalog.length} Permisos
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-mono text-slate-400">
                    <th className="py-2.5 px-3">Permiso Atómico</th>
                    <th className="py-2.5 px-3">Módulo</th>
                    {rolesList.map((r) => (
                      <th key={r.id || r.role} className="py-2.5 px-2 text-center">
                        <span className="truncate block max-w-[100px]">{r.title.split(" ")[0]}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {permissionCatalog.map((perm) => (
                    <tr key={perm.key} className="hover:bg-slate-800/30 transition">
                      <td className="py-2 px-3">
                        <span className="text-purple-300 font-bold">{perm.key}</span>
                        <div className="text-[10px] text-slate-500 truncate max-w-xs">{perm.name}</div>
                      </td>

                      <td className="py-2 px-3 text-[11px] text-slate-400">
                        {perm.module}
                      </td>

                      {rolesList.map((role) => {
                        const isSuper = role.role === "superadmin";
                        const rolePerms = role.permissions || ROLE_ATOMIC_PERMISSIONS[role.role] || [];
                        const hasPerm = isSuper || rolePerms.includes(perm.key);

                        return (
                          <td key={role.id || role.role} className="py-2 px-2 text-center">
                            <button
                              onClick={() => !isSuper && handleToggleRolePermission(role, perm.key)}
                              disabled={isSuper}
                              className={`w-6 h-6 rounded flex items-center justify-center transition mx-auto ${
                                hasPerm
                                  ? isSuper
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 cursor-not-allowed"
                                    : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30"
                                  : "bg-slate-800/40 text-slate-600 border border-slate-700/50 hover:bg-slate-800 hover:text-slate-400"
                              }`}
                            >
                              {hasPerm ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: ACCESS ASSIGNMENTS & SCOPE HIERARCHY                     */}
      {/* ============================================================== */}
      {activeTab === "assignments" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-white text-sm">Asignaciones Granulares & Delimitación de Scope</h3>
              <p className="text-xs text-slate-400">
                Estructura: Usuario → Rol → Tenant → Planta → Área. Impide la propagación accidental de privilegios entre plantas independientes.
              </p>
            </div>
            <button
              onClick={() => setIsAssignmentModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition font-mono"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Asignación de Scope</span>
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario</th>
                    <th className="py-3 px-4">Rol Asignado</th>
                    <th className="py-3 px-4">Scope Permitido</th>
                    <th className="py-3 px-4">Asignado Por</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-mono">
                  {assignmentsList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No hay asignaciones de scope registradas.
                      </td>
                    </tr>
                  ) : (
                    assignmentsList.map((asg) => (
                      <tr key={asg.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-200">{asg.userName}</div>
                          <div className="text-[11px] text-slate-400">{asg.userEmail}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                            {asg.role}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 font-bold text-[10px]">
                              {asg.scopeType}
                            </span>
                            <span className="text-slate-300">
                              {asg.scopeType === "GLOBAL"
                                ? "Todo el clúster"
                                : `${asg.tenantId} ${asg.plantId ? `> ${asg.plantId}` : ""} ${asg.areaId ? `> ${asg.areaId}` : ""}`}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-400">{asg.assignedBy}</td>
                        <td className="py-3.5 px-4 text-slate-400">{new Date(asg.assignedAt).toLocaleDateString()}</td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteAssignment(asg.id)}
                            className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded-lg transition"
                            title="Revocar asignación de scope"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: EFFECTIVE PERMISSIONS INSPECTOR & SIMULATOR             */}
      {/* ============================================================== */}
      {activeTab === "effective" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* User Selector & Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1.5">
                  Seleccionar Identidad a Auditar:
                </label>
                <select
                  value={selectedUserForEffective}
                  onChange={(e) => setSelectedUserForEffective(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 focus:outline-none focus:border-purple-500 font-mono"
                >
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role} - {u.email})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const targetUser = usersList.find((u) => u.id === selectedUserForEffective);
                if (!targetUser) return null;
                const grantedCount = effectivePerms.filter((p) => p.granted).length;

                return (
                  <div className="space-y-3 pt-3 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Rol Activo:</span>
                      <span className="font-bold text-purple-300">{targetUser.role}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Nivel SIL / Clearance:</span>
                      <span className="font-bold text-amber-300">SIL-{targetUser.securityLevel} (Nivel {targetUser.securityLevel})</span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Permisos Concedidos:</span>
                      <span className="font-bold text-emerald-400">
                        {grantedCount} / {effectivePerms.length}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Frontera de Scope:</span>
                      <span className="font-bold text-cyan-300">{targetUser.scope || targetUser.tenantId}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Authorization Simulator Card */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <h4 className="text-xs font-bold text-white uppercase font-mono mb-2 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Simulador de Autorización</span>
                </h4>
                <div className="space-y-2.5">
                  <div>
                    <label className="text-[11px] font-mono text-slate-400">Acción a Ejecutar:</label>
                    <select
                      value={simPermission}
                      onChange={(e) => setSimPermission(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200 rounded-lg p-2 font-mono"
                    >
                      {permissionCatalog.map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.key} ({p.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-slate-400">Planta / Recurso Destino:</label>
                    <input
                      type="text"
                      value={simPlant}
                      onChange={(e) => setSimPlant(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-[11px] text-slate-200 rounded-lg p-2 font-mono"
                    />
                  </div>

                  <button
                    onClick={handleRunSimulator}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-lg transition mt-2"
                  >
                    Evaluar Autorización
                  </button>

                  {simResult && (
                    <div
                      className={`p-3 rounded-lg border text-xs font-mono mt-3 animate-in fade-in ${
                        simResult.allowed
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-300"
                      }`}
                    >
                      {simResult.reason}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Effective Permissions Table */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h3 className="font-bold text-white text-sm mb-3">
                ¿Qué puede hacer exactamente este usuario en la plataforma?
              </h3>
              <div className="overflow-y-auto max-h-[550px] no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Permiso Atómico</th>
                      <th className="py-2.5 px-3">Recurso / Acción</th>
                      <th className="py-2.5 px-3">Rol Origen</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-xs font-mono">
                    {effectivePerms.map((perm) => (
                      <tr key={perm.permission} className="hover:bg-slate-800/30 transition">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-200">{perm.permission}</span>
                          <div className="text-[10px] text-slate-500">{perm.name}</div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {perm.resource} • {perm.action}
                        </td>

                        <td className="py-2.5 px-3 text-slate-300 text-[11px]">
                          {perm.sourceRole}
                        </td>

                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              perm.granted
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-slate-800 text-slate-500 border-slate-700"
                            }`}
                          >
                            {perm.granted ? "CONCEDIDO" : "DENEGADO"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 7: ACTIVE SESSIONS MONITOR & REMOTE REVOCATION             */}
      {/* ============================================================== */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/90 p-4 rounded-xl border border-slate-800 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-white text-sm">Sesiones Conectadas a la Sala de Control & Edge</h3>
              <p className="text-xs text-slate-400">
                Monitoreo en tiempo real de terminales SCADA, estaciones de ingeniería y sesiones web autorizadas.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">
              {sessionsList.filter((s) => s.status === "ACTIVE").length} Sesión(es) Activa(s)
            </span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Usuario & Tenant</th>
                    <th className="py-3 px-4">Dispositivo & SO</th>
                    <th className="py-3 px-4">Dirección IP</th>
                    <th className="py-3 px-4">Inicio & Última Actividad</th>
                    <th className="py-3 px-4">Garantía AAL</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-mono">
                  {sessionsList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        No hay sesiones registradas.
                      </td>
                    </tr>
                  ) : (
                    sessionsList.map((sess) => (
                      <tr key={sess.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-200">{sess.userName}</div>
                          <div className="text-[11px] text-slate-400">{sess.userEmail} ({sess.tenantId})</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-slate-300 font-bold">{sess.device}</div>
                          <div className="text-[10px] text-slate-500">{sess.browser} • {sess.os}</div>
                        </td>

                        <td className="py-3.5 px-4 text-cyan-300">{sess.ipAddress}</td>

                        <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                          <div>Iniciado: {new Date(sess.startedAt).toLocaleTimeString()}</div>
                          <div className="text-[10px] text-slate-500">Activo: {new Date(sess.lastActiveAt).toLocaleTimeString()}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold">
                            {sess.authAssurance}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              sess.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          {sess.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleRevokeSession(sess.id)}
                              className="px-2.5 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-mono transition"
                            >
                              Revocar
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500">Revocada</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 8: IAM AUDIT TRAIL (CRYPTOGRAPHIC SHA-256 JOURNAL)         */}
      {/* ============================================================== */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por acción, usuario o actor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 text-xs text-slate-200 pl-9 pr-3 py-2 rounded-lg border border-slate-800 focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Total Eventos: {filteredAudit.length}</span>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">Fecha & Hora</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Acción IAM</th>
                    <th className="py-3 px-4">Módulo / Recurso</th>
                    <th className="py-3 px-4">Resultado</th>
                    <th className="py-3 px-4 text-right">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs font-mono">
                  {filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No hay eventos de auditoría que coincidan con la búsqueda.
                      </td>
                    </tr>
                  ) : (
                    filteredAudit.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {log.timestamp}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200">{log.userName}</div>
                          <div className="text-[10px] text-slate-500">{log.userRole}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-bold text-purple-300">{log.action}</span>
                        </td>

                        <td className="py-3 px-4 text-slate-400">{log.module}</td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              log.status === "AUTHORIZED" || log.status === "EXECUTED"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => setInspectAuditEntry(log)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 rounded-lg transition"
                            title="Ver JSON criptográfico"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT USER                                      */}
      {/* ============================================================== */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white font-tech text-base">
                  {editingUser ? "Editar Usuario Existente" : "Crear Nueva Cuenta de Usuario"}
                </h3>
              </div>
              <button
                onClick={() => setIsUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Nombre:</label>
                  <input
                    type="text"
                    required
                    value={userFormData.name}
                    onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Apellidos:</label>
                  <input
                    type="text"
                    value={userFormData.lastName || ""}
                    onChange={(e) => setUserFormData({ ...userFormData, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Correo Electrónico:</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Rol RBAC:</label>
                  <select
                    value={userFormData.role}
                    onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  >
                    {rolesList.map((r) => (
                      <option key={r.id || r.role} value={r.role}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Nivel SIL / Clearance:</label>
                  <select
                    value={userFormData.securityLevel}
                    onChange={(e) => setUserFormData({ ...userFormData, securityLevel: parseInt(e.target.value, 10) })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value={1}>SIL-1 (Operador Nivel 1)</option>
                    <option value={2}>SIL-2 (Monitoreo & Báscula)</option>
                    <option value={3}>SIL-3 (Supervisor Molienda)</option>
                    <option value={4}>SIL-4 (Gerencia / Planta)</option>
                    {isSuperAdmin && <option value={5}>SIL-4 / Clearance 5 (Root Global)</option>}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Ficha Operador:</label>
                  <input
                    type="text"
                    value={userFormData.badgeCode}
                    onChange={(e) => setUserFormData({ ...userFormData, badgeCode: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Estado Cuenta:</label>
                  <select
                    value={userFormData.status}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        status: e.target.value as any,
                        isActive: e.target.value === "ACTIVE",
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  >
                    <option value="ACTIVE">Activo</option>
                    <option value="INACTIVE">Inactivo (Suspendido)</option>
                    <option value="LOCKED">Bloqueado por Seguridad</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Tenant Asignado:</label>
                  <select
                    value={userFormData.tenantId}
                    onChange={(e) => setUserFormData({ ...userFormData, tenantId: e.target.value })}
                    disabled={!isSuperAdmin}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  >
                    {isSuperAdmin && <option value="GLOBAL">GLOBAL / Clúster Completo</option>}
                    {tenants.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Delimitación de Scope:</label>
                  <select
                    value={userFormData.scope}
                    onChange={(e) => setUserFormData({ ...userFormData, scope: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-purple-500"
                  >
                    {isSuperAdmin && <option value="GLOBAL">GLOBAL (Acceso Total)</option>}
                    <option value="TENANT">TENANT (Toda la Empresa)</option>
                    <option value="PLANT">PLANT (Solo Planta Asignada)</option>
                    <option value="AREA">AREA (Solo Área de Trabajo)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs font-mono rounded-xl transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingUser ? "Guardar Cambios" : "Crear Usuario"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT ROLE                                      */}
      {/* ============================================================== */}
      {isRoleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white font-tech text-base">
                  {editingRole ? "Editar Rol RBAC" : "Definir Nuevo Rol Personalizado"}
                </h3>
              </div>
              <button
                onClick={() => setIsRoleModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Título del Rol:</label>
                  <input
                    type="text"
                    required
                    value={roleFormData.title}
                    onChange={(e) => setRoleFormData({ ...roleFormData, title: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-cyan-500"
                    placeholder="Ej. Operador Calderas Turno Noche"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Nivel de Clearance (1-5):</label>
                  <select
                    value={roleFormData.securityClearanceLevel}
                    onChange={(e) =>
                      setRoleFormData({ ...roleFormData, securityClearanceLevel: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-cyan-500"
                  >
                    <option value={1}>Nivel 1 (Operaciones Básicas)</option>
                    <option value={2}>Nivel 2 (Monitoreo & Báscula)</option>
                    <option value={3}>Nivel 3 (Supervisión & Enclavamientos)</option>
                    <option value={4}>Nivel 4 (Gerencia / Planta)</option>
                    {isSuperAdmin && <option value={5}>Nivel 5 (Root Global)</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Descripción:</label>
                <textarea
                  rows={2}
                  value={roleFormData.description}
                  onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-cyan-500"
                  placeholder="Detalles sobre las responsabilidades y facultades de este rol..."
                />
              </div>

              {/* Atomic Permissions Checklist */}
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-2">
                  Permisos Atómicos Asignados ({roleFormData.permissions?.length || 0}):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 no-scrollbar">
                  {permissionCatalog.map((perm) => {
                    const isChecked = roleFormData.permissions?.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs font-mono"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const prev = roleFormData.permissions || [];
                            if (e.target.checked) {
                              setRoleFormData({ ...roleFormData, permissions: [...prev, perm.key] });
                            } else {
                              setRoleFormData({ ...roleFormData, permissions: prev.filter((k) => k !== perm.key) });
                            }
                          }}
                          className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                        />
                        <span className="text-slate-300 font-bold truncate">{perm.key}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsRoleModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs font-mono rounded-xl transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editingRole ? "Actualizar Rol" : "Crear Rol"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DUPLICATE ROLE                                          */}
      {/* ============================================================== */}
      {duplicateRoleTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-white text-base">Duplicar Rol RBAC</h3>
            </div>
            <p className="text-xs text-slate-400">
              Se clonarán todas las capacidades y permisos atómicos de "{duplicateRoleTarget.title}".
            </p>

            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Nombre para el Nuevo Rol:</label>
              <input
                type="text"
                required
                value={duplicateTitle}
                onChange={(e) => setDuplicateTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDuplicateRoleTarget(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-mono rounded-xl hover:bg-slate-700 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDuplicateRole}
                disabled={isProcessing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold font-mono rounded-xl transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Clonar Rol</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ASSIGN SCOPE TO USER                                    */}
      {/* ============================================================== */}
      {isAssignmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">Asignar Scope & Acceso</h3>
              </div>
              <button onClick={() => setIsAssignmentModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3.5">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Usuario Destino:</label>
                <select
                  required
                  value={assignmentFormData.userId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, userId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono"
                >
                  <option value="">Seleccione un usuario...</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Rol a Asignar:</label>
                <select
                  value={assignmentFormData.roleId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, roleId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono"
                >
                  {rolesList.map((r) => (
                    <option key={r.id || r.role} value={r.id || r.role}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Tipo de Scope:</label>
                  <select
                    value={assignmentFormData.scopeType}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, scopeType: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono"
                  >
                    {isSuperAdmin && <option value="GLOBAL">GLOBAL</option>}
                    <option value="TENANT">TENANT</option>
                    <option value="PLANT">PLANT</option>
                    <option value="AREA">AREA</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Planta:</label>
                  <input
                    type="text"
                    value={assignmentFormData.plantId}
                    onChange={(e) => setAssignmentFormData({ ...assignmentFormData, plantId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Área Específica (Opcional):</label>
                <input
                  type="text"
                  value={assignmentFormData.areaId}
                  onChange={(e) => setAssignmentFormData({ ...assignmentFormData, areaId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-xl p-2.5 font-mono"
                  placeholder="Ej. tandem-molienda / calderas-hp"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-mono rounded-xl hover:bg-slate-700 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold rounded-xl transition"
                >
                  Guardar Asignación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE CONFIRMATION                                     */}
      {/* ============================================================== */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-white text-base">Confirmar Eliminación Segura</h3>
            </div>
            <p className="text-xs text-slate-400">
              ¿Está seguro de que desea eliminar la cuenta de usuario{" "}
              <span className="text-white font-mono font-bold">
                {usersList.find((u) => u.id === deletingUserId)?.email}
              </span>
              ? La operación revocará todas sus sesiones y quedará registrada en el journal inmutable de auditoría.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingUserId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteUser(deletingUserId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-mono rounded-xl transition"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingRoleId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-white text-base">Confirmar Eliminación de Rol</h3>
            </div>
            <p className="text-xs text-slate-400">
              ¿Está seguro de que desea eliminar este rol personalizado? Los usuarios asociados perderán los permisos concedidos por este rol.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeletingRoleId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteRole(deletingRoleId)}
                disabled={isProcessing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-mono rounded-xl transition"
              >
                Eliminar Rol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: AUDIT LOG JSON INSPECTOR                                */}
      {/* ============================================================== */}
      {inspectAuditEntry && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-white text-sm font-mono">
                  Registro Criptográfico #{inspectAuditEntry.id}
                </h3>
              </div>
              <button onClick={() => setInspectAuditEntry(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-96">
              {JSON.stringify(inspectAuditEntry, null, 2)}
            </pre>

            <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-slate-500">
              <span>IEC 62443 SL3 Integrity Guard</span>
              <button
                onClick={() => setInspectAuditEntry(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
