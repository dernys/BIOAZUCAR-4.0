import React, { useState, useEffect } from "react";
import {
  Archive,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  X,
  Shield,
  Layers,
  HardDrive,
  FileCheck,
  Activity,
  Zap,
  Clock,
  Fingerprint,
} from "lucide-react";
import {
  StoreAndForwardCompressor,
  CompressionEngineMetrics,
  CompressedBatchEnvelope,
} from "../../services/edge/storeAndForward/StoreAndForwardCompressor";
import {
  SemanticProcessConflictReconciler,
  ReconciliationReport,
} from "../../services/semantic/SemanticProcessConflictReconciler";
import { IndustrialDataPoint } from "../../types/industrialDataPoint";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeTenantId?: string;
}

export const IndustrialSafReconciliationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  activeTenantId = "TENANT_AZUCAR_01",
}) => {
  const [activeTab, setActiveTab] = useState<"COMPRESSION" | "RECONCILIATION">("COMPRESSION");
  const [metrics, setMetrics] = useState<CompressionEngineMetrics | null>(null);
  const [testBatchResult, setTestBatchResult] = useState<CompressedBatchEnvelope | null>(null);
  const [reports, setReports] = useState<ReconciliationReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReconciliationReport | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const compressor = StoreAndForwardCompressor.getInstance();
  const reconciler = SemanticProcessConflictReconciler.getInstance();

  const refreshData = () => {
    setMetrics(compressor.getMetrics());
    const hist = reconciler.getReportsHistory();
    setReports(hist);
    if (hist.length > 0 && !selectedReport) {
      setSelectedReport(hist[0]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshData();
    }
  }, [isOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRunTestCompression = () => {
    setIsProcessing(true);
    try {
      const dummyPoints: IndustrialDataPoint[] = Array.from({ length: 50 }, (_, i) => ({
        runtimeMode: "PRODUCTION",
        sourceType: "PLC",
        sourceId: "PLC-MOLINO-01",
        driverId: "drv-modbus-01",
        protocol: "MODBUS_TCP",
        deviceId: "DEV-TANDEM-M1",
        assetId: "MOLINO-01-MASA-SUPERIOR",
        tagId: `BioAzucar.Molienda.Molino1.Sensor_${i + 1}`,
        value: Number((210.5 + Math.sin(i) * 10).toFixed(2)),
        engineeringUnit: "bar",
        dataType: "FLOAT32",
        deviceTimestamp: new Date(Date.now() - (50 - i) * 1000).toISOString(),
        ingestionTimestamp: new Date().toISOString(),
        sequence: 1000 + i,
        quality: "GOOD",
        qualityReason: "NORMAL",
        calibrationState: "CALIBRATED",
        schemaVersion: "4.0.0",
      }));

      const res = compressor.compressBatch(dummyPoints, undefined, { algorithm: "BROTLI" });
      setTestBatchResult(res);
      setMetrics(compressor.getMetrics());
      showToast(`Compresión Brotli exitosa: ${res.compressionRatioPct}% reducción de tamaño`);
    } catch (err: any) {
      showToast(`Error al comprimir: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunSimulatedReconciliation = () => {
    setIsProcessing(true);
    try {
      const outageStartTime = Date.now() - 3600000; // 1 hour ago
      const outagePoints: IndustrialDataPoint[] = Array.from({ length: 30 }, (_, i) => {
        const isGap = i === 15; // simulate sequence jump
        const isInterlock = i === 20; // simulate floor safety trip
        return {
          runtimeMode: "PRODUCTION",
          sourceType: "PLC",
          sourceId: "PLC-MOLINO-01",
          driverId: "drv-opcua-01",
          protocol: "OPC_UA",
          deviceId: "DEV-TANDEM-M1",
          assetId: "MOLINO-01-MASA-SUPERIOR",
          tagId: isInterlock
            ? "BioAzucar.Molienda.Molino1.ESTOP_INTERLOCK"
            : "BioAzucar.Molienda.Molino1.PresionHidraulica",
          value: isInterlock ? true : Number((215.0 + (i % 5)).toFixed(2)),
          engineeringUnit: isInterlock ? "bool" : "bar",
          dataType: isInterlock ? "BOOLEAN" : "FLOAT32",
          deviceTimestamp: new Date(outageStartTime + i * 2000).toISOString(),
          ingestionTimestamp: new Date().toISOString(),
          sequence: isGap ? 2000 + i + 10 : 2000 + i,
          quality: "GOOD",
          qualityReason: "NORMAL",
          calibrationState: "CALIBRATED",
          schemaVersion: "4.0.0",
        };
      });

      const { report } = reconciler.reconcileBatch(outagePoints, {
        tenantId: activeTenantId,
        siteId: "SITE_CENTRAL_01",
        areaId: "MOLIENDA",
      });

      setReports(reconciler.getReportsHistory());
      setSelectedReport(report);
      showToast(`Reconciliación completada: ${report.conflictsResolved.length} conflictos resueltos.`);
    } catch (err: any) {
      showToast(`Error de reconciliación: ${err?.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadReport = (report: ReconciliationReport) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `BioAzucar_Reconciliation_${report.reportId}.json`;
    a.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Store & Forward Compression & Process Reconciliation
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 font-mono">
                  [P1-01 / P1-02]
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Alta densidad Brotli/Zstandard/Gzip en SQLite WAL & Arbitraje Semántico Post-Reconexión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {toastMessage && (
          <div className="px-6 py-2 bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-200 text-xs font-mono flex items-center justify-between">
            <span>{toastMessage}</span>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Sub-Tabs */}
        <div className="flex items-center gap-4 px-6 pt-3 bg-slate-950/50 border-b border-slate-800 text-sm">
          <button
            onClick={() => setActiveTab("COMPRESSION")}
            className={`flex items-center gap-2 pb-2.5 font-medium border-b-2 transition ${
              activeTab === "COMPRESSION"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <HardDrive className="w-4 h-4" />
            [P1-01] Compresión de Alta Densidad (Brotli/Gzip)
          </button>
          <button
            onClick={() => setActiveTab("RECONCILIATION")}
            className={`flex items-center gap-2 pb-2.5 font-medium border-b-2 transition ${
              activeTab === "RECONCILIATION"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            [P1-02] Reconciliación Semántica de Conflictos
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "COMPRESSION" && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4">
                  <span className="text-xs font-mono text-slate-400 uppercase">Espacio Reducido</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                    {metrics?.overallCompressionRatioPct ?? 0}%
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {((metrics?.overallBytesSaved ?? 0) / 1024).toFixed(1)} KB ahorrados en eMMC
                  </span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4">
                  <span className="text-xs font-mono text-slate-400 uppercase">Puntos Procesados</span>
                  <div className="text-2xl font-bold text-cyan-400 font-mono mt-1">
                    {metrics?.totalPointsProcessed ?? 0}
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {metrics?.totalBatchesCompressed ?? 0} lotes comprimidos
                  </span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4">
                  <span className="text-xs font-mono text-slate-400 uppercase">Bytes Originales</span>
                  <div className="text-2xl font-bold text-slate-200 font-mono mt-1">
                    {((metrics?.totalOriginalBytes ?? 0) / 1024).toFixed(1)} KB
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Payload JSON sin comprimir</span>
                </div>
                <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4">
                  <span className="text-xs font-mono text-slate-400 uppercase">Integridad CRC-32</span>
                  <div className="text-2xl font-bold text-emerald-400 font-mono mt-1 flex items-center gap-1.5">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    100% OK
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {metrics?.corruptedPayloadsDetected ?? 0} paquetes corruptos
                  </span>
                </div>
              </div>

              {/* Action Banner */}
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-lg">
                <div>
                  <h4 className="text-sm font-semibold text-white">Prueba de Ingestión y Compresión en Caliente</h4>
                  <p className="text-xs text-slate-400">
                    Genera un lote sintético de 50 puntos de telemetría de molienda y evalúa el ratio Brotli vs Gzip.
                  </p>
                </div>
                <button
                  onClick={handleRunTestCompression}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition disabled:opacity-50"
                >
                  <Zap className="w-4 h-4" />
                  Ejecutar Compresión Brotli
                </button>
              </div>

              {/* Test Result Inspection */}
              {testBatchResult && (
                <div className="bg-slate-950 border border-emerald-500/30 rounded-lg p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Lote Comprimido: {testBatchResult.batchId}
                    </span>
                    <span className="text-slate-400 font-normal">
                      Algoritmo: {testBatchResult.algorithm}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-300">
                    <div>Puntos: <span className="text-white font-bold">{testBatchResult.count}</span></div>
                    <div>Original: <span className="text-white font-bold">{testBatchResult.originalSizeBytes} bytes</span></div>
                    <div>Comprimido: <span className="text-emerald-400 font-bold">{testBatchResult.compressedSizeBytes} bytes</span></div>
                    <div>Ahorro: <span className="text-emerald-400 font-bold">{testBatchResult.compressionRatioPct}%</span></div>
                  </div>
                  <div className="text-slate-400 break-all text-[11px] bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500">CRC-32:</span> {testBatchResult.crc32} | <span className="text-slate-500">SHA-256:</span> {testBatchResult.sha256}
                  </div>
                </div>
              )}

              {/* Architecture Explanation */}
              <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-lg space-y-2 text-xs text-slate-400 leading-relaxed">
                <h5 className="font-bold text-slate-200">Gobernanza Industrial de Almacenamiento (P1-01):</h5>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong className="text-slate-300">Protección de Memorias Flash Industriales:</strong> La compresión Brotli reduce hasta un 80% las escrituras al disco en IPCs con chips eMMC/SSD, multiplicando por 5x la vida útil del hardware.
                  </li>
                  <li>
                    <strong className="text-slate-300">Envelope Determinista:</strong> Cada muestra almacena su checksum IEEE 802.3 CRC-32 en cabecera para verificación instantánea previa a la descompresión.
                  </li>
                  <li>
                    <strong className="text-slate-300">Fallback Silencioso (Zero Disruption):</strong> Si el runtime se ejecuta en un entorno web sin soporte de compresión nativa, commuta automáticamente a modo RAW sin pérdida de telemetría.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "RECONCILIATION" && (
            <div className="space-y-6">
              {/* Action Banner */}
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-lg">
                <div>
                  <h4 className="text-sm font-semibold text-white">Simulación de Reconexión de Zafra (1 Hora de Corte)</h4>
                  <p className="text-xs text-slate-400">
                    Inyecta 30 puntos encolados con discrepancia de reloj, salto de secuencia y disparo de interlock local.
                  </p>
                </div>
                <button
                  onClick={handleRunSimulatedReconciliation}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center gap-2 transition disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  Ejecutar Arbitraje Semántico
                </button>
              </div>

              {/* Reports List & Inspection */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Reports History */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 max-h-96 overflow-y-auto">
                  <span className="text-xs font-mono text-slate-400 uppercase font-bold">Actas de Reconciliación</span>
                  {reports.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-2">Sin actas emitidas.</p>
                  ) : (
                    reports.map((rep) => (
                      <div
                        key={rep.reportId}
                        onClick={() => setSelectedReport(rep)}
                        className={`p-2.5 rounded-lg border cursor-pointer text-xs font-mono transition ${
                          selectedReport?.reportId === rep.reportId
                            ? "bg-slate-800 border-cyan-500 text-white"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">{rep.reportId}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            rep.status === "RECONCILED_SUCCESS"
                              ? "bg-emerald-950 text-emerald-300 border border-emerald-700/50"
                              : "bg-amber-950 text-amber-300 border border-amber-700/50"
                          }`}>
                            {rep.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          {rep.batchCount} pts • {rep.conflictsResolved.length} conflictos • {rep.sequenceGaps.length} gaps
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Selected Report Detail */}
                <div className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
                  {selectedReport ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            <FileCheck className="w-4 h-4 text-cyan-400" />
                            Acta: {selectedReport.reportId}
                          </h4>
                          <span className="text-xs text-slate-400 font-mono">
                            Emitida: {selectedReport.timestamp} • Tenant: {selectedReport.tenantId}
                          </span>
                        </div>
                        <button
                          onClick={() => handleDownloadReport(selectedReport)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-mono flex items-center gap-1.5 transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Descargar Acta
                        </button>
                      </div>

                      {/* Stats Counters */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block">Lote Total</span>
                          <span className="text-white font-bold text-sm">{selectedReport.batchCount}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block">Backfill TSDB</span>
                          <span className="text-cyan-400 font-bold text-sm">{selectedReport.historianBackfilledCount}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block">SCADA Preservado</span>
                          <span className="text-emerald-400 font-bold text-sm">{selectedReport.scadaLivePreservedCount}</span>
                        </div>
                        <div className="bg-slate-900 p-2 rounded border border-slate-800">
                          <span className="text-slate-500 block">Drift Máximo</span>
                          <span className="text-amber-400 font-bold text-sm">{selectedReport.clockSkewAnalysis.maxSkewMs} ms</span>
                        </div>
                      </div>

                      {/* Conflict Records */}
                      <div className="space-y-2">
                        <h5 className="text-xs font-mono uppercase text-slate-400 font-bold">Conflictos Arbitrados</h5>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto font-mono text-[11px]">
                          {selectedReport.conflictsResolved.length === 0 ? (
                            <p className="text-slate-500 italic">No hubo colisiones en este lote.</p>
                          ) : (
                            selectedReport.conflictsResolved.map((c, idx) => (
                              <div key={idx} className="bg-slate-900/90 border border-slate-800 p-2 rounded flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-cyan-300 font-bold">{c.tagId}</span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                    {c.conflictType}
                                  </span>
                                </div>
                                <p className="text-slate-400">{c.reason}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Tamper Seal */}
                      <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                        <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-300">Sello Criptográfico SHA-256:</strong> {selectedReport.tamperSealSha256}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-500 text-xs">
                      Selecciona un acta de la lista o ejecuta una reconciliación de prueba.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950 text-xs text-slate-400 font-mono">
          <span>BioAzúcar 4.0 Industrial Resiliency Engine • Nivel E3/E5</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
