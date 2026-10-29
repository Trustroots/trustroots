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

The pinned upstream JaCoCo Compose filters own changed-mask preamble decisions;
the custom classifier leaves those branches to upstream. Its composable
default-mask rule recognises a branch only in an annotated Kotlin composable
whose Composer parameter is followed by exactly one `$changed` integer and one
unnamed default-mask integer. A second hidden slot named in the `$changed`
family is ambiguous and fails closed. The mask bit must map by source parameter ordinal to the
exact JVM local that receives the default value. Only the branch is ignored;
default-expression instructions remain counted. The default-value arm must
contain no branch and end in a store to that parameter. This handles
Compose-transformed composables where the compiler omits the hidden default
mask's local-variable name; the method annotation, Kotlin metadata, parameter
layout, changed-mask local, and bit-to-store mapping provide the proof.

The custom rule skips branch nodes already changed by upstream JaCoCo filters.
Regression fixtures cover missing Kotlin/Composable provenance, explicit
Composer-like source parameters before the compiler Composer parameter, a second
changed-mask slot, and branching default-value expressions. Ambiguous layouts
fail closed.

Run the regression fixtures from `apps/android`:

```sh
./gradlew :coverage-report-tool:regressionTest
```

`debugCoverageTable` retains `coverage-raw.xml`, produces the corrected
`coverage.xml`, verifies matching execution-probe class identities, and checks
that every removed branch outcome is explained by an audited generated-code
pattern: each removed conditional decision accounts for two outcomes and each
proven exhaustive enum switch default accounts for one. Enum switch defaults are replaced
only when the switch input is loaded from Kotlin's `$EnumSwitchMapping$` array,
looked up by `Enum.ordinal()`, and its default target is the exact Compose
generated exception block. A conditional default is replaced only for a
verified single-entry enum whose ordinal mapping is compared with its sole case
value and whose unequal target is that same generated exception block. Its
generated conditional decision is removed as a whole, while code in the valid
case remains measured. Integer comparisons and source-bearing defaults stay
counted. A tracking output records branches already ignored, merged, or
replaced by upstream JaCoCo filters, so the custom filter does not count the
same outcome twice. The raw branch counters remain available for comparison;
an unrecognised pattern stays counted.
