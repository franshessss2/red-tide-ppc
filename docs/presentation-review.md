# Presentation review

Run `npm run dev:demo` for an isolated school rehearsal. The launcher uses local
sample records and never reads project `.env` files. Its local test passcode is
printed at startup.

## Review flow

1. Open `/?intro=1` to inspect the complete sequence regardless of first-visit storage.
   Click during any scene: the landing should appear through a dissolve. No Skip or
   boxed start button should appear. Try Enter and Space, then ↻ in the header.
2. Open the map. The original animated zone and advisory drawers are retained.
   Review drawer opening, closing and swipe interactions, zone selection, camera
   movement, shipping lanes and report markers.
3. Submit an observation of at least 10 characters using Report here. A short entry
   should remain unsubmitted. Confirm one success message and one pending record.
4. Open Admin, unlock the isolated demo and approve that report. Return to the map
   and confirm the community warning. These are sample community records, not a
   BFAR clearance or advisory.
5. Check narrow widths, landscape, keyboard focus and reduced motion. Attribution
   must remain visible.

## Scope and verification

The intro and landing improvements from PR #70 remain. The original map page,
components, styles and map-specific regression suites are restored from the commit
immediately before that PR. The workspace panel, tile retry and changed marker
appearance introduced in PR #70 are withdrawn with the map rebuild.

The Vitest suites cover intro lifecycle/replay, hidden-tab timer cancellation,
reduced-motion equivalents, the original drawers and map motion, report validation,
photo submission and the submit → approve → warning flow. `npm run build` includes
TypeScript checks.

Browser checks at constrained widths do not establish physical iOS/Android gesture,
software-keyboard or GPU performance. This restoration does not claim to fix the
previously reported selection or tile-flicker bugs. Firebase settings, rules and
authentication remain unchanged.
