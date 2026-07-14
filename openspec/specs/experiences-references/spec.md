# Experiences and References Specification

## Purpose

Let members share and view experiences with other members, and manage the
related reference-thread history.

## Requirements

### Requirement: Experience creation

The system SHALL let a member create a valid public or private experience for
another member where the experience feature is available.

#### Scenario: Member submits a valid experience

- **WHEN** a member submits a valid experience for another member
- **THEN** the system saves the experience with the selected visibility

#### Scenario: Member attempts to create an experience about themselves

- **WHEN** a member attempts to create an experience about themselves
- **THEN** the system rejects the request

### Requirement: Experience visibility and detail

The system SHALL display experience counts and details according to the
experience visibility rules.

#### Scenario: Member views a public experience

- **WHEN** a member opens a profile with a public experience
- **THEN** the profile displays the experience and its relevant details

#### Scenario: Member views an experience with restricted visibility

- **WHEN** a member is not permitted to view an experience
- **THEN** the system does not expose that experience's protected details

### Requirement: Duplicate experience prevention

The system SHALL identify an existing experience between the same members and
prevent a duplicate experience from being created.

#### Scenario: Member opens an experience form for an existing relationship

- **WHEN** a member opens an experience form where an experience already exists
- **THEN** the system displays the already-shared state instead of a duplicate form

### Requirement: Reference-thread access

The system SHALL provide the supported reference-thread APIs when the
reference feature is enabled, and SHALL leave them unavailable when it is
disabled.

#### Scenario: Client creates and reads a reference thread

- **WHEN** an eligible client uses the supported reference-thread API while the feature is enabled
- **THEN** the system creates and returns the reference-thread data

#### Scenario: Reference feature is disabled

- **WHEN** a client requests a reference-thread route while the feature is disabled
- **THEN** the system reports that the route is unavailable
