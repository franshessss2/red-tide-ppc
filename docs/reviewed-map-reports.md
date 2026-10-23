# Reviewed report visibility on the map

The map shows pending report badges in non-green zones by default. Green zones
have no report badges or report popups. Confirmed and rejected reports are also
hidden by default. **Show report history** inside Map options reveals these
hidden records on demand, including pending records in green zones.

The preference is local React state and starts off when the map is reopened.
It does not filter the store, delete records, alter pending counts, or change
the Reports/history panel. Switching it off also removes any open popup whose
hidden marker disappears. Revealing history does not replay a new-arrival
animation. New pending reports retain their existing arrival behavior, subject
to reduced-motion and Save-Data preferences.

Report review and zone status remain separate. Hiding a confirmed or rejected
report does not clear a zone warning, establish safe conditions, change the map
camera, or write to Firebase. Community records, not an official clearance.

A green zone can still have a pending report: changing the zone alone never
silently reviews that report. A zone becoming green removes its report badge
and any open report popup, without changing the records' statuses. Reports keeps
all records and their actual pending/confirmed/rejected labels. In a non-green
zone, completing the last pending review also removes the default badge.

Local acceptance on 23 October 2026 used isolated sample records, not production
submissions. Browser checks at 360, 390, 768 and 1440 px verified one pending-only
badge, three with history enabled, and one again after disabling it. Confirmed
and rejected records remained in Reports; an open reviewed popup closed when
hidden. The map-pane transform stayed unchanged when toggling. Unit/integration
tests cover live pending-to-reviewed marker removal for both review outcomes and
verify the UI makes no store mutation calls.

The follow-up menu check at 360, 688 and 1440 px verified that the checkbox
appears only inside Map options, retains its value when the menu is closed,
supports Space and Escape, and sits above zoom controls without overlap.
The checkbox label retains at least a 44 px touch target. Street map, Shipping
lanes, Reset view and Admin are grouped inside Map options at every width.
The native checkbox is styled as a dark/amber toggle while retaining checkbox
keyboard behavior, a visible focus indicator and reduced-motion support.
The consolidated menu was checked in-browser at 360 and 1800 px, including
opening Street map, enabling/disabling Shipping lanes and toggling reviewed
markers by keyboard. All 22 relevant app/menu tests and the build passed.

This work is prepared locally for PR #118. Its branch is based on the sign-in
fix in PR #117, which was still open when development began. Before publishing
the map PR, merge or otherwise retain #117 and compare the map-only diff against
that base so a later production release cannot undo the deployed sign-in fix.

## Five-comment polish

The map's bottom-left source status and Reports control now share a vertical
stack with an 8 px gap. The stack clears the attribution rather than occupying
the same position. On phones, the existing bottom panel provides source details;
the floating Reports control hides while that panel is expanded.

Brand and status pills enter from the left; Map options, zoom and the zone
drawer enter from the right. Whole-element Shared Axis X uses 24 px, 500 ms and
cubic-bezier(.2,0,0,1), with an 80 ms delay for the secondary controls. Entrances
start when map data is ready and do not replay on count updates or map movement.
Reduced motion disables these entrances. These changes remain local-only.

Acceptance: 613 tests passed, with three emulator-only tests skipped. A real
browser load showed the left/right transforms and opacity progressing during
the entrance, then settling to `transform: none` and full opacity. Desktop
stack gaps measured 8 px and 12.5 px; the phone layout also clears attribution
and hides the Reports dock while the bottom panel is expanded. The local
sample map has zero default badges, three with history enabled, and all three
original records still present in Report history with unchanged review labels.
