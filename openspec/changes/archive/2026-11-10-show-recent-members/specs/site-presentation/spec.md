## ADDED Requirements

### Requirement: Recently active people on the homepage

The homepage SHALL show signed-in members up to eight visible confirmed contacts or public positive recommenders who were active within the last 30 days. Each person SHALL appear once, with the most recently active first and activity shown as a coarse band.

#### Scenario: A signed-in member has recent connections

- **WHEN** a signed-in member opens the homepage
- **THEN** eligible people appear above the introductory content
- **AND** hidden, restricted and mutually blocked profiles are excluded

#### Scenario: A visitor opens the homepage

- **WHEN** a signed-out visitor opens the homepage
- **THEN** the page does not request or display personalised member cards

### Requirement: Hosting map for connections

The signed-in homepage SHALL show approximate hosting locations for visible confirmed contacts and public positive recommenders with current visible hosting offers, regardless of recent activity. Offers restricted to the host's circles SHALL require a shared circle.

#### Scenario: A connection has an older activity date

- **WHEN** a connection with a visible current offer was last active more than 30 days ago
- **THEN** their approximate hosting pin appears on the map
- **AND** they are omitted from the recent cards
