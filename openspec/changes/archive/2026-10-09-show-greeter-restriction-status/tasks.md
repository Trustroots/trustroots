## Implementation

- [x] 1. Project allowlisted restriction statuses in acquisition stories and matches.
- [x] 2. Render badges beside both kinds of member names.
- [x] 3. Add server, client and greeter end-to-end regression coverage.
- [x] 4. Run validation, update the living spec and archive the change.

## Validation

- 25 client tests and 16 server tests pass on current main, which has retired acquisition analysis.
- The changed component and controller each retain 100% statement, branch, function and line coverage.
- Acquisition-stories browser tests pass, including greeter restriction badges and denied role changes.
- TypeScript checks and lint pass.
