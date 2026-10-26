# Community report tracking

Report timelines, recent recorded changes, connection health and the ten-light UNO guide were reviewed locally before publication.

- Report activity now includes a submission/review/history timeline, search by ID or text, review filters and access to additional reports.
- What changed lists recorded submissions, decisions and each zone's latest status. It does not invent missing review dates or reconstruct older zone changes.
- Connection health distinguishes local samples, offline, cached, pending, failed and acknowledged feeds. A server receipt describes delivery to this device only. Retry resubscribes; it does not create or resend a report.
- The ten-red-LED UNO guide shows the tested D13-D9, D7-D3 wiring and lets readers inspect each role and the static pattern legend. Selecting a light never writes to USB. Shared-data requests become stale while offline. A never-connected client keeps its disconnected label.

Firebase already writes `reviewedAt` under the existing rules. This change reads that field; the local sample backend also preserves review times. Legacy records without it stay undated. No rule deployment is needed for this read-side addition.

## Review locally

Run `node .cache/start-community-preview.mjs` from this checkout. The ignored launcher serves localhost only, forces the sample backend, ignores .env configuration, and blocks remote data connections. It seeds sample reports only in the new port's browser storage.

- http://127.0.0.1:4197/map — open Reports, then Report history or What changed.
- http://127.0.0.1:4197/arduino-zones — select a light or expand the pattern legend.

The preview files and code snapshot live under `.cache/community-review` and are not part of the shipped product. Existing browser/app data on other origins is not altered. Native releases follow the shared Android/Windows release procedure in `native-app-updates.md`.

## Validation

Production build passed. 115 distinct focused checks cover report dates and ordering, legacy/invalid timestamps, review persistence, history filters, read-only change navigation, offline/cache/pending connection states, map history behavior, exact ten-pin meanings, source staleness, USB lifecycle and idle cleanup. Desktop and 390px phone layouts were reviewed in the browser, including search, report selection, close/focus return and the guide. No physical board connection or live Firebase write was made during preview.
