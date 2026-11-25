## ADDED Requirements

### Requirement: iOS can edit its own host offer

The iOS app SHALL provide an own-profile editor for hosting, ongoing meeting
availability, volunteering, descriptions, guest count, circle visibility and
location, using the authenticated mobile offer endpoints. An existing offer
SHALL preload its saved coordinates. A new offer SHALL require a member-chosen
location. An empty list or HTTP 404 from offers-by SHALL open a new offer.
Other load failures SHALL keep the form unavailable until retry.

#### Scenario: Save a meeting-only offer

- **GIVEN** a signed-in member opens their hosting editor
- **WHEN** the member chooses No for hosting, enables ongoing meetings and
  saves with a valid location
- **THEN** the client saves one host offer with those separate statuses
- **AND** retains the server offer identifier for subsequent updates.
