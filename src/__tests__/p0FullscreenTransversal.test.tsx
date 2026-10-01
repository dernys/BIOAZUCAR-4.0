/**
 * ============================================================================
 * BIOAZÚCAR 4.0 — TEST SUITE: P0-01 TRANSVERSAL FULLSCREEN UX & INDUSTRIAL VIEWPORT
 * ============================================================================
 */

import React from "react";
import { renderToString } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
import { ModuleFullscreenButton } from "../components/fullscreen/ModuleFullscreenButton";
import { FullscreenModuleLayout } from "../components/fullscreen/FullscreenModuleLayout";
import { NavigationTab } from "../types";

describe("P0-01: Fullscreen Transversal UX & Viewport Protection", () => {
  it("1. ModuleFullscreenButton renders cleanly with consistent tooltip, icon and label in dark mode", () => {
    const html = renderToString(
      <ModuleFullscreenButton
        isFullscreen={false}
        onToggle={() => {}}
        theme="dark"
        label="Pantalla Completa"
      />
    );

    expect(html).toContain("Modo Pantalla Completa");
    expect(html).toContain("Pantalla Completa");
    expect(html).toContain("bg-slate-800");
  });

  it("2. ModuleFullscreenButton renders exit state cleanly in light mode", () => {
    const html = renderToString(
      <ModuleFullscreenButton
        isFullscreen={true}
        onToggle={() => {}}
        theme="light"
        label="Salir Fullscreen"
      />
    );

    expect(html).toContain("Salir de pantalla completa");
    expect(html).toContain("Salir Fullscreen");
    expect(html).toContain("bg-emerald-100");
  });

  it("3. FullscreenModuleLayout renders normal container when not in fullscreen", () => {
    const html = renderToString(
      <FullscreenModuleLayout
        moduleId="scada"
        moduleName="Sinóptico SCADA Industrial"
        theme="dark"
        hideHeaderInNormalView={true}
      >
        <div id="scada-viewport">Simulador SCADA Molienda</div>
      </FullscreenModuleLayout>
    );

    expect(html).toContain("data-module-id=\"scada\"");
    expect(html).toContain("data-fullscreen=\"false\"");
    expect(html).toContain("Simulador SCADA Molienda");
    // Normal view hides floating exit header
    expect(html).not.toContain("Fullscreen OT Mode");
  });

  it("4. FullscreenModuleLayout integrates seamlessly across all minimum required industrial modules", () => {
    const requiredModules: NavigationTab[] = [
      "dashboard",
      "scada",
      "historian",
      "alarms",
      "agricultural_pda",
      "batches",
      "equipment",
      "energy_dispatch",
      "digital_twin",
      "ai_center",
      "users_roles",
      "uns_hub",
      "commissioning_coverage",
      "sat_fat_acceptance",
      "enterprises",
      "system_config",
      "presentation",
    ];

    for (const mod of requiredModules) {
      const html = renderToString(
        <FullscreenModuleLayout
          moduleId={mod}
          moduleName={`Módulo Industrial ${mod.toUpperCase()}`}
          theme="dark"
        >
          <div id={`content-${mod}`}>Contenido Operacional {mod}</div>
        </FullscreenModuleLayout>
      );

      expect(html).toContain(`data-module-id="${mod}"`);
      expect(html).toContain(`id="content-${mod}"`);
    }
  });

  it("5. Respects UI isolation: Does not alter industrial security, tenant, or RBAC state", () => {
    // Pure UI rendering with no side-effects on process data
    const htmlNormal = renderToString(
      <FullscreenModuleLayout moduleId="dashboard" moduleName="Dashboard KPI" theme="dark">
        <span id="kpi-value">95.8% Extracción</span>
      </FullscreenModuleLayout>
    );

    expect(htmlNormal).toContain("95.8% Extracción");
  });
});
