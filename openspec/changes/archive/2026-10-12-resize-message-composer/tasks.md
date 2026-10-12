## Implementation

- [x] Validate the revised proposal before implementation.
- [x] Replace the size button with a draggable, keyboard-accessible handle.
- [x] Cover resizing, draft preservation, preview and sending in unit tests.
- [x] Cover desktop mouse and mobile touch resizing and short viewports end to end.
- [x] Run relevant checks without lowering coverage thresholds or removing existing e2e coverage.
- [x] Update the living specification, archive the proposal and update the PR.

Validation: 15 composer unit tests passed with 100% statements, branches, functions and lines. Four desktop mouse/mobile touch and preview/send scenarios passed, along with both existing Firefox layout/caret regressions and authentication setup. Targeted ESLint, formatting, application and client-test TypeScript checks passed using the pinned dependencies. Strict proposal validation passed before implementation. No coverage thresholds or existing end-to-end tests were removed; server code was unchanged.
