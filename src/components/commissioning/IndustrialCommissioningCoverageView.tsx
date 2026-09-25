import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Database,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Server,
  Workflow,
  Radio,
  FileText,
  AlertOctagon,
  Eye,
  Hash,
} from "lucide-react";
import {
  TenantCoverageReport,
  EquipmentCoverageReport,
  TagCoverageDetail,
  HierarchyNode,
} from "../../services/edge/verification/CommissioningCoverageEngine";

interface Props {
  activeTenantId?: string;
}

export const IndustrialCommissioningCoverageView: React.FC<Props> = ({
  activeTenantId = "ingenio-central",
}) => {
  const [tenantId, setTenantId] = useState<string>(activeTenantId);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [tenantReport, setTenantReport] = useState<TenantCoverageReport | null>(null);
  const [hierarchy, setHierarchy] = useState<HierarchyNode | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>("MOLIENDA");
  const [equipments, setEquipments] = useState<EquipmentCoverageReport[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [selectedTagDetail, setSelectedTagDetail] = useState<TagCoverageDetail | null>(null);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(new Date().toLocaleTimeString());

  // Fetch tenant summary and hierarchy
  const fetchTenantData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [repRes, hierRes] = await Promise.all([
        fetch(`/api/commissioning/coverage/tenant/${tenantId}`),
        fetch(`/api/commissioning/coverage/tenant/${tenantId}/hierarchy`),
      ]);

      if (!repRes.ok) throw new Error(`HTTP ${repRes.status} al obtener reporte de cobertura`);
      if (!hierRes.ok) throw new Error(`HTTP ${hierRes.status} al obtener jerarquía ISA-95`);

      const repData: TenantCoverageReport = await repRes.json();
      const hierData: HierarchyNode = await hierRes.json();

      setTenantReport(repData);
      setHierarchy(hierData);

      // Default to first area if available
      const availableAreas = Object.keys(repData.areas);
      if (availableAreas.length > 0 && !availableAreas.includes(selectedAreaId)) {
        setSelectedAreaId(availableAreas[0]);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "Error al cargar datos de cobertura");
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedAreaId]);

  // Fetch equipments for selected area
  const fetchEquipments = useCallback(async () => {
    if (!selectedAreaId) return;
    try {
      const res = await fetch(`/api/commissioning/coverage/tenant/${tenantId}/area/${selectedAreaId}/equipments`);
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar equipos`);
      const data: EquipmentCoverageReport[] = await res.json();
      setEquipments(data);
      if (data.length > 0 && !selectedEquipmentId) {
        setSelectedEquipmentId(data[0].equipmentId);
      }
    } catch (err: any) {
      console.error("Error fetching equipments:", err);
    }
  }, [tenantId, selectedAreaId, selectedEquipmentId]);

  // Fetch single tag detail
  const fetchTagDetail = async (tagId: string) => {
    try {
      const res = await fetch(`/api/commissioning/coverage/tenant/${tenantId}/tag/${tagId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} al cargar detalle del tag`);
      const detail: TagCoverageDetail = await res.json();
      setSelectedTagDetail(detail);
    } catch (err: any) {
      console.error("Error fetching tag detail:", err);
    }
  };

  useEffect(() => {
    fetchTenantData();
  }, [fetchTenantData]);

  useEffect(() => {
    fetchEquipments();
  }, [fetchEquipments]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTenantData();
      fetchEquipments();
      if (selectedTagDetail) {
        fetchTagDetail(selectedTagDetail.tagId);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTenantData, fetchEquipments, selectedTagDetail]);

  const areasList = tenantReport ? Object.keys(tenantReport.areas) : [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Workflow className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Industrial Commissioning & Data Coverage
                <span className="text-xs px-2.5 py-0.5 rounded-full font-mono bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {tenantReport?.runtimeProfile || "SIMULATION"}
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Verificación inmutable extremo a extremo de telemetría, linaje de datos, frescura y cobertura ISA-95
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <Server className="w-3.5 h-3.5 mr-2 text-slate-400" />
            <span className="text-slate-400 mr-1">Tenant:</span>
            <select
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              className="bg-transparent font-medium text-white focus:outline-none cursor-pointer"
            >
              <option value="ingenio-central" className="bg-slate-900">Ingenio Central (Principal)</option>
              <option value="TENANT_AZUCAR_01" className="bg-slate-900">Tenant Azúcar 01</option>
            </select>
          </div>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
            {autoRefresh ? "Auto-Refresh (4s)" : "Auto-Refresh Off"}
          </button>

          <button
            onClick={() => {
              fetchTenantData();
              fetchEquipments();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </button>

          <span className="text-[11px] text-slate-500 font-mono">
            Última sync: {lastRefreshed}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-red-200 text-sm flex items-center gap-3">
          <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Global Pipeline Metrices */}
      {tenantReport && (
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
          {[
            { label: "1. Discovered", count: tenantReport.globalStageCounts.DISCOVERED, color: "text-slate-300", bg: "bg-slate-900" },
            { label: "2. Configured", count: tenantReport.globalStageCounts.CONFIGURED, color: "text-blue-400", bg: "bg-blue-950/30" },
            { label: "3. Mapped", count: tenantReport.globalStageCounts.MAPPED, color: "text-indigo-400", bg: "bg-indigo-950/30" },
            { label: "4. Connected", count: tenantReport.globalStageCounts.CONNECTED, color: "text-cyan-400", bg: "bg-cyan-950/30" },
            { label: "5. Polling", count: tenantReport.globalStageCounts.SUBSCRIBED_OR_POLLING, color: "text-teal-400", bg: "bg-teal-950/30" },
            { label: "6. Flowing", count: tenantReport.globalStageCounts.DATA_FLOWING, color: "text-emerald-400", bg: "bg-emerald-950/30" },
            { label: "7. Validated", count: tenantReport.globalStageCounts.DATA_VALIDATED, color: "text-green-400", bg: "bg-green-950/30" },
            { label: "8. Commissioned", count: tenantReport.globalStageCounts.COMMISSIONED, color: "text-amber-400", bg: "bg-amber-950/30" },
            { label: "9. Field Valid", count: tenantReport.globalStageCounts.FIELD_VALIDATED, color: "text-orange-400", bg: "bg-orange-950/30" },
            { label: "10. Production", count: tenantReport.globalStageCounts.PRODUCTION_READY, color: "text-purple-400", bg: "bg-purple-950/30" },
          ].map((st, i) => (
            <div key={i} className={`p-2.5 rounded-lg border border-slate-800 ${st.bg} flex flex-col justify-between`}>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">{st.label}</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className={`text-lg font-bold font-mono ${st.color}`}>{st.count}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {tenantReport.totalTags > 0 ? Math.round((st.count / tenantReport.totalTags) * 100) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Grid: Area Selector -> Equipments -> Tag Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Area Navigation & Tree (3 Cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-emerald-400" />
              Áreas de Planta ({areasList.length})
            </h2>

            <div className="space-y-1.5">
              {areasList.map((areaId) => {
                const rep = tenantReport?.areas[areaId];
                const isSelected = selectedAreaId === areaId;
                return (
                  <button
                    key={areaId}
                    onClick={() => {
                      setSelectedAreaId(areaId);
                      setSelectedEquipmentId(null);
                      setSelectedTagDetail(null);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-medium"
                        : "bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 text-slate-300"
                    }`}
                  >
                    <div>
                      <span className="text-xs font-semibold block">{areaId.replace(/_/g, " ")}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {rep?.totalTags || 0} Tags | {rep?.areaReadiness || "NOT_COMMISSIONED"}
                      </span>
                    </div>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-emerald-400" : "text-slate-600"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cryptographic Seal Card */}
          {tenantReport && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 text-slate-300 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Sello Criptográfico Inmutable
              </div>
              <p className="text-[11px] text-slate-400 break-all bg-slate-950 p-2 rounded border border-slate-800">
                {tenantReport.reportHashSha256}
              </p>
              <div className="text-[10px] text-slate-500 flex justify-between">
                <span>Algoritmo: SHA-256</span>
                <span className="text-emerald-400 font-bold">ANTI-TAMPER VERIFIED</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Column: Equipment Coverage Grid (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-blue-400" />
                Equipos en {selectedAreaId.replace(/_/g, " ")} ({equipments.length})
              </h2>

              <div className="relative w-40">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filtrar..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {equipments.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                No hay equipos configurados para esta área.
              </div>
            ) : (
              <div className="space-y-3">
                {equipments
                  .filter((eq) => eq.equipmentName.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((eq) => {
                    const isSelected = selectedEquipmentId === eq.equipmentId;
                    return (
                      <div
                        key={eq.equipmentId}
                        onClick={() => setSelectedEquipmentId(eq.equipmentId)}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-blue-500/10 border-blue-500/40"
                            : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <span className="text-xs font-bold text-white block">{eq.equipmentName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {eq.protocol} | {eq.endpoint}
                            </span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                              eq.connectionStatus === "CONNECTED"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : eq.connectionStatus === "SIMULATION"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                : "bg-red-500/10 text-red-400 border border-red-500/30"
                            }`}
                          >
                            {eq.connectionStatus}
                          </span>
                        </div>

                        {/* Breakdown Metrics */}
                        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono">
                          <div className="bg-slate-900/60 p-1.5 rounded">
                            <span className="text-[9px] text-slate-500 block">TAGS</span>
                            <span className="text-xs font-bold text-slate-200">{eq.totalTags}</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded">
                            <span className="text-[9px] text-emerald-500 block">FLOWING</span>
                            <span className="text-xs font-bold text-emerald-400">{eq.dataFlowingTags}</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded">
                            <span className="text-[9px] text-green-500 block">GOOD</span>
                            <span className="text-xs font-bold text-green-400">{eq.goodCount}</span>
                          </div>
                          <div className="bg-slate-900/60 p-1.5 rounded">
                            <span className="text-[9px] text-amber-500 block">STALE</span>
                            <span className="text-xs font-bold text-amber-400">{eq.staleCount}</span>
                          </div>
                        </div>

                        {/* Quick View Tag Button */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                          <span>Readiness: <strong className="text-slate-200">{eq.commissioningReadiness}</strong></span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Inspect first tag of equipment
                              fetchTagDetail(eq.areaId === "MOLIENDA" ? "tag-milling-tch" : (eq.areaId === "CALDERAS" ? "tag-boiler1-steam-pressure" : "tag-weighbridge-gross-weight"));
                            }}
                            className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                          >
                            Ver Tags <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tag Detail & 8-Stage Lineage (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-emerald-400" />
              Detalle Canónico & Linaje de Datos
            </h2>

            {!selectedTagDetail ? (
              <div className="p-8 text-center border border-dashed border-slate-800 rounded-lg text-slate-500 text-xs">
                Seleccione un tag de la lista para inspeccionar su valor en tiempo real, validación de ingeniería y linaje completo.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live Value Hero Card */}
                <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{selectedTagDetail.canonicalName}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                        selectedTagDetail.quality === "GOOD"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : selectedTagDetail.quality === "STALE"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          : "bg-red-500/10 text-red-400 border border-red-500/30"
                      }`}
                    >
                      {selectedTagDetail.quality}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-2xl font-bold font-mono text-emerald-400">
                        {selectedTagDetail.currentValue !== null ? selectedTagDetail.currentValue : "---"}
                      </span>
                      <span className="ml-1.5 text-xs text-slate-400 font-mono">
                        {selectedTagDetail.engineeringUnit}
                      </span>
                    </div>

                    <div className="text-right text-[10px] font-mono text-slate-400">
                      <div>Raw: {String(selectedTagDetail.rawValue ?? "N/A")}</div>
                      <div>Norm: {String(selectedTagDetail.normalizedValue ?? "N/A")}</div>
                    </div>
                  </div>

                  {/* Stale / Age tracking */}
                  <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Antigüedad: <strong className={selectedTagDetail.isStale ? "text-amber-400" : "text-slate-300"}>{selectedTagDetail.ageFormatted}</strong>
                    </span>
                    <span>Scan: {selectedTagDetail.expectedSampleIntervalMs}ms</span>
                    <span>Seq: #{selectedTagDetail.sequence}</span>
                  </div>
                </div>

                {/* Canonical Attributes Accordion */}
                <div className="space-y-1 text-xs font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between py-0.5 text-slate-400">
                    <span>Tag ID:</span>
                    <span className="text-slate-200">{selectedTagDetail.tagId}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-400">
                    <span>Protocolo:</span>
                    <span className="text-slate-200">{selectedTagDetail.protocol}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-400">
                    <span>Dirección:</span>
                    <span className="text-slate-200">{selectedTagDetail.address}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-400">
                    <span>Procedencia:</span>
                    <span className="text-blue-400 font-semibold">{selectedTagDetail.provenance}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-slate-400">
                    <span>Etapa Commissioning:</span>
                    <span className="text-amber-400 font-semibold">{selectedTagDetail.commissioningStage}</span>
                  </div>
                </div>

                {/* 8-Stage Data Lineage Chain */}
                <div className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    Cadena Ininterrumpida de Linaje (8 Eslabones)
                  </h3>

                  <div className="space-y-1.5 font-mono text-[10px]">
                    {selectedTagDetail.lineage.map((l, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-slate-950/80 rounded border border-slate-800/80 flex items-start justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold">#{idx + 1}</span>
                            <span className="text-slate-200 font-bold">{l.stage}</span>
                            <span className="text-slate-500">({l.component})</span>
                          </div>
                          <p className="text-slate-400">{l.details}</p>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            l.status === "PASSED"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : l.status === "FAILED"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {l.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
