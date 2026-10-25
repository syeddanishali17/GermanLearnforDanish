/// <reference types="vitest/config" />
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Runs worker/index.ts (API + D1) inside workerd during `vite dev`; builds it for `wrangler deploy`.
    // Disabled under vitest, where worker tests use an in-memory D1 shim instead.
    ...(process.env.VITEST ? [] : [cloudflare()]),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Ustad: German speaking coach',
        short_name: 'Ustad',
        description: "Danish's personal German speaking coach for Vienna",
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f2e7',
        theme_color: '#1f4a35',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globIgnores: ['audio/**', 'audio-private/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ustad-audio', expiration: { maxEntries: 2000, maxAgeSeconds: 365 * 86400 } },
          },
          {
            // Personal phrase audio (login-only). Deleted on logout (src/lib/privacy.ts).
            urlPattern: ({ url }) => url.pathname.startsWith('/audio-private/'),
            handler: 'CacheFirst',
            options: { cacheName: 'ustad-audio-private', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 86400 }, cacheableResponse: { statuses: [200] } },
          },
          {
            // Last good copy of study data, so the app opens offline (spec §8.2). Expires after 3 days and is
            // deleted on logout (src/lib/privacy.ts). Login, export and conversations are never cached.
            urlPattern: ({ url }) => /^\/api\/(daily|review\/queue|items|culture|stats\/dashboard|missions)$/.test(url.pathname),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'ustad-api',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 40, maxAgeSeconds: 3 * 86400 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  // Content lives in ../data and ../docs (shared with tools/tts).
  server: { port: 5173, fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
  },
})
