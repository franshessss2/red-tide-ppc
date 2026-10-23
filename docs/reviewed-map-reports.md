# Reviewed report visibility on the map

The map shows pending report badges by default. Confirmed and rejected reports
are hidden from those badges until the visitor enables **Show reviewed reports**
in Map controls. The toggle applies equally to mixed-status zone badges: only
pending items and their count appear when it is off.

The preference is local React state and starts off when the map is reopened.
It does not filter the store, delete records, alter pending counts, or change
the Reports/history panel. Switching it off also removes any open popup whose
reviewed-only marker disappears. Revealing history does not replay a new-arrival
animation. New pending reports retain their existing arrival behavior, subject
to reduced-motion and Save-Data preferences.

Report review and zone status remain separate. Hiding a confirmed or rejected
report does not clear a zone warning, establish safe conditions, change the map
camera, or write to Firebase. Community records, not an official clearance.

Local acceptance on 23 October 2026 used isolated sample records, not production
submissions. Browser checks at 360, 390, 768 and 1440 px verified one pending-only
badge, three with history enabled, and one again after disabling it. Confirmed
and rejected records remained in Reports; an open reviewed popup closed when
hidden. The map-pane transform stayed unchanged when toggling. Unit/integration
tests cover live pending-to-reviewed marker removal for both review outcomes and
verify the UI makes no store mutation calls.

This work is prepared locally for PR #118. Its branch is based on the sign-in
fix in PR #117, which was still open when development began. Before publishing
the map PR, merge or otherwise retain #117 and compare the map-only diff against
that base so a later production release cannot undo the deployed sign-in fix.
