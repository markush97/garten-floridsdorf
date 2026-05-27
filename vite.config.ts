import path from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type PluginOption } from 'vite'

// Dev-only SPA fallback. The Cloudflare Pages Function only handles /api/*,
// and @cloudflare/vite-plugin does not rewrite unknown paths to index.html in
// dev. This rewrites GETs for non-asset, non-API paths so Vite serves
// index.html and TanStack Router takes over client-side.
function spaFallback(): PluginOption {
  return {
    name: 'local-spa-fallback',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url || req.method !== 'GET') return next()
        const url = new URL(req.url, 'http://localhost')
        const p = url.pathname
        if (
          p.startsWith('/api/') ||
          p.startsWith('/@') ||
          p.startsWith('/node_modules/') ||
          p.startsWith('/src/') ||
          p.includes('.')
        ) {
          return next()
        }
        req.url = '/'
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    spaFallback(),
    cloudflare(),
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src'),
      '~func': path.resolve(__dirname, './functions'),
    },
  },
})
