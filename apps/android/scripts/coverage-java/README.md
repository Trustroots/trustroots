# Android generated-instruction reporting

This build-time tool extends JaCoCo 0.8.15's standard filters. Its output classes
must precede the JaCoCo jars on the reporting classpath; the Gradle runtime
dependency and regression task provide that ordering. The app APK never contains
this tool.

`Filters.java` is derived from JaCoCo v0.8.15, retains its upstream EPL-2.0 notice,
and appends the Trustroots filter after the standard filters. Review that factory
and the classifier whenever updating JaCoCo. JaCoCo source and licence are at
[the pinned release](https://github.com/jacoco/jacoco/tree/v0.8.15).

The classifier recognises bytecode structure, not a list of source filenames or
line numbers. Coroutine completion checks use Kotlin SMAP mappings, require a
source-only closing delimiter, and are scoped to the Compose gesture and
snapshot-flow APIs used by these lambdas. They remove only implicit compiler
completion instructions on that delimiter line; they do not claim the API is
unreachable. Ordinary source lambdas, branch-bearing forwarding methods and
explicit source `return Unit` statements remain measured. Every correction
includes its instruction signature in `generated-code-audit.txt`.

Kotlin 2.4 captured-state invalidation decisions are recognised only inside a
single `CC(remember)` source-information region when the integer masks use
integer `$changed` or `$dirty` locals corresponding to `int` parameters after
the Composer parameter (or a `$dirty` local copied from one), Composer
`changed` calls feed the mask expression, and the result precedes that region's
`rememberedValue` cache gate. Source-named integer mask locals reject the whole
region; branches elsewhere in the method remain measured. Cache-gate branches
already handled by upstream JaCoCo filters are left to those filters.

Run the regression fixtures from `apps/android`:

```sh
./gradlew :coverage-report-tool:regressionTest
```

`debugCoverageTable` retains `coverage-raw.xml`, produces the corrected
`coverage.xml`, verifies matching execution-probe class identities, and checks
that every removed branch outcome is explained by exactly one audited
conditional decision. The raw branch counters remain available for comparison;
an unrecognised pattern stays counted.
