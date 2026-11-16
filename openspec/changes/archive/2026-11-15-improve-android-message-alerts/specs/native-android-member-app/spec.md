## ADDED Requirements

### Requirement: Locked-screen message alert test

The Android app SHALL offer a locked-screen test in Account settings when message alerts are set up. After the server accepts the request, the app SHALL prompt the member to lock their phone. The received test alert SHALL identify itself as a test.

#### Scenario: A member requests a test

- **WHEN** the member taps the test action and the server accepts the request
- **THEN** the app says to lock the phone and that the alert is due in about 15 seconds
