## ADDED Requirements

### Requirement: React messaging pages

The system SHALL render the inbox and conversation pages with the React
application shell while preserving existing messaging access and behaviour.

#### Scenario: Member opens the inbox

- **WHEN** an authenticated member opens `/messages`
- **THEN** the React shell displays their conversations and unread count
- **AND** inbox pagination continues to use the existing message API

#### Scenario: Member opens and replies to a conversation

- **WHEN** an authenticated member opens `/messages/:username`
- **THEN** the React shell displays the existing thread and reply controls
- **AND** read state and unread count update through the existing APIs

#### Scenario: Angular page links to messaging

- **WHEN** a member follows an Angular named-state link to the inbox or thread
- **THEN** the browser opens the matching React-owned URL

#### Scenario: Visitor opens a messaging page

- **WHEN** a signed-out visitor opens a messaging URL
- **THEN** the page redirects to sign in without displaying messages
