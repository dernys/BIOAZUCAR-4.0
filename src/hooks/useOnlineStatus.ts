import { useEffect, useState } from 'react';
import { OfflineSyncManager } from '../services/offline/OfflineSyncManager';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also subscribe to OfflineSyncManager if available
    let unsubscribeSync: (() => void) | undefined;
    try {
      const syncManager = OfflineSyncManager.getInstance();
      unsubscribeSync = syncManager.subscribe((status) => {
        setIsOnline(status.isOnline);
      });
    } catch {
      // Ignore if OfflineSyncManager is not yet instantiated
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (unsubscribeSync) {
        unsubscribeSync();
      }
    };
  }, []);

  return isOnline;
}
