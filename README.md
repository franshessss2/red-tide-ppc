# Red Tide PPC

**A school prototype for coastal community records and observation reports in Puerto Princesa, Palawan.**

Explore seven approximate coastal zones, submit an observation, and demonstrate a human review that can raise a community warning. A reviewed report is not laboratory confirmation, and no recorded warning is not a food-safety clearance.

[Production website](https://red-tide-ppc.vercel.app/) · [Public map](https://red-tide-ppc.vercel.app/map) · [Android download folder](https://drive.google.com/drive/folders/1mpUalyCgYrDXoN8L1KP7WVv11_p-VFSJ?usp=sharing) · [GitHub releases](https://github.com/franshessss2/red-tide-ppc/releases)

[Community guide](docs/community/wiki/Home.md) · [Discussions](https://github.com/franshessss2/red-tide-ppc/discussions) · [Wiki publication and sources](docs/community/README.md)

## Current state — 13 October 2026

- **Hosting:** Vercel, deployed from `main`. Record labels distinguish sample/local data, cached records and server delivery. Hosting does not imply live or official data.
- **Sample mode:** missing, incomplete or placeholder Firebase configuration falls back to browser-local records; `VITE_USE_DEMO_BACKEND=true` forces that mode. Visitors see **Sample data** beside community records and **Sample data · local records** in source details. The current production check is dated in §9.
- **Introduction:** an opening film followed by a nine-chapter reel. The reel loops until the visitor enters; reduced motion skips the film and shows a static equivalent. Replay restarts the sequence. See [Opening film](docs/opening-video.md) and [Reel intro](docs/reel-intro.md).
- **Map:** below 768px, a compact bottom panel; at desktop widths, the original zone/advisory drawers. A separate street-map dialog uses MapLibre. See [Mobile map layout](docs/mobile-map-layout.md) and [Street map](docs/mapcn-text-motion.md).
- **Android:** a Capacitor debug alpha bundles the web build. The shared Drive folder currently contains the PR #99 status-bar/cutout fix as `RTP.apk`; it is outside Google Play. Real-phone verification remains pending. Build details are in §9 and [Android setup](android-app/README.md).
- **Windows:** **RedTide ppc (RTP)** is an Electron x64 testing alpha with a native window, menus and per-user installer. It bundles the web build; sample/local records are separate from the website and Android. The installer is unsigned and is not yet attached to a GitHub release. See [Windows setup and limits](desktop-app/README.md).
- **Team:** three empty roster slots remain disabled. Supplying real names, roles, initials and media is a separate follow-up; see §15.

For the school rehearsal, see [Presentation review](docs/presentation-review.md); some older walkthroughs and screenshot scripts describe earlier layouts, so use the current behavior above when following them. The isolated device demonstrations are documented in [Virtual device setup](docs/virtual-device-setup.md) and [Combined Arduino UNO](docs/arduino-combined.md).

---

## 1. The problem, in plain English

Some algal blooms produce toxins that can accumulate in seafood. Water appearance and a community photograph cannot establish whether seafood is safe. The app collects observations, not toxin measurements or official advisories.

Paralytic shellfish poisoning can cause numbness, weakness and breathing problems; severe cases can cause respiratory failure. Seek urgent medical care for suspected poisoning after eating seafood. Timing and severity vary; do not wait for a particular symptom sequence. [CDC clinical signs and symptoms](https://www.cdc.gov/harmful-algal-blooms/hcp/clinical-signs/symptoms-saltwater-harmful-algal-blooms.html).

Cooking or freezing does not make marine shellfish toxins safe. Treatment is supportive medical care, not a remedy supplied by this app. [CDC marine-toxin guidance](https://www.cdc.gov/yellow-book/hcp/environmental-hazards-risks/food-poisoning-from-marine-toxins.html), [CDC clinical overview](https://www.cdc.gov/harmful-algal-blooms/hcp/clinical-overview/index.html).

For Philippine official advice, check [BFAR shellfish bulletins](https://www.bfar-frmdhabmonitoring.com.ph/shellfishBulletinFile) and the applicable local authority. The site links to BFAR; it does not import current bulletins or certify a coastal area. These health references were checked on **13 October 2026**; no current local clearance is asserted.

---

## 2. What the app does

**Routes**

- `/` — opening film/reel on eligible first visits, then the landing page with community figures, source labels, replay and the Android QR download dialog.
- `/map` — the public map (lazy-loaded; the landing and admin never pay for Leaflet).
- `/admin` — Google sign-in and an administrator claim in Firebase mode; a public demo lock in sample mode.
- `/devices` — local rehearsal page for the optional virtual ESP32, with no accounts or hardware (see [Virtual device setup](docs/virtual-device-setup.md)).
- `/arduino.html` — browser USB/serial demonstration; `/arduino-demo.html` remains an alias (see [Arduino setup](docs/arduino-combined.md)).
- `/api/device-readings` — Vercel device-ingest/read endpoint. Server-only configuration is `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `DEVICE_INGEST_TOKEN` and `DEVICE_STORAGE_NAMESPACE`; see the virtual-device guide for constraints and setup. These values must not use the public `VITE_` prefix.

**Core loop**

1. **Public map at `/map`** — a Leaflet map of the Puerto Princesa coastline. Each zone is a coloured nearshore band hugging the actual shoreline (see §10):
   - 🟢 **No alert recorded** (`safe`) — no community warning recorded; this does not establish official clearance.
   - 🟡 **Under review** (`unconfirmed`) — flagged by an admin as needing a check; treat with caution.
   - 🔴 **Community warning** (`advisory`) — an admin-reviewed community warning; check official BFAR bulletins before a food-safety decision.
2. **Tap a zone** → read its community status, guidance, pending-report count and record-update time in the popup/panel; the report action opens the form. Record-update time is not water sampling time.
3. **Report form** — a description plus an optional photo. No account, no name, no login. The report has status `pending`: stored in Firestore when configured, or in browser-local sample data in demo mode.
4. **Admin view at `/admin`** — Firebase Google sign-in plus an administrator claim, or the local sample-data demo lock. Pending reports are listed with zone, description, photo and timestamp.
   - **Approve** → the report becomes `confirmed` **and** its zone becomes `advisory` with `lastUpdated = now`.
   - **Reject** → the report becomes `rejected` and the zone is left exactly as it was.
5. **Manual control only** — zone status does not expire automatically. An admin can change it from the **Zones** tab. Setting `safe` means no community warning is recorded; it does not clear water or seafood officially.
6. **Optional shipping-channel overlay** — a ship icon in the header toggles dashed blue PCG traffic-lane lines for the port approach (see §11), so someone drifting while gleaning can see where ship traffic is channelled. Off by default; a safety reference, not an advisory.

---

## 3. Quick start (no Firebase project required)

```bash
npm ci
npm run dev
```

Use Node.js 22.12 or newer in the Node 22 line, matching CI's Node 22 setup. Open the URL Vite prints. `npm run dev` runs `scripts/demo.mjs`, which always selects the browser-local demo backend, ignores env files and uses the public demo passcode from `src/lib/demoAdminPasscode.ts`. This is only a local rehearsal lock. Community-record views show **Sample data**; connection details and the map status show **Sample data · local records**. There is no `DemoBanner.tsx` banner. Map tiles and other network assets can still be requested; sample reports stay local.

For an env-configured local run, fill `.env`, then use `npx vite` or `npm run build` followed by `npm run preview`. The default demo launcher does not use those values.

> **Scoped sample reset:** this removes local sample reports, photos and zone changes on the current origin. Use only when you intend to discard that rehearsal data:
>
> ```js
> localStorage.removeItem('red-tide-ppc:demo:v1')
> location.reload()
> ```
>
> This preserves unrelated storage and the intro-seen key. It does not delete Firebase records. Replaying the intro needs no reset: use ↻ or `/?intro=1`.

---

## 4. Connecting a real Firebase backend

The app uses **Firestore for data, Firebase Auth for real administrator sign-in, and Cloudinary for photo uploads**.

### 4.1 Create the project

1. [Firebase console](https://console.firebase.google.com) → **Add project**.
2. **Build → Firestore Database → Create database** (start in production mode; the rules below replace the defaults).
3. **Project settings → General → Your apps → Web app (`</>`)** → register an app and copy the config object.

### 4.2 Fill in `.env`

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:0000000000000000
VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-upload-preset
VITE_ADMIN_PASSCODE=change-me
```

`.env` is gitignored. `VITE_ADMIN_PASSCODE` controls only the public sample-data lock; it cannot authorize Firebase moderation. Firebase mode requires a verified Google account with a trusted boolean `admin` claim and deployed rules. Everything prefixed `VITE_` is public browser configuration: never put account passwords or private credentials there. See [administrator setup](docs/admin-auth.md).

Restart an env-configured `npx vite` run after editing `.env`, or rebuild before preview/deployment. `npm run dev` deliberately forces demo mode and ignores env files.

### Optional Firebase build guard

Set `VITE_REQUIRE_FIREBASE=true` in the build environment to make `npm run build` fail when any of `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID` or `VITE_FIREBASE_APP_ID` is missing, blank or a shipped placeholder. The error names every invalid variable without printing values. Vite loads the selected mode's env files and build-process variables; changing deployed settings requires a rebuild.

Leave the flag unset for the existing preview/demo behavior. Development serving is unaffected. This checks configuration completeness, not credential validity or server connectivity; it does not override `VITE_USE_DEMO_BACKEND=true`.

### 4.3 Configure Cloudinary photo uploads

1. Create a free account at [Cloudinary](https://cloudinary.com/users/register_free).
2. In the Cloudinary console, copy your **Cloud Name** from **Settings → API Keys** into `VITE_CLOUDINARY_CLOUD_NAME`.
3. Go to **Settings → Upload → Upload presets**, create a preset with **Signing Mode: Unsigned**, and put its preset name in `VITE_CLOUDINARY_UPLOAD_PRESET`.

The upload preset name and cloud name are public browser configuration, not secrets. Restrict the unsigned preset in Cloudinary (for example, allowed formats and file size) before production use.

### 4.4 Deploy the Firestore security rules

The repository ships `firestore.rules` (wired up by `firebase.json`):

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project
firebase deploy --only firestore:rules
```

Or paste the contents into the Firebase console under **Firestore → Rules**.

Firebase moderation updates now require a verified Google identity and the boolean `admin` custom claim. Public pending submissions remain allowed with schema checks; zone creation/deletion and geometry edits are denied to clients. Reports remain publicly readable for the existing map/feed. These rules do not add private reports or rate limiting.

**Merging a frontend PR does not deploy Firebase rules.** Follow the staged [administrator setup and acceptance checklist](docs/admin-auth.md), including provider/domain configuration, verified UID approval, emulator tests and explicit rules deployment. The old public-web-config seed command is blocked by these rules; do not reopen public writes to seed.

### 4.5 Seed the zones

Zones are **pre-seeded, never user-created**:

```bash
npm run seed:dry-run   # show what would be written, write nothing
npm run seed           # legacy web-config command; denied by the secure rules
```

The legacy seed script loads `.env`/`.env.local` and process variables; it does not use the demo launcher's forced environment. Its definitions come from `src/data/zones.ts`, with `lastUpdated = serverTimestamp()`. The secure rules deny client-side zone creation and geometry changes, so provision through separately reviewed trusted tooling. Dry run still validates/prints payloads without fetching documents or writing; it does not verify deployed authorization rules.

`--force` is a deliberate destructive maintenance option: it overwrites existing zone definitions, resets their status and replaces `lastUpdated`. It is not routine deployment or geometry advice. Back up records and review a migration before changing existing zones; the current Firestore rules may reject geometry changes.

Polygons are stored as arrays of `{lat, lng}` objects: Firestore rejects nested arrays, so the `[lat, lng]` tuples the app uses are converted on the way in (`toFirestorePolygon`) and back to tuples on the way out (`normalizePolygon`). `seed:dry-run` also validates every payload shape before touching the network.

### 4.6 Verify

Reload an env-configured build. **Sample data** should be absent; source details distinguish cached/pending records from an acknowledged server snapshot. Verify that a report submitted in one browser appears in another. A server-delivery label does not establish official clearance or when the coast was tested.

---

## 5. Admin review workflow

| Action | Report status | Zone status |
| --- | --- | --- |
| **Approve** | `pending` → `confirmed` | → `advisory`, `lastUpdated = now` |
| **Reject** | `pending` → `rejected` | **unchanged** |
| **Zones tab → No alert recorded / Under review / Community warning** | unchanged | set directly, `lastUpdated = now` |

Submitting a report never changes a zone by itself — otherwise a rejected report would leave a zone stuck in a changed state. The number of pending reports per zone is shown on the map popup and in the zone list instead.

---

## 6. Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `npm run dev:demo` | Demo launcher: browser-local records and public prototype passcode, ignores env files; binds `0.0.0.0` |
| `npm run build` | Type-check (`tsc -b`) then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Run the Vitest suite once |
| `npm run test:rules` | Real Firestore emulator authorization tests; no live credentials |
| `npm run test:watch` | Vitest in watch mode |
| `npm --prefix android-app run cap:sync` | Copy the root `dist/` build into the Android project |
| `npm --prefix android-app run verify:sync` | Verify synced web assets match root `dist/` byte for byte |
| `npm --prefix android-app run cap:open` | Open the Android project in Android Studio |
| `npm run seed` | Legacy web-config seed; blocked by secure rules (use reviewed trusted provisioning) |
| `npm run seed:dry-run` | Seed preview, no writes |
| `npx tsx scripts/generate-zones.ts` | Regenerate the zone polygons + coastline reference from `scripts/coastline-cache/` (verifies geometry, then writes `src/data/zones.ts` + `src/data/coastline.ts`) — `--check` verifies without writing (§10) |
| `node scripts/fetch-coastline.mjs` | Raw OSM coastline fetch (runs in CI — `.github/workflows/fetch-coastline.yml` commits the result to `scripts/coastline-cache/`) |
| `node scripts/fetch-seamarks.mjs` | Raw OSM seamark sweep for the shipping-overlay provenance (runs in CI — `.github/workflows/fetch-seamarks.yml`, §11) |
| `node scripts/map-motion-pass.mjs` | Historical Chromium map-motion pass; check its header and current desktop/mobile targets before use (§14) |
| `node scripts/route-transition-pass.mjs` | Real-browser verification of the route dissolve (`/` <-> `/map`; `/admin` stays instant) |
| `node scripts/route-transition-filmstrip.mjs` | Before/after filmstrip capture for that route dissolve |

---

## 7. Project structure

Key entrypoints; this is not an exhaustive file list:

| Path | Responsibility |
| --- | --- |
| `src/App.tsx` | Routes and app composition |
| `src/store.ts`, `src/types.ts` | Application state, actions and domain types |
| `src/data/zones.ts`, `src/data/coastline.ts`, `src/data/shipping.ts` | Approximate zones, geometry reference and shipping transcription |
| `src/data/team.ts` | Disabled, empty Team roster and readiness marking |
| `src/lib/backend.ts`, `src/lib/backend.demo.ts`, `src/lib/backend.firebase.ts` | Backend selection; local sample records or Firestore/Cloudinary |
| `src/lib/firebase.ts`, `src/lib/firebaseConfig.ts` | Runtime selection and shared opt-in build configuration check |
| `src/lib/status.ts`, `src/components/DataProvenance.tsx` | Status guidance and source labels |
| `src/components/SplashScreen.tsx`, `src/components/intro/` | Opening film, first-visit gate and nine-chapter reel |
| `src/pages/Landing.tsx`, `src/styles/landing-motion.css` | Landing layout, reserved geometry and coordinated entrances |
| `src/components/HeroBackdrop.tsx`, `src/components/ferrofluid/` | Lazy hero canvas and shader |
| `src/components/Waves.tsx` | Two sine composites in the landing canvas |
| `src/components/AndroidDownloadButton.tsx` | Landing-only QR dialog and shared download-folder link |
| `src/pages/MapPage.tsx`, `src/components/Map.tsx`, `src/components/MapMarkers.tsx` | Coastal map, polygons, reports and optional location dot |
| `src/components/MobileMapPanel.tsx`, `src/components/MobileMapActions.tsx` | Phone information panel and options |
| `src/components/ZoneDrawer.tsx`, `src/components/AdvisoryDrawer.tsx` | Desktop drawers |
| `src/components/StreetMapDialog.tsx`, `src/components/StreetMapExample.tsx` | Lazy MapLibre street-map dialog |
| `src/pages/Admin.tsx`, `src/components/AdminGate.tsx`, `src/components/ReportForm.tsx` | Review gate, queue and observation form |
| `src/motion/LandingMotionPolicy.tsx`, `src/motion/preferences.ts` | Scoped Save-Data and reduced-motion policy |
| `src/motion/`, `src/styles/` | Shared motion helpers and styles; some files describe legacy effects |
| `api/device-readings.ts`, `server/`, `wokwi/` | Isolated synthetic-device ingestion and simulator |
| `public/arduino.html`, `public/arduino-demo.html`, `arduino/` | USB demonstration and downloadable sketches |
| `android-app/` | Separate Capacitor package, Android source and device regressions |
| `.github/workflows/ci.yml` | Typecheck, plain tests, build and full-history Gitleaks |
| `scripts/`, `docs/` | Seed/geometry tools and dated verification records |

---

## 8. Data model

**`zones/{zoneId}`** — pre-seeded, admin-editable

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | e.g. `honda-inner` |
| `name` | string | shown on the map |
| `description` | string | one-line plain-English description |
| `polygon` | array | array of `{lat, lng}` objects (the app converts to/from `[lat, lng]` tuples; Firestore forbids nested arrays) |
| `status` | string | `safe` \| `unconfirmed` \| `advisory` |
| `lastUpdated` | timestamp | set with `serverTimestamp()` |

**`reports/{reportId}`** — anonymous user submissions

| Field | Type | Notes |
| --- | --- | --- |
| `zoneId` | string | which zone this is about |
| `description` | string | 10–2000 characters |
| `photoUrl` | string \| null | Cloudinary secure image URL |
| `submittedAt` | timestamp | `serverTimestamp()` |
| `status` | string | `pending` \| `confirmed` \| `rejected` |

---

## 9. Deploying

`npm run build` produces `dist/`. Static hosting can serve the SPA; the optional device API additionally needs a server-function host.

**Vercel (production)** — [red-tide-ppc.vercel.app](https://red-tide-ppc.vercel.app), deployed from `main` with `npm run build` and output `dist`. `vercel.json` supplies the SPA fallback while excluding `/api/` routes. Set public Firebase/Cloudinary build variables for the intended deployment environment; changing settings requires a rebuild.

**Current deployment check (2026-10-13):** an isolated Chromium visit showed **Sample data** and local-record labels on `/` and `/map`. The served bundle was previously observed without the five Firebase configuration variables on 2026-10-10; current build-time settings were not inspected. Missing, incomplete or placeholder configuration selects sample data, and `VITE_USE_DEMO_BACKEND=true` can explicitly force it. These labels do not identify which setting caused the fallback.

The same read-only check loaded `/`, `/map`, `/admin`, `/devices`, `/arduino.html` and `/arduino-demo.html` plus their checked entry JS/CSS assets with HTTP 200 and no page exceptions. Map tiles were blocked; no reports, admin unlock or hardware actions were tested. **`GET /api/device-readings` returned HTTP 500, plain-text `FUNCTION_INVOCATION_FAILED`**, rather than the handler's JSON response. [Issue #37](https://github.com/franshessss2/red-tide-ppc/issues/37) tracks this unresolved deployment failure and the remaining route checks. Its cause and the current server configuration are unverified; a green deployment/build does not establish endpoint health.

**Netlify (alternative static host)** — the existing `public/_redirects` catch-all serves `index.html` for unmatched paths, including `/api/*` where no endpoint handles them. The repository's Vercel device function is not a Netlify function; provide an appropriate API backend/routing before using device ingestion there.

Notes:

- Env vars are baked in **at build time**. Changing them requires a redeploy.
- Make sure the deployed Firestore rules are the ones in this repo, and restrict the unsigned Cloudinary preset for production.
- Map tiles come from OpenStreetMap and need the visitor to be online.
- Hosting quotas and pricing depend on provider and plan. Check the Vercel dashboard before relying on a production budget; Netlify credit estimates do not describe this deployment.

---

### Android debug alpha

The current native version is `0.2.0-alpha.1` / version code `1`, with placeholder app ID `com.redtideppc.app`. `android-app/` pins Capacitor core, Android runtime and CLI to 8.5.2. It bundles `../dist`; it does not load the Vercel site remotely. There is no iOS project or production signing setup.

The landing header's small **QR** button opens a download dialog. Both its QR image and its link target the shared folder above, so replacing the APK inside that folder does not require changing the QR. As checked on **13 October 2026**, its sole `RTP.apk` matches the rebuilt PR #99 debug APK (SHA-256 `8fa8d19c4beb877288f66011b9613a8bef89c2017da2c674f4ac9dbc3ee71d3c`). The older tagged GitHub Android alpha asset predates the #99 fix; it was not replaced by the merge. The download-folder policy is to upload and verify the newest APK before removing older APKs, leaving one current APK.

```bash
npm ci
npm run build
npm --prefix android-app ci
npm --prefix android-app run cap:sync
npm --prefix android-app run verify:sync
npm --prefix android-app run cap:open
```

In Android Studio, use the configured Android SDK/JDK to build/install a debug APK. Alternatively, from `android-app/android`, run `gradlew.bat :app:assembleDebug` on Windows (`./gradlew :app:assembleDebug` on Unix). See [Android setup](android-app/README.md) for the toolchain, dependencies, Back behavior and connected-device tests.

PR #99 reserves status-bar, navigation-bar, display-cutout and keyboard space around the WebView. The rebuilt APK was compiled, linted and signature-checked; connected-device regression execution, keyboard/rotation/navigation behavior and real-phone GPU performance remain **unverified**. Installing the rebuilt APK is necessary to test native geometry; a web preview cannot verify it.

The bundled sample-data build uses the public prototype passcode in §3 and does not provide offline map tiles, a local `/api/*` server, push notifications or authenticated moderation. The isolated device page needs a hosted API strategy for native use. Install only the intended testing APK; this is not a Google Play release.

---

## 10. Zone boundaries

The polygons in `src/data/zones.ts` are **machine-traced approximations generated from the real OSM coastline** — not survey boundaries and not official BFAR fisheries areas.

Each zone is a **single simple polygon of 63–270 vertices**: a nearshore band whose **landward edge is a dense run of real OpenStreetMap coastline nodes** (verified to stay within 20 m of the mapped coastline everywhere) and whose **seaward edge comes from a true geodesic line buffer of that run**. Both edges are Douglas–Peucker simplified (landward ε = 8 m, seaward ε = 15 m). Where an inlet is narrower than the opposing banks' buffers, those banks bound the water instead of forcing a full-width strip onto land. These are distance-to-shore approximations, not measured depth contours.

| id | What the band covers | Band | Vertices (landward / seaward) |
| --- | --- | --- | --- |
| `pp-bay` | Bancao-Bancao → Pristine Beach → port basin → San Jose shore → northern apex → opposite bank south to `9.7712302, 118.7161899` | 400 m | 270 (202 / 68) |
| `sta-lourdes` | Peninsula east coast: Blue Palawan shore → Tagburos mangrove inlet → Sta. Lourdes wharf pier complex → harbour shore | 350 m | 124 (77 / 47) |
| `honda-inner` | Honda Bay west shore, from N of the wharf pier complex north to 9.894 | 350 m | 67 (45 / 22) |
| `honda-outer` | Mangrove shore and tidal channel north to just W of the creek mouth | 350 m | 63 (43 / 20) |
| `binuatan` | Northeast coast: Honda Bay mouth → off Marayugon → around the 9.9812 headland → toward Babuyan | 400 m | 95 (60 / 35) |
| `sabang` | St. Paul Bay: NW end of the shore → Sabang village and boat terminal → east along the bay | 350 m | 161 (117 / 44) |
| `irawan` | Iwahig approach → Irawan estuary → original east-wall cap at `9.7719706, 118.7124480` (unchanged) | 400 m | 65 (37 / 28) |

**How they are generated** (and re-generated — do not hand-edit the coordinates):

1. CI (`.github/workflows/fetch-coastline.yml`) runs `scripts/fetch-coastline.mjs`, which pulls every `natural=coastline` way in the seven zone bboxes from Overpass plus the documented ways from the OSM API, and commits the raw geometry to `scripts/coastline-cache/osm-coastline.json`.
2. `npx tsx scripts/generate-zones.ts` walks the coastline graph (Dijkstra between per-zone anchors), bridges thin out-and-back spurs (piers, fish pens — only where the bridge chord stays within 15 m of the real coast), builds the buffer, verifies **landward deviation ≤ 15 m, ring simplicity, pairwise non-overlap and band width**, then writes `src/data/zones.ts` and `src/data/coastline.ts`.
3. `src/data/zones.test.ts` asserts the property that actually matters: **every point of the landward edge within 20 m of the real coastline**, plus simplicity and non-overlap — so the "jagged blade" or "floating offshore strip" regressions fail CI instead of waiting for a human to eyeball screenshots.

Where two strips face the same way they share one end-cap vertex exactly (`honda-inner`/`honda-outer` at `[9.893315, 118.748879]`). At the Sta. Lourdes wharf (E-facing meets N-facing), each zone retains its natural cap instead of forcing a shared one.

**Scoped pp-bay extension (2026-09-20):** pp-bay now rounds the apex on way `1529960721` and follows the opposite bank on `1529960722` only as far as node `368426821` (`9.7712302, 118.7161899`). This covers the previously omitted water at `9.7725, 118.7170`, approximately 88 m from the real shore. The banks' buffers meet inside the narrow inlet, so this is part of pp-bay, not an overlapping eighth zone. Irawan's polygon is unchanged; **the wider bay-mouth gap remains unfilled**. Regression tests check the entire added shoreline, water/land probes on both sides, non-overlap, and offshore exclusions.

Coastline sources: OSM API and Overpass (cache fetched 2026-09-20 by CI); the way ids behind each edge are listed in the header of `zones.ts`. Historical visual check renders live in `docs/coastline-shots/`.

Caveats worth knowing:

- Thin water-side structures (the Sta. Lourdes pier complex, fish-pen fringes off Bancao-Bancao and Sabang) are bridged at their foot: the landward edge stays within 20 m of the real coastline but does not thread around every piling. They mark an area, not a precise boundary line.
- Because the bands hug the shore, the Honda Bay islands — Cowrie, Cañon, Luli, Starfish and the rest — fall **outside** them, in open bay water. A report about an island trip belongs to the zone the boat left from.
- The mangrove creek complex at the head of Honda Bay (way `1530271757`) is deliberately **not** traced: it doubles back on itself through the mangroves, and following it is what produced the earlier jagged, self-intersecting polygons. The `honda-outer` band stops just short of its mouth.
- `binuatan` is a legacy id: there is no coastal place called Binuatan (the only Binuatan in the Philippines is a weaving centre in Barangay Santa Monica, inside the city). That polygon covers the real northeast-coast water off the Marayugon and Babuyan barangays.

> **Provenance note:** these polygons have been redrawn three times, and the first two revisions both over-corrected. An early revision placed them by offset from the coastline with the vertices deliberately kept clear of the mapped shore, which put the shapes out in open water. The fix for that pasted raw coastline traces straight into the polygons, leaving every zone jagged and self-intersecting. The third revision (2026-09-18) was accurate at six shore corners per zone but too sparse: the straight chords either cut across land in zigzags or floated in a gap offshore, depending on which side of the real coastline the sparse corners landed. The current bands (2026-09-19) are generated end-to-end by `scripts/generate-zones.ts` with the landward-edge tolerance asserted by test — do not hand-place vertices; run `npx tsx scripts/generate-zones.ts --check` and `npm test` before committing any geometry change.

Before this is used for real public-health decisions, replace them with the actual boundaries from BFAR or the Puerto Princesa City LGU.

**If you edit the polygons:** an existing Firestore project keeps stored definitions until a reviewed migration updates them. Preview changes and preserve existing warning statuses; the current public rules restrict updates to status/timestamp fields. Do not use force-seeding as an automatic deployment step. In sample mode, the scoped reset in §3 re-seeds from the file and discards local rehearsal records.

---

## 11. Shipping channel overlay (PPTSS)

A toggleable **navigation-hazard layer** under the advisory zones: the boundary lines of the **Puerto Princesa Traffic Separation Scheme** — the official PCG shipping lanes for the port approach, which the pp-bay advisory waters sit right next to. Small craft (under 20 m), sailing vessels and fishing boats are directed by the circular's own rules to stay inshore of these lines and, if they must cross, to cross at right angles — exactly the audience drifting while gleaning.

**Sourcing (honest):** OpenStreetMap has **no** shipping-lane data for this area — a dedicated Overpass sweep (2026-09-19, `scripts/fetch-seamarks.mjs` + CI, raw result in `scripts/seamark-cache/osm-seamarks.json`) found only 5 seamark-tagged objects in the whole bay region (three lighthouses, a pier, a coast guard station) and nothing route-related anywhere near Palawan. So nothing here comes from OSM. Every coordinate in `src/data/shipping.ts` is transcribed verbatim from the Philippine Coast Guard's circular — *"Puerto Princesa Traffic Separation Scheme (PPTSS)"*, MC of 06 June 2017 (rescinds MC 02-15 of 2015), boundaries per NAMRIA Chart Nr. 4333 — retrieved via the Internet Archive after the live coastguard.gov.ph PDF proved unreachable. It is an **unofficial transcription of an official document**, not a chart digitisation: the in-app tooltip and `src/data/shipping.test.ts` both carry the source and that caveat (the test also asserts the circular's stated geometry — 60 m separation zone, 400 m lanes, 292°T in / 112°T out — so a transcription typo fails CI).

**Rendering:** dashed **blue** lines with a white casing (`src/components/ShippingLayer.tsx`) — deliberately unlike the green/yellow/red advisory palette; lines, never fills; hazards (submerged wreck, Gideon Shoal buoy, fairway buoy) as blue dots. Tap/hover says "Shipping channel — do not cross" plus a one-line note per feature and the transcription disclaimer. The layer is **off by default** (ship icon in the header toggles it — `useState` in `MapPage`, not the store) and draws *under* the zone polygons, so it never competes with advisory status. Because the toggle is icon-only, first-time visitors get a one-time auto-dismissing hint bubble under it (`red-tide-ppc:hint:shipping:v1` in localStorage — "Got it" button, 9 s timeout, dismissed for good once tapped; quiet if storage is unavailable). It is **not seeded into Firestore** — static reference data, nothing admins approve or reject. A static verification render (zones + coastline + overlay) lives at `docs/shipping-overlay-shots/pptss-overlay.png`.

**If the PCG/PPA publishes a revised scheme or a chart digitisation:** update the coordinates and `sourceDms` in `src/data/shipping.ts`; the tests verify the stated geometry. If this is ever used for anything beyond a visual aid, verify against NAMRIA Chart Nr. 4333 first.

---

## 12. Explicitly out of scope for this MVP

- **Administrator accounts require manual Firebase setup**: Google provider, an explicitly approved UID/admin claim and deployed rules. Sample mode still uses a public demo lock.
- **No push notifications** and no SMS/route-based alerts.
- **No BFAR API integration or scraping** — status is entered by a human admin.
- **No automatic expiry or decay** of zone status; reverting to `safe` is a deliberate admin action.
- **No measured per-report coordinates** — reports belong to a zone and pins use its centroid. A browser location dot is available when permission is granted; native Android location-plugin/permission behavior is not verified.
- **No moderation history or audit trail** beyond the report's final status.

---

## 13. What to fix before real use

1. **Activate and verify Firebase administrator authorization** using [the rollout checklist](docs/admin-auth.md). The frontend and emulator tests do not prove production Auth/rules configuration.
2. **Preserve restricted Firestore writes**: zone provisioning requires trusted tooling; do not restore public zone creation.
3. **Add rate limiting / basic spam control** on report creation — right now anyone can flood the queue.
4. **Add an accountable moderation history:** the Firebase update writes `reviewedAt`, but the public report model and sample backend do not supply a reviewer identity or complete audit trail.
5. **Replace the polygons** with real boundaries (see §10).
6. **Compress or resize Firebase/Cloudinary uploads** with a tested fallback. Only the sample backend currently downscales images; the real uploader receives the original file.

Open presentation work is tracked in [#33](https://github.com/franshessss2/red-tide-ppc/issues/33), [#37](https://github.com/franshessss2/red-tide-ppc/issues/37), [#38](https://github.com/franshessss2/red-tide-ppc/issues/38), [#49](https://github.com/franshessss2/red-tide-ppc/issues/49), [#65](https://github.com/franshessss2/red-tide-ppc/issues/65), [#66](https://github.com/franshessss2/red-tide-ppc/issues/66), [#68](https://github.com/franshessss2/red-tide-ppc/issues/68), [#79](https://github.com/franshessss2/red-tide-ppc/issues/79) and [#80](https://github.com/franshessss2/red-tide-ppc/issues/80). Production security and privacy work remains deferred; closing or refreshing documentation does not complete those controls.

---

## 14. Tests

```bash
npm run typecheck
npm test
npm run build
```

On **12 October 2026**, main `401d358` (merge of #99) passed **518 tests in 62 files**, with a **44.13s** test phase: [CI run 38224998593](https://github.com/franshessss2/red-tide-ppc/actions/runs/38224998593). This is a dated result, not an automatically updated counter. No root `lint` script is defined.

Coverage includes:

- Opening-film/reel lifecycle, first-visit storage, replay, hidden-tab timing, reduced motion and focus/scroll cleanup.
- Landing geometry/motion guards, sample-data/source labels and the QR dialog's accessibility and lazy QR load.
- Map polygons, desktop drawers, mobile panel, street-map dialog, report form, admin workflow and submit → approve → community warning behavior.
- Backend selection, Firebase configuration completeness/build guard, Cloudinary request shape and Firestore value/seed mapping.
- Zone/coastline geometry, shipping transcription and isolated synthetic-device API/storage behavior.
- Team readiness against the **real disabled roster**, empty-field rendering and one-decoder clip policy. Synthetic members are confined to test inputs.

The CI workflow runs typecheck, **plain `npm test`**, trusted administrator-tool tests, build and a separate redacted full-history Gitleaks scan on main pushes and pull requests. Gitleaks is version/digest-pinned and uses the existing single test-fixture fingerprint in `.gitleaksignore`. Mapping/mocked backend tests are **not** Firestore Rules emulator authorization tests; those run separately with `npm run test:rules` in CI against a local demo project.

### Browser and device evidence

Scripts in `scripts/` and write-ups in `docs/` record specific builds, viewports, request interception and motion settings. Older drawer/intro scripts may target earlier layouts; read their header and scope before using them as a current acceptance test. Tile-blocked or locally mocked browser checks establish only the UI behavior they exercised, not live backend behavior, external tile rendering or physical-device performance.

The existing `.github/workflows/team-roster-shots.yml` capture workflow and `scripts/team-roster-shots.mjs` provide Team measurements. [PR #97](https://github.com/franshessss2/red-tide-ppc/pull/97) records the landing before/after capture and its temporary CI verification; those temporary capture files are not part of main. Review the configuration and dated artifacts before interpreting results. Capture helpers are not production enable paths.

From `android-app/android`, run `gradlew.bat :app:connectedDebugAndroidTest` with an actual connected device (Unix: `./gradlew`). This covers Android Back and the native safe viewport. The test APK compiling is not proof that those tests executed. Physical-phone gestures, software keyboards, GPU smoothness, complete tile behavior and combined-board electrical behavior still require recorded manual checks.

---

## 15. Making common changes

| I want to… | Touch this |
| --- | --- |
| **Add or edit a zone** | `src/data/zones.ts`; verify geometry (§10). Preview any Firebase migration and preserve existing statuses. For disposable sample data, use the scoped reset (§3). |
| **Re-shape a zone polygon** | Don't hand-edit coordinates — adjust the anchors/width in `scripts/generate-zones.ts`, re-fetch the coast if needed (see §10), then run `npx tsx scripts/generate-zones.ts` to rewrite `src/data/zones.ts` + `src/data/coastline.ts`. `name` values are asserted verbatim by `src/App.test.tsx`, so change them there too; `description` is free text. Run `npm test` afterwards — `zones.test.ts` asserts the 20 m landward-edge tolerance, self-intersection freedom and non-overlap. |
| **Replace the polygons with real boundaries** | Same file. `polygon` accepts `[lat, lng]` pairs; the mapper also tolerates `{latitude, longitude}` GeoPoints entered in the console. |
| **Change a status colour** | `src/lib/status.ts` (`hex` is what Leaflet draws) **and** the `@theme` block in `src/index.css` — they are duplicated on purpose and must be kept in sync. |
| **Change the advisory wording** | `guidance` in `src/lib/status.ts`; the long explainer is in `src/pages/MapPage.tsx`. |
| **Change report validation limits** | `MIN/MAX_DESCRIPTION_LENGTH` in `src/store.ts`; the 2000-character cap is mirrored in `firestore.rules`. |
| **Change the photo size limit** | `MAX_PHOTO_BYTES` in `src/lib/image.ts`; mirror the limit in the Cloudinary unsigned upload preset. |
| **Tighten security** | Update `firestore.rules` and the Cloudinary unsigned preset restrictions. Firebase mode now uses Google Auth and admin claims; follow `docs/admin-auth.md` before live activation. |
| **Add a new admin action** | Add the action to `src/store.ts` (all datastore calls live there) and call it from `src/pages/Admin.tsx`. |
| **Adjust a drawer's snap feel** | `src/motion/sidePanelAnchors.ts` (projection time, flick velocity, spring constants) — pure and unit-tested, change here before touching `ZoneDrawer.tsx` / `AdvisoryDrawer.tsx`. |
| **Adjust map zone/camera animation timing** | `src/motion/mapMotion.ts` (stagger, flight duration, focus padding), then `src/styles/map-motion.css`. |
| **Adjust the route transition feel** | `src/motion/RouteTransition.tsx` (variants, durations) — re-run `scripts/route-transition-pass.mjs` after any change. |
| **Adjust the intro timing or look** | `src/components/SplashScreen.tsx`, `src/components/intro/reelScenes.ts`, `src/styles/showroom.css` and the intro illustration styles. The opening film is separate; see the film/reel guides. Legacy `tide-intro.css` and `introHold`/`introExit` tokens do not define the active reel clock. |
| **Fill the Team roster** | `src/data/team.ts`: fill all three names, roles, initials, `posterSrc` and `videoSrc`; supply real files in `public/media/team/`; clear each real entry's `placeholder`, remove replaced paths from `TEAM_PLACEHOLDER_ASSETS`, then set `TEAM_SECTION_ENABLED=true`. Run the real-roster gate and media checks before enabling. |
| **Publish a new Android build** | Build root `dist/`, sync/verify it in `android-app/`, rebuild and test the APK. Upload and verify it in the existing shared folder, then remove older APKs. Keep the folder URL stable for the QR. |

---

## 16. Recent UI work

These are merged changes on main as of **13 October 2026**, not claims of physical-device acceptance:

- **Film and nine-chapter reel:** full opening film before each sequence; persistent observation/review illustration, shared chapter clock, 450ms crossfades, 650ms landing exit and a 120ms reduced-motion exit. The reel loop is 38.25 seconds, excluding the film. First-visit state uses `red-tide-ppc:intro:v3`; the film does not loop. See [Film](docs/opening-video.md), [Reel](docs/reel-intro.md) and [Archived intro](docs/intro-archive.md).
- **#92:** empty Team cards and media guards, retained behind the OFF flag. No placeholder people are shown to visitors.
- **#96:** opt-in Firebase build guard; missing configuration still selects sample mode when the guard is unset.
- **#97:** reserved landing geometry/font fallback metrics, restrained amber shader rims, steadier dark overview surface and one coordinated hero entrance timeline. Landing reduced-motion/Save-Data guards are scoped so the opening film/reel retains its behavior.
- **#98:** Android debug packaging, landing QR dialog, public sample-mode admin passcode and maintenance workflows restricted to main pushes.
- **#99:** native system-bar/cutout/keyboard viewport reservation. Build/lint/signature checks passed; actual phone behavior remains pending.

The existing coastal map motion and desktop drawers remain, with the compact mobile panel below 768px and the separate street-map dialog. Historical screenshots and docs are evidence for their recorded versions; they do not replace current phone tests.

---

## 17. Stack

React 19 · TypeScript 5.9 · Vite 8 · React Router 7 · Zustand 5 · Motion 13 · Tailwind CSS 4 · Leaflet + react-leaflet 5 · ogl 1 (hero WebGL) · Firebase 12 (Firestore + Auth) · Cloudinary (photo uploads) · Vitest 5

**Not a medical or food-safety authority.** If someone shows symptoms of PSP after eating shellfish, treat it as an emergency and get them to a hospital immediately.

---

## 18. Running costs and external services

No current account bill, free-tier guarantee or production usage budget was verified in this README. Check the actual account and provider limits before relying on an estimate:

| Service | Used for | Current provider reference |
| --- | --- | --- |
| Vercel | Production web hosting and optional device function | [Plans](https://vercel.com/pricing) |
| Firebase Firestore | Configured community records; unused for sample-mode records | [Quotas](https://firebase.google.com/docs/firestore/quotas), [Pricing](https://firebase.google.com/docs/firestore/pricing) |
| Cloudinary | Configured photo uploads; sample photos stay browser-local | [Plans](https://cloudinary.com/pricing) |
| Upstash | Optional synthetic-device storage | [Redis pricing](https://upstash.com/pricing/redis) |
| Google Drive | Shared testing-APK distribution | Account storage and sharing limits |
| Map tile providers | Online basemap requests even in sample mode | [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) |

OSM's standard tile service has a usage policy, not unlimited hosting capacity; bulk/offline tile downloading is prohibited there. The Android package does not add an offline tile cache. Use a provider that permits the intended usage rather than assuming a community prototype is exempt. `npm run build` asset-size reports are not a measurement of full-page network transfer or provider billing.
