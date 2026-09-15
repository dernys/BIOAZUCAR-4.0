import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  Sliders,
  Database,
  Search,
  Lock,
  FileCheck,
  Eye,
  Activity,
} from "lucide-react";
import { IndustrialTagDefinition, UserRole } from "../types";
import { tagManagementService, TagTestResult } from "../services/tagManagementService";

interface IndustrialTagTesterProps {
  tenantId?: string;
  userRole?: UserRole;
  userName?: string;
  theme?: "light" | "dark";
}

export const IndustrialTagTester: React.FC<IndustrialTagTesterProps> = ({
  tenantId = "TENANT_AZUCAR_01",
  userRole = "administrador",
  userName = "Ingeniero de Automatización",
  theme = "dark",
}) => {
  const [tags, setTags] = useState<IndustrialTagDefinition[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Operation state
  const [testResult, setTestResult] = useState<TagTestResult | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [writeValue, setWriteValue] = useState<string>("");
  const [writeReason, setWriteReason] = useState<string>("Ajuste de consigna en prueba de comisionamiento");
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Continuous monitoring state
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);
  const [monitorHistory, setMonitorHistory] = useState<{ time: string; value: number; quality: string }[]>([]);
  const monitorIntervalRef = useRef<any>(null);

  // Load tags on mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const list = await tagManagementService.getTags(tenantId);
      setTags(list);
      if (list.length > 0) {
        setSelectedTagId(list[0].id);
      }
      setIsLoading(false);
    };
    load();
  }, [tenantId]);

  const selectedTag = tags.find((t) => t.id === selectedTagId) || null;

  // Execute READ operation
  const handleExecuteRead = async () => {
    if (!selectedTag) return;
    setIsExecuting(true);
    try {
      const result = await tagManagementService.testTagOperation({
        tagId: selectedTag.id,
        operation: "READ",
        user: { role: userRole, name: userName },
      });
      setTestResult(result);
      if (result.success && typeof result.value === "number") {
        setMonitorHistory((prev) => [
          ...prev.slice(-14),
          {
            time: new Date().toLocaleTimeString(),
            value: result.value,
            quality: result.quality,
          },
        ]);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Open confirmation for WRITE
  const handlePromptWrite = () => {
    if (!selectedTag) return;
    if (selectedTag.accessMode === "READ") {
      alert("Operación denegada: Este tag está configurado como SOLO LECTURA.");
      return;
    }
    if (!writeValue) {
      alert("Por favor ingrese un valor de consigna numérico.");
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Execute WRITE operation after confirmation
  const handleConfirmWrite = async () => {
    if (!selectedTag) return;
    setIsConfirmModalOpen(false);
    setIsExecuting(true);
    try {
      const num = parseFloat(writeValue);
      const valToSend = isNaN(num) ? writeValue : num;
      const result = await tagManagementService.testTagOperation({
        tagId: selectedTag.id,
        operation: "WRITE",
        writeValue: valToSend,
        reason: writeReason,
        user: { role: userRole, name: userName },
      });
      setTestResult(result);
      if (result.success && typeof result.value === "number") {
        setMonitorHistory((prev) => [
          ...prev.slice(-14),
          {
            time: new Date().toLocaleTimeString(),
            value: result.value,
            quality: result.quality,
          },
        ]);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Toggle continuous monitor
  const handleToggleMonitor = () => {
    if (isMonitoring) {
      clearInterval(monitorIntervalRef.current);
      monitorIntervalRef.current = null;
      setIsMonitoring(false);
    } else {
      setIsMonitoring(true);
      handleExecuteRead();
      monitorIntervalRef.current = setInterval(() => {
        handleExecuteRead();
      }, 1500);
    }
  };

  useEffect(() => {
    return () => {
      if (monitorIntervalRef.current) {
        clearInterval(monitorIntervalRef.current);
      }
    };
  }, []);

  const filteredTags = tags.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArea = filterArea === "ALL" || t.area === filterArea;
    return matchesSearch && matchesArea;
  });

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
      {/* Top Banner Header */}
      <div className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Industrial Tag Tester & Validator
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                IEC 62443 Compliant
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pruebas directas de lectura, escritura con autorización humana y monitoreo de variables de campo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMonitor}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isMonitoring
                ? "bg-red-500 hover:bg-red-600 text-white border-red-600 shadow-sm animate-pulse"
                : "bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-white border-slate-300 dark:border-slate-700"
            }`}
          >
            {isMonitoring ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {isMonitoring ? "Detener Monitoreo" : "Monitoreo en Tiempo Real"}
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Tag Directory & Search (4 cols) */}
        <div className="lg:col-span-5 border-r border-slate-200 dark:border-slate-800 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/40">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar tag por nombre, dirección o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-mono">
                {filteredTags.length} tags catalogados
              </span>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 outline-none"
              >
                <option value="ALL">Todas las Áreas</option>
                <option value="MOLIENDA">Molienda</option>
                <option value="CALDERAS">Calderas</option>
                <option value="COGENERACION">Cogeneración</option>
                <option value="FABRICA">Fábrica</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Cargando catálogo industrial...
              </div>
            ) : filteredTags.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs">
                No se encontraron tags coincidentes.
              </div>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = tag.id === selectedTagId;
                return (
                  <button
                    key={tag.id}
                    onClick={() => {
                      setSelectedTagId(tag.id);
                      setTestResult(null);
                      setWriteValue("");
                    }}
                    className={`w-full text-left p-3 transition-colors ${
                      isSelected
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-slate-900 dark:text-white"
                        : "hover:bg-slate-100 dark:hover:bg-slate-900/50 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs truncate max-w-[220px]">
                        {tag.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                          tag.accessMode === "READ_WRITE"
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {tag.accessMode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      <span className="truncate max-w-[180px]">{tag.address}</span>
                      <span>{tag.protocol}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Tag Test Workbench (7 cols) */}
        <div className="lg:col-span-7 flex flex-col h-full overflow-y-auto p-5 space-y-5 bg-white dark:bg-slate-950">
          {selectedTag ? (
            <>
              {/* Tag Details Card */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      {selectedTag.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {selectedTag.description || "Variable de instrumentación de planta."}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded border ${
                      selectedTag.source === "LIVE_OT"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                        : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                    }`}
                  >
                    Origen: {selectedTag.source}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-400 block">DIRECCIÓN PLC</span>
                    <span className="text-slate-800 dark:text-slate-200 truncate block">
                      {selectedTag.address}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">RANGO INGENIERÍA</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {selectedTag.engMin} - {selectedTag.engMax} {selectedTag.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">TASA MUESTREO</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      {selectedTag.scanRateMs} ms
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">BANDA MUERTA</span>
                    <span className="text-slate-800 dark:text-slate-200">
                      ±{selectedTag.deadband} {selectedTag.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* READ Action Section */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Prueba de Lectura (READ)
                    </h4>
                  </div>
                  <button
                    onClick={handleExecuteRead}
                    disabled={isExecuting}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm"
                  >
                    {isExecuting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Leer Valor Ahora
                  </button>
                </div>

                {testResult && testResult.operation === "READ" && (
                  <div
                    className={`p-3 rounded border text-xs space-y-1.5 ${
                      testResult.success
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                        : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold text-sm">
                      <span className="flex items-center gap-1.5">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        Valor: {String(testResult.value)} {selectedTag.unit}
                      </span>
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-normal">
                        Latencia: {testResult.latencyMs} ms
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      <span>Quality: <strong>{testResult.quality}</strong></span>
                      <span>Availability: <strong>{testResult.availability}</strong></span>
                      <span>Timestamp: {new Date(testResult.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                      {testResult.message}
                    </p>
                  </div>
                )}
              </div>

              {/* WRITE Action Section */}
              <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Prueba de Escritura / Consigna (WRITE)
                  </h4>
                </div>

                {selectedTag.accessMode === "READ" ? (
                  <div className="p-3 rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>
                      Variable de <strong>Solo Lectura (READ)</strong>. La escritura de consigna está bloqueada por diseño seguro en este tag.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-600 dark:text-slate-400 font-mono mb-1">
                          Nuevo Valor Consigna ({selectedTag.unit})
                        </label>
                        <input
                          type="number"
                          value={writeValue}
                          onChange={(e) => setWriteValue(e.target.value)}
                          placeholder={`Rango: ${selectedTag.engMin} - ${selectedTag.engMax}`}
                          className="w-full px-3 py-1.5 text-xs rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 dark:text-slate-400 font-mono mb-1">
                          Justificación de Auditoría IEC 62443
                        </label>
                        <input
                          type="text"
                          value={writeReason}
                          onChange={(e) => setWriteReason(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={handlePromptWrite}
                      disabled={isExecuting || !writeValue}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Escribir Consigna (WRITE con Confirmación)
                    </button>

                    {testResult && testResult.operation === "WRITE" && (
                      <div
                        className={`p-3 rounded border text-xs space-y-1 ${
                          testResult.success
                            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200"
                            : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 font-bold">
                          {testResult.success ? (
                            <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                          )}
                          <span>{testResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Monitor History Strip */}
              {monitorHistory.length > 0 && (
                <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span>Muestras Recientes en Tiempo Real</span>
                    <span className="font-mono text-[11px] text-slate-500">{monitorHistory.length} lecturas</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto py-2">
                    {monitorHistory.map((m, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center min-w-[75px] shrink-0"
                      >
                        <span className="text-[9px] text-slate-400 block font-mono">{m.time}</span>
                        <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Activity className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-xs">Seleccione un tag en el catálogo para iniciar las pruebas de lectura y escritura.</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for WRITE operation */}
      {isConfirmModalOpen && selectedTag && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirmación Obligatoria de Consigna Física</span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Está a punto de transmitir una orden de escritura física al equipo <strong>{selectedTag.equipmentName}</strong> a través de <strong>{selectedTag.protocol}</strong>.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-1">
              <div>Tag: <span className="font-bold text-slate-900 dark:text-white">{selectedTag.name}</span></div>
              <div>Dirección PLC: <span className="text-emerald-600 dark:text-emerald-400">{selectedTag.address}</span></div>
              <div>Nuevo Valor a Escribir: <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{writeValue} {selectedTag.unit}</span></div>
              <div>Operador Responsable: <span className="text-slate-700 dark:text-slate-300">{userName} ({userRole})</span></div>
              <div>Razón: <span className="text-slate-500 italic">{writeReason}</span></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmWrite}
                className="px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar y Transmitir al PLC
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
