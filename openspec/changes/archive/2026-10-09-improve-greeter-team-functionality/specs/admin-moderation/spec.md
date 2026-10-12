## ADDED Requirements

### Requirement: Acquisition profile visibility filtering

The acquisition stories view SHALL offer an accessible All / Visible / Hidden profile visibility selector, defaulting to All. It SHALL combine with Unassigned only over the loaded latest 500 stories, preserve sorting, and avoid refetching. Controls SHALL remain available with an explanatory empty state. Hidden profiles SHALL be explained as signups not yet activated through email confirmation, rather than deactivated accounts or necessarily missing descriptions.

#### Scenario: Greeter combines filters

- **WHEN** a greeter selects Hidden and Unassigned only
- **THEN** only hidden, unassigned rows are shown in the selected order without another request

#### Scenario: Filter matches no stories

- **WHEN** no loaded stories match the filters
- **THEN** an empty-result explanation and both filter controls remain visible
