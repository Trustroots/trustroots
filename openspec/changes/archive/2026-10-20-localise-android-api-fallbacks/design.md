## Context

`MobileApiClient` runs without Android `Context` and returns `Result` values.
Its generated English exception messages are indistinguishable from server
text to the UI. `Throwable.messageOr` reduces failures to a `String`; several
screens then retain that string in Compose or ViewModel state. The integrated
implementation frontier includes both `SignInViewModel` and
`CirclesViewModel`, so both must carry context-free failure metadata rather
than resolved copy. `MessageMember.label` also injects an English fallback
into an API model. The app already has
`profile_photo_default_member_label` in `strings.xml`.

## Decisions

### Carry API failure identity and dynamic server text without English defaults

Add context-free API failure kinds for the generated cases `SignInRejected`,
`MissingSession`, and `RequestRejected`. A failure carries its kind and an
optional nonblank server message; app-generated fallback wording lives only in
Android string resources. Do not keep English `Throwable.message` defaults
solely to satisfy internal tests or callers. Update those tests to assert the
failure kind and optional server text. Preserve existing exception types where
useful for API semantics, but give them no fabricated English message when the
server supplied none. API diagnostics may use stable machine codes; they must
not be presented as member-facing copy.

The API layer must not import Android `R`, `Context`, or Compose types. Failure
kinds should be a small API-layer enum or sealed value with no resource IDs.
The HTTP parser continues to preserve a nonblank response `message` verbatim
and uses `RequestRejected` only when it is absent or blank. Sign-in rejection
uses the same rule with `SignInRejected` as its fallback. Blank server text is
not retained as a message.

### Resolve failure text from current resources at render time

Replace the String-only `messageOr` handoff with immutable failure metadata:
the optional nonblank server message, optional API failure kind, and a
screen-specific fallback identifier where needed. A shared composable resolver
maps those identifiers to `R.string` values with `stringResource`; a nonblank
server message takes precedence. Failures without server text use the relevant
API-kind resource or screen-specific resource. Do not retain hardcoded English
exception messages merely to preserve internal-test assertions.

Every UI error state that currently stores the result of `messageOr` must keep
this metadata, including `SignInViewModel`, `CirclesViewModel`, and
Compose-local error states. The resource lookup must not happen in ViewModels
or API code. State must not store strings already returned by `stringResource`,
so a locale change causes the UI to display the new resource text without
reloading data. Dynamic nonblank server text remains unchanged across locale
changes.

The screen-specific fallback identifiers correspond to the existing fallback
call sites: reaching Trustroots, loading circles or memberships, updating
membership, sending or loading a conversation, loading contacts/messages,
saving a profile, searching/loading hosts, loading/saving hosting offers,
sharing an experience, loading/saving an account, changing a password,
searching members, and loading a member profile. Add or reuse XML entries with
the current English wording so the default locale behavior remains the same.

### Resolve unknown member labels in UI

Remove the English fallback from `MessageMember.label`. Keep the API model's
server-derived `displayName` and nullable `username`; expose a context-free
name selection helper only if useful, but do not make it return translated
text. At Compose call sites, use the nonblank display name, then username, then
`stringResource(R.string.profile_photo_default_member_label)`. This applies to
message senders, recipients, hosts, contacts, references, and conversation
rows that use `MessageMember.label` today.

### Keep URL validation diagnostics internal

`secureApiBaseURL` validates build-time/client configuration in the API client
constructor. Its English `require` diagnostics remain developer-facing and
outside this change. Do not map these diagnostics to member-facing translated
copy.

## Testing

- API tests assert each generated failure kind, the absence of fabricated
  English fallback messages, and optional server text.
- HTTP tests assert a nonblank server message is retained and a missing or
  blank server message selects `RequestRejected` (or `SignInRejected` for
  sign-in).
- UI tests verify each failure kind resolves through the current resource and
  a nonblank server message is displayed verbatim.
- A Compose test changes the active locale or supplies a changed resource
  configuration and verifies retained failure state resolves to the new
  resource string.
- Unknown-member UI tests verify the existing member-label resource appears
  when both display name and username are absent; API parsing tests assert that
  the API model contains no translated fallback.
