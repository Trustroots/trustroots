## MODIFIED Requirements

### Requirement: Native destinations remain the application defaults

The existing Android navigation and the regular iOS member shell SHALL remain
available while shared screens are promoted individually.

#### Scenario: Existing Android destinations continue to launch

- **WHEN** the Android app is launched normally
- **THEN** the existing Android navigation and destinations remain in use

#### Scenario: Existing iOS destinations continue to launch

- **WHEN** a signed-in member launches the iOS app normally
- **THEN** shared Home opens within the regular SwiftUI member shell
- **AND** Search, Messages and Menu remain available

### Requirement: Mobile apps can preview shared Home in the regular member shell

Android debug builds SHALL offer shared Home through an explicit launch option.
The regular iOS app SHALL show shared Home as the signed-in default. The
member shell SHALL retain Search and Messages tabs and access to Circles from
Android Profile or iOS Menu when shared Home is in use. Shared Home SHALL reuse
the host session and native profile navigation.

#### Scenario: Open a connection in the regular app shell

- **GIVEN** a member opens shared Home in the regular member shell
- **WHEN** they open a connection from the Home dashboard
- **THEN** the regular platform profile screen opens using the existing session
- **AND** dismissing the profile returns to Home with the regular tab bar available

## ADDED Requirements

### Requirement: Regular iOS Messages uses the Compose inbox

The regular iOS Messages tab SHALL present a Compose inbox with conversation
avatars, excerpts, timestamps and unread state. It SHALL reuse existing iOS
pagination, filtering by member or message content, and offline cache behaviour.
Tapping a conversation SHALL open the regular iOS conversation. Returning to
the inbox SHALL refresh unread state and preserve the current filter.

#### Scenario: Filter conversations and return to the inbox

- **GIVEN** the member has an unread conversation
- **WHEN** they filter the inbox, open the conversation and go Back
- **THEN** the filter is still applied
- **AND** the inbox displays the read state returned by the API
