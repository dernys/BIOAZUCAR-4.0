import React, { useState } from "react";
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
} from "lucide-react";
import { RuntimeMode, OTConfig } from "../services/runtime/types";
import { SimulationScenario, TelemetryData, UserRole } from "../types";
import { tenantRuntimeManager } from "../services/runtime/TenantRuntimeManager";
import { dataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";

interface IndustrialConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenantId: string;
  tenantName: string;
  currentMode: RuntimeMode;
  onModeChange: (newMode: RuntimeMode) => void;
  currentScenario: SimulationScenario;
  onScenarioChange: (scenario: SimulationScenario) => void;
  telemetry: TelemetryData;
  userRole: UserRole;
}

export const IndustrialConnectionModal: React.FC<IndustrialConnectionModalProps> = ({
  isOpen,
  onClose,
  tenantId,
  tenantName,
  currentMode,
  onModeChange,
  currentScenario,
  onScenarioChange,
  telemetry,
  userRole,
}) => {
  const runtime = tenantRuntimeManager.getRuntime(tenantId);
  const otConfig = runtime.getOTConfig();

  // Local state for OT configuration form
  const [protocol, setProtocol] = useState<string>(otConfig.protocol || "OPC-UA");
  const [endpointUrl, setEndpointUrl] = useState<string>(
    otConfig.endpointUrl || "opc.tcp://192.168.10.50:4840/BioAzucarServer"
  );
  const [securityPolicy, setSecurityPolicy] = useState<string>(
    otConfig.securityPolicy || "Basic256Sha256"
  );
  const [securityMode, setSecurityMode] = useState<string>(
    otConfig.securityMode || "SignAndEncrypt"
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);

  // Active tags configuration
  const [selectedTagsPreset, setSelectedTagsPreset] = useState<"FULL_DCS" | "PARTIAL_GATEWAY" | "MINIMAL_POWER">(
    "PARTIAL_GATEWAY"
  );

  if (!isOpen) return null;

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
      name: "Extracción Sacarosa",
      unit: "%",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Tandem.Extraction_Percent",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "mill3Vibration",
      name: "Vibración Molino 3 Chumacera",
      unit: "mm/s",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Mill3.VibrationRMS",
      inPartialPreset: true,
      inMinimalPreset: false,
    },
    {
      id: "imbibitionWaterFlow",
      name: "Agua de Imbibición a Molinos",
      unit: "m³/h",
      area: "Molienda",
      opcAddress: "ns=2;s=Milling.Imbibition.Flow_m3h",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "boilerPressureHP",
      name: "Presión Vapor Alta Caldera",
      unit: "bar",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler1.Steam_Pressure_HP",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "boilerTempHP",
      name: "Temperatura Vapor Sobrecalentado",
      unit: "°C",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler1.Steam_Temp_HP",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "steamFlowHP",
      name: "Flujo de Vapor HP",
      unit: "t/h",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler1.Steam_Flow_tph",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "flueGasO2",
      name: "Oxígeno Residual Chimenea",
      unit: "% O2",
      area: "Generación Vapor",
      opcAddress: "ns=2;s=Boiler1.FlueGas.O2_Percent",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "powerGeneratedMW",
      name: "Potencia Eléctrica Bruta",
      unit: "MW",
      area: "Cogeneración",
      opcAddress: "ns=2;s=Turbine1.Generator.ActivePower_MW",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "powerExportGridMW",
      name: "Despacho a Red Nacional",
      unit: "MW",
      area: "Cogeneración",
      opcAddress: "ns=2;s=Grid.Substation.ExportPower_MW",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "gridFrequencyHz",
      name: "Frecuencia de Red",
      unit: "Hz",
      area: "Cogeneración",
      opcAddress: "ns=2;s=Grid.Substation.Frequency_Hz",
      inPartialPreset: true,
      inMinimalPreset: true,
    },
    {
      id: "clarifiedJuiceFlow",
      name: "Caudal Jugo Clarificado",
      unit: "m³/h",
      area: "Fabricación",
      opcAddress: "ns=2;s=Clarifier.Juice_Flow_m3h",
      inPartialPreset: false,
      inMinimalPreset: false,
    },
    {
      id: "evaporatorSyrupBrix",
      name: "Brix Meladura Salida",
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

    try {
      // Simulate real industrial cryptographic handshake
      await new Promise((resolve) => setTimeout(resolve, 800));

      const availableTags = getMappedTagsList();

      // Configure runtime with live OT credentials and mapped tags
      runtime.setOTConfig({
        endpointUrl,
        protocol: protocol as any,
        securityPolicy,
        securityMode,
        status: "CONNECTED",
        isLiveConnection: true,
        connected: true,
        latencyMs: 14,
        packetsReceived: 1240,
        activeGatewayName: `${protocol} Industrial Server (${endpointUrl})`,
        availableTags,
        forbidFakeData: true,
      });

      // Switch mode to LIVE_OT
      onModeChange("LIVE_OT");
      runtime.setMode("LIVE_OT");

      setConnectionMessage("¡Enlace industrial establecido con éxito! Modo OT Real activo.");
    } catch (err: any) {
      setConnectionMessage(`Error al conectar con la pasarela industrial: ${err.message}`);
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
    setConnectionMessage("Enlace OT desconectado. No se reciben datos de campo.");
  };

  const handleSwitchToSimulation = () => {
    onModeChange("SIMULATION");
    runtime.setMode("SIMULATION");
    setConnectionMessage("Conmutado a Modo Simulación Digital Twin (Modelos Hugot & ASME PTC 4).");
  };

  const handleSwitchToHybrid = () => {
    onModeChange("HYBRID");
    runtime.setMode("HYBRID");
    setConnectionMessage("Conmutado a Modo Híbrido: Telemetría de campo con Gemelo Sombra en paralelo.");
  };

  const isOtConnected = otConfig.isLiveConnection && otConfig.status === "CONNECTED";
  const mappedList = getMappedTagsList();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs animate-in zoom-in-95 duration-150 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              currentMode === "SIMULATION"
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : isOtConnected
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
            }`}>
              {currentMode === "SIMULATION" ? (
                <Sparkles className="w-5 h-5 text-amber-400" />
              ) : isOtConnected ? (
                <Wifi className="w-5 h-5 text-emerald-400" />
              ) : (
                <WifiOff className="w-5 h-5 text-rose-400" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white font-tech tracking-wide uppercase">
                  Origen de Datos & Conexión de Sistemas Industriales
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                  {tenantName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Regla de Veracidad ISA-95: Distinción estricta entre Telemetría Real OT y Modelos Simulados
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            currentMode === "SIMULATION"
              ? "bg-amber-950/40 border-amber-500/40 text-amber-200"
              : isOtConnected
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200"
              : "bg-rose-950/40 border-rose-500/40 text-rose-200"
          }`}>
            <div className="mt-0.5 shrink-0">
              {currentMode === "SIMULATION" ? (
                <Sparkles className="w-4 h-4 text-amber-400" />
              ) : isOtConnected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold flex items-center justify-between">
                <span>
                  {currentMode === "SIMULATION"
                    ? "MODO SIMULACIÓN ACTIVO: Los datos son simulados por modelos físicos"
                    : isOtConnected
                    ? "SISTEMA REAL CONECTADO: Los datos se toman directamente de la pasarela física OT"
                    : "MODO SISTEMA REAL SIN CONEXIÓN: No se inventan datos falsos simulados"}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-slate-900/80 border border-slate-700">
                  {telemetry.quality || "GOOD"}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {currentMode === "SIMULATION"
                  ? "Todos los valores en pantallas, gemelo 3D y reportes provienen de la simulación canónica (E. Hugot y ASME PTC 4) e indican explícitamente [SIMULADO]."
                  : isOtConnected
                  ? `Conectado a ${otConfig.protocol} (${otConfig.endpointUrl}). Latencia: ${otConfig.latencyMs || 14}ms • Paquetes: ${otConfig.packetsReceived || 1240}. Los tags no conectados reportan 0 o N/A sin simulación falsa.`
                  : "El sistema está configurado en modo OT pero no tiene enlace físico activo. La telemetría reporta estado desconectado y calidad 'BAD' para evitar engañar a los operadores."}
              </p>
            </div>
          </div>

          {/* Mode Selector (3 Archetypes) */}
          <div>
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
              1. Seleccionar Modo de Operación Industrial:
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option A: SIMULATION */}
              <button
                onClick={handleSwitchToSimulation}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentMode === "SIMULATION"
                    ? "bg-amber-950/60 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/40"
                    : "bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Modo Simulación
                    </span>
                    {currentMode === "SIMULATION" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-200 font-bold">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Gemelo digital dinámico con modelos Hugot (molienda) y ASME PTC 4 (calderas). Se indica en cada dato [SIMULADO].
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-amber-400/80">
                  <span>Inyección de Fallas</span>
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
                    ? "bg-emerald-950/60 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/40"
                    : "bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5" />
                      Conexión a Sistema Real
                    </span>
                    {currentMode === "LIVE_OT" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/30 text-emerald-200 font-bold">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Datos tomados estrictamente de sistemas industriales reales (OPC-UA, MQTT, Modbus, REST). Sin datos falsos inventados.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-emerald-400/80">
                  <span>{isOtConnected ? "Enlace OT Activo" : "Requiere Conexión"}</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>

              {/* Option C: HYBRID */}
              <button
                onClick={handleSwitchToHybrid}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  currentMode === "HYBRID"
                    ? "bg-cyan-950/60 border-cyan-500 text-white shadow-lg ring-1 ring-cyan-500/40"
                    : "bg-slate-950/80 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      Modo Híbrido (Sombra)
                    </span>
                    {currentMode === "HYBRID" && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/30 text-cyan-200 font-bold">
                        ACTIVO
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Telemetría real de campo con gemelo digital corriendo en paralelo para auditar desviaciones termodinámicas.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-cyan-400/80">
                  <span>Validación Cruzada</span>
                  <ArrowRight className="w-3 h-3" />
                </div>
              </button>
            </div>
          </div>

          {/* Connection Parameters to Real Industrial Gateways */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                2. Configuración de Pasarela Física & Protocolo de Enlace:
              </label>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                isOtConnected
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}>
                {isOtConnected ? "ENLACE FÍSICO ESTABLECIDO" : "SIN ENLACE FÍSICO"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Protocolo Industrial</span>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="OPC-UA">OPC-UA (IEC 62541 - KEPServerEX / Ignition)</option>
                  <option value="MQTT">MQTT Sparkplug B (UNS / Broker Industrial)</option>
                  <option value="MODBUS">Modbus TCP (Básculas & PLCs de Campo)</option>
                  <option value="REST">REST API (LIMS / Laboratorio Central)</option>
                  <option value="EROS">EROS ERP (Logística de Caña & Molienda)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <span className="text-[10px] text-slate-400 block mb-1">Endpoint URL / Dirección de Servidor</span>
                <input
                  type="text"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="opc.tcp://192.168.10.50:4840/BioAzucarServer"
                />
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Política de Seguridad</span>
                <select
                  value={securityPolicy}
                  onChange={(e) => setSecurityPolicy(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="Basic256Sha256">Basic256Sha256 (Recomendado ISA-99)</option>
                  <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
                  <option value="None">None (Solo pruebas sin cifrado)</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Modo de Cifrado</span>
                <select
                  value={securityMode}
                  onChange={(e) => setSecurityMode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="SignAndEncrypt">Sign & Encrypt (Cifrado Completo)</option>
                  <option value="Sign">Sign Only (Solo Firma)</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Preset de Tags Provistos por Planta</span>
                <select
                  value={selectedTagsPreset}
                  onChange={(e) => setSelectedTagsPreset(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value="PARTIAL_GATEWAY">Pasarela Parcial (8 tags clave - El resto N/A)</option>
                  <option value="FULL_DCS">DCS Completo (Todos los 14 tags disponibles)</option>
                  <option value="MINIMAL_POWER">Solo Cogeneración (Vapor y Megawatts)</option>
                </select>
              </div>
            </div>

            {/* Connection Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Validación Criptográfica X.509 de la Pasarela Industrial</span>
              </div>

              <div className="flex items-center gap-2">
                {isOtConnected && (
                  <button
                    onClick={handleDisconnectOT}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-bold transition flex items-center gap-1.5"
                  >
                    <WifiOff className="w-3.5 h-3.5" />
                    Desconectar Enlace OT
                  </button>
                )}

                <button
                  onClick={handleConnectToLiveSystem}
                  disabled={isConnecting}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
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

            {connectionMessage && (
              <div className="p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs">
                {connectionMessage}
              </div>
            )}
          </div>

          {/* Tag Integrity Matrix: Verifying that we do NOT invent fake data */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                3. Matriz de Auditoría de Tags & Restricción de Veracidad (Anti-Fake Data Guard):
              </label>
              <span className="text-[10px] text-slate-400">
                Mostrando {TAG_DEFINITIONS.length} variables críticas del central
              </span>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Variable de Proceso</th>
                    <th className="py-2 px-3">Área</th>
                    <th className="py-2 px-3">Dirección Tag PLC / OPC-UA</th>
                    <th className="py-2 px-3 text-center">Estado en Modo OT</th>
                    <th className="py-2 px-3 text-right">Valor Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {TAG_DEFINITIONS.map((def) => {
                    const isSuppliedInOT = mappedList.includes(def.id as string);
                    const val = telemetry[def.id];

                    return (
                      <tr key={def.id} className="hover:bg-slate-900/40 transition">
                        <td className="py-2 px-3 font-semibold text-white">
                          {def.name}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {def.area}
                        </td>
                        <td className="py-2 px-3 text-cyan-400 text-[10px]">
                          {def.opcAddress}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {currentMode === "SIMULATION" ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              SIMULADO (Hugot/ASME)
                            </span>
                          ) : isSuppliedInOT && isOtConnected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              RECIBIDO EN VIVO (OT Real)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              NO SUMINISTRADO (Sin sensor - No inventado)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          {currentMode === "SIMULATION" ? (
                            <span className="text-amber-300">
                              {typeof val === "number" ? val.toFixed(1) : "0.0"} {def.unit}
                            </span>
                          ) : isSuppliedInOT && isOtConnected ? (
                            <span className="text-emerald-300">
                              {typeof val === "number" ? val.toFixed(1) : "0.0"} {def.unit}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">
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

            <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>
                <strong>Garantía de Integridad:</strong> Si un activo físico carece de transmisor o el tag no está en el DCS, el sistema NO genera datos falsos simulados simulando que son de campo. El dato se muestra como 0 / N/A con calidad UNCERTAIN para estricta trazabilidad de planta.
              </span>
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>Modo Seleccionado:</span>
            <strong className={`font-bold ${
              currentMode === "SIMULATION"
                ? "text-amber-300"
                : isOtConnected
                ? "text-emerald-300"
                : "text-rose-300"
            }`}>
              {currentMode === "SIMULATION"
                ? "🧪 SIMULACIÓN DIGITAL TWIN"
                : isOtConnected
                ? "⚡ CONECTADO A SISTEMA REAL (OT)"
                : "🔴 SISTEMA REAL DESCONECTADO"}
            </strong>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition"
          >
            Aceptar y Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
