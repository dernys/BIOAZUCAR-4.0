import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Industrial PWA ServiceWorker Registration (Air-gapped mill operation)
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
