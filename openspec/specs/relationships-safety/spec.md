# Relationships and Safety Specification

## Purpose

Let members build trusted relationships while controlling unwanted contact and
protecting the community from hidden or harmful activity.

## Requirements

### Requirement: Contact relationships

The system SHALL let available members create, confirm, view, and remove
contact relationships. Suspended and shadowbanned members cannot create or
receive contact requests.

#### Scenario: Member creates and confirms a contact relationship

- **WHEN** a member sends a contact request and the other member confirms it
- **THEN** the system lists the members as confirmed contacts

#### Scenario: Contact request involves a restricted member

- **WHEN** a suspended or shadowbanned member attempts to send a contact
  request, or another member attempts to contact one
- **THEN** the system does not create a contact record
- **AND** the request is not delivered to the other member

#### Scenario: Member creates a duplicate contact request

- **WHEN** a member requests contact with someone already pending or confirmed
- **THEN** the system explains the existing relationship state

#### Scenario: Member removes a contact

- **WHEN** a member removes a confirmed contact
- **THEN** the system updates the members' contact lists

### Requirement: Contact-list visibility

The system SHALL show a member's available contacts and relevant common
contacts where relationship visibility permits. Suspended and shadowbanned
accounts SHALL be omitted from user-facing contact lists even when an existing
contact record remains.

#### Scenario: Member views contacts

- **WHEN** a member opens an available contacts view
- **THEN** the system displays the visible contacts or an empty state
- **AND** omits suspended and shadowbanned contacts

#### Scenario: Member accesses or confirms a restricted contact directly

- **WHEN** a member requests a contact by its identifier or the other member's identifier, or attempts to confirm it
- **AND** either participant is suspended or shadowbanned
- **THEN** the system reports that the contact was not found
- **AND** leaves the stored contact unchanged

#### Scenario: Member requests common contacts

- **WHEN** a member requests common contacts for two members
- **THEN** the system returns the contacts shared by both members where permitted
- **AND** omits suspended and shadowbanned contacts

### Requirement: Blocking

The system SHALL let members block and unblock other members, and SHALL hide
blocked relationship actions and protected profile access. A member who has
blocked another member SHALL retain direct access to that member's profile and
avatar to reach the unblock control. A member who has been blocked SHALL not
receive the profile owner's avatar; administrators retain their moderation
access.

#### Scenario: Member blocks another member

- **WHEN** a member blocks another member
- **THEN** the system records the block and hides protected relationship actions for that pair

#### Scenario: Member removes a block

- **WHEN** a member unblocks another member
- **THEN** the system removes the block and restores permitted relationship actions

#### Scenario: Blocked member requests the blocker's avatar

- **WHEN** a member requests the avatar of a member who has blocked them
- **THEN** the system returns the default avatar

#### Scenario: Blocker requests the blocked member's avatar

- **WHEN** a member requests the avatar of a member they have blocked
- **THEN** the system returns the member's avatar so the blocker can use the profile's unblock control

#### Scenario: Administrator requests a blocked member's avatar

- **WHEN** an administrator requests the avatar of a member who has blocked them
- **THEN** the system returns the member's avatar

### Requirement: Shadow-hidden activity

The system SHALL hide shadow-hidden member profiles and messages from regular
members while leaving them available to authorised administrators for review.

#### Scenario: Regular member views a shadow-hidden profile

- **WHEN** a regular member opens a shadow-hidden profile
- **THEN** the system presents the profile as unavailable

#### Scenario: Administrator investigates shadow-hidden activity

- **WHEN** an authorised administrator inspects shadow-hidden member activity
- **THEN** the administration tools provide the relevant profile and message context

### Requirement: External profile links for restricted viewers

The system SHALL omit another member's external social, hospitality-network,
and Nostr identifiers when the authenticated viewer is shadowbanned.

#### Scenario: Shadowbanned member views another profile

- **WHEN** a shadowbanned member views another member's public profile
- **THEN** the profile response omits external social, hospitality-network, and
  Nostr identifiers

#### Scenario: Member views their own profile

- **WHEN** a member views their own profile
- **THEN** their external network identifiers remain available

### Requirement: Contact details for restricted viewers

The system SHALL remove detected URLs, email addresses, and phone numbers from
other members' profile and offer descriptions when the authenticated viewer is
shadowbanned.

#### Scenario: Shadowbanned member views another member's description

- **WHEN** a shadowbanned member views another member's profile or offer
- **THEN** detected URLs, email addresses, and phone numbers are omitted from
  the returned description

#### Scenario: Member views their own content

- **WHEN** a member views their own profile or offer
- **THEN** their description remains available with its contact details

### Requirement: Contact list ordering

The system SHALL offer date-added and name ordering on contact lists. Date ordering SHALL show newest contacts first and place missing dates after dated contacts. Name ordering SHALL be alphabetical without case sensitivity, falling back to username when a display name is unavailable. Pending and confirmed relationships SHALL retain their separate groups, and filtering SHALL continue to apply.

#### Scenario: Member changes contact ordering

- **WHEN** a member selects name ordering on a contacts view
- **THEN** each relationship group is displayed alphabetically by name
- **AND** the underlying relationship records remain unchanged

#### Scenario: Member opens a contact list

- **WHEN** a member opens a contact list
- **THEN** contacts in each relationship group are displayed newest first

### Requirement: Contact requests respect member blocks

The server SHALL reject contact creation when either participant has blocked
the other, before creating a relationship or sending its email.

#### Scenario: Either member has blocked the other

- **WHEN** a member submits a contact request for a blocked pair
- **THEN** the server rejects the request without creating a contact or email job

### Requirement: Server-owned relationship fields

Contact and thread-reference creation SHALL construct records from supported operation fields. Record identifiers, authenticated authors and creation timestamps SHALL be assigned by the server. Existing relationship authorisation and confirmation rules SHALL remain in force.

#### Scenario: A member supplies additional record fields

- **WHEN** a contact or thread-reference request includes identifiers, timestamps or author fields
- **THEN** the persisted record uses server-assigned values
- **AND** the existing creation and confirmation flow remains available

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

Use **Your Experience** and **Their Experience** labels with named authors.
Present recorded facts as compact label/value tables, with written feedback
separate from the facts. The Experience cards SHALL stack on small screens
without horizontal scrolling and appear side by side when space permits.

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
