## ADDED Requirements

### Requirement: Filter unassigned acquisition stories

The acquisition-stories view SHALL provide an accessible “Unassigned only” checkbox, unchecked by default, to administrators and greeters. When checked, the view SHALL show only members without an assigned greeter within the existing latest 500 stories. Filtering SHALL preserve the selected sort order. Clearing the checkbox SHALL restore all loaded stories without refetching them. If no rows match, the view SHALL explain that no unassigned acquisition stories were found and keep the checkbox available.

#### Scenario: Show only unassigned members

- **WHEN** an authorised viewer checks Unassigned only
- **THEN** rows with an assigned greeter are hidden
- **AND** rows marked Unassigned remain in the selected sort order

#### Scenario: Restore all stories

- **WHEN** the viewer clears Unassigned only
- **THEN** all loaded rows return in the selected sort order

#### Scenario: No unassigned stories

- **WHEN** Unassigned only is checked and no loaded members are unassigned
- **THEN** the view shows a filtered empty state and the checkbox remains available
