## ADDED Requirements

### Requirement: External profile links for restricted viewers

The system SHALL omit another member's external social, hospitality-network,
and Nostr identifiers when the authenticated viewer is shadowbanned.

#### Scenario: Shadowbanned member views another profile

- **WHEN** a shadowbanned member views another member's public profile
- **THEN** the profile response omits external social, hospitality-network, and
  Nostr identifiers

#### Scenario: Member views their own profile

- **WHEN** a member views their own profile
- **THEN** their external network identifiers remain available

### Requirement: Contact details for restricted viewers

The system SHALL remove detected URLs, email addresses, and phone numbers from
other members' profile and offer descriptions when the authenticated viewer is
shadowbanned.

#### Scenario: Shadowbanned member views another member's description

- **WHEN** a shadowbanned member views another member's profile or offer
- **THEN** detected URLs, email addresses, and phone numbers are omitted from
  the returned description

#### Scenario: Member views their own content

- **WHEN** a member views their own profile or offer
- **THEN** their description remains available with its contact details
