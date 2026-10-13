const { spawnSync } = require('node:child_process')
const path = require('node:path')
const root = path.resolve(__dirname, '..')

if (process.platform !== 'win32') {
  console.error('Build this Windows alpha on Windows. Other desktop targets are not configured.')
  process.exit(1)
}
const verify = spawnSync(process.execPath, [path.join(__dirname, 'sync.cjs'), '--verify'], { cwd: root, stdio: 'inherit', windowsHide: true })
if (verify.status !== 0) process.exit(verify.status || 1)
const env = { ...process.env, ELECTRON_BUILDER_CACHE: path.join(root, '.cache', 'electron-builder'), CSC_IDENTITY_AUTO_DISCOVERY: 'false' }
// This first alpha is unsigned. Do not accidentally consume a developer's
// ambient signing certificate/password or publish credentials.
for (const key of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD', 'CSC_NAME', 'GH_TOKEN', 'GITHUB_TOKEN']) delete env[key]
const args = [require.resolve('electron-builder/cli.js'), '--win', ...(process.argv.includes('--dir') ? ['--dir'] : ['nsis']), '--x64', '--publish', 'never']
const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true })
process.exitCode = result.status || (result.error ? 1 : 0)
