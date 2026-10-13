const SCHEME = 'rtp'
const APP_ORIGIN = 'rtp://app'
const APP_URL = `${APP_ORIGIN}/`
const ROUTES = new Set(['/', '/map', '/admin', '/devices'])
const EXTERNAL_HOSTS = new Set([
  'www.bfar-frmdhabmonitoring.com.ph', 'github.com', 'drive.google.com',
  'www.openstreetmap.org', 'openstreetmap.org', 'wokwi.com',
  'carto.com', 'www.carto.com', 'maplibre.org', 'res.cloudinary.com',
])

function localUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === `${SCHEME}:` && url.hostname === 'app' &&
      !url.port && !url.username && !url.password ? url : null
  } catch { return null }
}

function arduinoUrl(value) {
  const url = localUrl(value)
  return Boolean(url && ['/arduino.html', '/arduino-demo.html'].includes(url.pathname))
}

function externalUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && EXTERNAL_HOSTS.has(url.hostname) ? url.href : null
  } catch { return null }
}

module.exports = { SCHEME, APP_ORIGIN, APP_URL, ROUTES, localUrl, arduinoUrl, externalUrl }
