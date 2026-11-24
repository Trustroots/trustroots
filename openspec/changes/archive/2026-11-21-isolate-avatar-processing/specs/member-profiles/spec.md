## ADDED Requirements

### Requirement: Avatar processing worker lifecycle

The system SHALL run native avatar thumbnail generation in a child process for each upload.

#### Scenario: The upload deadline expires during processing

- **WHEN** the upload deadline expires while the child process is generating thumbnails
- **THEN** the system SHALL stop the child process and wait for it to exit before cleaning the private staging directory and releasing the processing slot
