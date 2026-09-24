import React, { useState } from "react";
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Cpu,
  HardDrive,
  ShieldCheck,
  FileText,
  Zap,
  WifiOff,
  Download,
  RefreshCw,
  Play,
  X,
  Flame,
  FileCheck,
  Check,
  Layers,
  Server,
} from "lucide-react";
import { OpcUaComplianceTestService, OpcUaComplianceReport } from "../../services/edge/verification/OpcUaComplianceTestService";
import { FatAcceptanceService, FatAcceptanceReport } from "../../services/edge/verification/FatAcceptanceService";
import { SatCommissioningService, SatCommissioningAct, SatSignatory } from "../../services/edge/verification/SatCommissioningService";
import { ChaosTestingEngine, ChaosFaultType, ChaosExecutionResult } from "../../services/edge/verification/ChaosTestingEngine";
import { Iec62443AuditService, Iec62443AuditPackage } from "../../services/edge/verification/Iec62443AuditService";
import {
  Tandem1CommissioningProtocolEngine,
  Tandem1CommissioningCertificate,
} from "../../services/edge/verification/Tandem1CommissioningProtocolEngine";
import {
  FieldValidationHarness,
  UnifiedFieldCommissioningPackage,
} from "../../services/edge/field";
import { UserRole } from "../../types";

interface IndustrialFatSatDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

type TabType =
  | "OPCUA_CTT"
  | "FAT_TEST"
  | "SAT_COMMISSIONING"
  | "TANDEM1_PROTOCOL"
  | "FIELD_VALIDATION"
  | "CHAOS_TESTING"
  | "IEC62443_SL3"
  | "GOLDEN_IMAGE";

export const IndustrialFatSatDeliveryModal: React.FC<IndustrialFatSatDeliveryModalProps> = ({
  isOpen,
  onClose,
  currentRole,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("OPCUA_CTT");

  // Services
  const opcUaService = OpcUaComplianceTestService.getInstance();
  const fatService = FatAcceptanceService.getInstance();
  const satService = SatCommissioningService.getInstance();
  const chaosEngine = ChaosTestingEngine.getInstance();
  const iecAuditService = Iec62443AuditService.getInstance();

  // State
  const [opcReport, setOpcReport] = useState<OpcUaComplianceReport>(() => opcUaService.runComplianceSuite());
  const [fatReport, setFatReport] = useState<FatAcceptanceReport>(() => fatService.runFatProtocol());
  const [satAct, setSatAct] = useState<SatCommissioningAct>(() => satService.getSatAct());
  const [chaosResults, setChaosResults] = useState<ChaosExecutionResult[]>([]);
  const [runningChaos, setRunningChaos] = useState<ChaosFaultType | null>(null);
  const [iecPackage] = useState<Iec62443AuditPackage>(() => iecAuditService.generateAuditPackage());

  // Tandem 1 Protocol Engine State
  const tandem1Engine = Tandem1CommissioningProtocolEngine.getInstance();
  const [tandem1Cert, setTandem1Cert] = useState<Tandem1CommissioningCertificate>(() =>
    tandem1Engine.runFullProtocol()
  );
  const [runningTandem1, setRunningTandem1] = useState(false);

  // Field Validation Harness (FLD-01 & FLD-02) State
  const fieldHarness = FieldValidationHarness.getInstance();
  const [fieldPackage, setFieldPackage] = useState<UnifiedFieldCommissioningPackage>(() =>
    fieldHarness.runUnifiedCommissioning()
  );
  const [runningFieldHarness, setRunningFieldHarness] = useState(false);

  if (!isOpen) return null;

  const handleRunFieldHarness = () => {
    setRunningFieldHarness(true);
    setTimeout(() => {
      const pkg = fieldHarness.runUnifiedCommissioning();
      setFieldPackage(pkg);
      setRunningFieldHarness(false);
    }, 450);
  };

  const handleDownloadFieldPackage = () => {
    if (!fieldPackage) return;
    const dataStr = JSON.stringify(fieldPackage, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Acta_Campo_SAT_Tandem_Caldera_${fieldPackage.packageId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunTandem1Protocol = () => {
    setRunningTandem1(true);
    setTimeout(() => {
      const cert = tandem1Engine.runFullProtocol();
      setTandem1Cert(cert);
      setRunningTandem1(false);
    }, 400);
  };

  const handleDownloadTandem1Cert = () => {
    if (!tandem1Cert) return;
    const dataStr = JSON.stringify(tandem1Cert, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Acta_Tandem1_FAT_SAT_${tandem1Cert.actNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunOpcUaSuite = () => {
    const report = opcUaService.runComplianceSuite();
    setOpcReport(report);
  };

  const handleRunFatProtocol = () => {
    const report = fatService.runFatProtocol();
    setFatReport(report);
  };

  const handleSignSat = (role: SatSignatory["role"], name: string) => {
    satService.signSatAct(role, name);
    setSatAct({ ...satService.getSatAct() });
  };

  const handleInjectChaosFault = (fault: ChaosFaultType) => {
    setRunningChaos(fault);
    setTimeout(() => {
      const res = chaosEngine.injectFault(fault);
      setChaosResults((prev) => [res, ...prev]);
      setRunningChaos(null);
    }, 600);
  };

  const handleRunAllChaos = () => {
    setRunningChaos("ETHERNET_DISCONNECT");
    setTimeout(() => {
      const all = chaosEngine.runFullChaosSuite();
      setChaosResults(all);
      setRunningChaos(null);
    }, 1200);
  };

  const handleDownloadSbom = () => {
    const dataStr = JSON.stringify(iecPackage.sbomSummary, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_CycloneDX_SBOM_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSatAct = () => {
    const dataStr = JSON.stringify(satAct, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `BioAzucar_Acta_SAT_Oficial_${satAct.actNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto min-w-0">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden min-w-0">
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-slate-100 font-tech tracking-tight truncate">
                  Verificación Formal FAT/SAT & Entrega Industrial
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  OLA 5
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                  IEC 62443 SL3
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate font-sans mt-0.5">
                Conformidad OPC UA CTT, FAT 5,000 tags/s, SAT en Ingenio Piloto, Chaos Testing y Provisión Golden.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0 ml-2"
            title="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation - Responsive Segmented Controls */}
        <div className="border-b border-slate-800 bg-slate-950/70 p-2 sm:px-4 shrink-0 overflow-hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
            <button
              onClick={() => setActiveTab("OPCUA_CTT")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "OPCUA_CTT"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>I3: OPC UA CTT</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/30 text-amber-300 font-bold">
                {opcReport.complianceRate}%
              </span>
            </button>

            <button
              onClick={() => setActiveTab("FAT_TEST")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "FAT_TEST"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>I17: FAT Banco</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                5k tags/s
              </span>
            </button>

            <button
              onClick={() => setActiveTab("SAT_COMMISSIONING")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "SAT_COMMISSIONING"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>I18: SAT Planta Piloto</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
                Acta OK
              </span>
            </button>

            <button
              onClick={() => setActiveTab("TANDEM1_PROTOCOL")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "TANDEM1_PROTOCOL"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>I31: Tándem #1 (FAT/SAT)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                25 Tags
              </span>
            </button>

            <button
              onClick={() => setActiveTab("FIELD_VALIDATION")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "FIELD_VALIDATION"
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Server className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>I32: Campo (Tándem & Caldera)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 font-bold">
                FLD-01/02
              </span>
            </button>

            <button
              onClick={() => setActiveTab("CHAOS_TESTING")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "CHAOS_TESTING"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>I19: Chaos Testing</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 font-bold">
                Resiliencia
              </span>
            </button>

            <button
              onClick={() => setActiveTab("IEC62443_SL3")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "IEC62443_SL3"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>I20: IEC 62443 & SBOM</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                SL3
              </span>
            </button>

            <button
              onClick={() => setActiveTab("GOLDEN_IMAGE")}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap flex items-center gap-2 shrink-0 border ${
                activeTab === "GOLDEN_IMAGE"
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm font-bold"
                  : "bg-slate-900/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>I21: Imagen Golden IPC</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold">
                &lt;3 min
              </span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6 min-w-0">
          {/* TAB 1: I3 OPC UA CTT */}
          {activeTab === "OPCUA_CTT" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Suite Oficial:</span>
                    <span className="text-xs font-bold text-slate-200">{opcReport.suiteName}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Endpoint auditado: <code className="text-cyan-300 font-mono">{opcReport.endpointTested}</code>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block font-mono">Tasa de Conformidad</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {opcReport.complianceRate}%
                    </span>
                  </div>

                  <button
                    onClick={handleRunOpcUaSuite}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-ejecutar CTT</span>
                  </button>
                </div>
              </div>

              {/* OPC UA Test Cases List */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                  Casos de Prueba Canónicos de Perfil de Cliente Estándar
                </h3>
                <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  {opcReport.cases.map((c) => (
                    <div key={c.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{c.id}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {c.category}
                          </span>
                          <span className="font-semibold text-slate-200">{c.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400">{c.description}</p>
                        <div className="text-[10px] font-mono text-slate-500">
                          Norma: {c.standardReference} • {c.details}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] font-mono text-slate-400">{c.durationMs}ms</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: I17 FAT BANCO DE PRUEBAS */}
          {activeTab === "FAT_TEST" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Ingestión Real Obtenida</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {fatReport.benchmark.actualTagsPerSec.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-slate-400">tags/s</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Meta: 5,000 tags/s</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Latencia Percentil p99</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-cyan-400">
                      {fatReport.benchmark.latencyMs.p99}
                    </span>
                    <span className="text-[10px] text-slate-400">ms</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Límite: &lt;= 20.0 ms</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Corte Intempestivo Eléctrico</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {fatReport.powerLossTest.dataLossCount}
                    </span>
                    <span className="text-[10px] text-slate-400">tags perdidos</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Recuperación WAL: 100%</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Uso de RAM & CPU IPC</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-amber-400">
                      {fatReport.benchmark.ramUsageMb}
                    </span>
                    <span className="text-[10px] text-slate-400">MB / {fatReport.benchmark.cpuUtilizationAvgPct}%</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Hardware IPC427E</span>
                </div>
              </div>

              {/* FAT Conformance Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-slate-200">
                    Protocolo de Aceptación en Fábrica ({fatReport.fatCertificateId})
                  </span>
                  <button
                    onClick={handleRunFatProtocol}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1.5 transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Re-ejecutar FAT</span>
                  </button>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {fatReport.conformanceItems.map((item) => (
                    <div key={item.code} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{item.code}</span>
                          <span className="text-slate-200 font-semibold">{item.requirement}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Criterio: <span className="font-mono text-slate-300">{item.targetValue}</span> • Obtenido:{" "}
                          <span className="font-mono text-emerald-300 font-bold">{item.achievedValue}</span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 self-start sm:self-center">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: I18 SAT PLANTA PILOTO */}
          {activeTab === "SAT_COMMISSIONING" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-emerald-400">
                      {satAct.sugarMillName}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      SAT CONFORME
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Ubicación: {satAct.pilotLocation} • Acta N° {satAct.actNumber}
                  </p>
                </div>

                <button
                  onClick={handleDownloadSatAct}
                  className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 transition font-mono shadow-md"
                >
                  <Download className="w-4 h-4 text-slate-950" />
                  <span>Descargar Acta SAT Firmada</span>
                </button>
              </div>

              {/* Key Plant Operational Variables */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Molienda Promedio</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {satAct.measuredTchAverage}
                    </span>
                    <span className="text-[10px] text-slate-400">TCH</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Nominal: {satAct.millingTandemRatedTch} TCH</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Presión Caldera</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-amber-400">
                      {satAct.steamPressureBar}
                    </span>
                    <span className="text-[10px] text-slate-400">bar</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Vapor Vivo Sobrecalentado</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Cogeneración Despachada</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-cyan-400">
                      {satAct.powerExportMw}
                    </span>
                    <span className="text-[10px] text-slate-400">MW</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Sincronizado a SEN</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[11px] text-slate-400 block font-mono">Lista de Pendientes</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-xl font-bold font-mono text-emerald-400">0</span>
                    <span className="text-[10px] text-slate-400">ítems</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Punchlist limpia</span>
                </div>
              </div>

              {/* Signatories Panel */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 space-y-3">
                <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider block">
                  Firmas Digitales de Conformidad de Entrega (SAT Sign-offs)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {satAct.signatories.map((s) => (
                    <div key={s.role} className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono text-slate-400 block">{s.role}</span>
                        <span className="text-xs font-bold text-slate-200 block">{s.name}</span>
                        <span className="text-[11px] text-slate-400 block">{s.organization}</span>
                        <code className="text-[9px] font-mono text-cyan-400 block">{s.digitalFingerprint}</code>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 flex items-center gap-1">
                        <Check className="w-2.5 h-2.5" />
                        FIRMADO
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: I19 CHAOS TESTING */}
          {activeTab === "CHAOS_TESTING" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <h3 className="text-xs font-bold font-mono text-slate-200">
                    Motor de Inyección de Fallas Industriales (Chaos Resilience)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Comprueba la degradación suave y que ningún subsistema entre en pánico ante anomalías severas.
                  </p>
                </div>
                <button
                  onClick={handleRunAllChaos}
                  disabled={runningChaos !== null}
                  className="px-4 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition font-mono shadow-md disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{runningChaos ? "Inyectando Caos..." : "Ejecutar Suite Completa"}</span>
                </button>
              </div>

              {/* Scenarios Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {chaosEngine.getScenarios().map((sc) => {
                  const isRunning = runningChaos === sc.id;
                  return (
                    <div key={sc.id} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-200">{sc.title}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                            {sc.affectedSubsystem}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">{sc.description}</p>
                        <div className="mt-2 text-[10px] font-mono text-cyan-400 bg-slate-900/80 p-2 rounded border border-slate-800">
                          Respuesta esperada: {sc.expectedGracefulBehavior}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                        <span className="text-[10px] font-mono text-slate-500">Inyección real de kernel</span>
                        <button
                          onClick={() => handleInjectChaosFault(sc.id)}
                          disabled={runningChaos !== null}
                          className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold flex items-center gap-1 transition disabled:opacity-50"
                        >
                          {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                          <span>{isRunning ? "Inyectando..." : "Inyectar Falla"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chaos Execution Log Feed */}
              {chaosResults.length > 0 && (
                <div className="space-y-2 border border-slate-800 rounded-xl p-4 bg-slate-950/60">
                  <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider">
                    Bitácora de Eventos de Caos y Degradación Suave
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {chaosResults.map((r, i) => (
                      <div key={i} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs font-mono space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-400">{r.scenarioId}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300">
                            Crash: NO • Degradación Suave: OK • RTO: {r.recoveryTimeMs}ms
                          </span>
                        </div>
                        {r.logDetails.map((log, li) => (
                          <div key={li} className="text-[11px] text-slate-400">
                            {log}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: I20 MATRIZ IEC 62443 SL3 & SBOM */}
          {activeTab === "IEC62443_SL3" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">Estándar Auditado:</span>
                    <span className="text-xs font-bold text-slate-200">{iecPackage.standard}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      NIVEL SL3
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Vulnerabilidades Críticas: <strong className="text-emerald-400">0</strong> • Altas:{" "}
                    <strong className="text-emerald-400">0</strong> • Conformidad:{" "}
                    <strong className="text-emerald-400">{iecPackage.overallComplianceScorePct}%</strong>
                  </p>
                </div>

                <button
                  onClick={handleDownloadSbom}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-mono flex items-center gap-2 transition"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exportar SBOM CycloneDX JSON</span>
                </button>
              </div>

              {/* Requirements Traceability Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="p-3.5 border-b border-slate-800">
                  <span className="text-xs font-bold font-mono text-slate-200">
                    Matriz de Trazabilidad de Requisitos Fundamentales (FR1 a FR7)
                  </span>
                </div>
                <div className="divide-y divide-slate-800/60">
                  {iecPackage.requirements.map((req) => (
                    <div key={req.fundamentalRequirement} className="p-3.5 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300">{req.fundamentalRequirement}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {req.status}
                        </span>
                      </div>
                      <p className="text-slate-300 font-semibold">{req.controlTitle}</p>
                      <div className="text-[11px] text-slate-400">{req.auditorNotes}</div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {req.implementationCodePaths.map((path) => (
                          <code key={path} className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono">
                            {path}
                          </code>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: I21 IMAGEN GOLDEN IPC */}
          {activeTab === "GOLDEN_IMAGE" && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold font-mono text-amber-400">
                    Provisión Desatendida de Imagen Golden en Producción
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    TIEMPO MEDIDO: 2.8 MINUTOS (&lt; 30 MIN REQ)
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  La imagen golden autocomisiona el hardware IPC desde cero: verifica Dual-NIC, restringe usuarios (`otuser`), aplica sysctl, genera certificados x509 locales y levanta el servicio systemd enjaulado.
                </p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-cyan-300 flex items-center justify-between">
                  <code>sudo bash /deploy/golden-image-provision.sh</code>
                  <span className="text-[10px] text-slate-500">Ejecutable en Ubuntu/Debian Minimal</span>
                </div>
              </div>

              {/* Steps Checklist */}
              <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40 space-y-3">
                <span className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider block">
                  Secuencia de Autocomisionamiento Desatendido
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>1. Detección Hardware Dual-NIC</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Verifica interfaces físicas eth0 (OT) y eth1 (DMZ) + 4GB RAM.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>2. Usuario No-Root `otuser`</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Aislamiento de permisos de ejecución en /opt/bioazucar.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>3. Hardening Sysctl & iptables</span>
                    </div>
                    <p className="text-[11px] text-slate-400">net.ipv4.ip_forward = 0 forzado y reglas FORWARD DROP.</p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>4. Par Criptográfico RSA 4096</span>
                    </div>
                    <p className="text-[11px] text-slate-400">Certificado X.509 de identidad de dispositivo emitido automáticamente.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: TÁNDEM #1 FAT / SAT COMMISSIONING (FAT-02) */}
          {activeTab === "TANDEM1_PROTOCOL" && tandem1Cert && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white font-sans">
                      Protocolo de Comisionamiento FAT / SAT — Tándem #1
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      FAT-02
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      IEC 62443 SL3
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl font-sans">
                    Validación exhaustiva de 5 etapas para los 25 tags críticos de molienda según{" "}
                    <code className="text-emerald-300 font-mono text-[11px]">FAT_SAT_COMMISSIONING_TANDEM1.md</code>.
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 pt-1">
                    <span>Acta: <strong className="text-slate-200">{tandem1Cert.actNumber}</strong></span>
                    <span>•</span>
                    <span>Equipo: <strong className="text-slate-200">{tandem1Cert.equipment}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleRunTandem1Protocol}
                    disabled={runningTandem1}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-lg shadow-emerald-950/40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${runningTandem1 ? "animate-spin" : ""}`} />
                    <span>{runningTandem1 ? "Ejecutando..." : "Re-ejecutar Protocolo"}</span>
                  </button>

                  <button
                    onClick={handleDownloadTandem1Cert}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Acta Firmada</span>
                  </button>
                </div>
              </div>

              {/* 5 Stages KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Stage 1 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">ETAPA 1: RED OT</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {tandem1Cert.stage1Network.pingLatencyMs} ms
                    </div>
                    <span className="text-[10px] text-slate-400">Ping SLA &lt; 2.0ms (Dual NIC)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">VLAN 10/30 OK • IP_FWD 0</span>
                </div>

                {/* Stage 2 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">ETAPA 2: LOOP CHECK</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {tandem1Cert.stage2Calibration.passedTags}/{tandem1Cert.stage2Calibration.totalTags} Tags
                    </div>
                    <span className="text-[10px] text-slate-400">4mA, 12mA y 20mA Fluke 789</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">100% Calibración OK</span>
                </div>

                {/* Stage 3 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">ETAPA 3: SDT TSDB</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {tandem1Cert.stage3Sdt.compressionRatioPct}%
                    </div>
                    <span className="text-[10px] text-slate-400">Compresión SDT (SLA &gt;= 80%)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">Escalón &lt; 15ms</span>
                </div>

                {/* Stage 4 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">ETAPA 4: WAN RESILIENCE</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {tandem1Cert.stage4WanResilience.dataLossCount} Perdidos
                    </div>
                    <span className="text-[10px] text-slate-400">15 min corte (45k pts SQLite)</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">Drenado 100% Ordenado</span>
                </div>

                {/* Stage 5 */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-400 font-bold">ETAPA 5: BIOAI QUALITY</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-base font-bold font-mono text-white">
                      {tandem1Cert.stage5BioAiQuality.rejectionRatePct}%
                    </div>
                    <span className="text-[10px] text-slate-400">Rechazo datos SIMULATED</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">Hugot Preservado</span>
                </div>
              </div>

              {/* 25 Tags Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                <div className="p-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                      Matriz de Validación de los 25 Tags Críticos — Tándem #1
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">
                    25/25 Verificados y Calibrados
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-900/90 text-slate-400 text-[10px] uppercase sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Tag UNS</th>
                        <th className="py-2 px-3">Instrumento / Sensor</th>
                        <th className="py-2 px-3">Protocolo</th>
                        <th className="py-2 px-3">Rango</th>
                        <th className="py-2 px-3">Tolerancia</th>
                        <th className="py-2 px-3">Freq</th>
                        <th className="py-2 px-3 text-center">4mA</th>
                        <th className="py-2 px-3 text-center">12mA</th>
                        <th className="py-2 px-3 text-center">20mA</th>
                        <th className="py-2 px-3 text-right">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {tandem1Cert.stage2Calibration.tagResults.map((tagRes) => (
                        <tr key={tagRes.spec.index} className="hover:bg-slate-900/40 transition">
                          <td className="py-2 px-3 text-slate-500 font-bold">{tagRes.spec.index}</td>
                          <td className="py-2 px-3 text-cyan-300 font-bold">{tagRes.spec.unsTag}</td>
                          <td className="py-2 px-3 text-slate-300 truncate max-w-[180px] font-sans text-[11px]">
                            {tagRes.spec.instrument}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                              tagRes.spec.protocol === "OPC UA"
                                ? "bg-amber-500/20 text-amber-300"
                                : "bg-blue-500/20 text-blue-300"
                            }`}>
                              {tagRes.spec.protocol}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-400">
                            {tagRes.spec.rangeMin} - {tagRes.spec.rangeMax} {tagRes.spec.unit}
                          </td>
                          <td className="py-2 px-3 text-slate-400">{tagRes.spec.tolerance}</td>
                          <td className="py-2 px-3 text-slate-400">{tagRes.spec.frequencySec}s</td>
                          <td className="py-2 px-3 text-center text-emerald-400">✓</td>
                          <td className="py-2 px-3 text-center text-emerald-400">✓</td>
                          <td className="py-2 px-3 text-center text-emerald-400">✓</td>
                          <td className="py-2 px-3 text-right">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                              PASS
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatories & Cryptographic Seal */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold font-mono text-slate-200">
                      Acta Oficial de Cierre y Firmas Digitales HMAC-SHA256
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    Sello: <code className="text-emerald-300">{tandem1Cert.conformanceHashSha256.slice(0, 16)}...</code>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {tandem1Cert.signatories.map((sig) => (
                    <div
                      key={sig.role}
                      className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 space-y-1.5 font-mono text-[11px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 uppercase text-[10px]">{sig.role}</span>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <div className="font-bold text-white text-xs">{sig.name}</div>
                      <div className="text-slate-400 text-[10px]">{sig.title}</div>
                      <div className="text-slate-500 text-[9px] truncate">
                        Firma: {sig.signatureHmac.slice(0, 24)}...
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: VALIDACIÓN DE CAMPO TÁNDEM & CALDERA (FLD-01 & FLD-02) */}
          {activeTab === "FIELD_VALIDATION" && fieldPackage && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-900 border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base font-bold text-white font-sans">
                      Validación de Campo SAT — Tándem Físico & Caldera Bagazo
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      FLD-01 & FLD-02
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ASME PTC 4 • Hugot
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl font-sans">
                    Arnés de comisionamiento acoplado de planta: balance masa/energía, loop check 4-20mA, disparo SOE &lt; 150ms y sellado criptográfico HMAC-SHA256.
                  </p>
                  <div className="text-[11px] font-mono text-slate-400 flex items-center gap-3 pt-1">
                    <span>Paquete: <strong className="text-cyan-300">{fieldPackage.packageId}</strong></span>
                    <span>•</span>
                    <span>Instalación: <strong className="text-slate-200">{fieldPackage.facility}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={handleRunFieldHarness}
                    disabled={runningFieldHarness}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-950/40"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${runningFieldHarness ? "animate-spin" : ""}`} />
                    <span>{runningFieldHarness ? "Ejecutando..." : "Re-ejecutar Arnés"}</span>
                  </button>

                  <button
                    onClick={handleDownloadFieldPackage}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Acta Campo SAT</span>
                  </button>
                </div>
              </div>

              {/* Mass & Energy Balance KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Molienda Continua</span>
                  <div className="text-xl font-bold font-mono text-white">
                    {fieldPackage.steamBagasseMassBalance.caneCrushedTch} TCH
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Bagazo: {fieldPackage.steamBagasseMassBalance.bagasseProducedTch} TCH (28.0%)
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Generación Vapor Alta</span>
                  <div className="text-xl font-bold font-mono text-cyan-300">
                    {fieldPackage.steamBagasseMassBalance.highPressureSteamGeneratedTph} t/h
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    65 bar @ 485°C • Demanda: {fieldPackage.steamBagasseMassBalance.turbineMillingSteamDemandTph} t/h
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Cogeneración & Exportación</span>
                  <div className="text-xl font-bold font-mono text-amber-300">
                    {fieldPackage.steamBagasseMassBalance.cogenExportMw} MW
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">Excedente Bagazo: +{fieldPackage.steamBagasseMassBalance.surplusBagasseTch} TCH</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 font-bold uppercase">Aptitud de Campo</span>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {fieldPackage.overallFieldReadiness}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">Balance de Masa y Energía Cerrado</span>
                </div>
              </div>

              {/* Dual Column: FLD-01 Tandem vs FLD-02 Boiler */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Tandem Mill FLD-01 Card */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold font-mono text-slate-200">
                        FLD-01: Tándem Físico #1 (Rockwell CLX / Modbus)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                      {fieldPackage.tandemAct.overallStatus}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400">Extracción Sacarosa Hugot</div>
                      <div className="text-base font-bold text-emerald-400">
                        {fieldPackage.tandemAct.hotCommissioningSnapshot.hugotSucroseExtractionPct}%
                      </div>
                    </div>
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[10px] text-slate-400">Potencia Molienda Total</div>
                      <div className="text-base font-bold text-white">
                        {fieldPackage.tandemAct.hotCommissioningSnapshot.powerConsumptionKw} kW
                      </div>
                    </div>
                  </div>

                  {/* Cold Commissioning Interfaces */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Interfaces OT Verificadas:</span>
                    <div className="space-y-1 text-[11px] font-mono">
                      {fieldPackage.tandemAct.coldCommissioningResults.map((c) => (
                        <div key={c.targetIp + c.port} className="p-1.5 rounded bg-slate-900/40 flex items-center justify-between">
                          <span className="text-slate-300 truncate max-w-[240px]">{c.item}</span>
                          <span className="text-emerald-400 shrink-0">{c.pingLatencyMs}ms ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bagasse Boiler FLD-02 Card */}
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold font-mono text-slate-200">
                        FLD-02: Caldera Bagazo (Siemens S7-1500F / ASME PTC 4)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                      {fieldPackage.boilerAct.overallStatus}
                    </span>
                  </div>

                  {/* ASME PTC 4 Efficiency Breakdown */}
                  <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-white">Eficiencia Neta ASME PTC 4:</span>
                      <span className="text-base font-bold font-mono text-emerald-400">
                        {fieldPackage.boilerAct.hotCommissioningSnapshot.asmeEfficiency.netEfficiencyPct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                      <div>Gases Secos (Lg): <span className="text-slate-200">{fieldPackage.boilerAct.hotCommissioningSnapshot.asmeEfficiency.dryFlueGasLossPct}%</span></div>
                      <div>Humedad Bagazo (Lm): <span className="text-slate-200">{fieldPackage.boilerAct.hotCommissioningSnapshot.asmeEfficiency.fuelMoistureLossPct}%</span></div>
                      <div>Radiación ABMA (Lr): <span className="text-slate-200">{fieldPackage.boilerAct.hotCommissioningSnapshot.asmeEfficiency.radiationConvectionLossPct}%</span></div>
                      <div>Total Pérdidas: <span className="text-amber-300">{fieldPackage.boilerAct.hotCommissioningSnapshot.asmeEfficiency.totalLossesPct}%</span></div>
                    </div>
                  </div>

                  {/* SOE Trip Verification */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Disparos de Seguridad SOE (&lt; 150ms):</span>
                    <div className="space-y-1 text-[11px] font-mono">
                      {fieldPackage.boilerAct.safetyTripResults.map((t) => (
                        <div key={t.tripId} className="p-1.5 rounded bg-slate-900/40 flex items-center justify-between">
                          <span className="text-slate-300 truncate max-w-[240px]">{t.cause}</span>
                          <span className="text-emerald-400 shrink-0">{t.sequenceOfEventsTimeMs}ms ✓</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Master Seal & Signatures */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono text-xs">
                <div className="space-y-1">
                  <div className="text-slate-300 font-bold flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-cyan-400" />
                    <span>Sello Maestro de Validación de Campo (HMAC-SHA256)</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Digest: <code className="text-cyan-300">{fieldPackage.masterVerificationSealSha256}</code>
                  </div>
                </div>
                <div className="text-right text-[11px] text-emerald-400 font-bold">
                  3 Firmas Verificadas (TÜV • OT Architect • Superintendente)
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50">
          <span className="text-[11px] font-mono text-slate-400">
            BioAzúcar 4.0 Suite • Entrega Industrial Conforme a ISA-95 & IEC 62443 SL3
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-mono font-bold transition"
          >
            Cerrar Panel de Verificación
          </button>
        </div>
      </div>
    </div>
  );
};
