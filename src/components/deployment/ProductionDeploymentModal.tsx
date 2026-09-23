import React, { useState, useEffect } from "react";
import {
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  HardDrive,
  Database,
  Terminal,
  Download,
  FileCheck,
  ArrowDownCircle,
  Cpu,
  Radio,
  Clock,
  X,
  Layers,
  Archive,
  Play
} from "lucide-react";

interface HealthGate {
  component: string;
  status: "HEALTHY" | "DEGRADED" | "FAILED";
  latencyMs: number;
  details: string;
}

interface PreflightCheck {
  id: string;
  name: string;
  category: string;
  status: "PASS" | "WARN" | "FAIL";
  message: string;
}

interface MigrationItem {
  version: string;
  name: string;
  checksum: string;
  appliedAt?: string;
  rollbackSupported: boolean;
}

interface ProductionDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductionDeploymentModal: React.FC<ProductionDeploymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"health" | "preflight" | "migrations" | "backup" | "offline" | "diagnostics">("health");
  const [loading, setLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Data states
  const [healthData, setHealthData] = useState<{ overallStatus: string; exitCode: number; gates: HealthGate[] } | null>(null);
  const [preflightData, setPreflightData] = useState<{ overallStatus: string; passedCount: number; warnCount: number; failCount: number; checks: PreflightCheck[] } | null>(null);
  const [migrationsData, setMigrationsData] = useState<{ currentVersion: string | null; appliedCount: number; pendingCount: number; applied: MigrationItem[]; pending: MigrationItem[] } | null>(null);
  const [backupResult, setBackupResult] = useState<any | null>(null);
  const [offlineData, setOfflineData] = useState<any | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadHealthGates();
      loadMigrations();
    }
  }, [isOpen]);

  const loadHealthGates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deployment/health-gates");
      const data = await res.json();
      setHealthData(data);
    } catch {
      setStatusMessage("Error querying health gates.");
    } finally {
      setLoading(false);
    }
  };

  const loadPreflight = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deployment/preflight");
      const data = await res.json();
      setPreflightData(data);
    } catch {
      setStatusMessage("Error running preflight check.");
    } finally {
      setLoading(false);
    }
  };

  const loadMigrations = async () => {
    try {
      const res = await fetch("/api/deployment/migrations");
      const data = await res.json();
      setMigrationsData(data);
    } catch {
      // Ignored
    }
  };

  const triggerBackup = async () => {
    setLoading(true);
    setStatusMessage("Executing atomic SQLite WAL checkpoint and archiving...");
    try {
      const res = await fetch("/api/deployment/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "ui-console" }),
      });
      const data = await res.json();
      setBackupResult(data);
      setStatusMessage(`Backup completed successfully: ${data.backupId}`);
    } catch (err: any) {
      setStatusMessage(`Backup error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineBundle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deployment/offline-bundle");
      const data = await res.json();
      setOfflineData(data);
    } catch {
      setStatusMessage("Error loading offline bundle manifest.");
    } finally {
      setLoading(false);
    }
  };

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deployment/diagnostics");
      const data = await res.json();
      setDiagnosticData(data);
    } catch {
      setStatusMessage("Error gathering diagnostics.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100 font-sans">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                  BioAzúcar 4.0 — Master Deployment & Recovery Engine
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  P0-26 PRODUCTION
                </span>
              </div>
              <p className="text-xs text-slate-400">
                IEC 62443 SL3 & ISA-95 Level 2/3 Orchestration, Deterministic Schema & Disaster Recovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-mono">
          <button
            onClick={() => { setActiveTab("health"); loadHealthGates(); }}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "health"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Health Gates (Exit Codes)
          </button>

          <button
            onClick={() => { setActiveTab("preflight"); loadPreflight(); }}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "preflight"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-4 h-4" />
            Preflight Validator
          </button>

          <button
            onClick={() => { setActiveTab("migrations"); loadMigrations(); }}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "migrations"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Database className="w-4 h-4" />
            Schema Migrations ({migrationsData?.currentVersion || "003"})
          </button>

          <button
            onClick={() => setActiveTab("backup")}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "backup"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Archive className="w-4 h-4" />
            Disaster Recovery & Snapshots
          </button>

          <button
            onClick={() => { setActiveTab("offline"); loadOfflineBundle(); }}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "offline"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Air-Gapped / Offline Bundle
          </button>

          <button
            onClick={() => { setActiveTab("diagnostics"); loadDiagnostics(); }}
            className={`py-3 px-3 border-b-2 font-medium flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "diagnostics"
                ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            SRE Diagnostics
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {statusMessage && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center justify-between">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage(null)} className="text-emerald-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* TAB 1: HEALTH GATES */}
          {activeTab === "health" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">System Operational Health Gates</h3>
                  <p className="text-xs text-slate-400">Continuous watchdog monitoring SCADA core, SQLite WAL, Edge SAF, and MQTT routes.</p>
                </div>
                <button
                  onClick={loadHealthGates}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Re-evaluate Gates
                </button>
              </div>

              {healthData && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-400">OVERALL STATUS</span>
                    <div className="flex items-center gap-2 mt-1">
                      {healthData.overallStatus === "HEALTHY" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : healthData.overallStatus === "DEGRADED" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400" />
                      )}
                      <span className="text-lg font-mono font-bold text-white">{healthData.overallStatus}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-400">PROCESS EXIT CODE</span>
                    <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                      {healthData.exitCode} {healthData.exitCode === 0 ? "(0 = HEALTHY)" : "(NON-ZERO)"}
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-[10px] font-mono text-slate-400">ACTIVE GATES</span>
                    <div className="text-lg font-mono font-bold text-white mt-1">
                      {healthData.gates.length} Evaluated
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {healthData?.gates.map((g, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      {g.status === "HEALTHY" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : g.status === "DEGRADED" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-mono font-bold text-white">{g.component}</div>
                        <div className="text-[11px] text-slate-400">{g.details}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-mono text-[11px]">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        g.status === "HEALTHY"
                          ? "bg-emerald-950 text-emerald-300 border border-emerald-700/50"
                          : g.status === "DEGRADED"
                          ? "bg-amber-950 text-amber-300 border border-amber-700/50"
                          : "bg-rose-950 text-rose-300 border border-rose-700/50"
                      }`}>
                        {g.status}
                      </span>
                      <div className="text-slate-500 mt-1">{g.latencyMs} ms</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PREFLIGHT VALIDATOR */}
          {activeTab === "preflight" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Production Server Preflight Validation</h3>
                  <p className="text-xs text-slate-400">Checks OS, CPU architecture, RAM memory, storage permissions, and industrial ports.</p>
                </div>
                <button
                  onClick={loadPreflight}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Run Preflight
                </button>
              </div>

              {preflightData && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 font-mono text-xs">
                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-slate-500">OVERALL</span>
                    <div className="text-base font-bold text-emerald-400 mt-1">{preflightData.overallStatus}</div>
                  </div>
                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-slate-500">PASSED</span>
                    <div className="text-base font-bold text-emerald-400 mt-1">{preflightData.passedCount} checks</div>
                  </div>
                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-slate-500">WARNINGS</span>
                    <div className="text-base font-bold text-amber-400 mt-1">{preflightData.warnCount} warnings</div>
                  </div>
                  <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-lg">
                    <span className="text-slate-500">FAILURES</span>
                    <div className="text-base font-bold text-rose-400 mt-1">{preflightData.failCount} failed</div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {preflightData?.checks.map((c) => (
                  <div key={c.id} className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      {c.status === "PASS" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : c.status === "WARN" ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-mono font-bold text-white mr-2">[{c.id}] {c.name}</span>
                        <span className="text-[11px] text-slate-400">{c.message}</span>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      c.status === "PASS"
                        ? "bg-emerald-950 text-emerald-300"
                        : c.status === "WARN"
                        ? "bg-amber-950 text-amber-300"
                        : "bg-rose-950 text-rose-300"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: SCHEMA MIGRATIONS */}
          {activeTab === "migrations" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Deterministic Database Migration Ledger</h3>
                  <p className="text-xs text-slate-400">Atomic DDL schema tracking with cryptographic SHA-256 verification and rollback support.</p>
                </div>
                <div className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800/40">
                  Current Version: {migrationsData?.currentVersion || "003"}
                </div>
              </div>

              <div className="space-y-3">
                {migrationsData?.applied.map((m) => (
                  <div key={m.version} className="p-4 bg-slate-950/50 border border-slate-800 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold text-white">Migration {m.version}: {m.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300">
                          APPLIED
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">
                        {m.appliedAt ? new Date(m.appliedAt).toLocaleString() : "System Bootstrap"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>SHA-256: <code className="text-slate-300">{m.checksum.substring(0, 16)}...</code></span>
                      <span className="text-emerald-400">Rollback Supported: {m.rollbackSupported ? "YES" : "NO"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: BACKUP & RECOVERY */}
          {activeTab === "backup" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Consistent Database & Config Snapshots</h3>
                  <p className="text-xs text-slate-400">Performs PRAGMA wal_checkpoint(TRUNCATE) on SQLite, archives configs, and generates SHA-256 manifest.</p>
                </div>
                <button
                  onClick={triggerBackup}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-colors"
                >
                  <Archive className="w-4 h-4" />
                  Trigger Consistent Backup
                </button>
              </div>

              {backupResult && (
                <div className="p-4 bg-slate-950/60 border border-emerald-500/40 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Backup Generated Successfully
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-slate-300">
                    <div>
                      <span className="text-slate-500">Backup ID:</span>
                      <div className="text-white">{backupResult.backupId}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Schema Version:</span>
                      <div className="text-white">{backupResult.manifest.schemaVersion}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-slate-500">Manifest SHA-256 Checksum:</span>
                      <div className="text-emerald-400 break-all">{backupResult.manifest.integrityChecksum}</div>
                    </div>
                  </div>

                  <div className="text-xs font-mono text-slate-400">
                    <span>Archived Files ({backupResult.manifest.files.length}):</span>
                    <ul className="mt-1 space-y-1">
                      {backupResult.manifest.files.map((f: any, idx: number) => (
                        <li key={idx} className="flex justify-between text-slate-300">
                          <span>{f.relativePath}</span>
                          <span className="text-slate-500">{f.sizeBytes} bytes</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-lg text-xs space-y-2">
                <span className="font-mono font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  Disaster Recovery Automation Commands:
                </span>
                <div className="bg-slate-900 p-2.5 rounded font-mono text-[11px] text-slate-300 space-y-1">
                  <div># Windows Server Restore Command:</div>
                  <div className="text-emerald-400">.\deploy\windows\restore.ps1 -BackupPath "C:\BioAzucar\backup\bioazucar-backup-..."</div>
                  <div className="pt-2"># Linux / POSIX Restore Command:</div>
                  <div className="text-emerald-400">./deploy/scripts/restore.sh ./deploy/backup/bioazucar-backup-...</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AIR-GAPPED OFFLINE BUNDLE */}
          {activeTab === "offline" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Air-Gapped & Offline Deployment Specification</h3>
                <p className="text-xs text-slate-400">Self-contained production package with signed container images and offline scripts.</p>
              </div>

              {offlineData?.manifest && (
                <div className="space-y-3 font-mono text-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                      <span className="text-slate-500">PRODUCT</span>
                      <div className="text-white font-bold">{offlineData.manifest.product}</div>
                    </div>
                    <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                      <span className="text-slate-500">RELEASE</span>
                      <div className="text-emerald-400 font-bold">{offlineData.manifest.release}</div>
                    </div>
                    <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                      <span className="text-slate-500">SCHEMA</span>
                      <div className="text-white font-bold">{offlineData.manifest.schemaVersion}</div>
                    </div>
                    <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                      <span className="text-slate-500">ROLLBACK</span>
                      <div className="text-emerald-400 font-bold">{offlineData.manifest.rollbackSupported ? "SUPPORTED" : "NO"}</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-slate-400 font-bold">Container Images Included:</span>
                    {offlineData.manifest.images.map((img: any, i: number) => (
                      <div key={i} className="p-2.5 bg-slate-950/40 border border-slate-800 rounded flex justify-between items-center text-[11px]">
                        <div>
                          <span className="text-white font-bold">{img.name}:{img.tag}</span>
                          <span className="text-slate-500 ml-2">({img.archiveFile})</span>
                        </div>
                        <span className="text-emerald-400">~{(img.sizeBytes / (1024 * 1024)).toFixed(0)} MB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: SRE DIAGNOSTICS */}
          {activeTab === "diagnostics" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">SRE Diagnostic Package & System Telemetry</h3>
                  <p className="text-xs text-slate-400">Exports sanitized system state, memory allocation, and operational metrics omitting secrets.</p>
                </div>
                <button
                  onClick={loadDiagnostics}
                  disabled={loading}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Refresh Diagnostics
                </button>
              </div>

              {diagnosticData?.system && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                    <span className="text-slate-500">HOST PLATFORM</span>
                    <div className="text-white font-bold">{diagnosticData.system.platform} ({diagnosticData.system.arch})</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                    <span className="text-slate-500">CPU CORES</span>
                    <div className="text-white font-bold">{diagnosticData.system.cpus} cores</div>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                    <span className="text-slate-500">RAM MEMORY</span>
                    <div className="text-white font-bold">
                      {((diagnosticData.system.totalMemBytes - diagnosticData.system.freeMemBytes) / 1024 / 1024 / 1024).toFixed(1)} / {(diagnosticData.system.totalMemBytes / 1024 / 1024 / 1024).toFixed(1)} GB
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-950/40 border border-slate-800 rounded">
                    <span className="text-slate-500">RUNTIME UPTIME</span>
                    <div className="text-emerald-400 font-bold">{(diagnosticData.system.uptimeSeconds / 3600).toFixed(1)} hours</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Deterministic Storage: SQLite WAL active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
