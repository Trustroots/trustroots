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

## MODIFIED Requirements

### Requirement: Profile photo management

The system SHALL accept supported profile-photo uploads and explain when an
upload cannot be used.

The system SHALL keep avatar decoding bounded to the configured input limit (20 MiB by default), one frame,
dimensions no larger than 10,000 by 10,000 pixels, 40 megapixels, bounded
processor resources and time. It SHALL generate and validate all seven
thumbnails in private staging before publishing them in a server-generated
version directory. The server-owned version pointer SHALL change only after
publication succeeds, and a failed upload SHALL preserve the previous pointer
and files. Requests for staging paths SHALL be denied before public static file
serving. Members without a version pointer SHALL continue to use their existing
flat avatar paths.

#### Scenario: Member uploads a supported photo

- **WHEN** a signed-in member uploads a supported profile photo
- **THEN** the system updates their profile photo
- **AND** the profile points to the complete new thumbnail set

#### Scenario: Avatar processing fails during replacement

- **WHEN** processing or saving a new avatar fails
- **THEN** the previous avatar pointer and files remain available
- **AND** temporary input and unpublished output are cleaned up

#### Scenario: Member uploads an unsupported photo

- **WHEN** a signed-in member uploads an unsupported file as a profile photo
- **THEN** the system explains that the file type is not supported

#### Scenario: Image exceeds a processing bound

- **WHEN** a member uploads an image exceeding a configured dimension, frame or
  resource bound
- **THEN** the system rejects the upload and removes private temporary output
- **AND** the previous avatar remains available

#### Scenario: Avatar processing succeeds

- **WHEN** every required thumbnail is generated within the processing bounds
- **THEN** the system publishes the complete processed set with metadata removed

#### Scenario: Processing fails or times out

- **WHEN** thumbnail generation fails or reaches its time budget
- **THEN** the system stops processing and cleans private staging without
  publishing incomplete output

