## Controls

Provide `LiveFilterField` and `SubmittedSearchField` in `ui/common`, backed by
Material 3 filled `TextField`s with fully rounded shapes. Live filters use a
decorative leading search icon; their field labels provide the accessible name.
Submitted searches preserve the optional search-mode control and use a green
theme-primary `FilledIconButton` for submission. Clear and submit controls have
at least 48 dp touch targets and separate XML-backed accessible labels. Both
button and keyboard submission respect the caller's enabled state.

## State and clearing

The screen owns its query. Clear passes an empty value through the same update
handler as typing. Empty live filters immediately show all existing rows without
network requests. Member query changes clear displayed results and errors, and
advance a revision counter. A submitted response can update results or ordinary
errors only if its captured revision is current; authentication failures still
invalidate the session. The existing in-flight loading guard remains in place.

Place query changes advance a revision counter and empty queries dismiss
suggestions. Submitted geocoder results check that revision before moving the
map or showing lookup errors. Clear preserves the map's viewport, host results
and active filters, and does not issue a search for an empty query. The existing
suggestion effect remains cancellable when the query changes.

## Validation

First run a regression against the current app to demonstrate the missing Clear
action with anonymous fixtures. Then cover clearing live circle and inbox
filters, submitted member results, late success/error responses after clearing,
map suggestions and late submitted geocoder results. Exercise keyboard submit,
button enabled states, search-mode menus, touch targets and narrow layouts.
Capture and inspect the affected controls in the app's current light theme;
dark mode remains a separate change. Run the full Android suite and unchanged
coverage ratchet, plus `pnpm check` before committing.
