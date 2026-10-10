# Landing "Team" section

Replaces the standalone report-activity calendar above the footer
(see `docs/landing-activity-calendar.md` for what was orphaned and where the
calendar can be re-mounted). The api/, server/, arduino/, wokwi/ and reel-intro
code were not touched.

## Layout budget

The strip has to live inside the calendar's old footprint, so the page must not
get taller. Measured on a demo-mode production build (`scripts/landing-height-pass.mjs`):

| Viewport | Document height before | after | Δ | Calendar height | Team height |
| --- | --- | --- | --- | --- | --- |
| 390 × 844 | 2276 | 2158 | **−118** | 588 | 470 |
| 1440 × 900 | 1464 | 1338 | **−126** | 428 | 301 |

- Phones: one card per row, capped at exactly **120px** each (`cards: [120,120,120]`).
- ≥768px: a single row of three cards (231px tall at 1440), media on top.

## Media policy (all enforced in `src/components/TeamSection.tsx`, backed by
`src/motion/videoSlot.ts`)

1. **Nothing decodes before a card is ~50% in view.** The `<video>` is absent from
   the DOM until an `IntersectionObserver` at `threshold: 0.5` reports the card.
   A browser without `IntersectionObserver`, or a member with no clip, shows the
   poster only.
2. **At most one team video decodes at once.** Every card shares a single permit
   (`createVideoSlot(1)`); the rest queue and play in turn, first come first served.
3. **The video unmounts after the crossfade.** The clip plays once over the poster,
   crossfades back out (`TEAM_VIDEO_CROSSFADE_MS = 380`), and only then leaves the
   DOM with its `src` dropped — the release that actually frees the decoder and
   hands the permit to the next card. Stall (`4s`) and max-hold (`12s`) watchdogs
   bound decoder time; reduced motion never mounts a clip.

## Verification

Unit tests (14 new) assert all three rules with a stubbed observer/media pipeline:
`npm test` → `src/components/TeamSection.test.tsx` (9) and `src/motion/videoSlot.test.ts` (5).
Mutation checks confirmed each rule fails its test when removed (slot limit, the
0.5 gate, and the post-crossfade unmount).

Real browser (Chromium, demo build): `scripts/landing-team-video-pass.mjs`
samples the page while scrolling and asserts `maxConcurrentClips == 1`, no clip
mounted while its card is under 50% visible, and `clipsStillMountedAtRest == 0`.
Both viewports recorded playback order `member-01 → 02 → 03` and zero page errors.

Heights: `scripts/landing-height-pass.mjs` (before/after table above).

## Placeholder assets and roster

- `src/data/team.ts` carries a **placeholder roster** (`Team member 01–03`).
  Replace the three `name` strings; nothing else changes.
- `public/media/team/member-0{1,2,3}.mp4` are tiny (~15 KB) generated gradient
  clips so the policy is demonstrable. Drop real clips in at the same paths, or
  set `videoSrc` per member (omit it to keep a card still).
