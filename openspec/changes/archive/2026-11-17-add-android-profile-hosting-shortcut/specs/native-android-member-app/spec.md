## ADDED Requirements

### Requirement: Own-profile hosting shortcut

The Android app SHALL show an Edit hosting action beneath Edit your profile on the signed-in member's own profile. It SHALL open the existing native hosting editor using saved navigation and existing unsaved-change guards.

#### Scenario: Member edits their hosting from their profile

- **WHEN** the signed-in member selects Edit hosting on their own profile
- **THEN** the existing hosting editor opens
- **AND** cancelling returns to that profile

#### Scenario: Member views somebody else's profile

- **WHEN** the signed-in member views another member's profile
- **THEN** the Edit hosting action is absent
