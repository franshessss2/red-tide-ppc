# Smaller history loads and offline report outbox

These additions extend the reporting workflow. Observation-time capture and
atomic report moderation are deferred; their current behavior is unchanged.
Publication requires the coordinated rules rollout described in
[Reporting workflow upgrades](reporting-workflow-upgrades.md#release-boundary).

## History coverage

Firebase now subscribes to the latest 30 dated reports (plus one look-ahead record)
and a separate complete pending-report query. They are deduplicated before delivery
to the app store. Pending counts remain complete; aggregate report/review counts
refer to loaded records and are labeled accordingly. An active queue can still be
large: this deliberately does not drop pending reports to save history bandwidth.

Older reports load in 30-record pages using Firestore snapshot cursors. The normal
archive orders by submission timestamp. Firestore ordering excludes missing
fields, so an explicit **All records by ID** archive provides bounded access to
legacy undated documents as well. A report can also be opened by its exact ID.
Search and status filters operate on loaded records, not every database record.

Zone history subscribes to 30 recent events and pages older events on request.
Archive pages stay separate from the notification feed and never generate new
report notifications. Their contents are snapshots, with refresh and retry
controls. Failed page loads preserve their cursor and existing records. Live
window boundary records are retained while browsing, so arrivals do not create a
gap between loaded pages. Sample mode implements the same page controls locally.
Map history markers use loaded recent/pending records; older records are browsed
through Reports. Current warning polygons and statuses retain their full zone feed.

## Saved reports and receipts

**Save report for later** stores the text and prepared image in IndexedDB. The
outbox is separate for each origin and backend/project/dataset, and never moves
sample records into a live feed. It sends only after an explicit Submit or Send
action. Connectivity returning does not trigger automatic sending. There is no
service worker, background upload, new dependency or resident helper.

The outbox keeps up to 20 unsent reports / 50 MiB and the latest 30 receipts.
Unsent records are not automatically expired. Browser/app data clearing can erase
local records. If storage fails, the form retains its current text/photo and
reports the problem rather than pretending that a durable save succeeded. The
legacy immediate-send path remains available for adapters/environments without
IndexedDB; it does not promise offline recovery.

Every queued report receives a stable `rtp-<UUID>` ID before network activity.
An IndexedDB lease prevents two tabs from claiming the same send concurrently;
in-page repeated clicks share a promise. A restart can retry after the lease
expires. Each acknowledged upload URL is saved before report creation, so a later
report retry reuses that photo. If the upload response itself is lost, an extra
Cloudinary image is still possible; this is not exactly-once media storage.

Firebase retries transact against the same report document. An existing matching
payload is returned, including a report already reviewed by an admin. A different
payload using that ID is rejected. Existing records are never rewritten on retry.
The current anonymous-create and administrator-moderation rules remain enforced.

The form waits at most 12 seconds for a receipt, then permits closing with a
truthful **Saved on this device / no server receipt yet** message. An already
requested send can continue while the page remains open. Upload attempts time out
after 30 seconds and report receipt checks after 60 seconds. Timing out cannot
cancel a remote commit; the UI says **Receipt unconfirmed**, and retry checks the
same ID. A successful acknowledgement creates a local receipt and releases the
locally saved image. Receipt time is this device's acknowledgement time, not an
observation time or laboratory measurement. Sample mode labels its local receipt
explicitly. **Open report receipt** retrieves the matching record by ID; failure
to retrieve it does not erase an existing local receipt.

## Panel motion

Report history, What changed?, My reports and receipt details share one animated
viewport. The active indicator slides between views; content fades and moves a
few pixels, and the window resizes without scaling text. Its header stays at a
stable top position. Departing content becomes inert, rapid switches resolve to
the latest view, and receipt navigation restores keyboard focus. Reduced motion
switches content immediately and disables row entrance effects.

On phones, connection diagnostics and history guidance expand on request. Short
view labels stay on one row, form controls use the available width, long zone
names wrap in report content, and receipt actions stack with 44-pixel targets.

## Evidence

- Full suite: 635 passed, with five emulator-only cases skipped there and
  passed separately. TypeScript and an isolated production demo build passed.
  Local logs are retained in the ignored `.cache` directory.
- Local emulator integration checks three-client reporting, 65 dated records plus
  one undated legacy record, 65 history events, preservation of old pending
  reports, and stable-ID retries after administrator review.
- Unit checks cover offline sends, lost acknowledgement after acceptance, photo
  URL reuse, repeated clicks, other-tab leases, archive retry cursors, stale
  requests after an archive-mode change, and saved-versus-received UI states.
- A real browser saved a prepared 408 KB synthetic image and text on port 4199,
  reloaded the page, recovered both without submission, then sent one sample
  report and opened its matching receipt. No real photo or live upload was used.
- The isolated port-4200 fixture has 70 sample reports/history events. Browser
  controls loaded report coverage from 31 (30 recent + one older pending) to 61
  and then 70; history grew from 30 to 60 to 70 events.
- Browser checks cover rapid panel switching, a stable header, receipt focus
  and phone layout. Tests also cover reduced motion changing during an exit.
- Physical Android behavior and live Cloudinary delivery are not verified by
  these checks. Native downloads must bundle this build before distribution.

References: [Firestore query cursors](https://firebase.google.com/docs/firestore/query-data/query-cursors),
[Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions),
[IndexedDB transactions](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB).
