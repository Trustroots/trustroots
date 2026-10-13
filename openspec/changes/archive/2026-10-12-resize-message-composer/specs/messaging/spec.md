## ADDED Requirements

### Requirement: Resizable message composer

The system SHALL let members resize the opening-message and reply composer by dragging its top handle upwards or downwards using a mouse or touch. The handle SHALL support keyboard resizing. Resizing SHALL preserve the draft and preview state, fit within the available conversation area and keep Send visible. Drafts exceeding the selected height SHALL remain scrollable. A successful send SHALL restore the default composer size.

#### Scenario: Member resizes a draft

- **WHEN** a member drags the handle upwards or downwards
- **THEN** the writing area grows or shrinks within its size limits
- **AND** the draft content is preserved

#### Scenario: Member resizes using the keyboard

- **WHEN** the handle has focus and the member presses Arrow Up or Arrow Down
- **THEN** the writing area grows or shrinks
- **AND** Home and End select the minimum and maximum sizes

#### Scenario: Member previews or sends a resized draft

- **WHEN** a member switches between editing and preview
- **THEN** the draft and selected composer size are preserved
- **AND** Send remains available
- **AND** sending successfully restores the default size

#### Scenario: Available mobile height changes

- **WHEN** the viewport or virtual keyboard changes the available height
- **THEN** the resized editor fits the available conversation area
- **AND** the handle and Send action remain visible
