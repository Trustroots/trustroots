## Implementation

- [x] Show wrapping filters initially and allow collapse/reopen without clearing selection.
- [x] Add a current-area offers list with member identity, availability, loading, error recovery and existing host-detail navigation.
- [x] Preserve map viewport/filter/list state when inspecting an offer and reject results outside the visible bounds.
- [x] Extend anonymous device journeys and screenshot capture; retain existing map journeys.
- [x] Add focused bounds/default unit coverage, run available checks and document any environment limitations.
- [x] Archive the completed proposal and update the living Android specification.

## Validation evidence

- Proposal passed `openspec validate improve-android-map-browsing --strict` before implementation.
- `pnpm install --frozen-lockfile` and `pnpm check` passed using the pinned pnpm 12.16.1 and Node 24. The worktree needed an ignored local Jest environment link to avoid an older dependency in its ancestor checkout.
- `pnpm check`: lint, all TypeScript projects, 306 client suites / 2,763 tests, 75 configuration tests, 67 translation-service tests and five native-promise tests passed.
- Added three focused bounds/default unit tests and eight Android device journeys. Screenshot calls cover expanded/collapsed filters, populated results and empty results.
- Final small-screen validation passed debug APK/test APK assembly, Android lint and all 751 app unit tests on this branch. All eight map-results device journeys passed locally, including a self-contained 320×520dp viewport with Configuration and LocalDensity fixed to 130% text. The regression asserts a visible, operable offer and Back to map action, explicit filter reopening, and preservation of expanded/collapsed map-filter state after return. Normal and narrow screenshots were inspected. Final branch CI and the full device coverage ratchet remain required; coverage thresholds are unchanged.
