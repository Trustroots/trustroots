# Tasks

- [x] Add configured-Origin and Fetch Metadata checks for state-changing
      requests, plus a JSON-or-marker fallback and explicit request-header
      requirements for multipart uploads and originless sign-out. Preserve
      report and authenticated webhook routes.
- [x] Make sign-out POST-only and update browser, Android, and iOS clients.
- [x] Add server/client/e2e regression coverage for rejected foreign-origin
      mutations, same-origin account actions, sign-out, and supported external
      clients.
- [x] Update the account-access living specification with sign-out and the
      bounded CSRF mitigation.
- [x] Run focused checks and keep coverage and end-to-end counts intact.
