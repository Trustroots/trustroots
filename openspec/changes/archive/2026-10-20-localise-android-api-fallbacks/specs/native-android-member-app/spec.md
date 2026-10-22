## ADDED Requirements

### Requirement: Localised API and screen failure fallbacks

The Android member application SHALL represent app-generated API and
screen-specific fallback failures using stable identifiers and optional
nonblank server-provided text. API and ViewModel layers SHALL remain independent
of Android resources and SHALL NOT retain translated strings in failure state.
Composable UI SHALL resolve fallback identifiers through the active Android
string resources. A nonblank server-provided error message SHALL continue to
take precedence and be displayed verbatim. Existing English default wording
SHALL remain the default resource copy, not a fabricated API exception message
retained for internal-test compatibility. API diagnostics MAY use
machine-readable codes.

#### Scenario: Server supplies an error message

- **WHEN** an API request fails and the response contains a nonblank message
- **THEN** the Android UI displays that server-provided message
- **AND** it does not replace it with the local fallback resource

#### Scenario: API response omits a rejection message

- **WHEN** sign-in is rejected or another request receives an error response
  without a nonblank message
- **THEN** the API result carries the corresponding context-free failure
  identifier
- **AND** the UI displays the matching string resource for the current locale
- **AND** the API failure carries no fabricated English fallback message

#### Scenario: Successful sign-in response omits a member session

- **WHEN** a successful sign-in response has no member session cookie
- **THEN** the API result identifies the `MissingSession` fallback
- **AND** the UI resolves its message using the active locale's resource

#### Scenario: Error state is owned by an integrated ViewModel

- **WHEN** `SignInViewModel` or `CirclesViewModel` retains a failure across a
  recomposition or configuration change
- **THEN** it retains the failure kind and optional nonblank server text
- **AND** the UI resolves fallback copy from the currently active resources

#### Scenario: Locale changes while an error is retained

- **WHEN** the Android resource configuration changes while a fallback failure
  remains in UI or ViewModel state
- **THEN** the failure continues to carry its identifier and optional server
  text
- **AND** the UI displays the fallback in the newly active locale

### Requirement: Localised unknown member label

The Android API member models SHALL retain server-derived display names and
usernames without embedding translated fallback copy. Compose presentation
SHALL use the existing `profile_photo_default_member_label` string resource
when neither a nonblank display name nor a username is available.

#### Scenario: Member payload has no usable name

- **WHEN** a member has a blank display name and no username
- **THEN** the UI displays the default member label from the active Android
  string resources
- **AND** the API model remains independent of Android resources
