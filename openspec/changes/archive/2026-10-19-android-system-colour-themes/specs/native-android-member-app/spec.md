## ADDED Requirements

### Requirement: Android appearance follows system setting

The native Android app SHALL provide readable light and dark colour schemes
whose brand palette is defined in Android XML resources and SHALL follow the
system appearance setting. Native surfaces, text, controls and system bars
SHALL remain legible in either appearance, without automatic platform
force-dark transformation. Host map result cards SHALL remain white in both
appearances and SHALL use colours that keep their content legible on white.

#### Scenario: System uses light appearance

- **WHEN** Android is configured for light appearance
- **THEN** the app presents its Trustroots light palette and matching system
  bar colours
- **AND** representative native screens and controls have readable text and
  surfaces

#### Scenario: System uses dark appearance

- **WHEN** Android is configured for dark appearance
- **THEN** the app presents its Trustroots dark palette and matching system
  bar colours
- **AND** representative native screens and controls have readable text and
  surfaces without platform force-dark transformation

#### Scenario: Host result appears in dark appearance

- **WHEN** a member views a host result card while Android uses dark appearance
- **THEN** the card surface remains white
- **AND** its text and controls remain readable against that white surface

#### Scenario: System appearance changes while the app is open

- **WHEN** Android appearance changes from light to dark or dark to light
- **THEN** the app updates its theme and system bars to match the new system
  appearance without discarding the current screen or entered form values
