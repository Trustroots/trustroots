## Implementation

- [x] Reproduce the absent clear action in a running Android regression.
- [x] Add shared rounded filter/search controls and XML action labels.
- [x] Apply them to circles, inbox, member search and place search.
- [x] Guard member and submitted geocoder results against cleared queries.

## Validation

- [x] Cover live clearing, submitted clearing, late results and keyboard actions.
- [x] Inspect screenshots, touch targets and narrow layouts.
- [x] Run Android unit tests, lint, builds, full journeys and coverage ratchet.
- [x] Run `pnpm check` before committing.
- [x] Validate and archive OpenSpec and update the living specification.

## Reproduction

On the API 36 emulator, the circle-filter regression entered `harbour`, confirmed
that the other fictional circle disappeared, and failed because there was no
node labelled `Clear circle filter`. This reproduction ran before changing the
production controls. The same test is retained as the clearing regression.

## Results

- `pnpm check` passed: 251 client suites and 1,874 tests.
- Android unit tests, lint and app/test APK builds passed.
- Full API 36 device suite passed: 270 tests, none skipped, including twelve new
  search-control journeys. Existing tests remain in place.
- The aggregate line/branch coverage ratchet passed with the baseline unchanged;
  `SearchFields.kt` reached 55/55 executable lines.
- Inspected anonymous screenshots of circle filtering, member search and place
  search. Compact-width tests verified clear/submit ordering, optional search
  mode layout and 48 dp action targets at 320 dp field width.
- The pre-change reproduction failed on the absent clear action; the retained
  regression now passes. Late member results/errors and submitted geocoder
  results cannot overwrite a cleared or replaced query.
