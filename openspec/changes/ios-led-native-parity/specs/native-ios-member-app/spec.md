# Native iOS Member App Specification

## Purpose

Identify how accepted iOS member-facing behaviour supplies the reference for
shared native product decisions.

## ADDED Requirements

### Requirement: iOS native reference behaviour

The iOS member application SHALL act as the default product reference for
shared native flows, information hierarchy, terminology and states. Material
iOS changes SHALL document their Android parity classification without making
simultaneous Android release a prerequisite.

#### Scenario: A material iOS member experience changes

- **WHEN** an accepted change alters a member-facing iOS flow, hierarchy,
  terminology or state
- **THEN** its proposal or implementation plan records the Android parity
  classification
- **AND** applicable Android delivery may proceed independently

#### Scenario: An iOS implementation detail is platform-specific

- **WHEN** an iOS behaviour depends on an iOS interaction or lifecycle
  convention
- **THEN** the reference records the intended member outcome
- **AND** does not require Android to reproduce the iOS implementation detail
