# Red Tide motion rebuild — review before commit

Local preview: http://terminal.local:4173/ . Use **Replay intro** at the bottom of the landing page to review it again.

Base: `31523c04141e9401e99b54172437b3f8f5ac6fa9` (main). This checkout is uncommitted. No push, deployment, Netlify operation or live Firebase/Firestore access was performed for this rebuild. No real backend credentials were used. The local runner forces the existing browser-local demo backend and ignores environment files. OpenStreetMap basemap images remain external image resources; demo mode is backend-independent, not an offline map tile package.

## What was rebuilt

A shared motion system now owns timing, springs, bounded stagger, reduced-motion preferences, visibility pauses, callback cancellation, camera intent and overlay presence. Red Tide's dark coastal chart, condensed typography, amber controls and status colours remain recognizable. The tide intro is optional and skippable, bypasses reduced motion entirely, and leaves the landing/data initialization mounted underneath.

## Bugs fixed

- **M2:** close cancels delayed drawer/card entrances; parent and child no longer compete for stagger ownership.
- **G3:** explicit Leaflet reduced-motion policy covers owned flights, reset/focus, keyboard pan, popup pan and inertia. Native CSS zoom is disabled at construction because Leaflet caches its animation flag; custom zoom buttons use owned flights when motion is permitted.
- **G2:** report success has one owner; only the matching redundant notice is consumed, preserving unrelated errors.
- Stale callbacks after unmount, queued intro flights overriding newer selections, shipping exit races, repeated submission/approval actions, stale report marker colour, and decorative canvas lifecycle churn were addressed.
- Failed hover prefetch no longer creates an unhandled rejection; lazy route failures have visible recovery.
- Modal layering/focus and transformed translucent feedback were rebuilt without backdrop blur on moving surfaces.

## Validation

| Gate | Result |
|---|---|
| Original baseline | 294 tests |
| Shared motion / intro chunk | 307 tests, typecheck and build pass |
| Map / drawer chunks | 311 tests, typecheck and build pass |
| Feedback / canvas chunks | 322 tests, typecheck and build pass |
| Final | **323 tests in 36 files**, typecheck and production build pass |
| Protected files and lockfile | Identical to base |
| Waves budget | Two layers, DPR cap 1.5, 33ms frame interval, 6px step retained |
| New dependencies | None |

Browser checks exercised landing/map navigation, zone selection, zoom, shipping visibility, drawer close/reopen and a synthetic demo report. The report created one pending item and restored focus to its opener. Automated tests cover reduced-motion changes, intro cleanup, camera ownership, overlay reversal and repeated async actions. Desktop browser validation is complete; physical mobile GPU performance and a live production-backend integration run were deliberately not claimed or performed. Existing responsive layouts and reduced-motion test paths remain in place. Test output includes jsdom's non-fatal scrollTo warning.

## Deliberately left alone

- Store, Firebase initialization, coastline, zone geometry and shipping geometry: expressly protected; their data/approval semantics remain unchanged.
- Production authentication, deployment configuration and real backend operations: outside this isolated review and prohibited without approval.
- Leaflet popup removal remains synchronous; inventing an exit delay would alter native popup ownership.
- No admin route transition was introduced. Only in-page feedback was rebuilt.
- No numerical code-coverage percentage is claimed; baseline tests were retained/adapted and regression cases added, rather than dropping tests to obtain a pass.

## Integration and local use

The UI uses existing data models and backend interfaces; no migration is required. It is source-compatible with the recorded base. Integration still needs review: `npm run dev` intentionally runs the forced-demo launcher. Keep it for safe review, or explicitly restore the normal development command when integrating into the real project. Production build/deployment settings have not been validated against live credentials.

Run `npm ci`, then `npm run dev` (or `npm run dev:demo`). The demo-only admin passcode is `demo-review`. Validation commands: `VITE_USE_DEMO_BACKEND=true npm run typecheck`, `VITE_USE_DEMO_BACKEND=true npm test`, `VITE_USE_DEMO_BACKEND=true npm run build`. Nothing has been committed; the accompanying patch includes tracked edits and new source/test files.

## File-by-file changes

| File | Change |
|---|---|
| `package.json` | Default local development uses the isolated demo runner; no dependencies added. |
| `scripts/demo.mjs` | Shared motion styling and orchestration integration. |
| `src/App.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/App.tsx` | Integrates optional intro and route error handling; safely handles failed map prefetch. |
| `src/components/AdminGate.tsx` | Cancellable, reduced-motion-aware error feedback; immediate admin entry. |
| `src/components/AdvisoryDrawer.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/AdvisoryDrawer.tsx` | Shared panel spring, entrance ownership, inert closed content and gauge timing. |
| `src/components/Ambient.tsx` | Shared timing/layer styling. |
| `src/components/BlurText.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/BlurText.tsx` | Bounded shared reveal instead of animated blur. |
| `src/components/CountUp.tsx` | Cancellable frame counting and immediate reduced-motion values. |
| `src/components/DecryptedText.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/DecryptedText.tsx` | Bounded text reveal with cleanup and reduced-motion bypass. |
| `src/components/DemoBanner.tsx` | Clearly identifies browser-local prototype data. |
| `src/components/Header.tsx` | Shared duration utilities. |
| `src/components/HeroBackdrop.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/HeroBackdrop.tsx` | Cancellable idle/visibility work, retained offscreen canvas and decorative failure boundary. |
| `src/components/LoadingState.tsx` | Shared timing; pause hidden/reduced-motion loops. |
| `src/components/Map.tsx` | Owned camera movement, cancellable zone entrances/pings/status wash, live motion policy and safe native zoom. |
| `src/components/MapControlColumn.tsx` | Camera-owned zoom flights, reduced-motion jumps and shared press/timing/layers. |
| `src/components/MapMarkers.tsx` | Cancellable intro/geolocation work and status-aware marker caching. |
| `src/components/MapMotion.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/MapMotionPolicy.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/MapMotionPolicy.tsx` | Leaflet keyboard/popup/inertia policy and live reduced-motion camera settlement (G3). |
| `src/components/MorphChevron.tsx` | Shared spring and zero-duration reduced motion. |
| `src/components/Notice.tsx` | Portal feedback, cancellable dismissal, exact duplicate-success suppression without hiding errors (G2). |
| `src/components/ReportCard.tsx` | Real async approval/rejection feedback; removes fake delayed success and locks repeated actions. |
| `src/components/ReportFeedback.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/ReportForm.tsx` | Modal focus ownership, duplicate-submit lock, async cleanup and one success state. |
| `src/components/ShippingLayer.tsx` | Single opacity owner; rapid toggle reversal without competing CSS fades. |
| `src/components/SplashScreen.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/SplashScreen.tsx` | Skippable, replayable tide introduction; session-scoped, reduced-motion bypass, measured wordmark transition and cleanup. |
| `src/components/StatusKey.tsx` | Shared count/pulse timing, isolated active indicator and reduced motion. |
| `src/components/StatusPip.tsx` | Shared status pulse and reduced-motion policy. |
| `src/components/Waves.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/Waves.tsx` | Shared preference/visibility handling and loop cleanup; original performance budget retained. |
| `src/components/ZoneDrawer.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/components/ZoneDrawer.tsx` | Rebuilt panel and card orchestration; close cancels stagger (M2); closed content inert. |
| `src/components/ZonePopup.tsx` | Shared status/press treatment with Leaflet-compatible entrance. |
| `src/components/ferrofluid/Ferrofluid.tsx` | Guarded rAF lifecycle, paused clock and 33ms render cap. |
| `src/index.css` | Shared popup/status timing, bounded stagger and removal of animated shadow effects. |
| `src/lib/reportFeedback.ts` | Shared exact success message identity; store unchanged. |
| `src/main.tsx` | Installs shared motion provider. |
| `src/motion/MotionProvider.tsx` | One motion configuration, CSS timing/layer variables and live document motion policy. |
| `src/motion/RouteErrorBoundary.tsx` | Visible recovery when a lazy route fails. |
| `src/motion/RouteTransition.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/motion/RouteTransition.tsx` | Cancellable landing/map dissolve; instant admin navigation and safe preparation failure. |
| `src/motion/camera.test.ts` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/motion/camera.ts` | Latest-intent Leaflet camera ownership, safe unmount and reduced-motion settlement. |
| `src/motion/mapMotion.test.ts` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/motion/mapMotion.ts` | Map timing/stagger derives from shared tokens. |
| `src/motion/pins.ts` | Reduced-motion-compatible marker styling. |
| `src/motion/preferences.ts` | Synchronous, live OS preference and page visibility subscriptions. |
| `src/motion/scope.test.ts` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/motion/scope.ts` | Shared invalidation and cleanup ownership for timers, frames and callbacks. |
| `src/motion/tokens.ts` | Shared durations, easing, spring physics, stagger cap and layer order. |
| `src/motion/useEntrance.ts` | One entrance owner; cancels delayed movement when drawers close. |
| `src/motion/useModalFocus.ts` | Focus trap, Escape handling, inert background, scroll lock and focus restoration. |
| `src/motion/usePresenceProgress.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/motion/usePresenceProgress.ts` | Reversible overlay fade with stale-completion protection. |
| `src/motion/usePulse.ts` | Reusable cancellable pulse with reduced-motion bypass. |
| `src/motion/useReveal.ts` | Cancellable once-only observation and bounded fallback. |
| `src/motion/useSidePanel.ts` | Shared drawer spring, synchronous intent and drag/resize/preference cleanup. |
| `src/pages/Admin.tsx` | Individual report exit presence and serialized pending actions; no route transition. |
| `src/pages/Landing.tsx` | Shared entrance orchestration, reading progress, reduced-motion handling and CTA feedback. |
| `src/pages/MapPage.tsx` | Owns reversible shipping presence and single report feedback lifecycle. |
| `src/pages/mapPass.test.tsx` | Regression tests retained/adapted for the rebuilt lifecycle; new cases cover cleanup, reduced motion or interaction ownership. |
| `src/styles/landing-motion.css` | Consistent CTA feedback without animated filters/shadows. |
| `src/styles/map-motion.css` | Shared map/panel timing and ambient loops; reduced-motion rules. |
| `src/styles/micro-interactions.css` | Removed redundant global interaction rules that transformed blurred controls. |
| `src/styles/motion-policy.css` | Global reduced-motion and background-tab policy; opt-in press feedback. |
| `src/styles/tide-intro.css` | Responsive coastal intro composition and tide transition. |
