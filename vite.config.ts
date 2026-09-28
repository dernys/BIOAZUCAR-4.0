import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { defineConfig, PluginOption } from 'vite';

delete (globalThis as any).__dirname;

/**
 * BioAzúcar 4.0 Industrial HMR-Free Client Runtime Plugin
 * Completely eradicates WebSocket connections and HMR polling in sandbox/container.
 * Guarantees zero WebSocket connections in DevTools Network -> WS.
 */
function noHmrWebSocketPlugin(): PluginOption {
  const clientCode = `// BioAzúcar 4.0 Industrial HMR-Free Client Runtime
// Completely eradicates WebSocket connections and HMR polling in sandbox/container.

const sheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}

export function updateStyle(id, content) {
  if (typeof document === 'undefined') return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  }
  style.textContent = content;
}

export function removeStyle(id) {
  if (typeof document === 'undefined') return;
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}

export function createHotContext() {
  return {
    accept() {},
    acceptExports() {},
    dispose() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {}
  };
}

export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const search = url.slice(pathname.length);
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '');
}

export class ErrorOverlay extends HTMLElement {}
if (typeof customElements !== 'undefined' && !customElements.get('vite-error-overlay')) {
  customElements.define('vite-error-overlay', ErrorOverlay);
}
`;

  return {
    name: 'bioazucar:no-hmr-websocket',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (url === '/@vite/client' || url.startsWith('/@vite/client?') || url.startsWith('/@vite/client/')) {
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('Cache-Control', 'no-cache');
          res.end(clientCode);
          return;
        }
        next();
      });
    },
    resolveId(id) {
      if (id === '/@vite/client' || id === '@vite/client') {
        return '\0virtual:vite-no-hmr-client';
      }
    },
    load(id) {
      if (id === '\0virtual:vite-no-hmr-client') {
        return clientCode;
      }
    },
  };
}

export default defineConfig(async () => {
  delete (globalThis as any).__dirname;
  const { VitePWA } = await import('vite-plugin-pwa');

  const plugins: PluginOption[] = [
    noHmrWebSocketPlugin(),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
      manifest: {
        id: '/',
        name: 'BioAzúcar 4.0 - Smart Mill & Cogeneration MES/IIoT',
        short_name: 'BioAzúcar',
        description: 'Plataforma de Industria 4.0, Gemelo Digital y Planificación Agrícola PDA para Central Azucarero y Cogeneración Eléctrica con balance de masa/energía, SCADA, curvas TCH, logística CCT, IA analítica y OEE.',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^\/api\/telemetry\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'edge-telemetry-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ];

  return {
    plugins,
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      hmr: false,
      watch: null,
    },
  };
});
