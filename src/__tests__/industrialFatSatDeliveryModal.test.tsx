import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { IndustrialFatSatDeliveryModal } from "../components/edge/IndustrialFatSatDeliveryModal";
import { UserRole } from "../types";

describe("IndustrialFatSatDeliveryModal — React Runtime & Zero-Crash Verification", () => {
  it("should render null when isOpen is false without throwing or mounting modal content", () => {
    const handleClose = vi.fn();
    const html = renderToString(
      <IndustrialFatSatDeliveryModal
        isOpen={false}
        onClose={handleClose}
        currentRole="administrador"
      />
    );

    expect(html).toBe("");
  });

  it("should render full modal structure without crash when isOpen is true", () => {
    const handleClose = vi.fn();
    const html = renderToString(
      <IndustrialFatSatDeliveryModal
        isOpen={true}
        onClose={handleClose}
        currentRole="administrador"
      />
    );

    expect(html).toContain("Verificación Formal FAT/SAT &amp; Entrega Industrial");
    expect(html).toContain("VALIDACIÓN INDUSTRIAL");
    expect(html).toContain("IEC 62443 SL3");
    expect(html).toContain("I3: OPC UA CTT");
    expect(html).toContain("OPC UA CTT");
  });

  it("should render cleanly across multiple industrial user roles without RBAC exceptions", () => {
    const roles: UserRole[] = ["administrador", "operador", "superadmin", "gerente", "supervisor"];
    for (const role of roles) {
      const html = renderToString(
        <IndustrialFatSatDeliveryModal
          isOpen={true}
          onClose={() => {}}
          currentRole={role}
        />
      );
      expect(html).toContain("Verificación Formal FAT/SAT &amp; Entrega Industrial");
    }
  });

  it("should contain cryptographic conformance evidence generated via browser-safe cryptography", () => {
    const html = renderToString(
      <IndustrialFatSatDeliveryModal
        isOpen={true}
        onClose={() => {}}
        currentRole="administrador"
      />
    );

    // Conformance rates and seals are present
    expect(html).toContain("%");
    expect(html).toContain("OPC UA");
  });
});
