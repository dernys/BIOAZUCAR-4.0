import React, { useState, useEffect } from "react";
import {
  Network,
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sliders,
  FileCode,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  Lock,
  ArrowUpRight,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Server,
  Info,
  ExternalLink,
  Terminal,
} from "lucide-react";
import {
  TelemetryData,
  UserRole,
  IndustrialTagDefinition,
  OTConnectionConfig,
  ConnectionDiagnostics,
  DataLineageInfo,
} from "../types";
import { tagManagementService } from "../services/tagManagementService";
import { otInfrastructureService } from "../services/otInfrastructureService";
import { dataProviderRegistry } from "../services/dataProviders/DataProviderRegistry";
import { kpiEngine } from "../services/kpiEngine";
import { DataLineageModal } from "./DataLineageModal";
import { IndustrialEdgeConsole } from "./IndustrialEdgeConsole";

interface UNSHubProps {
  telemetry: TelemetryData;
  currentRole: UserRole;
  onUpdateSetpoint?: (tag: string, value: number) => void;
}

export const UNSHub: React.FC<UNSHubProps> = ({
  telemetry,
  currentRole,
  onUpdateSetpoint,
}) => {
  const [activeTab, setActiveTab] = useState<"UNS_TREE" | "INDUSTRIAL_EDGE" | "DATA_PROVIDERS" | "TAG_MANAGEMENT" | "OT_INFRASTRUCTURE" | "EROS_INTEGRATOR">("INDUSTRIAL_EDGE");
  const [selectedTopic, setSelectedTopic] = useState<string>("BioAzucar/AreaMolienda/Molino03/Vibracion_RMS");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterQuality, setFilterQuality] = useState<"ALL" | "GOOD" | "BAD" | "UNCERTAIN">("ALL");
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    "BioAzucar": true,
    "BioAzucar/AreaMolienda": true,
    "BioAzucar/Cogeneracion": true,
    "BioAzucar/Calderas": true,
    "BioAzucar/Evaporacion": true,
  });

  // OPC UA / Tag Write Modal
  const [writeTagAddress, setWriteTagAddress] = useState<string>("Milling.Tandem.TCH_Actual");
  const [writeValue, setWriteValue] = useState<string>("450");
  const [writeSuccessMsg, setWriteSuccessMsg] = useState<string | null>(null);

  // Tag Management State
  const [tags, setTags] = useState<IndustrialTagDefinition[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [editingTag, setEditingTag] = useState<IndustrialTagDefinition | null>(null);
  const [tagForm, setTagForm] = useState<Partial<IndustrialTagDefinition>>({
    name: "",
    description: "",
    area: "MOLIENDA",
    equipmentId: "eq-molino-1",
    equipmentName: "Molino 01 Tándem",
    variable: "",
    unit: "TCH",
    dataType: "FLOAT",
    source: "SIMULATION",
    protocol: "SIMULATOR",
    address: "",
    accessMode: "READ_WRITE",
    scanRateMs: 1000,
    deadband: 0.1,
    engMin: 0,
    engMax: 600,
    historization: true,
    alarmEnabled: true,
    highAlarm: 480,
    lowAlarm: 380,
    securityLevel: 2,
    status: "ACTIVE",
  });

  // OT Infrastructure State
  const [otDevices, setOtDevices] = useState<OTConnectionConfig[]>([]);
  const [isOtModalOpen, setIsOtModalOpen] = useState<boolean>(false);
  const [editingOt, setEditingOt] = useState<OTConnectionConfig | null>(null);
  const [otForm, setOtForm] = useState<Partial<OTConnectionConfig>>({
    name: "",
    type: "PLC",
    host: "192.168.10.10",
    port: 4840,
    protocol: "OPC-UA",
    security: "SIGN_ENCRYPT",
    timeoutMs: 3000,
    retryPolicy: "EXPONENTIAL_BACKOFF",
    heartbeatIntervalSec: 5,
    description: "",
  });
  const [testResult, setTestResult] = useState<{ id: string; diag: ConnectionDiagnostics } | null>(null);

  // Providers & Lineage
  const [providers, setProviders] = useState(dataProviderRegistry.getAllProviders());
  const [activeProviderId, setActiveProviderId] = useState(dataProviderRegistry.getActiveProvider().id);
  const [selectedLineage, setSelectedLineage] = useState<DataLineageInfo | null>(null);

  useEffect(() => {
    loadData();
    const unsub = dataProviderRegistry.onActiveProviderChange((p) => {
      setActiveProviderId(p.id);
    });
    return () => unsub();
  }, []);

  const loadData = async () => {
    const loadedTags = await tagManagementService.getTags();
    setTags(loadedTags);
    const loadedOt = await otInfrastructureService.getConnections();
    setOtDevices(loadedOt);
    setProviders(dataProviderRegistry.getAllProviders());
  };

  const handleProviderSwitch = async (provId: string) => {
    await dataProviderRegistry.setActiveProvider(provId);
    setActiveProviderId(provId);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagForm.name || !tagForm.address) return;

    if (editingTag) {
      await tagManagementService.updateTag(editingTag.id, tagForm, {
        role: currentRole,
        name: "Usuario BioAzúcar",
      });
    } else {
      await tagManagementService.createTag(
        tagForm as any,
        { role: currentRole, name: "Usuario BioAzúcar" }
      );
    }
    setIsTagModalOpen(false);
    setEditingTag(null);
    loadData();
  };

  const handleDeleteTag = async (id: string) => {
    if (window.confirm("¿Confirmas la eliminación de este Tag Industrial del catálogo?")) {
      await tagManagementService.deleteTag(id, { role: currentRole, name: "Usuario BioAzúcar" });
      loadData();
    }
  };

  const handleSaveOt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otForm.name || !otForm.host) return;

    if (editingOt) {
      await otInfrastructureService.updateConnection(editingOt.id, otForm, {
        role: currentRole,
        name: "Usuario BioAzúcar",
      });
    } else {
      await otInfrastructureService.createConnection(
        {
          ...otForm,
          latencyMs: 10,
          activeTagsCount: 0,
          messageRateSec: 0,
        } as any,
        { role: currentRole, name: "Usuario BioAzúcar" }
      );
    }
    setIsOtModalOpen(false);
    setEditingOt(null);
    loadData();
  };

  const handleTestOt = async (id: string) => {
    const diag = await otInfrastructureService.testConnection(id);
    setTestResult({ id, diag });
  };

  const handleExecuteWrite = async () => {
    const activeProv = dataProviderRegistry.getActiveProvider();
    const res = await activeProv.writeTag({
      tag: writeTagAddress,
      value: parseFloat(writeValue) || writeValue,
      operatorId: "USR-OP-01",
      operatorRole: currentRole,
      reason: "Ajuste operacional de setpoint desde interfaz de supervisión UNS",
      securityClearanceLevel: currentRole === "superadmin" || currentRole === "administrador" ? 3 : 2,
    });

    setWriteSuccessMsg(res.message);
    if (onUpdateSetpoint && !isNaN(parseFloat(writeValue))) {
      onUpdateSetpoint(writeTagAddress, parseFloat(writeValue));
    }
    setTimeout(() => setWriteSuccessMsg(null), 5000);
  };

  // Dynamic UNS Sparkplug tags
  const dynamicUnsTags = [
    {
      id: "uns-1",
      topic: "BioAzucar/AreaMolienda/Tandem/FlujoMolienda_TCH",
      name: "Flujo de Molienda TCH",
      area: "Molienda",
      kpiId: "kpi-tch",
      currentValue: (telemetry.tch ?? 450).toFixed(1),
      unit: "TCH",
      datatype: "Float",
      quality: "GOOD" as const,
      timestamp: new Date().toISOString(),
      protocolSource: "SIMULATION (ns=2;s=Milling.TCH)",
    },
    {
      id: "uns-2",
      topic: "BioAzucar/AreaMolienda/Molino03/Vibracion_RMS",
      name: "Vibración Molino 3 Chumacera",
      area: "Molienda",
      kpiId: "kpi-milling",
      currentValue: (telemetry.mill3Vibration ?? 2.4).toFixed(2),
      unit: "mm/s",
      datatype: "Float",
      quality: (telemetry.mill3Vibration ?? 2.4) > 4.5 ? ("UNCERTAIN" as const) : ("GOOD" as const),
      timestamp: new Date().toISOString(),
      protocolSource: "SIMULATION (ns=2;s=Milling.Mill3.VibrationRMS)",
    },
    {
      id: "uns-3",
      topic: "BioAzucar/Calderas/Caldera01/Presion_Vapor_HP",
      name: "Presión Vapor Alta Presión HP",
      area: "Calderas",
      kpiId: "kpi-steam-hp",
      currentValue: (telemetry.boilerPressureHP ?? 64.6).toFixed(1),
      unit: "bar",
      datatype: "Float",
      quality: (telemetry.boilerPressureHP ?? 64.6) < 60 ? ("UNCERTAIN" as const) : ("GOOD" as const),
      timestamp: new Date().toISOString(),
      protocolSource: "SIMULATION (ns=2;s=Boiler1.PressureHP)",
    },
    {
      id: "uns-4",
      topic: "BioAzucar/Cogeneracion/Turbina01/Potencia_Exportada_MW",
      name: "Potencia Exportada a Red",
      area: "Cogeneracion",
      kpiId: "kpi-power-export",
      currentValue: (telemetry.powerExportGridMW ?? 21.2).toFixed(1),
      unit: "MW",
      datatype: "Float",
      quality: "GOOD" as const,
      timestamp: new Date().toISOString(),
      protocolSource: "SIMULATION (ns=2;s=Grid.ExportPower)",
    },
    {
      id: "uns-5",
      topic: "BioAzucar/Evaporacion/Cuadruple/Brix_Meladura",
      name: "Grados Brix Meladura Concentrada",
      area: "Evaporacion",
      kpiId: "kpi-evap-brix",
      currentValue: (telemetry.evaporatorSyrupBrix ?? 66.8).toFixed(1),
      unit: "°Bx",
      datatype: "Float",
      quality: "GOOD" as const,
      timestamp: new Date().toISOString(),
      protocolSource: "SIMULATION (ns=2;s=Evaporator.SyrupBrix)",
    },
  ];

  const handleInspectLineage = (kpiId: string) => {
    const lineage = kpiEngine.calculateDataLineage(kpiId, new Map(), telemetry);
    setSelectedLineage(lineage);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Unified Namespace & Ingestión OT/IT
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  ISA-95 / Sparkplug B
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Desacoplamiento total de fuentes de datos (Simulación, OPC-UA, MQTT, Modbus, EROS y REST)
              </p>
            </div>
          </div>

          {/* Active Provider Indicator */}
          <div className="flex items-center gap-3 bg-slate-950/80 border border-slate-800 px-4 py-2 rounded-xl">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <div>
              <div className="text-[11px] text-slate-400 font-semibold uppercase">Proveedor Activo</div>
              <div className="text-xs font-mono font-bold text-white">
                {dataProviderRegistry.getActiveProvider().name}
              </div>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {dataProviderRegistry.getActiveProvider().source}
            </span>
          </div>
        </div>

        {/* Sub Navigation Bar */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-slate-800/80">
          <button
            id="tab-industrial-edge"
            onClick={() => setActiveTab("INDUSTRIAL_EDGE")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "INDUSTRIAL_EDGE"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Server className="w-4 h-4 text-cyan-400" />
            BioAzúcar Industrial Edge (OT/DMZ)
          </button>
          <button
            id="tab-uns-tree"
            onClick={() => setActiveTab("UNS_TREE")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "UNS_TREE"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Layers className="w-4 h-4" />
            Árbol UNS (Sparkplug B)
          </button>
          <button
            id="tab-data-providers"
            onClick={() => setActiveTab("DATA_PROVIDERS")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "DATA_PROVIDERS"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Radio className="w-4 h-4" />
            Proveedores & Conectores ({providers.length})
          </button>
          <button
            id="tab-tag-management"
            onClick={() => setActiveTab("TAG_MANAGEMENT")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "TAG_MANAGEMENT"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Catálogo de Tags ({tags.length})
          </button>
          <button
            id="tab-ot-infrastructure"
            onClick={() => setActiveTab("OT_INFRASTRUCTURE")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "OT_INFRASTRUCTURE"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Server className="w-4 h-4" />
            Infraestructura OT & PLCs ({otDevices.length})
          </button>
          <button
            id="tab-eros-integrator"
            onClick={() => setActiveTab("EROS_INTEGRATOR")}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeTab === "EROS_INTEGRATOR"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Cpu className="w-4 h-4" />
            Adaptador EROS (ISA-95)
          </button>
        </div>
      </div>

      {/* VIEW: INDUSTRIAL EDGE GATEWAY CONSOLE */}
      {activeTab === "INDUSTRIAL_EDGE" && (
        <IndustrialEdgeConsole
          currentRole={currentRole}
          onUpdateSetpoint={onUpdateSetpoint}
        />
      )}

      {/* VIEW 1: UNS TREE */}
      {activeTab === "UNS_TREE" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Topics Tree & Search */}
          <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Jerarquía ISA-95 Sparkplug B
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filtrar Calidad:</span>
                <select
                  id="select-filter-quality"
                  value={filterQuality}
                  onChange={(e) => setFilterQuality(e.target.value as any)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                >
                  <option value="ALL">Todas las Calidades</option>
                  <option value="GOOD">GOOD (Buena)</option>
                  <option value="UNCERTAIN">UNCERTAIN (Dudosa)</option>
                  <option value="BAD">BAD (Mala)</option>
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                id="input-search-uns-topics"
                type="text"
                placeholder="Buscar por tópico MQTT, tag o variable..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Dynamic Topics List */}
            <div className="space-y-2.5">
              {dynamicUnsTags
                .filter((t) => filterQuality === "ALL" || t.quality === filterQuality)
                .filter((t) => t.topic.toLowerCase().includes(searchTerm.toLowerCase()) || t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((tag) => (
                  <div
                    key={tag.id}
                    onClick={() => setSelectedTopic(tag.topic)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      selectedTopic === tag.topic
                        ? "bg-slate-800/90 border-emerald-500/60 shadow-md"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {tag.topic}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Área: <strong className="text-slate-200">{tag.area}</strong></span>
                        <span>Tipo: <strong className="font-mono text-cyan-300">{tag.datatype}</strong></span>
                        <span>Origen: <strong className="font-mono text-amber-300">{tag.protocolSource}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-base font-bold font-mono text-emerald-400">
                          {tag.currentValue} {tag.unit}
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(tag.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                      <button
                        id={`btn-inspect-lineage-${tag.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInspectLineage(tag.kpiId);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1"
                        title="Auditar linaje y origen de datos"
                      >
                        <Info className="w-3.5 h-3.5" /> Linaje
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Right Column: OPC UA / Setpoint Write Panel */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                Escritura de Setpoint Segura
              </h3>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                RBAC Level 2+
              </span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
              <div>
                <label className="text-xs text-slate-400 font-medium">Tag Destino (NodeId)</label>
                <input
                  id="input-write-tag-address"
                  type="text"
                  value={writeTagAddress}
                  onChange={(e) => setWriteTagAddress(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 mt-1 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-medium">Nuevo Valor de Consigna</label>
                <input
                  id="input-write-value"
                  type="text"
                  value={writeValue}
                  onChange={(e) => setWriteValue(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-white mt-1 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {writeSuccessMsg && (
                <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{writeSuccessMsg}</span>
                </div>
              )}

              <button
                id="btn-execute-setpoint-write"
                onClick={handleExecuteWrite}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs rounded-lg transition shadow-md shadow-cyan-600/20 flex items-center justify-center gap-1.5"
              >
                <Send className="w-4 h-4" /> Despachar a Bus de Control
              </button>
            </div>

            {/* ISA-95 Compliance Guidelines */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Seguridad Operacional
              </span>
              <p>
                Toda orden de escritura hacia el bus OT pasa por el proveedor activo{" "}
                <span className="font-mono text-white font-bold">{dataProviderRegistry.getActiveProvider().source}</span>{" "}
                con validación RBAC, rangos de ingeniería y registro inmutable en <code>audit_logs</code>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DATA PROVIDERS & INGESTION HUB */}
      {activeTab === "DATA_PROVIDERS" && (
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400" />
                Arquitectura de Proveedores de Datos (Provider / Adapter Pattern)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                La interfaz de usuario consume exclusivamente <code>IIndustrialDataProvider</code>.
                Cambia dinámicamente de origen sin reiniciar la aplicación ni alterar los cálculos de proceso.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {providers.map((prov) => {
                const isActive = prov.id === activeProviderId;
                return (
                  <div
                    key={prov.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                      isActive
                        ? "bg-slate-800/90 border-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {prov.source}
                        </span>
                        {isActive ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            EN EJECUCIÓN
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">EN ESPERA</span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-100">{prov.name}</h4>
                      <p className="text-xs text-slate-400">Protocolo: <strong className="text-cyan-300 font-mono">{prov.protocol}</strong></p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {prov.isConnected() ? "Conectado" : prov.source === "SIMULATION" ? "Simulador Activo" : "Offline (Sandbox)"}
                      </span>
                      {!isActive && (
                        <button
                          id={`btn-select-provider-${prov.id}`}
                          onClick={() => handleProviderSwitch(prov.id)}
                          className="px-3 py-1 bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-xs font-semibold rounded transition"
                        >
                          Activar Proveedor
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: TAG MANAGEMENT */}
      {activeTab === "TAG_MANAGEMENT" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-emerald-400" />
                Catálogo de Tags Industriales
              </h3>
              <p className="text-xs text-slate-400">
                Definición formal de variables, límites de alarma, rangos de ingeniería y asignación OT
              </p>
            </div>
            <button
              id="btn-open-create-tag-modal"
              onClick={() => {
                setEditingTag(null);
                setTagForm({
                  name: "",
                  description: "",
                  area: "MOLIENDA",
                  equipmentId: "eq-molino-1",
                  equipmentName: "Molino 01 Tándem",
                  variable: "",
                  unit: "TCH",
                  dataType: "FLOAT",
                  source: "SIMULATION",
                  protocol: "SIMULATOR",
                  address: "",
                  accessMode: "READ_WRITE",
                  scanRateMs: 1000,
                  deadband: 0.1,
                  engMin: 0,
                  engMax: 600,
                  historization: true,
                  alarmEnabled: true,
                  highAlarm: 480,
                  lowAlarm: 380,
                  securityLevel: 2,
                  status: "ACTIVE",
                });
                setIsTagModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Crear Nuevo Tag
            </button>
          </div>

          {/* Tags Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Tag / Variable</th>
                  <th className="py-3 px-4">Área & Equipo</th>
                  <th className="py-3 px-4">Dirección OT</th>
                  <th className="py-3 px-4">Unidad & Rango</th>
                  <th className="py-3 px-4">Alarmas (H/L)</th>
                  <th className="py-3 px-4">Origen</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tags.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{t.name}</div>
                      <div className="text-[11px] font-mono text-cyan-300">{t.variable}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold mr-1.5">
                        {t.area}
                      </span>
                      <span className="text-slate-400">{t.equipmentName}</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                      {t.address}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span className="text-emerald-400 font-bold">{t.unit}</span>{" "}
                      <span className="text-slate-500">({t.engMin} - {t.engMax})</span>
                    </td>
                    <td className="py-3 px-4 font-mono text-amber-300 text-[11px]">
                      {t.alarmEnabled ? `H:${t.highAlarm ?? "-"} | L:${t.lowAlarm ?? "-"}` : "Deshabilitadas"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-mono font-bold border border-cyan-500/20">
                        {t.source}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          id={`btn-edit-tag-${t.id}`}
                          onClick={() => {
                            setEditingTag(t);
                            setTagForm(t);
                            setIsTagModalOpen(true);
                          }}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Editar Tag"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`btn-delete-tag-${t.id}`}
                          onClick={() => handleDeleteTag(t.id)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition"
                          title="Eliminar Tag"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 4: OT INFRASTRUCTURE & PLCS */}
      {activeTab === "OT_INFRASTRUCTURE" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-400" />
                Dispositivos OT & Conexiones de Red
              </h3>
              <p className="text-xs text-slate-400">
                Gestión centralizada de PLCs, Gateways Edge, Brokers MQTT y Servidores OPC-UA
              </p>
            </div>
            <button
              id="btn-open-create-ot-modal"
              onClick={() => {
                setEditingOt(null);
                setOtForm({
                  name: "",
                  type: "PLC",
                  host: "192.168.10.10",
                  port: 4840,
                  protocol: "OPC-UA",
                  security: "SIGN_ENCRYPT",
                  timeoutMs: 3000,
                  retryPolicy: "EXPONENTIAL_BACKOFF",
                  heartbeatIntervalSec: 5,
                  description: "",
                });
                setIsOtModalOpen(true);
              }}
              className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-lg transition flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" /> Registrar Dispositivo OT
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {otDevices.map((dev) => (
              <div
                key={dev.id}
                className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      {dev.type}
                    </span>
                    <h4 className="text-sm font-bold text-slate-100">{dev.name}</h4>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {dev.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400">{dev.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
                  <div>
                    <span className="text-slate-500 font-sans">Host: </span>
                    <span className="text-cyan-300">{dev.host}:{dev.port}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans">Protocolo: </span>
                    <span className="text-emerald-400">{dev.protocol}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans">Seguridad: </span>
                    <span className="text-slate-300">{dev.security}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans">Heartbeat: </span>
                    <span className="text-slate-400">c/{dev.heartbeatIntervalSec}s</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    id={`btn-ping-test-${dev.id}`}
                    onClick={() => handleTestOt(dev.id)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-xs font-semibold text-cyan-300 border border-slate-700 transition flex items-center gap-1"
                  >
                    <Activity className="w-3.5 h-3.5" /> Test Diagnóstico
                  </button>
                  <div className="flex items-center gap-1.5">
                    <button
                      id={`btn-edit-ot-${dev.id}`}
                      onClick={() => {
                        setEditingOt(dev);
                        setOtForm(dev);
                        setIsOtModalOpen(true);
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Editar Dispositivo"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-ot-${dev.id}`}
                      onClick={async () => {
                        if (window.confirm("¿Eliminar este dispositivo de la infraestructura OT?")) {
                          await otInfrastructureService.deleteConnection(dev.id, { role: currentRole, name: "Usuario BioAzúcar" });
                          loadData();
                        }
                      }}
                      className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 transition"
                      title="Eliminar Dispositivo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {testResult?.id === dev.id && (
                  <div className="p-2.5 rounded bg-slate-900 border border-cyan-500/30 text-xs font-mono text-cyan-300 space-y-1 animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <span>Estado: {testResult.diag.status}</span>
                      <span>Latencia: {testResult.diag.lastPingMs} ms</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Paquetes: {testResult.diag.packetsReceived} RX / {testResult.diag.packetsSent} TX (0% pérdida)
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 5: EROS INTEGRATOR SPECIFICATION */}
      {activeTab === "EROS_INTEGRATOR" && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Conector y Adaptador Industrial EROS
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  IErosConnector Specification
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Especificación técnica para integración de sistemas de control de molienda de caña EROS
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Cadena de Mapeo Canónica
              </h4>
              <div className="space-y-2 text-xs font-mono text-slate-300">
                <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-cyan-300">1. EROS Tag</span>
                  <span className="text-slate-500">EROS.TANDEM.MOLINO1.TCH</span>
                </div>
                <div className="text-center text-slate-500">↓</div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-emerald-300">2. BioAzúcar Tag</span>
                  <span className="text-slate-500">Milling.TCH_Actual</span>
                </div>
                <div className="text-center text-slate-500">↓</div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-amber-300">3. Equipment & KPI</span>
                  <span className="text-slate-500">eq-molino-1 / TCH Molienda</span>
                </div>
                <div className="text-center text-slate-500">↓</div>
                <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                  <span className="text-purple-300">4. Historian & Alarms</span>
                  <span className="text-slate-500">Firestore TS & ISO 18436</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3 text-xs text-slate-300">
              <h4 className="text-sm font-bold text-cyan-400 flex items-center gap-2">
                <Terminal className="w-4 h-4" /> Requisitos de Despliegue en Planta
              </h4>
              <ul className="space-y-2 list-disc list-inside text-slate-400">
                <li><strong className="text-slate-200">Versión EROS:</strong> Compatible con drivers v3.x / v4.x vía OPC-UA o TCP nativo.</li>
                <li><strong className="text-slate-200">Enlace de Red:</strong> Subred industrial aislada (VLAN OT) con IP estática asignada.</li>
                <li><strong className="text-slate-200">Tabla de Direcciones:</strong> Mapeo de bloques DB de PLC (Siemens / Rockwell).</li>
                <li><strong className="text-slate-200">Seguridad:</strong> Certificado X.509 mTLS y autenticación de operador para escrituras.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT TAG */}
      {isTagModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              {editingTag ? "Editar Tag Industrial" : "Nuevo Tag Industrial"}
            </h3>
            <form onSubmit={handleSaveTag} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Nombre Descriptivo</label>
                  <input
                    type="text"
                    required
                    value={tagForm.name}
                    onChange={(e) => setTagForm({ ...tagForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Variable Canónica</label>
                  <input
                    type="text"
                    required
                    value={tagForm.variable}
                    onChange={(e) => setTagForm({ ...tagForm, variable: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Dirección OT (Address/NodeId)</label>
                  <input
                    type="text"
                    required
                    value={tagForm.address}
                    onChange={(e) => setTagForm({ ...tagForm, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Unidad de Ingeniería</label>
                  <input
                    type="text"
                    required
                    value={tagForm.unit}
                    onChange={(e) => setTagForm({ ...tagForm, unit: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Área</label>
                  <select
                    value={tagForm.area}
                    onChange={(e) => setTagForm({ ...tagForm, area: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  >
                    <option value="MOLIENDA">Molienda</option>
                    <option value="CALDERAS">Calderas</option>
                    <option value="COGENERACION">Cogeneración</option>
                    <option value="EVAPORACION">Evaporación</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Rango Min</label>
                  <input
                    type="number"
                    value={tagForm.engMin}
                    onChange={(e) => setTagForm({ ...tagForm, engMin: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Rango Max</label>
                  <input
                    type="number"
                    value={tagForm.engMax}
                    onChange={(e) => setTagForm({ ...tagForm, engMax: parseFloat(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Alarma Alta (H)</label>
                  <input
                    type="number"
                    value={tagForm.highAlarm ?? ""}
                    onChange={(e) => setTagForm({ ...tagForm, highAlarm: parseFloat(e.target.value) || undefined })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Alarma Baja (L)</label>
                  <input
                    type="number"
                    value={tagForm.lowAlarm ?? ""}
                    onChange={(e) => setTagForm({ ...tagForm, lowAlarm: parseFloat(e.target.value) || undefined })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTagModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Guardar Tag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT OT DEVICE */}
      {isOtModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">
              {editingOt ? "Editar Dispositivo OT" : "Registrar Dispositivo OT"}
            </h3>
            <form onSubmit={handleSaveOt} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Nombre Dispositivo</label>
                <input
                  type="text"
                  required
                  value={otForm.name}
                  onChange={(e) => setOtForm({ ...otForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Tipo</label>
                  <select
                    value={otForm.type}
                    onChange={(e) => setOtForm({ ...otForm, type: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  >
                    <option value="PLC">PLC (Controlador)</option>
                    <option value="GATEWAY">Gateway Edge</option>
                    <option value="OPC_UA_SERVER">Servidor OPC-UA</option>
                    <option value="MQTT_BROKER">Broker MQTT</option>
                    <option value="EROS_ADAPTER">Adaptador EROS</option>
                    <option value="MODBUS_DEVICE">Dispositivo Modbus</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Protocolo</label>
                  <select
                    value={otForm.protocol}
                    onChange={(e) => setOtForm({ ...otForm, protocol: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                  >
                    <option value="OPC-UA">OPC-UA</option>
                    <option value="MQTT-SPARKPLUG">MQTT-SPARKPLUG</option>
                    <option value="MODBUS-TCP">MODBUS-TCP</option>
                    <option value="EROS-NATIVE">EROS-NATIVE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-medium">Host / IP</label>
                  <input
                    type="text"
                    required
                    value={otForm.host}
                    onChange={(e) => setOtForm({ ...otForm, host: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-medium">Puerto</label>
                  <input
                    type="number"
                    required
                    value={otForm.port}
                    onChange={(e) => setOtForm({ ...otForm, port: parseInt(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Descripción</label>
                <input
                  type="text"
                  value={otForm.description}
                  onChange={(e) => setOtForm({ ...otForm, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsOtModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold"
                >
                  Guardar Dispositivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATA LINEAGE MODAL */}
      <DataLineageModal lineage={selectedLineage} onClose={() => setSelectedLineage(null)} />
    </div>
  );
};
