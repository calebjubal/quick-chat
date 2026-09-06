import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',
    manifest: { name: 'Quickchat', short_name: 'Quickchat', description: 'Fast, focused messaging', theme_color: '#16090A', background_color: '#16090A', display: 'standalone', start_url: '/', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] },
    workbox: { navigateFallback: '/index.html', runtimeCaching: [], cleanupOutdatedCaches: true, importScripts: ['/push-handler.js'] },
  })],
})
