# Add admin newsletter audience builder

## Why

Administrators can export every eligible newsletter subscriber or the members
of one circle, but cannot build a targeted recipient list from member
locations, hosting locations, or several circles. Producing those lists
currently requires a manual database query and risks applying newsletter
eligibility rules inconsistently.

## What Changes

- Add an administration audience builder that can filter eligible newsletter
  subscribers by:
  - living-location text;
  - origin-location text;
  - active hosting offers within a configurable radius;
  - membership of one or more selected circles.
- Treat selected location sources as alternatives and selected circles as
  alternatives. When both location and circle criteria are supplied, require a
  subscriber to match both groups.
- Preview the number of eligible recipients before exporting the resulting CSV.
- Always require a public profile and newsletter consent, and exclude
  suspended, shadowbanned, and profile-deletion-pending members.
- Record audience preview and export requests in the administration audit log.

## Affected Modules

- `modules/admin` (audience API, query validation, builder UI, and tests)
- `modules/offers` (read-only hosting-location query)
- `modules/tribes` (circle choices displayed by the builder)
- `tests/e2e` (administration newsletter audience flow)

## Compatibility

Existing all-subscriber, single-circle, and CSV-splitting tools remain
available. No data migration or new database index is required; the audience
builder uses the existing user membership data and offer location index.

## Deployment

The change is deployed with the existing web application. Hosting-radius
queries use the legacy `[latitude, longitude]` offer coordinate order already
used by the application.
