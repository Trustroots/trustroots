## ADDED Requirements

### Requirement: Hosting editor autosave

The web hosting editor SHALL automatically persist valid changes after a short
pause. A valid offer requires a selected location and at least five characters
of description for Yes or Maybe. Opening the editor or following an
availability link SHALL leave saved availability unchanged until the member
changes it. The editor SHALL indicate pending, saved and failed changes,
support retrying a failed save, and warn before leaving with unsaved changes.
Moving the map pin SHALL count as an edit. Saving with the same precise
coordinates SHALL preserve the existing approximate public pin.

#### Scenario: Publish the first hosting offer

- **WHEN** a member supplies a valid location and the description required for their availability
- **THEN** the editor saves the offer and stays on the current section

#### Scenario: Retry a failed autosave

- **WHEN** an autosave fails
- **THEN** the editor retains the member's edits and offers a retry

### Requirement: Meetup location setup from the profile

The profile's Meet people action SHALL route members without saved hosting
coordinates to the hosting Location section and explain the next step.

#### Scenario: Continue after saving a location

- **WHEN** a member saves their first hosting location through Meet people
- **THEN** the location is saved with hosting off and the editor offers a link to meetups
