## ADDED Requirements

### Requirement: Collapsing Circles headers

The native Android Circles overview and circle detail screens SHALL collapse
their expanded headers into a compact single-row app bar as the member scrolls.
The compact row SHALL retain the screen title and the relevant navigation
action, and overview and detail titles SHALL use consistent typography. The
overview filter SHALL retain its current query and clear behaviour. Circle
description formatting, inert links, membership controls, API and loading
state, and Back navigation SHALL continue to work. The layout SHALL respect
system and shell insets, right-to-left layout, accessible labels and touch
targets, and the active light or dark theme.

#### Scenario: Member scrolls the Circles overview

- **WHEN** a signed-in member scrolls the Circles overview
- **THEN** the expanded header collapses into a single-row title app bar
- **AND** the current filter query and clear action remain functional
- **AND** circle rows remain reachable above the system and app navigation

#### Scenario: Member scrolls circle details

- **WHEN** a member scrolls a circle's detail screen
- **THEN** the artwork header collapses into a single-row app bar showing the
  circle title and Back action
- **AND** the description and membership action remain reachable
- **AND** supported description formatting remains visible while its links
  remain inert

#### Scenario: Member returns from collapsed circle detail

- **WHEN** a member activates Back from circle detail after scrolling
- **THEN** the Circles overview is restored
- **AND** the current filter query remains intact

#### Scenario: Collapsing headers render across device settings

- **WHEN** the overview or detail header is expanded or collapsed
- **THEN** it respects system and shell insets in left-to-right and
  right-to-left layouts
- **AND** title and navigation controls remain accessible and usable in light
  and dark themes
