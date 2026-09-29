# Motion enchant 01

Base: main `e9a1370681d804a79b88828b863e74c60c6fde74`, after PR #51. Branch: `arena/motion-enchant-01`. Push only; no new PR or merge.

## Handoff reconciliation: G1, G2, G3

The handoff described pre-rebuild implementations. These three fixes were already present in the merged rebuild, so their requested replacement edits were skipped. Each was separately revalidated with TypeScript, all 323 tests and a production build.

- **G1:** `micro-interactions.css` no longer exists. `MotionProvider`, installed at the app root, imports the global `motion-policy.css`. Its opt-in `.motion-press` works across routes and respects reduced motion. Restoring blanket press transforms would reintroduce transforms on blurred controls.
- **G2:** `MapPage` passes the latched form's exact success message to `Notice`; the duplicate is suppressed before paint and consumed without hiding unrelated errors. No store change is needed or permitted.
- **G3:** shared preferences and camera ownership already make zoom/reset instant under reduced motion, including live preference changes. Native Leaflet CSS zoom is disabled at construction because Leaflet caches the animation flag. Replacing this with the older one-time matchMedia pattern would weaken the existing fix.

This first commit records verification; it does not claim new implementations of G1–G3.

## Implemented

| Item | Implementation |
|---|---|
| M2 | Preserve the rebuilt single entrance owner and bounded stagger. Close cancels pending entrances, then fades/slides to opacity 0 / y 8 over 220ms; reduced motion snaps. No dead parent stagger exists to restore. Added close/reopen/preference regression tests. |
| L1 | Ferrofluid container fades 0 to 0.7 over 700ms. A latch avoids replay within the mounted hero, including canvas recreation after a preference change. Offscreen canvases remain mounted and paused; reduced motion retains the existing no-canvas policy. |
| L2 / L3 | Keyed popLayout ready-state crossfade (300ms, 6px); Figure always mounts CountUp with target 0 until ready. |
| M3 | Inline error height/opacity expansion (200ms); one 360ms shake per failed submit. Unmount/preference changes cancel it and cannot replay an acknowledged failure. |
| M4 | Keyed popLayout picker/photo swap. Photo opacity uses 250ms; scale uses the shared 420/34/0.85 spring. Physical spring settling is not falsely treated as a fixed-duration animation. Object URLs survive exit and are revoked on completion/unmount. |
| A1 | Isolated shared-layout admin tab highlight, same spring; tab behaviour unchanged. |
| A2 | Stat CountUp with 0.9s duration prop and one 1.08 scale acknowledgement over 320ms on value change. CountUp retains its existing 600ms live-update cap. |
| M5 | Shipping hint spring entry, top-right origin; 150ms ease-in exit. Solid background replaces blur on the moving tooltip. |
| A6 | Keyed wait-mode queue/empty transition. Last card exits over 220ms; queue releases at 240ms, then the empty state fades/slides in over 300ms. No uncancelled timer. Tests cover a new report arriving during exit. ReportCard exit uses transform/opacity, with height/margin animation removed. |
| M1 | Advisory share uses CountUp, preserving whole-percent formatting and immediate accurate screen-reader text. |
| A3 | Wait-mode gate/dashboard state transition inside Admin; gate exit 150ms, dashboard entrance 300ms / 8px. Initial admin visits remain immediate; reduced motion uses zero-duration swaps. Headers inside the moving wrapper use solid backgrounds without backdrop blur. |

Audit also corrected an existing malformed `4var(...)` CSS duration on the header orb to the shared 44s ambient token.

## Files

- `src/motion/useEntrance.ts`, `useEntrance.test.tsx`: M2 close orchestration and regressions.
- `src/motion/tokens.ts`: named timings for the new transitions.
- `src/components/HeroBackdrop.tsx`: L1.
- `src/pages/Landing.tsx`: L2/L3.
- `src/components/ReportForm.tsx`: M3/M4 and photo lifetime.
- `src/pages/Admin.tsx`, `adminMotion.test.tsx`: A1/A2/A6/A3 and queue/tab/unlock regressions.
- `src/motion/usePulse.ts`: optional acknowledgement duration while preserving existing defaults.
- `src/components/ReportCard.tsx`: transform/opacity-only exit.
- `src/components/AdvisoryDrawer.tsx`: M1.
- `src/pages/MapPage.tsx`: M5.
- `src/styles/map-motion.css`: malformed ambient duration correction.

## Validation and boundaries

Each fix/feature was processed in handoff order, with `tsc -b --force`, full `vitest run`, and production build passing before advancing. The final suite has **330 passing tests in 38 files**, versus 323 at the start and the original 294 baseline. The failed intermediate test was an overly strict accessible-name whitespace expectation; it was corrected without changing tab behaviour or dropping coverage.

Protected store/Firebase/data geometry files, backend modules, dependency manifests/lockfile, Netlify configuration and route-transition implementation are unchanged. No real backend credentials or live Netlify/Firebase operations were used. All execution used the existing isolated demo mode. No dependencies were added. Waves is untouched.

Known jsdom canvas/scrollTo warnings and npm proxy-environment warnings are non-fatal; no TypeScript, test or production-build errors remain. This pass validates interaction sequencing in tests; it does not claim a new physical mobile GPU run.
