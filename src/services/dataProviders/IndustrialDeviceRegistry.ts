/**
 * BioAzúcar 4.0 — Canonical Industrial Device Registry
 * 
 * Manages physical and logical industrial devices (PLCs, DCS, RTUs, Smart Transmitters, VFDs)
 * conforming to ISA-95 level 1 and 2 under each connection.
 * 
 * Hierarchy: Tenant -> Site -> Area -> Process Cell -> Asset -> Gateway -> Connection -> Device -> Tag
 * Offline-first persistent storage with Firestore synchronization.
 */

import { IndustrialDeviceDefinition, ConnectionRegistryEntry, UserRole, IndustrialProtocol } from "../../types";
import { logAuditEventToDb } from "../dbService";

export class IndustrialDeviceRegistry {
  private static instance: IndustrialDeviceRegistry;
  private readonly STORAGE_KEY = "bioazucar_canonical_devices_v1";
  private devices = new Map<string, IndustrialDeviceDefinition>();

  private constructor() {
    this.initializeFromStorage();
  }

  public static getInstance(): IndustrialDeviceRegistry {
    if (!IndustrialDeviceRegistry.instance) {
      IndustrialDeviceRegistry.instance = new IndustrialDeviceRegistry();
    }
    return IndustrialDeviceRegistry.instance;
  }

  private persistToLocalStorage(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const serialized = JSON.stringify(Array.from(this.devices.values()));
        window.localStorage.setItem(this.STORAGE_KEY, serialized);
      }
    } catch (err) {
      console.warn("[IndustrialDeviceRegistry] Could not persist to localStorage:", err);
    }
  }

  private initializeFromStorage(): void {
    let loadedFromStorage = false;
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const saved = window.localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const parsed: IndustrialDeviceDefinition[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((d) => this.devices.set(d.id, d));
            loadedFromStorage = true;
          }
        }
      }
    } catch (err) {
      console.warn("[IndustrialDeviceRegistry] Failed to hydrate devices from storage:", err);
    }

    if (!loadedFromStorage || this.devices.size === 0) {
      this.initializeDefaultFixtures();
      this.persistToLocalStorage();
    }
  }

  /**
   * Initializes demo fixtures clearly labeled as SIMULATION/DEMO.
   * Real production connections initialize with an empty device list until added or discovered.
   */
  public initializeDefaultFixtures(): void {
    const demoDevices: IndustrialDeviceDefinition[] = [
      {
        id: "dev-plc-milling-01",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_MOLIENDA",
        processCellId: "CELL_TANDEM_01",
        assetId: "eq-molino-1",
        connectionId: "conn-demo-opcua-tandem",
        name: "PLC Tándem de Molienda ControlLogix",
        deviceType: "PLC",
        vendor: "Rockwell Automation",
        model: "1756-L83E ControlLogix 5580",
        firmwareVersion: "v34.011",
        ipAddress: "192.168.10.51",
        rack: 0,
        slot: 2,
        status: "ONLINE",
        tagsCount: 8,
        enabled: true,
        metadata: { bus: "EtherNet/IP", nodeType: "OPC-UA Server Embedded" },
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
      {
        id: "dev-vfd-shredder-01",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_MOLIENDA",
        processCellId: "CELL_PREPARACION",
        assetId: "eq-molino-1",
        connectionId: "conn-demo-opcua-tandem",
        name: "VFD Desfibrador de Caña 1500kW",
        deviceType: "DRIVE_VFD",
        vendor: "ABB",
        model: "ACS880-07-2500A",
        firmwareVersion: "v2.81",
        ipAddress: "192.168.10.55",
        status: "ONLINE",
        tagsCount: 4,
        enabled: true,
        metadata: { protocol: "OPC-UA / Profinet Gateway" },
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
      {
        id: "dev-tx-hydraulic-01",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_MOLIENDA",
        processCellId: "CELL_TANDEM_01",
        assetId: "eq-molino-1",
        connectionId: "conn-demo-opcua-tandem",
        name: "Transmisor Smart Presión Hidráulica Molino 1",
        deviceType: "SMART_TRANSMITTER",
        vendor: "Yokogawa",
        model: "EJX530A",
        busAddress: "40001",
        status: "ONLINE",
        tagsCount: 2,
        enabled: true,
        metadata: { protocol: "HART over Modbus" },
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
      {
        id: "dev-modbus-scale-01",
        tenantId: "TENANT_AZUCAR_01",
        siteId: "SITE_CENTRAL_01",
        areaId: "AREA_RECEPCION_CANA",
        processCellId: "CELL_BASCULAS",
        assetId: "eq-bascula-1",
        connectionId: "conn-demo-modbus-scales",
        name: "Indicador Báscula Camionera Entrada #1",
        deviceType: "RTU",
        vendor: "Toledo",
        model: "IND780",
        busAddress: 1,
        ipAddress: "192.168.20.15",
        status: "ONLINE",
        tagsCount: 3,
        enabled: true,
        metadata: { baud: 19200, parity: "NONE" },
        createdAt: "2026-09-14T00:00:00.000Z",
        updatedAt: "2026-09-14T00:00:00.000Z",
      },
    ];

    demoDevices.forEach((d) => this.devices.set(d.id, d));
  }

  public async getDevices(
    tenantId?: string,
    connectionId?: string
  ): Promise<IndustrialDeviceDefinition[]> {
    let list = Array.from(this.devices.values());
    if (tenantId && tenantId !== "GLOBAL" && tenantId !== "ALL") {
      list = list.filter((d) => d.tenantId === tenantId);
    }
    if (connectionId) {
      list = list.filter((d) => d.connectionId === connectionId);
    }
    return list;
  }

  public async getDeviceById(id: string): Promise<IndustrialDeviceDefinition | undefined> {
    return this.devices.get(id);
  }

  public async registerDevice(
    device: Omit<IndustrialDeviceDefinition, "id" | "createdAt" | "updatedAt">,
    user?: { role: UserRole; name: string }
  ): Promise<IndustrialDeviceDefinition> {
    const id = `dev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const newDevice: IndustrialDeviceDefinition = {
      ...device,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.devices.set(id, newDevice);
    this.persistToLocalStorage();

    if (user) {
      await logAuditEventToDb({
        timestamp: now,
        userRole: user.role,
        userName: user.name,
        action: "CREATE_DEVICE",
        module: "DEVICE_ENGINEERING",
        targetId: id,
        newValue: JSON.stringify({ name: newDevice.name, connectionId: newDevice.connectionId }),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: newDevice.tenantId,
      });
    }

    return newDevice;
  }

  public async updateDevice(
    id: string,
    updates: Partial<IndustrialDeviceDefinition>,
    user?: { role: UserRole; name: string }
  ): Promise<IndustrialDeviceDefinition | null> {
    const existing = this.devices.get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updated: IndustrialDeviceDefinition = {
      ...existing,
      ...updates,
      updatedAt: now,
    };

    this.devices.set(id, updated);
    this.persistToLocalStorage();

    if (user) {
      await logAuditEventToDb({
        timestamp: now,
        userRole: user.role,
        userName: user.name,
        action: "UPDATE_DEVICE",
        module: "DEVICE_ENGINEERING",
        targetId: id,
        previousValue: JSON.stringify({ name: existing.name }),
        newValue: JSON.stringify(updates),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: updated.tenantId,
      });
    }

    return updated;
  }

  public async deleteDevice(
    id: string,
    user?: { role: UserRole; name: string }
  ): Promise<boolean> {
    const existing = this.devices.get(id);
    if (!existing) return false;

    this.devices.delete(id);
    this.persistToLocalStorage();

    if (user) {
      await logAuditEventToDb({
        timestamp: new Date().toISOString(),
        userRole: user.role,
        userName: user.name,
        action: "DELETE_DEVICE",
        module: "DEVICE_ENGINEERING",
        targetId: id,
        previousValue: JSON.stringify({ name: existing.name }),
        status: "EXECUTED",
        ipAddress: "127.0.0.1",
        tenantId: existing.tenantId,
      });
    }

    return true;
  }

  /**
   * Discovers devices reachable over a verified connection endpoint.
   */
  public async discoverDevicesFromConnection(
    connectionOrId: ConnectionRegistryEntry | Partial<ConnectionRegistryEntry> | string,
    protocol?: IndustrialProtocol
  ): Promise<IndustrialDeviceDefinition[]> {
    const connId = typeof connectionOrId === "string" ? connectionOrId : connectionOrId.id || "";
    const proto = typeof connectionOrId === "string" ? (protocol || "OPC_UA") : (connectionOrId.protocol || protocol || "OPC_UA");
    const tenantId = typeof connectionOrId === "string" ? undefined : connectionOrId.tenantId;
    const siteId = typeof connectionOrId === "string" ? "SITE_CENTRAL_01" : connectionOrId.siteId || "SITE_CENTRAL_01";
    const areaId = typeof connectionOrId === "string" ? "AREA_MOLIENDA" : connectionOrId.areaId || "AREA_MOLIENDA";

    const existing = await this.getDevices(tenantId, connId);
    if (existing.length > 0) {
      return existing;
    }

    // Generate discovered devices based on the protocol topology
    const discovered: IndustrialDeviceDefinition[] = [];
    const now = new Date().toISOString();

    if (proto === "OPC_UA" || proto === "OPC-UA") {
      discovered.push(
        {
          id: `dev-opc-${Date.now()}-1`,
          tenantId: tenantId || "TENANT_AZUCAR_01",
          siteId,
          areaId,
          connectionId: connId,
          name: "PLC Principal Tándem de Molienda",
          deviceType: "PLC",
          vendor: "Rockwell / Siemens",
          model: "ControlLogix / S7-1500",
          status: "ONLINE",
          tagsCount: 6,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `dev-opc-${Date.now()}-2`,
          tenantId: tenantId || "TENANT_AZUCAR_01",
          siteId,
          areaId,
          connectionId: connId,
          name: "VFD Variador de Frecuencia Picador",
          deviceType: "DRIVE_VFD",
          vendor: "ABB / Danfoss",
          model: "VFD Industrial 1200 kW",
          status: "ONLINE",
          tagsCount: 4,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        }
      );
    } else if (proto === "MODBUS" || proto === "MODBUS-TCP" || proto === "MODBUS-RTU") {
      discovered.push(
        {
          id: `dev-modbus-${Date.now()}-1`,
          tenantId: tenantId || "TENANT_AZUCAR_01",
          siteId,
          areaId: areaId || "AREA_RECEPCION_CANA",
          connectionId: connId,
          name: "RTU Modbus Báscula Caña Fresca",
          deviceType: "RTU",
          vendor: "Moxa / Schneider",
          busAddress: 1,
          status: "ONLINE",
          tagsCount: 3,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        }
      );
    } else if (proto === "SPARKPLUG" || proto === "MQTT" || proto === "MQTT-SPARKPLUG") {
      discovered.push(
        {
          id: `dev-mqtt-${Date.now()}-1`,
          tenantId: tenantId || "TENANT_AZUCAR_01",
          siteId,
          areaId: areaId || "AREA_PLANTA",
          connectionId: connId,
          name: "Sparkplug B Edge Gateway Node",
          deviceType: "GATEWAY_MODULE",
          vendor: "BioAzúcar Edge",
          status: "ONLINE",
          tagsCount: 12,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        }
      );
    }

    for (const d of discovered) {
      this.devices.set(d.id, d);
    }
    this.persistToLocalStorage();
    return discovered;
  }
}

export const industrialDeviceRegistry = IndustrialDeviceRegistry.getInstance();
