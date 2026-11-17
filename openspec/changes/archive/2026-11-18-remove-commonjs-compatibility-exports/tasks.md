## Implementation

- [x] Validate this proposal before implementation.
- [x] Add an ESM `mockModule` that imports mocked modules.
- [x] Migrate the CommonJS server tests to `.mts` and delete the interoperability-only tests.
- [x] Remove the `module.exports` exports, their aliases and tags, and the CommonJS test utility shims.
- [x] Make the remaining CommonJS callers read default exports.
- [x] Reject `module.exports` exports repository-wide in lint.
- [x] Run lint and the affected server tests.
- [x] Update the living runtime specification and archive the change.
