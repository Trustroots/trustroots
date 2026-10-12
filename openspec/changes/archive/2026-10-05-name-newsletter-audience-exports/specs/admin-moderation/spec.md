## ADDED Requirements

### Requirement: Descriptive newsletter audience export filenames

Targeted newsletter CSV download filenames SHALL include the applicable location, hosting radius, selected location sources when narrowed, selected circle names, and the local export datetime in `yyyymmdd-hhmm` format. Filter text SHALL be sanitised for use in filenames. Hosting-only audiences SHALL describe their coordinates instead of an unused text location.

#### Scenario: Administrator exports the default audience

- **WHEN** an authorised administrator exports the initial Berlin audience with a 50 kilometre hosting radius and all location sources
- **THEN** the CSV filename uses `newsletter-audience-Berlin-50km-yyyymmdd-hhmm.csv` with the actual local export datetime

#### Scenario: Administrator exports a customised audience

- **WHEN** an authorised administrator exports an audience after changing location sources, location criteria or circles
- **THEN** the CSV filename describes the selected filters and includes the local export datetime
- **AND** filename-unsafe characters from filter text are replaced
