# Data and limits

## Labels describe delivery, not authority

| Label or status | Meaning |
| --- | --- |
| **Sample data** / **Sample data · local records** | Demo records kept on this browser/app origin. They are not a shared live feed. |
| Cached records | Previously received records; cache delivery does not prove freshness. |
| Server delivery | Records arrived from a configured backend. This does not make them official BFAR data. |
| **No alert recorded** | No community warning is recorded. It does not establish official clearance. |
| **Under review** | A zone has been flagged for a check. |
| **Community warning** | An admin-reviewed community warning. Check official bulletins before a food-safety decision. |

The existing sample fallback activates for missing, incomplete or placeholder Firebase configuration. `VITE_USE_DEMO_BACKEND=true` forces local sample mode. Look at source details rather than assuming that a deployed website or a green connection is a live advisory service.

The browser, Android and Windows wrappers have separate local storage. A sample report entered on one does not automatically appear on another. Clearing application data can remove that origin's sample records. Replaying the intro does not clear reports.

## Review and timestamps

- A newly submitted report is pending.
- Approval confirms the community report and raises the zone's community-warning status.
- Rejection leaves the zone's status unchanged.
- Statuses do not expire automatically. A reviewer changes them manually.
- A record-update time is not a water-sampling time or an official bulletin issue date.

## Prototype access control

The admin UI uses a public browser passcode, with no Firebase Auth. It is a rehearsal gate, not protection against direct API requests. The current rules do not establish reviewer identity. Do not treat this setup as a secure moderation system for a real public deployment. The [README](https://github.com/franshessss2/red-tide-ppc/blob/main/README.md#44-deploy-the-firestore-security-rules) explains the current rules and intended follow-up.

The optional `VITE_REQUIRE_FIREBASE=true` build guard checks required configuration fields and names missing variables without printing values. It does not test connectivity, authenticate reviewers or disable forced demo mode. Keep server credentials out of public `VITE_*` values.

## What the app does not establish

Approximate zones, photographs, community reviews, station simulations and Arduino distance readings cannot establish toxin concentrations or seafood safety. There is no current official-bulletin ingestion. Use [BFAR bulletins](https://www.bfar-frmdhabmonitoring.com.ph/shellfishBulletinFile) for official information and applicable local advice.

See the detailed [data-state notes](https://github.com/franshessss2/red-tide-ppc/blob/main/docs/community-data-states.md).
