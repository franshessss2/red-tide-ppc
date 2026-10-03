# Community status, dates and feed provenance

The map shows moderated community records. Receiving a server snapshot does not
establish that a coastline was recently tested, and an admin-reviewed report is
not laboratory confirmation. The public UI links to BFAR's bulletin listing
without claiming that any current Puerto Princesa clearance was verified.

## Status contract

Existing stored values stay compatible with the current database and rules.
The read model adds `unknown`; admin writes remain limited to the three existing
values. No data migration is required.

| Stored value | Public label | Persistent symbol / boundary |
| --- | --- | --- |
| `advisory` | Community warning | Warning triangle / solid warning boundary |
| `unconfirmed` | Under review | Clock diamond / dashed boundary |
| `safe` | No alert recorded | Minus circle / quiet solid boundary |
| Missing or unrecognised | Status unavailable | Question square / dotted neutral boundary |

Missing status never falls back to no alert. A valid warning keeps its warning
status even when its date is unavailable. An empty feed says that no records
are available; it does not imply that the coast is clear.

## Date contract

- `lastUpdated` means the zone's **status changed**. It is not a sampling date.
- `submittedAt` means report submission. Unknown submission dates sort last.
- Invalid, absent, non-finite, out-of-range and throwing timestamp values map
  to `null`, never the current time.
- A null timestamp on a pending document write says **Awaiting server
  timestamp**. A missing field or malformed value says **Date unavailable**.
- **Last server sync** is the client receipt time of a non-cached snapshot
  without pending writes. It describes delivery; it does not replace record
  dates or establish bulletin freshness. Dates are shown in Philippine Time.
- Local sample records never receive a server-sync badge or server receipt time.

## Independent zone and report feeds

Both Firestore listeners request `includeMetadataChanges`, so cached-to-server
transitions are visible even when document contents do not change.

| Feed state | Meaning |
| --- | --- |
| Loading | Connecting; existing records can remain on screen during retry |
| Cached | A local copy; the server has not verified this snapshot |
| Pending | Writes await server acknowledgement; do not advance sync time |
| Synced | A server snapshot was received without pending writes |
| Error | Updates are unavailable; retain the last received records and allow retry |
| Sample | Local sample records, disclosed beside their source |

A retry replaces only the requested listener. Its previous callbacks and all
callbacks after cleanup are ignored. A recovery clears only that feed's error.
Dismissible action toasts cannot dismiss feed errors. An empty unverified cache
cannot erase records already received; an authoritative empty server snapshot
can remove them and is presented as unavailable records.

## Presentation and motion

The landing, public list, popups and admin use the same status wording. Public
source rows distinguish community records and sample data, with a nearby BFAR
link. The percentage and wave gauge are replaced with exact counts such as
**2 of 7 zones flagged**, plus unavailable-status and pending-report counts.
Loading counts use a placeholder rather than an invented zero.

Critical labels and final numbers appear immediately. Fixed symbols, boundary
patterns and text carry meaning when color or animation cannot. A changed
symbol has a short opacity acknowledgement; reduced motion keeps it still.
The existing single `LiveDataStatus` region coalesces feed and zone changes;
repeated receipt times do not repeat announcements.

On short landscape screens, zoom controls share a row with the collapsed
counts tab, leaving a usable scroll area for the zone list. The connection
summary remains visible while the zone drawer is closed, outside the count
card's clip window.

## References behind these decisions

- [Firestore offline data and snapshot metadata](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [BFAR FRMD shellfish bulletin listing](https://www.bfar-frmdhabmonitoring.com.ph/shellfishBulletinFile)
- [WCAG: use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
- [WCAG: keyboard access](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)
- [Motion accessibility](https://motion.dev/docs/react-accessibility)

Official bulletin attachment/ingestion, atomic moderation writes, recoverable
report drafts and observation-time capture remain separate follow-up work.
