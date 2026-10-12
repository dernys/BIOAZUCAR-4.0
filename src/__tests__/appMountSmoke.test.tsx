// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, it, expect } from "vitest";
import App from "../App";
import { ErrorBoundary } from "../components/ErrorBoundary";

describe("App Root Component Mount & Render", () => {
  it("renders App wrapped in ErrorBoundary without crashing", () => {
    let html = "";
    expect(() => {
      html = renderToString(
        <ErrorBoundary fallbackTitle="Error al iniciar BioAzúcar 4.0">
          <App />
        </ErrorBoundary>
      );
    }).not.toThrow();

    expect(html).toContain("BioAzúcar");
    expect(html).not.toContain("Error al iniciar BioAzúcar 4.0");
    expect(html.length).toBeGreaterThan(500);
  });

  it("mounts App in client DOM and runs effects without infinite loop", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <ErrorBoundary fallbackTitle="Error al iniciar BioAzúcar 4.0">
          <App />
        </ErrorBoundary>
      );
      // Wait a tick for effects
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(container.innerHTML).toContain("BioAzúcar");
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts IndustrialCommissioningCoverageView without infinite loop", async () => {
    const { IndustrialCommissioningCoverageView } = await import("../components/commissioning/IndustrialCommissioningCoverageView");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<IndustrialCommissioningCoverageView activeTenantId="tenant-bioazucar-01" />);
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts AgriculturalPdaView without infinite loop", async () => {
    const { AgriculturalPdaView } = await import("../components/AgriculturalPdaView");
    const { PREDEFINED_USERS } = await import("../services/authService");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AgriculturalPdaView
          theme="dark"
          currentTenantName="Ingenio Central Portuguesa"
          nominalMillTch={500}
          currentRole="superadmin"
          currentUser={PREDEFINED_USERS[0]}
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts UsersAndRolesManager without infinite loop", async () => {
    const { UsersAndRolesManager } = await import("../components/UsersAndRolesManager");
    const { PREDEFINED_USERS } = await import("../services/authService");
    const { DEFAULT_ROLES } = await import("../services/rbacService");
    const { INITIAL_TENANTS } = await import("../services/dbService");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <UsersAndRolesManager
          users={PREDEFINED_USERS}
          roles={DEFAULT_ROLES}
          currentUser={PREDEFINED_USERS[0]}
          activeTenant={INITIAL_TENANTS[0]}
          theme="dark"
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts UNSHub without infinite loop", async () => {
    const { UNSHub } = await import("../components/UNSHub");
    const { INITIAL_TELEMETRY } = await import("../data/mockIndustrialData");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <UNSHub
          telemetry={INITIAL_TELEMETRY}
          currentRole="superadmin"
          onUpdateSetpoint={() => {}}
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts SystemConfigVerification without infinite loop", async () => {
    const { SystemConfigVerification } = await import("../components/SystemConfigVerification");
    const { INITIAL_TENANTS } = await import("../services/dbService");
    const { PREDEFINED_USERS } = await import("../services/authService");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SystemConfigVerification
          activeTenant={INITIAL_TENANTS[0]}
          currentUser={PREDEFINED_USERS[0]}
          currentRole="superadmin"
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts AlarmCenter without infinite loop", async () => {
    const { AlarmCenter } = await import("../components/AlarmCenter");
    const { INITIAL_ALARMS } = await import("../data/mockIndustrialData");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AlarmCenter
          alarms={INITIAL_ALARMS}
          currentRole="superadmin"
          onAcknowledgeAlarm={() => {}}
          onClearAlarm={() => {}}
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts DigitalTwin3D without infinite loop or Maximum update depth exceeded", async () => {
    const { DigitalTwin3D } = await import("../components/DigitalTwin3D");
    const { INITIAL_TELEMETRY, INITIAL_EQUIPMENT, INITIAL_ALARMS } = await import("../data/mockIndustrialData");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DigitalTwin3D
          telemetry={INITIAL_TELEMETRY}
          equipmentList={INITIAL_EQUIPMENT}
          alarms={INITIAL_ALARMS}
          theme="dark"
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("mounts PlotModal in open state without infinite loop or Maximum update depth exceeded", async () => {
    const { PlotModal } = await import("../components/agriculture/PlotModal");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PlotModal
          isOpen={true}
          onClose={() => {}}
          onSave={() => {}}
          initialPlot={null}
          availableVarieties={[]}
          varieties={[]}
          theme="dark"
        />
      );
      await new Promise((r) => setTimeout(r, 100));
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});


