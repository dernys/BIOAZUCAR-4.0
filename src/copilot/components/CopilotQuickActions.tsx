import React from "react";
import {
  Sparkles,
  Layers,
  Activity,
  Zap,
  ShieldAlert,
  Flame,
  HelpCircle,
  Cpu,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { NavigationTab } from "../../types";

interface QuickActionsProps {
  currentModule: NavigationTab;
  onSelectAction: (prompt: string) => void;
}

export const CopilotQuickActions: React.FC<QuickActionsProps> = ({
  currentModule,
  onSelectAction,
}) => {
  const getContextualPrompts = (): Array<{ label: string; prompt: string; icon: React.ComponentType<{ className?: string }> }> => {
    switch (currentModule) {
      case "dashboard":
        return [
          {
            label: "¿Qué puedes hacer?",
            prompt: "¿Qué puedes hacer?",
            icon: Sparkles,
          },
          {
            label: "Resumen de Molienda TCH",
            prompt: "¿Cuál es el estado actual de molienda TCH y extracción de sacarosa?",
            icon: Activity,
          },
          {
            label: "Linaje de Datos OEE",
            prompt: "Muestra el linaje de datos y origen del OEE Global",
            icon: Layers,
          },
          {
            label: "Balance Energético",
            prompt: "Calcula el balance de vapor y generación eléctrica actual",
            icon: Zap,
          },
        ];

      case "scada":
        return [
          {
            label: "Verificar Lazos PID",
            prompt: "¿Hay desviaciones críticas en los lazos de control PID de molienda o caldera?",
            icon: Activity,
          },
          {
            label: "Estado de Molino 3",
            prompt: "Dame la condición técnica y vibración RMS del Molino 3",
            icon: Cpu,
          },
          {
            label: "Humedad de Bagazo",
            prompt: "¿Cómo está la humedad de bagazo y el vapor vivo?",
            icon: Flame,
          },
        ];

      case "energy_dispatch":
        return [
          {
            label: "Balance ASME PTC 4",
            prompt: "Calcula la eficiencia termodinámica de calderas y generación neta",
            icon: Flame,
          },
          {
            label: "Despacho a Red SEN",
            prompt: "¿Cuántos MW estamos exportando a la red y a qué precio spot?",
            icon: Zap,
          },
          {
            label: "Presión Caldera HP",
            prompt: "¿La presión de vapor HP cumple con los 65 bar nominales?",
            icon: BarChart3,
          },
        ];

      case "alarms":
        return [
          {
            label: "Resumen Alarmas Activas",
            prompt: "Lista las alarmas activas prioritarias según norma ISA-18.2",
            icon: ShieldAlert,
          },
          {
            label: "Causa Raíz de Alarmas",
            prompt: "¿Cuál es la causa probable de la última alarma registrada?",
            icon: HelpCircle,
          },
        ];

      case "equipment":
        return [
          {
            label: "Salud de Equipos Críticos",
            prompt: "Muestra el índice de salud y vibración de los equipos principales",
            icon: Cpu,
          },
          {
            label: "Órdenes de Trabajo CMMS",
            prompt: "¿Qué órdenes de trabajo preventivas están pendientes para este turno?",
            icon: Activity,
          },
        ];

      default:
        return [
          {
            label: "Estado General del Central",
            prompt: "Dame un diagnóstico integral de operaciones y producción",
            icon: Sparkles,
          },
          {
            label: "Alarmas Pendientes",
            prompt: "Consulta las alarmas activas del ingenio",
            icon: ShieldAlert,
          },
          {
            label: "Trazabilidad de Datos",
            prompt: "Explica el linaje de datos de molienda TCH",
            icon: Layers,
          },
        ];
    }
  };

  const actions = getContextualPrompts();

  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-slate-950/60 border-t border-slate-900 overflow-x-auto">
      {actions.map((act, idx) => {
        const Icon = act.icon;
        return (
          <button
            key={idx}
            onClick={() => onSelectAction(act.prompt)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-cyan-300 text-xs font-mono transition shadow-sm whitespace-nowrap"
          >
            <Icon className="w-3 h-3 text-cyan-400" />
            <span>{act.label}</span>
          </button>
        );
      })}
    </div>
  );
};
