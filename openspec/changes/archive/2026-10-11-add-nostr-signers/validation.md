# Validation

- `npm run typecheck`: passed, including client tests and shared contracts.
- Scoped ESLint and `git diff --check`: passed.
- `npm run build:e2e`: passed, with webpack asset-size warnings.
- Isolated PR branch based on main: full client suite passed 235 suites and 1,719 tests, with 100% statement, branch, function and line coverage. Thresholds and baselines were not lowered.
- The parallel client runner reports a worker shutdown warning. The focused signer suites exit cleanly with handle detection enabled.
- Full server parallel suite passed with 100% coverage in all four metrics (4,489 statements, 2,806 branches, 1,025 functions and 4,402 lines). Command: `TRUSTROOTS_SKIP_LOCAL_CONFIG=true DB_1_PORT_27017_TCP_ADDR=127.0.0.1 TRUSTROOTS_AVATAR_PROCESSOR_FALLBACK=true TRUSTROOTS_FILE_MAGIC_FALLBACK=true npm run test:coverage:server:parallel`.
- Clean seeded Nostr end-to-end suite: all 17 tests passed, including six new signer and verification scenarios. The NIP-46 fixture exchanges encrypted NIP-44 RPC messages locally.
- NIP-55 browser callback and clipboard paths are automated; a physical Android signer handoff still needs device testing.
