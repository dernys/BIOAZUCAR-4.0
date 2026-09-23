import { describe, it, expect, beforeEach } from "vitest";
import { SystemHealthCheckService } from "../services/verification/SystemHealthCheckService";

describe("[BioAzúcar 4.0] System Health & Fault-Resilience Strategy Tests", () => {
  let healthService: SystemHealthCheckService;

  beforeEach(() => {
    healthService = SystemHealthCheckService.getInstance();
  });

  it("1. Debe inicializar el servicio de salud como Singleton", () => {
    const instance2 = SystemHealthCheckService.getInstance();
    expect(healthService).toBe(instance2);
  });

  it("2. Debe reportar estado global HEALTHY cuando todos los subsistemas cumplen garantías", async () => {
    const report = await healthService.runSubsystemDiagnostics();
    expect(report.overallStatus).toBe("HEALTHY");
    expect(report.subsystems.length).toBeGreaterThanOrEqual(6);
  });

  it("3. Debe verificar las garantías de resiliencia del frontend contra fallos [vite] y sandbox", async () => {
    const report = await healthService.runSubsystemDiagnostics();
    expect(report.resilienceGuarantees.hmrInterceptionActive).toBe(true);
    expect(report.resilienceGuarantees.errorBoundariesEnforced).toBe(true);
    expect(report.resilienceGuarantees.pwaDefensiveRegistration).toBe(true);
  });

  it("4. Debe verificar el estado de persistencia SQLite WAL y políticas industriales IEC 62443", async () => {
    const report = await healthService.runSubsystemDiagnostics();
    expect(report.resilienceGuarantees.sqlWalDurablePersistence).toBe(true);
    expect(report.resilienceGuarantees.failClosedDriverPolicy).toBe(true);

    const securitySubsystem = report.subsystems.find((s) => s.id === "iec-62443-sl3-security");
    expect(securitySubsystem).toBeDefined();
    expect(securitySubsystem?.metrics?.securityLevel).toBe("IEC-62443-SL3");
  });

  it("5. Debe incluir métricas de uptime y compatibilidad para operación Air-Gapped", async () => {
    const report = await healthService.runSubsystemDiagnostics();
    expect(report.environment.isAirGappedReady).toBe(true);
    expect(typeof report.environment.uptimeSeconds).toBe("number");
    expect(report.environment.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
