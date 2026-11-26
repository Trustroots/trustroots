## 1. OpenSpec

- [x] 1.1 Draft proposal, design and delta specs for iOS CI coverage visibility
- [x] 1.2 Validate the change with `openspec validate add-ios-ci-coverage --strict`

## 2. Reporting scripts

- [x] 2.1 Add a script that reads `xccov` JSON, excludes test bundles, and writes
      markdown plus a compact JSON summary of application line coverage
- [x] 2.2 Add fixture-based unit tests for the summary script
- [x] 2.3 Document a follow-up to seed `apps/ios/coverage-baseline.json` and
      enforce a light line-coverage ratchet once CI has a stable measurement

## 3. Workflow and docs

- [x] 3.1 Update `.github/workflows/ios.yml` to enable coverage, retain an
      `.xcresult` bundle, extract the summary, upload artefacts, and add an
      **iOS coverage** job that republishes the summary
- [x] 3.2 Mention iOS coverage visibility in `GITHUB.md` without changing the
      screenshots label gate
- [x] 3.3 Open a draft pull request referencing #3934 as related context

## 4. Follow-up (out of this MVP)

- [ ] 4.1 After a green CI run, commit `apps/ios/coverage-baseline.json` from the
      measured application totals and enforce it in the **iOS coverage** job
- [ ] 4.2 Consider whether iOS should appear in the web coverage overview later;
      not required for this change
