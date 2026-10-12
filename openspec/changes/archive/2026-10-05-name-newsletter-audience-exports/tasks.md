## Implementation

- [x] Generate filename-safe audience filter descriptions and local minute timestamps.
- [x] Use the generated name for audience CSV downloads.
- [x] Test defaults, changed filters, circle and hosting-only audiences, and filename sanitisation.
- [x] Extend browser coverage for downloaded filenames.
- [x] Validate checks, archive the proposal and update the living specification.

## Verification

- Focused client tests: 29 passing; 100% statements, branches, functions and lines across the component and filename utility.
- Changed-file lint and TypeScript checks pass.
- A dedicated browser regression covers default and customised download filenames; final browser verification runs in CI.
