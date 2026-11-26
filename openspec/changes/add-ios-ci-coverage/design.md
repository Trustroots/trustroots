## Context

`.github/workflows/ios.yml` runs `xcodebuild … test` on a pinned Xcode and
simulator without `-enableCodeCoverage` or a result bundle. Android's debug
workflow already builds coverage inputs, merges device/unit reports, publishes a
markdown table to the job summary, and enforces
`apps/android/coverage-baseline.json`. Contributors asked for comparable iOS
visibility (#3934 context: screenshots stay label-gated; coverage reporting is
the complementary gap).

## Goals / Non-Goals

**Goals:**

- Collect line coverage during the existing iOS simulator unit/integration test
  job without a separate full rebuild.
- Publish a human-readable target and file summary to `$GITHUB_STEP_SUMMARY`.
- Expose a PR check named **iOS coverage** so the status list is unambiguous.
- Keep the change small: Python (or shell) reporting scripts with fixture tests,
  matching Android's script style where practical.

**Non-Goals:**

- Merging iOS numbers into the web `coverage-summary` / Pages report.
- Changing the `screenshots` label opt-in for `mobile-screenshots.yml`.
- Enforcing a coverage floor in this change before a stable baseline exists.
- UITest-only or device-farm coverage collection beyond the current simulator
  test scheme.

## Decisions

1. **Enable coverage on the existing test invocation.** Pass
   `-enableCodeCoverage YES` and `-resultBundlePath` so `xccov` can read the
   bundle. Prefer a path under the runner temp or `apps/ios/build/` that is
   uploaded then cleaned.

2. **Summarise application targets only.** Exclude `*.xctest` / `*Tests`
   bundles from the published totals so the headline figure reflects
   `Trustroots` application code, similar to ignoring test APK noise on
   Android.

3. **Separate visible check.** Keep `iOS simulator tests` for the macOS job
   that builds and tests. Add an `iOS coverage` job that needs that job,
   downloads the JSON summary artefact, republishes it to the step summary, and
   fails if the summary is missing. This mirrors Android's named coverage gate
   without duplicating the expensive simulator work.

4. **Defer the ratchet.** Implement extraction/summary scripts now. Seed
   `apps/ios/coverage-baseline.json` and wire a floor check only after a green
   CI run produces a stable `coveredLines` / `executableLines` measurement.
   Document that follow-up in tasks so the MVP stays reviewable.

5. **British spelling in new prose**; leave identifiers and Xcode terms
   unchanged.

## Risks / Trade-offs

- Coverage instrumentation can slow the simulator job slightly; acceptable for
  PR visibility.
- First runs may show low percentages until more of the app is exercised by
  unit tests; publishing the truth is still more useful than hiding it.
- Without a ratchet, coverage can regress silently until the follow-up lands;
  the published summary and artefact mitigate that for attentive reviewers.
