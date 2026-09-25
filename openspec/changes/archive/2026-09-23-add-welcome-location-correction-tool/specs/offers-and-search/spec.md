## ADDED Requirements

### Requirement: Welcome team location correction

The system SHALL let welcome team members review active offers whose actual stored location matches the former default coordinates or lies within the historic nearby area. It SHALL distinguish exact and nearby matches and group offers by member.

#### Scenario: Welcome team reviews candidates

- **WHEN** a welcome team member opens the location correction queue
- **THEN** they see eligible members with uncontacted exact and nearby offers, without changing those offers or sending messages

#### Scenario: Welcome team contacts a member

- **WHEN** a welcome team member reviews a candidate and sends an editable correction message
- **THEN** the member receives one ordinary Trustroots message from that team member and the reviewed offer locations are marked contacted

#### Scenario: Send is retried

- **WHEN** the same contact request is retried or another team member acts on the same unchanged offer locations
- **THEN** no duplicate correction message is created

#### Scenario: Offer location changes

- **WHEN** a contacted offer's stored location changes while remaining in the nearby area
- **THEN** it can be reviewed again at the new location

#### Scenario: Unauthorised access

- **WHEN** a member without the welcome team or admin role requests the queue or contact endpoint
- **THEN** access is denied

## MODIFIED Requirements

### Requirement: Hosting offers

The system SHALL let a member create, update, list, and remove their hosting offer. A newly created offer SHALL require an explicitly selected location.

#### Scenario: Member creates or updates a hosting offer

- **WHEN** a member saves valid hosting-offer details
- **THEN** the system makes the updated hosting offer available in the member's offer list and search results

#### Scenario: Member removes a hosting offer

- **WHEN** a member removes or disables their hosting offer
- **THEN** the offer is no longer available as an active hosting offer

#### Scenario: Member creates a hosting offer without choosing a location

- **WHEN** a member completes other hosting details but has not chosen a location
- **THEN** the editor does not save the map's default coordinates as their offer location

### Requirement: Meeting offers

The system SHALL let a member create, edit, list, expire, and delete their meeting offers. A newly created offer SHALL require an explicitly selected location.

#### Scenario: Member manages a meeting offer

- **WHEN** a member creates or edits a valid meeting offer
- **THEN** the system saves the offer and displays it in the member's meeting-offer list

#### Scenario: Meeting offer reaches its expiry

- **WHEN** a meeting offer reaches its expiry conditions
- **THEN** the system no longer presents it as an active meeting offer

#### Scenario: Member creates a meeting offer without choosing a location

- **WHEN** a member completes other meeting details but has not chosen a location
- **THEN** the editor does not save the map's default coordinates as their offer location
