export * from "../domain/CopilotTypes";

export interface CopilotSessionContext {
  tenantId?: string;
  plantId?: string;
  plantCode?: string;
  plantName?: string;
  userId?: string;
  username?: string;
  displayName?: string;
  roles?: string[];
  permissions?: string[];
  securityLevel?: number;
  currentView?: string;
  activeTab?: string;
  currentRoute?: string;
  currentModule?: any;
  areaId?: string;
  selectedEquipmentId?: string;
  selectedTag?: string;
  selectedDatePeriod?: string;
  locale?: string;
  timezone?: string;
  isSuperAdmin?: boolean;
}
