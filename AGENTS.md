<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Navigation Semantics

The in-app semantic navigation stack is responsible only for deciding which
semantic page to close to, and which navigation action to use. Do not put
page-specific behavior in the shared stack layer.

In particular, scroll restoration, focus placement, cache refresh rules, and
per-page transition details must be handled at the page or entry-point level,
not inside `src/components/navigation-history.tsx`.

## Push Policy

NEVER commit or push to `preview` or `main` branches without explicit permission from the user. You may freely push to `dev` branch.

## UI Design Guidelines

The product UI should feel like a quiet, modern PWA client: dense enough for
repeated use, but softened by translucent surfaces, rounded controls, and
small motion. New interfaces should reuse the patterns below instead of
inventing a separate visual system.

### Visual Language

- Use `var(--background)` and `var(--foreground)` for page backgrounds and
  primary text. Avoid hard-coding body-level backgrounds or text colors unless a
  component has a specific semantic color.
- The default brand color is graphite: `var(--theme-primary)` with
  `var(--theme-primary-hover)`. Use it for active navigation, primary submit
  buttons, and selected segmented controls. Do not use it for body text or
  rating badges.
- Surfaces are usually translucent white in light mode:
  `bg-white/55`, `bg-white/60`, `bg-white/70`, or `bg-white/80`, paired with
  `border-white/50` to `border-white/70`, `shadow-slate-900/5`, and
  `backdrop-blur-2xl` or `backdrop-blur-3xl`.
- Keep shadows light for navigation chrome. Top bars should use:
  `border-b border-white/30 bg-white/60 shadow-sm shadow-slate-900/5 backdrop-blur-2xl`.
  Avoid heavier top-bar shadows unless a design explicitly calls for a modal
  card.
- Cards use small-to-medium radius, usually `rounded-xl` or `rounded-2xl`.
  Avoid nesting cards inside cards. Use cards for repeated items, dialogs, and
  framed tools; use normal layout sections for page structure.
- The design intentionally uses subtle texture/glass. Do not add decorative
  gradient orbs, bokeh blobs, or unrelated illustration backgrounds.

### Navigation Chrome

- Page/detail top bars are fixed or sticky at the top, height `h-16`, with a
  left close/back action, centered or flexible title content, and compact
  right-side actions. Keep their shadow and blur consistent across detail
  pages, collection pages, review editor, review reader, and changelog.
- Bottom navigation is a compact glass tab bar fixed at `bottom-6`. It uses
  icon-over-label tabs, a sliding active pill, `var(--theme-primary)` for the
  active state, and white text on the active tab. Do not create a separate
  bottom-tab style for new root tabs.
- Close/X behavior must respect the semantic navigation stack. Page-specific
  scroll restoration, focus placement, and cache rules belong in the page or
  entry-point component, not in `navigation-history.tsx`.

### Controls

- Prefer existing shared components before creating new UI primitives:
  `Dropdown`, `ActionMenu`, `ConfirmDialog`, `AppToast`/`showToast`,
  `PaginationPill`, `HorizontalScrollControls`, `ReviewReader`,
  `ReviewReaderTrigger`, `StatusBadge`, `RatingBadge`, `SpoilerText`,
  `BottomNav`, `SearchScopeSelect`, `ThemeController`, and
  `GlassFilterDefs`.
- Use the shared `Dropdown` component for select-like controls. It renders via a
  portal, dynamically positions itself, and closes on outside clicks. Do not
  build one-off dropdowns unless the shared component cannot support the use
  case.
- Use the shared `ActionMenu` for three-dot menus. Keep low-frequency actions
  such as sharing, opening in NeoDB, adding to collections, rename, and delete
  inside action menus instead of crowding primary UI.
- Icon-only buttons should be circular or borderless depending on local density.
  Use familiar line icons and provide `aria-label`. Prefer an icon over visible
  text for obvious compact actions such as close, delete, share, search, and
  more.
- Primary action buttons are rounded-full, use `bg-[var(--theme-primary)]`,
  white text, `shadow-md`, and hover with `var(--theme-primary-hover)`.
- Disabled states should be visually clear but not heavy: use muted text,
  `disabled:cursor-not-allowed`, and restrained muted surfaces. Avoid adding a
  second, competing disabled style for loading unless the state truly matters.

### Component Reuse Map

- **Dropdowns and menus**: use `Dropdown` for value selection and `ActionMenu`
  for three-dot action lists. Both render through portals and already implement
  outside-click closing and viewport-position updates.
- **Confirmation and transient feedback**: use `ConfirmDialog` for destructive
  or irreversible choices, and `showToast` for short success/error/status
  feedback. Do not create local toast stacks.
- **Pagination**: use `PaginationPill` for paged list controls. Search,
  marked, and collection pages may wrap it to handle page-specific pending
  skeletons, URL updates, or scroll behavior, but the pill visual should stay
  shared.
- **Badges**: use `StatusBadge` and `RatingBadge` from `mark-badges.tsx` for
  mark state and rating displays. Do not recreate rating dots, half-dot logic,
  or shelf color semantics in feature pages.
- **Long review reading**: use `ReviewReader` / `ReviewReaderTrigger` for
  markdown long-review overlays and changelog-like reading surfaces. Keep their
  top bar aligned with the global top-bar style.
- **Spoilers and Markdown**: use `SpoilerText` for inline spoiler rendering and
  the existing markdown rendering pipeline for long review bodies.
- **Horizontal tag rails**: use `HorizontalScrollControls` when a tag row needs
  mouse-friendly left/right controls and edge fades.
- **Search scope**: use `SearchScopeSelect` for the home/search category scope
  selector; do not rebuild its dropdown behavior.
- **Navigation**: use `BottomNav` for root tabs and the navigation-history
  helpers for semantic close behavior. Use page-specific frame/restorer
  components for scroll and pending states, following existing search, marked,
  and collection patterns.
- **Theme and glass**: keep `ThemeController` and `GlassFilterDefs` mounted at
  the app level. New glassy surfaces should rely on existing backdrop utilities
  instead of injecting new SVG filters.
- **Feature-local shared pieces**: before building list cards, skeletons,
  pagination wrappers, top bars, or scroll restorers, check existing modules in
  `src/app/search`, `src/app/marked`, `src/app/collection/[uuid]`, and
  `src/app/item/[category]/[uuid]` for patterns to reuse or mirror.

### Layout And Density

- Main pages generally use `min-h-dvh`, `bg-[var(--background)]`,
  `text-[var(--foreground)]`, responsive horizontal padding (`px-4` or `px-5`),
  and enough bottom padding (`pb-28` to `pb-32`) for fixed bottom chrome.
- Content width should stay consistent within the same workflow. Root pages and
  search/marked/profile views should align search bars, tag bars, and card
  lists where possible. Detail and collection pages typically use `max-w-2xl` or
  `max-w-4xl` depending on whether they support landscape split layouts.
- For landscape detail layouts, prefer functional split views over decorative
  cards. Keep media constrained so large covers cannot cause horizontal scroll.
- Text must not overflow controls. Use `min-w-0`, `truncate`, `line-clamp-*`,
  `break-words`, or marquee behavior where the design already uses it.

### Feedback And Motion

- Use the global toast (`showToast`) for transient status, errors, copy
  feedback, and small completion messages. Toasts should stay short and should
  not end with punctuation.
- Use skeletons when loading page-level content or changing pages. Pagination
  controls themselves should generally remain visible while list content
  skeletons update.
- Motion should be short and purposeful: page/detail scale transitions around
  180-220ms, dialogs around 160-180ms, and active-tab/pagination pill movement
  around 300ms. Avoid long ornamental animation.
- For uncertain external operations, prefer honest indeterminate waiting states
  over fake progress bars that imply false certainty.

### Performance Boundaries

- Keep detail pages light. Low-frequency tools such as note management,
  collection management, long-form editors, import flows, and media-specific
  utilities should be opened through route-level screens or explicit lazy
  components instead of being imported into the main detail chrome bundle.
- Prefer route-level lazy loading when a feature naturally has its own surface
  or navigation state, for example editors, management pages, and paginated
  secondary lists. Prefer component-level `lazy()` only for dialogs that must
  stay on the current page.
- Fetch secondary data only after the user enters the feature surface. Do not
  prefetch private or low-frequency data from a detail page merely because the
  action menu exposes an entry point.
- Paginated secondary lists should use modest page sizes by default, typically
  around 20 items, and reuse `PaginationPill`. Keep pagination controls visible
  while page content swaps to skeletons.
- Shared heavy readers or editors may be reused across features, but they
  should be reached through the relevant route or trigger. Avoid pulling a
  markdown editor, note manager, or full reading overlay into a page that only
  needs to show an action entry.

### Dark Mode And Themes

- Every new surface must be checked in dark mode. The global dark-mode CSS maps
  many white and border utilities to dark surfaces; prefer existing surface
  utilities so this mapping continues to work.
- Theme color should affect active navigation, selected tabs, and primary
  actions. It should not affect normal text, rating badge colors, or semantic
  success/warning/danger badges unless explicitly intended.
- Rating badges have their own visual language and should be reused from shared
  badge components rather than reimplemented.

### Content Semantics

- Keep feature hierarchy clear. Frequent item actions should be visible; low
  frequency actions belong in a three-dot menu. Do not mix different semantics
  just to save space, for example mark status and collection management should
  remain distinct.
- Prefer explicit, scoped feature names: comments are comments, long reviews are
  long reviews, collections are collections. Avoid introducing broad concepts
  like notes unless the product flow is fully designed.
- Treat notes as a private, self-use writing surface unless a future design
  explicitly reopens public note browsing. Do not add note sharing, timeline
  publishing, or social affordances by default; keep visibility fixed and make
  the limitation legible in the editor.
- New empty states and error states should be concise, actionable, and localized
  in all supported languages.
