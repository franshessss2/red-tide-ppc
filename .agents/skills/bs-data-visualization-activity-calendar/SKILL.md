---
name: bs-data-visualization-activity-calendar
description: Activity Calendar Chart is a ready-to-paste data visualization, delivered as editable source with its usage example. It ships with state the visitor can change and see respond. Colour, type and radius live as tokens you edit once for the whole block.
---

# Activity Calendar Chart

A data visualization, delivered as source you paste and edit. The chart goes through one charting layer so it matches the rest of the page.

## Workflow

### 1. Detect the target stack — do not assume plain HTML

Read the surrounding repository first: `package.json` dependencies, framework
config, an existing components directory and the styling approach already in
use. Port the block into that idiom — component shape, style location and
interaction code all follow the project's conventions.

A single self-contained HTML file is right only for a standalone deliverable
the user opens directly, or for a demo page. When there is no repository
context and the signals are ambiguous, ask one short question.

### 2. Paste the block

Source lives in `references/block/`: `demo.tsx` shows usage, `src/` holds the
component. Copy them in and rewire imports to the project's aliases.

### 3. Apply the visual contract

Read `references/theme.md` and carry its tokens through. Palette, type scale,
radius and motion timings are what let this block sit beside others without
looking borrowed.

### 4. Set the icons

Read `references/icon-library.md`. Icons are inline SVG only — Lucide paths at
1.5px with square caps for interface icons, LobeHub monochrome marks for vendor
logos and only beside a visible text label. Never an emoji, a Unicode dingbat
or an icon font, in the page or in a code sample.

### 5. Set the imagery

Follow `references/imagery.md`: portraits where a person is shown, abstract
plates in any slot carrying `invert`, `mix-blend` or `object-contain`, and
photographs everywhere else. A photograph in a blend-mode slot inverts into a
colour cast and lands off position.

### 6. Verify

Run `scripts/check-blocks.mjs` over the generated page. It fails on emoji used
as icons, off-palette cool colours, and remote asset references.

## Rules

- Copy the source; do not wrap it in an abstraction layer.
- Keep the palette. Recolouring outside the contract breaks the match with
  neighbouring sections.
- Keep every asset local — no CDN scripts, no remote images, no font hosts.
