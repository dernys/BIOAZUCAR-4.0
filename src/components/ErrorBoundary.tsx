import React, { Component } from "react";
import { AlertOctagon, RefreshCw, Trash2 } from "lucide-react";

export interface ErrorBoundaryProps {
  children: any;
  fallbackTitle?: string;
  onReset?: () => void;
  theme?: "dark" | "light";
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class ErrorBoundary extends (Component as { new (props: any): any }) {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: any) {
    console.error("[BioAzúcar ErrorBoundary] Captured unhandled error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleClearCacheAndReload = () => {
    try {
      const keysToRemove = [
        "bioazucar_agricultural_parameters",
        "bioazucar_agricultural_plots",
        "bioazucar_agricultural_campaign",
        "bioazucar_agricultural_campaigns_list",
        "bioazucar_agricultural_operations",
        "bioazucar_agricultural_varieties",
        "bioazucar_agricultural_equipment",
        "bioazucar_agricultural_inputs",
        "bioazucar_agricultural_scenarios",
        "bioazucar_agricultural_audit_trail",
      ];
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn("Could not clear localStorage:", e);
    }
    this.handleReset();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const isLight = this.props.theme === "light";
      return (
        <div
          className={`p-6 my-4 mx-auto max-w-3xl rounded-xl border shadow-xl ${
            isLight
              ? "bg-white border-rose-200 text-slate-800"
              : "bg-slate-900/90 border-rose-900/60 text-slate-100"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-rose-500/10 text-rose-500 shrink-0">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-rose-500">
                {this.props.fallbackTitle || "Error en el Módulo Agronómico (PDA)"}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                Se detectó una excepción en la vista. Los datos maestros y el estado se han preservado de forma segura.
              </p>

              {this.state.error && (
                <div
                  className={`mt-3 p-3 rounded-md font-mono text-xs overflow-x-auto ${
                    isLight ? "bg-slate-100 text-rose-700" : "bg-slate-950 text-rose-400 border border-slate-800"
                  }`}
                >
                  {this.state.error.toString()}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reintentar Vista
                </button>
                <button
                  type="button"
                  onClick={this.handleClearCacheAndReload}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Restaurar Datos Canónicos & Recargar
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
