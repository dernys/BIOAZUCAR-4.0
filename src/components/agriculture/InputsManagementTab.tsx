import React, { useState } from "react";
import {
  Sprout,
  Plus,
  Search,
  Filter,
  Edit3,
  Trash2,
  DollarSign,
  Layers,
  Sparkles,
  Archive,
  RefreshCw,
} from "lucide-react";
import { AgriculturalInputMaster } from "../../types/agriculture";

interface InputsManagementTabProps {
  inputs: AgriculturalInputMaster[];
  onCreateInput: () => void;
  onEditInput: (input: AgriculturalInputMaster) => void;
  onDeleteInput: (inputId: string) => void;
  theme?: "dark" | "light";
}

export const InputsManagementTab: React.FC<InputsManagementTabProps> = ({
  inputs,
  onCreateInput,
  onEditInput,
  onDeleteInput,
  theme = "dark",
}) => {
  const isLight = theme === "light";
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = inputs.filter((inp) => {
    const matchCat = filterCat === "ALL" || inp.category === filterCat;
    const matchSearch =
      searchTerm === "" ||
      inp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inp.activeIngredient && inp.activeIngredient.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div
        className={`p-5 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              Catálogo Maestro de Insumos & Dosis Agronómicas
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Fertilizantes químicos, herbicidas, maduradores fisiológicos y reciclaje de subproductos industriales
          </p>
        </div>

        <button
          onClick={onCreateInput}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Insumo</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
          isLight ? "bg-white border-slate-200" : "bg-slate-900 border-slate-800"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Categoría:</span>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border outline-hidden ${
              isLight
                ? "bg-slate-50 border-slate-300 text-slate-800"
                : "bg-slate-800 border-slate-700 text-slate-200"
            }`}
          >
            <option value="ALL">Todas las Categorías ({inputs.length})</option>
            <option value="FERTILIZANTE">Fertilizantes</option>
            <option value="HERBICIDA">Herbicidas</option>
            <option value="MADURADOR">Maduradores</option>
            <option value="SUBPRODUCTO_FABRIL">Subproductos Fabriles (Vinaza / Cachaza)</option>
            <option value="ENMIENDA">Enmiendas</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Buscar por código o producto..."
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

      {/* Inputs Table */}
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
                <th className="p-3">Código</th>
                <th className="p-3">Producto / Fórmula</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Dosis Estándar</th>
                <th className="p-3">Coste Unitario</th>
                <th className="p-3">Coste por Ha</th>
                <th className="p-3">Etapa Destino</th>
                <th className="p-3">Ingrediente Activo</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center text-slate-400">
                    No se encontraron insumos con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const costPerHa = item.standardDosePerHa * item.unitCostUSD;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/20 transition">
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {item.code}
                      </td>
                      <td className="p-3 font-semibold text-slate-200">
                        {item.name}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                          {item.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        {item.standardDosePerHa} {item.unit}
                      </td>
                      <td className="p-3 font-mono text-slate-300">
                        ${item.unitCostUSD.toFixed(2)} /{item.unit.split("/")[0] || "u"}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-400">
                        ${costPerHa.toFixed(2)} /ha
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] text-slate-400">
                          {item.targetCycle === "PLANTA"
                            ? "Planta"
                            : item.targetCycle === "SOCA_RETONO"
                            ? "Socas"
                            : "Planta & Soca"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 italic">
                        {item.activeIngredient || "—"}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            item.status === "ACTIVO"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-slate-800 text-slate-500"
                          }`}
                        >
                          {item.status || "ACTIVO"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEditInput(item)}
                            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            title="Editar Insumo"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteInput(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title="Eliminar / Archivar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
