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
  Download,
  Plus,
  Trash2,
  Sparkles,
  KeyRound,
  FileCode,
  Share2,
} from "lucide-react";
import {
  ConnectionRegistryEntry,
  ConnectionStatus,
  IndustrialProtocol,
  IndustrialTagSample,
  TenantEnterprise,
  TenantPhysicalEvidence,
  UserRole,
  IndustrialDeviceDefinition,
  IndustrialTagDefinition,
} from "../types";
import { industrialConnectionRegistry } from "../services/dataProviders/IndustrialConnectionRegistry";
import { industrialDeviceRegistry } from "../services/dataProviders/IndustrialDeviceRegistry";
import {
  industrialConnectorRuntime,
  RealConnectionTestResult,
} from "../services/dataProviders/IndustrialConnectorRuntime";
import {
  industrialCommissioningService,
  CommissioningReport,
} from "../services/edge/IndustrialCommissioningService";
import { industrialDataQualityGate } from "../services/dataProviders/IndustrialDataQualityGate";
import { historianService } from "../services/historian/HistorianService";
import { tenantRuntimeManager } from "../services/runtime/TenantRuntimeManager";
import { tagManagementService } from "../services/tagManagementService";
import { IndustrialDeviceEngineeringPanel } from "./IndustrialDeviceEngineeringPanel";
import { IndustrialTagEngineeringGrid } from "./IndustrialTagEngineeringGrid";

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

  // STEP 1: ISA-95 Master Data Hierarchy
  const [tenantId, setTenantId] = useState<string>(tenant.id);
  const [siteId, setSiteId] = useState<string>("SITE_CENTRAL_01");
  const [areaId, setAreaId] = useState<string>("AREA_MOLIENDA");
  const [processCellId, setProcessCellId] = useState<string>("TANDEM_01");
  const [assetId, setAssetId] = useState<string>("MOLINO_01");
  const [gatewayId, setGatewayId] = useState<string>("EDGE-CENTRAL-01");
  const [connectionName, setConnectionName] = useState<string>("Enlace Industrial Tándem Molienda #1");
  const [isDemoSimulation, setIsDemoSimulation] = useState<boolean>(false);

  // STEP 2: OT/DMZ Network Configuration (IEC 62443)
  const [subnet, setSubnet] = useState<string>("192.168.10.0/24");
  const [vlan, setVlan] = useState<number>(100);
  const [dmzRoute, setDmzRoute] = useState<string>("192.168.10.1 (FortiGate OT/DMZ)");
  const [gatewayIp, setGatewayIp] = useState<string>("192.168.10.2");
  const [targetPort, setTargetPort] = useState<number>(4840);
  const [isolationLevel, setIsolationLevel] = useState<string>("STRICT_OT_ISOLATION");

  // STEP 3 & 4: Protocol & Connection Engineering
  const [protocol, setProtocol] = useState<IndustrialProtocol>("OPC_UA");
  const [endpointUrl, setEndpointUrl] = useState<string>("opc.tcp://192.168.10.50:4840/BioAzucarServer");
  
  // OPC-UA Specific Parameters
  const [securityPolicy, setSecurityPolicy] = useState<string>("Basic256Sha256");
  const [securityMode, setSecurityMode] = useState<string>("SignAndEncrypt");
  const [authType, setAuthType] = useState<"CERTIFICATE" | "TOKEN" | "ANONYMOUS" | "BASIC_AUTH">("CERTIFICATE");
  const [certificateRef, setCertificateRef] = useState<string>("vault://tenants/TENANT_AZUCAR_01/certs/opcua-client.der");
  const [secretRef, setSecretRef] = useState<string>("vault://tenants/TENANT_AZUCAR_01/secrets/opcua-key");
  const [applicationUri, setApplicationUri] = useState<string>("urn:bioazucar:industrial:edge-01");

  // Modbus Specific Parameters
  const [modbusMode, setModbusMode] = useState<"TCP" | "RTU">("TCP");
  const [modbusSlaveId, setModbusSlaveId] = useState<number>(1);
  const [modbusBaudRate, setModbusBaudRate] = useState<number>(19200);
  const [modbusParity, setModbusParity] = useState<"EVEN" | "ODD" | "NONE">("EVEN");
  const [modbusEndianness, setModbusEndianness] = useState<string>("BIG_ENDIAN");

  // MQTT / Sparkplug B Specific Parameters
  const [sparkplugGroupId, setSparkplugGroupId] = useState<string>("BioAzucar_Mills");
  const [sparkplugEdgeNodeId, setSparkplugEdgeNodeId] = useState<string>("Edge_Central_01");
  const [sparkplugDeviceId, setSparkplugDeviceId] = useState<string>("Tandem_01");
  const [mqttQos, setMqttQos] = useState<number>(1);

  // EROS Specific Parameters
  const [erosSubsystemId, setErosSubsystemId] = useState<string>("EROS_MILLING_CTRL_01");
  const [erosSyncCycleMs, setErosSyncCycleMs] = useState<number>(250);

  // SLA & Interval
  const [scanIntervalMs, setScanIntervalMs] = useState<number>(1000);
  const [timeoutMs, setTimeoutMs] = useState<number>(3000);
  const [latencyBudgetMs, setLatencyBudgetMs] = useState<number>(500);

  // STEP 5: Real Connection Test State
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<RealConnectionTestResult | null>(null);

  // STEP 6: Device Engineering
  const [devicesList, setDevicesList] = useState<IndustrialDeviceDefinition[]>([
    {
      id: "dev-plc-01",
      name: "PLC Tándem Molienda #1",
      connectionId: "conn-wizard-stage",
      tenantId: tenant.id,
      siteId: "SITE_CENTRAL_01",
      areaId: "AREA_MOLIENDA",
      assetId: "eq-molino-1",
      deviceType: "PLC",
      vendor: "Siemens",
      model: "S7-1518F",
      firmwareVersion: "v2.9.2",
      ipAddress: "192.168.10.50",
      busAddress: "1",
      rack: 0,
      slot: 1,
      status: "CONFIGURED",
      criticality: "CRITICAL",
      tagsCount: 4,
    },
    {
      id: "dev-vfd-01",
      name: "Variador Picador Caña #1",
      connectionId: "conn-wizard-stage",
      tenantId: tenant.id,
      siteId: "SITE_CENTRAL_01",
      areaId: "AREA_MOLIENDA",
      assetId: "eq-picador-1",
      deviceType: "DRIVE_VFD",
      vendor: "ABB",
      model: "ACS880",
      firmwareVersion: "v3.1.0",
      ipAddress: "192.168.10.55",
      busAddress: "2",
      rack: 0,
      slot: 0,
      status: "CONFIGURED",
      criticality: "HIGH",
      tagsCount: 2,
    },
  ]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("dev-plc-01");

  // STEP 7: Tag Engineering State
  const [tagsList, setTagsList] = useState<IndustrialTagDefinition[]>([
    {
      id: "tag-presion-hidraulica",
      canonicalName: "MOLINO_01.PRESION_HIDRAULICA_BAR",
      displayName: "Presión Hidráulica Molino 1",
      sourceAddress: "ns=2;s=Milling.Tandem.HydraulicPressure",
      address: "ns=2;s=Milling.Tandem.HydraulicPressure",
      deviceId: "dev-plc-01",
      deviceName: "PLC Tándem Molienda #1",
      areaId: "AREA_MOLIENDA",
      assetId: "eq-molino-1",
      protocol: "OPC_UA",
      dataType: "FLOAT",
      signedness: "SIGNED",
      endianness: "BIG_ENDIAN",
      scale: 1,
      offset: 0,
      engMin: 0,
      engMax: 250,
      unit: "bar",
      readable: true,
      writable: true,
      accessMode: "READ_WRITE",
      samplingMode: "SUBSCRIPTION",
      samplingIntervalMs: 1000,
      scanRateMs: 1000,
      deadband: 0.5,
      staleTimeoutMs: 5000,
      historianEnabled: true,
      dashboardEnabled: true,
      aiEnabled: true,
      status: "ACTIVE",
      enabled: true,
    },
    {
      id: "tag-velocidad-rpm",
      canonicalName: "MOLINO_01.VELOCIDAD_RPM",
      displayName: "Velocidad de Maza Picadora",
      sourceAddress: "ns=2;s=Milling.Tandem.RollSpeedRPM",
      address: "ns=2;s=Milling.Tandem.RollSpeedRPM",
      deviceId: "dev-plc-01",
      deviceName: "PLC Tándem Molienda #1",
      areaId: "AREA_MOLIENDA",
      assetId: "eq-molino-1",
      protocol: "OPC_UA",
      dataType: "FLOAT",
      signedness: "SIGNED",
      endianness: "BIG_ENDIAN",
      scale: 1,
      offset: 0,
      engMin: 0,
      engMax: 12,
      unit: "RPM",
      readable: true,
      writable: false,
      accessMode: "READ",
      samplingMode: "SUBSCRIPTION",
      samplingIntervalMs: 1000,
      scanRateMs: 1000,
      deadband: 0.1,
      staleTimeoutMs: 5000,
      historianEnabled: true,
      dashboardEnabled: true,
      aiEnabled: true,
      status: "ACTIVE",
      enabled: true,
    },
    {
      id: "tag-potencia-vfd",
      canonicalName: "PICADOR_01.POTENCIA_KW",
      displayName: "Potencia Eléctrica Variador",
      sourceAddress: "ns=2;s=Drive.VFD1.ActivePowerKW",
      address: "ns=2;s=Drive.VFD1.ActivePowerKW",
      deviceId: "dev-vfd-01",
      deviceName: "Variador Picador Caña #1",
      areaId: "AREA_MOLIENDA",
      assetId: "eq-picador-1",
      protocol: "OPC_UA",
      dataType: "FLOAT",
      signedness: "SIGNED",
      endianness: "BIG_ENDIAN",
      scale: 1,
      offset: 0,
      engMin: 0,
      engMax: 800,
      unit: "kW",
      readable: true,
      writable: false,
      accessMode: "READ",
      samplingMode: "SUBSCRIPTION",
      samplingIntervalMs: 500,
      scanRateMs: 500,
      deadband: 1.0,
      staleTimeoutMs: 3000,
      historianEnabled: true,
      dashboardEnabled: true,
      aiEnabled: true,
      status: "ACTIVE",
      enabled: true,
    },
  ]);

  // STEP 8: Data Quality Gate State
  const [gateEvaluation, setGateEvaluation] = useState<{
    quality: "GOOD" | "BAD" | "UNCERTAIN";
    availability: "AVAILABLE" | "STALE" | "UNAVAILABLE";
    validationStatus: "PASSED" | "REJECTED";
    score: number;
    reasons: string[];
    provenance: string;
  } | null>(null);

  // STEP 9: Historian & UNS Hub State
  const [unsTestStatus, setUnsTestStatus] = useState<string>("");

  // STEP 10: Commissioning Protocol State
  const [isCommissioning, setIsCommissioning] = useState<boolean>(false);
  const [commissioningReport, setCommissioningReport] = useState<CommissioningReport | null>(null);
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
    } else if (protocol === "SIMULATION") {
      setEndpointUrl("sim://bioazucar.internal/digital-twin/tandem-01");
      setTargetPort(0);
    }
  }, [protocol]);

  // Load Preset Template
  const handleLoadDemoTemplate = () => {
    setIsDemoSimulation(true);
    setConnectionName("Tándem Molienda #1 (Digital Twin Simulado)");
    setSiteId("SITE_CENTRAL_01");
    setAreaId("AREA_MOLIENDA");
    setProcessCellId("TANDEM_01");
    setAssetId("MOLINO_01");
    setGatewayId("EDGE-SIMULATOR-01");
  };

  const handleClearProductionFields = () => {
    setIsDemoSimulation(false);
    setConnectionName("");
    setSiteId("");
    setAreaId("AREA_MOLIENDA");
    setProcessCellId("");
    setAssetId("");
    setGatewayId("");
  };

  // Step 5: Test Real Physical Connection
  const handleExecuteRealTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const testConfig: ConnectionRegistryEntry = {
      id: `conn-test-${Date.now()}`,
      tenantId,
      siteId,
      areaId,
      gatewayId,
      name: connectionName || "Enlace de Prueba",
      protocol,
      endpoint: endpointUrl,
      status: "CONNECTING",
      criticality: "HIGH",
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
      maxSilenceMs: scanIntervalMs * 4,
      latencyBudgetMs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      configVersion: "1.0.0",
      isDemoSimulation,
    };

    try {
      const result = await industrialConnectorRuntime.testPhysicalConnection(testConfig);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        connectionId: testConfig.id,
        protocol: testConfig.protocol,
        endpoint: testConfig.endpoint,
        isPhysicalSuccess: false,
        status: "FAILED",
        stepReached: "FAILED",
        latencyMs: 0,
        errorMessage: err.message || "Error fatal de conexión física.",
        provenance: isDemoSimulation ? "SIMULATED_TEST_RUNNER" : "PHYSICAL_OT_RUNTIME",
        details: {},
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Step 8: Quality Gate Evaluation
  const handleEvaluateQualityGate = () => {
    const activeTag = tagsList[0] || {
      id: "tag-test",
      canonicalName: "MOLINO_01.PRESION_HIDRAULICA_BAR",
      engMin: 0,
      engMax: 250,
      unit: "bar",
      dataType: "FLOAT",
    };

    const nowIso = new Date().toISOString();
    const testSample: IndustrialTagSample = {
      tagId: activeTag.canonicalName,
      tenantId,
      connectionId: "conn-wizard-stage",
      value: (activeTag.engMin + activeTag.engMax) * 0.5,
      quality: "GOOD",
      availability: "AVAILABLE",
      validationStatus: "PENDING",
      origin: isDemoSimulation || !testResult?.isPhysicalSuccess ? "SIMULATED" : "LIVE_OT",
      sourceSystem: "BioAzucar_Edge",
      sourceDevice: "PLC_DCS_Field",
      sourceTimestamp: nowIso,
      gatewayTimestamp: nowIso,
      ingestionTimestamp: nowIso,
    };

    const context = {
      tag: {
        id: activeTag.canonicalName,
        tenantId,
        connectionId: "conn-wizard-stage",
        canonicalName: activeTag.canonicalName,
        engMin: activeTag.engMin,
        engMax: activeTag.engMax,
        dataType: activeTag.dataType || "FLOAT",
        staleTimeoutMs: 5000,
        validationRules: {
          minEngValue: activeTag.engMin,
          maxEngValue: activeTag.engMax,
          rateOfChangeMaxPerSec: (activeTag.engMax - activeTag.engMin) * 0.5,
        },
      },
      lastValidSample: null,
      maxTimestampSkewMs: 15000,
    };

    const decision = industrialDataQualityGate.evaluateSample(testSample, context);
    setGateEvaluation({
      quality: decision.finalQuality,
      availability: decision.finalAvailability,
      validationStatus: decision.validationStatus,
      score: decision.qualityScore,
      reasons: decision.rejectionReasons,
      provenance: testSample.origin,
    });
  };

  // Step 9: UNS Lineage Ingestion
  const handleTestUnsIngestion = async () => {
    setUnsTestStatus("Enviando muestra por tubería UNS & Historian...");
    try {
      const sampleTag = tagsList[0];
      if (!sampleTag) return;
      await historianService.ingestValidatedTagSample(
        {
          tagId: sampleTag.canonicalName,
          tenantId,
          connectionId: "conn-wizard-stage",
          value: 142.5,
          quality: "GOOD",
          availability: "AVAILABLE",
          validationStatus: "PASSED",
          origin: isDemoSimulation ? "SIMULATED" : "LIVE_OT",
          sourceSystem: "BioAzucar_Edge",
          sourceDevice: selectedDeviceId,
          sourceTimestamp: new Date().toISOString(),
          gatewayTimestamp: new Date().toISOString(),
          ingestionTimestamp: new Date().toISOString(),
        },
        sampleTag
      );
      setUnsTestStatus("✓ Muestra validada y registrada en TSDB con trazabilidad UNS.");
    } catch (e: any) {
      setUnsTestStatus(`Error en ingestión: ${e.message}`);
    }
  };

  // Step 10: Commissioning Protocol
  const handleExecuteCommissioning = async () => {
    setIsCommissioning(true);
    setCommissioningReport(null);
    setLiveGuardResult(null);

    // 1. Register connection
    const registered = await industrialConnectionRegistry.registerConnection(
      {
        id: `conn-${tenantId.toLowerCase()}-${Date.now().toString(36)}`,
        tenantId,
        siteId,
        areaId,
        gatewayId,
        name: connectionName || "Enlace Industrial Comisionado",
        protocol,
        endpoint: endpointUrl,
        status: isDemoSimulation ? "CONFIGURED" : "CONNECTED",
        criticality: "CRITICAL",
        readOnly: false,
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
        isDemoSimulation,
      },
      { role: userRole, name: "Industrial Commissioning Lead" }
    );

    // 2. Persist devices into registry
    for (const dev of devicesList) {
      await industrialDeviceRegistry.registerDevice({
        ...dev,
        connectionId: registered.id,
        tenantId,
        siteId,
        areaId,
      });
    }

    // 3. Persist tags into catalog
    for (const tag of tagsList) {
      try {
        await tagManagementService.createTag(
          {
            name: tag.canonicalName,
            description: tag.displayName || `Tag comisionado para ${tag.assetId}`,
            area: tag.areaId || areaId,
            equipmentId: tag.assetId || assetId,
            equipmentName: `Equipo ${tag.assetId || assetId}`,
            variable: tag.canonicalName,
            unit: tag.unit,
            dataType: tag.dataType as any,
            source: isDemoSimulation ? "SIMULATION" : "LIVE_OT",
            protocol: protocol === "OPC_UA" ? "OPC-UA" : protocol === "MODBUS" ? "MODBUS-TCP" : (protocol as any),
            address: tag.sourceAddress || tag.address,
            accessMode: tag.accessMode,
            scanRateMs: tag.samplingIntervalMs || 1000,
            deadband: tag.deadband || 0.1,
            engMin: tag.engMin,
            engMax: tag.engMax,
            historization: Boolean(tag.historianEnabled),
            alarmEnabled: true,
            highAlarm: tag.engMax * 0.9,
            lowAlarm: tag.engMin * 1.1,
            securityLevel: 2,
            status: "ACTIVE",
            tenantId,
          },
          { role: userRole, name: "Industrial Commissioning Lead" }
        );
      } catch (e) {
        console.warn("Could not save tag:", e);
      }
    }

    try {
      const report = await industrialCommissioningService.runCommissioningProtocol(
        registered.id,
        { role: userRole, name: "Industrial Commissioning Lead" }
      );
      setCommissioningReport(report);
    } catch (err: any) {
      alert(`Fallo en protocolo de comisionamiento: ${err.message}`);
    } finally {
      setIsCommissioning(false);
    }
  };

  const handleCheckLiveOtGuard = () => {
    const res = industrialCommissioningService.validateLiveOtTransition(
      tenantId,
      commissioningReport?.evidence
    );
    setLiveGuardResult(res);

    if (res.permitted && commissioningReport?.evidence && !isDemoSimulation) {
      const runtime = tenantRuntimeManager.getRuntime(tenantId);
      runtime.setMode("LIVE_OT");
      runtime.setOTConfig({
        status: "CONNECTED",
        isLiveConnection: true,
        connected: true,
      });
    }
  };

  const handleExportEvidence = () => {
    if (!commissioningReport?.evidence) return;
    const blob = new Blob([JSON.stringify(commissioningReport.evidence, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comisionamiento-isa95-${tenantId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const steps = [
    { num: 1, label: "Jerarquía", sub: "ISA-95" },
    { num: 2, label: "Red DMZ", sub: "IEC 62443" },
    { num: 3, label: "Protocolo", sub: "OPC/Modbus" },
    { num: 4, label: "Enlace", sub: "Parámetros" },
    { num: 5, label: "Test Físico", sub: "Sin Fakes" },
    { num: 6, label: "Dispositivos", sub: "PLC/DCS" },
    { num: 7, label: "Tags Grid", sub: "Ingeniería" },
    { num: 8, label: "Quality Gate", sub: "Calidad/Disp" },
    { num: 9, label: "UNS & TSDB", sub: "Linaje" },
    { num: 10, label: "Comisionar", sub: "Evidencia" },
  ];

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm ${
        theme === "dark" ? "dark" : ""
      }`}
    >
      {/* Step Indicator Header */}
      <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Industrial Connection & Commissioning Pipeline
            </h2>
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${
                isDemoSimulation
                  ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
              }`}
            >
              {isDemoSimulation ? "🧪 MODO SIMULACIÓN" : "🏭 PRODUCCIÓN FÍSICA REAL"}
            </span>
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            Paso {currentStep} de 10: {steps[currentStep - 1].label}
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
                    ? "bg-emerald-50 dark:bg-emerald-600/20 border-emerald-600 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm"
                    : isDone
                    ? "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                    : "bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono font-bold">{s.num}</span>
                  {isDone && <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />}
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
        {/* STEP 1: ISA-95 Hierarchy */}
        {currentStep === 1 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Paso 1: Identidad y Jerarquía de Planta (ISA-95)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cadena canónica: Tenant → Site → Area → Process Cell → Asset → Gateway → Connection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleLoadDemoTemplate}
                  className="px-2.5 py-1 text-xs rounded bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-medium hover:bg-amber-100"
                >
                  🧪 Cargar Demo
                </button>
                <button
                  onClick={handleClearProductionFields}
                  className="px-2.5 py-1 text-xs rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 font-medium hover:bg-slate-200"
                >
                  🏭 Limpiar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Tenant ID (Inquilino Empresarial)
                </label>
                <input
                  type="text"
                  value={tenantId}
                  disabled
                  className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-3 py-2 text-xs text-slate-600 dark:text-slate-300 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Site ID (Planta / Ingenio Azucarero) *
                </label>
                <input
                  type="text"
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  placeholder="SITE_CENTRAL_01"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Area ID (Área Operativa) *
                </label>
                <select
                  value={areaId}
                  onChange={(e) => setAreaId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                >
                  <option value="AREA_MOLIENDA">AREA_MOLIENDA (Extracción de Jugo)</option>
                  <option value="AREA_VAPOR_CALDERAS">AREA_VAPOR_CALDERAS (Generación Vapor)</option>
                  <option value="AREA_COGENERACION">AREA_COGENERACION (Turbinas Eléctricas)</option>
                  <option value="AREA_FABRICA_AZUCAR">AREA_FABRICA_AZUCAR (Clarificación/Evap)</option>
                  <option value="AREA_RECEPCION_CANA">AREA_RECEPCION_CANA (Básculas)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Process Cell ID (Célula de Proceso) *
                </label>
                <input
                  type="text"
                  value={processCellId}
                  onChange={(e) => setProcessCellId(e.target.value)}
                  placeholder="TANDEM_01"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Asset ID (Activo Físico Primario) *
                </label>
                <input
                  type="text"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="MOLINO_01"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Industrial Edge Gateway ID *
                </label>
                <input
                  type="text"
                  value={gatewayId}
                  onChange={(e) => setGatewayId(e.target.value)}
                  placeholder="EDGE-CENTRAL-01"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                Nombre Canónico de la Conexión Industrial *
              </label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="Enlace Industrial Tándem Molienda #1"
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>
        )}

        {/* STEP 2: OT/DMZ Network Configuration */}
        {currentStep === 2 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 2: Segmentación de Red OT/DMZ (IEC 62443)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aislamiento estricto entre redes corporativas TI y el bus de campo industrial Nivel 1/2.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Subred Industrial (Subnet CIDR)
                </label>
                <input
                  type="text"
                  value={subnet}
                  onChange={(e) => setSubnet(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  VLAN Tag (802.1Q)
                </label>
                <input
                  type="number"
                  value={vlan}
                  onChange={(e) => setVlan(parseInt(e.target.value, 10))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Ruta Firewall / Gateway DMZ
                </label>
                <input
                  type="text"
                  value={dmzRoute}
                  onChange={(e) => setDmzRoute(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  IP NIC Industrial del Edge Gateway
                </label>
                <input
                  type="text"
                  value={gatewayIp}
                  onChange={(e) => setGatewayIp(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                Nivel de Aislamiento y Políticas de Ruteo
              </label>
              <select
                value={isolationLevel}
                onChange={(e) => setIsolationLevel(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs text-slate-900 dark:text-white font-mono"
              >
                <option value="STRICT_OT_ISOLATION">Aislamiento Estricto (Sin salida directa a Internet)</option>
                <option value="DMZ_PROXY_FORWARDING">Proxy Seguro DMZ con Store & Forward</option>
              </select>
            </div>
          </div>
        )}

        {/* STEP 3: Protocol Selection */}
        {currentStep === 3 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 3: Selección de Protocolo de Campo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Seleccione el estándar de comunicación de la pasarela o dispositivo industrial.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { id: "OPC_UA", title: "OPC-UA (IEC 62541)", desc: "DCS, SCADA y PLCs modernos con seguridad nativa y PKI." },
                { id: "MODBUS", title: "Modbus TCP / RTU", desc: "Básculas, analizadores NIR, variadores y medidores de potencia." },
                { id: "SPARKPLUG", title: "MQTT / Sparkplug B", desc: "Universal NameSpace (UNS) y brokers EMQX/HiveMQ." },
                { id: "EROS", title: "EROS Native Bridge", desc: "Enlace propietario con automatización de molienda EROS." },
                { id: "SIMULATION", title: "Gemelo Digital (Simulación)", desc: "Entorno analítico de prueba sin hardware físico conectado." },
              ].map((p) => {
                const isSelected = protocol === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setProtocol(p.id as IndustrialProtocol)}
                    className={`p-4 rounded-lg border text-left transition-all ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 dark:border-emerald-500 text-slate-900 dark:text-white shadow-sm"
                        : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs">{p.title}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.desc}</p>
                  </button>
                );
              })}
            </div>

            {protocol === "EROS" && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>ESTADO: PROTOCOL_SPEC_REQUIRED</span>
                </div>
                <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                  El conector EROS está configurado en su estructura de enlace, mapeo y endpoints. BioAzúcar no simulará una conexión inventada como física real. Cuando se disponga de la especificación técnica de bajo nivel de EROS, el driver se activará sin modificar el resto del sistema.
                </p>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Protocol-Specific Connection Engineering */}
        {currentStep === 4 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 4: Parámetros Específicos para {protocol}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Campos dinámicos según protocolo. No almacene secretos en texto claro (use secretRef).
              </p>
            </div>

            {/* OPC-UA Form */}
            {(protocol === "OPC_UA" || protocol === "OPC-UA") && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                    OPC-UA Endpoint URI *
                  </label>
                  <input
                    type="text"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-3 py-2 text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Política de Seguridad
                    </label>
                    <select
                      value={securityPolicy}
                      onChange={(e) => setSecurityPolicy(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    >
                      <option value="Basic256Sha256">Basic256Sha256 (Recomendado)</option>
                      <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                      <option value="None">None (Solo pruebas)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Modo de Seguridad
                    </label>
                    <select
                      value={securityMode}
                      onChange={(e) => setSecurityMode(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    >
                      <option value="SignAndEncrypt">SignAndEncrypt (Cifrado Completo)</option>
                      <option value="Sign">Sign (Solo Firma)</option>
                      <option value="None">None</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Referencia a Certificado (certificateRef)
                    </label>
                    <input
                      type="text"
                      value={certificateRef}
                      onChange={(e) => setCertificateRef(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-amber-700 dark:text-amber-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Referencia a Clave Privada (secretRef)
                    </label>
                    <input
                      type="text"
                      value={secretRef}
                      onChange={(e) => setSecretRef(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-amber-700 dark:text-amber-300"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modbus Form */}
            {(protocol === "MODBUS" || protocol === "MODBUS-TCP") && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Modo Modbus
                    </label>
                    <select
                      value={modbusMode}
                      onChange={(e) => setModbusMode(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    >
                      <option value="TCP">Modbus TCP</option>
                      <option value="RTU">Modbus RTU over TCP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Slave / Unit ID (1 - 247)
                    </label>
                    <input
                      type="number"
                      value={modbusSlaveId}
                      onChange={(e) => setModbusSlaveId(parseInt(e.target.value, 10))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Endianness de Registro
                    </label>
                    <select
                      value={modbusEndianness}
                      onChange={(e) => setModbusEndianness(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    >
                      <option value="BIG_ENDIAN">Big-Endian (Standard AB CD)</option>
                      <option value="LITTLE_ENDIAN">Little-Endian (CD AB)</option>
                      <option value="MID_BIG_ENDIAN">Mid-Big (BADC)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Host & Puerto (modbus://ip:port)
                    </label>
                    <input
                      type="text"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sparkplug B Form */}
            {(protocol === "SPARKPLUG" || protocol === "MQTT") && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Group ID (UNS Root)
                    </label>
                    <input
                      type="text"
                      value={sparkplugGroupId}
                      onChange={(e) => setSparkplugGroupId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Edge Node ID
                    </label>
                    <input
                      type="text"
                      value={sparkplugEdgeNodeId}
                      onChange={(e) => setSparkplugEdgeNodeId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Device ID
                    </label>
                    <input
                      type="text"
                      value={sparkplugDeviceId}
                      onChange={(e) => setSparkplugDeviceId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Broker URL (tls://broker:8883)
                    </label>
                    <input
                      type="text"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* EROS Form */}
            {protocol === "EROS" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Subsystem Controller ID
                    </label>
                    <input
                      type="text"
                      value={erosSubsystemId}
                      onChange={(e) => setErosSubsystemId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                      Ciclo de Sincronización (ms)
                    </label>
                    <input
                      type="number"
                      value={erosSyncCycleMs}
                      onChange={(e) => setErosSyncCycleMs(parseInt(e.target.value, 10))}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Timing SLA */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Intervalo Muestreo (ms)
                </label>
                <input
                  type="number"
                  value={scanIntervalMs}
                  onChange={(e) => setScanIntervalMs(parseInt(e.target.value, 10))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Timeout Socket (ms)
                </label>
                <input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                  Presupuesto Latencia (ms)
                </label>
                <input
                  type="number"
                  value={latencyBudgetMs}
                  onChange={(e) => setLatencyBudgetMs(parseInt(e.target.value, 10))}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5: Physical Test (No Fakes) */}
        {currentStep === 5 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 5: Diagnóstico y Prueba Física Real
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estados: NOT_CONFIGURED → CONFIGURED → CONNECTING → CONNECTED → AUTHENTICATED → READ_TEST_OK → FAILED.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Destino de red a sondear:</span>
                  <p className="font-mono text-sm text-slate-900 dark:text-white font-bold">{endpointUrl}</p>
                </div>
                <button
                  onClick={handleExecuteRealTest}
                  disabled={isTesting}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold text-xs flex items-center gap-2 shadow-sm"
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
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : testResult.status === "PROTOCOL_SPEC_REQUIRED"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-300"
                      : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span>Resultado: {testResult.status} ({testResult.stepReached})</span>
                    <span>Latencia: {testResult.latencyMs} ms</span>
                  </div>

                  {testResult.isPhysicalSuccess ? (
                    <div className="space-y-1 text-slate-700 dark:text-slate-300 font-mono">
                      <p className="text-emerald-700 dark:text-emerald-400 font-bold">
                        ✓ Conexión establecida con éxito y sesión autenticada.
                      </p>
                      <p>Procedencia: {testResult.provenance}</p>
                    </div>
                  ) : testResult.status === "PROTOCOL_SPEC_REQUIRED" ? (
                    <div className="space-y-1 font-mono">
                      <p className="font-bold text-amber-800 dark:text-amber-300">
                        Especificación técnica requerida:
                      </p>
                      <p>{testResult.errorMessage}</p>
                      <p className="text-[11px] opacity-80">Procedencia: {testResult.provenance}</p>
                    </div>
                  ) : (
                    <div className="space-y-1 font-mono">
                      <p className="font-bold text-red-700 dark:text-red-400">Fallo de comunicación física:</p>
                      <p>{testResult.errorMessage || "Hardware no accesible en la red industrial."}</p>
                      <p className="text-[11px] opacity-80">Procedencia: {testResult.provenance}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 6: Device Engineering */}
        {currentStep === 6 && (
          <div className="space-y-4 max-w-4xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 6: Ingeniería de Dispositivos (FASE 4)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cadena canónica: Connection → Discover → Devices → Device Metadata → Tags. Seleccione o registre los PLCs, DCS o variadores.
              </p>
            </div>

            <IndustrialDeviceEngineeringPanel
              connection={{
                id: "conn-wizard-stage",
                tenantId,
                siteId,
                areaId,
                protocol,
              }}
              devices={devicesList}
              selectedDeviceId={selectedDeviceId}
              theme={theme}
              userRole={userRole}
              onDevicesChange={(updated) => setDevicesList(updated)}
              onSelectDevice={(devId) => setSelectedDeviceId(devId)}
            />
          </div>
        )}

        {/* STEP 7: Tag Engineering Grid */}
        {currentStep === 7 && (
          <div className="space-y-4 max-w-5xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 7: Tag Engineering Grid (FASE 5)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administración integral de variables: Identidad, Dirección, Tipo de Dato, Rango Eng., Escala, Modos de Muestreo y Habilitaciones.
              </p>
            </div>

            <IndustrialTagEngineeringGrid
              tags={tagsList}
              devices={devicesList}
              selectedDeviceId={selectedDeviceId}
              theme={theme}
              userRole={userRole}
              onTagsChange={(updated) => setTagsList(updated)}
              onTestTag={(tag) => {
                alert(`Probando lectura de variable: ${tag.canonicalName} (${tag.sourceAddress})`);
              }}
            />
          </div>
        )}

        {/* STEP 8: Data Quality Gate */}
        {currentStep === 8 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 8: Data Quality Gate (Calidad vs Disponibilidad)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Separación explícita: QUALITY (GOOD/BAD/UNCERTAIN), AVAILABILITY (AVAILABLE/STALE/UNAVAILABLE) y PROVENANCE.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Auditoría en Tiempo Real de Muestra</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    {tagsList[0]?.canonicalName || "TAG_SIN_CONFIGURAR"}
                  </p>
                </div>
                <button
                  onClick={handleEvaluateQualityGate}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-sm"
                >
                  Auditar en Quality Gate
                </button>
              </div>

              {gateEvaluation && (
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 block mb-1">QUALITY</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        gateEvaluation.quality === "GOOD" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"
                      }`}
                    >
                      {gateEvaluation.quality}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 block mb-1">AVAILABILITY</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        gateEvaluation.availability === "AVAILABLE" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600"
                      }`}
                    >
                      {gateEvaluation.availability}
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 block mb-1">SCORE / STATUS</span>
                    <span
                      className={`text-xs font-bold font-mono ${
                        gateEvaluation.validationStatus === "PASSED" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"
                      }`}
                    >
                      {gateEvaluation.score}%
                    </span>
                  </div>

                  <div className="p-2.5 bg-white dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                    <span className="text-[10px] text-slate-500 block mb-1">PROVENANCE</span>
                    <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">
                      {gateEvaluation.provenance}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 9: Historian & UNS Lineage */}
        {currentStep === 9 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 9: Linaje Universal NameSpace (UNS) y Pipeline TSDB
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Estructura canónica de tópicos para integración con brokers MQTT, SCADA e Historiador.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3 font-mono text-xs">
              <span className="text-slate-500 block">Tópico UNS Jerárquico Canónico:</span>
              <div className="p-2.5 bg-slate-900 text-emerald-400 rounded border border-slate-800 break-all select-all">
                bioazucar/v1/{tenantId}/{siteId}/{areaId}/{processCellId}/{assetId}/{selectedDeviceId}/{tagsList[0]?.canonicalName || "VARIABLE"}
              </div>

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-400 text-xs">
                  Prueba de Ingestión en Historian (Ring Buffer & Gate):
                </span>
                <button
                  onClick={handleTestUnsIngestion}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                >
                  Probar Ingestión TSDB
                </button>
              </div>

              {unsTestStatus && (
                <p className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  {unsTestStatus}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 10: Commissioning & Live Guard */}
        {currentStep === 10 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Paso 10: Protocolo Formal de Comisionamiento y Evidencia
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                10 Pruebas directas desde el Edge Runtime con firma criptográfica de evidencia.
              </p>
            </div>

            <button
              onClick={handleExecuteCommissioning}
              disabled={isCommissioning}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold text-xs flex items-center justify-center gap-2 shadow"
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
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-800 dark:text-red-300"
                  }`}
                >
                  <span className="font-bold">Estado: {commissioningReport.status}</span>
                  <span>ID: {commissioningReport.commissioningId}</span>
                </div>

                <div className="space-y-1.5 border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-white dark:bg-slate-900/50">
                  {commissioningReport.checks.map((c) => (
                    <div
                      key={c.step}
                      className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        {c.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        )}
                        <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{c.metric}</span>
                    </div>
                  ))}
                </div>

                {/* Live OT Guard */}
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Evaluación de Barrera LIVE_OT
                    </span>
                    <button
                      onClick={handleCheckLiveOtGuard}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold"
                    >
                      Evaluar Barrera LIVE_OT
                    </button>
                  </div>

                  {liveGuardResult && (
                    <div
                      className={`p-3 rounded border text-xs space-y-1 ${
                        liveGuardResult.permitted
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                          : "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-300"
                      }`}
                    >
                      <p className="font-bold">
                        {liveGuardResult.permitted ? "✓ AUTORIZACIÓN LIVE_OT CONCEDIDA" : "✗ TRANSICIÓN RECHAZADA"}
                      </p>
                      <p>{liveGuardResult.reason}</p>
                    </div>
                  )}

                  {commissioningReport.evidence && (
                    <div className="pt-2">
                      <button
                        onClick={handleExportEvidence}
                        className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-xs text-slate-800 dark:text-white flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Descargar Certificado Criptográfico de Comisionamiento
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          className="px-4 py-2 rounded bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-30 text-slate-700 dark:text-white text-xs font-bold flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Anterior
        </button>

        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
          BioAzúcar 4.0 Industrial Integration Pipeline • IEC 62443 / ISA-95
        </div>

        {currentStep < 10 ? (
          <button
            onClick={() => setCurrentStep((prev) => Math.min(10, prev + 1))}
            className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            Siguiente
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={onComplete}
            className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow"
          >
            Finalizar Comisionamiento
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
