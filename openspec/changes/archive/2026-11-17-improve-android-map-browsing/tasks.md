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
- Added three focused bounds/default unit tests and seven Android device journeys. Screenshot calls cover expanded/collapsed filters, populated results and empty results.
- Android integration validation combined the six #3683 branches: debug APK and test APK compilation passed, along with all 759 Android unit tests. All seven map-results device journeys passed locally after the popup Back test was corrected to use the existing non-activity-root helper. Expanded/collapsed filters and populated/empty result screenshots were inspected with the native application frame and safe insets. Final branch CI and the full device coverage ratchet remain required; coverage thresholds are unchanged.
