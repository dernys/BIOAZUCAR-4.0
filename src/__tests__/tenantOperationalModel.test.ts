import { describe, it, expect } from "vitest";
import {
  TenantEnterprise,
  TenantPhysicalEvidence,
  SubsystemsOperationalMode,
} from "../types";
import {
  resolveTenantOperationalMode,
  resolveTenantOperationalStatus,
  canTransitionToOperational,
  validateTenantOperationalTransition,
} from "../services/otInfrastructureService";

describe("Tenant Operational State Model (Fase 1: Tenant como Raíz Operacional)", () => {
  const baseTenant: TenantEnterprise = {
    id: "tenant-test-01",
    name: "Ingenio Providencia Central",
    code: "ING-PROV-01",
    country: "Colombia",
    location: "Valle del Cauca",
    taxId: "NIT-900123456-1",
    nominalTch: 500,
    powerCapacityMW: 32,
    boilerPressureBar: 65,
    industrySector: "Agroindustrial Azucarero",
    status: "ACTIVE",
    primaryAdminEmail: "admin@providencia.com",
    primaryContactPhone: "+57 310 000 0000",
    createdAt: new Date().toISOString(),
  };

  // --------------------------------------------------------------------------
  // 1. SIMULATED no puede declararse OPERATIONAL por evidencia OT inexistente
  // --------------------------------------------------------------------------
  it("SIMULATED no puede declararse OPERATIONAL alegando evidencia física OT inexistente o falsificada", () => {
    const simulatedTenant: TenantEnterprise = {
      ...baseTenant,
      operationalMode: "SIMULATED",
      operationalStatus: "VALIDATED",
    };

    // Intentar declarar OPERATIONAL alegando falsamente telemetría OT real
    const fakeOtEvidence: TenantPhysicalEvidence = {
      hasActiveGateway: true,
      gatewayId: "FAKE-GW-99",
      activeTagsReceivingCount: 50,
      isSimulatedDataOnly: false, // Intento de adjudicarse datos reales
      dataQualityPassRate: 99,
      lastValidatedDataTimestamp: new Date().toISOString(),
    };

    const transition = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      simulatedTenant,
      fakeOtEvidence
    );

    expect(transition.allowed).toBe(false);
    expect(transition.reason).toContain("Violación de procedencia");
    expect(transition.reason).toContain("SIMULATED");
  });

  // --------------------------------------------------------------------------
  // 2. LIVE sin evidencia física no puede declararse OPERATIONAL
  // --------------------------------------------------------------------------
  it("LIVE sin evidencia física o con datos simulados no puede declararse OPERATIONAL", () => {
    const liveTenant: TenantEnterprise = {
      ...baseTenant,
      operationalMode: "LIVE",
      operationalStatus: "VALIDATED",
    };

    // Caso A: Sin evidencia alguna
    const noEvidenceResult = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      liveTenant
    );
    expect(noEvidenceResult.allowed).toBe(false);
    expect(noEvidenceResult.reason).toContain("requiere evidencia física verificable");

    // Caso B: Gateway inactivo
    const inactiveGwResult = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      liveTenant,
      {
        hasActiveGateway: false,
        activeTagsReceivingCount: 20,
        isSimulatedDataOnly: false,
        dataQualityPassRate: 95,
        lastValidatedDataTimestamp: new Date().toISOString(),
      }
    );
    expect(inactiveGwResult.allowed).toBe(false);
    expect(inactiveGwResult.reason).toContain("No se detecta ningún Edge Gateway activo");

    // Caso C: Evidencia con datos exclusivamente simulados (violación de procedencia)
    const simulatedDataInLiveResult = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      liveTenant,
      {
        hasActiveGateway: true,
        gatewayId: "GW-REAL-01",
        activeTagsReceivingCount: 40,
        isSimulatedDataOnly: true, // Datos simulados en tenant LIVE
        dataQualityPassRate: 98,
        lastValidatedDataTimestamp: new Date().toISOString(),
      }
    );
    expect(simulatedDataInLiveResult.allowed).toBe(false);
    expect(simulatedDataInLiveResult.reason).toContain("Violación de procedencia");

    // Caso D: Evidencia física real y válida -> Permitido
    const validEvidenceResult = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      liveTenant,
      {
        hasActiveGateway: true,
        gatewayId: "GW-REAL-01",
        activeTagsReceivingCount: 84,
        isSimulatedDataOnly: false,
        dataQualityPassRate: 96.5,
        lastValidatedDataTimestamp: new Date().toISOString(),
      }
    );
    expect(validEvidenceResult.allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 3. HYBRID conserva correctamente sus submodos
  // --------------------------------------------------------------------------
  it("HYBRID conserva correctamente sus submodos y exige evidencia física en subsistemas REAL", () => {
    const subsystemsConfig: SubsystemsOperationalMode = {
      scada: "REAL",
      opcua: "REAL",
      bascula: "REAL",
      lims: "SIMULATED",
      agriculture: "SIMULATED",
    };

    const hybridTenant: TenantEnterprise = {
      ...baseTenant,
      operationalMode: "HYBRID",
      operationalStatus: "VALIDATED",
      subsystemsMode: subsystemsConfig,
    };

    expect(hybridTenant.subsystemsMode?.scada).toBe("REAL");
    expect(hybridTenant.subsystemsMode?.lims).toBe("SIMULATED");
    expect(hybridTenant.subsystemsMode?.agriculture).toBe("SIMULATED");

    // Si tiene subsistemas REAL pero no aporta evidencia física:
    const transitionWithoutRealEvidence = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      hybridTenant,
      {
        hasActiveGateway: false,
        activeTagsReceivingCount: 0,
        isSimulatedDataOnly: true,
        dataQualityPassRate: 100,
      }
    );
    expect(transitionWithoutRealEvidence.allowed).toBe(false);
    expect(transitionWithoutRealEvidence.reason).toContain("HYBRID");

    // Con evidencia física para los subsistemas REAL:
    const transitionWithRealEvidence = validateTenantOperationalTransition(
      "VALIDATED",
      "OPERATIONAL",
      hybridTenant,
      {
        hasActiveGateway: true,
        gatewayId: "GW-HYBRID-01",
        activeTagsReceivingCount: 35,
        isSimulatedDataOnly: false,
        dataQualityPassRate: 94.2,
        lastValidatedDataTimestamp: new Date().toISOString(),
      }
    );
    expect(transitionWithRealEvidence.allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 4. Las transiciones inválidas son rechazadas
  // --------------------------------------------------------------------------
  it("las transiciones inválidas de la máquina de estados son rechazadas determinísticamente", () => {
    const tenant: TenantEnterprise = {
      ...baseTenant,
      operationalMode: "LIVE",
      operationalStatus: "DRAFT",
    };

    // DRAFT no puede saltar directo a OPERATIONAL
    const draftToOperational = validateTenantOperationalTransition(
      "DRAFT",
      "OPERATIONAL",
      tenant
    );
    expect(draftToOperational.allowed).toBe(false);
    expect(draftToOperational.reason).toContain("Transición de estado operacional inválida");

    // OFFLINE no puede saltar directo a OPERATIONAL sin antes CONNECTED -> VALIDATED
    const offlineToOperational = validateTenantOperationalTransition(
      "OFFLINE",
      "OPERATIONAL",
      tenant
    );
    expect(offlineToOperational.allowed).toBe(false);
    expect(offlineToOperational.reason).toContain("Transición de estado operacional inválida");

    // CONNECTED no puede saltar a OPERATIONAL sin pasar por VALIDATED
    const connectedToOperational = validateTenantOperationalTransition(
      "CONNECTED",
      "OPERATIONAL",
      tenant
    );
    expect(connectedToOperational.allowed).toBe(false);
    expect(connectedToOperational.reason).toContain("Transición de estado operacional inválida");

    // Transición válida: CONFIGURED -> COMMISSIONING
    const configuredToComm = validateTenantOperationalTransition(
      "CONFIGURED",
      "COMMISSIONING",
      tenant
    );
    expect(configuredToComm.allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 5. Los campos legacy continúan funcionando
  // --------------------------------------------------------------------------
  it("los campos legacy continúan funcionando y se resuelven correctamente", () => {
    // Tenant antiguo sin operationalMode ni operationalStatus
    const legacyTenant: TenantEnterprise = {
      ...baseTenant,
      runtimeMode: "LIVE_OT",
      otStatus: "CONNECTED",
      simulationEnabled: false,
    };

    const resolvedMode = resolveTenantOperationalMode(legacyTenant);
    const resolvedStatus = resolveTenantOperationalStatus(legacyTenant);

    expect(resolvedMode).toBe("LIVE");
    expect(resolvedStatus).toBe("CONNECTED");

    // Legacy en modo SIMULATION
    const legacySimulationTenant: TenantEnterprise = {
      ...baseTenant,
      runtimeMode: "SIMULATION",
      otStatus: "WAITING_FOR_COMMISSIONING",
      simulationEnabled: true,
    };

    expect(resolveTenantOperationalMode(legacySimulationTenant)).toBe("SIMULATED");
    expect(resolveTenantOperationalStatus(legacySimulationTenant)).toBe("CONFIGURED");
  });
});
