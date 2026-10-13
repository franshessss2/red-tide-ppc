# RedTide ppc — RTP Windows alpha

Windows x64 desktop packaging of the existing Red Tide PPC school community-record prototype. App, installer, window, Start menu and shortcuts use **RedTide ppc**; **RTP** is the short name. The current version is in `package.json`. This is a testing build, not an official BFAR advisory.

The wrapper bundles a byte-for-byte copy of the root `dist/` in a local `rtp://app/` origin. Website source, Firebase behavior, opening film, Android packaging and deployment settings are unchanged. `com.redtideppc.desktop` is a placeholder application ID; settle it before a stable release because it identifies the installed app.

## Build on Windows

For a fresh Windows installer and Android APK together, use the root
`npm run apps:build` command and [shared release checklist](../docs/native-app-updates.md).
It always rebuilds the web code and uses the current shared prototype passcode.

Use Windows x64 and Node.js 22.12 or newer. Run these commands from the repository root:

```powershell
npm ci
npm run build
Set-Location desktop-app
npm ci
npm run setup:runtime
npm run sync
npm test
npm run test:smoke
npm run dist:win
npm run verify:package
npm run test:packaged
```

`setup:runtime` explicitly downloads the pinned Electron runtime. `dist:win` downloads app-scoped packaging tools and produces `release/RTP-<version>-windows-x64-setup.exe`; it does not publish or consume ambient signing credentials. Full installer compression and English/Filipino Electron locale packs keep it within the connected Drive uploader's 100 MiB limit; differential-update packaging is disabled because this alpha has no updater. `pack` creates the unpacked app instead. `start` runs the synced app locally. `icons` regenerates the tracked PNG/ICO from the existing `public/favicon.svg`; no new artwork is needed. A stale or missing `web/` fails the packaging verification: rebuild the root app and run `sync` first.

Only `desktop-app/` is tracked by this change. Generated web files, installers, dependency folders, tool caches and screenshots are ignored. Build tools and tests are excluded from the installed ASAR; the root web build is a separate resource directory so MP4 byte-range loading works.

## What works and what needs a connection

- Native resizable window, app icon, per-user installation wizard, optional desktop/Start menu shortcuts, single-instance activation and F11 full screen. No administrator installation is required. The installer does not launch the film automatically on completion.
- Home, map, admin, Android QR download dialog, device rehearsal and Arduino pages use the existing web UI. The RTP menu provides route shortcuts; native download handling saves the Arduino sketch.
- The app keeps its own persistent browser storage under Electron's `userData` directory, normally `%APPDATA%/RedTide ppc`. It does not share records or cookies with the website, Android or Helium. Uninstall retains that data. For isolated tests, `--user-data-dir=<absolute-directory>` changes only the storage location.
- The default build falls back to local sample records when Firebase variables are absent. Existing **Sample data** labels remain visible. Local shell, records and rehearsal can work without internet; map tiles, official bulletin links, uploads and any configured live backend require network access. This is not a complete offline map or a live advisory feed.
- The bundled app has no Vercel server functions. `/api/*` returns an explicit unconfigured JSON response; connected device readings need the hosted site. Local device rehearsal remains available. No proxy, backend environment changes or embedded server credentials are added.
- Arduino Web Serial is available only on the bundled Arduino pages. Selecting a port always opens a native consent dialog, including when only one port exists. **Connect** grants only the selected device; **Next port** cycles the list; **Cancel** is the default. Unplugging, permission revocation, navigation and restart clear wrapper grants. The web UI's Disconnect button closes the connection. Physical USB communication and board-driver behavior still need a real-board test.
- Camera, microphone, location, HID, generic USB and other permissions are denied in this alpha. The map's location permission feature therefore does not work; manual map navigation is available.

## Desktop boundary

The renderer has no Node access or preload bridge. Context isolation, sandboxing and web security are enabled. Local assets receive a CSP without remote scripts or `unsafe-eval`; inline styles are allowed for the existing map/animation styles. Paths are confined to bundled files and known SPA routes. HTTPS data/image connections are permitted for the existing configured services; this does not restrict the app to offline networking.

New windows are denied. Approved HTTPS bulletin, GitHub, Drive, OpenStreetMap, Wokwi, CARTO, MapLibre and Cloudinary links open through the system browser; other domains and OS URL protocols are refused. The system-browser launch itself has not been exercised by automation. There is no automatic updater or telemetry added by the wrapper.

See [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [custom protocols](https://www.electronjs.org/docs/latest/api/protocol) and [device permissions](https://www.electronjs.org/docs/latest/tutorial/devices).

## Dependencies

| Direct dependency | Pinned version | Why |
| --- | --- | --- |
| `electron` | `44.7.0` | Windows runtime, sandboxed Chromium, native window/menu and explicit serial consent. |
| `electron-builder` | `26.15.3` | Windows x64 NSIS installer, icons, resource packaging and executable metadata. |

Both are development dependencies in this isolated package. Builder/downloader npm modules are not shipped in the ASAR; the Electron runtime is shipped. Smoke tests reuse the root's existing Playwright dependency, without adding a desktop Playwright dependency. Keep the existing bundled font and Electron/Chromium license files with the distribution.

## Validation recorded on 2026-10-13

- Root typecheck and build: **PASS**. Plain `npm test` before and after this change: **516 passed, 2 failed** in 62 files, about 22 seconds each. Both failures are existing 5-second integration timeouts: `src/App.test.tsx:183` (report/approve loop) and `src/pages/mapPass.test.tsx:226` (six-item report/approve flow). No test flags, assertions or root timeout settings changed.
- Desktop Node tests: **7/7 PASS**. Cover protocol confinement, route handling, video ranges/HEAD, CSP, external URL policy and explicit serial selection/cancellation/revocation.
- Real Electron smoke: **PASS**, isolated temporary profile. All main routes rendered, QR decoded, the film's metadata reported 18.6 seconds at 1920×1080, and storage survived a real process restart. Reduced-motion screenshots at 390 and 1280 widths were inspected. External map tiles were blocked in this harness; no live-data or physical-board claim is made.
- Packaged executable: **PASS**. Actual packaged entrypoint reports the correct name/version, secure origin, no renderer `require`, visible sample label, and loads map HTML, film ranges, QR and sketch.
- Installer: **PASS** in an isolated installation path on this Windows laptop. Install, installed-executable smoke test, exact comparison of all 51 installed web files, and uninstall completed. Temporary test shortcuts and uninstall entry were removed. This is not a clean-Windows-machine compatibility test.
- `npm audit`: desktop has **0 high / 0 critical**, with 8 moderate findings in the development builder/downloader chain. The root install reports 5 existing high findings; root dependencies are unchanged. No audit overrides or ignore entries were added.

The installer and app executable are **unsigned**; Windows may show an unknown publisher or SmartScreen warning. Signing, SmartScreen reputation, clean-machine behavior, full visible-film timing, real GPU smoothness, online map tiles, Firebase login/write paths, native system-browser launch and actual Arduino I/O remain **UNVERIFIED**. Hidden/offscreen Chromium checks do not establish GPU performance. No macOS, Linux, iOS, production deployment or store submission is included.

Releases should be marked **prerelease**, include the installer SHA-256, and describe these limits. Run `verify:package` after every rebuild to print the current hash; installer hashes can change between builds. Do not attach a Windows alpha to the stable website release or mark its PR ready automatically.
