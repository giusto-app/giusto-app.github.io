import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
// No path-alias helper needed; workspace packages resolve by name.

export default defineConfig({
  server: {
    port: 5151,
    strictPort: true,
  },
  resolve: {
    // Prefer workspace package resolution for `lilyjs`, `lily-parser`, and
    // `lily-viewer`. Vendored packages are now proper workspace packages with
    // package.json files, so explicit aliases are no longer required.
    alias: {},
  },
  build: {
    rollupOptions: {
      // The vendored lilyjs.esm.js keeps its non-default SMuFL fonts as
      // EXTERNAL dynamic imports (lilyJS's own build declares them external
      // the same way). They are never executed here — Giusto renders with the
      // bundled Bravura only — so Rollup must not try to resolve them.
      external: (id) => id.includes('/generated/smufl/'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: false },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        clientsClaim: true,
        skipWaiting: true,
      },
      manifest: {
        name: 'Giusto – Intonation Trainer',
        short_name: 'Giusto',
        description: 'Real-time intonation trainer for string players',
        theme_color: '#030712',
        background_color: '#030712',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
