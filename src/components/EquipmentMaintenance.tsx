import React, { useState, useMemo } from "react";
import {
  Wrench,
  Activity,
  Plus,
  CheckSquare,
  Clock,
  AlertTriangle,
  RotateCw,
  Search,
  CheckCircle2,
  Calendar,
  Layers,
  Thermometer,
  ShieldCheck,
  Lock,
  Trash2,
  UserCheck,
  Sparkles,
  FileText,
  Zap,
} from "lucide-react";
import { EquipmentItem, WorkOrder, UserRole } from "../types";
import { checkRbacPermission, getRoleBadgeInfo } from "../services/rbacService";

interface EquipmentMaintenanceProps {
  equipmentList: EquipmentItem[];
  workOrders: WorkOrder[];
  onAddWorkOrder: (wo: WorkOrder) => void;
  onUpdateWorkOrder: (wo: WorkOrder) => void;
  currentRole: UserRole;
}

export const EquipmentMaintenance: React.FC<EquipmentMaintenanceProps> = ({
  equipmentList = [],
  workOrders = [],
  onAddWorkOrder,
  onUpdateWorkOrder,
  currentRole,
}) => {
  const safeEquipmentList = Array.isArray(equipmentList) ? equipmentList : [];
  const safeWorkOrders = Array.isArray(workOrders) ? workOrders : [];
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentItem>(
    safeEquipmentList[1] || safeEquipmentList[0] || ({} as EquipmentItem)
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showAddWOModal, setShowAddWOModal] = useState<boolean>(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [woFilter, setWoFilter] = useState<string>("ALL");

  // New WO form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"PREVENTIVO" | "CORRECTIVO" | "PREDICTIVO" | "LUBRICACION">("PREDICTIVO");
  const [newPriority, setNewPriority] = useState<"URGENTE" | "ALTA" | "MEDIA" | "BAJA">("ALTA");
  const [newAssigned, setNewAssigned] = useState("Ing. Roberto Salazar (Especialista CBM)");
  const [newHours, setNewHours] = useState("3.5");
  const [newDesc, setNewDesc] = useState("");
  const [customTasks, setCustomTasks] = useState<string[]>([
    "Inspección visual y termográfica de chumacera lado acople",
    "Comprobación de nivel y retorno de aceite ISO VG 460",
    "Adquisición de espectro FFT de aceleración y envolvente demodulada",
  ]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // RBAC Checks
  const rbacAddWO = useMemo(
    () => checkRbacPermission(currentRole, "ADD_WORK_ORDER"),
    [currentRole]
  );
  const rbacUpdateWO = useMemo(
    () => checkRbacPermission(currentRole, "UPDATE_WORK_ORDER"),
    [currentRole]
  );
  const rbacApproveWO = useMemo(
    () => checkRbacPermission(currentRole, "APPROVE_WORK_ORDER"),
    [currentRole]
  );
  const roleBadge = getRoleBadgeInfo(currentRole);

  const filteredEquipments = safeEquipmentList.filter(
    (e) =>
      (e.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.area || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredWorkOrders = safeWorkOrders.filter((wo) => {
    if (woFilter === "ALL") return true;
    return wo.status === woFilter;
  });

  const handleToggleTask = (wo: WorkOrder, taskId: string) => {
    if (!rbacUpdateWO.allowed) {
      alert(rbacUpdateWO.reason);
      return;
    }
    const updatedTasks = wo.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    const allDone = updatedTasks.every((t) => t.done);
    onUpdateWorkOrder({
      ...wo,
      tasks: updatedTasks,
      status: allDone ? "COMPLETADA" : "EN_PROCESO",
    });
  };

  const handleAddCustomTask = () => {
    if (!newTaskInput.trim()) return;
    setCustomTasks([...customTasks, newTaskInput.trim()]);
    setNewTaskInput("");
  };

  const handleRemoveCustomTask = (index: number) => {
    setCustomTasks(customTasks.filter((_, i) => i !== index));
  };

  const handleCreateWO = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rbacAddWO.allowed) return;

    const newWO: WorkOrder = {
      id: "wo-" + Date.now(),
      code: "OT-2026-" + Math.floor(100 + Math.random() * 900),
      equipmentId: selectedEquipment.id || "eq-molino-01",
      equipmentName: selectedEquipment.name || "Equipo Industrial",
      title: newTitle || `Intervención CBM en ${selectedEquipment.code || "Equipo"}`,
      type: newType,
      priority: newPriority,
      status: "PENDIENTE",
      assignedTo: newAssigned,
      createdDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      estimatedHours: parseFloat(newHours) || 2.5,
      description:
        newDesc ||
        `Mantenimiento por condición activado por sensor de vibración (${selectedEquipment.vibrationRMS || 4.2} mm/s).`,
      tasks: customTasks.map((t, idx) => ({
        id: `t-${idx + 1}`,
        text: t,
        done: false,
      })),
    };

    onAddWorkOrder(newWO);
    setShowAddWOModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-400" />
            Gestión de Equipos & Mantenimiento Predictivo / CMMS
          </h2>
          <p className="text-xs text-slate-400">
            Monitoreo de condición (Vibración FFT, Termografía, Tribología) y órdenes de trabajo digitales
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar equipo o código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 rounded-lg pl-9 pr-3 py-1.5 border border-slate-800 focus:outline-none focus:border-emerald-500 w-56 font-mono"
            />
          </div>

          <button
            onClick={() => setShowAddWOModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-lg ${
              rbacAddWO.allowed
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-500/40"
            }`}
            title={rbacAddWO.allowed ? "Generar OT" : rbacAddWO.reason}
          >
            {rbacAddWO.allowed ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Generar Orden de Trabajo (OT)</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Machinery List + Vibration & CMMS Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Machinery Assets Table (6 cols) */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-emerald-400" />
              Parque de Maquinaria Principal ({filteredEquipments.length})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Norma ISO 10816-3</span>
          </div>

          <div className="divide-y divide-slate-800/80 max-h-[580px] overflow-y-auto">
            {filteredEquipments.map((eq) => {
              const isSelected = selectedEquipment?.id === eq.id;
              const isHighVibe = (eq.vibrationRMS || 0) > (eq.vibrationThreshold || 4.5);

              return (
                <div
                  key={eq.id}
                  onClick={() => setSelectedEquipment(eq)}
                  className={`p-3.5 cursor-pointer transition flex items-center justify-between gap-3 ${
                    isSelected ? "bg-emerald-500/10 border-l-4 border-emerald-400" : "hover:bg-slate-800/40"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white">{eq.code}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {eq.area}
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 font-medium">{eq.name}</div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                      <span>Temp: <strong className="text-slate-200">{eq.temperatureC || 62}°C</strong></span>
                      <span>Carga: <strong className="text-slate-200">{eq.loadPercentage || 82}%</strong></span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="flex items-center justify-end gap-1.5">
                      <span
                        className={`text-xs font-mono font-bold ${
                          isHighVibe ? "text-rose-400 animate-pulse" : "text-emerald-400"
                        }`}
                      >
                        {eq.vibrationRMS || 2.4} mm/s
                      </span>
                      {isHighVibe && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Umbral: {eq.vibrationThreshold || 4.5} mm/s
                    </div>
                    <div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                          eq.status === "RUNNING"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : eq.status === "WARNING"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        }`}
                      >
                        {eq.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Asset Condition & Work Orders CMMS (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Asset Health Card */}
          {selectedEquipment && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 block">Diagnóstico de Condición CBM</span>
                  <h3 className="text-sm font-bold text-white font-tech">{selectedEquipment.name} ({selectedEquipment.code})</h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-mono">Índice de Salud</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">{selectedEquipment.healthIndex || 92}%</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Vibración RMS:</span>
                  <span className="text-sm font-bold text-cyan-300">{selectedEquipment.vibrationRMS || 2.1} mm/s</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Temperatura Rod.:</span>
                  <span className="text-sm font-bold text-amber-300">{selectedEquipment.temperatureC || 58} °C</span>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Horas Operación:</span>
                  <span className="text-sm font-bold text-slate-200">4,280 h</span>
                </div>
              </div>
            </div>
          )}

          {/* Work Orders List for CMMS */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                Órdenes de Trabajo Activas ({filteredWorkOrders.length})
              </span>

              <div className="flex items-center gap-1 font-mono text-[10px]">
                {(["ALL", "PENDIENTE", "EN_PROCESO", "COMPLETADA"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setWoFilter(st)}
                    className={`px-2 py-0.5 rounded transition ${
                      woFilter === st
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {st === "ALL" ? "Todas" : st}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-[380px] overflow-y-auto p-2 space-y-2">
              {filteredWorkOrders.map((wo) => {
                const completedTasks = wo.tasks?.filter((t) => t.done).length || 0;
                const totalTasks = wo.tasks?.length || 1;
                const progressPct = Math.round((completedTasks / totalTasks) * 100);

                return (
                  <div
                    key={wo.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 font-mono text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{wo.code}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${
                              wo.priority === "URGENTE"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                                : wo.priority === "ALTA"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {wo.priority}
                          </span>
                          <span className="text-[10px] text-cyan-400 font-sans">{wo.type}</span>
                        </div>
                        <h4 className="text-xs font-sans text-slate-200 font-medium mt-0.5">{wo.title}</h4>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          wo.status === "COMPLETADA"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : wo.status === "EN_PROCESO"
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                            : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {wo.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 font-sans">
                      Asignado a: <strong className="text-slate-300">{wo.assignedTo}</strong> • Est: {wo.estimatedHours}h
                    </div>

                    {/* Task checklist */}
                    <div className="space-y-1 pt-1 border-t border-slate-900">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Checklist de Intervención:</span>
                        <span>{completedTasks}/{totalTasks} ({progressPct}%)</span>
                      </div>
                      <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="space-y-1 pt-1">
                        {wo.tasks?.map((t) => (
                          <label
                            key={t.id}
                            className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-300 hover:text-white"
                          >
                            <input
                              type="checkbox"
                              checked={t.done}
                              onChange={() => handleToggleTask(wo, t.id)}
                              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                            />
                            <span className={t.done ? "line-through text-slate-500" : ""}>{t.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* OPTIMIZED CONTEXT-AWARE MODAL: Generar Orden de Trabajo */}
      {showAddWOModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-tech">
                    Generar Orden de Trabajo Digital (CMMS)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                      Operador Activo: {roleBadge.label} ({roleBadge.clearance})
                    </span>
                    {rbacAddWO.allowed ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                        <ShieldCheck className="w-3 h-3" /> Autorizado para emisión
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3" /> Requiere elevación
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAddWOModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-mono transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWO} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Equipment Target Card */}
                <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                    1. Activo Objetivo
                  </span>
                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Equipo Seleccionado:</label>
                    <select
                      value={selectedEquipment?.id}
                      onChange={(e) => {
                        const found = safeEquipmentList.find((x) => x.id === e.target.value);
                        if (found) setSelectedEquipment(found);
                      }}
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 font-bold"
                    >
                      {safeEquipmentList.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.code} - {eq.name} ({eq.area})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-500 block">Vibración Actual:</span>
                      <span className="text-cyan-300 font-bold">{selectedEquipment?.vibrationRMS || 2.4} mm/s</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Temperatura:</span>
                      <span className="text-amber-300 font-bold">{selectedEquipment?.temperatureC || 60} °C</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Título de la Intervención:</label>
                    <input
                      type="text"
                      placeholder={`Ej: Inspección predictiva ${selectedEquipment?.code}`}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Tipo de Mantenimiento:</label>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as any)}
                        className="w-full bg-slate-900 text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700"
                      >
                        <option value="PREDICTIVO">Predictivo (CBM)</option>
                        <option value="PREVENTIVO">Preventivo</option>
                        <option value="CORRECTIVO">Correctivo</option>
                        <option value="LUBRICACION">Lubricación</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Nivel de Prioridad:</label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value as any)}
                        className="w-full bg-slate-900 text-slate-200 px-2 py-1.5 rounded-lg border border-slate-700 font-bold"
                      >
                        <option value="URGENTE">Urgente</option>
                        <option value="ALTA">Alta</option>
                        <option value="MEDIA">Media</option>
                        <option value="BAJA">Baja</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tasks & Technicians */}
                <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1">
                    2. Asignación & Tareas CMMS
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Técnico / Responsable:</label>
                      <input
                        type="text"
                        value={newAssigned}
                        onChange={(e) => setNewAssigned(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-sans"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Horas Estimadas (HH):</label>
                      <input
                        type="number"
                        step="0.5"
                        value={newHours}
                        onChange={(e) => setNewHours(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold"
                      />
                    </div>
                  </div>

                  {/* Task list builder */}
                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Checklist de Actividades:</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {customTasks.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[11px] text-slate-300"
                        >
                          <span className="truncate">{t}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomTask(idx)}
                            className="text-slate-500 hover:text-rose-400 font-bold text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <input
                        type="text"
                        placeholder="Nueva tarea técnica..."
                        value={newTaskInput}
                        onChange={(e) => setNewTaskInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomTask();
                          }
                        }}
                        className="flex-1 bg-slate-900 text-slate-200 px-2 py-1 rounded border border-slate-700 text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomTask}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold"
                      >
                        + Agregar
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Descripción / Repuestos Requeridos:</label>
                    <textarea
                      rows={2}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Protocolos de seguridad LOTO, permisos de trabajo en caliente y herramientas..."
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-sans text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddWOModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!rbacAddWO.allowed}
                  className={`px-5 py-2 rounded-lg font-bold text-xs font-mono transition shadow-lg ${
                    rbacAddWO.allowed
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  Registrar OT en Cloud Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
