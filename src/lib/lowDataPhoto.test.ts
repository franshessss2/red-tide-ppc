// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { prepareReportPhoto } from './lowDataPhoto'
let dimensions: [number, number], bytes: number
let revoke: ReturnType<typeof vi.fn>
beforeEach(() => {
  dimensions = [4000, 3000]; bytes = 180000
  revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:photo'), revokeObjectURL: revoke })
  vi.stubGlobal('Image', class {
    naturalWidth = dimensions[0]; naturalHeight = dimensions[1]
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect: vi.fn(), drawImage: vi.fn() } as unknown as CanvasRenderingContext2D)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' })))
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('prepares a bounded JPEG and reuses it without re-encoding on upload', async () => {
  const source = new File([new Uint8Array(3_000_000)], 'phone.png', { type: 'image/png' })
  const result = await prepareReportPhoto(source)
  expect(result).toMatchObject({ originalBytes: 3_000_000, width: 1600, height: 1200 })
  expect(result.file.type).toBe('image/jpeg')
  expect(result.file.size).toBe(180000)
  expect(await prepareReportPhoto(result.file)).toBe(result)
  expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(1)
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:photo')
})
it('never inflates an already small photo', async () => {
  dimensions = [500, 400]
  const source = new File([new Uint8Array(30000)], 'small.jpg', { type: 'image/jpeg' })
  expect((await prepareReportPhoto(source)).file).toBe(source)
})
it('rejects unsupported or oversized originals before decoding', async () => {
  await expect(prepareReportPhoto(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).rejects.toThrow('JPG')
  await expect(prepareReportPhoto(new File([new Uint8Array(21*1024*1024)], 'x.jpg', { type: 'image/jpeg' }))).rejects.toThrow('20 MB')
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})
it('releases the source and reports failed encoding instead of uploading the original', async () => {
  vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation(callback => callback(null))
  await expect(prepareReportPhoto(new File(['x'], 'x.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Could not prepare')
  expect(revoke).toHaveBeenCalledOnce()
})
