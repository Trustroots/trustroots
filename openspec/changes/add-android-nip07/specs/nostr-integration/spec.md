## ADDED Requirements

### Requirement: Android embedded browser Nostr signing

The signed-in Android app SHALL expose NIP-07 public-key lookup and event
signing to top-level HTTPS pages on the Trustroots and Hitchwiki apex and www
origins on port 443 through
WebView's origin-aware bridge. It SHALL bind requests to the active server,
member, document and key and SHALL NOT return private-key material. The app
SHALL show the requesting origin and event in native UI and require explicit
approval for each event signature.

#### Scenario: Member signs a Radio event

- **WHEN** a signed-in member with a local key approves a Radio signing request in the embedded browser
- **THEN** the trusted page receives a signature for the event shown

#### Scenario: Member declines or leaves the approval prompt

- **WHEN** the member declines, dismisses or times out of the approval prompt
- **THEN** the page receives no signature

#### Scenario: Frame, document or identity is ineligible

- **WHEN** a request comes from an iframe or an untrusted origin, or the session, key or page changes before completion
- **THEN** the app does not return a signing result to that request
