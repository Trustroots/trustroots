## ADDED Requirements

### Requirement: Android embedded browser Nostr signing

The signed-in Android app SHALL expose NIP-07 public-key lookup and event
signing to top-level HTTPS Trustroots and Hitchwiki pages on port 443 through
WebView's origin-aware bridge. It SHALL bind requests to the active server,
member, document and key and SHALL NOT return private-key material.

#### Scenario: Member signs a Radio event

- **WHEN** a signed-in member with a local key opens Radio in the embedded browser
- **THEN** the trusted page can obtain the public key and sign a Radio event

#### Scenario: Frame, document or identity is ineligible

- **WHEN** a request comes from an iframe or an untrusted origin, or the session, key or page changes before completion
- **THEN** the app does not return a signing result to that request
