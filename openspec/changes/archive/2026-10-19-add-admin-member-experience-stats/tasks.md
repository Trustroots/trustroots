## Implementation

- [x] Add active experience totals and publication-aware recommendation counts.
- [x] Restyle member statistics and remove duplicate role badges from stats.
- [x] Cover empty and populated counts with server, client and end-to-end tests.
- [x] Validate the change and update the living admin moderation specification.

Validation: `pnpm check` passes. The focused server suite and full browser flow require MongoDB; no local database or Docker engine is available. Client rendering was checked at desktop and mobile widths.
