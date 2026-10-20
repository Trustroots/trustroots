## ADDED Requirements

### Requirement: Formatted Android circle descriptions

Android circle details SHALL render the supported rich-text structure from the
existing circle description field. Supported structure SHALL include
paragraphs, line breaks, unordered lists, bold and italic emphasis, underlining,
and blockquotes. Link labels and their supported child formatting SHALL remain
visible, but user-written links SHALL NOT be clickable. Description markup
SHALL NOT load images or embedded content. Circle filtering SHALL continue to
search the visible description text.

#### Scenario: Member views a formatted circle description

- **WHEN** a member opens a circle whose description contains supported rich
  text
- **THEN** the detail displays its paragraph, list, and inline emphasis
  structure
- **AND** the circle membership action remains reachable by scrolling

#### Scenario: Description contains a link

- **WHEN** a circle description contains an anchor with a label
- **THEN** Android displays the label and any supported child formatting
- **AND** activating the label does not navigate away from the circle detail

#### Scenario: Member filters by formatted description text

- **WHEN** a member filters circles using text inside a formatted description
- **THEN** the matching circle remains discoverable without exposing raw markup
