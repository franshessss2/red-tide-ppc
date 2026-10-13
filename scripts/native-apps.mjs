import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export function releaseVersion(buildNumber) {
  const code = Number(buildNumber)
  assert.ok(Number.isSafeInteger(code) && code > 1 && code <= 2100000000,
    'Native build number must be an integer from 2 to 2100000000.')
  return { version: `0.2.0-alpha.${code}`, versionCode: code }
}

export function nativeEnvironment(environment, passcode) {
  const cleaned = Object.fromEntries(Object.entries(environment).filter(([key]) => !key.startsWith('VITE_')))
  return { ...cleaned, VITE_USE_DEMO_BACKEND: 'true', VITE_ADMIN_PASSCODE: passcode }
}

export async function currentPasscode(root) {
  const source = await readFile(join(root, 'src/lib/demoAdminPasscode.ts'), 'utf8')
  const match = source.match(/export const DEMO_ADMIN_PASSCODE = '([^'\r\n]+)'/)
  assert.ok(match?.[1]?.trim(), 'The shared prototype passcode must be configured.')
  assert.equal(match[1], match[1].trim(), 'The shared prototype passcode must not contain surrounding spaces.')
  return match[1]
}

export async function setNativeVersions(root, number) {
  const release = releaseVersion(number)
  const filename = join(root, 'android-app/android/app/build.gradle')
  const source = await readFile(filename, 'utf8')
  assert.equal((source.match(/versionCode \d+/g) || []).length, 1)
  assert.equal((source.match(/versionName "[^"]+"/g) || []).length, 1)
  assert.ok(release.versionCode >= Number(source.match(/versionCode (\d+)/)[1]),
    'Refusing to lower the Android version code. Build current main with full history.')
  for (const folder of ['android-app', 'desktop-app']) {
    for (const file of ['package.json', 'package-lock.json']) {
      const filename = join(root, folder, file)
      const source = await readFile(filename, 'utf8')
      const data = JSON.parse(source)
      const old = data.version
      const next = source.replace(`"version": "${old}"`, `"version": "${release.version}"`)
      const updated = file === 'package-lock.json'
        ? next.replace(`"version": "${data.packages[''].version}"`, `"version": "${release.version}"`) : next
      const checked = JSON.parse(updated)
      assert.equal(checked.version, release.version)
      if (file === 'package-lock.json') assert.equal(checked.packages[''].version, release.version)
      await writeFile(filename, updated)
    }
  }
  await writeFile(filename, source.replace(/versionCode \d+/, `versionCode ${release.versionCode}`)
    .replace(/versionName "[^"]+"/, `versionName "${release.version}"`))
  return release
}

export function assertUploadSize(bytes) {
  assert.ok(bytes > 0 && bytes <= 100 * 1024 * 1024,
    'Native download must fit the connected Drive uploader: maximum 100 MiB per file.')
}

export async function inventory(directory, prefix = '') {
  const files = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    assert.ok(!entry.isSymbolicLink(), 'Native assets must not contain links.')
    const relative = prefix + entry.name
    if (entry.isDirectory()) Object.assign(files, await inventory(join(directory, entry.name), relative + '/'))
    else if (entry.isFile()) {
      const bytes = await readFile(join(directory, entry.name))
      files[relative] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    } else throw new Error('Native assets must be regular files.')
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
}

export function assertSameAssets(expected, actual) {
  assert.deepEqual(actual, expected, 'Every native web asset must match the fresh root build; stale or extra assets are refused.')
}

export function assertAndroidAssets(expected, actual) {
  const web = { ...actual }
  // Capacitor 8 generates these empty compatibility files with no plugins.
  // Accept exactly those empty files; never waive checks on arbitrary extras.
  const emptyHash = createHash('sha256').update('').digest('hex')
  for (const file of ['cordova.js', 'cordova_plugins.js']) {
    if (!(file in expected) && file in web) {
      assert.deepEqual(web[file], { bytes: 0, sha256: emptyHash }, `Unexpected Capacitor bridge content: ${file}`)
      delete web[file]
    }
  }
  assertSameAssets(expected, web)
}
