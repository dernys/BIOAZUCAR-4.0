import React, { useState } from "react";
import {
  History,
  Search,
  Filter,
  ShieldCheck,
  User,
  Clock,
  ArrowRight,
  FileCheck2,
  AlertCircle,
  Database,
} from "lucide-react";
import { AgriculturalAuditChangeRecord } from "../../types/agriculture";

interface AuditHistoryTabProps {
  auditRecords: AgriculturalAuditChangeRecord[];
  theme?: "dark" | "light";
}

export const AuditHistoryTab: React.FC<AuditHistoryTabProps> = ({
  auditRecords,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [filterEntity, setFilterEntity] = useState<string>("ALL");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = auditRecords.filter((rec) => {
    const matchEntity = filterEntity === "ALL" || rec.entityType === filterEntity;
    const matchAction = filterAction === "ALL" || rec.action === filterAction;
    const matchSearch =
      searchTerm === "" ||
      rec.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.reason && rec.reason.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchEntity && matchAction && matchSearch;
  });

  const formatValue = (val: any) => {
    if (val === undefined || val === null) return "null";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Auditoría & Trazabilidad Histórica ISA-95 Nivel 4
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Registro inmutable de transacciones, mutaciones de estado, cambios de parámetros y autoría de operaciones
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-semibold">
            {auditRecords.length} Registros Inmutables
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Entidad:</span>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            <option value="ALL">Todas las Entidades</option>
            <option value="CAMPAIGN">Campaña</option>
            <option value="PLOT">Parcela / Lote</option>
            <option value="PARAMETER">Parámetro</option>
            <option value="OPERATION">Operación</option>
            <option value="EQUIPMENT">Maquinaria</option>
            <option value="INPUT">Insumo</option>
            <option value="SCENARIO">Escenario</option>
          </select>

          <span className="text-xs font-semibold text-slate-400 ml-2">Acción:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            <option value="ALL">Todas las Acciones</option>
            <option value="CREATE">CREATE</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="ARCHIVE">ARCHIVE</option>
            <option value="DISPATCH">DISPATCH</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por ID, usuario o motivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div
        className={`rounded-xl border overflow-hidden ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr
                className={`border-b font-semibold ${
                  isLight
                    ? "bg-slate-100/70 border-slate-200 text-slate-700"
                    : "bg-slate-950 border-slate-800 text-slate-300"
                }`}
              >
                <th className="p-3">Fecha & Hora</th>
                <th className="p-3">Entidad</th>
                <th className="p-3">ID Entidad</th>
                <th className="p-3">Acción</th>
                <th className="p-3">Usuario Autor</th>
                <th className="p-3">Motivo / Justificación</th>
                <th className="p-3">Transición de Estado / Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-400">
                    No se encontraron registros de auditoría con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((rec) => {
                  const dateStr = new Date(rec.timestamp).toLocaleString();
                  const isCreate = rec.action === "CREATE";
                  const isDelete = rec.action === "DELETE";
                  const isArchive = rec.action === "ARCHIVE";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-800/20 transition">
                      <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                        {dateStr}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-200 font-mono font-bold">
                          {rec.entityType}
                        </span>
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-100">
                        {rec.entityId}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                            isCreate
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isDelete || isArchive
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {rec.action}
                        </span>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">
                        {rec.user}
                      </td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={rec.reason}>
                        {rec.reason || "Mutación estándar desde interfaz PDA"}
                      </td>
                      <td className="p-3 font-mono text-[11px] max-w-sm">
                        {rec.previousValue !== undefined && rec.newValue !== undefined ? (
                          <div className="flex items-center gap-1 truncate text-slate-300">
                            <span className="text-slate-500 truncate line-through max-w-[120px]">
                              {formatValue(rec.previousValue)}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                            <span className="text-emerald-400 font-bold truncate max-w-[150px]">
                              {formatValue(rec.newValue)}
                            </span>
                          </div>
                        ) : rec.newValue !== undefined ? (
                          <span className="text-emerald-400 truncate block">
                            {formatValue(rec.newValue)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
