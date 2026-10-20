## 1. Profile action layout

- [x] 1.1 Replace the horizontally scrolling action row with fixed Back,
      primary message, own-profile edit and accessible overflow actions.
- [x] 1.2 Preserve experience-sharing route, contact loading states, add-contact
      route and pending/confirmed removal confirmation.
- [x] 1.3 Move all new visible and accessibility text into Android string
      resources, using British spelling.

## 2. Shared artwork header and compact sizing

- [x] 2.1 Extend the existing artwork and scrim behind the action area and top
      system inset without adding a second artwork image or header state.
- [x] 2.2 Rework combined header sizing around measured action and tab heights,
      preserving the 360 dp / 96 dp and 320 dp / 48 dp viewport targets.
- [x] 2.3 Keep the tabs above the content-only pager and preserve the 48 dp
      avatar hit target, tab/pager synchronisation and photo-viewer callbacks.

## 3. Regression coverage

- [x] 3.1 Update Android journey coverage for primary message, overflow
      actions, self edit and contact-state confirmation.
- [x] 3.2 Add or update end-to-end UI coverage for the fixed action layout,
      artwork underlay and compact viewport targets, using anonymous fixtures.
- [x] 3.3 Run the relevant Android unit and journey checks, then Android lint.
