import { describe, it, expect } from "vitest";
import {
  ConnectionRegistryEntry,
  IndustrialTagDefinition,
  IndustrialTagSample,
  TenantEnterprise,
} from "../types";
import {
  validateConnectionRegistryEntry,
  validateIndustrialTagDefinition,
  validateIndustrialTagSample,
} from "../services/dataProviders/IndustrialRegistryValidator";
import {
  normalizeTenantOperationalFields,
  resolveTenantOperationalMode,
  resolveTenantOperationalStatus,
} from "../services/otInfrastructureService";

describe("Fase 2: Connection Registry & Industrial Tag Registry", () => {
  // Test fixture base connection
  const sampleConnection: ConnectionRegistryEntry = {
    id: "conn-site01-opcua-01",
    tenantId: "tenant-ingenio-01",
    siteId: "site-central",
    name: "OPC UA Tandem Molinos Server",
    protocol: "OPC_UA",
    endpoint: "opc.tcp://192.168.10.50:4840",
    gatewayId: "gw-edge-site01-01",
    status: "CONNECTED",
    criticality: "CRITICAL",
    readOnly: true,
    enabled: true,
    expectedIntervalMs: 1000,
    maxSilenceMs: 5000,
    latencyBudgetMs: 500,
    createdAt: "2026-09-13T10:00:00.000Z",
    updatedAt: "2026-09-13T10:00:00.000Z",
    configVersion: "1.0.0",
    certificateRef: "vault://tenants/tenant-ingenio-01/certs/opcua-client-cert",
    secretRef: "vault://tenants/tenant-ingenio-01/secrets/opcua-app-key",
  };

  // Test fixture base tag
  const sampleTag: IndustrialTagDefinition = {
    id: "tag-tandem-m1-hydraulic-pressure",
    tenantId: "tenant-ingenio-01",
    siteId: "site-central",
    areaId: "area-molienda",
    assetId: "asset-molino-01",
    connectionId: "conn-site01-opcua-01",
    canonicalName: "MOLINO_01.PRESION_CHUMACERA_CABECERA",
    displayName: "Presión Hidráulica Chumacera Superior M1",
    sourceSystem: "TANDEM_PLC_01",
    sourceAddress: "ns=2;s=Mill1.Hydraulics.PressureBar",
    protocol: "OPC_UA",
    dataType: "NUMBER",
    unit: "bar",
    scale: 1,
    offset: 0,
    readable: true,
    writable: false,
    samplingIntervalMs: 1000,
    engineeringRange: {
      min: 0,
      max: 350,
      warningLow: 150,
      warningHigh: 280,
      alarmLow: 100,
      alarmHigh: 310,
    },
    historianEnabled: true,
    analyticsEnabled: true,
    prometheusEnabled: true,
    criticality: "CRITICAL",
    enabled: true,
    createdAt: "2026-09-13T10:00:00.000Z",
    updatedAt: "2026-09-13T10:00:00.000Z",
    version: "1.0.0",
  };

  // --------------------------------------------------------------------------
  // 1. Aislamiento por Tenant (Tenant Isolation)
  // --------------------------------------------------------------------------
  it("Valida exitosamente una conexión y tag válidos que pertenecen al mismo tenant", () => {
    const connValidation = validateConnectionRegistryEntry(sampleConnection);
    expect(connValidation.isValid).toBe(true);
    expect(connValidation.errors).toHaveLength(0);

    const tagValidation = validateIndustrialTagDefinition(sampleTag, {
      connection: sampleConnection,
    });
    expect(tagValidation.isValid).toBe(true);
    expect(tagValidation.errors).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // 2. Conexión perteneciente a otro tenant (Cross-tenant rejection)
  // --------------------------------------------------------------------------
  it("Rechaza un tag asociado a una conexión perteneciente a otro tenant", () => {
    const foreignConnection: ConnectionRegistryEntry = {
      ...sampleConnection,
      id: "conn-foreign-01",
      tenantId: "tenant-otro-ingenio-99", // Tenant diferente
    };

    const validation = validateIndustrialTagDefinition(sampleTag, {
      connection: foreignConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("aislamiento multi-inquilino"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. Tag perteneciente a otro tenant en muestra (Sample Cross-tenant rejection)
  // --------------------------------------------------------------------------
  it("Rechaza una muestra (sample) cuyo tenantId difiere del tag o de la conexión", () => {
    const sample: IndustrialTagSample = {
      tagId: sampleTag.id,
      tenantId: "tenant-hacker-infiltrated", // Tenant discordante
      connectionId: sampleConnection.id,
      value: 215.4,
      unit: "bar",
      quality: "GOOD",
      availability: "AVAILABLE",
      validationStatus: "PASSED",
      origin: "LIVE_OT",
      sourceSystem: "TANDEM_PLC_01",
      sourceDevice: "PLC_SIEMENS_S7_1500",
      gatewayId: "gw-edge-site01-01",
      sourceTimestamp: "2026-09-13T10:15:30.120Z",
      gatewayTimestamp: "2026-09-13T10:15:30.145Z",
      ingestionTimestamp: "2026-09-13T10:15:30.190Z",
    };

    const validationWithTag = validateIndustrialTagSample(sample, {
      tag: sampleTag,
      connection: sampleConnection,
    });

    expect(validationWithTag.isValid).toBe(false);
    expect(validationWithTag.errors.some((e) => e.includes("aislamiento multi-inquilino"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. CanonicalName duplicado dentro del mismo tenant y site
  // --------------------------------------------------------------------------
  it("Detecta y rechaza canonicalName duplicado en el mismo tenant y site", () => {
    const duplicateTag: IndustrialTagDefinition = {
      ...sampleTag,
      id: "tag-duplicate-id",
      canonicalName: "MOLINO_01.PRESION_CHUMACERA_CABECERA", // Mismo canonicalName
    };

    const validation = validateIndustrialTagDefinition(duplicateTag, {
      connection: sampleConnection,
      existingTags: [sampleTag],
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Violación de unicidad"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. SourceAddress obligatorio cuando corresponde
  // --------------------------------------------------------------------------
  it("Exige obligatoriamente sourceAddress en protocolos industriales físicos (OPC_UA, MODBUS, etc.)", () => {
    const tagWithoutAddress: IndustrialTagDefinition = {
      ...sampleTag,
      sourceAddress: "", // Vacío
    };

    const validation = validateIndustrialTagDefinition(tagWithoutAddress, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("requiere especificar obligatoriamente 'sourceAddress'"))).toBe(true);
  });

  it("Permite sourceAddress opcional en protocolo SIMULATED", () => {
    const simConnection: ConnectionRegistryEntry = {
      ...sampleConnection,
      id: "conn-sim-01",
      protocol: "SIMULATED",
    };
    const simTag: IndustrialTagDefinition = {
      ...sampleTag,
      connectionId: "conn-sim-01",
      protocol: "SIMULATED",
      sourceAddress: "", // Vacío permitido en SIMULATED
    };

    const validation = validateIndustrialTagDefinition(simTag, {
      connection: simConnection,
    });

    expect(validation.isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. Protocolo incompatible entre Tag y Conexión
  // --------------------------------------------------------------------------
  it("Rechaza tag cuyo protocolo difiere del protocolo de la conexión asociada", () => {
    const modbusTag: IndustrialTagDefinition = {
      ...sampleTag,
      protocol: "MODBUS", // Conexión es OPC_UA
      sourceAddress: "40001",
    };

    const validation = validateIndustrialTagDefinition(modbusTag, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Protocolo incompatible"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 7. EngineeringRange numérico inválido (min >= max)
  // --------------------------------------------------------------------------
  it("Rechaza un engineeringRange numérico donde min >= max", () => {
    const invalidRangeTag: IndustrialTagDefinition = {
      ...sampleTag,
      engineeringRange: {
        min: 300,
        max: 100, // min > max inválido
      },
    };

    const validation = validateIndustrialTagDefinition(invalidRangeTag, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Rango de ingeniería inválido"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 8. Tipo STRING no debe contener engineeringRange numérico
  // --------------------------------------------------------------------------
  it("Rechaza engineeringRange numérico en tags de tipo STRING", () => {
    const stringTagWithRange: IndustrialTagDefinition = {
      ...sampleTag,
      dataType: "STRING",
      engineeringRange: {
        min: 0,
        max: 100,
      },
    };

    const validation = validateIndustrialTagDefinition(stringTagWithRange, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Los tipos no numéricos ('STRING') no deben definir rangos"))).toBe(true);
  });

  it("Acepta tags de tipo STRING sin engineeringRange numérico", () => {
    const validStringTag: IndustrialTagDefinition = {
      ...sampleTag,
      dataType: "STRING",
      unit: "text",
      engineeringRange: undefined, // Correcto
    };

    const validation = validateIndustrialTagDefinition(validStringTag, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 9. SamplingInterval inválido
  // --------------------------------------------------------------------------
  it("Rechaza samplingIntervalMs menor o igual a 0", () => {
    const invalidIntervalTag: IndustrialTagDefinition = {
      ...sampleTag,
      samplingIntervalMs: 0,
    };

    const validation = validateIndustrialTagDefinition(invalidIntervalTag, {
      connection: sampleConnection,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("samplingIntervalMs"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 10. MaxSilenceMs inválido en ConnectionRegistryEntry (maxSilenceMs <= expectedIntervalMs)
  // --------------------------------------------------------------------------
  it("Rechaza conexión donde maxSilenceMs <= expectedIntervalMs", () => {
    const invalidSlaConn: ConnectionRegistryEntry = {
      ...sampleConnection,
      expectedIntervalMs: 2000,
      maxSilenceMs: 1500, // Menor que expectedIntervalMs
    };

    const validation = validateConnectionRegistryEntry(invalidSlaConn);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("SLA inválido"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 11. Writable false por defecto
  // --------------------------------------------------------------------------
  it("Verifica que writable sea false en tags de telemetría de monitoreo", () => {
    expect(sampleTag.writable).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 12. Timestamps de muestra de 3 fases (source, gateway, ingestion)
  // --------------------------------------------------------------------------
  it("Valida los 3 timestamps obligatorios de procedencia temporal en la muestra", () => {
    const validSample: IndustrialTagSample = {
      tagId: sampleTag.id,
      tenantId: sampleTag.tenantId,
      connectionId: sampleConnection.id,
      value: 180.5,
      quality: "GOOD",
      availability: "AVAILABLE",
      validationStatus: "PASSED",
      origin: "LIVE_OT",
      sourceSystem: "TANDEM_PLC",
      sourceDevice: "PLC_S7_1500",
      gatewayId: "gw-edge-site01-01",
      sourceTimestamp: "2026-09-13T10:00:00.000Z",
      gatewayTimestamp: "2026-09-13T10:00:00.020Z",
      ingestionTimestamp: "2026-09-13T10:00:00.050Z",
    };

    const validation = validateIndustrialTagSample(validSample);
    expect(validation.isValid).toBe(true);

    // Timestamps corruptos
    const corruptedSample: IndustrialTagSample = {
      ...validSample,
      sourceTimestamp: "FECHA_INVALIDA",
    };
    const corruptedValidation = validateIndustrialTagSample(corruptedSample);
    expect(corruptedValidation.isValid).toBe(false);
    expect(corruptedValidation.errors.some((e) => e.includes("sourceTimestamp"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 13. Quality != Availability (Desacoplamiento estricto)
  // --------------------------------------------------------------------------
  it("Permite que una muestra tenga quality='BAD' pero availability='AVAILABLE' (sensor saturado pero respondiendo)", () => {
    // Ejemplo: sensor fuera de rango eléctrico (BAD) pero el enlace está vivo (AVAILABLE)
    const saturatedSensorSample: IndustrialTagSample = {
      tagId: sampleTag.id,
      tenantId: sampleTag.tenantId,
      connectionId: sampleConnection.id,
      value: 999.9,
      quality: "BAD",
      availability: "AVAILABLE", // Desacoplado: el valor llegó, pero es de mala calidad
      validationStatus: "REJECTED",
      origin: "LIVE_OT",
      sourceSystem: "TANDEM_PLC",
      sourceDevice: "PLC_S7_1500",
      gatewayId: "gw-edge-site01-01",
      sourceTimestamp: new Date().toISOString(),
      gatewayTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
    };

    const validation = validateIndustrialTagSample(saturatedSensorSample);
    expect(validation.isValid).toBe(true);
    expect(saturatedSensorSample.quality).toBe("BAD");
    expect(saturatedSensorSample.availability).toBe("AVAILABLE");
  });

  it("Permite que una muestra tenga quality='GOOD' pero availability='STALE' (último dato bueno pero enlace detenido)", () => {
    const staleGoodSample: IndustrialTagSample = {
      tagId: sampleTag.id,
      tenantId: sampleTag.tenantId,
      connectionId: sampleConnection.id,
      value: 210.0,
      quality: "GOOD",
      availability: "STALE", // Desacoplado: el último valor fue bueno, pero el dato está envejecido
      validationStatus: "PASSED",
      origin: "LIVE_OT",
      sourceSystem: "TANDEM_PLC",
      sourceDevice: "PLC_S7_1500",
      gatewayId: "gw-edge-site01-01",
      sourceTimestamp: new Date().toISOString(),
      gatewayTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
    };

    const validation = validateIndustrialTagSample(staleGoodSample);
    expect(validation.isValid).toBe(true);
    expect(staleGoodSample.quality).toBe("GOOD");
    expect(staleGoodSample.availability).toBe("STALE");
  });

  // --------------------------------------------------------------------------
  // 14. Procedencia física vs simulada (No aceptar LIVE_OT sin gateway físico)
  // --------------------------------------------------------------------------
  it("Rechaza muestra con origin 'LIVE_OT' si no cuenta con un gatewayId autenticado", () => {
    const fakeLiveSample: IndustrialTagSample = {
      tagId: sampleTag.id,
      tenantId: sampleTag.tenantId,
      connectionId: sampleConnection.id,
      value: 195.0,
      quality: "GOOD",
      availability: "AVAILABLE",
      validationStatus: "PASSED",
      origin: "LIVE_OT",
      sourceSystem: "BROWSER_UI",
      sourceDevice: "WEB_CLIENT",
      gatewayId: "", // Sin gateway autenticado
      sourceTimestamp: new Date().toISOString(),
      gatewayTimestamp: new Date().toISOString(),
      ingestionTimestamp: new Date().toISOString(),
    };

    const validation = validateIndustrialTagSample(fakeLiveSample);
    expect(validation.isValid).toBe(false);
    expect(validation.errors.some((e) => e.includes("requiere un 'gatewayId' autenticado"))).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 15. Compatibilidad Legacy y Normalización de TenantEnterprise
  // --------------------------------------------------------------------------
  it("Normaliza un tenant legacy manteniendo operationalMode y operationalStatus como autoridad única", () => {
    const legacyTenant: Partial<TenantEnterprise> = {
      id: "tenant-legacy-01",
      name: "Ingenio Antiguo",
      runtimeMode: "LIVE_OT",
      otStatus: "CONNECTED",
    };

    const normalized = normalizeTenantOperationalFields(legacyTenant);

    // Los campos canónicos deben haberse poblado basados en la resolución
    expect(normalized.operationalMode).toBe("LIVE");
    expect(normalized.operationalStatus).toBe("CONNECTED");
    expect(normalized.runtimeMode).toBe("LIVE_OT");
    expect(normalized.simulationEnabled).toBe(false);
  });

  it("Normaliza un tenant moderno proyectando operationalMode hacia runtimeMode", () => {
    const modernTenant: Partial<TenantEnterprise> = {
      id: "tenant-modern-01",
      name: "Ingenio Moderno",
      operationalMode: "SIMULATED",
      operationalStatus: "CONFIGURED",
    };

    const normalized = normalizeTenantOperationalFields(modernTenant);

    expect(normalized.operationalMode).toBe("SIMULATED");
    expect(normalized.operationalStatus).toBe("CONFIGURED");
    // Proyección hacia campos legacy
    expect(normalized.runtimeMode).toBe("SIMULATION");
    expect(normalized.simulationEnabled).toBe(true);
    expect(normalized.otStatus).toBe("WAITING_FOR_COMMISSIONING");
  });

  it("Preserva autoridad canónica cuando hay conflicto entre canonical y legacy", () => {
    const conflictingTenant: Partial<TenantEnterprise> = {
      id: "tenant-conflict-01",
      name: "Ingenio Conflicto",
      operationalMode: "LIVE",            // Canónico tiene autoridad
      runtimeMode: "SIMULATION",          // Legacy discordante
      operationalStatus: "OPERATIONAL",   // Canónico tiene autoridad
      otStatus: "DISCONNECTED",           // Legacy discordante
    };

    const normalized = normalizeTenantOperationalFields(conflictingTenant);

    // La autoridad canónica gana:
    expect(normalized.operationalMode).toBe("LIVE");
    expect(normalized.operationalStatus).toBe("OPERATIONAL");
    // Los campos legacy se alinean con la autoridad canónica:
    expect(normalized.runtimeMode).toBe("LIVE_OT");
    expect(normalized.otStatus).toBe("CONNECTED");
  });
});
