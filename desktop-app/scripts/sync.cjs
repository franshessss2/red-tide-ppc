const fs = require('node:fs/promises')
const path = require('node:path')
const { createHash } = require('node:crypto')
const root = path.resolve(__dirname, '..')
const source = path.resolve(root, '..', 'dist')
const destination = path.join(root, 'web')

async function inventory(directory, prefix = '') {
  const files = {}
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('Web builds must not contain symbolic links.')
    const relative = prefix + entry.name
    if (entry.isDirectory()) Object.assign(files, await inventory(path.join(directory, entry.name), relative + '/'))
    else if (entry.isFile()) {
      const bytes = await fs.readFile(path.join(directory, entry.name))
      files[relative] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    } else throw new Error('Web builds must contain regular files only.')
  }
  return files
}

async function run() {
  await fs.access(path.join(source, 'index.html')).catch(() => { throw new Error('Root dist/index.html is missing. Run npm run build in the repository root first.') })
  const expected = await inventory(source)
  const stat = await fs.lstat(destination).catch(error => { if (error.code === 'ENOENT') return null; throw error })
  if (stat?.isSymbolicLink() || (stat && !stat.isDirectory())) throw new Error('desktop-app/web must be a real directory, not a link or file.')
  if (!process.argv.includes('--verify')) {
    // This fixed, resolved generated directory is the only recursive-removal target.
    if (path.dirname(destination) !== root || path.basename(destination) !== 'web') throw new Error('Unsafe sync destination')
    await fs.rm(destination, { recursive: true, force: true })
    await fs.cp(source, destination, { recursive: true, dereference: false })
  }
  const actual = await inventory(destination)
  const paths = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
  for (const file of paths) {
    if (!expected[file] || !actual[file] || expected[file].sha256 !== actual[file].sha256) throw new Error(`Web sync mismatch: ${file}`)
  }
  console.log(`Verified ${paths.length} web files, byte for byte against ../dist (${Object.values(expected).reduce((sum, file) => sum + file.bytes, 0)} bytes).`)
}

if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1 })
module.exports = { inventory }
