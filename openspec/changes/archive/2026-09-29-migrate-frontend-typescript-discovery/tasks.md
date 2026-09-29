## Implementation

- [x] Validate this proposal before implementation.
- [x] Convert all 72 remaining production JavaScript modules in admin, offers and search client code to strict `.ts` or `.tsx`.
- [x] Keep existing client tests in JavaScript and verify that they exercise the converted modules.
- [x] Run strict type-checking, scoped lint, client tests and coverage, translation extraction, and the production build.
- [x] Run the repository coverage ratchet; client and server summaries remain at 100%.
- [x] Attempt the existing end-to-end suite; global setup stopped before scenarios because the seeded-trial readiness check returned zero tribes.
- [x] Archive this change and update the living developer-tooling specification.
