import React, { useState, useEffect, useRef } from "react";
import {
  Presentation,
  TrendingUp,
  Zap,
  Activity,
  Shield,
  Layers,
  Sparkles,
  Server,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  Flame,
  Gauge,
  Cpu,
  Lock,
  Boxes,
  Calendar,
  Eye,
  FileCheck,
  AlertTriangle,
  Workflow,
  Check,
  Monitor,
  Camera,
  Play,
  RefreshCw,
  Clock,
  Settings,
  Scale,
  DollarSign,
  BarChart3,
  Award,
  Factory,
  Database,
  ArrowRight,
  Info,
  Sliders,
  Radio,
  FileSpreadsheet
} from "lucide-react";
import {
  TenantEnterprise,
  TelemetryData,
  EquipmentItem,
  AlarmEvent,
  NavigationTab
} from "../types";

interface ExecutivePresentationProps {
  activeTenant: TenantEnterprise;
  telemetry: TelemetryData;
  equipmentList?: EquipmentItem[];
  alarms?: AlarmEvent[];
  onNavigateToTab: (tab: NavigationTab) => void;
  onOpenCopilot?: () => void;
}

// Zero-fail Industrial Media Component with Multi-Source & SVG Technical Fallback
interface IndustrialMediaFrameProps {
  title: string;
  subtitle: string;
  badge: string;
  sources: string[];
  aspectRatio?: string;
  schemaType?: "plant" | "harvest" | "turbine" | "substation" | "boiler" | "scada";
  telemetryBadge?: string;
}

const IndustrialMediaFrame: React.FC<IndustrialMediaFrameProps> = ({
  title,
  subtitle,
  badge,
  sources,
  aspectRatio = "h-72 sm:h-80",
  schemaType = "plant",
  telemetryBadge
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  if (hasError || sources.length === 0) {
    // High-Fidelity SVG Technical Industrial Schematic (Guaranteed 100% Zero-Fail)
    return (
      <div className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 p-4 flex flex-col justify-between ${aspectRatio} shadow-2xl`}>
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
              {badge} • Esquema Técnico Real
            </span>
          </div>
          {telemetryBadge && (
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              {telemetryBadge}
            </span>
          )}
        </div>

        {/* Vector SVG Industrial Schematic */}
        <div className="my-auto py-2 flex items-center justify-center">
          {schemaType === "harvest" && (
            <svg viewBox="0 0 400 160" className="w-full max-w-sm h-auto opacity-85">
              <rect x="20" y="90" width="160" height="45" rx="6" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
              <text x="100" y="115" fill="#e2e8f0" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">BÁSCULA & MUESTREO</text>
              <text x="100" y="128" fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle">Core Sampler Automático</text>
              <path d="M180 112 H 240" stroke="#10b981" strokeWidth="2" strokeDasharray="4 4" />
              <polygon points="240,108 250,112 240,116" fill="#10b981" />
              <rect x="250" y="80" width="130" height="55" rx="6" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
              <text x="315" y="105" fill="#e2e8f0" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">PATIO & DESFIBRADO</text>
              <text x="315" y="122" fill="#06b6d4" fontSize="9" fontFamily="monospace" textAnchor="middle">IPA &gt; 88.5% Ruptura</text>
            </svg>
          )}
          {schemaType === "turbine" && (
            <svg viewBox="0 0 400 160" className="w-full max-w-sm h-auto opacity-85">
              <circle cx="90" cy="80" r="45" fill="#0f172a" stroke="#a855f7" strokeWidth="2" />
              <circle cx="90" cy="80" r="22" fill="#1e293b" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 3" />
              <text x="90" y="83" fill="#c084fc" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TURBINA HP</text>
              <text x="90" y="96" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">65 bar / 485°C</text>
              <path d="M135 80 H 220" stroke="#a855f7" strokeWidth="3" />
              <rect x="220" y="55" width="140" height="50" rx="8" fill="#1e293b" stroke="#06b6d4" strokeWidth="2" />
              <text x="290" y="80" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle" fontWeight="bold">GENERADOR 35 MW</text>
              <text x="290" y="95" fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle">Sincronizado 60.0 Hz</text>
            </svg>
          )}
          {schemaType === "substation" && (
            <svg viewBox="0 0 400 160" className="w-full max-w-sm h-auto opacity-85">
              <rect x="30" y="70" width="110" height="50" rx="6" fill="#1e293b" stroke="#06b6d4" strokeWidth="1.5" />
              <text x="85" y="93" fill="#e2e8f0" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">SUBESTACIÓN</text>
              <text x="85" y="107" fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="middle">Elevación 34.5/115kV</text>
              <path d="M140 95 H 230" stroke="#06b6d4" strokeWidth="2" />
              <line x1="230" y1="50" x2="230" y2="130" stroke="#f59e0b" strokeWidth="2" />
              <line x1="230" y1="70" x2="360" y2="70" stroke="#f59e0b" strokeWidth="2" />
              <line x1="230" y1="100" x2="360" y2="100" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="360" cy="70" r="4" fill="#10b981" />
              <circle cx="360" cy="100" r="4" fill="#10b981" />
              <text x="300" y="60" fill="#10b981" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">RED NACIONAL PPA</text>
            </svg>
          )}
          {(schemaType === "plant" || schemaType === "boiler") && (
            <svg viewBox="0 0 400 160" className="w-full max-w-sm h-auto opacity-85">
              <rect x="25" y="60" width="90" height="70" rx="6" fill="#1e293b" stroke="#10b981" strokeWidth="1.5" />
              <text x="70" y="90" fill="#10b981" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TÁNDEM M1-M5</text>
              <text x="70" y="105" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">Pol 96.5% Extr.</text>
              <path d="M115 80 H 160" stroke="#10b981" strokeWidth="2" />
              <rect x="160" y="45" width="100" height="85" rx="6" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="210" y="75" fill="#f59e0b" fontSize="10" fontFamily="monospace" textAnchor="middle" fontWeight="bold">CALDERA BIOMASA</text>
              <text x="210" y="90" fill="#cbd5e1" fontSize="8" fontFamily="monospace" textAnchor="middle">178.5 t/h Vapor HP</text>
              <text x="210" y="105" fill="#10b981" fontSize="8" fontFamily="monospace" textAnchor="middle">ASME 78.6%</text>
              <path d="M260 80 H 295" stroke="#a855f7" strokeWidth="2" />
              <rect x="295" y="60" width="85" height="60" rx="6" fill="#1e293b" stroke="#a855f7" strokeWidth="1.5" />
              <text x="337" y="88" fill="#c084fc" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="bold">TURBINA 35 MW</text>
              <text x="337" y="102" fill="#06b6d4" fontSize="8" fontFamily="monospace" textAnchor="middle">20.4 MW PPA</text>
            </svg>
          )}
        </div>

        <div className="z-10 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md">
          <div className="flex justify-between items-center text-xs">
            <span className="font-tech font-bold text-white">{title}</span>
            <span className="text-[10px] font-mono text-emerald-400">Verificado BioAzúcar</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{subtitle}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-800 shadow-2xl group ${aspectRatio}`}>
      <img
        src={sources[sourceIndex]}
        alt={title}
        referrerPolicy="no-referrer"
        onError={handleError}
        className="w-full h-full object-cover transform group-hover:scale-105 transition duration-700 brightness-90 contrast-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>

      {/* Top Header Floating Chips */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950/80 text-emerald-400 border border-emerald-500/30 backdrop-blur-md">
            {badge}
          </span>
        </div>
        {telemetryBadge && (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-950/80 text-cyan-300 border border-cyan-500/30 backdrop-blur-md">
            {telemetryBadge}
          </span>
        )}
      </div>

      {/* Bottom Information Card */}
      <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/60 text-xs">
        <div className="flex justify-between items-center mb-0.5">
          <span className="font-tech font-bold text-white uppercase flex items-center gap-1.5">
            {title}
          </span>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed">{subtitle}</p>
      </div>
    </div>
  );
};

export const ExecutivePresentation: React.FC<ExecutivePresentationProps> = ({
  activeTenant,
  telemetry,
  equipmentList = [],
  alarms = [],
  onNavigateToTab,
  onOpenCopilot,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPilotModalOpen, setIsPilotModalOpen] = useState(false);
  // View mode per slide: default to "system" (Las Propias del Sistema)
  const [viewMode, setViewMode] = useState<Record<number, "system" | "photo">>({
    0: "system",
    1: "system",
    2: "system",
    4: "system",
    5: "system",
    6: "system",
    7: "system",
    10: "system"
  });

  // ROI Interactive Calculator Inputs
  const [roiTchInput, setRoiTchInput] = useState<number>(activeTenant?.nominalTch || 450);
  const [roiEnergyPrice, setRoiEnergyPrice] = useState<number>(65);
  const [roiSeasonDays, setRoiSeasonDays] = useState<number>(180);

  const containerRef = useRef<HTMLDivElement>(null);
  const totalSlides = 12;

  // Safe number formatters to prevent undefined.toFixed() runtime crashes
  const safeNum = (val: unknown, fallback = 0): number => {
    const num = Number(val);
    return isNaN(num) ? fallback : num;
  };
  const fmt = (val: unknown, digits = 1, fallback = 0): string => {
    return safeNum(val, fallback).toFixed(digits);
  };

  // Safe data accessors
  const tenantName = activeTenant?.name || "Central Azucarero BioAzúcar";
  const nominalTch = safeNum(activeTenant?.nominalTch, 450);
  const powerCapacityMW = safeNum(activeTenant?.powerCapacityMW, 35);
  const tchVal = safeNum(telemetry?.tch, 450);
  const boilerPresVal = safeNum(telemetry?.boilerPressureHP, 65.0);
  const steamFlowVal = safeNum(telemetry?.steamFlowHP, 178.5);
  const powerGenVal = safeNum(telemetry?.powerGeneratedMW, 32.8);
  const powerExpVal = safeNum(telemetry?.powerExportGridMW, 20.4);
  const powerIntVal = safeNum(telemetry?.powerInternalMW, 12.4);
  const oeeVal = safeNum(telemetry?.oee, 86.4);
  const extractionVal = safeNum(telemetry?.caneExtraction, 96.5);
  const imbibitionVal = safeNum(telemetry?.imbibitionWaterRatio, 28.4);
  const bagasseMoistVal = safeNum(telemetry?.bagasseMoisture, 49.2);
  const brixVal = safeNum(telemetry?.evaporatorSyrupBrix, 65.2);
  const pfVal = safeNum(telemetry?.powerFactor, 0.94);
  const freqVal = safeNum(telemetry?.gridFrequency, 60.0);

  // Fullscreen toggle handler with HTML5 Fullscreen API + Fallback
  const toggleFullscreen = async () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        }
      } catch {
        // Fallback to CSS fullscreen
      }
      setIsFullscreen(true);
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      } catch {
        // Fallback
      }
      setIsFullscreen(false);
    }
  };

  // Fullscreen change listener & keyboard navigation
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentSlide((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Escape" && isFullscreen) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
        setIsFullscreen(false);
      } else if ((e.key === "f" || e.key === "F") && !["input", "textarea"].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) {
        toggleFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

  const slideTitles = [
    { title: "Visión & Plataforma", icon: Sparkles, tag: "01" },
    { title: "El Desafío Industrial", icon: AlertTriangle, tag: "02" },
    { title: "La Solución Integral", icon: Layers, tag: "03" },
    { title: "Arquitectura ISA-95", icon: Server, tag: "04" },
    { title: "Caña → Azúcar (LIMS)", icon: Workflow, tag: "05" },
    { title: "Bagazo → Energía (ASME)", icon: Zap, tag: "06" },
    { title: "Gemelo Digital 3D", icon: Boxes, tag: "07" },
    { title: "Copilot & IA Industrial", icon: Cpu, tag: "08" },
    { title: "Seguridad & Multi-Tenant", icon: Shield, tag: "09" },
    { title: "Alcance & Roadmap", icon: FileCheck, tag: "10" },
    { title: "Objetivo Clientes & ROI", icon: TrendingUp, tag: "11" },
    { title: "Piloto en 8 Semanas", icon: Calendar, tag: "12" },
  ];

  const currentView = viewMode[currentSlide] || "system";
  const toggleView = (slideIndex: number, mode: "system" | "photo") => {
    setViewMode((prev) => ({ ...prev, [slideIndex]: mode }));
  };

  return (
    <div
      ref={containerRef}
      id="executive-presentation-container"
      className={`flex flex-col bg-slate-950 text-slate-100 transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-[9999] w-screen h-screen p-4 sm:p-8 overflow-y-auto bg-slate-950"
          : "min-h-[85vh] rounded-2xl border border-slate-800 shadow-2xl p-4 sm:p-6"
      }`}
    >
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 text-emerald-400">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PITCH DECK EJECUTIVO • CLIENTES E INVERSIONISTAS
              </span>
              <span className="text-xs font-mono text-slate-400">
                Central Activo: <strong className="text-cyan-400">{tenantName}</strong>
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold font-tech text-white tracking-wide">
              BIOAZÚCAR 4.0 — Smart Mill & Cogeneration MES
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Tab Jump */}
          <button
            onClick={() => onNavigateToTab("dashboard")}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white transition"
            title="Ir a monitoreo en vivo"
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sistema en Vivo</span>
          </button>

          <button
            onClick={() => setIsPilotModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Solicitar Piloto (8 Semanas)</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-lg border transition flex items-center gap-1.5 text-xs font-mono ${
              isFullscreen
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
            }`}
            title={isFullscreen ? "Salir de pantalla completa (Esc o F)" : "Ampliar a toda pantalla (F)"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}</span>
          </button>
        </div>
      </div>

      {/* 2. Slide Navigation Chips */}
      <div className="py-3 overflow-x-auto scrollbar-thin border-b border-slate-900 flex items-center gap-1.5 shrink-0">
        {slideTitles.map((item, idx) => {
          const Icon = item.icon;
          const isActive = currentSlide === idx;
          return (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition border ${
                isActive
                  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold shadow-sm"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-slate-200"
              }`}
            >
              <span className={`text-[10px] opacity-60 ${isActive ? "text-emerald-400" : ""}`}>
                {item.tag}
              </span>
              <Icon className="w-3.5 h-3.5" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>

      {/* 3. Main Slide Stage */}
      <div className="flex-1 py-6 relative overflow-y-auto">
        {/* SLIDE 0: Visión y Portada */}
        {currentSlide === 0 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>TRANSICIÓN ENERGÉTICA & INDUSTRIA AZUCARERA 4.0</span>
                </div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black font-tech text-white leading-tight">
                  La Plataforma Digital de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-teal-300">Inteligencia Operacional & Cogeneración</span>
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  BioAzúcar 4.0 integra en una sola plataforma en tiempo real la recepción y pago justo de caña (LIMS), el tándem de molienda de 5 molinos, el balance térmico riguroso ASME PTC 4 en calderas de biomasa y el despacho de energía limpia a la red nacional bajo contratos PPA.
                </p>

                {/* Key value badges with real plant metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-mono block">Molienda Diaria</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {Math.round(nominalTch * 24).toLocaleString()} <span className="text-xs text-slate-400">TCD</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{fmt(tchVal, 0)} TCH nominales</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-mono block">Cogeneración MW</span>
                    <span className="text-xl font-bold font-mono text-cyan-400">
                      {powerCapacityMW} <span className="text-xs text-slate-400">MW</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{fmt(powerExpVal, 1)} MW exportación PPA</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-mono block">Eficiencia OEE</span>
                    <span className="text-xl font-bold font-mono text-emerald-300">
                      {fmt(oeeVal, 1, 86.4)}%
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Disponibilidad × Calidad</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                    <span className="text-xs text-slate-400 font-mono block">Ciberseguridad OT</span>
                    <span className="text-xl font-bold font-mono text-purple-400">
                      SL-3
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">IEC 62443 / RBAC 6 Roles</span>
                  </div>
                </div>

                {/* Primary CTA */}
                <div className="flex flex-wrap items-center gap-3 pt-4">
                  <button
                    onClick={() => onNavigateToTab("dashboard")}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Dashboard en Vivo</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onNavigateToTab("digital_twin")}
                    className="px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-white font-mono text-xs transition flex items-center gap-2"
                  >
                    <Boxes className="w-4 h-4 text-cyan-400" />
                    <span>Gemelo Digital 3D</span>
                  </button>
                </div>
              </div>

              {/* Visual Component: Switchable between Real System UI & Verified Industrial Photography */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="text-slate-400 pl-2">Evidencia Demostrable:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleView(0, "system")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                        currentView === "system"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Pantalla Propia del Sistema</span>
                    </button>
                    <button
                      onClick={() => toggleView(0, "photo")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                        currentView === "photo"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Fotografía del Central</span>
                    </button>
                  </div>
                </div>

                {currentView === "system" ? (
                  /* REAL SYSTEM UI CAPTURE */
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-2xl space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="font-mono text-xs font-bold text-white uppercase">
                          BioAzúcar 4.0 • Sinóptico SCADA P&ID en Tiempo Real
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {fmt(tchVal, 0)} TCH ACTIVO
                      </span>
                    </div>

                    {/* Interactive Synoptic Diagram Representation */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-850 space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>TÁNDEM DE MOLIENDA (5 MOLINOS DE 4 MAZAS)</span>
                        <span className="text-cyan-400">Imbibición: {fmt(imbibitionVal, 1)}%</span>
                      </div>

                      {/* Schematic mills & status */}
                      <div className="grid grid-cols-5 gap-2 text-center">
                        {[1, 2, 3, 4, 5].map((m) => (
                          <div key={m} className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-[10px] font-mono text-slate-400 block">M-{m}</span>
                            <div className="w-6 h-6 mx-auto my-1 rounded-full border-2 border-emerald-400/80 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-emerald-300">{m === 3 ? "!" : "OK"}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-300 block">
                              {m === 3 ? "2.4 mm/s" : "1.8 mm/s"}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Boiler and Power generation strip */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-900">
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-mono">Caldera HP</span>
                          <span className="text-sm font-bold text-cyan-400 font-mono">{fmt(boilerPresVal, 1)} bar</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-mono">Generación</span>
                          <span className="text-sm font-bold text-purple-400 font-mono">{fmt(powerGenVal, 1)} MW</span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/40">
                          <span className="text-[10px] text-emerald-300 block font-mono">Red PPA</span>
                          <span className="text-sm font-bold text-emerald-400 font-mono">{fmt(powerExpVal, 1)} MW</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1">
                      <span>✓ Protocolo Industrial: OPC UA / MQTT Sparkplug B</span>
                      <button
                        onClick={() => onNavigateToTab("scada")}
                        className="text-emerald-400 hover:underline flex items-center gap-1"
                      >
                        Abrir SCADA completo <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VERIFIED INDUSTRIAL PHOTOGRAPHY WITH ZERO-FAIL FALLBACK */
                  <IndustrialMediaFrame
                    title="Central Azucarero e Instalación Agroindustrial"
                    subtitle="Patio de caña, tándem de molienda y caldera de biomasa de alta presión en operación continua durante zafra."
                    badge="Instalación Industrial"
                    sources={[
                      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&auto=format&fit=crop&q=80",
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Sugar_mill_at_work_-_geograph.org.uk_-_226065.jpg/1280px-Sugar_mill_at_work_-_geograph.org.uk_-_226065.jpg"
                    ]}
                    schemaType="plant"
                    telemetryBadge={`${fmt(tchVal, 0)} TCH • ${fmt(powerExpVal, 1)} MW`}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 1: El Desafío Industrial */}
        {currentSlide === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-rose-400 font-bold tracking-wider uppercase">02 / PROBLEMÁTICA OPERACIONAL & FINANCIERA</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                La Pérdida Oculta de Rendimiento en Centrales Convencionales
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                En una zafra típica de 150 a 180 días, los ingenios azucareros y plantas de cogeneración sufren pérdidas millonarias causadas por falta de analítica en tiempo real y desconexión entre el campo, el laboratorio, la fábrica y la red eléctrica.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Paradas No Planificadas</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Fallas mecánicas imprevistas en coronas y chumaceras de molinos por vibración excesiva no detectada a tiempo. Cada hora de paro en zafra cuesta entre <strong>$15,000 y $35,000 USD</strong> en molienda perdida.
                </p>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-rose-300">
                  Impacto: -4.5% a -7.0% disponibilidad zafra
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Flame className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Ineficiencia Térmica en Calderas</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Variabilidad en la humedad del bagazo (48% a 54%) causa caídas súbitas de presión de vapor HP, combustión incompleta y exceso de aire no compensado, desperdiciando biomasa combustible.
                </p>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-amber-300">
                  Impacto: 8% a 12% pérdida de calor LHV
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Penalizaciones de Despacho PPA</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Incumplimiento de compromisos de exportación en contratos PPA (Power Purchase Agreement) por falta de pronóstico y coordinación entre consumo de vapor en tachos y generación en turbinas.
                </p>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-cyan-300">
                  Impacto: Multas de hasta $80/MWh desviado
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Server className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Silos Aislados & Desconfianza</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Datos de laboratorio de caña (Core Sampler) en hojas de cálculo no sincronizadas, disputas en la liquidación con cañicultores y decisiones operativas tomadas con retrasos de 4 a 12 horas.
                </p>
                <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono text-purple-300">
                  Impacto: Pérdida de rentabilidad y gobernanza
                </div>
              </div>
            </div>

            {/* Real System Alarms View */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Módulo Propio de BioAzúcar: Secuencia de Eventos SOE (Norma ISA-18.2)
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {alarms.length > 0 ? `${alarms.length} Alarmas Registradas` : "Monitoreo en Tiempo Real Activo"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-slate-950 border border-rose-500/30">
                  <span className="text-rose-400 font-bold block">ALERTA CRÍTICA • Molino 3</span>
                  <p className="text-slate-300 text-[11px] mt-1">Vibración en chumacera superior &gt; 4.8 mm/s. Riesgo de fatiga en corona motriz.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/30">
                  <span className="text-amber-400 font-bold block">ALERTA ALTA • Caldera Biomasa</span>
                  <p className="text-slate-300 text-[11px] mt-1">Humedad de bagazo &gt; 52.5% en conductor. Caída calculada de LHV a 6,950 kJ/kg.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-cyan-500/30">
                  <span className="text-cyan-400 font-bold block">ALERTA MEDIA • Subestación 34.5 kV</span>
                  <p className="text-slate-300 text-[11px] mt-1">Factor de potencia 0.91 ind. Compensación reactiva activada en banco de capacitores.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 2: La Solución Integral BioAzúcar 4.0 */}
        {currentSlide === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold tracking-wider uppercase">03 / PROPUESTA TECNOLÓGICA & VALOR INTEGRAL</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                La Solución BioAzúcar 4.0: Ecosistema Operacional Unificado
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Conectamos los sensores de campo, básculas y PLCs con la toma de decisiones gerencial mediante Unified Namespace (UNS), Gemelo Digital físico-termodinámico y Copilot con IA industrial.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Gauge className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">1. Visibilidad Total en Tiempo Real</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Molienda Continua:</strong> Control de TCH ({fmt(tchVal, 0)} TCH), extracción Pol ({fmt(extractionVal, 2)}%) y ratio de imbibición automática ({fmt(imbibitionVal, 1)}%).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Balance ASME PTC 4:</strong> Pérdidas por calor seco, hidrógeno y humedad en caldera calculadas cada segundo.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Monitoreo de Energía:</strong> Despacho de {fmt(powerExpVal, 1)} MW, factor de potencia {fmt(pfVal, 2)} y sincronización de red.</span>
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Boxes className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">2. Gemelo Digital & CBM Predictivo</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Modelo 3D WebGL (Three.js):</strong> Cinemática del tándem de 5 molinos y visualización térmica de cojinetes.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>Análisis Vibratorio FFT:</strong> Espectros acelerométricos según ISO 10816-3 para predecir fallas antes de que detengan el ingenio.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span><strong>9 Escenarios de Falla:</strong> Entrenamiento de operadores ante contingencias críticas sin riesgo a los equipos.</span>
                  </li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Cpu className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">3. Copilot IA & Gobernanza Segura</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>IA Industrial Gemini:</strong> Respuestas contextualizadas con variables vivas de proceso ({fmt(boilerPresVal, 1)} bar, {fmt(powerGenVal, 1)} MW).</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Doble Confirmación Nivel 3:</strong> Modificación de setpoints protegida con firmas digitales y verificación RBAC.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Multi-Tenant Nativo:</strong> Aislamiento de múltiples centrales bajo un único despliegue corporativo centralizado.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Real System Dashboard Card */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-mono">
                <span className="text-slate-400">Métricas Operativas Vivas del Central:</span>
                <span className="text-emerald-400 font-bold ml-2">OEE {fmt(oeeVal, 1)}%</span> •
                <span className="text-cyan-400 font-bold ml-2">{fmt(tchVal, 0)} TCH</span> •
                <span className="text-purple-400 font-bold ml-2">{fmt(powerGenVal, 1)} MW Brutos</span> •
                <span className="text-amber-400 font-bold ml-2">Extracción {fmt(extractionVal, 1)}%</span>
              </div>
              <button
                onClick={() => onNavigateToTab("scada")}
                className="px-3.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 hover:text-white transition flex items-center gap-1.5"
              >
                <span>Inspeccionar Sinóptico SCADA</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* SLIDE 3: Arquitectura ISA-95 & Ciberseguridad */}
        {currentSlide === 3 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-purple-400 font-bold tracking-wider uppercase">04 / INGENIERÍA DE SISTEMAS & CIBERSEGURIDAD</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Arquitectura Funcional ISA-95 & Ciberseguridad IEC 62443
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Estructura de integración por capas estandarizada internacionalmente para garantizar conectividad robusta con sistemas existentes (Siemens, Rockwell, Honeywell) y máxima resiliencia cibernética.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ISA-95 Pyramid */}
              <div className="lg:col-span-8 space-y-3">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-purple-400">NIVEL 4 • GESTIÓN CORPORATIVA & ERP</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">Cloud Firestore / Multi-Tenant</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Directorio empresarial de centrales, contabilidad energética, liquidación de cañicultores según ARE y analítica ejecutiva global.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-cyan-400">NIVEL 3 • OPERACIONES MES, OEE & HISTORIADOR</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">BioAzúcar Core Platform</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Historiador de series de tiempo, gestión de órdenes de trabajo, trazabilidad de lotes LIMS, alarmas ISA-18.2 y Copilot de IA industrial.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-emerald-400">NIVEL 2 • SUPERVISIÓN SCADA & GEMELO DIGITAL</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Sinóptico Mímico & UNS Broker</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Bróker MQTT Sparkplug B y OPC UA Server. Visualización sinóptica P&ID con actualización sub-segundo de lazos de control de planta.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-amber-400">NIVEL 1 & 0 • CONTROL BÁSICO & INSTRUMENTACIÓN</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">DCS, PLCs, RTUs & Sensores</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    PLCs de molinos (Siemens S7-1500, Allen-Bradley ControlLogix), transmisores de presión de vapor HP, analizadores NIR y relés de subestación.
                  </p>
                </div>
              </div>

              {/* Security Sidebar */}
              <div className="lg:col-span-4 p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 space-y-4">
                <div className="flex items-center gap-2 text-purple-400">
                  <Lock className="w-5 h-5" />
                  <h3 className="font-tech font-bold text-white text-base">Ciberseguridad IEC 62443</h3>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="font-mono font-bold text-slate-200 block">Zonas y Conductos</span>
                    <span className="text-slate-400 text-[11px]">Segmentación estricta entre Zona OT (Planta) y Zona IT (Corporativo) vía DMZ y TLS 1.3.</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="font-mono font-bold text-slate-200 block">Nivel de Seguridad SL-3</span>
                    <span className="text-slate-400 text-[11px]">Protección contra accesos no autorizados a lazos de control de molienda o caldera.</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                    <span className="font-mono font-bold text-slate-200 block">Auditoría Inmutable</span>
                    <span className="text-slate-400 text-[11px]">Registro criptográfico de cada acción de usuario, reconocimiento de alarma o cambio de setpoint.</span>
                  </div>
                </div>

                <button
                  onClick={() => onNavigateToTab("uns_hub")}
                  className="w-full py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono transition flex items-center justify-center gap-2"
                >
                  <Server className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ver Configuración UNS Hub</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 4: Proceso Caña → Azúcar (LIMS & Molienda) */}
        {currentSlide === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold tracking-wider uppercase">05 / PROCESO AGROINDUSTRIAL & LIQUIDACIÓN DE CAÑA</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Monitoreo Integral de la Cadena Caña → Azúcar
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Trazabilidad completa desde el pesaje del camión en báscula hasta el embolsado de azúcar refinado, optimizando la extracción y automatizando la liquidación justa según ARE.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Switcher Real System vs Industrial Photography */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="text-slate-400 pl-2">Vista del Módulo:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleView(4, "system")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                        (viewMode[4] || "system") === "system"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Pantalla Propia LIMS</span>
                    </button>
                    <button
                      onClick={() => toggleView(4, "photo")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition ${
                        viewMode[4] === "photo"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Fotografía Cosecha & Patio</span>
                    </button>
                  </div>
                </div>

                {(viewMode[4] || "system") === "system" ? (
                  /* REAL LIMS BATCH TABLE */
                  <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xl space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                      <span className="text-xs font-mono font-bold text-white">
                        LIMS • Lotes de Caña & Muestreo Core Sampler
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        Fórmula ARE Activa
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] font-mono">
                        <thead>
                          <tr className="text-slate-400 border-b border-slate-800 text-left">
                            <th className="pb-1.5">Lote / Camión</th>
                            <th className="pb-1.5">Variedad</th>
                            <th className="pb-1.5">°Brix</th>
                            <th className="pb-1.5">Pol %</th>
                            <th className="pb-1.5 text-right">ARE (kg/t)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850 text-slate-300">
                          <tr>
                            <td className="py-2 text-white font-bold">LOTE-2026-081</td>
                            <td>CP 72-2086</td>
                            <td>19.8</td>
                            <td>16.2</td>
                            <td className="text-right text-emerald-400 font-bold">118.4</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-white font-bold">LOTE-2026-082</td>
                            <td>PR 10-13</td>
                            <td>20.4</td>
                            <td>16.8</td>
                            <td className="text-right text-emerald-400 font-bold">122.1</td>
                          </tr>
                          <tr>
                            <td className="py-2 text-white font-bold">LOTE-2026-083</td>
                            <td>V-71-39</td>
                            <td>18.9</td>
                            <td>15.4</td>
                            <td className="text-right text-emerald-400 font-bold">112.8</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-850 text-[11px] font-mono text-slate-400">
                      Liquidación transparente según ARE = [Pol × (1 - F/100)] × Coeficiente de Fábrica. Erradica reclamos de cañicultores.
                    </div>
                  </div>
                ) : (
                  /* VERIFIED HARVEST & CANE YARD PHOTOGRAPHY */
                  <IndustrialMediaFrame
                    title="Cosecha Mecanizada y Patio de Caña"
                    subtitle="Control de recepción de camiones, muestreo con sonda Core Sampler y preparación en desfibradora de alta velocidad."
                    badge="Patio de Caña & Campo"
                    sources={[
                      "https://images.unsplash.com/photo-1595113316349-9fa4eb24f884?w=800&auto=format&fit=crop&q=80",
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Sugar_mill_machinery.jpg/1280px-Sugar_mill_machinery.jpg"
                    ]}
                    schemaType="harvest"
                    telemetryBadge="IPA 88.5% • Pol 13.5%"
                  />
                )}
              </div>

              {/* Process stages */}
              <div className="lg:col-span-6 space-y-3">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold font-mono shrink-0">
                    1
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-white text-sm">Patio & Preparación de Caña</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Control de mesas alimentadoras, niveladoras y desfibradora de alta velocidad. Monitoreo del Índice de Preparación Abierta (IPA &gt; 88%) para garantizar máxima ruptura de celdas sin sobrecarga motriz.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold font-mono shrink-0">
                    2
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-white text-sm">Tándem de Molienda de 5 Molinos</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Imbibición compuesta a contracorriente optimizada ({fmt(imbibitionVal, 1)}% sobre caña) para alcanzar {fmt(extractionVal, 1)}% de extracción de sacarosa Pol, manteniendo la humedad de bagazo en 49.2%.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold font-mono shrink-0">
                    3
                  </div>
                  <div className="space-y-1 text-xs">
                    <h4 className="font-bold text-white text-sm">Clarificación & Evaporación a {fmt(brixVal, 1)} °Brix</h4>
                    <p className="text-slate-400 leading-relaxed">
                      Control de pH con lechada de cal, calentamiento y concentración en evaporadores múltiple efecto para enviar meladura de alta pureza hacia los tachos de cocción y cristalización.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 5: Bagazo → Energía (ASME PTC 4 & Turbogeneración) */}
        {currentSlide === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider uppercase">06 / COGENERACIÓN & VENTA DE ENERGÍA PPA</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                La Ecuación Energética: Bagazo → Vapor HP → MW Limpios
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Transformamos el subproducto de la molienda (bagazo) en electricidad verde de alta rentabilidad bajo la norma internacional de calderas ASME PTC 4 y contratos PPA de exportación a la red.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">Caldera de Biomasa Acuotubular</span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">ASME PTC 4</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono pt-1">
                    <div>
                      <span className="text-slate-500 block">Presión Vapor HP:</span>
                      <strong className="text-white text-sm">{fmt(boilerPresVal, 1)} bar (g)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Flujo de Vapor HP:</span>
                      <strong className="text-cyan-400 text-sm">{fmt(steamFlowVal, 1)} t/h</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Temperatura Vapor:</span>
                      <strong className="text-amber-400 text-sm">485 °C</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Humedad Bagazo:</span>
                      <strong className="text-slate-300 text-sm">{fmt(bagasseMoistVal, 1)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">Despacho Eléctrico del Central</span>
                    <span className="text-xs font-mono text-purple-400 font-bold">PPA Contratado</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                    <div className="p-2 rounded-lg bg-slate-950">
                      <span className="text-slate-500 block text-[10px]">Generación Bruta</span>
                      <strong className="text-purple-400 text-sm">{fmt(powerGenVal, 1)} MW</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-950">
                      <span className="text-slate-500 block text-[10px]">Consumo Fabril</span>
                      <strong className="text-slate-300 text-sm">{fmt(powerIntVal, 1)} MW</strong>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-500/30">
                      <span className="text-emerald-400 block text-[10px] font-bold">Exportación Red</span>
                      <strong className="text-emerald-300 text-sm">{fmt(powerExpVal, 1)} MW</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* View Switcher: ASME PTC 4 Card vs Turbine Photo */}
              <div className="lg:col-span-6 space-y-3">
                <div className="flex items-center justify-between bg-slate-900/90 p-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                  <span className="text-slate-400 pl-2">Evidencia Demostrable:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleView(5, "system")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                        (viewMode[5] || "system") === "system"
                          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>Tarjeta ASME PTC 4 Propia</span>
                    </button>
                    <button
                      onClick={() => toggleView(5, "photo")}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                        viewMode[5] === "photo"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/40 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Fotografía Turbogenerador</span>
                    </button>
                  </div>
                </div>

                {(viewMode[5] || "system") === "system" ? (
                  /* REAL ASME PTC 4 CARD */
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 shadow-xl">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs font-mono">
                      <span className="font-bold text-white">ASME PTC 4 • Balance de Caldera</span>
                      <span className="text-cyan-400 font-bold">Eficiencia: 78.6%</span>
                    </div>

                    <div className="space-y-2 text-[11px] font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>Pérdida por Humedad en Bagazo (LHV):</span>
                        <span className="text-amber-400 font-bold">12.4%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-amber-400 h-full" style={{ width: "12.4%" }}></div>
                      </div>

                      <div className="flex justify-between text-slate-300 pt-1">
                        <span>Pérdida Gases Secos Chimenea:</span>
                        <span className="text-slate-400 font-bold">6.8%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-cyan-400 h-full" style={{ width: "6.8%" }}></div>
                      </div>

                      <div className="flex justify-between text-slate-300 pt-1">
                        <span>Calor Útil al Vapor HP de Alta Presión:</span>
                        <span className="text-emerald-400 font-bold">78.6%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-400 h-full" style={{ width: "78.6%" }}></div>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
                      Sincronización PPA activa a {fmt(powerExpVal, 1)} MW • Ingreso estimado: ${(powerExpVal * roiEnergyPrice).toLocaleString()}/hora.
                    </div>
                  </div>
                ) : (
                  /* VERIFIED TURBINE PHOTOGRAPHY */
                  <IndustrialMediaFrame
                    title="Turbogenerador de Extracción y Condensación 35 MW"
                    subtitle="Alimentado con vapor a 65 bar / 485°C. Entrega vapor de escape a 2.5 bar a la fábrica y exporta electricidad a la red."
                    badge="Cogeneración Eléctrica"
                    sources={[
                      "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=800&auto=format&fit=crop&q=80",
                      "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Steam_Turbine_Power_Plant.jpg/1280px-Steam_Turbine_Power_Plant.jpg"
                    ]}
                    schemaType="turbine"
                    telemetryBadge={`${fmt(powerGenVal, 1)} MW • ${fmt(freqVal, 2)} Hz`}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 6: Gemelo Digital & Simulación Dinámica */}
        {currentSlide === 6 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-purple-400 font-bold tracking-wider uppercase">07 / TECNOLOGÍA PREDICTIVA & GEMELO DIGITAL</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Gemelo Digital 3D & Simulación Acoplada
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Representación virtual tridimensional que reproduce el comportamiento físico y térmico del central, permitiendo validaciones sin riesgo operacional.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Boxes className="w-5 h-5" />
                    <h3 className="font-bold text-white text-sm">Visualización 3D en WebGL (Three.js)</h3>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Renderizado nativo en el navegador del tándem de molienda y calderas con indicación cromática en tiempo real de gradientes térmicos, vibraciones mecánicas y velocidad angular de las mazas.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Activity className="w-5 h-5" />
                    <h3 className="font-bold text-white text-sm">9 Escenarios Industriales Preconfigurados</h3>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Permite inyectar y simular eventos críticos de planta: vibración anormal en Molino 3, caída súbita de presión en caldera, bagazo húmedo, sobrecarga de red o parada imprevista de desfibradora para entrenar personal.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Shield className="w-5 h-5" />
                    <h3 className="font-bold text-white text-sm">Trazabilidad Criptográfica de Procedencia</h3>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    El sistema etiqueta inequívocamente cada variable como <code className="text-purple-300 font-mono">SIMULATION</code> o <code className="text-emerald-300 font-mono">OBSERVED_OT</code>, impidiendo fallbacks silenciosos que confundan datos reales de planta con simulación.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 text-center space-y-4 shadow-2xl">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Boxes className="w-8 h-8 animate-pulse" />
                  </div>
                  <h4 className="text-lg font-bold font-tech text-white">Gemelo Digital en Tiempo Real de BioAzúcar</h4>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    Inspeccione la cinemática de los rodillos, las temperaturas de cojinetes y el flujo de vapor en un entorno 3D interactivo con controles orbitales.
                  </p>
                  <button
                    onClick={() => onNavigateToTab("digital_twin")}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs transition inline-flex items-center gap-2 shadow-lg shadow-cyan-500/20"
                  >
                    <span>Abrir Gemelo Digital 3D</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 7: Copilot & IA Industrial */}
        {currentSlide === 7 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider uppercase">08 / INTELIGENCIA ARTIFICIAL INDUSTRIAL</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                BioAzúcar Copilot: Inteligencia Artificial con Contexto de Planta
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Un asistente inteligente impulsado por Google Gemini configurado con la física de procesos azucareros y salvaguardas operacionales estrictas.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    Cero Alucinación • Datos Vivos de Telemetría
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    A diferencia de chatbots genéricos, BioAzúcar Copilot evalúa la telemetría viva del central ({fmt(tchVal, 0)} TCH, {fmt(boilerPresVal, 1)} bar, {fmt(powerExpVal, 1)} MW), las alarmas activas y el historial reciente para responder preguntas reales de los operadores.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Lock className="w-4 h-4 text-purple-400" />
                    Protocolo de Doble Confirmación de Nivel 3
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Si el operador solicita una acción de control (como modificar la consigna de exportación de MW o variar la relación de imbibición), el Copilot jamás ejecuta la orden de inmediato: genera un diálogo formal de confirmación con análisis de impacto y verificación de rol RBAC.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Diagnóstico Predictivo de Fallas CBM
                  </h4>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Correlaciona espectros FFT de vibración acelerométrica con temperaturas de chumacera para sugerir acciones inmediatas de lubricación forzada o inspección de alineación mecánica.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/30 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></div>
                      <span className="font-mono text-xs font-bold text-white">Copilot Industrial en Vivo</span>
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">Gemini 2.5 Industrial</span>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
                    <span className="text-cyan-400">Operador:</span> &quot;¿Por qué cayó la presión de vapor HP a {fmt(boilerPresVal, 1)} bar?&quot;
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                    <span className="text-emerald-400 font-mono font-bold block mb-1">Copilot IA:</span>
                    La telemetría indica que la humedad del bagazo subió a <strong>{fmt(bagasseMoistVal, 1)}%</strong> en el conductor elevador, reduciendo el LHV a 7,200 kJ/kg. Se recomienda aumentar tiro inducido en un 6% y abrir tolva de bagazo seco de pulmón.
                  </div>

                  {onOpenCopilot && (
                    <button
                      onClick={onOpenCopilot}
                      className="w-full py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold transition flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Probar BioAzúcar Copilot Ahora</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 8: Ciberseguridad, Multi-Tenant & RBAC */}
        {currentSlide === 8 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-purple-400 font-bold tracking-wider uppercase">09 / GOBERNANZA CORPORATIVA & MULTI-TENANT</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Aislamiento Multi-Tenant & Seguridad de Nivel Corporativo
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Diseñado para grupos azucareros que operan múltiples ingenios o destilerías, garantizando partición estricta de datos y permisos granulares por usuario y rol.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Multi-Tenant Nativo</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Cada central (ej. Central Portuguesa, Ingenio San Carlos) tiene aislamiento total de telemetría, historiador, alarmas y órdenes de mantenimiento. Un operador del Ingenio A nunca puede ver ni alterar variables del Ingenio B.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Matriz RBAC Granular (6 Perfiles)</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Perfiles diferenciados: <strong>Superadmin, Administrador, Supervisor, Operador, Mantenimiento y Calidad</strong>. Control estricto de quién puede reconocer alarmas o cambiar consignas en lazos PID.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">Auditoría Criptográfica Inmutable</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Bitácora inmutable de eventos (<code className="text-slate-200 font-mono">audit_logs</code>). Cada acción registra sello de tiempo, usuario, rol, IP de origen, valor previo y valor nuevo para cumplimiento de normativas de auditoría.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div className="text-xs">
                <span className="font-mono text-slate-400">Central Activo en el Sistema:</span>
                <span className="font-bold text-white ml-2">{tenantName}</span>
              </div>
              <button
                onClick={() => onNavigateToTab("enterprises")}
                className="px-3.5 py-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-purple-300 hover:text-white transition flex items-center gap-1.5"
              >
                <span>Administrador de Empresas</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* SLIDE 9: Alcance Concreto & Hoja de Ruta Tecnológica */}
        {currentSlide === 9 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold tracking-wider uppercase">10 / ALCANCE DEL PROYECTO & HOJA DE RUTA</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Alcance Detallado: Qué Entrega HOY vs Próximas Fases
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Transparencia total para clientes e inversionistas: no vendemos promesas vacías. Definimos con rigor de ingeniería lo que ya está en producción y los siguientes hitos de desarrollo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* OPERATIVO HOY */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ALCANCE FASE 1 (PRODUCCIÓN INMEDIATA)
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-base font-bold text-white">Listo para Despliegue (8 Semanas)</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Edge Gateway OPC UA / MQTT Sparkplug B</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Sinóptico SCADA interactivo P&ID en tiempo real</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Balance térmico ASME PTC 4 en calderas de bagazo</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>LIMS recepción caña & Core Sampler con liquidación ARE</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>CBM Predictivo con FFT ISO 10816-3 para molinos</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Gemelo Digital 3D WebGL con 9 escenarios de falla</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Copilot con IA Gemini y salvaguarda de doble confirmación</span>
                  </li>
                </ul>
              </div>

              {/* EN EVOLUCIÓN */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    ALCANCE FASE 2 (EN DESARROLLO - Q3/Q4 2026)
                  </span>
                  <Workflow className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="text-base font-bold text-white">Comisionamiento Avanzado</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Conectores IEC 61850 GOOSE/MMS para subestaciones</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Modelos de redes PINN para desgaste de cuchillas</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Optimizador de despacho PPA spot intradiario</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0"></span>
                    <span>Integración con estaciones meteorológicas de campo</span>
                  </li>
                </ul>
              </div>

              {/* FUTURO COMERCIAL */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    ALCANCE FASE 3 (ROADMAP 2027)
                  </span>
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-base font-bold text-white">Autonomía & Bonos de Carbono</h3>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                    <span>Control predictivo en lazo cerrado autónomo (Nivel 2)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                    <span>Mercado y certificación de bonos verdes I-REC</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0"></span>
                    <span>Despacho algorítmico automatizado a microrredes</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 10: Objetivos Estratégicos & Propuesta de Valor para Clientes e Inversionistas */}
        {currentSlide === 10 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-emerald-400 font-bold tracking-wider uppercase">11 / MODELO DE NEGOCIO & PROPUESTA DE VALOR</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Objetivos Estratégicos: Valor para el Cliente e Inversionistas
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Una solución de doble impacto: optimiza el EBITDA del ingenio azucarero y crea una oportunidad de inversión escalable en el mercado de software industrial OT/MES.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Card 1: PARA EL CLIENTE (INGENIO) */}
              <div className="lg:col-span-6 p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Factory className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-tech font-bold text-white text-base">Para el Cliente (Ingenio & Operaciones)</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ROI OPERACIONAL
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-emerald-400 block font-mono">1. Cero Paradas No Programadas en Zafra:</strong>
                    <span>Detección temprana CBM en coronas y chumaceras de molinos. Ahorro directo de <strong>$180,000 a $320,000 USD/zafra</strong>.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-cyan-400 block font-mono">2. Maximización de MW Limpios Exportados:</strong>
                    <span>Optimización térmica ASME PTC 4 en calderas de biomasa genera un excedente de +1.5 a +2.5 MW para venta a red bajo contrato PPA (+<strong>$210,000 a $380,000 USD/año</strong>).</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-purple-400 block font-mono">3. Liquidación Transparente con Cañicultores:</strong>
                    <span>Cálculo automático de ARE mediante muestreo Core Sampler LIMS, erradicando discrepancias en el pago de caña por sacarosa real.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40">
                    <strong className="text-emerald-300 block font-mono">4. Payback Garantizado &lt; 6 Meses:</strong>
                    <span>El proyecto se paga completamente dentro de la primera zafra de comisionamiento sin interrumpir la molienda diaria.</span>
                  </div>
                </div>
              </div>

              {/* Card 2: PARA LOS INVERSIONISTAS */}
              <div className="lg:col-span-6 p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-500/40 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                    <h3 className="font-tech font-bold text-white text-base">Para los Inversionistas (Tesis de Inversión)</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    ESCALABILIDAD B2B
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-cyan-400 block font-mono">1. Mercado Direccionable de $650M USD (TAM):</strong>
                    <span>Más de 450 centrales azucareros y plantas de bioetanol en Latinoamérica (Brasil, México, Colombia, Guatemala, Perú) en transición hacia Industria 4.0.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-purple-400 block font-mono">2. Modelo de Negocio SaaS B2B Recurrente:</strong>
                    <span>Contratos anuales de software de <strong>$144k a $300k USD ARR por ingenio</strong> + tarifa de onboarding ($45k USD). Margen bruto de software &gt; 82%.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-850">
                    <strong className="text-emerald-400 block font-mono">3. Expansión Neta NDR &gt; 115%:</strong>
                    <span>Grupos azucareros poseen en promedio de 2 a 6 centrales. Una vez validado en el primer ingenio, el despliegue se replica corporativamente.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
                    <strong className="text-cyan-300 block font-mono">4. Foso Defensivo & Impacto ESG:</strong>
                    <span>Especialización de nicho en protocolos OT (OPC UA, MQTT, ASME PTC 4) y reducción demostrable de más de 60,000 tCO2e/año por central mediante cogeneración de biomasa.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Mini Simulator */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-400" />
                  Simulador Financiero Dinámico de Retorno (ROI)
                </span>
                <span className="text-slate-400">Zafra de {roiSeasonDays} días continuos</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div>
                  <label className="text-slate-400 block mb-1">Molienda: {roiTchInput} TCH</label>
                  <input
                    type="range"
                    min="200"
                    max="1200"
                    step="50"
                    value={roiTchInput}
                    onChange={(e) => setRoiTchInput(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Tarifa PPA: ${roiEnergyPrice}/MWh</label>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    step="5"
                    value={roiEnergyPrice}
                    onChange={(e) => setRoiEnergyPrice(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Días de Zafra: {roiSeasonDays} días</label>
                  <input
                    type="range"
                    min="120"
                    max="240"
                    step="10"
                    value={roiSeasonDays}
                    onChange={(e) => setRoiSeasonDays(Number(e.target.value))}
                    className="w-full accent-purple-400"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-850 flex flex-wrap justify-between items-center text-xs font-mono gap-2">
                <span className="text-slate-300">Beneficio Anual Económico Proyectado para el Ingenio:</span>
                <span className="text-emerald-400 font-bold text-base">
                  ${Math.round((roiTchInput * 580) + (roiTchInput * 0.045 * roiEnergyPrice * roiSeasonDays * 24 * 0.05)).toLocaleString()} USD / Zafra
                </span>
              </div>
            </div>
          </div>
        )}

        {/* SLIDE 11: Propuesta de Piloto en 8 Semanas */}
        {currentSlide === 11 && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-mono text-cyan-400 font-bold tracking-wider uppercase">12 / IMPLEMENTACIÓN PRÁCTICA & ALCANCE CONTRACTUAL</span>
              <h2 className="text-2xl sm:text-3xl font-bold font-tech text-white mt-1">
                Propuesta de Piloto Industrial en 8 Semanas
              </h2>
              <p className="text-slate-400 text-sm max-w-3xl mt-1">
                Metodología no invasiva de despliegue rápido que demuestra valor operacional medible sin detener la producción ni alterar la seguridad operativa del ingenio.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold flex items-center justify-center text-xs">
                    S1-2
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">FASE 1</span>
                </div>
                <h3 className="font-bold text-white text-sm">Tenant Cloud & Mapeo de Tags</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Configuración del tenant dedicado en la nube, parametrización de TCH ({nominalTch} TCH) y potencia ({powerCapacityMW} MW), y definición de matriz de usuarios RBAC.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 font-mono font-bold flex items-center justify-center text-xs">
                    S3-4
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">FASE 2</span>
                </div>
                <h3 className="font-bold text-white text-sm">Edge Gateway No Invasivo</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Instalación de pasarela de borde en espejo para lectura de tags del DCS/SCADA existente mediante OPC UA o MQTT Sparkplug B con cero riesgo a los lazos de control de planta.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 font-mono font-bold flex items-center justify-center text-xs">
                    S5-6
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">FASE 3</span>
                </div>
                <h3 className="font-bold text-white text-sm">Calibración ASME PTC 4 & Copilot</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Ajuste de los modelos térmicos de caldera acuotubular, calibración del gemelo digital 3D y contextualización del Copilot de IA con los procedimientos de la planta.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold flex items-center justify-center text-xs">
                    S7-8
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">FASE 4</span>
                </div>
                <h3 className="font-bold text-white text-sm">Marcha Blanca & Auditoría ROI</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Operación asistida en sala de control con operadores y supervisores, medición de mejoras en OEE y entrega del informe ejecutivo de retorno de inversión.
                </p>
              </div>
            </div>

            {/* Closing CTA Banner */}
            <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-lg font-bold font-tech text-white">
                  ¿Listo para comisionar BioAzúcar 4.0 en su Central Azucarero?
                </h4>
                <p className="text-slate-400 text-xs">
                  Agende una sesión técnica de evaluación preliminar de tags OPC UA y reserve una ventana de piloto industrial.
                </p>
              </div>
              <button
                onClick={() => setIsPilotModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold font-mono text-xs transition shadow-lg shadow-emerald-500/20 whitespace-nowrap"
              >
                Solicitar Propuesta de Piloto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Slide Footer & Navigation Controls */}
      <div className="pt-4 border-t border-slate-900 flex items-center justify-between text-xs font-mono text-slate-400 shrink-0">
        <div className="flex items-center gap-2">
          <span>Diapositiva</span>
          <strong className="text-white">{currentSlide + 1}</strong>
          <span>de</span>
          <span>{totalSlides}</span>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:block flex-1 max-w-xs mx-4 bg-slate-900 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-400 to-cyan-400 h-full transition-all duration-300"
            style={{ width: `${((currentSlide + 1) / totalSlides) * 100}%` }}
          ></div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(prev - 1, 0))}
            disabled={currentSlide === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>
          <button
            onClick={() => setCurrentSlide((prev) => Math.min(prev + 1, totalSlides - 1))}
            disabled={currentSlide === totalSlides - 1}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-850 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center gap-1 transition"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pilot Request Modal */}
      {isPilotModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 relative">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-400" />
                <h3 className="font-tech font-bold text-white text-base">Solicitud de Piloto Industrial BioAzúcar 4.0</h3>
              </div>
              <button
                onClick={() => setIsPilotModalOpen(false)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Complete los detalles del central para generar la orden de estudio preliminar y coordinar el enlace técnico con nuestro equipo de ingeniería:
              </p>

              <div className="space-y-1">
                <label className="text-slate-400 font-mono">Nombre del Central / Ingenio:</label>
                <input
                  type="text"
                  defaultValue={tenantName}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-mono">Capacidad Molienda (TCH):</label>
                  <input
                    type="number"
                    defaultValue={nominalTch}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-mono">Cogeneración (MW):</label>
                  <input
                    type="number"
                    defaultValue={powerCapacityMW}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-mono">Correo de Contacto Técnico:</label>
                <input
                  type="email"
                  defaultValue={activeTenant?.primaryAdminEmail || "ing.dernys@gmail.com"}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono"
                />
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] leading-relaxed">
                El piloto de 8 semanas incluye pasarela de borde OPC UA, acceso cloud multi-tenant dedicado, calibración del gemelo digital y marcha blanca supervisada.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsPilotModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-mono"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    alert("Solicitud de Piloto Industrial registrada con éxito. Un ingeniero de comisionamiento se pondrá en contacto para planificar el enlace OPC UA.");
                    setIsPilotModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold font-mono"
                >
                  Confirmar Solicitud de Piloto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
