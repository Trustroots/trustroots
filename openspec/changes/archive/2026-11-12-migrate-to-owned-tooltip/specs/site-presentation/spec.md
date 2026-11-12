## ADDED Requirements

### Requirement: Shared web tooltips

The web client SHALL render shared tooltips with the owned UI package.
Tooltips SHALL open on hover and on keyboard focus where the trigger is
focusable, and SHALL dismiss on Escape without moving focus.

#### Scenario: Read an action hint with the keyboard

- **WHEN** a member focuses a tooltip trigger with the keyboard
- **THEN** the tooltip appears and describes the trigger
- **AND** pressing Escape dismisses the tooltip while the trigger retains focus

#### Scenario: Read why an offer action is disabled

- **WHEN** an offer form has a disabled action with an explanatory hint
- **THEN** the member can reveal the reason with the pointer or keyboard
- **AND** the action remains disabled
