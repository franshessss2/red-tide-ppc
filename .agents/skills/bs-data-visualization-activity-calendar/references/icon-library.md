# Icon system

Icons are inline SVG. No emoji, no Unicode dingbats (`✓ ◐ ✦ ▲ ▼ → ★ ☰`), no
icon fonts — as icons, as bullets, or as button arrows. This holds even when a
reference design uses them.

## Interface icons — Lucide (ISC)

Base shape:

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none"
     stroke="currentColor" stroke-width="1.5"
     stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">
  <!-- paths -->
</svg>
```

The 1.5px square-cap, mitre-join setting is part of the visual contract; the
Lucide default (2px, round) belongs to a different system.

Paths for the placements these blocks actually use:

| Placement | Path |
| --- | --- |
| Forward action | `<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>` |
| Back action | `<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>` |
| Confirmation | `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>` |
| Disclosure | `<path d="m6 9 6 6 6-6"/>` |
| Trend up | `<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>` |
| Menu | `<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>` |
| Dismiss | `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>` |
| Night mode | `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>` |
| Day mode | `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>` |
| External | `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>` |

## Vendor marks — LobeHub (MIT)

Monochrome `fill="currentColor"` marks, used only where a real integration is
being named, always beside a visible text label. Never recoloured, never
decorative, never standing in as the product's own logo.

Blocks that list integrations already carry these; keep them monochrome and
keep the label.
