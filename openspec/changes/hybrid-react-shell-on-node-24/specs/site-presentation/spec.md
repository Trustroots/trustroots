## MODIFIED Requirements

### Requirement: Shared site footer

The system SHALL provide a consistent footer across the main site and
administration interface, including its core information links and applicable
photo credits, whether the page is rendered through the Angular shell or the
React shell.

#### Scenario: Visitor views a page with the shared footer

- **WHEN** a visitor views a page that displays the shared footer
- **THEN** the footer provides links to volunteering, rules, FAQ, privacy, and contact information
- **AND** displays applicable photo credits

#### Scenario: Administrator views the administration footer

- **WHEN** an authorised administrator views an administration page through the
  React shell
- **THEN** the administration footer uses the shared footer presentation
