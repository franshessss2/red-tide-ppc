// Run after npm run build -- --manifest. Follow only static imports from entry.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/.vite/manifest.json'), 'utf8'));
const entries = Object.entries(manifest).filter(([, value]) => value.isEntry);
const files = new Set();
function visit(key) {
  const chunk = manifest[key];
  if (!chunk || files.has(chunk.file)) return;
  files.add(chunk.file);
  for (const dependency of chunk.imports || []) visit(dependency);
}
for (const [key] of entries) visit(key);
const assets = [...files].filter(file => file.endsWith('.js')).map(file => {
  const bytes = fs.readFileSync(path.join(root, 'dist', file));
  for (const marker of ['requestPort', 'RT1 ZONES READY', 'Board acknowledgment timed out', 'Serial message too long']) assert.ok(!bytes.includes(marker), `${marker} leaked into eager ${file}`);
  return { file, bytes: bytes.length, gzip: zlib.gzipSync(bytes).length };
});
const lazy = manifest['src/pages/ArduinoZones.tsx'];
assert.ok(lazy?.isDynamicEntry && !files.has(lazy.file), 'Arduino route is not isolated');
const lazyBytes = fs.readFileSync(path.join(root, 'dist', lazy.file));
assert.ok(lazyBytes.includes('requestPort') && lazyBytes.includes('RT1 ZONES READY'));
const report = { eager: assets, lazy: { file: lazy.file, bytes: lazyBytes.length, gzip: zlib.gzipSync(lazyBytes).length } };
const baselinePath = path.join(root, '.cache/bundle-before.json');
if (fs.existsSync(baselinePath)) {
  const before = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).files;
  report.delta = {
    eagerBytes: assets.reduce((n, file) => n + file.bytes, 0) - before.reduce((n, file) => n + file.bytes, 0),
    eagerGzip: assets.reduce((n, file) => n + file.gzip, 0) - before.reduce((n, file) => n + file.gzip, 0),
  };
}
console.log(JSON.stringify(report, null, 2));
console.log('PASS no zone Web Serial implementation in the eager import graph');
