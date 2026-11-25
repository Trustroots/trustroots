## MODIFIED Requirements

### Requirement: Filter unassigned acquisition stories

The acquisition-stories view SHALL provide an accessible “Unassigned only” checkbox, checked by default, to authorised staff. When checked, the view SHALL show only members without an assigned greeter within the existing latest 500 stories. Filtering SHALL preserve the selected sort order. Clearing the checkbox SHALL restore loaded stories that match the other filters without refetching them. If no rows match, the view SHALL explain that no unassigned acquisition stories were found and keep the checkbox available.

#### Scenario: Show only unassigned members

- **WHEN** an authorised viewer opens Acquisition stories
- **THEN** rows with an assigned greeter are hidden
- **AND** rows marked Unassigned remain in the selected sort order

#### Scenario: Restore all stories

- **WHEN** the viewer clears Unassigned only
- **THEN** all loaded rows matching the other filters return in the selected sort order

#### Scenario: No unassigned stories

- **WHEN** Unassigned only is checked and no loaded members are unassigned
- **THEN** the view shows a filtered empty state and the checkbox remains available

### Requirement: Acquisition profile visibility filtering

The acquisition stories view SHALL offer an accessible All / Visible / Hidden profile visibility selector, defaulting to Visible. It SHALL combine with Unassigned only over the loaded latest 500 stories, preserve sorting, and avoid refetching. Controls SHALL remain available with an explanatory empty state. The view SHALL treat shadowbanned profiles as Hidden when displaying, filtering and sorting rows, even if their public profile flag is set. The visibility help text SHALL explain that Hidden includes unconfirmed signups and shadowbanned accounts.

#### Scenario: Shadowbanned profile is hidden

- **WHEN** an authorised viewer opens Acquisition stories with an unassigned shadowbanned member whose public profile flag is set
- **THEN** the default Visible filter excludes that member
- **AND** selecting Hidden shows the row labelled Hidden with its Shadowbanned badge

#### Scenario: Greeter combines filters

- **WHEN** a greeter selects Hidden and Unassigned only
- **THEN** only hidden, unassigned rows are shown in the selected order without another request

#### Scenario: Filter matches no stories

- **WHEN** no loaded stories match the filters
- **THEN** an empty-result explanation and both filter controls remain visible
