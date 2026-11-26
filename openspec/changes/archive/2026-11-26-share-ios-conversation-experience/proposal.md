# Share the regular iOS conversation Experience form

## Why

The regular iOS conversation uses Compose and opens a native Experience sheet.
Share the form presentation while preserving the existing iOS submission flow.

## What changes

- Present the interaction choices, recommendation, optional public feedback,
  validation, submission and error states in shared Compose.
- Keep sheet presentation, Cancel, session checks and Experience API calls in
  the iOS host.
- Cover the authenticated payload and a manual retry using the existing
  simulator fixture.
