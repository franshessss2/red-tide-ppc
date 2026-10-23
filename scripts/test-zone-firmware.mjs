// Run unchanged production sketches on fake GPIO/serial, never touch a USB port.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, '.cache/zone-firmware');
mkdirSync(output, { recursive: true });
const compiler = process.env.CXX || 'c++';
const env = { ...process.env, PATH: `${path.dirname(compiler)}${path.delimiter}${process.env.PATH}` };
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', windowsHide: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error || result.status !== 0) throw result.error || Error(`${command} exited ${result.status}`);
}
for (const name of ['zones', 'pin-test']) {
  const exe = path.join(output, name + (process.platform === 'win32' ? '.exe' : ''));
  run(compiler, ['-std=c++11', '-Wall', '-Wextra', ...(process.platform === 'win32' ? ['-static'] : []), '-Iarduino/libraries/RedTideZones/src', `tests/arduino/${name}.cpp`, '-o', exe]);
  run(exe, []);
}
const sketches = ['red_tide_zones', 'red_tide_pin_test'];
let pinTable;
for (const name of sketches) {
  const sketch = readFileSync(path.join(root, `arduino/${name}/${name}.ino`), 'utf8');
  const table = sketch.match(/constexpr rt::PinRole PINS\[\] = \{([\s\S]*?)\};/)?.[1];
  if (!table || (pinTable && table !== pinTable)) throw Error('Sketch pin tables differ');
  pinTable = table;
  for (const badPin of [13, 0, 1, 20]) {
    const changed = sketch.replace('{12,"sta-lourdes"}', `{${badPin},"sta-lourdes"}`);
    if (changed === sketch) throw Error('Guard probe did not mutate pin table');
    const file = path.join(output, `${name}-bad-${badPin}.cpp`);
    writeFileSync(file, '#include "Arduino.h"\n' + changed);
    const result = spawnSync(compiler, ['-std=c++11', '-fsyntax-only', '-Itests/arduino', '-Iarduino/libraries/RedTideZones/src', file], { cwd: root, env, encoding: 'utf8', windowsHide: true });
    if (result.error || result.status === 0 || !result.stderr.includes('Pins must be unique UNO pins; D0/D1 are reserved')) throw Error(`Pin guard did not reject ${name} pin ${badPin}: ${result.stderr}`);
    console.log(`PASS compile-negative guard: ${name} rejects ${badPin === 13 ? 'duplicate D13' : `D${badPin}`}`);
  }
}
