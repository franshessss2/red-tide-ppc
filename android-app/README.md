# Red Tide PPC Android alpha

Android-only Capacitor packaging of the root production build. The app name is
**Red Tide PPC** and the application ID is **`com.redtideppc.app` (placeholder)**.
The native version is `0.2.0-alpha.1`, version code `1`. Finalize the ID before
registering a store listing or configuring app-specific services.

The wrapper bundles `../dist`; it does not load the Vercel site remotely.
All repository changes for this alpha are confined to `android-app/`.
The existing web routes, intro, animations, Team flag, data selection and backend
behavior are preserved. No iOS project, native Firebase configuration, Vercel
configuration or production signing key is included.

## Dependencies

These are the only npm dependencies added, all pinned to `8.5.2`:

| Dependency | Reason |
| --- | --- |
| `@capacitor/core` | Capacitor runtime and bridge, including the bundled SystemBars API. |
| `@capacitor/android` | Native Android runtime and project template. |
| `@capacitor/cli` (development) | Generate, sync and open the Android project. |

The lockfile pins transitive npm packages. `npm audit` on 2026-10-12 reported
zero high/critical and three moderate findings in the development CLI chain
(`@capacitor/cli` → `xcode` → `uuid`). Those packages are not copied into the
web assets. No dependency override or advisory suppression was added.

The Android template also uses AndroidX, Cordova's compatibility runtime and
JUnit/Android test libraries, with versions in `android/variables.gradle`.
The Android Gradle Plugin is `8.13.0`; Gradle is `9.3.1`, pinned with the
official distribution SHA-256 in `android/gradle/wrapper/gradle-wrapper.properties`.

## Build and install a debug alpha

Prerequisites: the root web dependencies, Node 22 or later, a JDK capable of
compiling Java 21, Android SDK platform 36, and Android Build Tools 36.0.0.
The existing Android Studio bundled JDK 25.0.3 was used for local verification.
No JDK or SDK was installed. SDK auto-download is disabled; missing components
must be supplied deliberately rather than installed by a Gradle build.

From the repository root:

```powershell
npm run build
cd android-app
npm ci
npm run cap:sync
npm run verify:sync
npm run cap:open
```

`cap:sync` copies the root build into the gitignored
`android/app/src/main/assets/public` and updates Capacitor's generated files.
`verify:sync` fails if any root build file is missing or differs in those assets.
`cap:open` opens Android Studio only when explicitly run.

To build without opening Android Studio, set `JAVA_HOME` and `ANDROID_HOME` to
your existing installations, then run from `android-app/android`:

```powershell
.\gradlew.bat :app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest
```

On macOS/Linux, use `./gradlew` for the same Android tasks.
The installable output is `app/build/outputs/apk/debug/app-debug.apk`.
It is debug-signed, not a Play Store release. APKs, web assets, build outputs,
local SDK paths, dependencies and keystores are gitignored.

With a connected, authorized Android phone (or running emulator), install using
your SDK's `adb install -r <path-to-app-debug.apk>`.
Run the native Back regression test with:

```powershell
.\gradlew.bat :app:connectedDebugAndroidTest
```

The test uses the packaged WebView to navigate through SPA history, presses
Android Back to return to the root, then verifies a second Back exits normally.
There is no shipped test hook or additional plugin for this behavior.

## Alpha behavior and limits

- Android Back traverses WebView history; at the root it delegates to Android.
- The wrapper uses a dark WebView/launch background and light system bar icons.
  Its native icon reuses the existing `public/favicon.svg` design as a vector.
- Keyboard resize is requested in the native manifest; actual keyboard and
  system inset behavior still require a device run.
- This build has no Firebase environment configuration and uses the existing
  sample-data fallback. The existing **Sample data** label remains. Reports in
  this mode are demonstrations; they are not sent to a live moderation service.
- Bundling the UI does not provide offline map tiles or cached live advisories.
- `/api/*` endpoints have no server inside a local Capacitor bundle. The
  `/devices` dashboard needs an explicit hosted API strategy in a follow-up.
- Native location permissions/plugins, photo capture, external browser handling,
  live Firebase authentication, push notifications, real-phone performance and
  Play Store distribution are not verified by this alpha.

## Local verification — 2026-10-12

Base: main `f36bc7a8a59753ec5f1515c4f7bfa2a3d3a48d66`.
The root commands were recorded before adding packaging, then repeated.

| Root command | Baseline | After packaging |
| --- | --- | --- |
| `npm run build` | PASS, 4.34s | PASS, 3.13s |
| `npm run lint` | FAIL: no root lint script | Same missing script |
| plain `npm test` | 496 passed, 1 failed; 1 suite failed to load | 495 passed, 2 failed; same suite failed to load |
| `npm run typecheck` | Not run before packaging | PASS, 4.92s |

Both test runs encountered Vite denying a map worker path through the reused
dependency junction, preventing three tests from loading. Both timed out in
`src/App.test.tsx` at the existing 5000ms limit. The second run additionally
timed out in `src/pages/mapPass.test.tsx`. Exit statuses match, but the failed
test count does not; no root test, assertion, timeout or configuration changed.
The clean CI result is reported on the PR separately.

VERIFIED locally: Capacitor sync, matching synced asset bytes, debug APK and
instrumentation APK compilation, Android lint, APK signature and identity,
and a desktop Chromium smoke test serving extracted APK assets (landing,
map route, browser history, sample label, and landing with external requests
blocked). Browser checks are not native Android runtime checks.

UNVERIFIED: the instrumentation test and native/device behavior. No phone was
connected. The installed emulator reported a missing acceleration driver; a
fresh isolated software-mode emulator remained offline and was stopped.
The user's existing Pixel AVD was not used or wiped. No hypervisor, JDK or SDK
was installed, and no Windows virtualization setting was changed.

References: [Capacitor Android](https://capacitorjs.com/docs/android),
[Capacitor workflow](https://capacitorjs.com/docs/basics/workflow),
[SystemBars](https://capacitorjs.com/docs/apis/system-bars),
[Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html).
