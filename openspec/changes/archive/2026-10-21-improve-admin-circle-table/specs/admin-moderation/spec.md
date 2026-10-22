## ADDED Requirements

### Requirement: Sortable circle catalogue overview

The admin circle catalogue SHALL display circle images, left-aligned names, descriptions and numeric membership counts in a responsive table. Hidden circles SHALL retain a text visibility indicator and their numeric count. Available images SHALL use the existing versioned circle thumbnail URL. Missing images and descriptions SHALL preserve the table layout.

#### Scenario: Administrator compares circles

- **WHEN** an administrator opens the circle catalogue
- **THEN** names, descriptions and membership counts appear in separate columns
- **AND** available thumbnails appear beside the circle names
- **AND** member counts do not repeat a unit label in each row

#### Scenario: Administrator sorts a column

- **WHEN** the administrator activates a name, description or member-count column heading
- **THEN** the table sorts by that column and exposes its direction with aria-sort
- **AND** activating the heading again reverses the direction
- **AND** membership counts sort numerically
- **AND** sorting preserves the selected circle and its editing form
