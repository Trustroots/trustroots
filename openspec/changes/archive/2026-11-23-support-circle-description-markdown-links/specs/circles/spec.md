## ADDED Requirements

### Requirement: Markdown links in web circle descriptions

The web circle description and its editor previews SHALL render inline Markdown
links of the form `[label](https://example.org/)` with HTTP or HTTPS
destinations. Existing safe HTML links SHALL remain supported.

#### Scenario: Administrator adds a Markdown link

- **WHEN** an administrator enters a labelled Markdown link with a valid HTTP
  or HTTPS destination
- **THEN** the admin preview shows the link with its label
- **AND** the public circle page shows the same link after saving

#### Scenario: A Markdown link uses an unsupported destination

- **WHEN** a Markdown link has a destination using another scheme
- **THEN** the editor previews and public circle page render it as text
