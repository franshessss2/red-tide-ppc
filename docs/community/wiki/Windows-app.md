# Windows app — RedTide ppc (RTP)

The Windows x64 Electron testing alpha is named **RedTide ppc**, short name **RTP**. Version `0.2.0-alpha.1`, placeholder application ID `com.redtideppc.desktop`. Packaging was merged in PR #102.

## Availability

An unsigned NSIS installer was built and install/launch/uninstall tested locally on the development laptop. It is **not yet published as a Windows GitHub release asset**. Do not assume a website release contains an installer. When one is published, use the matching release's download and SHA-256; do not use temporary GitHub asset redirect URLs as permanent links.

The expected installer filename is `RTP-0.2.0-alpha.1-windows-x64-setup.exe`. It provides a per-user installation wizard, app icon and optional desktop/Start menu shortcuts. The unsigned alpha can show Windows publisher/SmartScreen warnings. Clean-machine compatibility and SmartScreen reputation remain unverified.

## Features and boundaries

- Home, map, admin, Android QR, Arduino pages and local device rehearsal are bundled in a native resizable window.
- The **RTP** menu opens app pages; **View** supports zoom and F11 full screen. A second app instance activates the existing window.
- Storage is separate from the website, Android and Helium. Uninstall retains local app data. The default alpha still shows existing **Sample data** labels.
- Map tiles, official bulletin links and configured live services need internet. The desktop bundle has no Vercel API server, so connected device readings need the hosted website; local rehearsal is available.
- Arduino serial requests require explicit native port selection, even with one board. Physical board communication remains unverified.
- Camera, mic, location, HID and generic USB are denied in this alpha. Manual map navigation is available.
- The renderer has no Node bridge. Approved HTTPS external links are handed to the system browser. Real system-browser launches and visible GPU smoothness have not been verified; hidden testing logged GPU errors during shutdown.

## Build on Windows

With Node.js 22.12 or newer, from the repository root:

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

The installer is in `desktop-app/release/`; `verify:package` prints the current SHA-256 and verifies bundled web files and wrapper source. `setup:runtime` downloads Electron; packaging downloads app-scoped builder tools. No macOS or Linux desktop target is configured.

See [desktop-app/README.md](https://github.com/franshessss2/red-tide-ppc/blob/main/desktop-app/README.md) for dependency reasons, persistent storage, security boundaries and measured testing limits.
