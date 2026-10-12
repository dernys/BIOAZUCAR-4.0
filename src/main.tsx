import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Industrial PWA ServiceWorker Registration (Air-gapped mill operation)
if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onNeedRefresh() {
        console.info('[PWA] BioAzúcar 4.0 update ready.');
      },
      onOfflineReady() {
        console.info('[PWA] BioAzúcar 4.0 offline shell cached and ready.');
      },
      onRegisterError(error) {
        console.warn('[PWA] Service Worker registration skipped or restricted in sandbox/iframe:', error);
      },
    });
  } catch (pwaErr) {
    console.warn('[PWA] Service Worker initialization bypassed:', pwaErr);
  }
} else if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  // In development mode, unregister any stale production service workers
  // to ensure Workbox router doesn't intercept live dev-server requests or assets.
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    }).catch(() => {});
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Error al iniciar BioAzúcar 4.0">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
