## ADDED Requirements

### Requirement: Public network connection statistics

Public statistics SHALL include Couchers.org profile-link counts and percentages
of Trustroots members. The statistics page SHALL label Couchsurfing, Facebook
and GitHub as Legacy and explain that these percentages represent previously
linked accounts.

#### Scenario: Visitor views network connections

- **WHEN** a visitor opens the statistics page
- **THEN** Couchers.org appears with its percentage of members with a profile link
- **AND** Couchsurfing, Facebook and GitHub display a Legacy label
- **AND** Couchers.org is not labelled Legacy

#### Scenario: Couchers.org statistics cannot be counted

- **WHEN** counting Couchers.org connections fails
- **THEN** the public statistics request returns an error without caching an incomplete response

### Requirement: Rolling public activity statistics

Public statistics SHALL count all new registrations, new conversations and
non-spam, non-shadow-hidden sent messages over rolling 24-hour and 168-hour
windows from one shared instant. Members SHALL show signup counts; a separate
card SHALL show new threads and sent messages in a table with the periods as
columns. The page SHALL identify the periods in hours and disclose that its
statistics share a one-hour cache.

#### Scenario: Visitor views recent activity

- **WHEN** a visitor opens the statistics page
- **THEN** Members shows new signups in the past 24 and 168 hours
- **AND** a messaging activity table shows new threads and messages sent over
  the same periods without requiring authentication

#### Scenario: A message replies to an existing conversation

- **WHEN** a member sends a message in a conversation started before the period
- **THEN** the sent-message count increases for the period
- **AND** the new-thread count does not increase

#### Scenario: Activity falls on a time boundary

- **WHEN** a record is dated exactly at a period's lower boundary or reference instant
- **THEN** it is included in that period
- **AND** future-dated records are excluded
- **AND** the 24-hour count is a subset of the 168-hour count

#### Scenario: Counting new registrations and conversations

- **WHEN** recent activity is counted
- **THEN** registrations include accounts that are not yet public
- **AND** new conversations are counted once by their first message time
- **AND** hidden and spam messages are excluded from sent-message counts

#### Scenario: No activity occurred during a period

- **WHEN** no eligible records exist for an activity and period
- **THEN** its count is zero

#### Scenario: Recent activity cannot be counted

- **WHEN** a recent activity query fails
- **THEN** the public statistics request returns an error without caching an
  incomplete response
