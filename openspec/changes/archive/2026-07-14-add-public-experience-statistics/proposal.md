## Why

The public statistics page shows membership and hosting information, but not
the community experiences that members have shared. Visitors cannot see either
how much experience feedback has been contributed or how often members
recommend one another.

## What Changes

- Add all-time and trailing-90-day counts for public experiences to the public
  statistics API and page.
- Show the number of public experiences whose author recommends the member
  they describe, and the percentage among answered recommendations. Skipped
  recommendations are excluded from that percentage.
- Show the number of public experiences that record a real-life meeting,
  all-time and during the trailing 90 days.
- Clarify the existing embedded message chart without changing its Grafana
  dashboard or query.
- Correct the statistics-page label from “Translations status” to “Translation
  status”.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `experiences-references`: publish aggregate counts for public experiences
  and their recommendation outcome on the public statistics page.
- `public-access`: expose the additional public statistics data to visitors.

## Impact

- `modules/statistics` server and client components, API tests, and page tests.
- `modules/experiences` public experience data is read in aggregate only;
  individual experience content and private experiences remain unexposed.
- No schema or data migration, dependency, or Grafana change is required.
