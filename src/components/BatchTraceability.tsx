import React, { useState, useMemo } from "react";
import {
  Layers,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  Wheat,
  Scale,
  FileSpreadsheet,
  ArrowRight,
  ShieldAlert,
  Sliders,
  FlaskConical,
  TestTube,
  DollarSign,
  QrCode,
  Sparkles,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Info,
  Zap,
} from "lucide-react";
import { CaneBatch, UserRole } from "../types";
import { checkRbacPermission, getRoleBadgeInfo } from "../services/rbacService";

interface BatchTraceabilityProps {
  batches: CaneBatch[];
  onAddBatch: (batch: CaneBatch) => void;
  currentRole: UserRole;
}

export const BatchTraceability: React.FC<BatchTraceabilityProps> = ({
  batches = [],
  onAddBatch,
  currentRole,
}) => {
  const safeBatches = Array.isArray(batches) ? batches : [];
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<CaneBatch | null>(safeBatches[0] || null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // New batch form state
  const [newPlate, setNewPlate] = useState("TRK-7720");
  const [newFarm, setNewFarm] = useState("Finca La Esperanza - Tablón 05");
  const [newGrower, setNewGrower] = useState("Agroindustrias del Valle S.A.");
  const [newVariety, setNewVariety] = useState("CP 72-2086");
  const [newGrossWeight, setNewGrossWeight] = useState("58.4");
  const [newTareWeight, setNewTareWeight] = useState("16.8");
  const [newBrix, setNewBrix] = useState("19.4");
  const [newPol, setNewPol] = useState("16.2");
  const [newFiber, setNewFiber] = useState("13.2");
  const [newTrash, setNewTrash] = useState("2.8");
  const [newDextran, setNewDextran] = useState("145"); // ppm

  // RBAC Permission Check
  const rbacCheck = useMemo(
    () => checkRbacPermission(currentRole, "ADD_CANE_BATCH"),
    [currentRole]
  );
  const roleBadge = getRoleBadgeInfo(currentRole);

  // Live Calculations for Modal
  const computedNet = useMemo(() => {
    const gross = parseFloat(newGrossWeight) || 0;
    const tare = parseFloat(newTareWeight) || 0;
    return Math.max(0, +(gross - tare).toFixed(2));
  }, [newGrossWeight, newTareWeight]);

  const computedPurity = useMemo(() => {
    const brix = parseFloat(newBrix) || 1;
    const pol = parseFloat(newPol) || 0;
    return +((pol / brix) * 100).toFixed(1);
  }, [newBrix, newPol]);

  const computedAre = useMemo(() => {
    const brix = parseFloat(newBrix) || 19;
    const pol = parseFloat(newPol) || 16;
    const trash = parseFloat(newTrash) || 3;
    // ARE = (Pol * 0.98 - (Brix - Pol) * 0.40 - Trash * 0.25) * 10
    const val = (pol * 0.98 - (brix - pol) * 0.40 - trash * 0.25) * 10;
    return +Math.max(80, val).toFixed(1);
  }, [newBrix, newPol, newTrash]);

  const computedPaymentUSD = useMemo(() => {
    const dextran = parseFloat(newDextran) || 0;
    const base = computedAre * 0.38;
    const penalty = dextran > 300 ? 2.5 : 0;
    return +Math.max(20, base - penalty).toFixed(2);
  }, [computedAre, newDextran]);

  const computedSugarTons = useMemo(() => {
    return +(computedNet * (computedAre / 1000)).toFixed(2);
  }, [computedNet, computedAre]);

  const filteredBatches = safeBatches.filter((b) => {
    const matchesSearch =
      (b.batchCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.truckPlate || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.farmOrigin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.growerName || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApplyPreset = (type: "OPTIMAL" | "HIGH_TRASH" | "DELAYED") => {
    if (type === "OPTIMAL") {
      setNewBrix("20.2");
      setNewPol("17.4");
      setNewTrash("2.2");
      setNewDextran("90");
    } else if (type === "HIGH_TRASH") {
      setNewBrix("18.1");
      setNewPol("14.5");
      setNewTrash("5.8");
      setNewDextran("180");
    } else {
      setNewBrix("17.8");
      setNewPol("13.9");
      setNewTrash("3.5");
      setNewDextran("420"); // High dextran penalty
    }
  };

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rbacCheck.allowed) return;

    const gross = parseFloat(newGrossWeight) || 55.0;
    const tare = parseFloat(newTareWeight) || 15.0;
    const brix = parseFloat(newBrix) || 19.0;
    const pol = parseFloat(newPol) || 16.0;
    const fiber = parseFloat(newFiber) || 13.0;
    const trash = parseFloat(newTrash) || 3.0;
    const dextran = parseFloat(newDextran) || 120;

    const newCaneBatch: CaneBatch = {
      id: "bat-" + Date.now(),
      batchCode: "LOT-CA-" + Math.floor(1000 + Math.random() * 9000),
      truckPlate: newPlate.toUpperCase(),
      farmOrigin: newFarm,
      growerName: newGrower,
      caneVariety: newVariety,
      grossWeightTons: gross,
      tareWeightTons: tare,
      netWeightTons: computedNet,
      brixPercent: brix,
      polPercent: pol,
      purityPercent: computedPurity,
      trashPercent: trash,
      fiberPercent: fiber,
      dextranPpm: dextran,
      areKgPerTon: computedAre,
      canePaymentIndexUSD: computedPaymentUSD,
      cutDateTime: new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 16).replace("T", " "),
      arrivalDateTime: new Date().toISOString().slice(0, 16).replace("T", " "),
      status: "EN_MUESTREO",
      sugarYieldEstimated: computedSugarTons,
    };

    onAddBatch(newCaneBatch);
    setSelectedBatch(newCaneBatch);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            LIMS, Laboratorio de Caña & Trazabilidad Integral
          </h2>
          <p className="text-xs text-slate-400">
            Muestreador Core Sampler hidráulico, análisis NIR sacarosa, cálculo de ARE y liquidación cañera
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar lote, camión, finca..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-slate-950 text-xs text-slate-200 rounded-lg pl-9 pr-3 py-1.5 border border-slate-800 focus:outline-none focus:border-emerald-500 w-56 font-mono"
            />
          </div>

          {/* Add Cane Truck Button with RBAC Protection */}
          <button
            onClick={() => setShowAddModal(true)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-lg ${
              rbacCheck.allowed
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-amber-500/40"
            }`}
            title={rbacCheck.allowed ? "Registrar camión báscula" : rbacCheck.reason}
          >
            {rbacCheck.allowed ? (
              <Plus className="w-3.5 h-3.5" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>Registrar Camión Báscula</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Batches Table + Traceability Passport & Core Sampler */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Table: Cane Batches (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              Recepción de Caña en Báscula & Patios ({filteredBatches.length})
            </span>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-slate-400">Filtrar:</span>
              {(["ALL", "EN_MUESTREO", "EN_PATIO", "EN_MOLIENDA", "PROCESADO"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-0.5 rounded text-[10px] transition ${
                    statusFilter === st
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {st === "ALL" ? "Todos" : st}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Lote / Camión</th>
                  <th className="p-3">Origen / Cañero</th>
                  <th className="p-3 text-right">Peso Neto (t)</th>
                  <th className="p-3 text-center">Brix / Pol / Pur</th>
                  <th className="p-3 text-center">ARE (kg/t)</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBatches.map((batch) => {
                  const isSelected = selectedBatch?.id === batch.id;
                  const areVal = batch.areKgPerTon || Math.round(batch.polPercent * 8.2);

                  return (
                    <tr
                      key={batch.id}
                      onClick={() => setSelectedBatch(batch)}
                      className={`cursor-pointer transition ${
                        isSelected ? "bg-emerald-500/10 font-semibold" : "hover:bg-slate-800/40 text-slate-300"
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-mono text-white font-bold">{batch.batchCode}</div>
                        <div className="text-[11px] text-slate-400">{batch.truckPlate}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-slate-200">{batch.farmOrigin}</div>
                        <div className="text-[10px] text-slate-400">{batch.growerName}</div>
                      </td>
                      <td className="p-3 text-right font-mono text-white font-bold">
                        {batch.netWeightTons} t
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="text-emerald-400">{batch.brixPercent}°Bx</span> /{" "}
                        <span className="text-cyan-400">{batch.polPercent}%</span> /{" "}
                        <span className="text-slate-300">{batch.purityPercent}%</span>
                      </td>
                      <td className="p-3 text-center font-mono text-amber-300 font-bold">
                        {areVal} kg/t
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            batch.status === "EN_MOLIENDA"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                              : batch.status === "PROCESADO"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : batch.status === "EN_MUESTREO"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {batch.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Details: Full Traceability Passport & Core Sampler LIMS */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
          {selectedBatch ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 block">LIMS & Pasaporte de Trazabilidad</span>
                  <h3 className="text-base font-bold text-white font-tech">{selectedBatch.batchCode}</h3>
                </div>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                  {selectedBatch.truckPlate}
                </span>
              </div>

              {/* Core Sampler LIMS Report Card */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" />
                    Core Sampler NIR
                  </span>
                  <span>ARE: {selectedBatch.areKgPerTon || 128.4} kg/t</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Brix Jugo Crudo:</span>
                    <span className="text-white font-bold">{selectedBatch.brixPercent} °Bx</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Pol Sacarosa:</span>
                    <span className="text-cyan-300 font-bold">{selectedBatch.polPercent}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Pureza Aparente:</span>
                    <span className="text-emerald-300 font-bold">{selectedBatch.purityPercent}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Materia Extraña (Trash):</span>
                    <span className="text-amber-400 font-bold">{selectedBatch.trashPercent || 3.1}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dextrano (Deterioro):</span>
                    <span className="text-slate-300 font-bold">{selectedBatch.dextranPpm || 140} ppm</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Liquidación Cañero:</span>
                    <span className="text-amber-300 font-bold">${selectedBatch.canePaymentIndexUSD || 48.50} USD/t</span>
                  </div>
                </div>
              </div>

              {/* Step-by-step Traceability Pipeline */}
              <div className="space-y-3">
                {/* Step 1: Campo */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 border border-emerald-500/40">
                    1
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Origen Agrícola
                    </span>
                    <span className="text-white font-medium block">{selectedBatch.farmOrigin}</span>
                    <span className="text-slate-400 text-[11px]">
                      Variedad: {selectedBatch.caneVariety} • Productor: {selectedBatch.growerName}
                    </span>
                  </div>
                </div>

                {/* Step 2: Pesaje Báscula */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 border border-cyan-500/40">
                    2
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Pesaje Automático
                    </span>
                    <span className="text-white font-medium block">
                      Neto: {selectedBatch.netWeightTons} t (Bruto: {selectedBatch.grossWeightTons || 58.2} t)
                    </span>
                    <span className="text-slate-400 text-[11px]">Llegada: {selectedBatch.arrivalDateTime}</span>
                  </div>
                </div>

                {/* Step 3: Proyección Fabril */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5 border border-amber-500/40">
                    3
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Proyección de Azúcar & Bagazo
                    </span>
                    <span className="text-yellow-300 font-bold block">
                      Azúcar Estimada: {selectedBatch.sugarYieldEstimated} toneladas (~{Math.round(selectedBatch.sugarYieldEstimated * 20)} sacos)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              Selecciona un lote para ver su análisis LIMS y pasaporte de trazabilidad
            </div>
          )}
        </div>
      </div>

      {/* OPTIMIZED CONTEXT-AWARE MODAL: Registrar Camión Báscula & Core Sampler */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase font-tech">
                    Recepción Báscula & Muestreo Core Sampler (LIMS)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                      Operador Activo: {roleBadge.label} ({roleBadge.clearance})
                    </span>
                    {rbacCheck.allowed ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                        <ShieldCheck className="w-3 h-3" /> Autorizado
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-400 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3" /> No Autorizado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs font-mono transition"
              >
                ✕
              </button>
            </div>

            {/* RBAC Warning Banner if restricted */}
            {!rbacCheck.allowed && (
              <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <span className="font-bold block">Control de Acceso RBAC: Acción Restringida</span>
                  <p className="text-[11px] text-rose-200/90 mt-0.5">
                    {rbacCheck.reason} Cambia a rol <strong>Operador</strong>, <strong>Supervisor</strong> o <strong>Administrador</strong> en el menú superior para desbloquear la inserción.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Presets */}
            <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Cargar Presets de Muestreo:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleApplyPreset("OPTIMAL")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-500/20 text-emerald-300 border border-slate-700 text-[10px]"
                >
                  Caña Óptima
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("HIGH_TRASH")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-500/20 text-amber-300 border border-slate-700 text-[10px]"
                >
                  Con Trash Alto
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset("DELAYED")}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-slate-700 text-[10px]"
                >
                  Caña Demorada (&gt;24h)
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateBatch} className="space-y-4 text-xs font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Logistics & Weighbridge */}
                <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5" />
                    1. Báscula & Logística
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Placa Camión:</label>
                      <input
                        type="text"
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Variedad Caña:</label>
                      <input
                        type="text"
                        value={newVariety}
                        onChange={(e) => setNewVariety(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Finca / Sector Origen:</label>
                    <input
                      type="text"
                      value={newFarm}
                      onChange={(e) => setNewFarm(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Cañero / Productor:</label>
                    <input
                      type="text"
                      value={newGrower}
                      onChange={(e) => setNewGrower(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Peso Bruto (t):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newGrossWeight}
                        onChange={(e) => setNewGrossWeight(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">Peso Tara (t):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newTareWeight}
                        onChange={(e) => setNewTareWeight(e.target.value)}
                        className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: LIMS Core Sampler NIR Lab */}
                <div className="space-y-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block border-b border-slate-800 pb-1 flex items-center gap-1.5">
                    <FlaskConical className="w-3.5 h-3.5" />
                    2. Análisis LIMS Core Sampler
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">°Brix Refractométrico:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newBrix}
                        onChange={(e) => setNewBrix(e.target.value)}
                        className="w-full bg-slate-900 text-emerald-300 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">% Pol Sacarosa:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newPol}
                        onChange={(e) => setNewPol(e.target.value)}
                        className="w-full bg-slate-900 text-cyan-300 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">% Trash (Materia Extraña):</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newTrash}
                        onChange={(e) => setNewTrash(e.target.value)}
                        className="w-full bg-slate-900 text-amber-300 font-bold px-2.5 py-1.5 rounded-lg border border-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1 text-[10px]">% Fibra Caña:</label>
                      <input
                        type="number"
                        step="0.1"
                        value={newFiber}
                        onChange={(e) => setNewFiber(e.target.value)}
                        className="w-full bg-slate-900 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-[10px]">Dextrano (ppm degradación post-corte):</label>
                    <input
                      type="number"
                      value={newDextran}
                      onChange={(e) => setNewDextran(e.target.value)}
                      className="w-full bg-slate-900 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Real-time Computed Industrial Preview Card */}
              <div className="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block">Peso Neto Calculado:</span>
                  <span className="text-sm font-bold text-white font-mono">{computedNet} t</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Pureza Aparente:</span>
                  <span className="text-sm font-bold text-emerald-300 font-mono">{computedPurity}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">ARE Estimado:</span>
                  <span className="text-sm font-bold text-amber-300 font-mono">{computedAre} kg/t</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Liquidación Sugerida:</span>
                  <span className="text-sm font-bold text-cyan-300 font-mono">${computedPaymentUSD} /t</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!rbacCheck.allowed}
                  className={`px-5 py-2 rounded-lg font-bold text-xs font-mono transition shadow-lg ${
                    rbacCheck.allowed
                      ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  Ingresar a Patio & Generar Lote Firestore
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
