import React, { useState, useEffect } from "react";
import {
  Server,
  Activity,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Wifi,
  WifiOff,
  Database,
  Cpu,
  RefreshCw,
  Send,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Layers,
  FileCheck,
  Radio,
  Lock,
  Zap,
} from "lucide-react";
import { UserRole, DataSourceType } from "../types";
import { industrialEdge } from "../services/edge/BioAzucarIndustrialEdge";
import { commandService } from "../services/edge/CommandService";
import { dataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";
import { EdgeConnectorDiagnostics } from "../services/edge/types";

interface IndustrialEdgeConsoleProps {
  currentRole: UserRole;
  onUpdateSetpoint?: (tag: string, value: number) => void;
}

export const IndustrialEdgeConsole: React.FC<IndustrialEdgeConsoleProps> = ({
  currentRole,
  onUpdateSetpoint,
}) => {
  const [diagnostics, setDiagnostics] = useState(industrialEdge.getConsolidatedDiagnostics());
  const [activeProvider, setActiveProvider] = useState(dataProviderRegistry.getActiveProvider());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Command execution test state
  const [commandTag, setCommandTag] = useState<string>("Milling.Tandem.TCH_Actual");
  const [commandValue, setCommandValue] = useState<string>("450");
  const [commandReason, setCommandReason] = useState<string>("Optimización de molienda por mayor recepción de caña fresca");
  const [operatorConfirmed, setOperatorConfirmed] = useState<boolean>(true);
  const [commandResult, setCommandResult] = useState<{
    status: string;
    message: string;
    correlationId?: string;
  } | null>(null);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);

  // Recent command history
  const [commandHistory, setCommandHistory] = useState(() => commandService.getAuditTrail(6));

  useEffect(() => {
    // Poll edge diagnostics every 2 seconds
    const interval = setInterval(() => {
      setDiagnostics(industrialEdge.getConsolidatedDiagnostics());
      setCommandHistory(commandService.getAuditTrail(6));
      setActiveProvider(dataProviderRegistry.getActiveProvider());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setDiagnostics(industrialEdge.getConsolidatedDiagnostics());
    setCommandHistory(commandService.getAuditTrail(6));
    setActiveProvider(dataProviderRegistry.getActiveProvider());
    await new Promise((r) => setTimeout(r, 400));
    setIsRefreshing(false);
  };

  const handleToggleCloudConnectivity = () => {
    const current = industrialEdge.storeAndForward.getCloudConnectivity();
    industrialEdge.storeAndForward.setCloudConnectivity(!current);
    setDiagnostics(industrialEdge.getConsolidatedDiagnostics());
  };

  const handleSwitchToEdgeProvider = async () => {
    await dataProviderRegistry.setActiveProvider("provider-bioazucar-edge");
    setActiveProvider(dataProviderRegistry.getActiveProvider());
  };

  const handleSwitchToSimulationProvider = async () => {
    await dataProviderRegistry.setActiveProvider("provider-simulation-canonical");
    setActiveProvider(dataProviderRegistry.getActiveProvider());
  };

  const handleExecuteCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecutingCommand(true);
    setCommandResult(null);

    try {
      const numVal = parseFloat(commandValue);
      if (isNaN(numVal)) {
        setCommandResult({
          status: "REJECTED",
          message: "El valor solicitado debe ser un número válido.",
        });
        setIsExecutingCommand(false);
        return;
      }

      const execResult = await commandService.executeCommand(
        {
          tag: commandTag,
          commandType: "CHANGE_SETPOINT",
          requestedValue: numVal,
          operatorId: `OP-${currentRole}`,
          reason: commandReason,
          clientIp: "192.168.10.45",
          securityClearanceLevel: 2,
        },
        operatorConfirmed
      );

      setCommandResult({
        status: execResult.status,
        message: execResult.message,
        correlationId: execResult.correlationId,
      });

      if (execResult.status === "EXECUTED" && onUpdateSetpoint) {
        onUpdateSetpoint(commandTag, numVal);
      }

      setCommandHistory(commandService.getAuditTrail(6));
    } catch (err: any) {
      setCommandResult({
        status: "ERROR",
        message: err.message,
      });
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const isEdgeActive = activeProvider.id === "provider-bioazucar-edge";

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Mode Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white tracking-wide">
                  BioAzúcar Industrial Edge (OT/DMZ Gateway)
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  IEC 62443 Level 2/3
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Intermediario ciberseguro entre PLCs/RTUs (Molienda, Calderas, EROS) y la plataforma cloud con Store & Forward.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Simulation vs Edge toggle */}
            <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-xl">
              <button
                id="btn-switch-simulation"
                onClick={handleSwitchToSimulationProvider}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  !isEdgeActive
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Modo Simulación
              </button>
              <button
                id="btn-switch-edge"
                onClick={handleSwitchToEdgeProvider}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                  isEdgeActive
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                Edge OT Producción
              </button>
            </div>

            <button
              id="btn-refresh-edge"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition"
              title="Refrescar diagnósticos Edge"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Node Metadata Bar */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 text-xs font-mono">
          <div>
            <span className="text-slate-400">Edge Node ID:</span>
            <div className="text-slate-200 font-semibold">{diagnostics.edgeNode.edgeNodeId}</div>
          </div>
          <div>
            <span className="text-slate-400">Hardware IPC:</span>
            <div className="text-slate-200 font-semibold">{diagnostics.edgeNode.hardwareArch}</div>
          </div>
          <div>
            <span className="text-slate-400">OS Real-Time:</span>
            <div className="text-slate-200 font-semibold">{diagnostics.edgeNode.osVersion}</div>
          </div>
          <div>
            <span className="text-slate-400">IP OT / DMZ:</span>
            <div className="text-cyan-400 font-semibold">{diagnostics.edgeNode.ipAddress}</div>
          </div>
        </div>
      </div>

      {/* 2. Architecture Topology Diagram (OT -> Edge -> DMZ -> Platform) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          Topología de Red Industrial & Segmentación ISA/IEC 62443
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {/* Level 1: Field / OT */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Nivel 1 OT</span>
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="font-semibold text-white text-sm">Controladores & PLCs</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Allen-Bradley ControlLogix, Siemens S7-1500, EROS DCS, Moxa NPort, Básculas Avery Weigh-Tronix.
            </p>
            <div className="pt-2 text-[11px] font-mono text-slate-400">VLAN 10: 192.168.10.0/24</div>
          </div>

          {/* Level 2: Industrial Edge */}
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 space-y-2 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">Nivel 2 Edge</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="font-semibold text-white text-sm">BioAzúcar Edge Gateway</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Adquisición multicanal, X.509 Secure Channel, Store & Forward FIFO y verificación RBAC.
            </p>
            <div className="pt-2 text-[11px] font-mono text-cyan-400">Dual NIC / Isolación Física</div>
          </div>

          {/* Level 3.5: Industrial DMZ */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Nivel 3.5 DMZ</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="font-semibold text-white text-sm">Industrial DMZ Proxy</div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Next-Gen Firewall (FortiGate), TLS 1.3 mTLS Broker MQTT y Reverse Proxy inverso unidireccional.
            </p>
            <div className="pt-2 text-[11px] font-mono text-purple-400">TLS 1.3 Puerto 8883</div>
          </div>

          {/* Level 4: Cloud Platform */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Nivel 4 IT/Cloud</span>
              <Database className="w-4 h-4 text-blue-400" />
            </div>
            <div className="font-semibold text-white text-sm">BioAzúcar 4.0 Platform</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              UNS Hub, Copilot AI, Historiador Digital, Análisis de KPIs y Trazabilidad de Lotes.
            </p>
            <div className="pt-2 text-[11px] font-mono text-blue-400">Cloud Storage / Analytics</div>
          </div>
        </div>
      </div>

      {/* 3. Connectors Status & Operational Diagnostics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {diagnostics.connectors.map((c, cIdx) => (
          <div
            key={c.connectorId || `connector-${c.name}-${cIdx}`}
            className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-lg ${
                    c.status === "CONNECTED"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}
                >
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-sm">{c.name}</h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    Protocolo: <strong className="text-slate-200">{c.protocol}</strong> ({c.source})
                  </span>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 ${
                  c.status === "CONNECTED"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    c.status === "CONNECTED" ? "bg-emerald-400 animate-pulse" : "bg-red-400"
                  }`}
                />
                {c.status}
              </span>
            </div>

            <p className="text-xs text-slate-300 font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80">
              {c.statusMessage}
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Latencia OT</span>
                <span className="text-slate-200 font-bold">{c.latencyMs} ms</span>
              </div>
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Tasa Mensajes</span>
                <span className="text-emerald-400 font-bold">{c.messageRateSec} msg/s</span>
              </div>
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Calidad Buena</span>
                <span className="text-cyan-400 font-bold">{c.qualityGoodPercentage}%</span>
              </div>
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Paquetes TX/RX</span>
                <span className="text-slate-300 font-bold">{c.packetsSent} / {c.packetsReceived}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Reconexiones</span>
                <span className="text-amber-400 font-bold">{c.reconnectCount}</span>
              </div>
              <div className="p-2 rounded bg-slate-950/40 border border-slate-800/60">
                <span className="text-slate-400 text-[10px] block">Clock Skew</span>
                <span className="text-slate-300 font-bold">{c.clockSkewMs} ms</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Store & Forward Queue Engine (Cloud Outage Resiliency) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                Motor Store & Forward (Persistencia Local de Contingencia)
              </h4>
              <p className="text-xs text-slate-400">
                Garantiza que la pérdida de enlace cloud nunca interrumpa la adquisición OT ni pierda telemetría.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-toggle-cloud-link"
              onClick={handleToggleCloudConnectivity}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                diagnostics.storeAndForward.isCloudConnected
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  : "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
              }`}
            >
              {diagnostics.storeAndForward.isCloudConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5" /> Enlace Cloud Activo (Simular Corte)
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5" /> Enlace Cloud Cortado (Restaurar)
                </>
              )}
            </button>
          </div>
        </div>

        {/* Store & Forward State Visualizer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono pt-2">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Profundidad Cola (Queue Depth)</span>
            <span className="text-xl font-bold text-white">
              {diagnostics.storeAndForward.queueDepth}{" "}
              <span className="text-xs text-slate-400 font-normal">pts</span>
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">High Watermark Registrado</span>
            <span className="text-xl font-bold text-cyan-400">
              {diagnostics.storeAndForward.highWatermark}{" "}
              <span className="text-xs text-slate-400 font-normal">pts</span>
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Total Ingeridos</span>
            <span className="text-xl font-bold text-emerald-400">
              {diagnostics.storeAndForward.totalEnqueued}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <span className="text-slate-400 text-[11px] block">Confirmados por Cloud</span>
            <span className="text-xl font-bold text-purple-400">
              {diagnostics.storeAndForward.totalAcknowledged}
            </span>
          </div>
        </div>

        {!diagnostics.storeAndForward.isCloudConnected && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Simulación de Pérdida de Enlace Cloud en curso:</strong> La cola Store & Forward está bufferizando todos los paquetes OT localmente con deduplicación y preservación estricta de <code>deviceTimestamp</code>.
            </span>
          </div>
        )}
      </div>

      {/* 5. Command Service & Policy Engine (IEC 62443 Security) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Dispatch Setpoint Console */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-white text-sm">
                Despacho Idempotente de Setpoints OT
              </h4>
              <p className="text-xs text-slate-400">
                Canal segregado con validación de rangos, RBAC y firma de operador.
              </p>
            </div>
          </div>

          <form onSubmit={handleExecuteCommand} className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Tag Industrial de Destino:</label>
              <select
                value={commandTag}
                onChange={(e) => setCommandTag(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
              >
                <option value="Milling.Tandem.TCH_Actual">OPC UA: Milling.Tandem.TCH_Actual (Rango: 200 - 600 TCH)</option>
                <option value="Boiler1.Steam_Pressure_HP">OPC UA: Boiler1.Steam_Pressure_HP (Rango: 40 - 75 bar)</option>
                <option value="Grid.Substation.ExportPower_MW">OPC UA: Grid.Substation.ExportPower_MW (Rango: 5 - 35 MW)</option>
                <option value="Milling.EROS.Hydraulic_Pressure_Bar">EROS: Milling.EROS.Hydraulic_Pressure_Bar (Rango: 150 - 250 bar)</option>
                <option value="Modbus.Scale1.GrossWeight_Tons">Modbus: Modbus.Scale1.GrossWeight_Tons</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Nuevo Setpoint Solicitado:</label>
                <input
                  type="text"
                  value={commandValue}
                  onChange={(e) => setCommandValue(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
                  placeholder="Ej. 480"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Operador Autenticado:</label>
                <input
                  type="text"
                  disabled
                  value={`${currentRole} (Nivel 2)`}
                  className="w-full bg-slate-950/60 border border-slate-800/80 rounded-lg p-2 text-slate-400"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Justificación Operacional (Auditoría SOE):</label>
              <input
                type="text"
                value={commandReason}
                onChange={(e) => setCommandReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="check-human-confirm"
                checked={operatorConfirmed}
                onChange={(e) => setOperatorConfirmed(e.target.checked)}
                className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
              />
              <label htmlFor="check-human-confirm" className="text-slate-300 text-[11px] cursor-pointer">
                Confirmación explícita del operador (Exigido por Principio de Seguridad IEC 62443)
              </label>
            </div>

            <button
              type="submit"
              disabled={isExecutingCommand}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold hover:brightness-110 transition flex items-center justify-center gap-2 mt-2"
            >
              {isExecutingCommand ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar Comando Validado a PLC / Gateway
            </button>
          </form>

          {commandResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono ${
                commandResult.status === "EXECUTED"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              }`}
            >
              <div className="flex items-center gap-2 font-bold mb-1">
                {commandResult.status === "EXECUTED" ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                )}
                Estado: {commandResult.status}
              </div>
              <p>{commandResult.message}</p>
              {commandResult.correlationId && (
                <div className="text-[10px] text-slate-400 mt-1">
                  Correlation ID: {commandResult.correlationId}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Security Policy Engine & Audit Trail */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">
                  Bitácora de Comandos & Idempotencia
                </h4>
                <p className="text-xs text-slate-400">
                  Trazabilidad criptográfica de comandos despachados hacia campo.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {commandHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                No hay comandos despachados en esta sesión.
              </div>
            ) : (
              commandHistory.map((cmd, idx) => {
                const isExecuted = cmd.executionStatus === "EXECUTED";
                const displayMsg = cmd.result?.message || cmd.validationMessage || cmd.reason || "Comando procesado";
                const displayOp = cmd.userName || cmd.userId || "Operador";
                const displayTime = cmd.timestamp ? new Date(cmd.timestamp).toLocaleTimeString() : "";
                const safeKey = cmd.commandId || cmd.idempotencyKey || `cmd-hist-${idx}`;

                return (
                  <div
                    key={safeKey}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-cyan-400" />
                        {cmd.tag}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isExecuted
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                        }`}
                      >
                        {cmd.executionStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      Valor: <strong className="text-cyan-400">{String(cmd.requestedValue)}</strong> • Operador:{" "}
                      <span className="text-slate-400">{displayOp}</span>
                    </div>

                    <p className="text-[10px] text-slate-400 truncate">{displayMsg}</p>

                    <div className="text-[9px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-900">
                      <span>{cmd.idempotencyKey ? `${cmd.idempotencyKey.slice(0, 18)}...` : safeKey}</span>
                      <span>{displayTime}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
