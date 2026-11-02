# Reporting workflow upgrades

Photo preparation, recoverable report text, public review notes and audited zone
changes complement the [offline outbox and paged history](offline-reporting-and-history.md).

## Low-data photos

The report form prepares JPEG, PNG, WebP and AVIF photos on the device before
upload. Originals may be up to 20 MB. Preparation limits the longest edge to
1600 pixels and tries JPEG qualities of 80%, 68% and 55%, aiming for 450 KiB.
The upload limit remains 5 MB. An already small original is retained when
conversion would make it larger. This is not a guarantee of metadata removal.
Original files are never overwritten. Unsupported or unreadable files show an
error; text-only reporting remains available.

The form shows the original and prepared sizes. Firebase's Cloudinary transport
also runs the same helper, reusing an already prepared file without another
conversion. Preparation does not upload anything. The demo backend keeps its
existing local data-URL attachment path.

## Draft recovery

Unsent description text is saved in localStorage after a short debounce and on
page exit, separately for each zone and backend. Drafts expire after seven days.
Reopening the form restores text and asks the reporter to choose a photo again.
Photos are not retained in drafts. Drafts never submit automatically. A confirmed
report write clears its draft; a failed submission leaves the text available.
The reporter can clear saved text explicitly. Restricted or full browser storage
does not prevent submitting a report, but recovery may be unavailable.

## Review notes and zone history

Admins can add a public review note when approving or rejecting a report, and a
public status-change note when changing a zone. Notes are limited to 500
characters. They should not contain personal information. Review notes appear
in report history. The Admin History tab and Reports → What changed? show zone
history with a coastal-area filter, old/new statuses, timestamps and notes.

Only actual status changes append history. Each event may link to its confirmed
report. History starts with this upgrade; prior changes cannot be reconstructed
from the current zone record. The demo backend migrates existing local records
without inventing events and persists new history across reloads.

Firebase stores events in `datasets/community-v1/zoneChanges`. A transaction
updates the zone and creates its history event together. Rules require the pair,
server timestamps and administrator authorization; clients cannot edit or delete
history. Report approval remains a report write followed by a zone transaction.
If that second step fails, the existing partial-failure message remains visible.
Cached, pending and unavailable history are labeled separately from a server
snapshot. A history-feed failure does not claim that history is empty.

## Release boundary

Coordinate deployment of the new Firestore rules with the new admin client.
Back up the deployed rules, run the emulator checks, deploy only the tested
Firestore rules to the explicit project, and read them back before accepting
the release. Do not seed or rewrite community records. The rules reject older
clients that change a clean-dataset zone without appending its paired history.
Never fall back to an unaudited zone write. Legacy root collections are unchanged.
The existing Google administrator claim remains required; public demo unlocking
only edits device-local sample data.

## Verification

- Full unit/UI suite: 635 passed; five emulator-only cases skipped there and
  then passed separately against the local Firestore emulator.
- Firestore rules: 20 passed, including forged/orphan events, public writes,
  oversized notes and immutable history.
- Emulator integration: three clients received the same audited zone change.
- TypeScript and isolated production demo build passed. Existing large vendor
  chunk warnings remain.
- Browser: a synthetic 13 MB PNG became a 408 KB prepared JPEG; no personal photo
  or live Cloudinary upload was used. Draft text recovered after a reload, its
  photo did not, and successful submission cleared the draft.
- Browser: a local report was approved with a note, then its warning was closed
  with another note. Both events and the report note survived refresh and
  appeared in public history. Desktop and phone layouts were inspected.

Local preview: `http://127.0.0.1:4199/map`, with sample records only.
Proof images are under the ignored `.cache/reporting-review` directory.

Architecture references: [Firestore atomic operations](https://firebase.google.com/docs/firestore/manage-data/transactions)
and [rules validation with getAfter](https://firebase.google.com/docs/firestore/security/rules-conditions#access_other_documents).
