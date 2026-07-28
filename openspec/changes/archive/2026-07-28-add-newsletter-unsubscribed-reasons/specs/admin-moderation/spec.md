## MODIFIED Requirements

### Requirement: Administration operational views

The system SHALL provide authorised administrators with administration views
for audit history, newsletter subscribers, acquisition stories, and acquisition
analysis. The acquisition-stories view SHALL identify members with profile
pictures and public-profile links, show their circle participation and available
location context, and allow the available columns to be sorted.

#### Scenario: Administrator opens acquisition stories

- **WHEN** an authorised administrator opens the acquisition-stories view
- **THEN** each story identifies its member with a profile picture and public-profile link
- **AND** shows the number of circles that member has joined
- **AND** shows available living and origin locations
- **AND** shows the latest hosting-offer location using fuzzy coordinates when available
- **AND** the administrator can sort the rows by date, member, circle count, or story

#### Scenario: Administrator opens an available operational view

- **WHEN** an authorised administrator opens an available operational view
- **THEN** the requested view displays its available data

#### Scenario: Administrator splits uploaded newsletter CSV recipients

- **WHEN** an authorised administrator uploads a CSV file of email recipients in the newsletter view
- **THEN** the system classifies uploaded emails as still subscribed or unsubscribed
- **AND** the "still subscribed" CSV includes only members who are eligible for newsletter emails
- **AND** the unsubscribed CSV includes a reason for each excluded recipient
- **AND** provides one downloadable CSV for still subscribed recipients
- **AND** provides one downloadable CSV for unsubscribed recipients

#### Scenario: Administrator exports eligible newsletter recipients

- **WHEN** an authorised administrator requests a newsletter export for all subscribers or one circle
- **THEN** the system returns a CSV containing only email-eligible recipients
