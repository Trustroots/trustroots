## Why

Kotlin 2.4 emits Compose control flow in compiler-created lambda methods that do not carry the annotation required by JaCoCo's current Compose filter. Branch coverage should measure application decisions while retaining evidence for every compiler correction.

## What Changes

- Recognise only structurally proven Compose cache and execution scaffolding, using the pinned upstream filter where possible.
- Keep Compose changed-mask preamble decisions under the pinned upstream JaCoCo filters; add no overlapping custom matcher. Recognise hidden default-argument mask dispatch only with metadata, slot/bit, and bytecode proof, preserving source expressions and conditions.
- Recognise inlined Compose library guards only with exact instruction patterns and verified third-party source provenance in primary Kotlin SMAP.
- Preserve application conditionals and uncertain patterns, with positive and negative bytecode regression fixtures.
- Keep raw reports and audit generated branch corrections explicitly, including their exact counter differences.
- Add tests for reachable API and state branches and target a measured branch floor of 100%, preserving the 100% executable-line floor.

## Impact

Android reporting, tests and coverage baselines. No application behaviour or dependency versions change. Browser e2e tests cannot validate JVM bytecode; classifier regressions and Android coverage measurements provide verification.
