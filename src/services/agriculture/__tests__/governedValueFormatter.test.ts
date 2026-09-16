import { describe, it, expect } from "vitest";
import {
  formatGovernedValue,
  formatGovernedValueWithUnit,
  detectGovernedValueType,
  validateGovernedJson,
  parseGovernedInput,
} from "../../../utils/governedValueFormatter";
import { AgriculturalParameter } from "../../../types/agriculture";

describe("BioAzúcar 4.0 — Governed Value Formatter Unit Tests", () => {
  it("formats scalar numeric values properly with locale string or exact representation", () => {
    expect(formatGovernedValue(1234.56)).toBe("1234.56");
    expect(formatGovernedValue(1234.56, undefined, { localeNumbers: true })).toBe((1234.56).toLocaleString());
    expect(formatGovernedValue(0)).toBe("0");
    expect(formatGovernedValue(-45.2)).toBe("-45.2");
  });

  it("formats boolean values cleanly", () => {
    expect(formatGovernedValue(true)).toBe("true");
    expect(formatGovernedValue(false)).toBe("false");
    expect(formatGovernedValue(true, undefined, { booleanStyle: "es" })).toBe("VERDADERO");
    expect(formatGovernedValue(false, undefined, { booleanStyle: "es" })).toBe("FALSO");
  });

  it("handles null and undefined safely without throwing", () => {
    expect(formatGovernedValue(null)).toBe("—");
    expect(formatGovernedValue(undefined)).toBe("—");
    expect(formatGovernedValue(null, undefined, { emptyPlaceholder: "Sin datos" })).toBe("Sin datos");
  });

  it("serializes complex objects and prevents [object Object] rendering", () => {
    const complexObj = {
      code: "RB86-7515",
      cycleMonths: 14,
      potentialYieldTCH: 110.5,
    };

    const singleLine = formatGovernedValue(complexObj);
    expect(singleLine).not.toContain("[object Object]");
    expect(singleLine).toContain("RB86-7515");
    expect(singleLine).toContain("110.5");

    const multiLine = formatGovernedValue(complexObj, undefined, { multiline: true, indent: 2 });
    expect(multiLine).toContain("\n");
    expect(multiLine).toContain('"code": "RB86-7515"');
  });

  it("truncates very long object strings if maxLength is specified", () => {
    const bigObj = { a: 1, b: 2, c: "very long description here for testing truncation" };
    const truncated = formatGovernedValue(bigObj, undefined, { maxLength: 20 });
    expect(truncated.endsWith("…")).toBe(true);
    expect(truncated.length).toBeLessThanOrEqual(21);
  });

  it("formats with unit correctly and suppresses unit for complex objects or empty indicators", () => {
    expect(formatGovernedValueWithUnit(85.5, "TCH")).toBe("85.5 TCH");
    expect(formatGovernedValueWithUnit(null, "USD/ha")).toBe("—");
    expect(formatGovernedValueWithUnit({ key: "val" }, "object")).toBe('{"key":"val"}');
    expect(formatGovernedValueWithUnit({ key: "val" }, "-")).toBe('{"key":"val"}');
  });

  it("detects governed value types accurately", () => {
    expect(detectGovernedValueType(123)).toBe("number");
    expect(detectGovernedValueType("hello")).toBe("string");
    expect(detectGovernedValueType(true)).toBe("boolean");
    expect(detectGovernedValueType([1, 2])).toBe("array");
    expect(detectGovernedValueType({ a: 1 })).toBe("object");
    expect(detectGovernedValueType(null)).toBe("null");
    expect(detectGovernedValueType(undefined)).toBe("undefined");
  });

  it("validates governed JSON inputs with precise error messages", () => {
    const validRes = validateGovernedJson('{"a": 1, "b": "test"}');
    expect(validRes.valid).toBe(true);
    expect(validRes.parsed).toEqual({ a: 1, b: "test" });
    expect(validRes.error).toBeUndefined();

    const invalidRes = validateGovernedJson('{"a": 1,');
    expect(invalidRes.valid).toBe(false);
    expect(invalidRes.parsed).toBeUndefined();
    expect(invalidRes.error).toContain("Error de sintaxis JSON");
  });

  it("parses governed inputs according to target type", () => {
    const pNumber: AgriculturalParameter = {
      id: "param-test-1",
      tenantId: "TENANT_TEST",
      key: "TEST_NUM",
      name: "Test Number",
      category: "VARIEDAD",
      value: 10,
      unit: "ha",
      validationStatus: "CONFIRMADO",
      type: "numeric",
      version: "1.0",
      effectiveFrom: "2026-01-01",
    };
    expect(parseGovernedInput("42.5", pNumber.type)).toEqual({ success: true, value: 42.5 });

    const pBool: AgriculturalParameter = {
      id: "param-test-2",
      tenantId: "TENANT_TEST",
      key: "TEST_BOOL",
      name: "Test Bool",
      category: "MAQUINARIA",
      value: false,
      unit: "-",
      validationStatus: "CONFIRMADO",
      type: "boolean",
      version: "1.0",
      effectiveFrom: "2026-01-01",
    };
    expect(parseGovernedInput("true", pBool.type)).toEqual({ success: true, value: true });
    expect(parseGovernedInput("false", pBool.type)).toEqual({ success: true, value: false });

    const pObj: AgriculturalParameter = {
      id: "param-test-3",
      tenantId: "TENANT_TEST",
      key: "TEST_OBJ",
      name: "Test Obj",
      category: "ECONOMIA",
      value: { default: 1 },
      unit: "object",
      validationStatus: "CONFIRMADO",
      type: "object",
      version: "1.0",
      effectiveFrom: "2026-01-01",
    };
    expect(parseGovernedInput('{"speedKmH": 5.5}', pObj.type)).toEqual({
      success: true,
      value: { speedKmH: 5.5 },
    });
  });
});
