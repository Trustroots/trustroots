## 1. Proposal

- [x] 1.1 Inspect contact, Experience and reference-thread APIs and current profile/thread placement.
- [x] 1.2 Define the existing-records scope, privacy boundaries and #3136 exclusions.
- [x] 1.3 Validate the proposal with `openspec validate add-unified-relationship-view --strict`.

## 2. Shared view model and component

- [x] 2.1 Add a typed adapter and pair-scoped loading layer under contacts, using existing API clients and feature configuration.
- [x] 2.2 Cover contact direction, both possible primary Experience authors, reciprocal payload omissions, publication states, missing interaction answers and host/guest perspective.
- [x] 2.3 Render the four labelled sections with permitted existing action destinations and independent loading/error/retry states.
- [x] 2.4 Reuse viewer-only reference-thread eligibility and history-preserving answer changes; retain the previous answer on failed saves.
- [x] 2.5 Cover late responses, member-pair/account switches, feature-off behaviour, restricted/unavailable members and rejected mutations.
- [x] 2.6 Regenerate module-graph and workspace-package baselines for intentional imports and explain the dependencies in the PR.

## 3. Profiles, threads and guidance

- [x] 3.1 Mount the same component on other-member profiles and in a keyboard-accessible thread disclosure visible on desktop and mobile.
- [x] 3.2 Remove duplicate thread feedback controls and preserve composer space, scrolling and focus behaviour.
- [x] 3.3 Explain messaging independence and people-you-know guidance before both contact submission and acceptance; update translations.
- [x] 3.4 Keep Experience creation available without contact acceptance and preserve existing publication/change-review flows.

## 4. Verification and completion

- [x] 4.1 Review existing server contract regressions: Experience payload and pair-route tests already establish visibility for both primary authors; reference-thread controller and route tests already establish viewer-only reads, eligibility and history-preserving latest answers. No additional server regression is needed.
- [x] 4.2 Add client tests for the adapter, component and both integrations, preserving 100% client/server coverage.
- [x] 4.3 Add e2e coverage comparing profile/thread states for absent, incoming, outgoing and confirmed contacts, with and without Experiences.
- [x] 4.4 Exercise own/other Experience labels, hidden details, unknown meeting answers, publication state and eligible/ineligible feedback in e2e coverage.
- [x] 4.5 Exercise mobile thread access and changing the viewer's feedback from both surfaces; confirm another account cannot see that answer.
- [x] 4.6 Run repository checks, coverage checks and relevant desktop/mobile e2e tests without reducing thresholds or existing e2e coverage. `pnpm check` passes (262 client suites / 2,067 tests and five configuration tests); client coverage is 100% on all four metrics. The CI server suite also passes with 100% on all four metrics. All 39 affected browser tests pass across relationship/safety and dedicated Experience flows, covering the shared view alongside preserved creation, list, retry and change-review behaviour.
- [x] 4.7 Validate and archive the completed change, updating the living specification when implementation is complete.
