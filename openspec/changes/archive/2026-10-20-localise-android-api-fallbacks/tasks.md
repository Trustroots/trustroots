## 1. API failure metadata

- [x] 1.1 Add context-free identifiers for `SignInRejected`, `MissingSession`,
      and `RequestRejected`; do not add English fallback `Throwable.message`
      values solely for internal-test compatibility.
- [x] 1.2 Attach identifier and optional nonblank server message metadata to
      API-generated failures without adding Android dependencies to the API
      package.
- [x] 1.3 Add API tests for all three identifiers, absence of fabricated
      English defaults, server message precedence, and absent/blank response
      messages.

## 2. Resource-backed error presentation

- [x] 2.1 Add a context-free UI failure value containing optional server text,
      API failure identity, and a screen fallback identity; add English XML
      resources for API and screen fallback cases.
- [x] 2.2 Replace String-only `messageOr` handling at all current error-state
      consumers with metadata that is resolved using `stringResource` in
      composition, including `SignInViewModel`, `CirclesViewModel`, and
      Compose-local error state.
- [x] 2.3 Add UI tests for server-text precedence, each API fallback, unknown
      exception fallback, and locale changes while failure state is retained.

## 3. Unknown member label

- [x] 3.1 Remove translated fallback text from `MessageMember` and resolve an
      absent display name and username using the existing member-label XML
      resource at Compose call sites.
- [x] 3.2 Update API parsing and UI tests for normal names and the unknown-member
      resource fallback.

## 4. Verification

- [x] 4.1 Validate the OpenSpec change and run appropriate Android API and UI
      tests after implementation.
