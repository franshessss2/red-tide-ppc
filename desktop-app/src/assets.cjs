const fs = require('node:fs')
const path = require('node:path')
const { Readable } = require('node:stream')
const { localUrl, ROUTES } = require('./policy.cjs')

// Existing map/animation styles need inline style attributes. Scripts stay local;
// HTTPS image/data connections preserve the configured web backend and map providers.
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:", "font-src 'self' data:",
  "connect-src 'self' https: wss:", "media-src 'self' blob:",
  "worker-src 'self' blob:", "object-src 'none'", "frame-src 'none'",
  "frame-ancestors 'none'", "base-uri 'none'", "form-action 'self'",
].join('; ')
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ino': 'text/plain; charset=utf-8',
}

function assetPath(root, value) {
  const url = localUrl(value)
  if (!url) return null
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { return null }
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes(':') ||
      pathname.split('/').includes('..')) return null
  const relative = ROUTES.has(pathname) ? 'index.html' : pathname.slice(1)
  const resolved = path.resolve(root, relative)
  const boundary = path.relative(path.resolve(root), resolved)
  return boundary && !boundary.startsWith(`..${path.sep}`) && boundary !== '..' &&
    !path.isAbsolute(boundary) ? resolved : null
}

function rangeFor(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header)
  if (!match || !size || (!match[1] && !match[2])) return null
  const suffix = !match[1]
  const start = suffix ? Math.max(0, size - Number(match[2])) : Number(match[1])
  const end = suffix || !match[2] ? size - 1 : Math.min(size - 1, Number(match[2]))
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 &&
    end >= start && start < size ? { start, end } : null
}

async function serveAsset(root, request) {
  const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff' }
  const url = localUrl(request.url)
  if (!url) return new Response(null, { status: 403, headers })
  if (url.pathname.startsWith('/api/')) {
    return Response.json({ configured: false, readings: [], error: 'The desktop alpha has no local device API. Use the hosted device demonstration separately.' }, { status: 503, headers })
  }
  if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } })
  const filename = assetPath(root, request.url)
  if (!filename) return new Response(null, { status: 403, headers })
  let stat
  try { stat = await fs.promises.stat(filename) } catch { return new Response(null, { status: 404, headers }) }
  if (!stat.isFile()) return new Response(null, { status: 404, headers })
  headers['Content-Type'] = TYPES[path.extname(filename).toLowerCase()] || 'application/octet-stream'
  headers['Accept-Ranges'] = 'bytes'
  headers['Cache-Control'] = 'no-cache'
  let start = 0, end = stat.size - 1, status = 200
  const requestedRange = request.headers.get('range')
  if (requestedRange) {
    const range = rangeFor(requestedRange, stat.size)
    if (!range) return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${stat.size}` } })
    ;({ start, end } = range)
    status = 206
    headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
  }
  headers['Content-Length'] = String(Math.max(0, end - start + 1))
  if (request.method === 'HEAD' || !stat.size) return new Response(null, { status, headers })
  return new Response(Readable.toWeb(fs.createReadStream(filename, { start, end })), { status, headers })
}

module.exports = { CSP, assetPath, rangeFor, serveAsset }
