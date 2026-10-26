## ADDED Requirements

### Requirement: Interact with the map beneath a host preview

The Android HostDetail preview SHALL allow map pan and zoom gestures through
its visual scrim while remaining open. The preview card's controls SHALL
remain interactive. Opening a member profile from the preview SHALL continue
to replace the preview, and Back SHALL return to the retained map.

#### Scenario: Pan the map with a host preview open

- **WHEN** a member pans or zooms the map outside the host preview card
- **THEN** the map camera responds and the host preview remains open

#### Scenario: Open a profile from the host preview

- **WHEN** a member opens the host profile from the preview and presses Back
- **THEN** the profile is shown without the host preview covering it
- **AND** Back returns to the retained map with the host preview closed
