import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, ChevronRight } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running as an installed PWA / standalone window, do not render
  if (isInstalled) {
    return (
      <div 
        id="pwa-installed-badge"
        className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-[11px] font-mono text-emerald-400"
        title="BioAzúcar 4.0 está operando en modo PWA Standalone (Air-Gapped Ready)"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>PWA ACTIVA</span>
      </div>
    );
  }

  // Chromium / Edge / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-button"
        type="button"
        disabled={isInstalling}
        onClick={async () => {
          setIsInstalling(true);
          try {
            await install();
          } finally {
            setIsInstalling(false);
          }
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md hover:from-emerald-500 hover:to-teal-500 transition-all border border-emerald-400/30 cursor-pointer disabled:opacity-50"
        title="Instalar consola SCADA en el equipo local para operación offline"
      >
        <Download className="w-3.5 h-3.5 animate-bounce" />
        <span className="font-mono tracking-tight">INSTALAR APP</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported by WebKit)
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-button"
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
          title="Instrucciones para instalar en iPhone / iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-400" />
          <span>Instalar iOS</span>
        </button>

        {showIOSGuide && (
          <div 
            id="pwa-ios-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          >
            <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 p-5 shadow-2xl text-slate-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Instalar en iPad / iPhone</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-slate-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">1</span>
                  <p>Toca el botón <strong className="text-white">Compartir</strong> (icono de cuadrado con flecha hacia arriba) en la barra inferior de Safari.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">2</span>
                  <p>Desplázate hacia abajo y selecciona <strong className="text-white">"Agregar a Inicio"</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">3</span>
                  <p>Confirma tocando <strong className="text-white">"Agregar"</strong> para habilitar la estación SCADA offline autónoma.</p>
                </div>
              </div>

              <button
                id="pwa-ios-modal-close"
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-lg bg-slate-800 hover:bg-slate-700 py-2 text-xs font-semibold text-slate-200 transition"
              >
                Entendido
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
