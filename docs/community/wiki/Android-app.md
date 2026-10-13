# Android app

The Android application is a **debug testing alpha**, named **Red Tide PPC**, with placeholder application ID `com.redtideppc.app`. It bundles the web build rather than loading the Vercel site remotely. No iOS build is included.

## Download and install

Use the [project's shared Android folder](https://drive.google.com/drive/folders/1mpUalyCgYrDXoN8L1KP7WVv11_p-VFSJ?usp=sharing), also reached by the landing page's QR control. The folder is intended to retain the newest APK as `RTP.apk`; its contents are managed separately from Git commits. [GitHub releases](https://github.com/franshessss2/red-tide-ppc/releases) may also contain Android artifacts—read the release notes to identify their source revision.

Download the APK on your Android phone and use Android's installer. This is outside Google Play and is debug-signed. The QR opens the folder, rather than forcing an installation or guaranteeing a successful download. Check the filename/version before installing a replacement. This documentation does not claim a new upload or a tested phone installation.

## Current behavior

- The PR #99 fix reserves status-bar, navigation-bar, display-cutout and keyboard insets around the WebView. It prevents the header from being placed under system bars by the native layout. Portrait/landscape and real-keyboard behavior still need a device check.
- Android Back follows web history; at the root it exits through Android's normal handling.
- The existing intro, map, QR control, sample labels and review flow remain part of the bundled site.
- The verified alpha used the sample-data fallback. Its local records are separate from browser and Windows records. Map tiles and configured network services need internet; no complete offline map is supplied.
- The bundled `/api/device-readings` server endpoint is not a local native service. Device/API configuration and browser USB compatibility have separate limits; see the packaging and device guides.

## Build

Use the existing JDK and Android SDK requirements in [android-app/README.md](https://github.com/franshessss2/red-tide-ppc/blob/main/android-app/README.md). From the repository root:

```powershell
npm ci
npm run build
Set-Location android-app
npm ci
npm run cap:sync
npm run verify:sync
Set-Location android
.\gradlew.bat :app:assembleDebug :app:lintDebug :app:assembleDebugAndroidTest
```

The output is `android-app/android/app/build/outputs/apk/debug/app-debug.apk`. The build does not install a missing JDK/SDK automatically. Hardware/emulator regression runs require an attached authorized device; build success alone is not device verification.

[Getting started](Getting-started.md) · [Troubleshooting](Contributing-and-troubleshooting.md)
