## ADDED Requirements

### Requirement: Password step-up for administration APIs

The system SHALL keep ordinary member session lifetimes for administrators and
welcome-team members. Administration APIs other than the elevation endpoint
SHALL require a recent password confirmation stored on the session. A valid
confirmation SHALL unlock administration APIs for a configured elevation window
without signing the member out of the rest of the site.

#### Scenario: Administrator unlocks admin tools

- **WHEN** an authorised administrator or welcome-team member submits their
  current password to the elevation endpoint
- **THEN** subsequent administration API requests succeed for the elevation
  window
