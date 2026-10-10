import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  TEAM_MEMBERS,
  TEAM_PLACEHOLDER_ASSETS,
  TEAM_SECTION_ENABLED,
  teamAssetPaths,
  type TeamMember,
} from './team'

/**
 * The gate on `TEAM_SECTION_ENABLED`.
 *
 * The strip must not go live half-finished: not with a stand-in name, not with
 * a stand-in clip, and not pointing at a file that is not on disk. Those three
 * failures are invisible in a unit test that renders with `enabled` forced, and
 * on the landing page they would show as "Team member 01" next to a broken
 * image — so they are asserted here instead, against the real repository.
 *
 * Everything below is conditional on the flag. While it is `false` the roster
 * is free to hold placeholders; the moment someone flips it to `true` these
 * tests start demanding the finished article and name the exact files missing.
 *
 * Budgets (checked for whatever is on disk, flag or no flag):
 *   clips   ≤ 2s and ≤ 1 MB     posters ≤ 60 KB
 */

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))
const CLIP_MAX_BYTES = 1024 * 1024
const CLIP_MAX_SECONDS = 2
const POSTER_MAX_BYTES = 60 * 1024

/** `/media/team/member-01.jpg` is served from `public/media/team/member-01.jpg`. */
const onDisk = (src: string) => `${PUBLIC_DIR}${src}`

const posters = (members: readonly TeamMember[] = TEAM_MEMBERS) =>
  members.map((member) => member.posterSrc).filter((src): src is string => Boolean(src))
const clips = (members: readonly TeamMember[] = TEAM_MEMBERS) =>
  members.map((member) => member.videoSrc).filter((src): src is string => Boolean(src))

const missing = (sources: readonly string[]) => sources.filter((src) => !existsSync(onDisk(src)))

/**
 * Duration of an MP4, in seconds, from the `mvhd` box — no decoder and no
 * dependency. Returns `null` if the file is not an MP4 we can read, so an
 * unreadable file is reported as unreadable rather than silently passing.
 */
function mp4Duration(path: string): number | null {
  const buffer = readFileSync(path)
  const findBox = (type: string, start: number, end: number): { start: number; end: number } | null => {
    let offset = start
    while (offset + 8 <= end) {
      let size = buffer.readUInt32BE(offset)
      const boxType = buffer.toString('ascii', offset + 4, offset + 8)
      let header = 8
      if (size === 1) {
        if (offset + 16 > end) return null
        size = Number(buffer.readBigUInt64BE(offset + 8))
        header = 16
      } else if (size === 0) {
        size = end - offset
      }
      if (size < header || offset + size > end) return null
      if (boxType === type) return { start: offset + header, end: offset + size }
      offset += size
    }
    return null
  }

  const moov = findBox('moov', 0, buffer.length)
  if (!moov) return null
  const mvhd = findBox('mvhd', moov.start, moov.end)
  if (!mvhd) return null
  const version = buffer.readUInt8(mvhd.start)
  if (version === 1) {
    const timescale = buffer.readUInt32BE(mvhd.start + 20)
    const duration = Number(buffer.readBigUInt64BE(mvhd.start + 24))
    return timescale ? duration / timescale : null
  }
  const timescale = buffer.readUInt32BE(mvhd.start + 12)
  const duration = buffer.readUInt32BE(mvhd.start + 16)
  return timescale ? duration / timescale : null
}

describe('team roster shape', () => {
  it('is exactly the three agreed entries, in order, with the agreed roles', () => {
    expect(TEAM_MEMBERS.map((member) => member.role)).toEqual([
      'Creator',
      'Front-end and back-end developer',
      'Tester',
    ])
  })

  it('points each entry at its own numbered clip and poster', () => {
    expect(TEAM_MEMBERS.map((member) => member.posterSrc)).toEqual([
      '/media/team/member-01.jpg',
      '/media/team/member-02.jpg',
      '/media/team/member-03.jpg',
    ])
    expect(TEAM_MEMBERS.map((member) => member.videoSrc)).toEqual([
      '/media/team/member-01.mp4',
      '/media/team/member-02.mp4',
      '/media/team/member-03.mp4',
    ])
  })

  it('never leaves a stand-in name on an entry that claims to be real', () => {
    // The marking comes off when the real name goes in — not before, and not
    // to quieten this file.
    for (const member of TEAM_MEMBERS) {
      if (member.placeholder) continue
      expect(member.name, `${member.id} is unmarked but still has a stand-in name`)
        .not.toMatch(/^Team member \d\d$/)
      expect(member.name.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('TEAM_SECTION_ENABLED gate', () => {
  it('is off while any entry is still marked placeholder', () => {
    const stillPlaceholder = TEAM_MEMBERS.filter((member) => member.placeholder).map((member) => member.id)
    if (TEAM_SECTION_ENABLED) {
      expect(stillPlaceholder, 'enabled with placeholder entries still in the roster').toEqual([])
    } else {
      expect(stillPlaceholder.length).toBeGreaterThan(0)
    }
  })

  it('is off while any clip or poster is missing from public/', () => {
    const absent = missing(teamAssetPaths())
    if (TEAM_SECTION_ENABLED) {
      expect(absent, 'enabled while these asset paths do not exist').toEqual([])
    } else {
      // Not required to be broken — just recorded as the reason the flag is off.
      expect(Array.isArray(absent)).toBe(true)
    }
  })

  it('is off while any asset is still one of the sample files', () => {
    const stillSample = teamAssetPaths().filter((src) => TEAM_PLACEHOLDER_ASSETS.includes(src))
    if (TEAM_SECTION_ENABLED) {
      expect(stillSample, 'enabled while these assets are still placeholders').toEqual([])
    } else {
      expect(stillSample.length).toBeGreaterThan(0)
    }
  })

  it('only goes on when all three names and all six files are real', () => {
    const ready =
      TEAM_MEMBERS.every((member) => !member.placeholder) &&
      missing(teamAssetPaths()).length === 0 &&
      teamAssetPaths().every((src) => !TEAM_PLACEHOLDER_ASSETS.includes(src))
    // One direction only: being ready does not force the flag on, but the flag
    // being on forces readiness.
    if (TEAM_SECTION_ENABLED) expect(ready).toBe(true)
  })
})

/**
 * A budget breach fails the suite for a real asset, and is only warned about
 * for one still listed in `TEAM_PLACEHOLDER_ASSETS` — those files are known
 * stand-ins on their way out, and the gate above already stops them reaching
 * the page. Delisting a file (i.e. calling it real) turns the warning into a
 * failure, which is the point: nothing real ships over budget.
 */
function report(breaches: { src: string; detail: string }[], label: string) {
  const blocking = breaches.filter(({ src }) => !TEAM_PLACEHOLDER_ASSETS.includes(src))
  const advisory = breaches.filter(({ src }) => TEAM_PLACEHOLDER_ASSETS.includes(src))
  if (advisory.length > 0) {
    console.warn(
      `[team budgets] ${label} over budget, still marked placeholder:\n` +
        advisory.map(({ src, detail }) => `  - ${src}: ${detail}`).join('\n'),
    )
  }
  expect(blocking.map(({ src, detail }) => `${src}: ${detail}`)).toEqual([])
}

describe('team media budgets', () => {
  it('keeps every real clip within 2s and 1 MB', () => {
    const breaches: { src: string; detail: string }[] = []
    for (const src of clips()) {
      const path = onDisk(src)
      if (!existsSync(path)) continue
      const bytes = statSync(path).size
      if (bytes > CLIP_MAX_BYTES) breaches.push({ src, detail: `${bytes} bytes > ${CLIP_MAX_BYTES}` })
      const seconds = mp4Duration(path)
      if (seconds === null) breaches.push({ src, detail: 'duration unreadable' })
      else if (seconds > CLIP_MAX_SECONDS) {
        breaches.push({ src, detail: `${seconds.toFixed(2)}s > ${CLIP_MAX_SECONDS}s` })
      }
    }
    report(breaches, 'clips')
  })

  it('keeps every real poster within 60 KB', () => {
    const breaches: { src: string; detail: string }[] = []
    for (const src of posters()) {
      const path = onDisk(src)
      if (!existsSync(path)) continue
      const bytes = statSync(path).size
      if (bytes > POSTER_MAX_BYTES) breaches.push({ src, detail: `${bytes} bytes > ${POSTER_MAX_BYTES}` })
    }
    report(breaches, 'posters')
  })
})
