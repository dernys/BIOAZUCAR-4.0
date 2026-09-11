import React from "react";
import { X, Cpu, Calculator, Sparkles, ArrowRight, Activity, Gauge, Truck, DollarSign } from "lucide-react";

interface FormulaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

export const FormulaViewerModal: React.FC<FormulaViewerModalProps> = ({
  isOpen,
  onClose,
  theme = "dark",
}) => {
  const isLight = theme === "light";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden transition-all my-8 ${
          isLight ? "bg-white border-slate-200 text-slate-900" : "bg-slate-900 border-slate-800 text-slate-100"
        }`}
      >
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/60 border-slate-800"}`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-mono tracking-wide">
                Motor Matemático & Fórmulas Agronómicas de BioAzúcar 4.0
              </h2>
              <p className="text-xs text-slate-400">
                Ecuaciones físicas, balances de masa y reglas de cálculo del sistema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-sm">
          {/* Formula 1: TCH y Producción */}
          <div className={`p-4 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-700/60"}`}>
            <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-sm">
              <Activity className="w-4 h-4" />
              <span>1. Rendimiento Agrícola (TCH) y Producción de Campo</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 font-mono text-xs md:text-sm text-emerald-300 border border-emerald-500/20">
              TCH_proyectado = TCH_base × Factor_Cepa × Factor_Suelo × Factor_Clima
              <br />
              Produccion_Toneladas = Area_Hectareas × TCH_proyectado
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Calcula la biomasa cosechable por parcela ponderando el vigor intrínseco del cultivar, el orden de corte (cepa planta vs ratoon soca 1 a 7+), la capacidad de intercambio catiónico/textura del suelo (franco, arcilloso o arenoso) y anomalías pluviométricas o climáticas de zafra.
            </p>
          </div>

          {/* Formula 2: Balance de Áreas */}
          <div className={`p-4 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-700/60"}`}>
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
              <Gauge className="w-4 h-4" />
              <span>2. Balance Dinámico de Áreas Cañeras</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 font-mono text-xs md:text-sm text-cyan-300 border border-cyan-500/20">
              Area_Final = Area_Inicial + Area_Plantada - Area_Demolida + Altas_Tierras - Bajas_Tierras
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Conserva la integridad geométrica y catastral del patrimonio agrícola entre zafras consecutivas, garantizando que la rotación y el barbecho mantengan la tasa anual de renovación planificada (típicamente 15% - 20%).
            </p>
          </div>

          {/* Formula 3: Ciclo CCT de Transporte */}
          <div className={`p-4 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-700/60"}`}>
            <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-sm">
              <Truck className="w-4 h-4" />
              <span>3. Logística CCT (Corte, Alce y Transporte) & Flota de Camiones</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 font-mono text-xs md:text-sm text-amber-300 border border-amber-500/20">
              Tiempo_Transito = (Distancia / Vel_Vacio) + (Distancia / Vel_Cargado)
              <br />
              Tiempo_Ciclo_Total = Tiempo_Transito + T_AlceCampo + T_DescargaIngenio + T_ColasBascula
              <br />
              Viajes_Dia = (24h × Factor_Utilizacion) / Tiempo_Ciclo_Total
              <br />
              Camiones_Requeridos = ⌈ Demanda_Molienda_Diaria / (Viajes_Dia × Capacidad_Camion) ⌉
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Dimensiona los camiones bi-tren o trenes cañeros rodoviarios requeridos para asegurar el flujo continuo de materia prima al basculador del tándem de molinos, evitando paradas de fábrica por falta de caña (*Cane Stoppage Risk*).
            </p>
          </div>

          {/* Formula 4: Balances de Insumos y Subproductos */}
          <div className={`p-4 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-700/60"}`}>
            <div className="flex items-center gap-2 text-purple-400 font-bold font-mono text-sm">
              <Cpu className="w-4 h-4" />
              <span>4. Dosificación Agronómica de Insumos y Economía Circular</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 font-mono text-xs md:text-sm text-purple-300 border border-purple-500/20">
              Semilla_Requerida (t) = Area_Siembra (ha) × Dosis_Semilla (t/ha)
              <br />
              Vinaza_Reutilizada (m³) = Area_Fertirriego (ha) × Dosis_Vinaza (m³/ha)
              <br />
              Cachaza_Aplicada (t) = Area_Enmienda (ha) × Dosis_Cachaza (t/ha)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Reintegra los efluentes de destilería (vinaza con alto contenido de potasio) y subproductos de clarificación (torta de filtros o cachaza rica en fósforo y materia orgánica) para reducir la compra de fertilizantes químicos importados.
            </p>
          </div>

          {/* Formula 5: Economía Agrícola */}
          <div className={`p-4 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-slate-800/40 border-slate-700/60"}`}>
            <div className="flex items-center gap-2 text-blue-400 font-bold font-mono text-sm">
              <DollarSign className="w-4 h-4" />
              <span>5. Consolidación de Costos OPEX & CAPEX</span>
            </div>
            <div className="p-3 rounded-lg bg-black/40 font-mono text-xs md:text-sm text-blue-300 border border-blue-500/20">
              OPEX_Total = Combustible_Diesel + Fertilizantes + Defensivos + Mantenimiento_Flota + Mano_Obra
              <br />
              Costo_Hectarea = OPEX_Total / Area_Total_Cultivada (USD/ha)
              <br />
              Costo_Tonelada_Cana = OPEX_Total / Toneladas_Cana_Puestas_En_Patio (USD/t)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Genera la métrica económica primordial de competitividad del agronegocio cañero: el costo unitario por tonelada de caña entregada en la mesa de alimentación del central azucarero.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm transition-colors"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
