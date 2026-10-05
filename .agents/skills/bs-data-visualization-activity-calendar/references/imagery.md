# Imagery

Every image slot is filled from the local set that ships with a generated page.
Nothing is fetched at runtime.

## Choosing by slot, not by convenience

| Slot | Use |
| --- | --- |
| A person — quote, profile, avatar stack | A portrait |
| Any `<img>` carrying `invert`, `mix-blend-*`, `object-contain` or `mask-image` | An abstract plate |
| Everything else — scene, product, backdrop | A photograph |

The blend-mode rule matters: a literal photograph inside an inverting slot
comes out as a colour cast, and the negative offsets those layouts use push it
off its intended position. Gradient plates read correctly under `invert`; flat
paper textures wash out to nothing.

## Rules

- One image never repeats inside a single page. Deal from the set without
  replacement.
- A portrait belongs to the person named beside it. When a block pairs a name
  with a photo, the pairing is fixed — do not shuffle one without the other.
- Ship WebP. Size to the largest display width at 2× DPR.
- Decorative plates take a mask or a low opacity so copy stays legible on top.
