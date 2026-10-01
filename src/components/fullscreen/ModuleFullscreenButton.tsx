import React from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export interface ModuleFullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  theme?: "dark" | "light";
  className?: string;
  compact?: boolean;
  showLabel?: boolean;
  label?: string;
  title?: string;
}

export const ModuleFullscreenButton: React.FC<ModuleFullscreenButtonProps> = ({
  isFullscreen,
  onToggle,
  theme = "dark",
  className = "",
  compact = false,
  showLabel = true,
  label,
  title,
}) => {
  const isLight = theme === "light";
  const defaultTitle = isFullscreen
    ? "Salir de pantalla completa (Esc)"
    : "Modo Pantalla Completa (F11/Esc)";
  const defaultLabel = isFullscreen ? "Salir Fullscreen" : "Pantalla Completa";

  return (
    <button
      type="button"
      onClick={onToggle}
      title={title || defaultTitle}
      aria-label={title || defaultTitle}
      className={`inline-flex items-center justify-center gap-1.5 font-medium transition-all duration-150 rounded-lg select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
        compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs"
      } ${
        isLight
          ? isFullscreen
            ? "bg-emerald-100 border border-emerald-300 text-emerald-800 hover:bg-emerald-200 shadow-sm"
            : "bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 hover:text-slate-900 shadow-sm"
          : isFullscreen
          ? "bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900 shadow-sm"
          : "bg-slate-800/90 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white shadow-sm"
      } ${className}`}
    >
      {isFullscreen ? (
        <Minimize2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
      ) : (
        <Maximize2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      )}
      {showLabel && (
        <span className="font-semibold">{label || defaultLabel}</span>
      )}
    </button>
  );
};
