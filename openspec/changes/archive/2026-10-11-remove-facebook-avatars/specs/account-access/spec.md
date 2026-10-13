## ADDED Requirements

### Requirement: Supported profile image sources

The system SHALL support uploaded photos, Gravatar and no profile photo. It
SHALL NOT request Facebook images. Stored Facebook avatar selections SHALL be
interpreted as no profile photo without preventing unrelated account updates.
New Facebook avatar selections SHALL be rejected. Legacy social connections
SHALL remain removable independently of profile images.

#### Scenario: Member has a stored Facebook avatar selection

- **WHEN** a legacy member document with a Facebook avatar selection is loaded
- **THEN** the selection is interpreted as no profile photo
- **AND** the client displays its normal placeholder without contacting Facebook
- **AND** the member can save unrelated profile changes or choose a supported image source

#### Scenario: Member requests a Facebook image source

- **WHEN** a member submits Facebook as a new avatar selection or explicit avatar source
- **THEN** the server rejects the unsupported source

#### Scenario: Member removes a legacy Facebook connection

- **WHEN** a member disconnects stored Facebook provider data
- **THEN** the connection is removed without enabling Facebook profile images
