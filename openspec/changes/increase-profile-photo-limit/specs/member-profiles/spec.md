## ADDED Requirements

### Requirement: Visible profile photo upload limit

The system SHALL show the configured maximum photo file size and supported
formats beside the upload control before selection. It SHALL explain that photos
are resized automatically. The client and server SHALL use the same configured
avatar limit, defaulting to 20 MiB independently of other uploads. Bundled
reverse proxies SHALL allow multipart overhead above that default limit.

#### Scenario: Member prepares to upload a photo

- **WHEN** a member opens photo editing
- **THEN** the upload control describes the supported formats, configured maximum
  file size and automatic resizing

#### Scenario: Member uploads a larger camera photo

- **WHEN** a supported photo exceeds 10 MiB but is within the default 20 MiB limit
  and existing processing bounds
- **THEN** the system accepts it and generates the existing resized JPEG thumbnails
- **AND** the original upload is removed

#### Scenario: Member selects an oversized photo

- **WHEN** a member selects a photo exceeding the configured avatar limit
- **THEN** the client prevents the upload and explains the same limit shown
  beside the control
- **AND** direct uploads exceeding that limit are rejected by the server
