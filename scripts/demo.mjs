// Isolated review launcher. Never loads project .env files or inherits VITE keys.
import { createServer } from 'vite'
import { fileURLToPath } from 'node:url'
for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key]
process.env.VITE_USE_DEMO_BACKEND = 'true'
process.env.VITE_ADMIN_PASSCODE = 'demo-review'
const args = process.argv.slice(2)
const portIndex = args.indexOf('--port')
const port = Number(portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || 5173)
const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)),
  envDir: false,
  server: {
    host: '0.0.0.0', port, strictPort: true,
    allowedHosts: ['localhost', '127.0.0.1', 'terminal.local'],
    // Additional protection: no HTTP connections to a remote data backend.
    headers: { 'Content-Security-Policy': "connect-src 'self' ws: wss:;" },
  },
})
await server.listen()
console.log('Isolated demo: localStorage only. Demo admin passcode: demo-review')
server.printUrls()
