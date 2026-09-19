import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Industrial PWA ServiceWorker Registration (Air-gapped mill operation)
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info('[PWA] BioAzúcar 4.0 update ready.');
  },
  onOfflineReady() {
    console.info('[PWA] BioAzúcar 4.0 offline shell cached and ready.');
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
