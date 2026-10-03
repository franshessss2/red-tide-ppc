# Presentation review

Run `npm run dev:demo` for an isolated school rehearsal. The launcher uses local
sample records and never reads project `.env` files. Its local test passcode is
printed at startup. Camera reset does not reset sample reports or warnings.

## Review flow

1. Open `/?intro=1` to inspect the complete sequence regardless of first-visit storage.
   Click during any scene: the landing should appear through a dissolve. No Skip or
   boxed start button should appear. Try Enter and Space, then ↻ in the header.
2. Open the map. Choose one of seven coastal zones. Details should remain within the
   panel/sheet; selecting a row should not force a flight. Use Locate on map when
   needed. Click empty water or close the panel and confirm the highlight clears.
3. Submit an observation of at least 10 characters. A short entry should remain
   unsubmitted. Confirm one success message and one pending record.
4. Open Admin, unlock the isolated demo and approve that report. Return to the map:
   the zone should show a community warning and the reviewed report a blue diamond.
   These are sample community records, not a BFAR clearance or advisory.
5. Reset view. Reports and warning status should remain. Toggle shipping lanes and
   verify they are a secondary reference beneath zone boundaries.
6. Check 320px and 390px widths, landscape, keyboard focus and reduced motion.
   Details must scroll inside the sheet; attribution must remain visible.

## Automated coverage

The Vitest suites cover intro lifecycle/replay, hidden-tab timer cancellation,
reduced-motion equivalents, selection propagation and clearing, panel closure,
view-only reset, tile-error/retry separation, report validation/photo submission,
and the submit → approve → warning flow. `npm run build` includes TypeScript checks.

Browser review uses isolated local sample data. Narrow viewport reviews are desktop
Chromium at constrained widths; they do not establish physical iOS/Android gesture,
software-keyboard or GPU performance. Slow tile loading is handled explicitly; the
original video flicker is not claimed to be eliminated on every device.
