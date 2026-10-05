# Red Tide product-film introduction

The previous intro is preserved on `backup/intro-before-rebuild-2026-10-05` at commit `7ddfc16982ca2d3501a22d26627b97bd5d767561`.

## Reference interpretation

The supplied 18.69-second reel uses an opening word, two colored shapes joining into a mark, interface close-ups, a highlighted text field, submission feedback and a final product reveal. This implementation adapts that rhythm with original Red Tide vectors and typography; it does not embed the reel, its audio, Google's marks, or third-party interface footage.

| Scene | Red Tide adaptation |
|---|---|
| 0 | Introducing, with small coastal orbit lines |
| 1 | Teal/amber shapes join around an original coastal mark |
| 2 | Illustrated coastal records panel, contour draw and seven decorative pins |
| 3 | Observation text appears, then an awaiting-review receipt |
| 4 | Centered RED TIDE closing title and official-advisory reminder |

Five scenes × (3 seconds visible + 0.6 seconds outgoing fade) = 18 seconds per cycle. Entrance animation is contained within each scene's visible time. The clock pauses during either reading or fading when the tab is hidden. Clicking or Enter/Space/Escape cancels playback and uses the existing 650 ms dissolve into the landing. Reduced motion shows a static equivalent, with 120 ms exit.

The illustrated map does not read live zone records or alter the actual map. Pins are decorative, not zone boundaries or measured positions. The static contour retains OpenStreetMap attribution. An observation is shown as pending review, never converted into a health clearance.

## Design references

- User-supplied reel: sequence and framing reference.
- https://motion.dev/docs/react-animation — existing Motion opacity exit and transforms.
- https://reactbits.dev/text-animations/blur-text — staged text rhythm; no new dependency.
- https://designspells.com/ — focused feedback and compact receipt behavior.
- https://animista.net/ — transform/opacity entrance patterns.

No new libraries, video assets, sound, canvas or WebGL are added to the intro. Decorative graphics are aria-hidden; the sole full-screen action has a keyboard focus indicator. Landing, hardware, map and Firebase behavior remain outside this change.

## Validation

- TypeScript and production build passed; 413 tests passed across 46 files, including 19 intro cases.
- Browser checked all five scenes at 1440×900, 390×844, 320×568 and 844×390. No horizontal overflow or scene/footer overlap detected.
- Click dismissal restored landing focus and scrolling; replay and Escape worked at each viewport.
- Reduced motion stayed static and Enter dismissed it; no browser JavaScript exceptions.
- Browser review used a demo-backend build served by local request interception because localhost sockets were unavailable in the execution environment. Live Firebase and deployment behavior were not exercised.
