## ADDED Requirements

### Requirement: Pending Experiences authored by the profile owner

The web Experiences page SHALL show the signed-in profile owner the
Experiences they authored that are awaiting publication, soonest first.

#### Scenario: An author opens their own Experiences page

- **WHEN** the owner has an authored Experience that is private and has not been removed
- **THEN** the page shows that Experience and its recipient with the existing publication countdown
- **AND** it remains outside incoming lists and public totals

#### Scenario: A different member requests the author's pending list

- **WHEN** a signed-in member asks for another member's pending authored Experiences
- **THEN** the system denies the request and returns none of the private records
