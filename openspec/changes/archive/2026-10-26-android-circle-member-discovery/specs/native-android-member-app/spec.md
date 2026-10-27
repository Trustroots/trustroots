## ADDED Requirements

### Requirement: Native circle member discovery

The Android app SHALL show the signed-in member's visible contacts,
recommenders, and other active members for a circle they have joined, using the
existing circle member discovery API. Each result SHALL open that member's
native profile. A failed discovery request SHALL be distinguishable from an
empty result and SHALL offer a retry.

#### Scenario: Member discovers people in a joined circle

- **WHEN** a signed-in member opens a circle they have joined
- **THEN** Android requests the circle's member groups from its existing API
- **AND** displays the returned contacts, recommenders, and active members
- **AND** each displayed member opens in the native profile flow

#### Scenario: Circle member discovery fails

- **WHEN** the member groups request fails
- **THEN** Android explains that circle members could not be loaded
- **AND** provides an action to retry the request
- **AND** does not present the failure as an empty member list
