import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { assertAndroidAssets, assertSameAssets, assertUploadSize, nativeEnvironment, releaseVersion, setNativeVersions } from './native-apps.mjs'

test('refuses invalid Android upgrade codes and versions both apps together', () => {
  for (const code of [0, 1, -1, 2.5, NaN, 'oops', 2100000001]) assert.throws(() => releaseVersion(code))
  assert.deepEqual(releaseVersion('394'), { version: '0.2.0-alpha.394', versionCode: 394 })
  assert.ok(releaseVersion(395).versionCode > releaseVersion(394).versionCode)
})

test('native alpha ignores stale ambient passcodes and service configuration', () => {
  const env = nativeEnvironment({ PATH: 'test-only-path', VITE_ADMIN_PASSCODE: 'old-test-only-passcode',
    VITE_FIREBASE_API_KEY: 'synthetic-test-only-key', VITE_REQUIRE_FIREBASE: 'true' }, 'test-current-passcode')
  assert.deepEqual(env, { PATH: 'test-only-path', VITE_ADMIN_PASSCODE: 'test-current-passcode', VITE_USE_DEMO_BACKEND: 'true' })
})

test('refuses stale, missing and extra native assets', () => {
  const fresh = { 'index.html': { bytes: 100, sha256: 'test-fresh' } }
  assert.doesNotThrow(() => assertSameAssets(fresh, structuredClone(fresh)))
  for (const native of [{}, { 'index.html': { bytes: 100, sha256: 'test-old' } },
    { ...fresh, 'old.js': { bytes: 5, sha256: 'test-old' } }]) {
    assert.throws(() => assertSameAssets(fresh, native))
  }
})

test('accepts only Capacitor generated empty compatibility scripts', () => {
  const fresh = { 'index.html': { bytes: 100, sha256: 'test-fresh' } }
  const empty = { bytes: 0, sha256: createHash('sha256').update('').digest('hex') }
  assert.doesNotThrow(() => assertAndroidAssets(fresh, { ...fresh, 'cordova.js': empty, 'cordova_plugins.js': empty }))
  assert.throws(() => assertAndroidAssets(fresh, { ...fresh, 'cordova.js': { bytes: 1, sha256: 'unexpected' } }))
  assert.throws(() => assertAndroidAssets(fresh, { ...fresh, 'unexpected.js': empty }))
})

test('rejects empty or oversized downloads before publishing', () => {
  assert.doesNotThrow(() => assertUploadSize(100 * 1024 * 1024))
  assert.throws(() => assertUploadSize(100 * 1024 * 1024 + 1))
  assert.throws(() => assertUploadSize(0))
})

test('updates both native manifests and locks without changing dependencies, refuses downgrade', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rtp-native-version-test-'))
  try {
    for (const folder of ['android-app', 'desktop-app']) {
      await mkdir(join(root, folder), { recursive: true })
      await writeFile(join(root, folder, 'package.json'), JSON.stringify({ version: '0.2.0-alpha.1', private: true,
        dependencies: { 'test-only-dependency': '1.0.0' } }, null, 2))
      await writeFile(join(root, folder, 'package-lock.json'), JSON.stringify({ version: '0.2.0-alpha.1',
        packages: { '': { version: '0.2.0-alpha.1' }, 'node_modules/test-only-dependency': { version: '1.0.0' } } }, null, 2))
    }
    const gradle = join(root, 'android-app/android/app/build.gradle')
    await mkdir(join(root, 'android-app/android/app'), { recursive: true })
    await writeFile(gradle, 'versionCode 1\nversionName "0.2.0-alpha.1"\n')
    await setNativeVersions(root, 394)
    for (const folder of ['android-app', 'desktop-app']) {
      const pkg = JSON.parse(await readFile(join(root, folder, 'package.json'), 'utf8'))
      const lock = JSON.parse(await readFile(join(root, folder, 'package-lock.json'), 'utf8'))
      assert.equal(pkg.version, '0.2.0-alpha.394')
      assert.equal(pkg.private, true)
      assert.deepEqual(pkg.dependencies, { 'test-only-dependency': '1.0.0' })
      assert.equal(lock.packages[''].version, pkg.version)
      assert.equal(lock.packages['node_modules/test-only-dependency'].version, '1.0.0')
    }
    const before = await readFile(join(root, 'android-app/package.json'), 'utf8')
    await assert.rejects(setNativeVersions(root, 393), /Refusing to lower/)
    assert.equal(await readFile(join(root, 'android-app/package.json'), 'utf8'), before)
  } finally {
    assert.equal(dirname(root), tmpdir())
    assert.ok(root.startsWith(join(tmpdir(), 'rtp-native-version-test-')))
    await rm(root, { recursive: true, force: true })
  }
})
