## ADDED Requirements

### Requirement: Nostroots onboarding handoff

The system SHALL offer a translated Continue in Nostroots action from community
note action options and profile network settings. It SHALL use the fixed
`https://nos.trustroots.org/open/onboarding` route, with only the signed-in
viewer's URL-encoded username as optional query context. The action SHALL explain
that it starts account setup rather than automatically signing in, and SHALL
instruct members to return to the original link after installing the app.

#### Scenario: Signed-in member continues from another member's notes

- **WHEN** a signed-in member opens Nostroots action options on another profile
- **THEN** the onboarding link includes the viewer's username
- **AND** does not include the viewed author's username, keys or credentials
- **AND** the existing browser and direct-store alternatives remain available
- **AND** no event, profile or map continuation is promised

#### Scenario: Signed-out visitor continues

- **WHEN** a signed-out visitor opens the onboarding action
- **THEN** the onboarding URL contains no username or other query context

#### Scenario: Member visits network settings

- **WHEN** a member opens their network settings
- **THEN** the onboarding action appears above the public-key field
- **AND** existing public-key editing and browser-extension suggestions remain usable

#### Scenario: Desktop member moves to their phone

- **WHEN** a member views the onboarding action on a desktop viewport
- **THEN** the system offers a QR code generated locally from the exact action URL
- **AND** scanning preserves the username context
- **AND** a mobile viewport retains the direct action and installation guidance

#### Scenario: Aggregate onboarding measurement

- **WHEN** a member follows an onboarding link with analytics available
- **THEN** the click can be counted by community-notes, profile-notes or network-settings entry point
- **AND** the event properties contain no username, public key or credentials
- **AND** following the link does not depend on analytics being available
