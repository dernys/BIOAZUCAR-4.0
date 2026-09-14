import {
  ConnectionRegistryEntry,
  IndustrialTagDefinition,
  IndustrialTagSample,
  IndustrialProtocol,
  TagDataType,
} from "../../types";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Protocol compatibility definitions.
 * Maps each industrial protocol to its expected capabilities and requirements.
 */
const PROTOCOL_REQUIRES_SOURCE_ADDRESS: Partial<Record<IndustrialProtocol, boolean>> = {
  OPC_UA: true,       // NodeId (e.g. ns=2;s=Mill1.Pressure)
  OPC_DA: true,       // ItemID
  MODBUS: true,       // Register address (e.g. 40001, 30005)
  MQTT: true,         // Topic/Key
  SPARKPLUG: true,    // Metric Name
  EROS: true,         // EROS Tag/Register
  REST: true,         // Endpoint path / JSON pointer
  SIMULATED: false,   // Optional for synthetic generator
  "OPC-UA": true,
  "MODBUS-TCP": true,
  "MODBUS-RTU": true,
  "MQTT-SPARKPLUG": true,
  "REST-API": true,
  SIMULATOR: false,
  "SIEMENS-S7": true,
  "SIEMENS_S7": true,
};

/**
 * Validates a ConnectionRegistryEntry deterministically.
 */
export function validateConnectionRegistryEntry(
  entry: ConnectionRegistryEntry
): ValidationResult {
  const errors: string[] = [];

  if (!entry.id || entry.id.trim() === "") {
    errors.push("El campo 'id' de la conexión es obligatorio.");
  }
  if (!entry.tenantId || entry.tenantId.trim() === "") {
    errors.push("El campo 'tenantId' es obligatorio para garantizar el aislamiento multi-inquilino.");
  }
  if (!entry.siteId || entry.siteId.trim() === "") {
    errors.push("El campo 'siteId' es obligatorio (jerarquía ISA-95).");
  }
  if (!entry.name || entry.name.trim() === "") {
    errors.push("El campo 'name' de la conexión es obligatorio.");
  }
  if (!entry.gatewayId || entry.gatewayId.trim() === "") {
    errors.push("El campo 'gatewayId' es obligatorio.");
  }
  if (!entry.endpoint || entry.endpoint.trim() === "") {
    errors.push("El campo 'endpoint' es obligatorio.");
  }

  // Read-only safety rule: writable/readOnly integrity check
  // readOnly must be boolean
  if (typeof entry.readOnly !== "boolean") {
    errors.push("El campo 'readOnly' debe ser un valor booleano.");
  }

  // SLA timing validation
  if (entry.expectedIntervalMs <= 0) {
    errors.push("El campo 'expectedIntervalMs' debe ser mayor a 0 ms.");
  }
  if (entry.maxSilenceMs <= entry.expectedIntervalMs) {
    errors.push(
      `SLA inválido: 'maxSilenceMs' (${entry.maxSilenceMs}ms) debe ser estrictamente mayor que 'expectedIntervalMs' (${entry.expectedIntervalMs}ms).`
    );
  }
  if (entry.latencyBudgetMs <= 0) {
    errors.push("El campo 'latencyBudgetMs' debe ser mayor a 0 ms.");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface TagValidationContext {
  connection?: ConnectionRegistryEntry;
  existingTags?: IndustrialTagDefinition[];
}

/**
 * Validates an IndustrialTagDefinition deterministically.
 */
export function validateIndustrialTagDefinition(
  tag: IndustrialTagDefinition,
  context?: TagValidationContext
): ValidationResult {
  const errors: string[] = [];

  // 1. Mandatory IDs & Isolation
  if (!tag.id || tag.id.trim() === "") {
    errors.push("El campo 'id' del tag es obligatorio.");
  }
  if (!tag.tenantId || tag.tenantId.trim() === "") {
    errors.push("El campo 'tenantId' es obligatorio para aislamiento multi-inquilino.");
  }
  if (!tag.siteId || tag.siteId.trim() === "") {
    errors.push("El campo 'siteId' es obligatorio (jerarquía ISA-95).");
  }
  if (!tag.areaId || tag.areaId.trim() === "") {
    errors.push("El campo 'areaId' es obligatorio (jerarquía ISA-95).");
  }
  if (!tag.assetId || tag.assetId.trim() === "") {
    errors.push("El campo 'assetId' es obligatorio (jerarquía ISA-95).");
  }
  if (!tag.connectionId || tag.connectionId.trim() === "") {
    errors.push("El campo 'connectionId' es obligatorio.");
  }

  // 2. Canonical Name & Scope Uniqueness
  if (!tag.canonicalName || tag.canonicalName.trim() === "") {
    errors.push("El campo 'canonicalName' es obligatorio.");
  } else {
    // Canonical name syntax: uppercase alphanumeric + underscore/hyphen/dots
    const validCanonicalFormat = /^[A-Z0-9_.-]+$/i.test(tag.canonicalName);
    if (!validCanonicalFormat) {
      errors.push("El 'canonicalName' solo debe contener caracteres alfanuméricos, guiones, puntos y guiones bajos.");
    }
  }

  // Uniqueness check within context
  if (context?.existingTags && tag.canonicalName) {
    const duplicate = context.existingTags.find(
      (t) =>
        t.id !== tag.id &&
        t.tenantId === tag.tenantId &&
        t.siteId === tag.siteId &&
        t.canonicalName.toLowerCase() === tag.canonicalName.toLowerCase()
    );
    if (duplicate) {
      errors.push(
        `Violación de unicidad: Ya existe un tag con canonicalName '${tag.canonicalName}' para el tenant '${tag.tenantId}' y site '${tag.siteId}'.`
      );
    }
  }

  // 3. Connection Cross-Tenant & Existence Validation
  if (context?.connection) {
    if (context.connection.tenantId !== tag.tenantId) {
      errors.push(
        `Violación de aislamiento multi-inquilino: El tag pertenece al tenant '${tag.tenantId}' pero la conexión '${context.connection.id}' pertenece al tenant '${context.connection.tenantId}'.`
      );
    }
    if (context.connection.id !== tag.connectionId) {
      errors.push(
        `Incoherencia de conexión: El tag especifica connectionId '${tag.connectionId}' pero el contexto suministra la conexión '${context.connection.id}'.`
      );
    }
    // Protocol compatibility check
    if (tag.protocol && context.connection.protocol !== tag.protocol) {
      errors.push(
        `Protocolo incompatible: El tag declara protocolo '${tag.protocol}', incompatible con el protocolo '${context.connection.protocol}' de la conexión.`
      );
    }
  }

  // 4. Source Address validation
  const requiresSourceAddress = tag.protocol
    ? (PROTOCOL_REQUIRES_SOURCE_ADDRESS[tag.protocol] ?? true)
    : true;
  if (requiresSourceAddress && (!tag.sourceAddress || tag.sourceAddress.trim() === "")) {
    errors.push(
      `El protocolo '${tag.protocol || "UNKNOWN"}' requiere especificar obligatoriamente 'sourceAddress' (dirección física/registro/nodo).`
    );
  }

  // 5. Sampling Interval
  if (tag.samplingIntervalMs === undefined || tag.samplingIntervalMs <= 0) {
    errors.push("El campo 'samplingIntervalMs' debe ser un número entero mayor a 0 ms.");
  }

  // 6. Read-Only Default Policy
  // Writable tags must be strictly identified. If writable is true, notify or enforce explicit policy
  if (typeof tag.writable !== "boolean") {
    errors.push("El campo 'writable' debe ser booleano.");
  }

  // 7. Data Type & Engineering Range Validation
  const validDataTypes: TagDataType[] = [
    "NUMBER",
    "INTEGER",
    "BOOLEAN",
    "STRING",
    "FLOAT",
    "INT",
    "BOOL",
  ];
  if (!tag.dataType || !validDataTypes.includes(tag.dataType)) {
    errors.push(`Tipo de dato '${tag.dataType}' no admitido. Tipos válidos: [${validDataTypes.join(", ")}].`);
  }

  if (
    tag.dataType === "NUMBER" ||
    tag.dataType === "INTEGER" ||
    tag.dataType === "FLOAT" ||
    tag.dataType === "INT"
  ) {
    if (tag.engineeringRange) {
      if (typeof tag.engineeringRange.min !== "number" || typeof tag.engineeringRange.max !== "number") {
        errors.push("El rango de ingeniería numérico debe contener valores numéricos finitos para 'min' y 'max'.");
      } else if (tag.engineeringRange.min >= tag.engineeringRange.max) {
        errors.push(
          `Rango de ingeniería inválido: 'min' (${tag.engineeringRange.min}) debe ser estrictamente menor que 'max' (${tag.engineeringRange.max}).`
        );
      }
    }
  } else if (
    tag.dataType === "STRING" ||
    tag.dataType === "BOOLEAN" ||
    tag.dataType === "BOOL"
  ) {
    // Non-numeric tags should not specify numeric engineeringRange
    if (tag.engineeringRange && (tag.engineeringRange.min !== undefined || tag.engineeringRange.max !== undefined)) {
      errors.push(`Los tipos no numéricos ('${tag.dataType}') no deben definir rangos de ingeniería numéricos (min/max).`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export interface SampleValidationContext {
  tag?: IndustrialTagDefinition;
  connection?: ConnectionRegistryEntry;
}

/**
 * Validates an IndustrialTagSample deterministically.
 * Enforces quality != availability, 3-stage timestamps, and provenance tracking.
 */
export function validateIndustrialTagSample(
  sample: IndustrialTagSample,
  context?: SampleValidationContext
): ValidationResult {
  const errors: string[] = [];

  if (!sample.tagId || sample.tagId.trim() === "") {
    errors.push("El campo 'tagId' de la muestra es obligatorio.");
  }
  if (!sample.tenantId || sample.tenantId.trim() === "") {
    errors.push("El campo 'tenantId' de la muestra es obligatorio.");
  }
  if (!sample.connectionId || sample.connectionId.trim() === "") {
    errors.push("El campo 'connectionId' de la muestra es obligatorio.");
  }

  // Three-stage timestamps validation
  if (!sample.sourceTimestamp || isNaN(Date.parse(sample.sourceTimestamp))) {
    errors.push("El campo 'sourceTimestamp' debe ser una marca de tiempo válida en formato ISO-8601.");
  }
  if (!sample.gatewayTimestamp || isNaN(Date.parse(sample.gatewayTimestamp))) {
    errors.push("El campo 'gatewayTimestamp' debe ser una marca de tiempo válida en formato ISO-8601.");
  }
  if (!sample.ingestionTimestamp || isNaN(Date.parse(sample.ingestionTimestamp))) {
    errors.push("El campo 'ingestionTimestamp' debe ser una marca de tiempo válida en formato ISO-8601.");
  }

  // Provenance device and origin validation
  if (!sample.sourceSystem || sample.sourceSystem.trim() === "") {
    errors.push("El campo 'sourceSystem' de la muestra es obligatorio.");
  }
  if (!sample.sourceDevice || sample.sourceDevice.trim() === "") {
    errors.push("El campo 'sourceDevice' de la muestra es obligatorio.");
  }

  // Cross-tenant verification against context
  if (context?.tag) {
    if (context.tag.tenantId !== sample.tenantId) {
      errors.push(
        `Violación de aislamiento multi-inquilino: La muestra declara tenantId '${sample.tenantId}' pero el tag corresponde al tenant '${context.tag.tenantId}'.`
      );
    }
    if (context.tag.id !== sample.tagId) {
      errors.push(
        `Incoherencia de tag: La muestra especifica tagId '${sample.tagId}' pero el contexto suministra el tag '${context.tag.id}'.`
      );
    }
  }

  if (context?.connection) {
    if (context.connection.tenantId !== sample.tenantId) {
      errors.push(
        `Violación de aislamiento multi-inquilino: La muestra declara tenantId '${sample.tenantId}' pero la conexión corresponde al tenant '${context.connection.tenantId}'.`
      );
    }
    if (context.connection.id !== sample.connectionId) {
      errors.push(
        `Incoherencia de conexión: La muestra especifica connectionId '${sample.connectionId}' pero el contexto suministra la conexión '${context.connection.id}'.`
      );
    }
  }

  // Physical provenance integrity: Do not accept LIVE_OT if origin is from client without gateway
  if (sample.origin === "LIVE_OT") {
    if (!sample.gatewayId || sample.gatewayId.trim() === "") {
      errors.push("Una muestra con procedencia 'LIVE_OT' requiere un 'gatewayId' autenticado.");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
