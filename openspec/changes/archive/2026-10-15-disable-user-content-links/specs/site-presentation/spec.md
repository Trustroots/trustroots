## ADDED Requirements

### Requirement: Non-clickable links in user-written content

The web application SHALL render all anchors embedded in user-written content as their visible children without clickable destinations, preserving supported formatting. This SHALL apply to existing and new content, previews and administrative displays. Stored content, emails and exports SHALL remain unchanged.

#### Scenario: Display a linked description or message

- **WHEN** user-written content contains external, internal, relative, email or telephone links
- **THEN** its labels and supported formatting remain visible without clickable anchors
- **AND** application navigation outside that content remains clickable

### Requirement: Editor formatting without link controls

The shared rich text editor SHALL omit link creation and clickable link previews while retaining other formatting controls and pasted HTML.

#### Scenario: Select text in the editor

- **WHEN** a member selects draft text
- **THEN** formatting controls are available without a link tool

### Requirement: Dedicated profile network exceptions

Dedicated Couchers, BeWelcome, Warmshowers, Nostr and connected social-network profile entries SHALL remain clickable. Couchsurfing entries and their profile-edit destination previews SHALL be plain text.

#### Scenario: View hospitality networks

- **WHEN** a profile contains hospitality-network entries
- **THEN** Couchers, BeWelcome and Warmshowers links remain clickable
- **AND** Couchsurfing remains visible without a clickable destination
