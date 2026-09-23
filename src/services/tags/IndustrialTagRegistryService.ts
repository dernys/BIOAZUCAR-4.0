/**
 * BioAzúcar 4.0 — Hardened Industrial Tag Registry Service
 * 
 * Spec Reference: P0-02 (INDUSTRIAL TAG REGISTRY HARDENING)
 * Governs all industrial instrumentation tags with strict validation, tamper-evident
 * cryptographic hashing, semantic ISA-95 linkage, versioning, and seamless conversion
 * to CanonicalIndustrialDataPoint.
 */

import crypto from "crypto";
import {
  CanonicalIndustrialTagRecord,
  TagCreationInput,
  TagQueryFilter,
  TagApprovalStatus,
} from "../../types/canonicalTagRecord";
import {
  CanonicalIndustrialDataPoint,
  IndustrialRuntimeMode,
  IndustrialDataQuality,
} from "../../types/industrialDataPoint";
import { DiscoveredTag } from "../discovery/types";

export class IndustrialTagRegistryService {
  private static instance: IndustrialTagRegistryService | null = null;
  private tags: Map<string, CanonicalIndustrialTagRecord> = new Map();
  private tagHistory: Map<string, CanonicalIndustrialTagRecord[]> = new Map();

  private constructor() {
    this.seedDefaultIndustrialCatalog();
  }

  public static getInstance(): IndustrialTagRegistryService {
    if (!IndustrialTagRegistryService.instance) {
      IndustrialTagRegistryService.instance = new IndustrialTagRegistryService();
    }
    return IndustrialTagRegistryService.instance;
  }

  public static resetInstance(): void {
    IndustrialTagRegistryService.instance = null;
  }

  /**
   * Registers a new canonical industrial tag record
   */
  public registerTag(input: TagCreationInput): CanonicalIndustrialTagRecord {
    this.validateTagInput(input);

    const now = new Date().toISOString();
    const version = 1;

    const baseRecord: Omit<CanonicalIndustrialTagRecord, "tagIntegrityHash"> = {
      tagId: input.tagId,
      canonicalName: input.canonicalName,
      sourceId: input.sourceId,
      originalAddress: input.originalAddress,
      protocol: input.protocol,
      driver: input.driver,
      tenantId: input.tenantId,
      siteId: input.siteId,
      areaId: input.areaId,
      processId: input.processId,
      assetId: input.assetId,
      deviceId: input.deviceId,
      variable: input.variable,
      dataType: input.dataType,
      engineeringUnit: input.engineeringUnit,
      scale: input.scale ?? 1.0,
      offset: input.offset ?? 0.0,
      min: input.min ?? 0.0,
      max: input.max ?? 100.0,
      deadband: input.deadband ?? 0.1,
      scanRate: input.scanRate ?? 1000,
      timestampSource: input.timestampSource ?? "DEVICE",
      qualityMapping: {
        defaultQuality: input.qualityMapping?.defaultQuality ?? "GOOD",
        badOnOutOfRange: input.qualityMapping?.badOnOutOfRange ?? true,
        badOnStaleTimeoutMs: input.qualityMapping?.badOnStaleTimeoutMs ?? 5000,
        rawErrorCodes: input.qualityMapping?.rawErrorCodes ?? {},
      },
      alarmMapping: {
        enabled: input.alarmMapping?.enabled ?? false,
        high: input.alarmMapping?.high,
        low: input.alarmMapping?.low,
        highHigh: input.alarmMapping?.highHigh,
        lowLow: input.alarmMapping?.lowLow,
        deadband: input.alarmMapping?.deadband ?? 0.5,
        priority: input.alarmMapping?.priority ?? "MEDIUM",
        tripInterlockId: input.alarmMapping?.tripInterlockId,
      },
      criticality: input.criticality ?? "OPERATIONAL",
      semanticClass: input.semanticClass ?? "PROCESS_VARIABLE",
      safetyClassification: input.safetyClassification ?? "BPCS",
      calibrationState: input.calibrationState ?? "CALIBRATED",
      owner: input.owner,
      approvalStatus: input.approvalStatus ?? "APPROVED",
      version,
      effectiveFrom: now,
      metadata: input.metadata,
    };

    const tagIntegrityHash = this.computeTagHash(baseRecord);
    const record: CanonicalIndustrialTagRecord = {
      ...baseRecord,
      tagIntegrityHash,
    };

    this.tags.set(record.tagId, record);
    this.tagHistory.set(record.tagId, [record]);

    return record;
  }

  /**
   * Updates an existing tag, creating a new immutable version and retiring the previous version
   */
  public updateTag(
    tagId: string,
    updates: Partial<TagCreationInput>,
    approvedBy: string
  ): CanonicalIndustrialTagRecord {
    const existing = this.tags.get(tagId);
    if (!existing) {
      throw new Error(`Tag industrial '${tagId}' no encontrado para actualización.`);
    }

    const now = new Date().toISOString();

    // Retire current version
    const retiredVersion: CanonicalIndustrialTagRecord = {
      ...existing,
      effectiveTo: now,
    };

    const history = this.tagHistory.get(tagId) || [];
    const updatedHistory = history.map((item) =>
      item.version === existing.version ? retiredVersion : item
    );
    if (!updatedHistory.some((item) => item.version === existing.version)) {
      updatedHistory.push(retiredVersion);
    }
    this.tagHistory.set(tagId, updatedHistory);

    // Create new version
    const newVersion = existing.version + 1;
    const baseRecord: Omit<CanonicalIndustrialTagRecord, "tagIntegrityHash"> = {
      ...existing,
      canonicalName: updates.canonicalName ?? existing.canonicalName,
      sourceId: updates.sourceId ?? existing.sourceId,
      originalAddress: updates.originalAddress ?? existing.originalAddress,
      protocol: updates.protocol ?? existing.protocol,
      driver: updates.driver ?? existing.driver,
      tenantId: updates.tenantId ?? existing.tenantId,
      siteId: updates.siteId ?? existing.siteId,
      areaId: updates.areaId ?? existing.areaId,
      processId: updates.processId ?? existing.processId,
      assetId: updates.assetId ?? existing.assetId,
      deviceId: updates.deviceId ?? existing.deviceId,
      variable: updates.variable ?? existing.variable,
      dataType: updates.dataType ?? existing.dataType,
      engineeringUnit: updates.engineeringUnit ?? existing.engineeringUnit,
      scale: updates.scale ?? existing.scale,
      offset: updates.offset ?? existing.offset,
      min: updates.min ?? existing.min,
      max: updates.max ?? existing.max,
      deadband: updates.deadband ?? existing.deadband,
      scanRate: updates.scanRate ?? existing.scanRate,
      timestampSource: updates.timestampSource ?? existing.timestampSource,
      qualityMapping: {
        ...existing.qualityMapping,
        ...(updates.qualityMapping || {}),
      },
      alarmMapping: {
        ...existing.alarmMapping,
        ...(updates.alarmMapping || {}),
      },
      criticality: updates.criticality ?? existing.criticality,
      semanticClass: updates.semanticClass ?? existing.semanticClass,
      safetyClassification: updates.safetyClassification ?? existing.safetyClassification,
      calibrationState: updates.calibrationState ?? existing.calibrationState,
      owner: approvedBy,
      approvalStatus: updates.approvalStatus ?? "APPROVED",
      version: newVersion,
      effectiveFrom: now,
      effectiveTo: undefined,
      metadata: {
        ...existing.metadata,
        ...(updates.metadata || {}),
        lastModifiedBy: approvedBy,
      },
    };

    const tagIntegrityHash = this.computeTagHash(baseRecord);
    const updatedRecord: CanonicalIndustrialTagRecord = {
      ...baseRecord,
      tagIntegrityHash,
    };

    this.tags.set(tagId, updatedRecord);
    const currentHist = this.tagHistory.get(tagId) || [];
    currentHist.push(updatedRecord);
    this.tagHistory.set(tagId, currentHist);
    return updatedRecord;
  }

  /**
   * Transitions a tag to DEPRECATED
   */
  public deprecateTag(tagId: string, reason: string, approvedBy: string): boolean {
    const existing = this.tags.get(tagId);
    if (!existing) return false;

    this.updateTag(
      tagId,
      {
        approvalStatus: "DEPRECATED",
        metadata: { deprecationReason: reason, deprecatedBy: approvedBy },
      },
      approvedBy
    );
    return true;
  }

  public getTag(tagId: string): CanonicalIndustrialTagRecord | undefined {
    return this.tags.get(tagId);
  }

  public getAllTags(): CanonicalIndustrialTagRecord[] {
    return Array.from(this.tags.values());
  }

  public getTagHistory(tagId: string): CanonicalIndustrialTagRecord[] {
    return this.tagHistory.get(tagId) || [];
  }

  /**
   * Queries tags using multi-dimensional filters
   */
  public findTags(filter: TagQueryFilter): CanonicalIndustrialTagRecord[] {
    return Array.from(this.tags.values()).filter((tag) => {
      if (filter.tenantId && tag.tenantId !== filter.tenantId) return false;
      if (filter.siteId && tag.siteId !== filter.siteId) return false;
      if (filter.areaId && tag.areaId !== filter.areaId) return false;
      if (filter.processId && tag.processId !== filter.processId) return false;
      if (filter.assetId && tag.assetId !== filter.assetId) return false;
      if (filter.deviceId && tag.deviceId !== filter.deviceId) return false;
      if (filter.protocol && tag.protocol !== filter.protocol) return false;
      if (filter.criticality && tag.criticality !== filter.criticality) return false;
      if (filter.semanticClass && tag.semanticClass !== filter.semanticClass) return false;
      if (filter.approvalStatus && tag.approvalStatus !== filter.approvalStatus) return false;
      if (filter.searchQuery) {
        const q = filter.searchQuery.toLowerCase();
        const matchName = tag.canonicalName.toLowerCase().includes(q);
        const matchAddr = tag.originalAddress.toLowerCase().includes(q);
        const matchVar = tag.variable.toLowerCase().includes(q);
        const matchId = tag.tagId.toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchVar && !matchId) return false;
      }
      return true;
    });
  }

  /**
   * Transforms raw telemetry into a compliant CanonicalIndustrialDataPoint (17 fields)
   * using the canonical tag configuration.
   */
  public createDataPointFromTag(
    tagId: string,
    rawValue: number | boolean | string,
    options?: {
      runtimeMode?: IndustrialRuntimeMode;
      deviceTimestamp?: string;
      rawQuality?: IndustrialDataQuality;
    }
  ): CanonicalIndustrialDataPoint {
    const tag = this.tags.get(tagId);
    if (!tag) {
      throw new Error(`No se puede generar CanonicalIndustrialDataPoint: Tag '${tagId}' no registrado.`);
    }

    const runtimeMode = options?.runtimeMode ?? "PRODUCTION";
    const now = new Date().toISOString();
    const deviceTimestamp = options?.deviceTimestamp ?? now;

    // Apply scale and offset
    let engineeringValue: number | boolean | string = rawValue;
    if (typeof rawValue === "number") {
      engineeringValue = rawValue * tag.scale + tag.offset;
    }

    // Determine quality
    let quality: IndustrialDataQuality = options?.rawQuality ?? tag.qualityMapping.defaultQuality;
    let qualityReason: string = "NORMAL";

    if (
      typeof engineeringValue === "number" &&
      tag.qualityMapping.badOnOutOfRange &&
      (engineeringValue < tag.min || engineeringValue > tag.max)
    ) {
      quality = "OUT_OF_RANGE";
      qualityReason = `Valor ${engineeringValue} fuera del rango [${tag.min}, ${tag.max}]`;
    }

    return {
      runtimeMode,
      sourceType: "PLC",
      sourceId: tag.sourceId,
      driverId: tag.driver,
      protocol: tag.protocol,
      deviceId: tag.deviceId,
      assetId: tag.assetId,
      tagId: tag.tagId,
      value: engineeringValue,
      engineeringUnit: tag.engineeringUnit,
      dataType: tag.dataType,
      deviceTimestamp,
      ingestionTimestamp: now,
      sequence: 1,
      quality,
      qualityReason,
      calibrationState: tag.calibrationState,
      schemaVersion: "1.0.0",
    };
  }

  /**
   * Imports discovered tags from P0-01 Discovery Engine into canonical tag records
   */
  public importFromDiscoveredTags(
    discovered: DiscoveredTag[],
    context: {
      tenantId: string;
      siteId: string;
      areaId: string;
      processId: string;
      assetId: string;
      owner: string;
      defaultDriver?: string;
    }
  ): CanonicalIndustrialTagRecord[] {
    const created: CanonicalIndustrialTagRecord[] = [];

    for (const d of discovered) {
      const tagId = `tag-${d.variable.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const record = this.registerTag({
        tagId,
        canonicalName: d.canonicalName,
        sourceId: d.sourceId,
        originalAddress: d.originalAddress,
        protocol: d.protocol,
        driver: context.defaultDriver || `driver-${d.protocol.toLowerCase()}`,
        tenantId: context.tenantId,
        siteId: context.siteId,
        areaId: context.areaId,
        processId: context.processId,
        assetId: context.assetId,
        deviceId: d.deviceId,
        variable: d.variable,
        dataType: d.dataType,
        engineeringUnit: d.engineeringUnit,
        min: d.min ?? 0,
        max: d.max ?? 100,
        deadband: d.deadband ?? 0.1,
        scanRate: d.scanRateMs ?? 1000,
        alarmMapping: d.alarmInfo ? {
          enabled: d.alarmInfo.alarmEnabled,
          high: d.alarmInfo.highLimit,
          low: d.alarmInfo.lowLimit,
          highHigh: d.alarmInfo.highHighLimit,
          lowLow: d.alarmInfo.lowLowLimit,
        } : undefined,
        owner: context.owner,
        approvalStatus: "APPROVED",
        metadata: d.metadata,
      });
      created.push(record);
    }

    return created;
  }

  private validateTagInput(input: TagCreationInput): void {
    if (!input.tagId || input.tagId.trim().length === 0) {
      throw new Error("tagId es obligatorio y no puede estar vacío.");
    }
    if (!input.canonicalName || input.canonicalName.trim().length === 0) {
      throw new Error("canonicalName es obligatorio.");
    }
    if (!input.sourceId) throw new Error("sourceId es obligatorio.");
    if (!input.originalAddress) throw new Error("originalAddress es obligatorio.");
    if (!input.tenantId) throw new Error("tenantId es obligatorio.");
    if (!input.siteId) throw new Error("siteId es obligatorio.");
    if (!input.areaId) throw new Error("areaId es obligatorio.");
    if (!input.processId) throw new Error("processId es obligatorio.");
    if (!input.assetId) throw new Error("assetId es obligatorio.");
    if (!input.deviceId) throw new Error("deviceId es obligatorio.");
    if (!input.variable) throw new Error("variable es obligatoria.");
    if (!input.dataType) throw new Error("dataType es obligatorio.");
    if (!input.engineeringUnit) throw new Error("engineeringUnit es obligatoria.");
  }

  private computeTagHash(tag: Omit<CanonicalIndustrialTagRecord, "tagIntegrityHash">): string {
    const payload = [
      tag.tagId,
      tag.canonicalName,
      tag.sourceId,
      tag.originalAddress,
      tag.protocol,
      tag.tenantId,
      tag.siteId,
      tag.areaId,
      tag.assetId,
      tag.dataType,
      tag.engineeringUnit,
      tag.scale,
      tag.offset,
      tag.min,
      tag.max,
      tag.version,
    ].join("|");

    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  private computePointHash(tagId: string, value: unknown, timestamp: string): string {
    return crypto
      .createHash("sha256")
      .update(`${tagId}|${value}|${timestamp}`)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Seeds realistic sugar mill industrial instrumentation tags
   */
  private seedDefaultIndustrialCatalog(): void {
    const defaultTags: TagCreationInput[] = [
      {
        tagId: "tag-milling-tch",
        canonicalName: "Flujo de Molienda TCH Caña Fresca",
        sourceId: "src-opcua-central",
        originalAddress: "ns=2;s=Milling.Tandem.TCH_Actual",
        protocol: "OPC_UA",
        driver: "OpcUaDriver",
        tenantId: "ingenio-central",
        siteId: "planta-azucarera-01",
        areaId: "MOLIENDA",
        processId: "PROC_EXTRACCION_JUGO",
        assetId: "TANDEM_MOLINOS_01",
        deviceId: "PLC_MOLIENDA_01",
        variable: "TCH_Actual",
        dataType: "FLOAT",
        engineeringUnit: "TCH",
        scale: 1.0,
        offset: 0.0,
        min: 0,
        max: 600,
        deadband: 0.5,
        scanRate: 1000,
        timestampSource: "DEVICE",
        criticality: "SAFETY_CRITICAL",
        semanticClass: "PROCESS_VARIABLE",
        safetyClassification: "BPCS",
        calibrationState: "CALIBRATED",
        owner: "lead-instrumentation@ingenio.local",
        alarmMapping: {
          enabled: true,
          low: 350,
          lowLow: 300,
          high: 500,
          highHigh: 550,
          priority: "HIGH",
        },
      },
      {
        tagId: "tag-boiler1-steam-pressure",
        canonicalName: "Presión Vapor Principal Domo Caldera 1",
        sourceId: "src-opcua-boilers",
        originalAddress: "ns=2;s=Boiler1.Main_Steam_Pressure",
        protocol: "OPC_UA",
        driver: "OpcUaDriver",
        tenantId: "ingenio-central",
        siteId: "planta-azucarera-01",
        areaId: "CALDERAS",
        processId: "PROC_GENERACION_VAPOR",
        assetId: "CALDERA_BAGACERA_01",
        deviceId: "PLC_CALDERA_01",
        variable: "Main_Steam_Pressure",
        dataType: "FLOAT",
        engineeringUnit: "bar",
        min: 0,
        max: 60,
        deadband: 0.2,
        scanRate: 500,
        timestampSource: "DEVICE",
        criticality: "SAFETY_CRITICAL",
        semanticClass: "PROCESS_VARIABLE",
        safetyClassification: "SIL2",
        calibrationState: "CALIBRATED",
        owner: "supervisor-energia@ingenio.local",
        alarmMapping: {
          enabled: true,
          low: 38.0,
          lowLow: 34.0,
          high: 48.0,
          highHigh: 52.0,
          priority: "CRITICAL",
          tripInterlockId: "INTLK_TRIP_BOILER1_OVERPRESSURE",
        },
      },
      {
        tagId: "tag-weighbridge-gross-weight",
        canonicalName: "Báscula Batey Peso Bruto Entrada",
        sourceId: "src-modbus-batey",
        originalAddress: "holding:40001:FLOAT32",
        protocol: "MODBUS_TCP",
        driver: "ModbusTcpDriver",
        tenantId: "ingenio-central",
        siteId: "planta-azucarera-01",
        areaId: "RECEPCION_CANA",
        processId: "PROC_PESAJE_BATEY",
        assetId: "BASCULA_CAMIONES_01",
        deviceId: "IND780_WEIGHBRIDGE_01",
        variable: "GrossWeight",
        dataType: "FLOAT",
        engineeringUnit: "t",
        min: 0,
        max: 80,
        deadband: 0.05,
        scanRate: 500,
        timestampSource: "GATEWAY",
        criticality: "FINANCIAL",
        semanticClass: "PROCESS_VARIABLE",
        safetyClassification: "NONE",
        calibrationState: "CALIBRATED",
        owner: "jefe-batey@ingenio.local",
      },
    ];

    for (const tag of defaultTags) {
      this.registerTag(tag);
    }
  }
}
