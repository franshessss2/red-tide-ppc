# RedTide ppc — RTP community guide

RedTide ppc (RTP) is a school prototype for coastal community records and observations in Puerto Princesa, Palawan. Explore seven approximate coastal zones, submit an observation and demonstrate human review. Community warnings are not official BFAR advisories; no recorded warning does not establish seafood safety.

[Open the website](https://red-tide-ppc.vercel.app/) · [Open the map](https://red-tide-ppc.vercel.app/map) · [Join Discussions](https://github.com/franshessss2/red-tide-ppc/discussions) · [Report a software issue](https://github.com/franshessss2/red-tide-ppc/issues)

## Find your guide

| I want to… | Read |
| --- | --- |
| Use the map or rehearse a report | [Getting started](Getting-started.md) |
| Understand sample records, status labels and review limits | [Data and limits](Data-and-limits.md) |
| Install or build the Android alpha | [Android app](Android-app.md) |
| Install or build RedTide ppc for Windows | [Windows app](Windows-app.md) |
| Ask a question, suggest a feature or troubleshoot | [Contributing and troubleshooting](Contributing-and-troubleshooting.md) |

## Current project state

Documentation snapshot: **13 October 2026**, after Windows packaging PR #102.

- **Website:** hosted on Vercel. Hosting does not prove a live backend. When Firebase configuration is missing, incomplete or placeholder, the bundle falls back to sample records. Look for **Sample data** and the source details.
- **Android:** debug alpha, distributed through the linked Drive folder and release assets. It bundles a web build and includes the status-bar/display-cutout fix. Real-device verification remains pending.
- **Windows:** Electron x64 alpha named **RedTide ppc**, shorthand **RTP**. An unsigned installer was built and tested locally; a Windows release asset is not published yet.
- **Records:** a report is reviewed by a person. The app does not ingest current BFAR bulletins or test water/seafood.
- **Team:** empty roster slots remain disabled; no real team biographies or media have been supplied.
- **Device demonstrations:** simulated station readings and Arduino distance/LED/buzzer exercises are separate from community warning status.

For official advice, use [BFAR shellfish bulletins](https://www.bfar-frmdhabmonitoring.com.ph/shellfishBulletinFile). For implementation details, see the [repository README](https://github.com/franshessss2/red-tide-ppc/blob/main/README.md). Release artifacts and app versions can differ from the latest source; use the notes attached to the artifact you downloaded.
