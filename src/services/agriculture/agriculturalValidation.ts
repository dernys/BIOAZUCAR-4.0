/**
 * BioAzúcar 4.0 — Agricultural Parameter Validation Utilities
 * Centralizes range, bounds, and boundary checks for PDA governance.
 */

import { AgriculturalParameter } from "../../types/agriculture";

/**
 * Validates whether a proposed numeric value conforms to the unit/category bounds of the parameter.
 * Returns error string if invalid, or null if valid.
 */
export function validateParamValue(param: AgriculturalParameter, val: number): string | null {
  if (isNaN(val)) return "El valor debe ser un número válido.";
  if (param.type === "factor" || param.unit === "ratio" || param.unit === "factor") {
    if (val < 0.05 || val > 10.0) return "Los factores de corrección agronómicos deben estar en el rango entre 0.05 y 10.0.";
  }
  if (param.type === "rate" || param.unit === "%") {
    if (val < 0) return "El valor porcentual no puede ser negativo.";
    if (val > 100) return "El valor porcentual debe estar entre 0% y 100%.";
  }
  if (param.type === "currency" || (param.unit && param.unit.includes("USD"))) {
    if (val < 0) return "Los valores monetarios / costos no pueden ser negativos.";
  }
  return null;
}
