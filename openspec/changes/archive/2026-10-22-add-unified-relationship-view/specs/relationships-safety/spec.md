## ADDED Requirements

### Requirement: Private unified relationship view

The system SHALL show an eligible signed-in member a private **Your connection**
view on another member's profile and message thread on desktop and mobile. Both
surfaces SHALL use the same component and typed view model over existing APIs,
showing contact state, the viewer's account, the other member's permitted account
information and only the viewer's private message feedback. Existing records,
identifiers, counts, publication rules, feature flags and restrictions SHALL
remain authoritative.

#### Scenario: Member compares a profile and thread

- **WHEN** the member opens a profile and the corresponding message thread
- **THEN** both show the same relationship information and eligible actions
- **AND** mobile users can open every section without losing access to the message composer

#### Scenario: Visitor or self-profile

- **WHEN** a visitor opens a profile or a member opens their own profile
- **THEN** the system does not show another pair's private relationship view

#### Scenario: A source fails or a member becomes unavailable

- **WHEN** a relationship source fails to load or either member is restricted or unavailable
- **THEN** the view does not interpret that failure as absence or enable unusable actions
- **AND** a recoverable failure offers retry without hiding successfully loaded permitted sections

#### Scenario: Member changes the viewed pair

- **WHEN** the viewed member or signed-in member changes while reads are pending
- **THEN** previous-pair data and late results are not displayed for the new pair

#### Scenario: A feature is disabled

- **WHEN** an Experience or reference-thread feature is disabled
- **THEN** its section exposes no controls and performs no feature API requests
- **AND** other permitted relationship sections remain usable

### Requirement: Clear connection state and guidance

The view SHALL distinguish absent, incoming, outgoing and confirmed contacts and
offer their existing permitted actions. Before sending or accepting a contact
request, the system SHALL explain that messaging needs neither contact status
nor acceptance and that requests should only be sent to or accepted from people
the member knows. Contact acceptance SHALL NOT imply a meeting or endorsement.

#### Scenario: Member sends or accepts a request

- **WHEN** a member reaches the send or acceptance control
- **THEN** the guidance is visible before submission
- **AND** the relevant action uses the existing contact flow

#### Scenario: Member has no confirmed contact

- **WHEN** an eligible member has an absent or pending contact
- **THEN** the view still offers the existing Experience-writing flow
- **AND** messaging remains available under its existing eligibility rules

### Requirement: Separate authored Experience accounts

The view SHALL label whose Experience is shown and present differing accounts
separately. It SHALL expose only fields allowed by existing visibility rules and
label the viewer's publication state from existing data. Missing meeting answers
SHALL mean **Not recorded**, rather than never met. Hosting wording SHALL state
the relevant author's role explicitly. The view SHALL NOT infer omitted details
or publication states, create duplicate Experiences, or change publication timers.
Published Experience changes SHALL continue to require staff approval.

#### Scenario: Other member is the primary API record

- **WHEN** the pair response contains the other member's Experience as its primary record
- **THEN** the view labels it as their account and shows only permitted fields
- **AND** does not label it as the viewer's account

#### Scenario: Accounts differ or contain missing answers

- **WHEN** the members' permitted accounts differ or an interaction answer is missing
- **THEN** the accounts remain separate and name the respective authors
- **AND** missing answers appear as not recorded
- **AND** host and guest statements identify who hosted whom

#### Scenario: Relationship actions occur after an Experience is shared

- **WHEN** a member opens the view, changes contact status or changes message feedback
- **THEN** existing Experience content, visibility and publication timing remain unchanged

### Requirement: Viewer-owned private message feedback

The view SHALL show only the viewer's latest private yes/no message feedback and
allow changes only under existing reference-thread eligibility. Changes SHALL
use the existing history-preserving API. A missing answer SHALL NOT be displayed
as a negative answer, and a failed save SHALL NOT be displayed as confirmed.

#### Scenario: Eligible member changes feedback

- **WHEN** an eligible member changes their answer from either surface
- **THEN** the saved latest answer is shown on both surfaces after reloading
- **AND** the other member cannot see that answer

#### Scenario: Member has not received a message

- **WHEN** the member has no feedback and existing eligibility does not allow creation
- **THEN** neither surface offers an answer mutation

#### Scenario: Feedback save fails

- **WHEN** saving a changed answer fails
- **THEN** the view preserves the last confirmed answer and offers retry
