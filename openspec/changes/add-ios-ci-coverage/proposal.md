## Why

iOS continuous integration currently runs simulator tests without collecting or
publishing code coverage. Android already exposes PR-visible coverage jobs,
summaries and a ratchet. Contributors working on the native iOS app cannot see
line coverage for the Trustroots target in GitHub Actions, so regressions are
harder to notice than on Android. Related issue #3934 improves mobile screenshot
visibility as a label opt-in; this change separately adds always-on iOS coverage
reporting for the simulator test path.

## What Changes

- Enable Xcode code coverage for the iOS simulator test job and retain an
  `.xcresult` bundle for inspection.
- Extract a readable line-coverage summary for application targets (excluding
  test bundles) and publish it to `$GITHUB_STEP_SUMMARY`.
- Upload coverage artefacts (JSON summary and optionally the result bundle) so
  pull requests and workflow runs can inspect them.
- Add a clearly named **iOS coverage** check that depends on the simulator
  tests so coverage visibility is not buried inside a generic test job name.
- Document a follow-up to seed and enforce
  `apps/ios/coverage-baseline.json` once a stable full-suite measurement is
  available; this MVP publishes the summary without requiring a ratchet floor.

## Capabilities

### New Capabilities

- _(none)_

### Modified Capabilities

- `developer-tooling`: iOS simulator CI publishes application line-coverage
  summaries and artefacts alongside tests.
- `shared-mobile-build`: the iOS CI gate that already builds shared sources also
  collects and surfaces coverage when that job runs.

## Impact

- Changes `.github/workflows/ios.yml` and adds small reporting scripts under
  `apps/ios/scripts/`.
- Does not change the `screenshots` label gate for mobile screenshots
  (`mobile-screenshots.yml`).
- Does not fold iOS into the web `coverage-summary` job in `test.yml`.
- No runtime, API, data migration or dependency changes for members.
- Browser end-to-end tests are unsuitable for native Swift coverage; script
  unit tests and the existing iOS simulator suite provide verification.
