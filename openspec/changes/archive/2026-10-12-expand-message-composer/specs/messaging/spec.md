## ADDED Requirements

### Requirement: Expandable message composer

The system SHALL let members expand and collapse the opening-message and reply composer on desktop and mobile. Expanded mode SHALL use the available conversation area, preserve the draft and preview state, and keep the size toggle and Send action visible. Drafts exceeding the available area SHALL remain scrollable.

#### Scenario: Member expands a draft

- **WHEN** a member selects Expand while composing a message
- **THEN** the writing area fills the available conversation area
- **AND** the draft content is preserved
- **AND** the control reports its expanded state to assistive technology

#### Scenario: Member collapses or previews an expanded draft

- **WHEN** a member collapses the composer or switches between editing and preview
- **THEN** the draft content is preserved
- **AND** preview toggling retains the selected composer size
- **AND** Send remains available

#### Scenario: Available mobile height changes

- **WHEN** the viewport or virtual keyboard changes the available height
- **THEN** the expanded editor fits the available conversation area
- **AND** the size toggle and Send action remain visible
