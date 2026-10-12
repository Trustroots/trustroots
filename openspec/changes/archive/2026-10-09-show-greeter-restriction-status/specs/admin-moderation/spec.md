## ADDED Requirements

### Requirement: Greeter-visible account restrictions

The acquisition-stories API SHALL return an allowlisted `restrictionStatuses` array containing only `suspended` and `shadowban` on each story and restricted match, without exposing full role collections. Unrestricted accounts SHALL return an empty array. The acquisition-stories view SHALL show Suspended and Shadowbanned danger badges beside the corresponding names to authorised administrators and greeters, independently of profile visibility. Existing profile access and moderation permissions SHALL remain unchanged.

#### Scenario: Greeter reviews restricted accounts

- **WHEN** a greeter opens acquisition stories containing suspended or shadowbanned members or restricted matches
- **THEN** each name displays its applicable restriction badges, including both if both apply
- **AND** the greeter gains no additional profile access or moderation actions

#### Scenario: Unrestricted member or older response

- **WHEN** a row has no restrictions or omits restriction statuses
- **THEN** the view displays no restriction badges

#### Scenario: Ordinary member requests staff statuses

- **WHEN** an ordinary member requests acquisition stories
- **THEN** access is denied
