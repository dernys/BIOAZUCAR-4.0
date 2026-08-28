import React, { useState } from "react";
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
  Thermometer
} from "lucide-react";
import { EquipmentItem, WorkOrder, UserRole } from "../types";

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

  // New WO form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<"PREVENTIVO" | "CORRECTIVO" | "PREDICTIVO" | "LUBRICACION">("PREVENTIVO");
  const [newPriority, setNewPriority] = useState<"URGENTE" | "ALTA" | "MEDIA" | "BAJA">("ALTA");
  const [newAssigned, setNewAssigned] = useState("Ing. Roberto Salazar");
  const [newHours, setNewHours] = useState("2.0");
  const [newDesc, setNewDesc] = useState("");

  const filteredEquipments = safeEquipmentList.filter(
    (e) =>
      (e.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.area || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleTask = (wo: WorkOrder, taskId: string) => {
    const updatedTasks = wo.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    const allDone = updatedTasks.every((t) => t.done);
    onUpdateWorkOrder({
      ...wo,
      tasks: updatedTasks,
      status: allDone ? "COMPLETADA" : "EN_PROCESO",
    });
  };

  const handleCreateWO = (e: React.FormEvent) => {
    e.preventDefault();
    const newWO: WorkOrder = {
      id: "wo-" + Date.now(),
      code: "OT-2026-" + Math.floor(100 + Math.random() * 900),
      equipmentId: selectedEquipment.id,
      equipmentName: selectedEquipment.name,
      title: newTitle || `Mantenimiento en ${selectedEquipment.code}`,
      type: newType,
      priority: newPriority,
      status: "PENDIENTE",
      assignedTo: newAssigned,
      createdDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
      estimatedHours: parseFloat(newHours) || 2.0,
      description: newDesc || "Inspección técnica programada por CMMS.",
      tasks: [
        { id: "t1", text: "Inspección visual y termográfica", done: false },
        { id: "t2", text: "Comprobación de nivel y retorno de aceite", done: false },
        { id: "t3", text: "Prueba de giro y verificación de vibración", done: false },
      ],
    };

    onAddWorkOrder(newWO);
    setShowAddWOModal(false);
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
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
              const isSelected = selectedEquipment.id === eq.id;
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
                      <span className="text-xs font-bold text-white font-tech">{eq.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                        {eq.code}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3">
                      <span>Área: <strong className="text-slate-300">{eq.area}</strong></span>
                      <span>Horas: <strong className="text-slate-300 font-mono">{eq.hoursRun} h</strong></span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] text-slate-400">Salud:</span>
                      <span className="text-xs font-bold font-mono text-emerald-400">
                        {eq.healthIndex}%
                      </span>
                    </div>
                    <div className="text-[11px] font-mono">
                      Vib:{" "}
                      <span
                        className={`font-bold ${
                          eq.vibrationRMS > eq.vibrationThreshold
                            ? "text-amber-400"
                            : "text-slate-300"
                        }`}
                      >
                        {eq.vibrationRMS} mm/s
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Vibration Spectrum & Work Orders for Selected Equipment (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Box 1: Real-time Vibration & Health Diagnostics */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-400 block">
                  Análisis Espectral de Vibración (FFT)
                </span>
                <h3 className="text-sm font-bold text-white font-tech">{selectedEquipment.name}</h3>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  selectedEquipment.status === "WARNING"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {selectedEquipment.status}
              </span>
            </div>

            {/* Vibration KPIs */}
            <div className="grid grid-cols-3 gap-2 mb-4 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Vibración Global</span>
                <span
                  className={`text-base font-bold ${
                    selectedEquipment.vibrationRMS > selectedEquipment.vibrationThreshold
                      ? "text-amber-400"
                      : "text-white"
                  }`}
                >
                  {selectedEquipment.vibrationRMS} mm/s
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Umbral Alarma</span>
                <span className="text-base font-bold text-slate-300 font-tech">
                  {selectedEquipment.vibrationThreshold} mm/s
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-slate-500 text-[10px] block">Temperatura</span>
                <span className="text-base font-bold text-cyan-400 font-tech">
                  {selectedEquipment.temperatureC} °C
                </span>
              </div>
            </div>

            {/* Simulated Spectral FFT Chart Bars */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-2">
                Espectro de Frecuencia (1X Desbalance vs 2X Desalineación vs Armónicos)
              </span>
              <div className="h-28 flex items-end justify-between gap-1.5 px-2 pt-4 pb-1 border-b border-slate-800 font-mono text-[9px] text-slate-500">
                {[
                  { freq: "1X (12Hz)", val: 45, label: "Giro" },
                  { freq: "2X (24Hz)", val: selectedEquipment.id === "eq-molino-3" ? 82 : 28, label: "Desal." },
                  { freq: "3X (36Hz)", val: 22, label: "Holgura" },
                  { freq: "4X (48Hz)", val: 15, label: "Armón." },
                  { freq: "BPFO (95Hz)", val: 32, label: "Pista Ext." },
                  { freq: "BPFI (140Hz)", val: 18, label: "Pista Int." },
                  { freq: "GMF (280Hz)", val: 40, label: "Engrane" },
                ].map((bar, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-t transition-all duration-500 ${
                        bar.val > 60
                          ? "bg-amber-400 shadow-lg shadow-amber-400/30"
                          : "bg-emerald-500/80"
                      }`}
                      style={{ height: `${bar.val}%` }}
                    ></div>
                    <span className="text-[8px] text-slate-400">{bar.freq.split(" ")[0]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Box 2: Work Orders for This Machinery */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-white font-tech uppercase tracking-wider flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                Órdenes de Trabajo Activas ({workOrders.length})
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">CMMS / RCM</span>
            </div>

            <div className="space-y-3">
              {workOrders.map((wo) => (
                <div
                  key={wo.id}
                  className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-emerald-400 font-bold mr-2">{wo.code}</span>
                      <span className="text-white font-semibold">{wo.title}</span>
                    </div>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold ${
                        wo.status === "COMPLETADA"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : wo.status === "EN_PROCESO"
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {wo.status}
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px] leading-relaxed">{wo.description}</p>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
                      Lista de Verificación de Campo:
                    </span>
                    {wo.tasks.map((task) => (
                      <label
                        key={task.id}
                        className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white"
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => handleToggleTask(wo, task.id)}
                          className="rounded text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                        <span className={task.done ? "line-through text-slate-500" : ""}>
                          {task.text}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Asignado a: <strong className="text-slate-200">{wo.assignedTo}</strong></span>
                    <span>Vencimiento: <strong className="text-slate-200 font-mono">{wo.dueDate}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Work Order Modal */}
      {showAddWOModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white font-tech mb-1">
              Nueva Orden de Trabajo (CMMS)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Equipo destino: <strong className="text-white">{selectedEquipment.name}</strong> ({selectedEquipment.code})
            </p>

            <form onSubmit={handleCreateWO} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Título de la Actividad</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Revisión y reapriete de chumaceras"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Tipo de Mantenimiento</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                  >
                    <option value="PREVENTIVO">Preventivo</option>
                    <option value="PREDICTIVO">Predictivo (Vibración)</option>
                    <option value="CORRECTIVO">Correctivo</option>
                    <option value="LUBRICACION">Lubricación</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Prioridad</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                  >
                    <option value="URGENTE">Urgente</option>
                    <option value="ALTA">Alta</option>
                    <option value="MEDIA">Media</option>
                    <option value="BAJA">Baja</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Responsable / Especialista</label>
                <input
                  type="text"
                  required
                  value={newAssigned}
                  onChange={(e) => setNewAssigned(e.target.value)}
                  className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Descripción de las Tareas</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Detalles sobre herramientas, repuestos y protocolos de seguridad..."
                  className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddWOModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Crear OT en CMMS
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
