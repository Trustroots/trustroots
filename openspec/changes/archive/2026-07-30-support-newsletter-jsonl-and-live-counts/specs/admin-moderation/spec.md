## MODIFIED Requirements

### Requirement: Administration operational views

The system SHALL provide authorised administrators with administration views
for audit history, newsletter subscribers, acquisition stories, and acquisition
analysis. The acquisition-stories view SHALL identify members with profile
pictures and public-profile links, show their circle participation and available
location context, and allow the available columns to be sorted. Newsletter
operations SHALL require newsletter consent and a public profile and SHALL
exclude suspended, shadowbanned, and profile-deletion-pending members.

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

- **WHEN** an authorised administrator uploads a CSV, JSONL, or NDJSON file of
  email recipients in the newsletter view
- **THEN** the system classifies uploaded emails as still subscribed or
  unsubscribed
- **AND** the "still subscribed" output includes only members who are eligible
  for newsletter emails
- **AND** the excluded output includes a reason for each excluded recipient
- **AND** each output uses the uploaded file's CSV, JSONL, or NDJSON format and
  extension

#### Scenario: Administrator uploads invalid JSON Lines

- **WHEN** an authorised administrator uploads malformed JSONL or NDJSON
- **THEN** the system rejects the upload with a usable validation message
- **AND** does not return a partial classification

#### Scenario: Administrator exports eligible newsletter recipients

- **WHEN** an authorised administrator requests a newsletter export for all subscribers or one circle
- **THEN** the system returns a CSV containing only email-eligible recipients

#### Scenario: Administrator builds a location audience

- **WHEN** an authorised administrator selects living location, origin
  location, or hosting location and supplies valid location criteria
- **THEN** the system previews the number of eligible subscribers matching any
  selected location source
- **AND** can export those subscribers as CSV

#### Scenario: Administrator changes valid audience filters

- **WHEN** an authorised administrator changes a valid location or circle
  filter configuration
- **THEN** the view automatically refreshes the number of eligible recipients
  matching that configuration

#### Scenario: Administrator filters by hosting radius

- **WHEN** an authorised administrator supplies valid coordinates and a radius
  and selects hosting location
- **THEN** eligible members with a current `yes` or `maybe` hosting offer inside
  the radius are included
- **AND** expired or unavailable hosting offers are excluded

#### Scenario: Administrator builds a circle audience

- **WHEN** an authorised administrator selects one or more circles
- **THEN** eligible subscribers belonging to any selected circle are included

#### Scenario: Administrator combines location and circle criteria

- **WHEN** an authorised administrator supplies both location and circle
  criteria
- **THEN** only eligible subscribers matching at least one selected location
  source and at least one selected circle are included

#### Scenario: Administrator submits invalid audience criteria

- **WHEN** an authorised administrator supplies incomplete or invalid audience
  criteria
- **THEN** the system rejects the request with a usable validation message
- **AND** does not expose subscriber data

#### Scenario: Restricted member matches audience criteria

- **WHEN** a suspended, shadowbanned, private, unsubscribed, or
  profile-deletion-pending member matches the selected location or circles
- **THEN** the member is excluded from preview and export results

#### Scenario: Newsletter audience action is requested

- **WHEN** an authorised administrator previews or exports an audience
- **THEN** the request criteria are recorded in the administration audit log
