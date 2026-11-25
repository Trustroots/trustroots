## ADDED Requirements

### Requirement: Mobile profiles display independent meeting availability

Android and iOS member profiles SHALL show explicit Yes, Maybe and No meeting
preferences from the existing authorised hosting-offer response alongside the
independent accommodation status. Missing, unanswered and unrecognised
preferences SHALL be omitted. A volunteering label SHALL be visible for
current or tentative hosting offers with volunteering enabled.

#### Scenario: A member is open to meetings and cannot host

- **WHEN** a mobile profile receives an offer with hosting set to No and meeting availability set to Yes or Maybe
- **THEN** the profile shows the meeting preference and the separate non-hosting status

#### Scenario: A member leaves meeting availability unanswered

- **WHEN** a mobile profile receives an offer with no recognised explicit meeting preference
- **THEN** the profile shows only the relevant accommodation and volunteering information
