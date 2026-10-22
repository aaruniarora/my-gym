/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function gitShortSha() {
  try { return execSync('git rev-parse --short HEAD').toString().trim() } catch { return undefined }
}
const sha = (process.env.GITHUB_SHA ?? gitShortSha() ?? 'dev').slice(0, 7)
const built = new Date().toISOString().slice(0, 10)

export default defineConfig({
  base: '/my-gym/',
  define: { __APP_VERSION__: JSON.stringify(`${sha} · ${built}`) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'my-gym',
        short_name: 'my-gym',
        start_url: '/my-gym/',
        scope: '/my-gym/',
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,jpg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/my-gym/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/i\.ytimg\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'yt-thumbs',
              expiration: { maxEntries: 200 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: { include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' },
})
