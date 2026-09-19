import React from 'react';
import { WifiOff, ShieldCheck, Database, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { OfflineSyncManager } from '../../services/offline/OfflineSyncManager';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [syncStatus, setSyncStatus] = React.useState(() => {
    try {
      return OfflineSyncManager.getInstance().getStatus();
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    try {
      const manager = OfflineSyncManager.getInstance();
      return manager.subscribe((status) => {
        setSyncStatus(status);
      });
    } catch {
      return undefined;
    }
  }, []);

  // When online, do not display the offline alert banner
  if (isOnline) {
    return null;
  }

  return (
    <div
      id="pwa-offline-indicator-banner"
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-md z-50 flex items-center justify-between gap-3 rounded-xl bg-slate-900/95 border border-amber-500/50 p-3 shadow-2xl backdrop-blur-md text-slate-100 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
          <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-400 tracking-wide font-mono">MODO PLANTA AISLADA (OFFLINE)</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
          </div>
          <p className="text-[11px] text-slate-300 leading-tight">
            La consola SCADA opera con ServiceWorker y caché local SQLite WAL en Edge IPC.
          </p>
        </div>
      </div>

      {syncStatus && syncStatus.pendingCount > 0 && (
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-700 text-[10px] font-mono text-slate-300">
          <Database className="w-3 h-3 text-amber-400" />
          <span>{syncStatus.pendingCount} en cola</span>
        </div>
      )}
    </div>
  );
};
