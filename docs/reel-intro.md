# Red Tide product-film introduction

## Connected workflow and progress (PR89)

The report, review and warning chapters share one persistent observation card and typed field. The original observation stays visible as its receipt changes from pending review to a human decision and an explicitly illustrated approved-report warning. This is a demonstration, not an automatic approval or a live advisory. The card uses amber for review and red for warning, while the explanatory headings retain their original word reveal timing. Incoming copy mounts during the 450 ms crossfade and keeps its key when it becomes current; only the current chapter is exposed to assistive technology.

The active progress segment fills using a transform animation controlled by the existing chapter clock. Its duration, hidden-tab pause/resume position, completion, loop reset and cleanup share the same reading timer. No per-frame React state or separate progress timer is added. Reduced motion remains the existing static closing summary; the opening video and its PR88 interaction restrictions are unchanged.

Feature illustrations share a reserved frame, including compact portrait and landscape variants. Essential receipt/status labels are larger on phones. The Arduino packet animation completes at 3.4 seconds and its scan at 3.5 seconds, leaving time to settle inside the unchanged 4.4-second chapter. All PR87 chapter holds, crossfade duration, word-reveal recipes, copy entrance timings and landing exit timing remain unchanged.

References used: [Motion shared layout](https://motion.dev/docs/react-layout-animations), [React Bits Fade Content](https://reactbits.dev/animations/fade-content), [Design Spells morphing transitions](https://designspells.com/spells/morphing-transitions-in-untitled), [Animista](https://animista.net/) and [web.dev animation performance](https://web.dev/articles/animations-guide). The implementation uses the existing React/Motion/CSS stack without additional dependencies, media, device operations or backend changes.

Validation: 451 tests across 54 files and the TypeScript/Vite build pass. New regressions cover persistent observation/typing nodes, stable incoming heading nodes, accessible chapter handoff, fresh replay and clock-owned progress cancellation/pause/resume. Chromium geometry checks cover all nine chapters at 1440×900, 390×844, 320×568, 844×390 and 667×375, with keyboard exit, focus restoration, replay, hidden-tab progress and reduced motion. The isolated demo build was served through local request interception; text/illustration animations were settled for geometry captures while the chapter/progress clock ran in virtual time. No browser JavaScript errors were observed. These checks do not establish actual device FPS or Safari/Firefox behavior. `TextReveal.tsx`, `reelScenes.ts`, the opening-film files, landing, map and Firebase files are unchanged from the PR88 base.

The previous intro is preserved on `backup/intro-before-rebuild-2026-10-05` at commit `7ddfc16982ca2d3501a22d26627b97bd5d767561`.

## Reference interpretation

The supplied 18.69-second reel uses an opening word, two colored shapes joining into a mark, interface close-ups, a highlighted text field, submission feedback and a final product reveal. This implementation adapts that rhythm with original Red Tide vectors and typography; it does not embed the reel, its audio, Google's marks, or third-party interface footage.

| Scene | Red Tide adaptation |
|---|---|
| 0 | Introducing, with small coastal orbit lines |
| 1 | Teal/amber shapes join around an original coastal mark |
| 2 | Illustrated coastal records panel, contour draw and seven decorative pins |
| 3 | Observation text appears with an attached cursor and continuously visible review feedback |
| 4 | Admin review: a pending observation is reviewed by a person |
| 5 | Community warning and unavailable status, with distinct symbols and explanations |
| 6 | Sample, cached and server-delivery examples with provenance caveats |
| 7 | Arduino UNO USB connection, distance scanning, LED testing and manual beep |
| 8 | Centered RED TIDE closing title and official-advisory reminder |

The nine chapters use individual visible reading times: 3.0, 3.0, 3.8, 3.9, 4.3, 4.1, 4.3, 4.4 and 3.4 seconds. Nine 0.45-second transitions bring the full loop to 38.25 seconds. Slide holds are about 15% shorter; word reveals, copy entrances, typing and decorative illustration animation timings remain unchanged. Visitors can enter immediately from any chapter; the sequence never forces them to finish the film. Content, chapter labels, scene count and reading times share `reelScenes.ts`.

The next chapter mounts during the outgoing dissolve. Stable scene keys retain that incoming illustration when it becomes current, so typing and other entrances do not restart after the fade. The incoming copy stays aria-hidden until the chapter commits; only the current chapter is exposed to assistive technology. Both chapters remain over the same static backdrop, avoiding a fully empty stage between scenes. The clock pauses during either reading or fading when the tab is hidden. Clicking or Enter/Space/Escape cancels playback and uses the existing 650 ms dissolve into the landing. Reduced motion shows a static equivalent, with 120 ms exit.

The illustrated map does not read live zone records or alter the actual map. Pins are decorative, not zone boundaries or measured positions. The static contour retains OpenStreetMap attribution. An observation is shown as pending review, never converted into a health clearance.

## Design references

- User-supplied reel: sequence and framing reference.
- https://motion.dev/docs/react-animation — existing Motion opacity exit and transforms.
- https://reactbits.dev/text-animations/blur-text — staged text rhythm; no new dependency.
- https://designspells.com/ — focused feedback and compact receipt behavior.
- https://animista.net/ — transform/opacity entrance patterns.

No new libraries, video assets, sound, canvas or WebGL are added to the intro. The hardware study is decorative HTML/CSS; it never requests USB permission, opens a serial port or generates simulated device readings. Actual connection remains on `/arduino.html`. Decorative graphics are aria-hidden; the sole full-screen action has a keyboard focus indicator. Landing, hardware, map and Firebase behavior remain outside this change.

## Previous PR #78 validation

- TypeScript and production build passed; 411 tests passed across 47 files, including 19 playback cases and three illustration regressions.
- Browser checked all five scenes at 1440×900, 390×844, 320×568 and 844×390. No horizontal overflow or scene/footer overlap detected.
- Click dismissal restored landing focus and scrolling; replay and Escape worked at each viewport.
- Reduced motion stayed static and Enter dismissed it; no browser JavaScript exceptions.
- Browser review used a demo-backend build served by local request interception because localhost sockets were unavailable in the execution environment. Live Firebase and deployment behavior were not exercised.

## Product polish and observation-card fix

The prior typing field animated a proportional-font string to 20ch, leaving its separate cursor detached from the visible text. The field now uses monospaced text, a cursor border attached to that text and a width/step count derived from the observation string. The cursor stops after completion. Review feedback starts visible and settles as typing completes instead of reserving an invisible block.

Feature copy explains a concrete flow: explore a coastal area, read its record, share an observation and await admin review. Numbered chapter captions orient each scene. Heading, eyebrow and description use restrained staggered transform/opacity entrances. A coarse pointer gets “Tap to explore”; desktop keeps its click hint. The sequence still loops until the existing one-action fade to landing.

Current reference research: [Motion text animation](https://motion.dev/docs/text-animation), [React Bits Text Type](https://reactbits.dev/text-animations/text-type), [Design Spells](https://designspells.com/) and [web.dev animation performance](https://web.dev/articles/animations-guide). No dependency or paid animation component is added. The small stepped typing reveal changes width, while other entrances use transform/opacity and the field glow is static. Reduced motion stays a static closing message.

Tests additionally cover illustration labeling, a single typing/cursor owner, accessible feature headings and static reduced-motion content. Browser checks measure the final text width against the cursor-bearing element and check that the receipt is visible before typing completes.

## Expanded presentation — 6 October 2026

Four additional scenes explain existing workflow and limitations instead of claiming new features. Review is a human decision, not laboratory confirmation. No recorded alert does not establish safe water. Server sync describes record delivery, not water observation/testing time. Arduino demonstrates distance sensing and outputs; it does not detect red tide. Every new feature study is decorative and labelled as an illustration. Important meanings are repeated in accessible scene descriptions/detail lines rather than relying on hidden graphics or colour.

The original reel opening, identity, map study, corrected attached typing cursor and closing title remain. Feature studies have compact phone layouts and use two columns in short landscape viewports. The nine-segment footer fits narrow phones. Reduced motion exposes a static closing summary with review/source/hardware context and retains the 120 ms exit. Map, landing, Firebase and hardware firmware are unchanged.

Current references: [Motion presence and stable child keys](https://motion.dev/docs/react-animate-presence), [React Bits Fade Content](https://reactbits.dev/animations/fade-content), [Design Spells](https://designspells.com/), [Animista](https://animista.net/) and [HyperUI](https://www.hyperui.dev/). The existing visible-time clock owns advancement; CSS opacity/transform motion supplies the transition and small decorative studies without a new animation runtime.

### Expanded intro validation

- Production TypeScript/build passed. Full suite: 425 tests across 47 files. After the visual-dispatch refactor, the 36 intro/illustration tests passed again.
- Browser checked all nine scenes at 1440×900, 390×844, 320×568 and 844×390: no horizontal copy overflow, stage/footer collisions or clipped studies. Visual screenshots reviewed for review, status, source, hardware and the static reduced-motion summary.
- All four viewports completed a full loop, click-to-enter, focus/scroll restoration, replay from the header and Escape dismissal. Small-phone reduced motion remained static and Enter dismissed it. No browser JavaScript exceptions occurred.
- The agent-browser daemon could not start in this environment. Browser checks used headless Chromium through Puppeteer with locally intercepted production assets and demo data. No live Firebase, physical hardware, external map tiles or deployed Vercel verification is claimed.
