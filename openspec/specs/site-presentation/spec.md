# Site Presentation Specification

## Purpose

Present consistent site navigation, media resources, and deployed-code
information across Trustroots pages.

## Requirements

### Requirement: Shared site footer

The system SHALL provide a consistent footer across the main site and
administration interface, including its core information links and applicable
photo credits.

#### Scenario: Visitor views a page with the shared footer

- **WHEN** a visitor views a page that displays the shared footer
- **THEN** the footer provides links to volunteering, rules, FAQ, privacy, and contact information
- **AND** displays applicable photo credits

#### Scenario: Administrator views the administration footer

- **WHEN** an authorised administrator views an administration page
- **THEN** the administration footer uses the shared footer presentation

### Requirement: Deployed-code provenance

The system SHALL display available deployed-code provenance in the footer,
including a link to the source commit and its deployment timestamp.

#### Scenario: Build metadata is available

- **WHEN** a page is rendered with valid build metadata
- **THEN** the footer displays the commit timestamp and short commit identifier
- **AND** links to the corresponding source commit

#### Scenario: Production image has no Git checkout

- **WHEN** a production image is built without a Git checkout
- **THEN** build-time metadata remains available for the deployed-code footer link

### Requirement: Media resources

The system SHALL provide links from the media page to the current Trustroots
community media repository and its downloadable assets.

#### Scenario: Visitor opens a media resource

- **WHEN** a visitor selects a style guide, screenshot collection, media archive, or logo download on the media page
- **THEN** the selected resource resolves in the Trustroots community media repository
