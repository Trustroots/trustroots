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
contacts where relationship visibility permits.

#### Scenario: Member views contacts

- **WHEN** a member opens an available contacts view
- **THEN** the system displays the visible contacts or an empty state

#### Scenario: Member requests common contacts

- **WHEN** a member requests common contacts for two members
- **THEN** the system returns the contacts shared by both members where permitted

### Requirement: Blocking

The system SHALL let members block and unblock other members, and SHALL hide
blocked relationship actions and protected profile access.

#### Scenario: Member blocks another member

- **WHEN** a member blocks another member
- **THEN** the system records the block and hides protected relationship actions for that pair

#### Scenario: Member removes a block

- **WHEN** a member unblocks another member
- **THEN** the system removes the block and restores permitted relationship actions

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
