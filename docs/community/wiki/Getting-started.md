# Getting started

## Explore and report

1. Open the [website](https://red-tide-ppc.vercel.app/). On eligible first visits, enter after the opening film/reel. The replay control restarts it; reduced motion uses the existing static equivalent.
2. Select **Open the map**, or visit [/map](https://red-tide-ppc.vercel.app/map).
3. Select a coastal zone and read its community status and data-source label. Boundaries are approximate.
4. Use **Report a sighting**. Add a description; a photo is optional. The report starts pending. Sample-data reports stay on this browser/app origin.
5. A reviewer can approve or reject the report. Approval can raise a **Community warning**; it is not laboratory confirmation or official clearance.

On mobile, the map uses a compact bottom panel. On wider screens, use the zone/advisory drawers. No account is required for the prototype report form.

## Rehearse locally

Install the repository's dependencies with Node.js 22.12 or newer, then:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. This demo launcher deliberately selects local sample data and ignores env files. The public prototype review gate is documented in the [README quick start](https://github.com/franshessss2/red-tide-ppc/blob/main/README.md#3-quick-start-no-firebase-project-required). That gate is readable in the browser bundle and is not reviewer authentication.

For an environment-configured local run, follow the [Firebase setup](https://github.com/franshessss2/red-tide-ppc/blob/main/README.md#4-connecting-a-real-firebase-backend) and use `npx vite`, or build and preview. Do not post `.env` contents, credentials or ingestion tokens in Discussions.

## Device demonstrations

- [/devices](https://red-tide-ppc.vercel.app/devices): local rehearsal controls and, when configured, a synthetic device feed. These readings never measure red-tide toxins or update community warnings.
- [/arduino.html](https://red-tide-ppc.vercel.app/arduino.html): distance scanner, LED and buzzer demonstration. Browser serial needs a compatible desktop browser, a board and permission; see the [wiring/setup guide](https://github.com/franshessss2/red-tide-ppc/blob/main/docs/arduino-combined.md).

[Data and limits](Data-and-limits.md) explains what the labels mean. The [presentation review](https://github.com/franshessss2/red-tide-ppc/blob/main/docs/presentation-review.md) is a rehearsal aid; older screenshots may show an earlier layout.
