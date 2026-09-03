import {
  IndustrialTagDefinition,
  DataSourceType,
  ProtocolType,
  UserRole,
} from "../types";
import { logAuditEventToDb } from "./dbService";

export const INITIAL_TAG_CATALOG: IndustrialTagDefinition[] = [
  {
    id: "tag-milling-tch",
    name: "Flujo de Molienda TCH",
    description: "Caudal de caña fresca ingresada a báscula y tándem de molienda",
    area: "MOLIENDA",
    equipmentId: "eq-molino-1",
    equipmentName: "Molino Picador & Tándem 1",
    variable: "TCH_Actual",
    unit: "TCH",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Milling.Tandem.TCH_Actual",
    accessMode: "READ_WRITE",
    scanRateMs: 1000,
    deadband: 0.5,
    engMin: 0,
    engMax: 600,
    historization: true,
    alarmEnabled: true,
    highAlarm: 480,
    lowAlarm: 380,
    highHighAlarm: 520,
    lowLowAlarm: 320,
    securityLevel: 2,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-milling-extraction",
    name: "Extracción Sacarosa Tándem",
    description: "Porcentaje de extracción sacarosa en tándem de 6 molinos",
    area: "MOLIENDA",
    equipmentId: "eq-molino-1",
    equipmentName: "Molino Picador & Tándem 1",
    variable: "Extraction_Percent",
    unit: "%",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Milling.Tandem.Extraction_Percent",
    accessMode: "READ",
    scanRateMs: 2000,
    deadband: 0.1,
    engMin: 80,
    engMax: 100,
    historization: true,
    alarmEnabled: true,
    lowAlarm: 94.0,
    lowLowAlarm: 91.0,
    securityLevel: 2,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-mill3-vibration",
    name: "Vibración Molino 3 Chumacera",
    description: "Monitoreo de vibración triaxial en chumacera principal de reducción Molino 3",
    area: "MOLIENDA",
    equipmentId: "eq-molino-3",
    equipmentName: "Molino 03 Corona Principal",
    variable: "Vibration_RMS",
    unit: "mm/s",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Milling.Mill3.VibrationRMS",
    accessMode: "READ",
    scanRateMs: 500,
    deadband: 0.05,
    engMin: 0,
    engMax: 15,
    historization: true,
    alarmEnabled: true,
    highAlarm: 4.5,
    highHighAlarm: 6.0,
    securityLevel: 2,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-boiler1-steam-press",
    name: "Presión Vapor Alta Presión HP",
    description: "Presión en domo principal Caldera Bagacera Biomasa 1",
    area: "CALDERAS",
    equipmentId: "eq-caldera-1",
    equipmentName: "Caldera Bagacera Biomasa 1",
    variable: "Steam_Pressure_HP",
    unit: "bar",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Boiler1.Drum.Steam_Pressure_HP",
    accessMode: "READ_WRITE",
    scanRateMs: 1000,
    deadband: 0.2,
    engMin: 0,
    engMax: 100,
    historization: true,
    alarmEnabled: true,
    highAlarm: 67.0,
    lowAlarm: 61.0,
    highHighAlarm: 70.0,
    lowLowAlarm: 57.0,
    securityLevel: 3,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-tg1-power-gen",
    name: "Potencia Eléctrica Generada TG1",
    description: "Generación en bornes del turbogenerador de condensación-extracción 1",
    area: "COGENERACION",
    equipmentId: "eq-turbina-1",
    equipmentName: "Turbogenerador TG-01 Siemens 35MW",
    variable: "ActivePower_MW",
    unit: "MW",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Turbine1.Electrical.ActivePower_MW",
    accessMode: "READ",
    scanRateMs: 1000,
    deadband: 0.1,
    engMin: 0,
    engMax: 50,
    historization: true,
    alarmEnabled: true,
    highHighAlarm: 42.0,
    securityLevel: 2,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-grid-export-mw",
    name: "Potencia Despacho Exportación Red",
    description: "Potencia activa exportada en interruptor de interconexión subestación 138kV",
    area: "COGENERACION",
    equipmentId: "eq-turbina-1",
    equipmentName: "Turbogenerador TG-01 Siemens 35MW",
    variable: "ExportPower_MW",
    unit: "MW",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Grid.Substation.ExportPower_MW",
    accessMode: "READ_WRITE",
    scanRateMs: 1000,
    deadband: 0.1,
    engMin: 0,
    engMax: 40,
    historization: true,
    alarmEnabled: true,
    highAlarm: 26.0,
    lowAlarm: 15.0,
    securityLevel: 3,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
  {
    id: "tag-evap-syrup-brix",
    name: "Grados Brix Meladura Evaporadores",
    description: "Concentración en línea del cuerpo 4 de evaporación múltiple efecto",
    area: "EVAPORACION",
    equipmentId: "eq-evaporadores",
    equipmentName: "Estación de Evaporación Cuádruple",
    variable: "Syrup_Brix",
    unit: "°Bx",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "ns=2;s=Evaporator.Body4.Syrup_Brix",
    accessMode: "READ",
    scanRateMs: 2000,
    deadband: 0.2,
    engMin: 40,
    engMax: 85,
    historization: true,
    alarmEnabled: true,
    highAlarm: 70.0,
    lowAlarm: 62.0,
    securityLevel: 2,
    status: "ACTIVE",
    tenantId: "TENANT_AZUCAR_01",
    createdAt: new Date().toISOString(),
  },
];

export class TagManagementService {
  private static instance: TagManagementService;
  private memoryTags: Map<string, IndustrialTagDefinition> = new Map();

  private constructor() {
    INITIAL_TAG_CATALOG.forEach((t) => this.memoryTags.set(t.id, t));
  }

  public static getInstance(): TagManagementService {
    if (!TagManagementService.instance) {
      TagManagementService.instance = new TagManagementService();
    }
    return TagManagementService.instance;
  }

  public async getTags(tenantId?: string): Promise<IndustrialTagDefinition[]> {
    const all = Array.from(this.memoryTags.values());
    if (!tenantId || tenantId === "GLOBAL" || tenantId === "ALL") {
      return all;
    }
    return all.filter((t) => !t.tenantId || t.tenantId === tenantId);
  }

  public async getTagById(tagId: string): Promise<IndustrialTagDefinition | null> {
    return this.memoryTags.get(tagId) || null;
  }

  public async createTag(
    tag: Omit<IndustrialTagDefinition, "id" | "createdAt">,
    user: { role: UserRole; name: string }
  ): Promise<IndustrialTagDefinition> {
    const id = `tag-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTag: IndustrialTagDefinition = {
      ...tag,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memoryTags.set(id, newTag);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "CREATE_TAG",
      module: "TAG_MANAGEMENT",
      targetId: id,
      newValue: JSON.stringify({ name: newTag.name, address: newTag.address, source: newTag.source }),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: newTag.tenantId,
    });

    return newTag;
  }

  public async updateTag(
    tagId: string,
    updates: Partial<IndustrialTagDefinition>,
    user: { role: UserRole; name: string }
  ): Promise<IndustrialTagDefinition | null> {
    const existing = this.memoryTags.get(tagId);
    if (!existing) return null;

    const updated: IndustrialTagDefinition = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.memoryTags.set(tagId, updated);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "UPDATE_TAG_CONFIG",
      module: "TAG_MANAGEMENT",
      targetId: tagId,
      previousValue: JSON.stringify({ name: existing.name, address: existing.address }),
      newValue: JSON.stringify(updates),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: updated.tenantId,
    });

    return updated;
  }

  public async deleteTag(
    tagId: string,
    user: { role: UserRole; name: string }
  ): Promise<boolean> {
    const existing = this.memoryTags.get(tagId);
    if (!existing) return false;

    this.memoryTags.delete(tagId);

    await logAuditEventToDb({
      timestamp: new Date().toISOString(),
      userRole: user.role,
      userName: user.name,
      action: "DELETE_TAG",
      module: "TAG_MANAGEMENT",
      targetId: tagId,
      previousValue: JSON.stringify({ name: existing.name, address: existing.address }),
      status: "EXECUTED",
      ipAddress: "127.0.0.1",
      tenantId: existing.tenantId,
    });

    return true;
  }
}

export const tagManagementService = TagManagementService.getInstance();
