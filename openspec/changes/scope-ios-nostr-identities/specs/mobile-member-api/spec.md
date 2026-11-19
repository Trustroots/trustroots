## ADDED Requirements

### Requirement: Native profile Nostr key comparison

The bearer-authenticated mobile profile endpoint SHALL include `nostrNpub` for
the profile owner and administrators, as the linked public key string or `null`
when no key is linked. It SHALL omit this field when another ordinary member
views the profile. The existing sign-in and current-member response shapes SHALL
remain unchanged.

#### Scenario: Native member checks their linked identity

- **WHEN** a signed-in member fetches their own mobile profile
- **THEN** the response includes their current linked npub or explicit `null`
- **AND** the app can compare it with an unclaimed device-local public key

#### Scenario: Another member fetches the profile

- **WHEN** a different member without administrator access fetches the mobile profile
- **THEN** the mobile response does not contain `nostrNpub`
