## Why

The signed-out Android flow still keeps sign-up and password-reset pages in a
Compose-local browser selector, while its form ViewModel is held by an
Activity-level child store. That leaves Back, route restoration and browser
origins outside the Navigation 3 route model used by the rest of the app.

## What Changes

- Represent the signed-out destination as a real Navigation 3 stack with a
  `SignInVisit` root and purpose-specific `SignInBrowserVisit` children for
  sign-up and forgotten-password pages.
- Keep a single Activity-retained store holder as the Navigation 3 destination
  container. Obtain the form ViewModel from the decorated `SignInVisit` entry,
  preserve its credentials and in-flight request across Activity recreation,
  and clear the destination store after successful authentication or when the
  API backend changes.
- Keep route keys limited to browser purpose and unique visit identity. Derive
  translated titles and URLs from resources and the existing browser registry;
  runtime cookies and credentials remain outside saved state.
- Cancel sign-in work and reject stale results when its actual entry is
  removed. Never store username/password in Navigation 3 keys or saved state.
- Move the remaining SignIn screen and browser title text into Android string
  resources so Android locale configuration selects the UI language.

## Capabilities

### Modified Capabilities

- `native-android-member-app`: define origin-aware signed-out navigation,
  entry-scoped sign-in state and credential-safe restoration.

## Impact

- Android signed-out UI and destination ownership under `apps/android`.
- SignIn ViewModel lifecycle and Android navigation journey tests.
- SignIn string resources only; no server, API, persistent account-data,
  web/iOS or authentication-contract changes.
