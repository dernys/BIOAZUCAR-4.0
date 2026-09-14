import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Network,
  Cpu,
  Radio,
  Sliders,
  Shield,
  Search,
  Database,
  Check,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Lock,
  Server,
  Layers,
  FileCheck,
  Activity,
  Zap,
} from "lucide-react";
import {
  ConnectionRegistryEntry,
  ConnectionStatus,
  IndustrialProtocol,
  TenantEnterprise,
  TenantPhysicalEvidence,
  UserRole,
} from "../types";
import { industrialConnectionRegistry } from "../services/dataProviders/IndustrialConnectionRegistry";
import {
  industrialConnectorRuntime,
  RealConnectionTestResult,
  NodeDiscoveryItem,
} from "../services/dataProviders/IndustrialConnectorRuntime";
import {
  industrialCommissioningService,
  CommissioningReport,
} from "../services/edge/IndustrialCommissioningService";
import { industrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { tenantRuntimeManager } from "../services/runtime/TenantRuntimeManager";

interface IndustrialConnectionWizardProps {
  tenant: TenantEnterprise;
  userRole?: UserRole;
  onComplete?: () => void;
  theme?: "light" | "dark";
}

export const IndustrialConnectionWizard: React.FC<IndustrialConnectionWizardProps> = ({
  tenant,
  userRole = "administrador",
  onComplete,
  theme = "dark",
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);

  // STEP 1: Plant / Site / Area / Edge Identity
  const [tenantId, setTenantId] = useState<string>(tenant.id);
  const [siteId, setSiteId] = useState<string>("SITE_CENTRAL_01");
  const [areaId, setAreaId] = useState<string>("AREA_MOLIENDA");
  const [gatewayId, setGatewayId] = useState<string>("EDGE-CENTRAL-01");
  const [connectionName, setConnectionName] = useState<string>("Enlace Industrial Tándem Molienda #1");

  // STEP 2: OT/DMZ Network Configuration
  const [subnet, setSubnet] = useState<string>("192.168.10.0/24");
  const [vlan, setVlan] = useState<number>(100);
  const [dmzRoute, setDmzRoute] = useState<string>("192.168.10.1 (FortiGate OT/DMZ)");
  const [gatewayIp, setGatewayIp] = useState<string>("192.168.10.2");
  const [targetPort, setTargetPort] = useState<number>(4840);
  const [isolationLevel, setIsolationLevel] = useState<string>("STRICT_OT_ISOLATION");

  // STEP 3: Protocol Selection
  const [protocol, setProtocol] = useState<IndustrialProtocol>("OPC_UA");

  // STEP 4: Connection Configuration & Security
  const [endpointUrl, setEndpointUrl] = useState<string>("opc.tcp://192.168.10.50:4840/BioAzucarServer");
  const [securityPolicy, setSecurityPolicy] = useState<string>("Basic256Sha256");
  const [securityMode, setSecurityMode] = useState<string>("SignAndEncrypt");
  const [authType, setAuthType] = useState<"CERTIFICATE" | "TOKEN" | "ANONYMOUS" | "BASIC_AUTH">("CERTIFICATE");
  const [certificateRef, setCertificateRef] = useState<string>("vault://tenants/TENANT_AZUCAR_01/certs/opcua-client.der");
  const [secretRef, setSecretRef] = useState<string>("vault://tenants/TENANT_AZUCAR_01/secrets/opcua-key");
  const [scanIntervalMs, setScanIntervalMs] = useState<number>(1000);
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const [latencyBudgetMs, setLatencyBudgetMs] = useState<number>(500);

  // STEP 5: Real Connection Test State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<RealConnectionTestResult | null>(null);

  // STEP 6: Discovery State
  const [isDiscovering, setIsDiscovering] = useState<boolean>(false);
  const [discoveredNodes, setDiscoveredNodes] = useState<NodeDiscoveryItem[]>([]);
  const [discoveryMessage, setDiscoveryMessage] = useState<string>("");

  // STEP 7: Tag Mapping State
  const [mappedTag, setMappedTag] = useState<{
    canonicalName: string;
    sourceAddress: string;
    assetId: string;
    processArea: string;
    dataType: string;
    engMin: number;
    engMax: number;
    unit: string;
  }>({
    canonicalName: "MOLINO_01.PRESION_HIDRAULICA_BAR",
    sourceAddress: "ns=2;s=Milling.Tandem.HydraulicPressure",
    assetId: "eq-molino-1",
    processArea: "MOLIENDA",
    dataType: "FLOAT",
    engMin: 0,
    engMax: 250,
    unit: "bar",
  });

  // STEP 8: Data Quality Gate Evaluation State
  const [gateEvaluation, setGateEvaluation] = useState<{
    quality: "GOOD" | "BAD" | "UNCERTAIN";
    availability: "AVAILABLE" | "STALE" | "UNAVAILABLE";
    validationStatus: "PASSED" | "REJECTED";
    score: number;
    reasons: string[];
  } | null>(null);

  // STEP 9: Commissioning Protocol State
  const [isCommissioning, setIsCommissioning] = useState<boolean>(false);
  const [commissioningReport, setCommissioningReport] = useState<CommissioningReport | null>(null);

  // STEP 10: Live OT Guard State
  const [liveGuardResult, setLiveGuardResult] = useState<{
    permitted: boolean;
    reason: string;
    evidence?: TenantPhysicalEvidence;
  } | null>(null);

  // Synchronize endpoint based on protocol selection
  useEffect(() => {
    if (protocol === "OPC_UA" || protocol === "OPC-UA") {
      setEndpointUrl("opc.tcp://192.168.10.50:4840/BioAzucarServer");
      setTargetPort(4840);
    } else if (protocol === "MODBUS" || protocol === "MODBUS-TCP") {
      setEndpointUrl("modbus://192.168.20.15:502");
      setTargetPort(502);
    } else if (protocol === "SPARKPLUG" || protocol === "MQTT") {
      setEndpointUrl("tls://mqtt.bioazucar.internal:8883");
      setTargetPort(8883);
    } else if (protocol === "EROS") {
      setEndpointUrl("eros://192.168.15.100:9000/TandemSync");
      setTargetPort(9000);
    } else if (protocol === "SIEMENS-S7") {
      setEndpointUrl("s7://192.168.10.12:102/rack=0/slot=1");
      setTargetPort(102);
    }
  }, [protocol]);

  // Execute Step 5: Real Connection Test
  const handleExecuteRealTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const tempEntry: ConnectionRegistryEntry = {
      id: `conn-test-${Date.now()}`,
      tenantId,
      siteId,
      areaId,
      gatewayId,
      name: connectionName,
      protocol,
      endpoint: endpointUrl,
      status: "CONFIGURED",
      criticality: "CRITICAL",
      readOnly: true,
      enabled: true,
      securityProfile: {
        securityPolicy,
        securityMode,
        authType,
      },
      certificateRef,
      secretRef,
      expectedIntervalMs: scanIntervalMs,
      maxSilenceMs: scanIntervalMs * 5,
      latencyBudgetMs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configVersion: "1.0.0",
      isDemoSimulation: false,
    };

    try {
      const res = await industrialConnectorRuntime.testPhysicalConnection(tempEntry);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        connectionId: tempEntry.id,
        protocol,
        endpoint: endpointUrl,
        status: "FAILED",
        isPhysicalSuccess: false,
        stepReached: "FAILED",
        latencyMs: 0,
        errorMessage: err.message,
        details: {},
        provenance: "PHYSICAL_OT_RUNTIME",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Execute Step 6: Discovery
  const handleExecuteDiscovery = async () => {
    setIsDiscovering(true);
    setDiscoveredNodes([]);
    setDiscoveryMessage("");

    const tempEntry: ConnectionRegistryEntry = {
      id: "conn-discovery-active",
      tenantId,
      siteId,
      areaId,
      gatewayId,
      name: connectionName,
      protocol,
      endpoint: endpointUrl,
      status: testResult?.isPhysicalSuccess ? "CONNECTED" : "OFFLINE",
      criticality: "HIGH",
      readOnly: true,
      enabled: true,
      expectedIntervalMs: scanIntervalMs,
      maxSilenceMs: scanIntervalMs * 5,
      latencyBudgetMs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configVersion: "1.0.0",
      isDemoSimulation: false,
    };

    try {
      const res = await industrialConnectorRuntime.executeDiscovery(tempEntry);
      setDiscoveredNodes(res.nodes);
      setDiscoveryMessage(res.message || "");
    } catch (err: any) {
      setDiscoveryMessage(`Error durante el examen de espacio de direcciones: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Execute Step 8: Data Quality Gate Evaluation
  const handleEvaluateQualityGate = () => {
    const sampleTime = new Date().toISOString();
    const testSample = {
      tagId: mappedTag.canonicalName,
      tenantId,
      siteId,
      areaId: mappedTag.processArea,
      assetId: mappedTag.assetId,
      connectionId: "conn-wizard-stage",
      canonicalName: mappedTag.canonicalName,
      protocol,
      sourceAddress: mappedTag.sourceAddress,
      value: 178.5, // Realistic hydraulic pressure
      unit: mappedTag.unit,
      quality: "GOOD" as const,
      availability: "AVAILABLE" as const,
      validationStatus: "PENDING" as const,
      origin: "LIVE_OT" as const,
      sourceSystem: "DCS-TANDEM-01",
      sourceDevice: "PLC-SIEMENS-1500",
      gatewayId,
      sourceTimestamp: sampleTime,
      gatewayTimestamp: sampleTime,
      ingestionTimestamp: sampleTime,
    };

    const context = {
      tag: {
        id: mappedTag.canonicalName,
        tenantId,
        siteId,
        areaId: mappedTag.processArea,
        assetId: mappedTag.assetId,
        name: mappedTag.canonicalName,
        protocol,
        sourceAddress: mappedTag.sourceAddress,
        dataType: mappedTag.dataType as any,
        engineeringRange: { min: mappedTag.engMin, max: mappedTag.engMax },
        scanRateMs: scanIntervalMs,
      } as any,
      connection: {
        id: "conn-wizard-stage",
        tenantId,
        siteId,
        maxSilenceMs: scanIntervalMs * 5,
      } as any,
    };

    const result = industrialDataQualityGate.auditTagSample(testSample, context, true);
    setGateEvaluation({
      quality: result.quality,
      availability: result.availability,
      validationStatus: result.isValid ? "PASSED" : "REJECTED",
      score: result.score,
      reasons: result.reasons,
    });
  };

  // Execute Step 9: Commissioning
  const handleExecuteCommissioning = async () => {
    setIsCommissioning(true);
    setCommissioningReport(null);

    // Register active entry into connection registry first
    const registered = await industrialConnectionRegistry.registerConnection(
      {
        id: `conn-${protocol.toLowerCase().replace("_", "-")}-${Date.now()}`,
        tenantId,
        siteId,
        areaId,
        gatewayId,
        name: connectionName,
        protocol,
        endpoint: endpointUrl,
        status: testResult?.isPhysicalSuccess ? "CONNECTED" : "CONFIGURED",
        criticality: "CRITICAL",
        readOnly: true,
        enabled: true,
        securityProfile: {
          securityPolicy,
          securityMode,
          authType,
        },
        certificateRef,
        secretRef,
        expectedIntervalMs: scanIntervalMs,
        maxSilenceMs: scanIntervalMs * 5,
        latencyBudgetMs,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        configVersion: "1.0.0",
        isDemoSimulation: false,
      },
      { role: userRole, name: "Industrial Commissioning Engineer" }
    );

    try {
      const report = await industrialCommissioningService.runCommissioningProtocol(
        registered.id,
        { role: userRole, name: "Industrial Commissioning Engineer" }
      );
      setCommissioningReport(report);
    } catch (err: any) {
      alert(`Fallo en protocolo de comisionamiento: ${err.message}`);
    } finally {
      setIsCommissioning(false);
    }
  };

  // Execute Step 10: Evaluate Live OT Guard
  const handleCheckLiveOtGuard = () => {
    const res = industrialCommissioningService.validateLiveOtTransition(
      tenantId,
      commissioningReport?.evidence
    );
    setLiveGuardResult(res);

    if (res.permitted && commissioningReport?.evidence) {
      // Transition tenant in runtime manager to LIVE_OT
      const runtime = tenantRuntimeManager.getRuntime(tenantId);
      runtime.setMode("LIVE_OT");
      runtime.setOTConfig({
        status: "CONNECTED",
        isLiveConnection: true,
        connected: true,
      });
    }
  };

  const steps = [
    { num: 1, label: "Identidad", sub: "ISA-95" },
    { num: 2, label: "Red OT/DMZ", sub: "VLAN & Rutas" },
    { num: 3, label: "Protocolo", sub: "OPC, Modbus..." },
    { num: 4, label: "Seguridad", sub: "Cifrado & SLA" },
    { num: 5, label: "Test Físico", sub: "Sin fakes" },
    { num: 6, label: "Discovery", sub: "Browse" },
    { num: 7, label: "Tag Mapping", sub: "Assets" },
    { num: 8, label: "Quality Gate", sub: "Calidad vs Disp" },
    { num: 9, label: "Commissioning", sub: "10 Pruebas" },
    { num: 10, label: "LIVE_OT Guard", sub: "Autorización" },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800">
      {/* Step Indicator Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Industrial Connection & Commissioning Wizard
            </h2>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              Pipeline de 10 Pasos Canónicos
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Paso {currentStep} de 10
          </span>
        </div>

        {/* Progress pills */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-1.5">
          {steps.map((s) => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <button
                key={s.num}
                onClick={() => setCurrentStep(s.num)}
                className={`flex flex-col items-center justify-center p-1.5 rounded text-left transition-all border ${
                  isActive
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300"
                    : isDone
                    ? "bg-slate-900 border-slate-700 text-slate-300"
                    : "bg-slate-950/60 border-slate-800 text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono font-bold">{s.num}</span>
                  {isDone && <Check className="w-2.5 h-2.5 text-emerald-400" />}
                </div>
                <span className="text-[10px] font-medium truncate w-full text-center">
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Workspace */}
      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {/* STEP 1: Plant / Site / Area / Edge Identity */}
        {currentStep === 1 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 1: Identidad y Jerarquía de Planta (ISA-95)
              </h3>
              <p className="text-xs text-slate-400">
                Garantiza el aislamiento multi-inquilino y la asignación inequívoca:
                Tenant → Site → Area → Gateway/Edge → Connection.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Inquilino Canónico (Tenant ID)
                </label>
                <input
                  type="text"
                  value={tenantId}
                  disabled
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm text-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Planta / Ingenio (Site ID)
                </label>
                <input
                  type="text"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Área de Proceso (Area ID)
                </label>
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                >
                  <option value="AREA_MOLIENDA">AREA_MOLIENDA (Tándem & Difusores)</option>
                  <option value="AREA_VAPOR_CALDERAS">AREA_VAPOR_CALDERAS (Generadores Vapor)</option>
                  <option value="AREA_COGENERACION">AREA_COGENERACION (Turbinas & Red)</option>
                  <option value="AREA_FABRICA_AZUCAR">AREA_FABRICA_AZUCAR (Clarificación/Tachos)</option>
                  <option value="AREA_RECEPCION_CANA">AREA_RECEPCION_CANA (Básculas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Edge Gateway Asignado (Gateway ID)
                </label>
                <input
                  type="text"
                  value={gatewayId}
                  onChange={(e) => setGatewayId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Nombre Descriptivo de la Conexión
              </label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* STEP 2: OT/DMZ Network Configuration */}
        {currentStep === 2 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 2: Configuración de Red Industrial OT/DMZ
              </h3>
              <p className="text-xs text-slate-400">
                Segmentación segura de redes según ISA/IEC 62443. Prevención de ruteo directo entre TI y Nivel 1.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Subred OT (Subnet CIDR)
                </label>
                <input
                  type="text"
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  VLAN Industrial
                </label>
                <input
                  type="number"
                  value={vlan}
                  onChange={(e) => setVlan(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Ruta Firewall / DMZ Gateway
                </label>
                <input
                  type="text"
                  value={dmzRoute}
                  onChange={(e) => setDmzRoute(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  IP NIC Industrial del Edge Gateway
                </label>
                <input
                  type="text"
                  value={gatewayIp}
                  onChange={(e) => setGatewayIp(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Nivel de Aislamiento
              </label>
              <select
                value={isolationLevel}
                onChange={(e) => setIsolationLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
              >
                <option value="STRICT_OT_ISOLATION">Aislamiento Estricto (Sin acceso directo a Internet)</option>
                <option value="DMZ_PROXY_FORWARDING">Proxy Seguro DMZ con Store & Forward</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 3: Protocol Selection */}
        {currentStep === 3 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 3: Selección de Protocolo Industrial
              </h3>
              <p className="text-xs text-slate-400">
                Seleccione el estándar de comunicación del dispositivo físico o gateway de campo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "OPC_UA", title: "OPC-UA (IEC 62541)", desc: "DCS, SCADA y PLCs modernos con seguridad nativa." },
                { id: "MODBUS", title: "Modbus TCP / RTU", desc: "Básculas, analizadores NIR, variadores y medidores." },
                { id: "SPARKPLUG", title: "MQTT / Sparkplug B", desc: "Universal NameSpace (UNS) y brokers EMQX/HiveMQ." },
                { id: "EROS", title: "EROS Native Bridge", desc: "Sistema de automatización de molienda propietaria." },
                { id: "SIEMENS-S7", title: "Siemens S7 Protocol", desc: "Enlace directo con S7-1500 / S7-300 de caldera." },
                { id: "REST", title: "REST / Industrial API", desc: "Servicios HTTP industriales y microservicios." },
              ].map((p) => {
                const isSelected = protocol === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProtocol(p.id as IndustrialProtocol)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-emerald-950/40 border-emerald-500 text-white shadow-lg shadow-emerald-950/50"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{p.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <p className="text-xs text-slate-400">{p.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: Connection Configuration */}
        {currentStep === 4 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 4: Parámetros de Enlace y Credenciales Seguras
              </h3>
              <p className="text-xs text-slate-400">
                Regla de Oro: Prohibido almacenar contraseñas o claves privadas. Utilizar exclusivamente secretRef.
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Endpoint URI Canónico
              </label>
              <input
                type="text"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Política de Seguridad (Security Policy)
                </label>
                <select
                  value={securityPolicy}
                  onChange={(e) => setSecurityPolicy(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                >
                  <option value="Basic256Sha256">Basic256Sha256 (Recomendado)</option>
                  <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                  <option value="None">None (Solo pruebas aisladas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Modo de Seguridad (Security Mode)
                </label>
                <select
                  value={securityMode}
                  onChange={(e) => setSecurityMode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                >
                  <option value="SignAndEncrypt">SignAndEncrypt (Cifrado Completo)</option>
                  <option value="Sign">Sign (Solo Firma)</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Referencia Certificado (certificateRef)
                </label>
                <input
                  type="text"
                  value={certificateRef}
                  onChange={(e) => setCertificateRef(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-amber-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Referencia Secreto (secretRef)
                </label>
                <input
                  type="text"
                  value={secretRef}
                  onChange={(e) => setSecretRef(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-amber-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Intervalo de Muestreo (expectedIntervalMs)
                </label>
                <input
                  type="number"
                  value={scanIntervalMs}
                  onChange={(e) => setScanIntervalMs(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Presupuesto Latencia (latencyBudgetMs)
                </label>
                <input
                  type="number"
                  value={latencyBudgetMs}
                  onChange={(e) => setLatencyBudgetMs(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Real Connection Test */}
        {currentStep === 5 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 5: Prueba de Conexión Física Real (Sin Fakes)
              </h3>
              <p className="text-xs text-slate-400">
                Estados: NOT_CONFIGURED → CONFIGURED → CONNECTING → CONNECTED → AUTHENTICATED → READ_TEST_OK → FAILED.
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400">Destino físico a verificar:</span>
                  <p className="font-mono text-sm text-white">{endpointUrl}</p>
                </div>
                <button
                  onClick={handleExecuteRealTest}
                  disabled={isTesting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs flex items-center gap-2"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Activity className="w-3.5 h-3.5" />
                  )}
                  Ejecutar Prueba de Conexión
                </button>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded border text-xs space-y-2 ${
                    testResult.isPhysicalSuccess
                      ? "bg-emerald-950/30 border-emerald-800 text-emerald-300"
                      : "bg-red-950/30 border-red-800 text-red-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>Resultado: {testResult.status} ({testResult.stepReached})</span>
                    <span>Latencia: {testResult.latencyMs} ms</span>
                  </div>

                  {testResult.isPhysicalSuccess ? (
                    <div className="space-y-1 text-slate-300">
                      <p className="text-emerald-400 font-medium">
                        ✓ Enlace de red TCP establecido y sesión autenticada.
                      </p>
                      <p>Dirección leída: <span className="font-mono">{testResult.details.testedAddress}</span></p>
                      <p>Valor verificado: <span className="font-mono font-bold text-white">{testResult.details.sampleValue}</span></p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-red-400">Fallo de comunicación física:</p>
                      <p>{testResult.errorMessage || "Hardware no accesible en la red industrial."}</p>
                      <p className="text-amber-400 text-[11px]">
                        Procedencia: {testResult.provenance}. No se simula éxito para hardware inexistente.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: Discovery */}
        {currentStep === 6 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 6: Examen de Espacio de Direcciones (Discovery)
              </h3>
              <p className="text-xs text-slate-400">
                Para OPC-UA, ejecuta browse real en el servidor. Si el enlace está offline, no inventa nodos falsos.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {discoveredNodes.length} nodos descubiertos
              </span>
              <button
                onClick={handleExecuteDiscovery}
                disabled={isDiscovering}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs flex items-center gap-1.5"
              >
                {isDiscovering ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Examinar Espacio de Direcciones
              </button>
            </div>

            {discoveryMessage && (
              <p className="text-xs p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                {discoveryMessage}
              </p>
            )}

            {discoveredNodes.length > 0 && (
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-2">NodeId</th>
                      <th className="p-2">DisplayName</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Acceso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {discoveredNodes.map((n) => (
                      <tr key={n.nodeId} className="hover:bg-slate-900/50">
                        <td className="p-2 text-emerald-400">{n.nodeId}</td>
                        <td className="p-2 text-white">{n.displayName}</td>
                        <td className="p-2 text-slate-400">{n.dataType}</td>
                        <td className="p-2 text-slate-400">{n.accessLevel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* STEP 7: Tag Mapping */}
        {currentStep === 7 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 7: Mapeo de Tags a Equipos y Áreas de Proceso
              </h3>
              <p className="text-xs text-slate-400">
                Connection → IndustrialTagDefinition → Asset (Molino, Caldera) → Process Area.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Nombre Canónico del Tag
                </label>
                <input
                  type="text"
                  value={mappedTag.canonicalName}
                  onChange={(e) => setMappedTag({ ...mappedTag, canonicalName: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Dirección de Origen en el PLC (sourceAddress)
                </label>
                <input
                  type="text"
                  value={mappedTag.sourceAddress}
                  onChange={(e) => setMappedTag({ ...mappedTag, sourceAddress: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-emerald-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Activo / Equipo Físico (Asset ID)
                </label>
                <input
                  type="text"
                  value={mappedTag.assetId}
                  onChange={(e) => setMappedTag({ ...mappedTag, assetId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Área de Proceso
                </label>
                <input
                  type="text"
                  value={mappedTag.processArea}
                  onChange={(e) => setMappedTag({ ...mappedTag, processArea: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Rango Mínimo (engMin)
                </label>
                <input
                  type="number"
                  value={mappedTag.engMin}
                  onChange={(e) => setMappedTag({ ...mappedTag, engMin: parseFloat(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Rango Máximo (engMax)
                </label>
                <input
                  type="number"
                  value={mappedTag.engMax}
                  onChange={(e) => setMappedTag({ ...mappedTag, engMax: parseFloat(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 8: Data Quality Gate */}
        {currentStep === 8 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 8: Data Quality Gate (Calidad vs Disponibilidad)
              </h3>
              <p className="text-xs text-slate-400">
                Separación explícita: QUALITY (GOOD/BAD/UNCERTAIN) de AVAILABILITY (AVAILABLE/STALE/UNAVAILABLE).
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">Validación de Muestra de Tag</h4>
                  <p className="text-xs text-slate-400 font-mono">{mappedTag.canonicalName}</p>
                </div>
                <button
                  onClick={handleEvaluateQualityGate}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                >
                  Auditar en Quality Gate
                </button>
              </div>

              {gateEvaluation && (
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">QUALITY</span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        gateEvaluation.quality === "GOOD" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {gateEvaluation.quality}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">AVAILABILITY</span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        gateEvaluation.availability === "AVAILABLE" ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {gateEvaluation.availability}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded border border-slate-800 text-center">
                    <span className="text-[10px] text-slate-400 block mb-1">SCORE / STATUS</span>
                    <span
                      className={`text-sm font-bold font-mono ${
                        gateEvaluation.validationStatus === "PASSED" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {gateEvaluation.score}% ({gateEvaluation.validationStatus})
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 9: Commissioning */}
        {currentStep === 9 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 9: Protocolo Formal de Comisionamiento Industrial
              </h3>
              <p className="text-xs text-slate-400">
                10 Pruebas directas desde el Edge Runtime. La evidencia se deriva del hardware, no del navegador.
              </p>
            </div>

            <button
              onClick={handleExecuteCommissioning}
              disabled={isCommissioning}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-medium text-xs flex items-center justify-center gap-2 shadow"
            >
              {isCommissioning ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              Ejecutar Protocolo de Comisionamiento Industrial (10 Pruebas)
            </button>

            {commissioningReport && (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded border text-xs flex items-center justify-between font-mono ${
                    commissioningReport.isFullyCommissioned
                      ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                      : "bg-red-950/40 border-red-800 text-red-300"
                  }`}
                >
                  <span className="font-bold">Estado: {commissioningReport.status}</span>
                  <span>ID: {commissioningReport.commissioningId}</span>
                </div>

                <div className="space-y-1.5 border border-slate-800 rounded-lg p-3 bg-slate-900/50">
                  {commissioningReport.checks.map((c) => (
                    <div
                      key={c.step}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-800/60 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {c.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span className="text-slate-300">{c.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">{c.metric}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 10: Live OT Guard */}
        {currentStep === 10 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-lg font-semibold text-white">
                Paso 10: Verificación de Barrera LIVE_OT (LIVE_OT Guard)
              </h3>
              <p className="text-xs text-slate-400">
                Reglas inviolables: Prohibido SIMULATION → OPERATIONAL. Prohibido UI assertion sin evidencia física reciente.
              </p>
            </div>

            <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    Solicitud de Transición Operacional: LIVE
                  </h4>
                  <p className="text-xs text-slate-400">Inquilino: {tenant.name} ({tenant.id})</p>
                </div>
                <button
                  onClick={handleCheckLiveOtGuard}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Evaluar y Autorizar LIVE_OT
                </button>
              </div>

              {liveGuardResult && (
                <div
                  className={`p-4 rounded-lg border text-xs space-y-2 ${
                    liveGuardResult.permitted
                      ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                      : "bg-red-950/40 border-red-700 text-red-300"
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {liveGuardResult.permitted ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                    <span>{liveGuardResult.permitted ? "AUTORIZACIÓN CONCEDIDA" : "TRANSICIÓN DENEGADA"}</span>
                  </div>
                  <p>{liveGuardResult.reason}</p>

                  {liveGuardResult.evidence && (
                    <div className="pt-2 border-t border-emerald-900/60 font-mono text-[11px] text-slate-300 space-y-0.5">
                      <p>Evidence Hash: {liveGuardResult.evidence.evidenceHash}</p>
                      <p>Gateway ID: {liveGuardResult.evidence.gatewayId}</p>
                      <p>Pass Rate: {liveGuardResult.evidence.dataQualityPassRate}%</p>
                      <p>Runtime: {liveGuardResult.evidence.originRuntime}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-xs font-medium flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Anterior
        </button>

        <div className="text-xs text-slate-400">
          BioAzúcar 4.0 Industrial Integration Pipeline
        </div>

        {currentStep < 10 ? (
          <button
            onClick={() => setCurrentStep((prev) => Math.min(10, prev + 1))}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center gap-1.5"
          >
            Siguiente
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
          >
            Finalizar Commissioning
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
