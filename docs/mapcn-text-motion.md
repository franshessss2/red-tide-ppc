# Street map and text motion

The coastal map remains the main view. Open **Street map** in its desktop controls or the mobile **Map options** menu for a MapLibre street-map example centered on Puerto Princesa. Close or press Escape to return to the same coastal map and selection. This view shows geographic context, not advisory zones or laboratory results.

`StreetMapExample.tsx` imports `Map` and `MapControls` from `@/components/ui/map`, uses a sized container and the registry's default CARTO dark tiled basemap. Do not use `blank` for this street view. MapLibre and its matching worker load only when this view opens. WebGL is required; unavailable resources show a fallback or incomplete-data notice. CARTO/OpenStreetMap attribution remains visible.

## Installation

- Agent instructions: https://mapcn.dev/llms.txt
- Requested `npx shadcn@latest add @mapcn/map` failed because the proxy refused the registry connection.
- Downloaded https://mapcn.dev/r/map.json and ran `npx shadcn@latest add /tmp/pr82-map-registry.json -y`. The local CLI installed dependencies, then failed fetching shadcn neutral colors through the proxy. Copied the registry component verbatim from its JSON into `src/components/ui/map.tsx`; no component code was rewritten. Implemented its needed attribution styling in the scoped street-map stylesheet. Existing Tailwind v4 brand tokens were preserved; aliases and scoped map-control tokens were added.
- Text skill installed with `npx skills add pixel-point/animate-text --skill animate-text --agent codex -y`. Its pinned source is recorded in `skills-lock.json` and the catalog is in `.agents/skills/animate-text`.

## Motion choices

`TextReveal` translates the portable `micro-scale-fade` (whole phrase, 600ms, scale .96→1) and `per-word-crossfade` enter (700ms, 70ms word stagger, 8px upward drift) contracts using the existing Motion dependency. Intro scene crossfades continue to own exits; all nine chapters, the loop and one-click exit remain. Section headings in Landing, Devices, the admin gate and non-map header titles reveal once. Arduino uses the same micro-scale enter as CSS.

Live map statuses, device readings, counts, form labels and safety instructions remain immediately readable. Existing landing animations are not layered with duplicate effects. Accessible text is announced once, spaces remain breakable, and reduced motion renders static text. Body copy and product wording are unchanged.

## Review checks

Check desktop and phone: open/close the street map, Escape, focus restoration, controls and attribution; pan/zoom and reopen; offline/WebGL failure; unchanged coastal drawers and zone selection. Check intro loop, replay, every title fitting on narrow/landscape screens, and static reduced-motion behavior. External tile availability requires a connected browser.

## Verification recorded for PR 82

- Production TypeScript/Vite build succeeds. MapLibre is a separate lazy chunk and its worker is bundled locally; neither downloads before opening Street map.
- Browser checks at 1440×900, 390×844, 320×568 and 844×390: modal sizing, 44px controls, keyboard focus, Escape/close/reopen, and the coastal map remaining mounted.
- All nine intro chapters fit those four sizes. Phone loop/exit/replay and reduced motion pass; Landing, Devices, Admin and Arduino have no horizontal overflow at 320px.
- CARTO style, attribution metadata and sprites were readable, but some vector-tile requests timed out through the sandbox proxy. Complete live basemap rendering must be checked in the Vercel preview. Failure notices and the bounded loading fallback were verified.
- Tests include default tiled-style configuration, loading timeout, partial-data handling, dialog dismissal/focus restoration and text accessibility/reduced motion.
