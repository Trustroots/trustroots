## ADDED Requirements

### Requirement: Android inbox last message time

The Android inbox SHALL show the last message time for each thread when its timestamp is available, using the same time formatting as messages in a conversation. It SHALL omit the time if the timestamp is missing or invalid.

#### Scenario: Thread has a timestamp

- **WHEN** a member views an inbox thread with a last message timestamp
- **THEN** the thread row displays that time

#### Scenario: Thread has no valid timestamp

- **WHEN** a thread has a missing or invalid timestamp
- **THEN** the inbox displays the thread without a time
