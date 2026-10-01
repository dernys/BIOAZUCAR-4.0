import React, { createContext, useContext } from "react";
import { useModuleFullscreen, UseModuleFullscreenReturn } from "./useModuleFullscreen";
import { ModuleFullscreenButton } from "./ModuleFullscreenButton";
import { Monitor, ChevronRight } from "lucide-react";

interface FullscreenContextValue extends UseModuleFullscreenReturn {
  theme: "dark" | "light";
  moduleId: string;
}

const FullscreenContext = createContext<FullscreenContextValue | null>(null);

export function useModuleFullscreenContext(): FullscreenContextValue {
  const ctx = useContext(FullscreenContext);
  if (!ctx) {
    throw new Error("useModuleFullscreenContext must be used within a FullscreenModuleLayout");
  }
  return ctx;
}

export interface FullscreenModuleLayoutProps {
  moduleId: string;
  moduleName?: string;
  badge?: string;
  theme?: "dark" | "light";
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  hideHeaderInNormalView?: boolean;
  className?: string;
  containerClassName?: string;
}

export const FullscreenModuleLayout: React.FC<FullscreenModuleLayoutProps> = ({
  moduleId,
  moduleName,
  badge,
  theme = "dark",
  children,
  headerRight,
  hideHeaderInNormalView = true,
  className = "",
  containerClassName = "",
}) => {
  const fsState = useModuleFullscreen({ moduleId });
  const { isFullscreen, toggleFullscreen, containerRef } = fsState;
  const isLight = theme === "light";

  const contextValue: FullscreenContextValue = {
    ...fsState,
    theme: theme === "light" ? "light" : "dark",
    moduleId,
  };

  return (
    <FullscreenContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        data-module-id={moduleId}
        data-fullscreen={isFullscreen ? "true" : "false"}
        className={`${
          isFullscreen
            ? `fixed inset-0 z-50 w-screen h-screen overflow-y-auto flex flex-col transition-colors duration-200 ${
                isLight ? "bg-slate-100 text-slate-900" : "bg-slate-950 text-slate-100"
              }`
            : `w-full relative transition-colors duration-200 ${containerClassName}`
        }`}
      >
        {/* Fullscreen Floating Exit & Minimal Navigation Header */}
        {isFullscreen && (
          <header
            className={`sticky top-0 z-50 w-full px-4 py-2 border-b backdrop-blur-md flex items-center justify-between select-none shadow-md ${
              isLight
                ? "bg-white/95 border-slate-300 text-slate-800"
                : "bg-slate-950/95 border-slate-800 text-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold uppercase tracking-wider text-[11px]">
                <Monitor className="w-3.5 h-3.5" />
                <span>Fullscreen OT Mode</span>
              </span>
              <ChevronRight className="w-3 h-3 text-slate-400" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {moduleName || moduleId.toUpperCase()}
              </span>
              {badge && (
                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px]">
                  {badge}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerRight}
              <ModuleFullscreenButton
                isFullscreen={true}
                onToggle={toggleFullscreen}
                theme={theme}
                label="Salir de Pantalla Completa"
              />
            </div>
          </header>
        )}

        {/* Normal Module Quick Action Bar */}
        {!isFullscreen && (
          hideHeaderInNormalView ? (
            <div className="flex items-center justify-end gap-2 pb-2 mb-2 border-b border-slate-200/40 dark:border-slate-800/40">
              <ModuleFullscreenButton
                isFullscreen={false}
                onToggle={toggleFullscreen}
                theme={theme}
                compact={false}
                label="Pantalla Completa OT"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-tech uppercase tracking-wide">
                  {moduleName || moduleId}
                </h2>
                {badge && (
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 font-mono">
                    {badge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {headerRight}
                <ModuleFullscreenButton
                  isFullscreen={false}
                  onToggle={toggleFullscreen}
                  theme={theme}
                />
              </div>
            </div>
          )
        )}

        {/* Inner Content Area */}
        <div className={`flex-1 ${isFullscreen ? "p-3 sm:p-6" : ""} ${className}`}>
          {children}
        </div>
      </div>
    </FullscreenContext.Provider>
  );
};
