## ADDED Requirements

### Requirement: Collapsing Android message headers

The Android Messages overview and conversation detail SHALL use consistent
Material 3 large app bars that collapse to a single title row as their content
scrolls. Both states SHALL use the established Material title typography. The
app bars SHALL respect the screen's supplied insets and expose an accessible
Back action on conversation detail.

#### Scenario: Member scrolls the Messages overview

- **WHEN** a member scrolls the conversation list
- **THEN** the Messages title collapses to one app-bar row
- **AND** the conversation filter remains a live local filter while visible
- **AND** conversation rows retain their full-row open action and Profile action

#### Scenario: Member scrolls a conversation

- **WHEN** a member scrolls the message history
- **THEN** the participant title collapses to one app-bar row
- **AND** the Back and available View profile actions remain accessible
- **AND** the quick replies and message composer remain usable above the IME

#### Scenario: Member returns to the top of message content

- **WHEN** a member scrolls the overview or conversation content back toward its
  start
- **THEN** the corresponding large app bar expands again
- **AND** existing filter state, message position, drafts and navigation origin
  remain intact
