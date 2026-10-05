# Visual contract

Every block on a page shares these values. Mixing a block's own defaults with
another page's palette is what makes a set of sections stop reading as one
system.

## Colour tokens

Light:

| Token | Value | Use |
| --- | --- | --- |
| `--background` | `38 34% 97.5%` | Page ground: warm paper, never cool white |
| `--foreground` | `24 18% 12%` | Body copy |
| `--card` | `40 40% 99%` | Raised surfaces |
| `--primary` | `174 64% 27%` | Deep teal: primary actions, accents |
| `--primary-foreground` | `40 40% 98%` | Copy on primary |
| `--secondary` | `36 26% 92%` | Quiet fills |
| `--muted` | `36 24% 91%` | Inset panels |
| `--muted-foreground` | `26 10% 41%` | Secondary copy |
| `--accent` | `172 40% 88%` | Highlight wash |
| `--destructive` | `10 74% 47%` | Errors only |
| `--border` | `34 20% 86%` | Hairlines |
| `--ring` | `174 64% 32%` | Focus |
| `--radius` | `0.875rem` | Base corner |

Dark: keep the same roles, shifting the ground to `200 22% 8%`, copy to
`38 26% 93%`, primary to `169 68% 45%`, border to `200 14% 20%`.

Neutrals are warm. A cool zinc grey (`#71717a`) belongs in this palette as its
warm-stone equivalent (`#7e766d`). Pure black and pure white stay exact —
they carry masks and gradient stops.

## Chart series

Five series, in order: teal `184 62% 32%`, amber `36 84% 56%`, plum
`322 44% 48%`, sage `146 30% 52%`, clay `18 62% 54%`.

Charts render through ECharts. Grid lines are dotted (`[1, 5]`), axis lines use
the border token, and the tooltip sits on the card colour. Tables render
through Ant Design's `Table` with `colorPrimary` set to `#17706a`.

Do not hand-roll an SVG chart beside these layers.

## Typography

- Body and interface: `Outfit`, falling back to `Avenir Next`, `system-ui`
- Headings: `Sora`, letter-spacing `-0.025em`, weight 600

Both are OFL-licensed and ship as local `woff2` files. Never load them from a
font host.

## Geometry and motion

- Base radius `0.875rem`; pills use `999px`; hard-edged treatments use `2px`
- Backdrops are a 26px ruled grid drawn from the border token, not a dot field
- Entrance motion is short and shallow: 300–600ms, small translate, no bounce
- Icon strokes are 1.5px with square caps and mitre joins
