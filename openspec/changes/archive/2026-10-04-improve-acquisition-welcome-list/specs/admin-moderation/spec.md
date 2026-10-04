## ADDED Requirements

### Requirement: Acquisition welcome context

The acquisition-stories list SHALL show a sortable Welcomer column derived from
the first non-self, non-hidden incoming message from a current welcome-team
member, including the sender's linked identity and date. Unread messages SHALL
count. Members without a qualifying message SHALL show Unassigned. Contacted
rows SHALL be subtly faded while preserving readable text and usable controls.
The API SHALL batch contact metadata without returning message content.

#### Scenario: First welcome message establishes the welcomer

- **WHEN** a welcome-team member sends a visible message to a listed member
- **THEN** reloading the list shows that sender and date and subtly fades the row
- **AND** subsequent messages do not replace the first welcomer

#### Scenario: Non-qualifying messages

- **WHEN** only self-messages, hidden messages or messages from non-team senders exist
- **THEN** the member remains Unassigned

### Requirement: Acquisition language context

The list SHALL display declared language names with languages shared with the
signed-in viewer first, preserving profile order within both groups. Shared
languages SHALL be bold except English, which SHALL retain normal weight.
Empty language lists SHALL show Not specified. A viewer without languages SHALL
see the original recipient language order without emphasis.

#### Scenario: Shared languages

- **WHEN** a member and viewer share English and another language
- **THEN** those languages appear before unshared languages
- **AND** only the shared non-English language is bold

#### Scenario: Missing languages

- **WHEN** a member has no declared languages
- **THEN** the Languages column shows Not specified
