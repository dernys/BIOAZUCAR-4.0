import React, { useState } from "react";
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
  Sliders
} from "lucide-react";
import { CaneBatch, UserRole } from "../types";

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

  // New batch form state
  const [newPlate, setNewPlate] = useState("TRK-7720");
  const [newFarm, setNewFarm] = useState("Finca La Esperanza - Tablón 05");
  const [newGrower, setNewGrower] = useState("Agroindustrias del Valle");
  const [newVariety, setNewVariety] = useState("CP 72-2086");
  const [newWeight, setNewWeight] = useState("41.5");
  const [newBrix, setNewBrix] = useState("19.2");
  const [newPol, setNewPol] = useState("16.1");

  const filteredBatches = safeBatches.filter(
    (b) =>
      (b.batchCode || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.truckPlate || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.farmOrigin || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.growerName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const brix = parseFloat(newBrix) || 19.0;
    const pol = parseFloat(newPol) || 16.0;
    const purity = +((pol / brix) * 100).toFixed(1);
    const weight = parseFloat(newWeight) || 40.0;

    const newCaneBatch: CaneBatch = {
      id: "bat-" + Date.now(),
      batchCode: "LOT-CA-" + Math.floor(1000 + Math.random() * 9000),
      truckPlate: newPlate,
      farmOrigin: newFarm,
      growerName: newGrower,
      caneVariety: newVariety,
      netWeightTons: weight,
      brixPercent: brix,
      polPercent: pol,
      purityPercent: purity,
      trashPercent: 3.0,
      fiberPercent: 13.5,
      cutDateTime: new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 16).replace("T", " "),
      arrivalDateTime: new Date().toISOString().slice(0, 16).replace("T", " "),
      status: "EN_MUESTREO",
      sugarYieldEstimated: +(weight * (pol / 100) * 0.88).toFixed(2),
    };

    onAddBatch(newCaneBatch);
    setSelectedBatch(newCaneBatch);
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white font-tech tracking-wider flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            Gestión de Lotes de Caña & Trazabilidad de Producción
          </h2>
          <p className="text-xs text-slate-400">
            Control de materia prima, análisis de laboratorio Core Sampler y trazabilidad de extremo a extremo
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

          {/* Add Cane Truck Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Camión Báscula</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Batches Table + Traceability Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Table: Cane Batches (8 cols) */}
        <div className="lg:col-span-8 bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-3.5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-400" />
              Recepción de Caña en Báscula & Patios ({filteredBatches.length})
            </span>
            <span className="text-[11px] text-slate-400 font-mono">Tiempo máx corte-molienda: &lt; 18h</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono border-b border-slate-800">
                <tr>
                  <th className="p-3">Lote / Camión</th>
                  <th className="p-3">Origen / Finca</th>
                  <th className="p-3 text-right">Peso Neto (t)</th>
                  <th className="p-3 text-center">Brix / Pol / Pur</th>
                  <th className="p-3 text-center">Azúcar Est. (t)</th>
                  <th className="p-3 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredBatches.map((batch) => {
                  const isSelected = selectedBatch?.id === batch.id;
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
                        <div className="text-[10px] text-slate-400">{batch.caneVariety}</div>
                      </td>
                      <td className="p-3 text-right font-mono text-white font-bold">
                        {batch.netWeightTons} t
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="text-emerald-400">{batch.brixPercent}°Bx</span> /{" "}
                        <span className="text-cyan-400">{batch.polPercent}%</span> /{" "}
                        <span className="text-slate-300">{batch.purityPercent}%</span>
                      </td>
                      <td className="p-3 text-center font-mono text-yellow-300 font-bold">
                        {batch.sugarYieldEstimated} t
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            batch.status === "EN_MOLIENDA"
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                              : batch.status === "PROCESADO"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
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

        {/* Right Details: Full Traceability Passport (4 cols) */}
        <div className="lg:col-span-4 bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          {selectedBatch ? (
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-emerald-400 block">Pasaporte de Trazabilidad</span>
                  <h3 className="text-base font-bold text-white font-tech">{selectedBatch.batchCode}</h3>
                </div>
                <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
                  {selectedBatch.truckPlate}
                </span>
              </div>

              {/* Step-by-step Traceability Pipeline */}
              <div className="mt-4 space-y-3.5">
                {/* Step 1: Campo */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 border border-emerald-500/40">
                    1
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      Origen Agrícola
                    </span>
                    <span className="text-white font-medium block">{selectedBatch.farmOrigin}</span>
                    <span className="text-slate-400 text-[11px]">
                      Variedad: {selectedBatch.caneVariety} • Corte: {selectedBatch.cutDateTime}
                    </span>
                  </div>
                </div>

                {/* Step 2: Calidad Laboratorio */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 border border-cyan-500/40">
                    2
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      Análisis Core Sampler (LIMS)
                    </span>
                    <div className="grid grid-cols-3 gap-2 mt-1 font-mono text-[11px] bg-slate-950/60 p-2 rounded border border-slate-800">
                      <div>
                        <span className="text-slate-500 text-[9px] block">BRIX</span>
                        <span className="text-emerald-400 font-bold">{selectedBatch.brixPercent}°</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] block">POL</span>
                        <span className="text-cyan-400 font-bold">{selectedBatch.polPercent}%</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[9px] block">PUREZA</span>
                        <span className="text-slate-200 font-bold">{selectedBatch.purityPercent}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 3: Molienda & Extracción */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 border border-amber-500/40">
                    3
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      Tándem de Molienda
                    </span>
                    <span className="text-slate-300 block">
                      Extracción estimada: <strong className="text-emerald-400 font-mono">96.5%</strong>
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Bagazo generado estimado: {(selectedBatch.netWeightTons * 0.295).toFixed(1)} t
                    </span>
                  </div>
                </div>

                {/* Step 4: Lote Azúcar Final */}
                <div className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 border border-indigo-500/40">
                    4
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-semibold">
                      Lote Ensacado Vinculado
                    </span>
                    <span className="text-emerald-300 font-mono font-bold block">
                      AZ-2026-{selectedBatch.batchCode.replace("LOT-CA-", "B")}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Equivalente a {Math.floor(selectedBatch.sugarYieldEstimated * 20)} sacos de 50 kg
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Certificación fitosanitaria y pureza sacarosa conforme a estándar ISO 22000.</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-400 text-xs py-8">
              Selecciona un lote para ver su trazabilidad.
            </div>
          )}
        </div>
      </div>

      {/* Add Truck Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-bold text-white font-tech mb-1">
              Registrar Entrada de Caña (Báscula 01)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Ingreso de camión cañero y datos preliminares de laboratorio
            </p>

            <form onSubmit={handleCreateBatch} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Placa Camión / Jaula</label>
                <input
                  type="text"
                  required
                  value={newPlate}
                  onChange={(e) => setNewPlate(e.target.value)}
                  className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Finca / Tablón de Origen</label>
                <input
                  type="text"
                  required
                  value={newFarm}
                  onChange={(e) => setNewFarm(e.target.value)}
                  className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">Peso Neto (t)</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">Variedad Caña</label>
                  <input
                    type="text"
                    required
                    value={newVariety}
                    onChange={(e) => setNewVariety(e.target.value)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-300 block mb-1">°Brix Jugo Crudo</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newBrix}
                    onChange={(e) => setNewBrix(e.target.value)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">% Pol Sacarosa</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newPol}
                    onChange={(e) => setNewPol(e.target.value)}
                    className="w-full bg-slate-950 text-white rounded-lg p-2 border border-slate-700 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
                >
                  Registrar en MES
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
