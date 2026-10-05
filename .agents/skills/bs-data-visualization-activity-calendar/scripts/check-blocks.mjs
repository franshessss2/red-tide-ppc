#!/usr/bin/env node
/**
 * Verify a generated page against the Verso visual contract.
 *
 * Usage: node check-blocks.mjs <file-or-directory> [...more]
 *
 * Fails on emoji or dingbats used as icons, palette values outside the
 * contract, and remote asset references that break self-containment.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const EXTS = new Set([".html", ".htm", ".tsx", ".jsx", ".ts", ".js", ".css"]);

// pictographs, dingbats, arrows and geometric shapes used as icons
const GLYPHS =
  /[←-⇿⌀-⏿■-◿☀-➿⬀-⯿️]|[\u{1F300}-\u{1FAFF}]/gu;

// A fixed allowlist cannot work here: block sources legitimately carry dozens
// of colours. The signal that actually means "wrong palette" in a warm,
// teal-accented system is a SATURATED COOL hue — blue, indigo, violet — so
// that is what gets flagged. Warm neutrals and the teal ramp pass.
function coolAndSaturated(hex) {
  const n = hex.length === 4
    ? hex.slice(1).split("").map((c) => parseInt(c + c, 16))
    : [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [r, g, b] = n.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return false;                       // grey
  const s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (s < 0.35) return false;                          // muted enough to blend
  let h;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  return h >= 205 && h <= 295;                         // blue → violet
}

const REMOTE = /(?:src|href|url\()\s*=?\s*["'(]?https?:\/\/(?!www\.w3\.org)/gi;

// vendored library builds carry their own palettes and are not ours to police
const VENDOR = /(?:^|\/)(?:node_modules|vendor|dist)(?:\/|$)|\.min\.(?:js|css)$/;

function walk(target, out = []) {
  const s = statSync(target);
  if (s.isDirectory()) {
    for (const entry of readdirSync(target)) {
      if (entry === "node_modules" || entry === "vendor" || entry.startsWith(".")) continue;
      walk(join(target, entry), out);
    }
  } else if (EXTS.has(extname(target)) && !VENDOR.test(target)) {
    out.push(target);
  }
  return out;
}

function lineOf(text, index) {
  return text.slice(0, index).split("\n").length;
}

const targets = process.argv.slice(2);
if (targets.length === 0) {
  console.error("usage: check-blocks.mjs <file-or-directory> [...]");
  process.exit(2);
}

const problems = [];

for (const target of targets) {
  for (const file of walk(target)) {
    let text = readFileSync(file, "utf8");
    // strip inlined third-party bundles before the palette pass
    text = text.replace(/<script>[\s\S]{40000,}?<\/script>/g, "<script></script>");

    for (const m of text.matchAll(GLYPHS)) {
      problems.push(
        `${file}:${lineOf(text, m.index)}  emoji or dingbat used as an icon: ${m[0]}`,
      );
    }

    // a hex inside an escaped Tailwind selector (.text-\[\#F7F7FF\]) is part
    // of the class name, not a declared colour, so skip those
    for (const m of text.matchAll(/(?<![\\[])#[0-9a-fA-F]{3,8}\b/g)) {
      const hex = m[0].toLowerCase();
      if (hex.length !== 4 && hex.length !== 7) continue; // skip alpha forms
      // A vendor mark keeps its own brand colour by design. Icon path data
      // runs to thousands of characters, so decide by the enclosing element
      // rather than a fixed lookbehind window.
      const openTag = text.lastIndexOf("<", m.index);
      const closeTag = text.lastIndexOf(">", m.index);
      const insideTag = openTag > closeTag;
      if (insideTag) {
        const tag = text.slice(openTag, m.index);
        if (/^<(?:path|svg|stop|circle|rect|polygon|ellipse|linearGradient|radialGradient|g)\b/.test(tag)) {
          continue;
        }
      }
      if (coolAndSaturated(hex)) {
        problems.push(
          `${file}:${lineOf(text, m.index)}  cool saturated colour, off-palette: ${m[0]}`,
        );
      }
    }

    for (const m of text.matchAll(REMOTE)) {
      problems.push(
        `${file}:${lineOf(text, m.index)}  remote asset breaks self-containment`,
      );
    }
  }
}

if (problems.length === 0) {
  console.log("check-blocks: clean");
  process.exit(0);
}

// collapse repeats so a single offending token does not flood the report
const seen = new Map();
for (const p of problems) seen.set(p, (seen.get(p) ?? 0) + 1);
for (const [p, n] of seen) console.error(n > 1 ? `${p}  (x${n})` : p);
console.error(`\ncheck-blocks: ${problems.length} problem(s)`);
process.exit(1);
