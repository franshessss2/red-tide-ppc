import { MAX_PHOTO_BYTES } from './image'

export const MAX_SOURCE_PHOTO_BYTES = 20 * 1024 * 1024
const MAX_EDGE = 1600
const TARGET_BYTES = 450 * 1024
export interface PreparedPhoto { file: File; originalBytes: number; width: number; height: number }
const prepared = new WeakMap<File, PreparedPhoto>()

/** Local canvas conversion only; no upload and no change to the original file. */
export async function prepareReportPhoto(file: File): Promise<PreparedPhoto> {
  const cached = prepared.get(file)
  if (cached) return cached
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
    throw new Error('Choose a JPG, PNG, WebP or AVIF photo. Other formats cannot be prepared on this device.')
  }
  if (!file.size || file.size > MAX_SOURCE_PHOTO_BYTES) throw new Error('Choose a photo up to 20 MB.')
  if (typeof document === 'undefined') throw new Error('Photo preparation needs a browser. You can send a text-only report.')
  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      const finish = (error?: Error) => { clearTimeout(timer); img.onload = null; img.onerror = null; error ? reject(error) : resolve(img) }
      const timer = setTimeout(() => { img.src = ''; finish(new Error('Photo preparation timed out. Choose another photo or send text only.')) }, 10000)
      img.onload = () => finish()
      img.onerror = () => finish(new Error('Could not read that photo. Choose another photo or send text only.'))
      img.src = url
    })
    const edge = Math.max(image.naturalWidth, image.naturalHeight)
    if (!edge || image.naturalWidth * image.naturalHeight > 80_000_000) throw new Error('That photo is too large to prepare on this device.')
    const scale = Math.min(1, MAX_EDGE / edge)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Photo preparation is unavailable. You can send a text-only report.')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    let result: Blob | null = null
    for (const quality of [.8, .68, .55]) {
      result = await new Promise<Blob | null>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Photo preparation timed out. Choose another photo or send text only.')), 10000)
        try { canvas.toBlob(blob => { clearTimeout(timer); resolve(blob) }, 'image/jpeg', quality) }
        catch (error) { clearTimeout(timer); reject(error) }
      })
      if (!result) throw new Error('Could not prepare that photo. Choose another photo or send text only.')
      if (result.size <= TARGET_BYTES) break
    }
    // Keep a smaller, already-sized original rather than inflate its upload.
    const keepOriginal = edge <= MAX_EDGE && file.size < result!.size
    const upload = keepOriginal ? file : new File([result!], 'report-photo.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
    if (upload.size > MAX_PHOTO_BYTES) throw new Error('That photo is still too large. Choose another photo or send text only.')
    const info = { file: upload, originalBytes: file.size, width: keepOriginal ? image.naturalWidth : canvas.width, height: keepOriginal ? image.naturalHeight : canvas.height }
    prepared.set(file, info)
    prepared.set(upload, info)
    return info
  } finally { URL.revokeObjectURL(url) }
}
