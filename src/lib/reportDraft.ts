const PREFIX = 'red-tide-ppc:report-draft:v1:'
const MAX_AGE = 7 * 24 * 60 * 60 * 1000
const key = (backend: string, zoneId: string) => `${PREFIX}${backend}:${zoneId}`
/** Text only, per zone and backend. Never persists an attachment or submits it. */
export function readReportDraft(backend: string, zoneId: string, now = Date.now()): string {
  try {
    const raw = localStorage.getItem(key(backend, zoneId))
    if (!raw) return ''
    const draft = JSON.parse(raw)
    if (draft.version !== 1 || typeof draft.text !== 'string' || draft.text.length > 2000 ||
      typeof draft.savedAt !== 'number' || !Number.isFinite(draft.savedAt) || now - draft.savedAt > MAX_AGE || draft.savedAt > now + 60000) {
      localStorage.removeItem(key(backend, zoneId)); return ''
    }
    return draft.text
  } catch { return '' }
}
export function saveReportDraft(backend: string, zoneId: string, text: string): boolean {
  try {
    if (!text.trim()) localStorage.removeItem(key(backend, zoneId))
    else localStorage.setItem(key(backend, zoneId), JSON.stringify({ version: 1, text: text.slice(0, 2000), savedAt: Date.now() }))
    return true
  } catch { return false }
}
export function clearReportDraft(backend: string, zoneId: string): void {
  try { localStorage.removeItem(key(backend, zoneId)) } catch { /* The form remains usable in restricted storage. */ }
}
