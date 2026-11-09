# historical-spam-cleanup Specification

## Purpose

Record the retirement of the historical spam cleanup tools and the resulting administrator search behaviour.

## Requirements

### Requirement: Historical spam cleanup is retired

The system SHALL no longer expose the historical spam cleanup page, API or maintenance command. Administrator member searches SHALL display every member returned by the search API.

#### Scenario: Administrator looks for the retired cleanup tools

- **WHEN** an administrator opens the dashboard
- **THEN** the administration navigation omits the historical spam cleanup link
- **AND** the former cleanup page and API routes are unavailable

#### Scenario: Administrator searches for members

- **WHEN** an administrator submits a member search
- **THEN** the results include suspended members returned by the API
