# Contributing and troubleshooting

## Pick the right place

| Topic | Where |
| --- | --- |
| A reproducible software bug | [Issues](https://github.com/franshessss2/red-tide-ppc/issues) |
| A question about using/building RTP | [Discussions — Q&A](https://github.com/franshessss2/red-tide-ppc/discussions/categories/q-a) |
| A feature or design idea | [Discussions — Ideas](https://github.com/franshessss2/red-tide-ppc/discussions/categories/ideas) |
| Project/release news | [Discussions — Announcements](https://github.com/franshessss2/red-tide-ppc/discussions/categories/announcements) |
| A coastal observation | The app's report form; GitHub is not the observation queue. |

Describe the device/OS, browser or app version, route, exact steps, expected result and actual result. Include a cropped screenshot or error text where useful. Remove personal details, `.env` contents, credentials, device-ingest tokens and private data. Keep requests respectful and specific; do not represent a community report as an official bulletin.

## Common questions

**Why does the app say Sample data?** The sample backend is selected, usually because Firebase build variables are missing/incomplete/placeholder or demo mode is forced. The deployment/app being online does not prove shared live data. See [Data and limits](Data-and-limits.md).

**Why is my report missing on another device?** Local sample records belong to one origin and storage profile. Website, Android and Windows records do not sync in sample mode. Reinstalling or clearing data may also change the storage you are viewing.

**Why are map tiles blank?** Tiles require internet. Record the route, connection state and whether it happens in the browser or packaged app. A bundled site is not a downloaded offline map.

**Why is the Android header under the status bar?** Verify that the installed APK includes PR #99. Older release assets can still contain older builds even when source on `main` is fixed. Report the app version, phone model, Android version, orientation and a screenshot; real-device inset behavior remains unverified.

**Why does Windows show an unknown publisher?** The current alpha is unsigned. Signing and SmartScreen reputation have not been established. Obtain the file from the project-maintained release once published; check its matching hash.

**Why does Arduino not connect?** Use the documented board/wiring and a compatible desktop browser or the RTP Windows alpha. Close Arduino Serial Monitor, connect your board and explicitly choose the correct port. No hardware driver or communication test is implied by unit tests. See [Arduino setup](https://github.com/franshessss2/red-tide-ppc/blob/main/docs/arduino-combined.md).

**Why is the device feed unavailable in the desktop app?** The bundle does not run hosted server functions. Use local rehearsal, or the configured hosted site's device demonstration.

**Does the passcode secure the backend?** No. The prototype gate is browser-visible and there is no Firebase Auth. Do not share private material or rely on this gate for reviewer authorization.

## Code and documentation changes

Work on a separate branch and keep changes focused. State what changed, why, what was measured and what remains unverified. Follow the checks in the component/package README. Root checks are `npm run typecheck`, plain `npm test` and `npm run build`; there is no root `lint` script. Never commit env files or private keys.

Wiki copies and initial Discussion bodies live in [docs/community](https://github.com/franshessss2/red-tide-ppc/tree/main/docs/community). Future PRs can review those sources. Native Wiki publication remains separate; changing a starter post source does not silently overwrite an existing live Discussion.
