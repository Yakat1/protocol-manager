import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isElectron = env.ELECTRON === 'true';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icons/*.png'],
        manifest: {
          name: 'LIMS Protocol Manager',
          short_name: 'LIMS',
          description: 'Sistema de Gestión de Laboratorio – Cultivos, Western Blot, Inventario y más',
          theme_color: '#0f0f1a',
          background_color: '#0f0f1a',
          display: 'standalone',
          orientation: 'landscape',
          scope: '/protocol-manager/',
          start_url: '/protocol-manager/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
        },
        workbox: {
          // Cachear todos los assets de la app para modo offline
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          // Estrategia: primero caché, luego red
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
            },
            {
              urlPattern: /^https:\/\/.*\.firebaseio\.com\/.*/i,
              handler: 'NetworkFirst',
              options: { cacheName: 'firebase-cache' },
            },
          ],
        },
      }),
    ],
    server: { port: 5173 },
    // GitHub Pages necesita '/protocol-manager/', Electron necesita './'
    base: isElectron ? './' : '/protocol-manager/',
  };
});
