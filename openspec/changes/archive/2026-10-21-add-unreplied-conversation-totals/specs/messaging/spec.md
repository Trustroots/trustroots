## ADDED Requirements

### Requirement: Unreplied conversations and inbox totals

The inbox SHALL offer All, Unread and Unreplied views with total conversation
counts across all pages, independent of text search. Unreplied SHALL include only
incoming conversations where the member has never sent a message to the sender.
All views and counts SHALL respect existing blocked-user and message visibility
rules. Pagination and text search SHALL preserve the selected view.

#### Scenario: Member reads an initial conversation

- **WHEN** a member reads an incoming conversation they have never answered
- **THEN** it leaves Unread but remains in Unreplied

#### Scenario: Member answers an initial conversation

- **WHEN** a member sends their first reply
- **THEN** that conversation leaves Unreplied and remains excluded after subsequent incoming messages

#### Scenario: Member views conversation totals

- **WHEN** a member opens the inbox or returns focus to it
- **THEN** the inbox fetches totals for all three views
- **AND** zero totals are displayed, while unavailable totals are omitted
- **AND** text search and pagination do not change the totals

#### Scenario: Existing clients request unread counts

- **WHEN** a client requests `/api/messages-count` without `include=filters`
- **THEN** the response retains the existing `{ unread }` shape
- **AND** opting in returns `{ all, unread, unreplied }`
