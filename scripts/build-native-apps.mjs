// Build both sample-data alphas together. No service credentials or .env files
// enter this web build. Existing installed apps still need the new installer.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertAndroidAssets, assertSameAssets, assertUploadSize, currentPasscode, inventory, nativeEnvironment, setNativeVersions } from './native-apps.mjs'
import { liveNativeEnvironment, readLiveConfiguration } from './native-live.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))
const target = process.argv[2] || 'all'
const live = process.argv.includes('--live')
const liveConfig = live ? await readLiveConfiguration(process.env.RTP_PUBLIC_CONFIG_URL) : null
assert.ok(['all', 'android', 'windows'].includes(target), 'Target must be all, android or windows.')
if (target !== 'android') assert.equal(process.platform, 'win32', 'Build the Windows app on Windows.')
const run = (binary, args, cwd = root, env = process.env) => execFileSync(binary, args,
  { cwd, env, stdio: 'inherit', windowsHide: true })
const node = (file, args = [], cwd = root) => run(process.execPath, [file, ...args], cwd)
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
const sourceCommit = git('rev-parse', 'HEAD')
// Full-history main grows with each code change; never reuse version code 1.
assert.equal(git('rev-parse', '--is-shallow-repository'), 'false', 'Fetch full history before versioning native builds.')
const number = git('rev-list', '--count', 'HEAD')
const passcode = await currentPasscode(root)
if (target !== 'windows') {
  assert.ok(process.env.JAVA_HOME && process.env.ANDROID_HOME,
    'Set JAVA_HOME and ANDROID_HOME to existing installations; this command does not install a JDK or SDK.')
  await readFile(join(process.env.ANDROID_HOME, 'platforms/android-36/android.jar'))
}
const release = await setNativeVersions(root, number)
const emptyEnv = await mkdtemp(join(tmpdir(), 'rtp-native-env-'))
const originalEnv = { ...process.env }
try {
  node(require.resolve('typescript/bin/tsc'), ['-b'])
  for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key]
  Object.assign(process.env, liveConfig ? liveNativeEnvironment(originalEnv, liveConfig.document) : nativeEnvironment(originalEnv, passcode))
  const { build } = await import('vite')
  await build({ root, envDir: emptyEnv })
} finally {
  for (const key of Object.keys(process.env)) if (key.startsWith('VITE_')) delete process.env[key]
  for (const [key, value] of Object.entries(originalEnv)) if (key.startsWith('VITE_')) process.env[key] = value
  assert.equal(dirname(emptyEnv), tmpdir())
  assert.ok(emptyEnv.startsWith(join(tmpdir(), 'rtp-native-env-')))
  await rm(emptyEnv, { recursive: true, force: true })
}
const web = await inventory(join(root, 'dist'))
const artifacts = []
if (target !== 'windows') {
  const android = join(root, 'android-app')
  const androidRequire = createRequire(join(android, 'package.json'))
  node(androidRequire.resolve('@capacitor/cli/bin/capacitor'), ['sync', 'android'], android)
  node(join(android, 'scripts/verify-sync.mjs'))
  assertAndroidAssets(web, await inventory(join(android, 'android/app/src/main/assets/public')))
  const project = join(android, 'android')
  const args = [':app:assembleDebug', ':app:lintDebug', ':app:assembleDebugAndroidTest', '--no-daemon']
  if (process.platform === 'win32') {
    run('cmd.exe', ['/d', '/s', '/c', 'gradlew.bat', ...args], project)
  } else run('./gradlew', args, project)
  artifacts.push(join(project, 'app/build/outputs/apk/debug/app-debug.apk'))
}
if (target !== 'android') {
  const desktop = join(root, 'desktop-app')
  node(join(desktop, 'scripts/sync.cjs'))
  assertSameAssets(web, await inventory(join(desktop, 'web')))
  node(join(desktop, 'scripts/package.cjs'), [], desktop)
  node(join(desktop, 'scripts/verify-package.cjs'), [], desktop)
  node(join(desktop, 'tests/packaged.cjs'), live ? [join(desktop, 'release/win-unpacked/RedTide ppc.exe'), '--live'] : [], desktop)
  artifacts.push(join(desktop, 'release', `RTP-${release.version}-windows-x64-setup.exe`))
}
if (target === 'all') node(join(root, 'scripts/test-android-bundle.mjs'), live ? ['--live'] : [])
const files = []
for (const file of artifacts) {
  const bytes = await readFile(file)
  assertUploadSize(bytes.length)
  files.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
}
const report = { ...release, sourceCommit, target, dataMode: live ? 'firebase' : 'sample',
  ...(liveConfig ? { projectId: liveConfig.document.firebase.projectId, configSource: liveConfig.source, configSha256: liveConfig.configSha256 }
    : { passcodeSource: 'src/lib/demoAdminPasscode.ts' }), webFiles: Object.keys(web).length,
  webSha256: createHash('sha256').update(JSON.stringify(web)).digest('hex'), artifacts: files }
const output = join(root, '.cache/native-apps')
await mkdir(output, { recursive: true })
await writeFile(join(output, `build-${target}.json`), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
