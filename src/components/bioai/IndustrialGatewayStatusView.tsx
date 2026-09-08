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
  Terminal,
} from "lucide-react";
import { industrialDataGateway } from "../../services/gateway/IndustrialDataGateway";
import { IndustrialGatewayStatus } from "../../types/bioai";

export const IndustrialGatewayStatusView: React.FC = () => {
  const [gatewayStatus, setGatewayStatus] = useState<IndustrialGatewayStatus>(
    industrialDataGateway.getStatus()
  );
  const [testingProtocol, setTestingProtocol] = useState<string | null>(null);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setGatewayStatus(industrialDataGateway.getStatus());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchAdapter = async (protocol: string) => {
    setTestingProtocol(protocol);
    setSwitchNotice(null);
    try {
      await industrialDataGateway.setActiveAdapter(protocol);
      setGatewayStatus(industrialDataGateway.getStatus());
      setSwitchNotice(`Canal industrial conmutado a: ${protocol}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setTestingProtocol(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: IEC 62443 Cyber-Isolation Badge & Unified Status */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider">
              Industrial Data Gateway & Pasarela OT/IT
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              UNS Layer
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Abstracción unificada de protocolos industriales con aislamiento unidireccional de control
          </p>
        </div>

        {/* Security Certificate Badge */}
        <div className="flex items-center gap-2 p-2 bg-emerald-950/30 border border-emerald-500/40 rounded-lg text-xs font-mono text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Cumplimiento IEC 62443: Zona de Control OT Segregada</span>
        </div>
      </div>

      {switchNotice && (
        <div className="p-3 bg-cyan-950/40 border border-cyan-500/40 rounded-xl text-xs font-mono text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{switchNotice}</span>
          </div>
          <button onClick={() => setSwitchNotice(null)} className="text-cyan-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Gateway Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Canal OT Activo</span>
          <div className="text-xl font-bold font-tech text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            {gatewayStatus.activeChannel}
          </div>
          <span className="text-[10px] text-slate-500 font-mono mt-1 block">
            Adapter: {gatewayStatus.adapterName}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Latencia de Enlace</span>
          <div className="text-xl font-bold font-tech text-cyan-400">
            {gatewayStatus.latencyMs} ms
          </div>
          <span className="text-[10px] text-emerald-400 font-mono mt-1 block">
            Calidad de Señal: {gatewayStatus.signalQuality}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Tasa de Telemetría</span>
          <div className="text-xl font-bold font-tech text-white">
            {gatewayStatus.packetsPerSec}{" "}
            <span className="text-xs font-normal text-slate-400">puntos / seg</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            Total paquetes: {gatewayStatus.totalPacketsReceived.toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 font-mono block mb-1">Cero Acceso Directo</span>
          <div className="text-xl font-bold font-tech text-emerald-400 flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            Air-Gapped AI
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1 block">
            La IA lee a través de UNS / Edge
          </span>
        </div>
      </div>

      {/* Protocol Adapters Status & Switching Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold text-white font-tech uppercase tracking-wider">
              Adaptadores Industriales Configurados en el Gateway
            </h4>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Último paquete: {new Date(gatewayStatus.lastPacketTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Adapter 1: OPC-UA */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel === "OPC_UA"
                ? "bg-cyan-950/20 border-cyan-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">OPC-UA Client</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Listo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Lectura estándar IEC 62541 de servidores DCS de molienda y calderas (opc.tcp://192.168.10.50:4840).
              </p>
            </div>
            <button
              onClick={() => handleSwitchAdapter("OPC_UA")}
              disabled={testingProtocol !== null || gatewayStatus.activeChannel === "OPC_UA"}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              {gatewayStatus.activeChannel === "OPC_UA" ? "Canal Activo" : "Conmutar a OPC-UA"}
            </button>
          </div>

          {/* Adapter 2: MQTT Sparkplug B */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel === "MQTT"
                ? "bg-cyan-950/20 border-cyan-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">MQTT Sparkplug B</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Listo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Broker UNS EMQX / HiveMQ con payloads comprimidos Protobuf y espacio de nombres unificado.
              </p>
            </div>
            <button
              onClick={() => handleSwitchAdapter("MQTT")}
              disabled={testingProtocol !== null || gatewayStatus.activeChannel === "MQTT"}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              {gatewayStatus.activeChannel === "MQTT" ? "Canal Activo" : "Conmutar a MQTT"}
            </button>
          </div>

          {/* Adapter 3: REST / Industrial Historian */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel === "REST"
                ? "bg-cyan-950/20 border-cyan-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">REST / Historian</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Listo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Conector API HTTPS a OSIsoft PI / InfluxDB para consultas históricas y linaje de datos.
              </p>
            </div>
            <button
              onClick={() => handleSwitchAdapter("REST")}
              disabled={testingProtocol !== null || gatewayStatus.activeChannel === "REST"}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              {gatewayStatus.activeChannel === "REST" ? "Canal Activo" : "Conmutar a REST"}
            </button>
          </div>

          {/* Adapter 4: Physics Engine Simulator */}
          <div
            className={`p-4 rounded-xl border transition flex flex-col justify-between ${
              gatewayStatus.activeChannel === "SIMULATION"
                ? "bg-indigo-950/30 border-indigo-500/50"
                : "bg-slate-950/70 border-slate-800"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold font-tech text-white">Physics Simulator</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                  Demo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Motor cinético y termodinámico en tiempo real simulando variaciones de caña, vapor y despacho.
              </p>
            </div>
            <button
              onClick={() => handleSwitchAdapter("SIMULATION")}
              disabled={testingProtocol !== null || gatewayStatus.activeChannel === "SIMULATION"}
              className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition disabled:opacity-50"
            >
              {gatewayStatus.activeChannel === "SIMULATION" ? "Canal Activo" : "Conmutar a Simulador"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
