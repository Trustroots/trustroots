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

### Requirement: Contact request creation allowance

The system SHALL allow twenty contact request creation attempts per authorised member per hourly window by default. Confirming and removing contacts SHALL remain available independently of this allowance.

#### Scenario: Member reaches the contact request creation allowance

- **WHEN** an authorised member submits a contact request after exhausting their hourly allowance
- **THEN** the system returns HTTP 429 with a `Retry-After` header before storing a request or sending a notification
- **AND** another member on the same network can still send a request within their own allowance

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

### Requirement: Accessible contact list states

Contact lists SHALL present loading, successful empty and failed request states
with a clear heading and screen-specific explanation. Loading and outcome
states SHALL use existing platform status semantics. A failed request SHALL
provide an accessible action that retries loading contacts.

#### Scenario: Contact loading fails

- **WHEN** a contact list request fails
- **THEN** the screen explains that contacts are unavailable and provides an
  accessible retry action

### Requirement: Blocking cancels pending contact requests

The server SHALL cancel pending contact requests between two members when one blocks the other. Unblocking SHALL NOT restore cancelled requests. Confirmed contacts SHALL remain intact.

#### Scenario: Either participant blocks the other before confirmation

- **WHEN** the sender or recipient of a pending contact request blocks the other member
- **THEN** the request is removed from both members' contact lists
- **AND** its confirmation link can no longer be used
- **AND** unblocking later does not restore the request

#### Scenario: A pending request still exists for a blocked pair

- **WHEN** the recipient tries to confirm a pending request and either participant has blocked the other
- **THEN** the server rejects confirmation

### Requirement: Account deletion removes pending contact requests

The server SHALL remove pending contact requests sent or received by a deleted member.

#### Scenario: A request sender deletes their account

- **WHEN** the sender of a pending contact request deletes their account
- **THEN** the request is removed from the recipient's contact list
- **AND** its confirmation link can no longer be used
