import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  server: { proxy: { '/api': { target: 'http://localhost:3001' }, '/health': { target: 'http://localhost:3001' } } },
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'Quickchat', short_name: 'Quickchat', description: 'Fast, focused messaging', theme_color: '#16090A', background_color: '#16090A', display: 'standalone', start_url: '/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/health(?:\/|$)/], runtimeCaching: [], cleanupOutdatedCaches: true },
  })],
})
