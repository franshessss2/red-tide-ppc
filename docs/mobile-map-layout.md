# Mobile map layout

Below 768px, a single bottom panel owns status counts, zone cards, reporting actions, source details and the coastal primer. It starts at a 92px summary and expands to half or full height. Desktop keeps the original advisory and zone side drawers.

The panel reuses the original zone cards and their entrance animations. It does not transform, remount or dim the map. Only the panel header and content capture gestures. Map options collect the shipping overlay, reset and admin actions; opening options collapses the information panel, and opening the panel closes options.

Tap the summary or use Enter/Space to open. Arrow Up expands fully; Arrow Down and Escape collapse. Escape returns focus to the summary. Selecting a zone collapses the panel to expose the existing focus flight. An empty-map tap clears the mobile selection and collapses details; polygon and popup taps remain separate.

The panel body scrolls independently. Hidden mobile details are unmounted so collapsed content cannot receive keyboard focus. Attribution stays visible outside the panel, moving below the header while details are open. Loading counts use a dash rather than zero; data source, retry actions and BFAR links remain available inside details. The collapsed summary retains the feed state.

Panel height uses a 240ms CSS transition, disabled by reduced-motion preferences. Existing Motion animations remain in zone cards and the desktop drawers. No additional dependency, Firebase change, intro change or landing change is required.

References: [HyperUI](https://www.hyperui.dev/) for grouped controls and expandable details; [Design Spells](https://designspells.com/) for sheet transitions.

Validation covers 320×568, 390×844, 667×375, 768×1024 and 1440×900: overflow, drawer visibility, panel expansion, menu dismissal, zone focus, zoom controls and attribution. Browser layout checks use isolated sample data and locally intercepted build assets; map tiles are excluded from those checks.
