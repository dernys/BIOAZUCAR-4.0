import { UserAccount, UserRole, NavigationTab, TenantEnterprise } from "../../types";
import { CopilotUserContext } from "../domain/CopilotTypes";

export class CopilotContextService {
  private static instance: CopilotContextService;

  private constructor() {}

  public static getInstance(): CopilotContextService {
    if (!CopilotContextService.instance) {
      CopilotContextService.instance = new CopilotContextService();
    }
    return CopilotContextService.instance;
  }

  public buildContext(
    currentUser: UserAccount,
    currentRole: UserRole,
    activeTenant: TenantEnterprise,
    activeTab: NavigationTab,
    selectedEquipmentId?: string,
    selectedTag?: string
  ): CopilotUserContext {
    const isSuperAdmin = Boolean(currentUser.isSuperAdmin || currentRole === "superadmin");

    // Extract user permissions
    const permissions: string[] = [
      "VIEW_TELEMETRY",
      "VIEW_TAGS",
      "VIEW_KPIS",
      "VIEW_EQUIPMENT",
      "VIEW_ALARMS",
      "VIEW_HISTORIAN",
      "VIEW_LINEAGE",
      "VIEW_DOCS",
      "NAVIGATE_APP",
    ];

    if (currentRole === "operador" || currentRole === "supervisor" || currentRole === "administrador" || isSuperAdmin) {
      permissions.push("ACKNOWLEDGE_ALARM");
    }

    if (currentRole === "supervisor" || currentRole === "administrador" || isSuperAdmin) {
      permissions.push("CHANGE_DISPATCH_MW", "CREATE_WORK_ORDERS", "APPROVE_WORK_ORDERS");
    }

    if (currentRole === "administrador" || isSuperAdmin) {
      permissions.push("MODIFY_SETPOINTS", "MODIFY_PLANT_PARAMS", "MANAGE_USERS");
    }

    if (isSuperAdmin) {
      permissions.push("MANAGE_TENANTS", "RESET_DATABASE", "CONFIGURE_OT_GATEWAYS", "ROOT_ACCESS");
    }

    return {
      userId: currentUser.id || "usr-anon",
      username: currentUser.email || "usuario@bioazucar.com",
      displayName: currentUser.name || "Operador Industrial",
      roles: [currentRole],
      permissions,
      securityLevel: currentUser.securityLevel || (isSuperAdmin ? 5 : currentRole === "administrador" ? 4 : currentRole === "supervisor" ? 3 : currentRole === "mantenimiento" ? 2 : 1),
      plantId: activeTenant.id || "TENANT_DEFAULT",
      plantName: activeTenant.name || "Central Azucarero Principal",
      plantCode: activeTenant.code || "CENTRAL-01",
      currentRoute: `/${activeTab}`,
      currentModule: activeTab,
      selectedEquipmentId,
      selectedTag,
      locale: "es-VE",
      timezone: "America/Caracas",
      isSuperAdmin,
    };
  }
}

export const copilotContextService = CopilotContextService.getInstance();
