# Landing activity calendar

> **Status — 2026-10-10:** this section is **not rendered by the Landing page any
> more**. It was swapped for the compact "Team" strip (see
> `docs/landing-team-section.md`), but every piece of the calendar was kept in
> the repo so it can be brought back unchanged.
>
> **Files left orphaned** (present, tested, but no longer imported by the page):
>
> - `src/components/ui/git-hub-calendar.tsx` — the `GitHubCalendar` component
> - `src/components/ui/git-hub-calendar.test.tsx` — its 3 unit tests (still run and pass)
> - `src/lib/reportActivity.ts` — `reportActivity`, `activityWeeks`, `manilaDate`
> - `src/lib/reportActivity.test.ts` — its 3 unit tests (still run and pass)
> - `src/styles/activity-calendar.css` — scoped styles (imported by the component)
>
> **Re-mount point:** in `src/pages/Landing.tsx`, inside `<main>`, at the spot
> now occupied by `<TeamSection />` — directly above `<footer>`. Re-adding
> `import { GitHubCalendar } from '../components/ui/git-hub-calendar'`,
> `import { manilaDate, reportActivity } from '../lib/reportActivity'`, the
> `activityNow` state/timer and the `activity` memo, and replacing `<TeamSection />`
> with the `<section className="report-activity">…</section>` block from git
> history, restores it exactly as documented below. The removed block is in
> commit history; no component, data or test code was deleted.

The standalone **Report activity** section sits below the explanatory content and above the footer. Desktop places its short introduction beside the chart; phones stack them with separate gutters. It does not compete with the hero or the coastal status summary.

Installed skill: `bs-data-visualization-activity-calendar` version **1.0.1**, supplied by the user as a ZIP archive. Source and instructions are retained in `.agents/skills/bs-data-visualization-activity-calendar`. Skillry's service CLI could not store an authenticated session on this Linux workspace; the provided archive was installed locally without importing credentials.

The skill's editable `GitHubCalendar` source was ported into `src/components/ui/git-hub-calendar.tsx`, preserving the weekly calendar grid and local teal ramp. Native UTC date arithmetic and Intl replace date-fns; derived data replaces the supplied type-invalid string/Date effect. Month labels align to real calendar boundaries. Existing local Red Tide typography and page tokens remain unchanged. No additional runtime package, remote image, font host or API is needed. MIT notices are retained in `activity-calendar-notices.md`.

Counts come from submission timestamps in the existing report store, grouped in Philippine time (UTC+8). Missing, unresolved or invalid dates are excluded and counted in the source caption. Future timestamps are excluded. Zero means no submissions in available records; it does not imply complete history, laboratory clearance or safe water. Sample, cache, pending-sync and error provenance comes from the same feed state as other page summaries. Unavailable history is not displayed as zero reports.

Visitors can select a day, move with arrow keys and Home/End, and choose 12, 26 or 52 weeks. The extended calendar scrolls within its own region, keeping page width intact. Future days are decorative empty cells. The selected-day detail is readable without hover; colour is supplementary to accessible date/count labels and a numeric legend. No looping chart animation is added.

Verification: `scripts/check-blocks.mjs` from the installed skill runs against the new calendar TSX and scoped CSS. Existing page glyphs and map CDN references are outside this calendar's scope. Unit tests cover timezone boundaries, leap days, unresolved/future dates, unavailable history, keyboard selection and period changes. Browser checks cover narrow-screen layout, horizontal scrolling and interaction.
