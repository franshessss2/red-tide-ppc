const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
const { createHash } = require('node:crypto')
const asar = require('@electron/asar') // Already supplied by electron-builder.
const { inventory } = require('./sync.cjs')
const root = path.resolve(__dirname, '..')

async function run() {
  const archive = path.join(root, 'release', 'win-unpacked', 'resources', 'app.asar')
  const expected = await inventory(path.join(root, 'web'))
  const actual = await inventory(path.join(root, 'release', 'win-unpacked', 'resources', 'web'))
  assert.deepEqual(actual, expected, 'Packaged web assets must match the synced build exactly')
  const listed = asar.listPackage(archive).map(file => file.replaceAll('\\', '/'))
  for (const forbidden of ['/tests/', '/scripts/', '/node_modules/', '/.env']) assert.ok(!listed.some(file => file.includes(forbidden)), `Excluded package path: ${forbidden}`)
  const files = ['main.cjs', 'src/app.cjs', 'src/assets.cjs', 'src/permissions.cjs', 'src/policy.cjs', 'resources/icon.png', 'resources/icon.ico']
  for (const file of files) assert.deepEqual(asar.extractFile(archive, file), await fs.readFile(path.join(root, file)), `Packaged source mismatch: ${file}`)
  for (const file of files) {
    const text = asar.extractFile(archive, file).toString()
    for (const fixture of ['rtp-test-only-persistence', 'synthetic-persistent-value', 'TEST-COM-A', 'synthetic-a']) assert.ok(!text.includes(fixture), `Fixture leaked into ${file}`)
  }
  const pkg = JSON.parse(asar.extractFile(archive, 'package.json'))
  assert.equal(pkg.productName, 'RedTide ppc')
  console.log(`Verified packaged ASAR source and ${Object.keys(actual).length} web files; no tests, fixtures, build tools or env files packaged.`)
  const filename = `RTP-${pkg.version}-windows-x64-setup.exe`
  const bytes = await fs.readFile(path.join(root, 'release', filename))
  console.log(JSON.stringify({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }))
}
run().catch(error => { console.error(error.message); process.exitCode = 1 })
