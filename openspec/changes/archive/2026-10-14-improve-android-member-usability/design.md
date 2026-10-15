## Approach

Keep the existing Kotlin/Compose app and protected member API. Compose already
provides native pressed-state feedback. Material navigation, tabs, icons and
segmented controls supply consistent selection and accessibility semantics.

Handle orientation and screen-size configuration changes in the activity so
the existing session, nested navigation, map view and form state survive
rotation without rerunning authentication or the startup delay. Compose reads
updated configuration and measures the layout again. This does not promise
restoration after process death.

Install a composition-scoped leave guard while an editable form is visible.
The form owns the dirty comparison and discard dialog. Shell navigation passes
its pending action through that guard; successful saves bypass discard handling.
This prevents bottom navigation from silently disposing an edited form.

Use the existing Android geocoder with a debounce and cancellation for place
suggestions. A failed suggestion lookup must not prevent submitting a place.
Result-card enrichment is optional and must not prevent viewing a host offer
when a profile or circle-membership request fails.
