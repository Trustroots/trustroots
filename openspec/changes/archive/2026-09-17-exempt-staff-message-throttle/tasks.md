## Implementation

- [x] Add the role exemption to the recipient throttle.
- [x] Cover both exempt roles and ordinary users with server regression tests.
- [x] Add end-to-end coverage for exemption and revocation.
- [x] Run applicable validation without changing coverage thresholds.
- [x] Update the living messaging specification and archive the proposal.

## Validation

- ESLint and diff whitespace checks passed.
- Full server suite: 1,721 passing, 28 pending.
- Server coverage: 100% statements, branches, functions and lines; the strict 100% coverage check passed.
- Targeted messaging end-to-end run: 11 passing (including two authentication setup checks). The full-suite feature coverage summary reports incomplete coverage because this run intentionally selected only messaging API tests.
- No coverage thresholds or existing end-to-end tests were removed. Client code is unchanged.
