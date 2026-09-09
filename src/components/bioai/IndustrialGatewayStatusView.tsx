import React, { useState, useEffect } from "react";
import {
  Radio,
  Server,
  ShieldCheck,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  Database,
  Wifi,
  WifiOff,
  Terminal,
  Info,
  Layers,
} from "lucide-react";
import { industrialDataGateway } from "../../services/gateway/IndustrialDataGateway";
import { IndustrialGatewayStatus, IndustrialDataGatewayState } from "../../types/bioai";
import { TelemetryData, TenantEnterprise } from "../../types";
import { tenantRuntimeManager } from "../../services/runtime/TenantRuntimeManager";

interface IndustrialGatewayStatusViewProps {
  telemetry?: TelemetryData;
  activeTenant?: TenantEnterprise;
  onNavigateToTab?: (tab: any) => void;
}

export const IndustrialGatewayStatusView: React.FC<IndustrialGatewayStatusViewProps> = ({
  telemetry,
  activeTenant,
  onNavigateToTab,
}) => {
  const tenantId = activeTenant?.id || "BIOAZUCAR-DEMO";
  const [gatewayStatus, setGatewayStatus] = useState<IndustrialGatewayStatus>(
    industrialDataGateway.getStatus(tenantId)
  );
  const [gatewayState, setGatewayState] = useState<IndustrialDataGatewayState>(
    industrialDataGateway.getGatewayState(tenantId)
  );
  const [testingProtocol, setTestingProtocol] = useState<string | null>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);

  const refreshGateway = () => {
    setGatewayStatus(industrialDataGateway.getStatus(tenantId));
    setGatewayState(industrialDataGateway.getGatewayState(tenantId));
  };

  useEffect(() => {
    refreshGateway();
    const interval = setInterval(refreshGateway, 2000);
    return () => clearInterval(interval);
  }, [tenantId, telemetry?.isSimulated]);

  const handleTestOrSwitch = async (protocolKey: string) => {
    setTestingProtocol(protocolKey);
    setSwitchNotice(null);
    try {
      if (protocolKey === "SIMULATION") {
        const runtime = tenantRuntimeManager.getRuntime(tenantId);
        runtime.setMode("SIMULATION");
        industrialDataGateway.clearOverride();
        refreshGateway();
        setSwitchNotice("Entorno conmutado a Simulador Físico (Hugot / Spencer-Meade).");
      } else {
        const runtime = tenantRuntimeManager.getRuntime(tenantId);
        const otConfig = runtime.getOTConfig();
        if (!otConfig.isLiveConnection) {
          setSwitchNotice(
            `Aviso de Transparencia OT: El adaptador ${protocolKey} está configurado pero no tiene enlace físico TCP/IP activo en este contenedor web. No se generan datos falseados.`
          );
        } else {
          await industrialDataGateway.setActiveAdapter(protocolKey);
          refreshGateway();
          setSwitchNotice(`Conmutado a adaptador: ${protocolKey}`);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setTestingProtocol(null);
    }
  };

  const isSimulated = gatewayStatus.isSimulated || telemetry?.isSimulated;

  return (
    <div className="space-y-6">
      {/* Top Banner: Authentic Mode Status & Cyber-Isolation Badge */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Industrial Data Gateway & Pasarela OT/IT
            </h3>
            {isSimulated ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-bold">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> MODO SIMULACIÓN ACTIVA
              </span>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-bold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> TELEMETRÍA OT EN VIVO
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Abstracción unificada de protocolos industriales con trazabilidad real y verificación de integridad
          </p>
        </div>

        {/* Security Certificate Badge */}
        <div className="flex items-center gap-2 p-2 bg-slate-950/80 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Cumplimiento IEC 62443: Zona de Control Segregada</span>
        </div>
      </div>

      {/* Honesty & Data Integrity Notice */}
      <div
        className={`p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
          isSimulated
            ? "bg-amber-950/20 border-amber-500/30 text-amber-200/90"
            : "bg-emerald-950/20 border-emerald-500/30 text-emerald-200/90"
        }`}
      >
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
        <div>
          <div className="font-bold font-mono uppercase tracking-wide text-white mb-0.5">
            Declaración de Transparencia de Datos Industriales (BioAI):
          </div>
          <p className="text-slate-300">
            {gatewayStatus.statusMessage ||
              (isSimulated
                ? "La planta se encuentra en Modo Simulación. Todos los valores provienen del gemelo termodinámico matemático (Hugot / Spencer-Meade). Los adaptadores físicos (OPC-UA, MQTT, Modbus) reportan su estado real en espera (STANDBY) sin simular falsas conexiones de campo."
                : "La planta está configurada en Modo OT Real. El gateway consulta instrumentación de campo sin inventar datos.")}
          </p>
        </div>
      </div>

      {switchNotice && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{switchNotice}</span>
          </div>
          <button onClick={() => setSwitchNotice(null)} className="text-cyan-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Gateway Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Origen de Datos Activo</span>
          <div className="text-lg font-bold font-tech text-white flex items-center gap-2 truncate">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSimulated ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"
              }`}
            ></span>
            <span className="truncate">{gatewayStatus.activeChannel}</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">
            {gatewayStatus.adapterName}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Latencia de Enlace</span>
          <div className="text-xl font-bold font-tech text-cyan-400">
            {typeof gatewayStatus.latencyMs === "number" ? `${gatewayStatus.latencyMs} ms` : gatewayStatus.latencyMs}
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            {isSimulated ? "Cálculo Numérico Local (Sin red física)" : gatewayStatus.signalQuality}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Tasa de Telemetría</span>
          <div className="text-xl font-bold font-tech text-white">
            {gatewayStatus.packetsPerSec}{" "}
            <span className="text-xs font-normal text-slate-400">puntos / seg</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            {isSimulated ? "Ciclos de Simulación Ejecutados: " : "Paquetes Recibidos: "}
            <strong className="text-white font-mono">{gatewayStatus.totalPacketsReceived.toLocaleString()}</strong>
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Segregación de Red</span>
          <div className="text-xl font-bold font-tech text-emerald-400 flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            Air-Gapped AI
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            {isSimulated ? "Aislado en memoria de simulación" : "Lectura unidireccional vía UNS"}
          </span>
        </div>
      </div>

      {/* Protocol Adapters Status & Switching Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
              Estado Real de los Adaptadores Industriales en el Gateway
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Última muestra: {gatewayStatus.lastPacketTimestamp.includes("T") ? new Date(gatewayStatus.lastPacketTimestamp).toLocaleTimeString() : gatewayStatus.lastPacketTimestamp}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Adapter 1: Physics Engine Simulator */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              isSimulated
                ? "bg-amber-950/20 border-amber-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">Simulador Físico Hugot</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    isSimulated
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}
                >
                  {isSimulated ? "ACTIVO (GENERANDO)" : "STANDBY"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Gemelo matemático en memoria ejecutando ecuaciones de molienda (Hugot) y balance de vapor (ASME PTC 4).
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-500">
                Origen: <span className="text-amber-400">engine://thermodynamics</span>
              </div>
            </div>
            <button
              onClick={() => handleTestOrSwitch("SIMULATION")}
              disabled={testingProtocol !== null || isSimulated}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              {isSimulated ? "Canal Activo (Simulación)" : "Conmutar a Simulador"}
            </button>
          </div>

          {/* Adapter 2: OPC-UA Client */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel.includes("OPC-UA") && !isSimulated
                ? "bg-cyan-950/20 border-cyan-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">OPC-UA Client IEC 62541</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {isSimulated ? "STANDBY (Sin hardware)" : "SIN ENLACE"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Conector para servidores DCS de molienda y calderas (opc.tcp://edge-gateway.local:4840).
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-500">
                Estado físico:{" "}
                <span className="text-slate-400">
                  {isSimulated ? "En espera (Modo Simulación)" : "Sin señal de campo"}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleTestOrSwitch("OPC_UA")}
              disabled={testingProtocol !== null}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              Comprobar Enlace OT
            </button>
          </div>

          {/* Adapter 3: MQTT Sparkplug B */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel.includes("MQTT") && !isSimulated
                ? "bg-cyan-950/20 border-cyan-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">MQTT Sparkplug B</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {isSimulated ? "STANDBY (Sin broker)" : "SIN ENLACE"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Broker UNS EMQX / HiveMQ con espacio de nombres unificado y formato Protobuf.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-500">
                Broker: <span className="text-slate-400">tls://mqtt-broker.bioazucar:8883</span>
              </div>
            </div>
            <button
              onClick={() => handleTestOrSwitch("MQTT")}
              disabled={testingProtocol !== null}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              Comprobar Broker UNS
            </button>
          </div>

          {/* Adapter 4: REST / LIMS / Historian */}
          <div className="p-4 rounded-xl border bg-slate-950/70 border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">LIMS & Core Sampler API</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  STANDBY
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Ingesta de calidad de caña (% Pol, Brix, Fibra) desde laboratorio y sonda de muestreo de patio.
              </p>
              <div className="mt-2 text-[10px] font-mono text-slate-500">
                Endpoint: <span className="text-slate-400">https://lims-gateway.bioazucar</span>
              </div>
            </div>
            <button
              onClick={() => handleTestOrSwitch("REST")}
              disabled={testingProtocol !== null}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              Verificar Conexión LIMS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
