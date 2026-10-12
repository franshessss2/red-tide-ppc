import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const config = JSON.parse(await readFile(join(appDirectory, 'capacitor.config.json'), 'utf8'))
assert.equal(config.webDir, '../dist', 'Package the root build output')
assert.equal(config.server?.url, undefined, 'The alpha must bundle local assets')
assert.equal(config.server?.allowNavigation, undefined, 'Keep external origins out of the WebView')

const sourceDirectory = resolve(appDirectory, config.webDir)
const targetDirectory = join(appDirectory, 'android/app/src/main/assets/public')
await readFile(join(sourceDirectory, 'index.html'))
let verified = 0
async function verifyDirectory(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const source = join(directory, entry.name)
    if (entry.isDirectory()) {
      await verifyDirectory(source)
    } else {
      const target = join(targetDirectory, relative(sourceDirectory, source))
      const hash = bytes => createHash('sha256').update(bytes).digest('hex')
      assert.equal(hash(await readFile(target)), hash(await readFile(source)),
        `Outdated or modified Android web asset: ${relative(sourceDirectory, source)}`)
      verified++
    }
  }
}
await verifyDirectory(sourceDirectory)
console.log(`PASS: ${verified} root dist files match the synced Android assets byte for byte.`)
