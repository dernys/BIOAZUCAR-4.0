/**
 * BioAzúcar 4.0 — Gobernanza Centralizada de Valores Complejos (ISA-95 Nivel 4)
 * 
 * Centralized formatter and validator for AgriculturalParameter.value,
 * CalculationTrace inputs, Formula Governance, and Audit logs.
 * 
 * Rules:
 * - Objects are NEVER rendered directly to JSX (prevents "Objects are not valid as a React child").
 * - Objects are rendered as human-readable JSON.
 * - Arrays are rendered as structured collections.
 * - Numbers preserve exact precision.
 * - Units are separated and handled cleanly.
 * - null/undefined never produce errors or crashes.
 */

export type GovernedValueType =
  | "numeric"
  | "factor"
  | "rate"
  | "currency"
  | "text"
  | "object"
  | "array"
  | "boolean"
  | string;

export interface FormatGovernedValueOptions {
  /** Return multiline indented JSON for objects/arrays */
  multiline?: boolean;
  /** Indentation spaces for multiline JSON (default 2) */
  indent?: number;
  /** Max characters before truncating in single-line preview (default no limit) */
  maxLength?: number;
  /** Custom fallback text for null or undefined (default "—") */
  fallback?: string;
  /** Custom fallback text for null or undefined (alias for fallback) */
  emptyPlaceholder?: string;
  /** Whether to format numbers with thousand separators if integer or decimal */
  localeNumbers?: boolean;
  /** Language style for booleans: "code" -> "true"/"false", "es" -> "VERDADERO"/"FALSO" */
  booleanStyle?: "code" | "es";
}

/**
 * Safe JSON replacer that avoids crashes on cyclic references
 */
function getCircularReplacer() {
  const seen = new WeakSet();
  return (_key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular Reference]";
      }
      seen.add(value);
    }
    return value;
  };
}

/**
 * Detects the runtime governed type of a value.
 */
export function detectGovernedValueType(
  value: any
): "number" | "string" | "boolean" | "object" | "array" | "null" | "undefined" {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "string";
}

/**
 * Centralized function to format any governed value into a safe string representation.
 * Guaranteed to NEVER return an object or throw an exception.
 */
export function formatGovernedValue(
  value: any,
  _type?: GovernedValueType,
  options?: FormatGovernedValueOptions
): string {
  const fallback = options?.emptyPlaceholder ?? options?.fallback ?? "—";

  // 1. null / undefined guard
  if (value === undefined || value === null) {
    return fallback;
  }

  // 2. Boolean handling
  if (typeof value === "boolean") {
    if (options?.booleanStyle === "es") {
      return value ? "VERDADERO" : "FALSO";
    }
    return value ? "true" : "false";
  }

  // 3. Numeric handling: preserve precision
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return String(value);
    }
    if (options?.localeNumbers) {
      return value.toLocaleString();
    }
    return String(value);
  }

  // 4. String handling
  if (typeof value === "string") {
    if (options?.maxLength && value.length > options.maxLength) {
      return `${value.slice(0, options.maxLength)}…`;
    }
    return value;
  }

  // 5. Array handling: structured collection
  if (Array.isArray(value)) {
    try {
      if (options?.multiline) {
        return JSON.stringify(value, getCircularReplacer(), options?.indent ?? 2);
      }
      const serialized = JSON.stringify(value, getCircularReplacer());
      if (options?.maxLength && serialized.length > options.maxLength) {
        return `${serialized.slice(0, options.maxLength)}…`;
      }
      return serialized;
    } catch {
      return `[Colección Array: ${value.length} elementos]`;
    }
  }

  // 6. Object handling: formatted JSON, never raw object
  if (typeof value === "object") {
    try {
      if (options?.multiline) {
        return JSON.stringify(value, getCircularReplacer(), options?.indent ?? 2);
      }
      const serialized = JSON.stringify(value, getCircularReplacer());
      if (options?.maxLength && serialized.length > options.maxLength) {
        return `${serialized.slice(0, options.maxLength)}…`;
      }
      return serialized;
    } catch {
      return "{ [Objeto de Parámetros] }";
    }
  }

  // 7. Fallback for symbols, functions, etc.
  return String(value);
}

/**
 * Formats a governed value and appends its physical unit separately if valid.
 */
export function formatGovernedValueWithUnit(
  value: any,
  unit?: string,
  type?: GovernedValueType,
  options?: FormatGovernedValueOptions
): string {
  if (value === undefined || value === null) {
    return options?.emptyPlaceholder ?? options?.fallback ?? "—";
  }

  const formattedVal = formatGovernedValue(value, type, options);
  const cleanUnit = unit?.trim();

  // Omit generic placeholder units when displaying
  if (!cleanUnit || cleanUnit === "-" || cleanUnit === "object" || cleanUnit === "none" || cleanUnit === "n/a") {
    return formattedVal;
  }

  return `${formattedVal} ${cleanUnit}`;
}

/**
 * Validates a JSON string and returns parsed object or validation error.
 */
export function validateGovernedJson(jsonString: string): {
  valid: boolean;
  parsed?: any;
  error?: string;
} {
  const trimmed = jsonString.trim();
  if (!trimmed) {
    return { valid: false, error: "El contenido JSON no puede estar vacío." };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return { valid: true, parsed };
  } catch (err: any) {
    return {
      valid: false,
      error: `Error de sintaxis JSON: ${err?.message || "Estructura inválida"}`,
    };
  }
}

/**
 * Parses user input from modals or inputs into the target governed value type.
 */
export function parseGovernedInput(
  rawInput: string,
  targetType?: string
): { success: boolean; value?: any; error?: string } {
  const trimmed = rawInput.trim();

  // Explicit object or array type
  if (targetType === "object" || targetType === "array") {
    const validation = validateGovernedJson(trimmed);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    if (targetType === "array" && !Array.isArray(validation.parsed)) {
      return { success: false, error: "El valor ingresado debe ser una lista/array JSON ([...])." };
    }
    if (targetType === "object" && (typeof validation.parsed !== "object" || validation.parsed === null || Array.isArray(validation.parsed))) {
      return { success: false, error: "El valor ingresado debe ser un objeto JSON estructurado ({...})." };
    }
    return { success: true, value: validation.parsed };
  }

  // Boolean
  if (targetType === "boolean" || trimmed.toLowerCase() === "true" || trimmed.toLowerCase() === "false") {
    return { success: true, value: trimmed.toLowerCase() === "true" };
  }

  // Auto-detect JSON object or array
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const validation = validateGovernedJson(trimmed);
    if (validation.valid) {
      return { success: true, value: validation.parsed };
    }
    // If it started with { or [ but failed, return the syntax error
    return { success: false, error: validation.error };
  }

  // Numeric: if targetType is numeric or matches a valid finite number
  if (targetType === "numeric" || targetType === "factor" || targetType === "rate" || targetType === "currency") {
    const num = Number(trimmed);
    if (isNaN(num) || trimmed === "") {
      return { success: false, error: "Debe ingresar un valor numérico válido." };
    }
    return { success: true, value: num };
  }

  if (!isNaN(Number(trimmed)) && trimmed !== "") {
    return { success: true, value: Number(trimmed) };
  }

  // Default string
  return { success: true, value: rawInput };
}
