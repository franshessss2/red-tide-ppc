import { useEffect, useId, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { AnimatePresence, animate, motion, useMotionValue } from 'motion/react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../motion/preferences'
import { createMotionScope } from '../motion/scope'
import { MOTION, spring, tween } from '../motion/tokens'
import { useModalFocus } from '../motion/useModalFocus'
import { formatBytes } from '../lib/format'
import { prepareReportPhoto, type PreparedPhoto } from '../lib/lowDataPhoto'
import { readReportDraft, saveReportDraft, clearReportDraft } from '../lib/reportDraft'
import { OPEN_RECEIPTS_EVENT } from '../lib/reportOutbox'
import { useOnlineStatus } from '../lib/useOnlineStatus'
import {
  MAX_DESCRIPTION_LENGTH,
  MIN_DESCRIPTION_LENGTH,
  useAppStore,
} from '../store'
import type { Zone } from '../types'
import { ZoneStatusBadge } from './StatusBadge'

type Phase = 'idle' | 'submitting' | 'success' | 'saved' | 'closing'

/** How long the success confirmation stays up before the sheet dismisses. */
const SUCCESS_HOLD_MS = MOTION.time.successHold * 1000

/**
 * Anonymous report form — bottom sheet on phones, centred modal on wider
 * screens.
 *
 * DATA FLOW IS UNCHANGED: this still calls `store.submitReport` with the same
 * draft shape, and `store` still owns validation, the photo upload order and
 * closing the sheet. Nothing about the write path is touched here.
 *
 * The one structural addition is a presentation latch. `submitReport` clears
 * `reportZoneId` the moment the write succeeds, which would unmount this
 * component before it could show a success state. The parent (`MapPage`) holds
 * the zone reference and passes `open` down, so:
 *
 *   cancel      → `open` false while idle      → sheet animates out
 *   submit ok   → `open` false while submitting → stays up, flips to success,
 *                 holds ~1.6s, then animates out
 *   submit fail → `open` stays true             → form stays, error shows inline
 *
 * The dialog retains focus ownership through confirmation and exit. Its
 * nested status region announces success once.
 */
export function ReportForm({
  zone,
  open,
  onClose,
  onDismissed,
}: {
  zone: Zone
  /** Driven by the store. False means the store considers the sheet closed. */
  open: boolean
  onClose: () => void
  /** Called once the exit animation has finished, so the parent can drop the latch. */
  onDismissed: () => void
}) {
  const submitReport = useAppStore((state) => state.submitReport)
  const backendKind = useAppStore((state) => state.backendKind)
  const formError = useAppStore((state) => state.formError)
  const photoConfigured = Boolean(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() &&
    import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim())
  const canAttachPhoto = backendKind === 'demo' || photoConfigured
  const reduceMotion = useReducedMotion()
  const online = useOnlineStatus()

  const [recoveredDraft, setRecoveredDraft] = useState(() => readReportDraft(backendKind, zone.id))
  const [description, setDescription] = useState(recoveredDraft)
  const [draftAvailable, setDraftAvailable] = useState(true)
  const completedDraft = useRef(false)
  const latestDescription = useRef(description)
  latestDescription.current = description
  useEffect(() => {
    const flush = () => { if (!completedDraft.current) saveReportDraft(backendKind, zone.id, latestDescription.current) }
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, [backendKind, zone.id])
  useEffect(() => {
    const timer = setTimeout(() => { if (!completedDraft.current) setDraftAvailable(saveReportDraft(backendKind, zone.id, description)) }, 350)
    return () => clearTimeout(timer)
  }, [description, backendKind, zone.id])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoInfo, setPhotoInfo] = useState<PreparedPhoto | null>(null)
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const photoSelection = useRef(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [descriptionError, setDescriptionError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [savingOnly, setSavingOnly] = useState(false)
  const [failedAttempt, setFailedAttempt] = useState(0)
  const shakeX = useMotionValue(0)
  const acknowledgedFailure = useRef(0)
  useEffect(() => {
    shakeX.jump(0)
    const freshFailure = acknowledgedFailure.current !== failedAttempt
    acknowledgedFailure.current = failedAttempt
    if (!freshFailure || reduceMotion) return
    const animation = animate(shakeX, [0, -8, 8, -5, 5, 0], tween(false, MOTION.time.errorShake))
    return () => { animation.stop(); shakeX.jump(0) }
  }, [failedAttempt, reduceMotion, shakeX])

  const alive = useRef(false)
  const submittingRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const retiredPhotoUrls = useRef(new Set<string>())
  function releaseRetiredPhotos() {
    for (const url of retiredPhotoUrls.current) URL.revokeObjectURL(url)
    retiredPhotoUrls.current.clear()
  }
  const textareaId = useId()
  const descriptionRef = useRef<HTMLTextAreaElement>(null)
  const characterCount = description.trim().length
  const tooShort = characterCount < MIN_DESCRIPTION_LENGTH

  const isSuccess = phase === 'success' || phase === 'saved'
  const isSubmitting = phase === 'submitting'
  // `submitting` is included so the sheet does not flash out in the instant
  // between the store closing it and this component learning it succeeded.
  const visible = open || isSubmitting || isSuccess

  function dismiss() {
    if (submittingRef.current) return
    if (isSuccess) setPhase('closing')
    onClose()
  }
  useModalFocus(panelRef, dismiss)

  // Hold the success state briefly, then let it exit.
  useEffect(() => {
    if (!isSuccess || phase === 'saved') return
    const scope = createMotionScope()
    scope.timeout(() => setPhase('closing'), SUCCESS_HOLD_MS)
    return () => scope.dispose()
  }, [isSuccess, phase])

  useEffect(() => {
    return () => {
      if (previewUrl) retiredPhotoUrls.current.add(previewUrl)
    }
  }, [previewUrl])
  useEffect(() => () => releaseRetiredPhotos(), [])

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selection = ++photoSelection.current
    const file = event.target.files?.[0] ?? null
    setPhoto(null)
    setPhotoInfo(null)
    setPreviewUrl(null)
    setLocalError(null)
    if (!file) {
      setPreparingPhoto(false)
      return
    }
    setPreparingPhoto(true)
    try {
      const info = await prepareReportPhoto(file)
      if (!alive.current || selection !== photoSelection.current) return
      const preview = URL.createObjectURL(info.file)
      setPhoto(info.file)
      setPhotoInfo(info)
      setPreviewUrl(preview)
    } catch (error) {
      if (alive.current && selection === photoSelection.current) setLocalError(error instanceof Error ? error.message : 'Could not prepare that photo.')
    } finally {
      if (alive.current && selection === photoSelection.current) setPreparingPhoto(false)
    }
  }

  async function handleSubmit(event: FormEvent, saveOnly = false) {
    event.preventDefault()
    if (submittingRef.current || preparingPhoto || !open) return
    if (tooShort) {
      setDescriptionError(`Please describe what you saw in at least ${MIN_DESCRIPTION_LENGTH} characters. Add ${MIN_DESCRIPTION_LENGTH - characterCount} more to submit.`)
      descriptionRef.current?.focus()
      return
    }
    setDescriptionError(null)
    submittingRef.current = true

    setSavingOnly(saveOnly || !online)
    setPhase('submitting')
    try {
      const outcome = await submitReport({ zoneId: zone.id, description, photo, ...(saveOnly ? { saveOnly: true } : {}) })
      completedDraft.current = true
      clearReportDraft(backendKind, zone.id)
      if (alive.current) setPhase(outcome?.delivery === 'saved' ? 'saved' : 'success')
    } catch {
      // store.submitReport already recorded the message in `formError`; the
      // form stays open and shows it inline.
      if (alive.current) { setPhase('idle'); setFailedAttempt(attempt => attempt + 1) }
    } finally {
      submittingRef.current = false
    }
  }

  const sheetTransition = spring(reduceMotion)

  return createPortal(
    <AnimatePresence onExitComplete={onDismissed}>
      {visible && (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-end justify-center sm:items-center">
          <motion.button
            type="button"
            aria-label="Close report form"
            onClick={dismiss}
            tabIndex={-1}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tween(reduceMotion)}
            className="absolute inset-0 h-full w-full cursor-default bg-ink/72 backdrop-blur-[3px]"
          />

          <motion.div
            ref={panelRef}
            style={{ x: shakeX }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={isSuccess ? phase === 'saved' ? 'Report saved on this device' : 'Report sent' : undefined}
            aria-labelledby={isSuccess ? undefined : `${textareaId}-title`}
            initial={{ opacity: 0, y: reduceMotion ? 0 : 34 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 24 }}
            transition={sheetTransition}
            className="relative max-h-[92svh] w-full overflow-y-auto overscroll-contain rounded-t-2xl border border-line bg-ink-2 shadow-[0_-8px_60px_-12px_rgb(0_0_0/0.9)] sm:max-w-lg sm:rounded-2xl sm:shadow-[0_24px_70px_-20px_rgb(0_0_0/0.9)]"
          >
            <AnimatePresence mode="wait" initial={false}>
              {isSuccess ? (
                phase === 'saved' ? <div key="saved" role="status" className="p-6 text-center">
                  <h2 className="font-display text-3xl text-paper">Saved on this device</h2>
                  <p className="mt-3 text-sm text-muted">No server receipt yet. Your text and prepared photo are kept in My reports. Sending continues only if you already requested it; saved-only reports wait for you to press Send.</p>
                  <button type="button" className="mt-5 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-ink" onClick={() => { dismiss(); window.dispatchEvent(new Event(OPEN_RECEIPTS_EVENT)) }}>Open My reports</button>
                  <button type="button" className="ml-3 mt-3 text-sm text-muted underline" onClick={dismiss}>Close</button>
                </div> : <SuccessPanel key="success" zoneName={zone.name} hasPhoto={!!photo} />
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  aria-busy={isSubmitting}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={tween(reduceMotion, MOTION.time.fast)}
                  className="p-5"
                >
                  <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line sm:hidden" />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-48">
                      <h2
                        id={`${textareaId}-title`}
                        className="font-display text-2xl leading-none text-paper"
                      >
                        Report something here
                      </h2>
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                        Anonymous · no account needed
                      </p>
                    </div>
                    <ZoneStatusBadge status={zone.status} size="sm" />
                  </div>

                  <p className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-ink-3 px-3 py-2">
                    <span className="font-display text-base text-paper [overflow-wrap:anywhere]">
                      {zone.name}
                    </span>
                  </p>

                  <label
                    htmlFor={textareaId}
                    className="mt-4 block font-mono text-[10px] uppercase tracking-[0.14em] text-faint"
                  >
                    What did you see?
                  </label>
                  <textarea
                    id={textareaId}
                    ref={descriptionRef}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value)
                      setDescriptionError(null)
                    }}
                    aria-invalid={descriptionError ? true : undefined}
                    aria-describedby={`${textareaId}-hint${descriptionError ? ` ${textareaId}-error` : ''}`}
                    rows={4}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    placeholder="e.g. Water turned reddish-brown near the shallows this morning, and there were dead shellfish on the sand."
                    className="mt-1.5 w-full resize-y rounded-xl border border-line bg-ink px-3 py-2.5 text-sm text-paper placeholder:text-faint focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/25"
                  />
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px]">
                    <span
                      id={`${textareaId}-hint`}
                      className={`transition-colors duration-[var(--motion-base)] ${
                        tooShort ? 'text-faint' : 'text-safe'
                      }`}
                    >
                      {tooShort
                        ? `Add ${MIN_DESCRIPTION_LENGTH - characterCount} more characters to submit`
                        : 'Looks good'}
                    </span>
                    <span className="tabular-nums text-faint">
                      {characterCount}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  </div>

                  <div className="mt-4">
                    {(description || recoveredDraft) && <div className="mb-3 rounded-lg border border-line bg-ink-3 p-3 text-xs text-muted">
                      <p>{!draftAvailable ? 'Draft recovery is unavailable on this device. Keep this page open until you finish.' : recoveredDraft ? 'Recovered an unfinished draft from this device. Choose your photo again, or check My reports for saved photo reports.' : 'Draft text stays on this device for up to 7 days. Use Save report for later to also keep the photo.'}</p>
                      <button type="button" disabled={isSubmitting} className="mt-2 text-accent underline" onClick={() => { setDescription(''); setRecoveredDraft(''); clearReportDraft(backendKind, zone.id) }}>Clear saved text</button>
                    </div>}
                    <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-faint">
                      Photo{' '}
                      <span className="normal-case tracking-normal text-faint/70">
                        (optional)
                      </span>
                    </span>

                    {!canAttachPhoto && <p className="mt-2 text-xs text-muted">Photo attachments are unavailable right now. You can still send a description for review.</p>}
                    {canAttachPhoto && <div className="relative">
                    <AnimatePresence mode="popLayout" initial={false} onExitComplete={releaseRetiredPhotos}>
                    {previewUrl ? (
                      <motion.div key={previewUrl}
                        initial={{ scale: reduceMotion ? 1 : 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ scale: spring(reduceMotion), opacity: tween(reduceMotion, MOTION.time.photoSwap) }}
                        className="mt-2 flex items-center gap-3 rounded-xl border border-line p-2">
                        <img
                          src={previewUrl}
                          alt="Selected report attachment"
                          className="h-16 w-16 shrink-0 rounded-lg object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-paper/85">
                            {photo?.name}
                          </p>
                          <p className="font-mono text-[10px] text-faint">
                            {photoInfo ? `${formatBytes(photoInfo.originalBytes)} → ${formatBytes(photoInfo.file.size)}` : ''}
                          </p>
                          <p className="mt-1 text-xs text-safe">Low-data photo ready</p>
                          <button
                            type="button"
                            onClick={() => {
                              setPhoto(null)
                              setPhotoInfo(null)
                              setPreviewUrl(null)
                              if (fileInputRef.current) fileInputRef.current.value = ''
                            }}
                            className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-advisory hover:underline"
                          >
                            Remove photo
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.label key="picker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={tween(reduceMotion, MOTION.time.photoSwap)} className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-ink px-3 py-4 text-sm font-medium text-muted transition-colors duration-[var(--motion-base)] hover:border-accent/50 hover:text-accent">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6.5 8.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm-3.5 8 4.5-5 3 3 2-2 4.5 4H3Z"
                          />
                          <rect x="1.75" y="2.75" width="16.5" height="14.5" rx="2.5" />
                        </svg>
                        Take or choose a photo
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          onChange={handleFileChange}
                          className="sr-only"
                        />
                      </motion.label>
                    )}
                    </AnimatePresence>
                    <p role="status" className="mt-2 text-xs text-muted">{preparingPhoto ? 'Preparing a smaller photo on this device…' : 'Photos are resized on this device before sending. Original files stay unchanged. Up to 20 MB.'}</p>
                    </div>}
                  </div>

                  <AnimatePresence initial={false}>
                  {(descriptionError || localError || formError) && (
                    <motion.div key="error"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }} transition={tween(reduceMotion, MOTION.time.errorExpand)}
                      className="overflow-hidden"
                    >
                    <p
                      id={`${textareaId}-error`}
                      role="alert"
                      className="mt-3 rounded-lg border border-advisory/30 bg-advisory/10 px-3 py-2 text-xs font-medium text-advisory"
                    >
                      {descriptionError ?? localError ?? formError}
                    </p>
                    </motion.div>
                  )}
                  </AnimatePresence>

                  <div className="mt-5 flex gap-2">
                    <motion.button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="motion-press flex-1 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-paper/80 transition-colors duration-[var(--motion-base)] hover:bg-white/5 disabled:opacity-40"
                    >
                      Cancel
                    </motion.button>

                    <motion.button
                      type="submit"
                      disabled={isSubmitting || preparingPhoto}
                      className="motion-press relative flex-[1.4] overflow-hidden rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition-colors duration-[var(--motion-base)] hover:bg-accent/90 disabled:cursor-wait"
                    >
                      {/* Indeterminate sweep while the photo uploads and the
                          write lands — feedback that survives a slow network. */}
                      {isSubmitting && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
                        >
                          <span className="animate-sheen block h-full w-full bg-ink/40" />
                        </span>
                      )}
                      <span className="flex items-center justify-center gap-2">
                        {isSubmitting && (
                          <Spinner className="h-3.5 w-3.5 text-ink/70" />
                        )}
                        {isSubmitting ? savingOnly ? 'Saving…' : 'Sending…' : online ? 'Submit report' : 'Save on this device'}
                      </span>
                    </motion.button>
                  </div>

                  {backendKind === 'firebase' && isSubmitting && !savingOnly && <p role="status" className="mt-3 text-xs text-muted">Waiting for a server receipt. If confirmation takes longer, check the saved report in My reports.</p>}

                  {typeof indexedDB !== 'undefined' && <button type="button" disabled={isSubmitting || preparingPhoto || tooShort} className="mt-3 min-h-11 w-full text-sm text-muted underline disabled:opacity-40" onClick={event => void handleSubmit(event, true)}>Save report for later</button>}
                  <p className="mt-3 font-mono text-[10px] leading-relaxed text-faint">
                    Reports are reviewed by an admin before they change a zone's
                    status. This app does not replace an official BFAR advisory.
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>, document.body
  )
}

/**
 * Success confirmation.
 *
 * Not a toast: the toast pattern tells the user nothing about *what* happened
 * once it disappears. This holds for ~1.6s with the zone named, so the person
 * who filed the report gets a clear end to the interaction before the sheet
 * closes itself.
 */
function SuccessPanel({
  zoneName,
  hasPhoto,
}: {
  zoneName: string
  hasPhoto: boolean
}) {
  const reduceMotion = useReducedMotion()

  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="relative grid h-16 w-16 place-items-center">
        {/* Expanding ring, then the tick draws itself. */}
        {!reduceMotion && <motion.span
          className="absolute inset-0 rounded-full border border-safe/40"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1.15, opacity: [0, 0.9, 0] }}
          transition={tween(false, MOTION.time.wash)}
          aria-hidden="true"
        />}
        <motion.span
          className="grid h-16 w-16 place-items-center rounded-full bg-safe/12 ring-1 ring-inset ring-safe/30"
          initial={{ scale: reduceMotion ? 1 : 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring(reduceMotion)}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-safe"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <motion.path
              d="M4 12.5 9.5 18 20 6.5"
              initial={{ pathLength: reduceMotion ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={tween(reduceMotion, MOTION.time.reveal, MOTION.time.fast)}
            />
          </svg>
        </motion.span>
      </div>

      <motion.h2
        className="font-display mt-5 text-3xl leading-none text-paper"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween(reduceMotion, MOTION.time.reveal, MOTION.time.stagger)}
      >
        Salamat!
      </motion.h2>

      <motion.p
        className="mt-2 max-w-xs text-sm leading-relaxed text-muted"
        initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tween(reduceMotion, MOTION.time.reveal, MOTION.time.stagger * 2)}
      >
        Your report for <span className="text-paper/90">{zoneName}</span> was sent
        for review.
        {hasPhoto && ' The photo came through with it.'}
      </motion.p>

      <motion.p
        className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-faint"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={tween(reduceMotion, MOTION.time.reveal, MOTION.time.stagger * 3)}
      >
        An admin will review it shortly
      </motion.p>
    </div>
  )
}

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
