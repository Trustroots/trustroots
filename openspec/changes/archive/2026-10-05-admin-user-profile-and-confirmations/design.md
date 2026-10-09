## Context

The admin member report loads moderation data through `/api/admin/user`.
Member-facing profiles load their public fields through `/api/users/:username`,
which sanitises the response and applies viewer-sensitive access checks. The
admin React route currently does not pass its authenticated user into
`AdminUser`, although the application route context has that user available.

Role changes currently wait for `window.confirm` before calling the existing
role API. Other parts of the client use React Bootstrap `Modal` for
confirmations, which supplies an application dialog and keyboard focus
management.

## Decisions

- Reuse the existing `ProfilePage` data path and public profile components for
  the embedded member profile. Add an embedded presentation option to suppress
  the profile's global mobile navigation while keeping its profile content and
  member actions consistent.
- Pass the authenticated viewer from the admin route and select the target
  username from the loaded moderation report. Do not fabricate a viewer from
  the target report or use the target as the API viewer.
- Render the embedded profile after moderation information and notes. Keep the
  username heading and moderation action buttons in their existing order.
- Keep one confirmation modal state in `AdminUser`, storing the pending role
  and action. The modal describes the selected action, offers explicit Cancel
  and Confirm controls, prevents dismissal while a request is running, and
  reports request errors in the dialog. Confirm invokes the existing role API
  and refreshes the report as before.
- Use the standard React Bootstrap modal to provide focus management, Escape
  cancellation when idle, and screen-reader dialog semantics.

## Risks

- The public profile request intentionally uses the administrator's session;
  tests must verify that the route passes the viewer and the reported
  username separately.
- The profile view contains mobile navigation intended for a standalone page;
  the embedded mode must avoid duplicate global navigation on the admin page.
- Role changes affect access to a member account. The modal must make the
  action and target member clear and must not send an API request on cancel.
