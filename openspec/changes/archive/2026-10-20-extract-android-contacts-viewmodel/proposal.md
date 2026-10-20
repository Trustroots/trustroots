## Why

`ContactsScreen` currently owns its loaded contacts, loading indicator and
failure text in Compose state. Its request can be restarted or abandoned when
the contact list temporarily displays a selected profile, and the list state
is not explicitly tied to the Navigation 3 entry that owns the screen. Moving
the contacts request lifecycle into an entry-scoped ViewModel makes successful
loads survive Back and Activity recreation while keeping failures retryable.

## What Changes

- Add an injectable contacts repository and immutable ViewModel state/events
  for loading the signed-in member profile and their contacts.
- Scope the ViewModel to the existing Navigation 3 menu entry, cancel its work
  when that entry is removed, ignore stale completions and acknowledge session
  invalidation once.
- Keep selected-contact profile presentation in `ContactsScreen` until the
  profile child-route migration; returning to the list retains its loaded data.
- Show a retry action for recoverable load failures using existing contacts
  copy and an Android string resource.
- Add anonymous unit and Android journey coverage for successful retention,
  retry, expiry, entry teardown and Back from a contact profile.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: specify entry-owned Contacts loading state,
  recovery, session invalidation and lifecycle behaviour.

## Impact

- Android Contacts state and UI under `apps/android/app/src/main/java/org/trustroots/android/ui/contacts`.
- Android unit and instrumentation coverage for Contacts.
- No server, web, iOS, API contract or persistent account-data changes.
  Session credentials remain available only through the live repository and
  are not copied into ViewModel state or saved navigation state.
