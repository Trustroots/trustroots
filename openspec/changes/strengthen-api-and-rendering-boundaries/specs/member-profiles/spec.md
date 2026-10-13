## ADDED Requirements

### Requirement: Literal collapsed profile previews

Collapsed profile descriptions SHALL display their plain-text excerpt as literal
text while expanded descriptions retain supported rich formatting.

#### Scenario: Long description contains encoded markup

- **WHEN** a long profile description contains encoded markup characters
- **THEN** the collapsed excerpt displays those characters as text
