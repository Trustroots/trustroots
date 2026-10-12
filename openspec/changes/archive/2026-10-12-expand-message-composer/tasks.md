## Implementation

- [x] Validate the proposal before implementation.
- [x] Add the accessible size toggle and responsive expanded layout.
- [x] Cover draft preservation, preview and sending in unit tests.
- [x] Add desktop and mobile end-to-end coverage, including short viewports.
- [x] Run relevant tests and checks without lowering coverage thresholds.
- [x] Update the messaging living spec and archive the completed change.

Validation: strict proposal validation, targeted ESLint and Prettier checks, application and client-test TypeScript checks passed. All 14 composer unit tests passed with 100% statements, branches, functions and lines for ThreadReply. Four desktop/mobile end-to-end scenarios and both existing Firefox layout/caret regressions passed (plus authentication setup in each run). No coverage thresholds or existing end-to-end tests were removed. Server code was unchanged.
