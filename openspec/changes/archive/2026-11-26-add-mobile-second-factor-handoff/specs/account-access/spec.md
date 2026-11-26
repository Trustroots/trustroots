## ADDED Requirements

### Requirement: Mobile sign-in with two-factor authentication

Android and iOS MUST let a member with two-factor authentication complete the website sign-in in the system browser using an authenticator code, recovery code or registered passkey. The service MUST issue mobile credentials only after the browser session satisfies the account's current sign-in requirements and the app redeems an expiring code bound to its pending sign-in.

#### Scenario: Return after confirming a second factor

- **WHEN** the member successfully completes browser sign-in and confirms that the app may continue
- **THEN** the service returns a single-use code to the app and accepts it only with the verifier held by the initiating app
- **AND** the app can use and refresh the resulting mobile session

#### Scenario: Reject an incomplete or stale sign-in

- **WHEN** the browser has not completed the required second factor, the account credentials change, or the code is expired, unbound or already used
- **THEN** the service does not issue mobile credentials for that handoff
