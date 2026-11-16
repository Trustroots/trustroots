## MODIFIED Requirements

### Requirement: Single-page hosting offer editor

The hosting offer editor SHALL present availability, description, and location together in one form. It SHALL support existing availability, description, and location fragment links and keep in-progress form values while members move between sections. The description section SHALL include circle visibility and guest count. The editor SHALL place location below availability on desktop with description alongside them, show a full-width map on phones, place map guidance after the map, and provide a prominent save action at the end of the form. The editor SHALL warn before leaving with unsaved changes and allow a successful save to exit without a warning.

#### Scenario: Edit all settings on one page

- **WHEN** a member opens the hosting offer editor
- **THEN** they can change availability, description, and location on the same page and submit them together

#### Scenario: Open a section directly

- **WHEN** a member opens the editor with an availability, description, or location fragment
- **THEN** the editor scrolls to the corresponding section after loading the offer

#### Scenario: Leave the editor with an unsaved draft

- **WHEN** a member changes any saved offer setting and tries to leave or reload the editor
- **THEN** they are asked before the draft is discarded
- **AND** cancelling preserves the edits

#### Scenario: Navigate within the editor or save edits

- **WHEN** a member follows a section link, reverts all changes, or successfully saves the offer
- **THEN** the editor does not ask them to confirm leaving unsaved edits
