## ADDED Requirements

### Requirement: Consistent formatted content

The browser SHALL render descriptions, notes, message bodies and message previews using a shared formatting policy aligned with the server formatter. Only supported formatting elements, per-element attributes and link schemes SHALL be retained. Message content SHALL retain only same-origin HTTP links. Plain-text excerpts SHALL be derived from complete markup, and externally supplied editor content SHALL use the same formatting policy without disturbing ordinary typing.

#### Scenario: Formatted content is displayed

- **WHEN** an existing display surface receives formatted content
- **THEN** supported formatting and text are retained under the shared policy
- **AND** unsupported elements and attributes are omitted

#### Scenario: A member expands a description

- **WHEN** a description exceeds its preview limit
- **THEN** the collapsed preview is literal plain text
- **AND** expanding it displays the complete formatted content under the shared policy

#### Scenario: An editor receives replacement content

- **WHEN** initial or externally replaced editor content is applied
- **THEN** the shared formatting policy is applied before insertion
- **AND** ordinary input does not reset the caret or emit duplicate changes
