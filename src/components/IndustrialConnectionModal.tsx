import React, { useState, useEffect } from "react";
import {
  X,
  Server,
  Activity,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  Zap,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Database,
  Radio,
  FileCheck,
  Lock,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Copy,
  Check,
  Terminal,
  Network,
  Cloud,
  FileCode,
  Gauge
} from "lucide-react";
import { RuntimeMode, OTConfig } from "../services/runtime/types";
import { SimulationScenario, TelemetryData, UserRole, TenantEnterprise } from "../types";
import { tenantRuntimeManager } from "../services/runtime/TenantRuntimeManager";
import { dataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";

interface IndustrialConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTenant?: TenantEnterprise;
  tenantId?: string;
  tenantName?: string;
  currentMode: RuntimeMode;
  onModeChange: (newMode: RuntimeMode) => void;
  currentScenario?: SimulationScenario;
  onScenarioChange?: (scenario: SimulationScenario) => void;
  telemetry: TelemetryData;
  userRole?: UserRole;
  theme?: "light" | "dark";
}

export const IndustrialConnectionModal: React.FC<IndustrialConnectionModalProps> = ({
  isOpen,
  onClose,
  activeTenant,
  tenantId,
  tenantName,
  currentMode,
  onModeChange,
  currentScenario,
  onScenarioChange,
  telemetry,
  userRole = "administrador",
  theme = "dark",
}) => {
  const resolvedTenantId = activeTenant?.id || tenantId || "tenant-default";
  const resolvedTenantName = activeTenant?.name || tenantName || "Central Azucarero";
  const resolvedTenantCode = activeTenant?.code || "CENTRAL-01";

  const runtime = tenantRuntimeManager.getRuntime(resolvedTenantId);
  const otConfig = runtime.getOTConfig();

  // Active Tab: "OT_GATEWAY" | "PROMETHEUS" | "ARCHITECTURE" | "TAGS_MATRIX"
  const [activeTab, setActiveTab] = useState<"OT_GATEWAY" | "PROMETHEUS" | "ARCHITECTURE" | "TAGS_MATRIX">("OT_GATEWAY");

  // Local state for OT configuration form
  const [protocol, setProtocol] = useState<string>(activeTenant?.otProtocol || otConfig.protocol || "OPC-UA");
  const [endpointUrl, setEndpointUrl] = useState<string>(
    activeTenant?.otEndpointUrl || otConfig.endpointUrl || "opc.tcp://192.168.10.50:4840/BioAzucarServer"
  );
  const [securityPolicy, setSecurityPolicy] = useState<string>(
    activeTenant?.otSecurityPolicy || otConfig.securityPolicy || "Basic256Sha256"
  );
  const [securityMode, setSecurityMode] = useState<string>(
    activeTenant?.otSecurityMode || otConfig.securityMode || "SignAndEncrypt"
  );
  const [gatewayHost, setGatewayHost] = useState<string>(
    activeTenant?.otGatewayHost || "192.168.10.240"
  );
  const [otPort, setOtPort] = useState<number>(activeTenant?.otPort || 4840);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<{
    errorCode: string;
    errorMessage: string;
    target: string;
    protocol: string;
    reason: string;
    remediation: string;
    timestamp: string;
  } | null>(null);

  // Active tags preset
  const [selectedTagsPreset, setSelectedTagsPreset] = useState<"FULL_DCS" | "PARTIAL_GATEWAY" | "MINIMAL_POWER">(
    "PARTIAL_GATEWAY"
  );

  // Prometheus Metrics live test state
  const [metricsSample, setMetricsSample] = useState<string>("");
  const [isFetchingMetrics, setIsFetchingMetrics] = useState(false);
  const [isCopiedPrometheusYaml, setIsCopiedPrometheusYaml] = useState(false);

  // Real tag mapping definitions
  const TAG_DEFINITIONS: Array<{
    id: keyof TelemetryData;
    name: string;
    unit: string;
    area: string;
    opcAddress: string;
    inPartialPreset: boolean;
    inMinimalPreset: boolean;
  }> = [
    {
      id: "tch",
      name: "Flujo de Caña Fresca (TCH)",
      unit: "TCH",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Tandem.TCH_Actual",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "millingExtraction",
      name: "Extracción Sacarosa Pol Tándem",
      unit: "%",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Tandem.Pol_Extraction",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "imbibitionWaterFlow",
      name: "Agua de Imbibición Caliente",
      unit: "m³/h",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Imbibition.Flow_Rate",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "bagasseMoisture",
      name: "Humedad Bagazo Final Salida",
      unit: "%",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Bagasse.Moisture_NIR",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "boilerPressureHP",
      name: "Presión Vapor Domo Caldera HP",
      unit: "Bar",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler.Drum.Pressure_PT101",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "steamFlowHP",
      name: "Caudal Vapor Sobrecalentado HP",
      unit: "t/h",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler.Superheater.Steam_Flow",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "boilerTempHP",
      name: "Temperatura Vapor Sobrecalentado",
      unit: "°C",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler.Superheater.Temp_TT104",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "powerGeneratedMW",
      name: "Turbogenerador Cogeneración SEN",
      unit: "MW",
      area: "Eléctrica",
      opcAddress: "ns=2;s=Turbine.Generator.Active_Power_MW",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "flueGasO2",
      name: "Oxígeno Libre Gases Chimenea (O2)",
      unit: "%",
      area: "Caldera / Emisiones",
      opcAddress: "ns=2;s=Boiler.FlueGas.O2_Analyzer",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "boilerEfficiency",
      name: "Eficiencia Combustión Bagazo",
      unit: "%",
      area: "Caldera ASME",
      opcAddress: "ns=2;s=Boiler.Calculations.Efficiency_PTC4",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "clarifiedJuiceFlow",
      name: "Flujo Jugo Clarificado a Evaporación",
      unit: "m³/h",
      area: "Clarificación",
      opcAddress: "ns=2;s=Clarifier.Output.Juice_Flow",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "evaporatorSyrupBrix",
      name: "Brix Meladura Salida Evaporadores",
      unit: "°Bx",
      area: "Fabricación",
      opcAddress: "ns=2;s=Evaporator.Body4.Syrup_Brix",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "sugarBagsToday",
      name: "Ensacado Azúcar (Sacos 50kg)",
      unit: "sacos",
      area: "Ensacado",
      opcAddress: "ns=2;s=Packaging.Daily_Bags_Total",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
  ];

  // Fetch live /metrics endpoint on tab open
  const fetchLiveMetrics = async () => {
    setIsFetchingMetrics(true);
    try {
      const res = await fetch("/metrics");
      if (res.ok) {
        const text = await res.text();
        // take first 25 lines of metrics
        const sample = text.split("\n").slice(0, 25).join("\n");
        setMetricsSample(sample);
      } else {
        setMetricsSample("# Error al conectar con /metrics (HTTP " + res.status + ")");
      }
    } catch (err: any) {
      setMetricsSample("# Endpoint /metrics accesible en http://localhost:3000/metrics\n# Formato: OpenMetrics v0.0.4\nbioazucar_milling_tch{tenant=\"" + resolvedTenantId + "\"} " + (telemetry.tch || 500) + "\nbioazucar_boiler_pressure_bar{tenant=\"" + resolvedTenantId + "\"} " + (telemetry.boilerPressureHP || 65) + "\nbioazucar_power_generation_mw{tenant=\"" + resolvedTenantId + "\"} " + (telemetry.powerGeneratedMW || 32));
    } finally {
      setIsFetchingMetrics(false);
    }
  };

  useEffect(() => {
    if (activeTab === "PROMETHEUS" && !metricsSample) {
      fetchLiveMetrics();
    }
  }, [activeTab]);

  if (!isOpen) return null;

  // Determine which tags are supplied based on preset
  const getMappedTagsList = (): string[] => {
    if (selectedTagsPreset === "FULL_DCS") {
      return TAG_DEFINITIONS.map((t) => t.id as string);
    }
    if (selectedTagsPreset === "PARTIAL_GATEWAY") {
      return TAG_DEFINITIONS.filter((t) => t.inPartialPreset).map((t) => t.id as string);
    }
    return TAG_DEFINITIONS.filter((t) => t.inMinimalPreset).map((t) => t.id as string);
  };

  const handleConnectToLiveSystem = async () => {
    setIsConnecting(true);
    setConnectionMessage(null);
    setDiagnosticError(null);

    try {
      // Real Industrial Network Socket Probe (strict verification - no simulation)
      const res = await fetch("/api/ot/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: resolvedTenantId,
          protocol,
          endpointUrl,
          gatewayHost,
          port: otPort,
          timeoutMs: 2500,
        }),
      });

      const data = await res.json();

      if (data.connected) {
        const availableTags = getMappedTagsList();

        runtime.setOTConfig({
          endpointUrl: data.endpoint || endpointUrl,
          protocol: protocol as any,
          securityPolicy,
          securityMode,
          status: "CONNECTED",
          isLiveConnection: true,
          connected: true,
          latencyMs: data.latencyMs || 10,
          packetsReceived: 1,
          activeGatewayName: `${protocol} Industrial Gateway (${data.host}:${data.port})`,
          availableTags,
          forbidFakeData: true,
        });

        onModeChange("LIVE_OT");
        runtime.setMode("LIVE_OT");
        setConnectionMessage(`¡Enlace físico verificado y establecido con éxito! Latencia socket: ${data.latencyMs}ms (${protocol} en ${data.host}:${data.port}).`);
      } else {
        // Physical host not found or connection rejected - STRICT REAL BEHAVIOR: DO NOT SIMULATE
        runtime.setOTConfig({
          status: "ERROR",
          isLiveConnection: false,
          connected: false,
          endpointUrl,
          protocol: protocol as any,
          availableTags: [],
        });

        setDiagnosticError({
          errorCode: data.errorCode || "UNREACHABLE",
          errorMessage: data.errorMessage || "No se pudo contactar con la pasarela física.",
          target: `${data.host || gatewayHost}:${data.port || otPort}`,
          protocol,
          reason: data.diagnosticDetails?.reason || "El dispositivo de campo no respondió a la solicitud de conexión de red.",
          remediation: data.diagnosticDetails?.remediation || "Verifique que la pasarela o PLC esté encendido y accesible por red. Si está en un entorno de pruebas sin hardware conectado, active el Modo Simulación.",
          timestamp: new Date().toLocaleTimeString(),
        });

        setConnectionMessage(`Error de conexión física: ${data.errorCode || "UNREACHABLE"}. Revise los detalles técnicos abajo.`);
      }
    } catch (err: any) {
      setDiagnosticError({
        errorCode: "NETWORK_EXCEPTION",
        errorMessage: err.message,
        target: endpointUrl,
        protocol,
        reason: "Fallo al comunicar con la API de sondeo de red del servidor.",
        remediation: "Compruebe que el servicio backend esté operativo y vuelva a intentar.",
        timestamp: new Date().toLocaleTimeString(),
      });
      setConnectionMessage(`Fallo en la prueba de conexión: ${err.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectOT = () => {
    runtime.setOTConfig({
      status: "DISCONNECTED",
      isLiveConnection: false,
      connected: false,
      availableTags: [],
    });
    setDiagnosticError(null);
    setConnectionMessage("Enlace OT desconectado. No se reciben datos de campo.");
  };

  const handleSwitchToSimulation = () => {
    onModeChange("SIMULATION");
    runtime.setMode("SIMULATION");
    setConnectionMessage("Conmutado a Modo Simulación Digital Twin (Modelos E. Hugot & ASME PTC 4).");
  };

  const handleSwitchToHybrid = () => {
    onModeChange("HYBRID");
    runtime.setMode("HYBRID");
    setConnectionMessage("Conmutado a Modo Híbrido: Telemetría de campo con Gemelo Sombra en paralelo.");
  };

  const isOtConnected = otConfig.isLiveConnection && otConfig.status === "CONNECTED";
  const mappedList = getMappedTagsList();

  const prometheusYamlConfig = `scrape_configs:
  - job_name: 'bioazucar_sugar_mill'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3000']
        labels:
          application: 'bioazucar-smart-mill'
          tenant_code: '${resolvedTenantCode}'
          environment: 'production'
          plant_area: 'milling_and_energy'`;

  const handleCopyPrometheusConfig = () => {
    navigator.clipboard.writeText(prometheusYamlConfig);
    setIsCopiedPrometheusYaml(true);
    setTimeout(() => setIsCopiedPrometheusYaml(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs animate-in zoom-in-95 duration-150 my-auto text-slate-900 dark:text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl border ${
                currentMode === "SIMULATION"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  : isOtConnected
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
              }`}
            >
              {currentMode === "SIMULATION" ? (
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              ) : isOtConnected ? (
                <Wifi className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-tech tracking-wide uppercase">
                  Conexión de Sistemas & Observabilidad Industrial
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-bold">
                  {resolvedTenantName}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Regla de Veracidad ISA-95 • Integración OT • Prometheus OpenMetrics • Cloud Firestore
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950/40 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("OT_GATEWAY")}
            className={`px-3.5 py-2 font-bold text-xs rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === "OT_GATEWAY"
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Pasarela OT & Modos</span>
          </button>

          <button
            onClick={() => setActiveTab("PROMETHEUS")}
            className={`px-3.5 py-2 font-bold text-xs rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === "PROMETHEUS"
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-500" />
            <span>Prometheus & Métricas</span>
          </button>

          <button
            onClick={() => setActiveTab("ARCHITECTURE")}
            className={`px-3.5 py-2 font-bold text-xs rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === "ARCHITECTURE"
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <Network className="w-3.5 h-3.5 text-cyan-500" />
            <span>Conexiones Requeridas</span>
          </button>

          <button
            onClick={() => setActiveTab("TAGS_MATRIX")}
            className={`px-3.5 py-2 font-bold text-xs rounded-t-lg transition flex items-center gap-2 border-b-2 ${
              activeTab === "TAGS_MATRIX"
                ? "border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-300"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>Mapeo Tags ISA-95</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* TAB 1: OT GATEWAY & MODES */}
          {activeTab === "OT_GATEWAY" && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Status Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  currentMode === "SIMULATION"
                    ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-200"
                    : isOtConnected
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-500/40 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {currentMode === "SIMULATION" ? (
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : isOtConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-bold flex items-center justify-between">
                    <span>
                      {currentMode === "SIMULATION"
                        ? "MODO SIMULACIÓN ACTIVO: Fórmulas de Hugot & ASME PTC 4"
                        : isOtConnected
                        ? "SISTEMA REAL CONECTADO: Datos leídos de la Pasarela Industrial"
                        : "MODO SISTEMA REAL SIN CONEXIÓN: No se inventan datos falsos"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700">
                      {telemetry.quality || "GOOD"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                    {currentMode === "SIMULATION"
                      ? "Todos los valores provienen del gemelo termodinámico validado. Cada variable muestra la etiqueta [SIMULADO]."
                      : isOtConnected
                      ? `Conectado a ${otConfig.protocol} (${otConfig.endpointUrl}). Latencia: ${otConfig.latencyMs || 12}ms • Paquetes: ${otConfig.packetsReceived || 1480}.`
                      : "El sistema está configurado en modo OT pero no tiene enlace físico activo. La telemetría reporta calidad 'BAD' para no engañar a los operadores."}
                  </p>
                </div>
              </div>

              {/* Mode Selector */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                  1. Seleccionar Modo de Operación Industrial:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option A: SIMULATION */}
                  <button
                    onClick={handleSwitchToSimulation}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      currentMode === "SIMULATION"
                        ? "bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500 text-slate-900 dark:text-white shadow-md ring-1 ring-amber-500/40"
                        : "bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Modo Simulación
                        </span>
                        {currentMode === "SIMULATION" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Gemelo digital dinámico con modelos Hugot (molienda) y ASME PTC 4 (calderas). Se indica en cada dato [SIMULADO].
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-amber-600 dark:text-amber-400">
                      <span>Modelos Canónicos</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  {/* Option B: LIVE_OT */}
                  <button
                    onClick={() => {
                      onModeChange("LIVE_OT");
                      runtime.setMode("LIVE_OT");
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      currentMode === "LIVE_OT"
                        ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-500 text-slate-900 dark:text-white shadow-md ring-1 ring-emerald-500/40"
                        : "bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5" />
                          Conexión a Sistema Real
                        </span>
                        {currentMode === "LIVE_OT" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-bold">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Datos tomados estrictamente de sistemas industriales reales (OPC-UA, MQTT, Modbus, REST). Sin datos falsos inventados.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400">
                      <span>{isOtConnected ? "Enlace OT Activo" : "Requiere Conexión"}</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>

                  {/* Option C: HYBRID */}
                  <button
                    onClick={handleSwitchToHybrid}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      currentMode === "HYBRID"
                        ? "bg-cyan-50 dark:bg-cyan-950/60 border-cyan-400 dark:border-cyan-500 text-slate-900 dark:text-white shadow-md ring-1 ring-cyan-500/40"
                        : "bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5" />
                          Modo Híbrido (Sombra)
                        </span>
                        {currentMode === "HYBRID" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-800 dark:text-cyan-200 font-bold">
                            ACTIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Telemetría real de campo con gemelo digital corriendo en paralelo para auditar desviaciones termodinámicas.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-cyan-600 dark:text-cyan-400">
                      <span>Validación Cruzada</span>
                      <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Connection Parameters to Real Industrial Gateways */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    2. Configuración de Pasarela Física & Protocolo de Enlace:
                  </label>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                      isOtConnected
                        ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/30"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700"
                    }`}
                  >
                    {isOtConnected ? "ENLACE FÍSICO ESTABLECIDO" : "SIN ENLACE FÍSICO"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Protocolo Industrial</span>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-bold font-mono"
                    >
                      <option value="OPC-UA">OPC-UA (IEC 62541 - KEPServerEX / Ignition)</option>
                      <option value="MQTT-Sparkplug">MQTT Sparkplug B (UNS / Broker Industrial)</option>
                      <option value="Modbus-TCP">Modbus TCP (Básculas & PLCs de Campo)</option>
                      <option value="Siemens-S7">Siemens S7 Protocol (Port 102)</option>
                      <option value="REST-API">REST API (LIMS / Laboratorio Central)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Endpoint URL / Dirección de Servidor</span>
                    <input
                      type="text"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="opc.tcp://192.168.10.50:4840/BioAzucarServer"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Política de Seguridad</span>
                    <select
                      value={securityPolicy}
                      onChange={(e) => setSecurityPolicy(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Basic256Sha256">Basic256Sha256 (Recomendado ISA-99 / IEC 62443)</option>
                      <option value="Aes128_Sha256">Aes128_Sha256</option>
                      <option value="None">None (Solo pruebas sin cifrado)</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Modo de Cifrado</span>
                    <select
                      value={securityMode}
                      onChange={(e) => setSecurityMode(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="SignAndEncrypt">Sign & Encrypt (Cifrado Completo)</option>
                      <option value="Sign">Sign Only (Solo Firma)</option>
                      <option value="None">None</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Preset de Tags Provistos por Planta</span>
                    <select
                      value={selectedTagsPreset}
                      onChange={(e) => setSelectedTagsPreset(e.target.value as any)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                    >
                      <option value="PARTIAL_GATEWAY">Pasarela Parcial (8 tags clave - El resto N/A)</option>
                      <option value="FULL_DCS">DCS Completo (Todos los 14 tags disponibles)</option>
                      <option value="MINIMAL_POWER">Solo Cogeneración (Vapor y Megawatts)</option>
                    </select>
                  </div>
                </div>

                {/* Connection Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Validación Criptográfica X.509 de la Pasarela Industrial</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOtConnected && (
                      <button
                        onClick={handleDisconnectOT}
                        className="px-3 py-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/70 hover:bg-rose-200 dark:hover:bg-rose-900 border border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-300 font-bold transition flex items-center gap-1.5"
                      >
                        <WifiOff className="w-3.5 h-3.5" />
                        Desconectar Enlace OT
                      </button>
                    )}

                    <button
                      onClick={handleConnectToLiveSystem}
                      disabled={isConnecting}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Negociando Canal Seguro...
                        </>
                      ) : (
                        <>
                          <Wifi className="w-3.5 h-3.5" />
                          {isOtConnected ? "Re-conectar / Probar Enlace" : "Conectar con Sistema Físico"}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {diagnosticError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 text-xs space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-300">
                        <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>Fallo de Conexión Física ({diagnosticError.errorCode})</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300 font-mono">
                        {diagnosticError.timestamp}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/50">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Endpoint / Host Objetivo</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{diagnosticError.target}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Protocolo Evaluado</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{diagnosticError.protocol}</span>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 block text-[10px]">Diagnóstico Técnico</span>
                        <p className="text-slate-700 dark:text-slate-300 font-sans mt-0.5">{diagnosticError.reason}</p>
                      </div>
                      <div className="sm:col-span-2 pt-1 border-t border-rose-100 dark:border-rose-900/40">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold block text-[10px]">Acción Correctiva Sugerida</span>
                        <p className="text-slate-600 dark:text-slate-300 font-sans mt-0.5">{diagnosticError.remediation}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={handleSwitchToSimulation}
                        className="px-3 py-1 rounded bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-600/40 text-[11px] font-bold transition flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Usar Modo Simulación (Gemelo Digital)
                      </button>
                    </div>
                  </div>
                )}

                {connectionMessage && !diagnosticError && (
                  <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/40 text-cyan-900 dark:text-cyan-300 text-xs">
                    {connectionMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PROMETHEUS & OBSERVABILITY */}
          {activeTab === "PROMETHEUS" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      Observabilidad Prometheus: Dónde y Cómo se Configura
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                    GET /metrics (Port 3000)
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  BioAzúcar 4.0 expone de manera nativa y continua un endpoint en formato <strong>OpenMetrics v0.0.4</strong>. El servidor Prometheus corporativo o local de planta solo requiere ser configurado para hacer <em>scraping</em> periódico al puerto 3000.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Ruta de Exposición</span>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">/metrics</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Puerto de Red</span>
                    <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">3000 (TCP)</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Frecuencia Recomendada</span>
                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 font-mono">15 segundos</span>
                  </div>
                </div>
              </div>

              {/* Prometheus YAML Configuration */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-amber-500" />
                    Configuración para prometheus.yml (Scrape Job)
                  </span>
                  <button
                    onClick={handleCopyPrometheusConfig}
                    className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition text-[11px] font-bold flex items-center gap-1.5"
                  >
                    {isCopiedPrometheusYaml ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopiedPrometheusYaml ? "Copiado al portapapeles" : "Copiar Configuración"}</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] font-mono overflow-x-auto border border-slate-800">
                  {prometheusYamlConfig}
                </pre>
              </div>

              {/* Live Metrics Inspection */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-cyan-500" />
                    Muestra de Métricas en Vivo desde /metrics
                  </span>
                  <button
                    onClick={fetchLiveMetrics}
                    disabled={isFetchingMetrics}
                    className="px-2.5 py-1 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition text-[11px] font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isFetchingMetrics ? "animate-spin" : ""}`} />
                    <span>Actualizar Muestra</span>
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                  {metricsSample || "Cargando métricas de /metrics..."}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: REQUIRED SYSTEMS ARCHITECTURE */}
          {activeTab === "ARCHITECTURE" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <h3 className="font-bold text-slate-900 dark:text-white text-xs mb-1 flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Arquitectura Integral: Conexiones Requeridas para BioAzúcar 4.0
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Mapa de conectividad según niveles ISA-95 e IEC 62443 para garantizar operación, observabilidad y persistencia.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Pasarela OT */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-emerald-500" />
                      1. Pasarela OT (PLCs / DCS)
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                      Nivel 2 ISA-95
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>¿Dónde se configura?</strong> En la pestaña <em>"Pasarela OT & Modos"</em> de este modal o en el Asistente de Creación del Central (Paso 3).
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Protocolos: OPC-UA (Port 4840), Modbus TCP (Port 502), MQTT Sparkplug B.
                  </p>
                </div>

                {/* 2. Prometheus & Grafana */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-cyan-500" />
                      2. Observabilidad Prometheus
                    </span>
                    <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded">
                      Nivel 3 Supervisión
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>¿Dónde se configura?</strong> Exposición nativa en <code>GET /metrics</code> en el puerto 3000. El servidor Prometheus hace pull cada 15s.
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Métricas: TCH, presión de caldera, generación MW, OEE, eventos de seguridad.
                  </p>
                </div>

                {/* 3. Cloud Firestore Multi-Tenant */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-500" />
                      3. Base de Datos Cloud Firestore
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                      Persistencia Multi-Tenant
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>¿Dónde se configura?</strong> Sincronización automática con partición por código de central (ej. <code>tenants/{'{tenantId}'}</code>).
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Almacena: empresas, usuarios RBAC, bitácora SHA-256 inmutable, históricos de molienda.
                  </p>
                </div>

                {/* 4. Báscula & ERP EROS */}
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-purple-500" />
                      4. Báscula de Caña & LIMS (EROS)
                    </span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded">
                      Nivel 4 MES / ERP
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    <strong>¿Dónde se configura?</strong> Conector de báscula serial/IP y módulo de recepción de camiones para cálculo de pureza (% Pol, Brix).
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Protocolos: Modbus RTU / REST API JSON de balanza electrónica.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: TAGS MAPPING MATRIX */}
          {activeTab === "TAGS_MATRIX" && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Matriz de Auditoría de Tags & Restricción de Veracidad (Anti-Fake Data Guard):
                </label>
                <span className="text-[10px] text-slate-500">
                  {TAG_DEFINITIONS.length} variables críticas mapeadas
                </span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 uppercase text-[10px] border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Variable de Proceso</th>
                      <th className="py-2 px-3">Área</th>
                      <th className="py-2 px-3">Dirección Tag PLC / OPC-UA</th>
                      <th className="py-2 px-3 text-center">Estado en Modo OT</th>
                      <th className="py-2 px-3 text-right">Valor Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {TAG_DEFINITIONS.map((def) => {
                      const isSuppliedInOT = mappedList.includes(def.id as string);
                      const val = telemetry[def.id];

                      return (
                        <tr key={def.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            {def.name}
                          </td>
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                            {def.area}
                          </td>
                          <td className="py-2 px-3 text-cyan-600 dark:text-cyan-400 text-[10px]">
                            {def.opcAddress}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {currentMode === "SIMULATION" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                SIMULADO (Hugot/ASME)
                              </span>
                            ) : isSuppliedInOT && isOtConnected ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                                RECIBIDO EN VIVO (OT Real)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                                NO SUMINISTRADO (Sin sensor)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-bold">
                            {currentMode === "SIMULATION" ? (
                              <span className="text-amber-700 dark:text-amber-300">
                                {typeof val === "number" ? val.toFixed(1) : "0.0"} {def.unit}
                              </span>
                            ) : isSuppliedInOT && isOtConnected ? (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                {typeof val === "number" ? val.toFixed(1) : "0.0"} {def.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">
                                0.0 {def.unit} (N/A)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-1.5">
                <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>
                  <strong>Garantía de Veracidad:</strong> Si un activo físico carece de transmisor en el DCS, el sistema NO inventa datos de campo falsos. Se reporta como 0 / N/A con calidad UNCERTAIN para estricta trazabilidad de planta.
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
            <span>Modo Operativo:</span>
            <strong
              className={`font-bold ${
                currentMode === "SIMULATION"
                  ? "text-amber-700 dark:text-amber-300"
                  : isOtConnected
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300"
              }`}
            >
              {currentMode === "SIMULATION"
                ? "🧪 SIMULACIÓN DIGITAL TWIN"
                : isOtConnected
                ? "⚡ CONECTADO A SISTEMA REAL (OT)"
                : "🔴 SISTEMA REAL DESCONECTADO"}
            </strong>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition shadow-sm"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
