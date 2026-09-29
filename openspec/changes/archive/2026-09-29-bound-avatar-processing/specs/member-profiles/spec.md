## ADDED Requirements

### Requirement: Bound avatar processing and publication

The system SHALL bound image dimensions, frames, processing time and decode resources. Uploaded originals and incomplete thumbnails SHALL remain outside public serving paths. The system SHALL publish processed thumbnails only after the complete set succeeds and SHALL remove rejected temporary files without replacing the previous valid avatar.

#### Scenario: Image exceeds a processing bound

- **WHEN** a member uploads an image exceeding a configured dimension, frame or resource bound
- **THEN** the system rejects the upload and removes private temporary output
- **AND** the previous avatar remains available

#### Scenario: Avatar processing succeeds

- **WHEN** every required thumbnail is generated within the processing bounds
- **THEN** the system publishes the complete processed set with metadata removed

#### Scenario: Processing fails or times out

- **WHEN** thumbnail generation fails or reaches its time budget
- **THEN** the system stops processing and cleans private staging without publishing incomplete output
