import React, { useState } from "react";
import {
  Calendar,
  Plus,
  Edit3,
  Archive,
  CheckCircle2,
  AlertCircle,
  Target,
  Factory,
  Clock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { AgriculturalCampaign } from "../../types/agriculture";

interface CampaignManagementTabProps {
  campaigns: AgriculturalCampaign[];
  activeCampaignId: string;
  onSelectCampaign: (campaign: AgriculturalCampaign) => void;
  onCreateCampaign: () => void;
  onEditCampaign: (campaign: AgriculturalCampaign) => void;
  onArchiveCampaign: (campaignId: string) => void;
  theme?: "dark" | "light";
}

const safeNumber = (val: any, fallback = 0): number => {
  if (val === null || val === undefined) return fallback;
  const n = Number(val);
  return isNaN(n) ? fallback : n;
};

export const CampaignManagementTab: React.FC<CampaignManagementTabProps> = ({
  campaigns = [],
  activeCampaignId,
  onSelectCampaign,
  onCreateCampaign,
  onEditCampaign,
  onArchiveCampaign,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const safeList = Array.isArray(campaigns) ? campaigns : [];

  const filtered = safeList.filter((c) => {
    if (!c) return false;
    if (filterStatus === "ALL") return true;
    const normalizedStatus =
      c.status === "ACTIVE" || c.status === "ACTIVA"
        ? "ACTIVA"
        : c.status === "DRAFT" || c.status === "PLANIFICADA"
        ? "PLANIFICADA"
        : "ARCHIVADA";
    return normalizedStatus === filterStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div
        className={`p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Gestión de Campañas Agrícolas & Planificación Zafra
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Control de periodos de zafra, molienda presupuestada, duración operativa y balance plurianual
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={`text-xs px-3 py-1.5 rounded-lg border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            <option value="ALL">Todos los Estados ({safeList.length})</option>
            <option value="ACTIVA">Activas</option>
            <option value="PLANIFICADA">Planificadas</option>
            <option value="ARCHIVADA">Archivadas</option>
          </select>

          <button
            onClick={onCreateCampaign}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Campaña</span>
          </button>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((camp) => {
          if (!camp) return null;
          const isActive = camp.id === activeCampaignId;
          const millingTons = safeNumber(camp.targetMillingTons ?? camp.projectedTotalCaneTons, 1045250);
          const sugarTons = safeNumber(camp.targetSugarTons ?? camp.sugarTargetTons, 118000);
          const harvestDays = Math.max(1, safeNumber(camp.effectiveHarvestDays, 155));
          const renovationRate = safeNumber(camp.plannedRenovationRatePercent ?? camp.renewalTargetPercent, 16.5);
          const dailyDemand = harvestDays > 0 ? millingTons / harvestDays : 0;
          const startDate = camp.startDate || "15 Nov 2026";
          const endDate = camp.endDate || "18 Abr 2027";
          const displayStatus =
            camp.status === "ACTIVE" || camp.status === "ACTIVA"
              ? "ACTIVA"
              : camp.status === "DRAFT" || camp.status === "PLANIFICADA"
              ? "PLANIFICADA"
              : "ARCHIVADA";

          return (
            <div
              key={camp.id}
              className={`p-5 rounded-xl border transition flex flex-col justify-between ${
                isActive
                  ? isLight
                    ? "bg-cyan-50/70 border-cyan-500 ring-2 ring-cyan-500/20"
                    : "bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/30"
                  : isLight
                  ? "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div>
                {/* Top status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{camp.name || "Campaña Agrícola"}</span>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ZAFRA ACTIVA
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                      {startDate} al {endDate} ({harvestDays} días)
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold font-mono ${
                      displayStatus === "ACTIVA"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : displayStatus === "PLANIFICADA"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {displayStatus}
                  </span>
                </div>

                {/* Key KPIs */}
                <div className="grid grid-cols-2 gap-2 my-4 p-3 rounded-lg bg-slate-950/50 border border-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Molienda Objetivo</span>
                    <span className="font-mono font-bold text-slate-200">
                      {millingTons.toLocaleString()} t
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Azúcar Presupuestado</span>
                    <span className="font-mono font-bold text-amber-400">
                      {sugarTons.toLocaleString()} t
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Ritmo Molienda Diario</span>
                    <span className="font-mono font-bold text-sky-400">
                      {dailyDemand.toFixed(0)} TCD
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Tasa Renovación Cepa</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {renovationRate.toFixed(1)}% / año
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onEditCampaign(camp)}
                    className={`p-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${
                      isLight
                        ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                        : "border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                    title="Editar Parámetros de Campaña"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  {displayStatus !== "ARCHIVADA" && (
                    <button
                      onClick={() => onArchiveCampaign(camp.id)}
                      className="p-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                      title="Archivar de Forma Segura"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {!isActive && (
                  <button
                    onClick={() => onSelectCampaign(camp)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition cursor-pointer"
                  >
                    <span>Cargar en PDA</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
