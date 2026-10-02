# Native Android Member App Specification

## Purpose

Align the native Android member application with phone web (≤767px) member
information architecture and journeys, without administration tools.

## ADDED Requirements

### Requirement: Phone-web UX reference

The Android member application SHALL treat the Trustroots phone website
(viewport width at most 767px) as the UX reference for member information
architecture and core journeys. Administration and moderation SHALL remain on
the website. Native Compose presentation MAY differ from Bootstrap markup
while preserving equivalent member destinations and outcomes.

#### Scenario: Member uses a core destination on Android

- **WHEN** a member opens Circles, Search, Messages or Menu in the Android app
- **THEN** those destinations correspond to the phone web primary destinations
- **AND** the app does not expose administration or moderation tools

### Requirement: Menu parity with phone web navigation

The Android Menu destination SHALL present the same member actions and Info
and support grouping as the phone web `/navigation` page, except Sign out.
Sign out SHALL remain available only from Account. Find people SHALL open the
Search hub on the Members tab. Circles SHALL open the Circles destination.
Host MAY open an allowlisted embedded browser until a native Host journey
exists. Contacts SHALL open a native contacts list for the signed-in member.

#### Scenario: Member opens Menu

- **WHEN** a signed-in member opens Menu
- **THEN** the menu lists profile, edit profile, Host, Nostroots, Contacts,
  Find people, Circles, Account and the Info and support links aligned with
  phone web `/navigation`
- **AND** Sign out is not listed on Menu

#### Scenario: Member chooses Find people from Menu

- **WHEN** a member selects Find people on Menu
- **THEN** the app shows the Search destination on the Members tab

#### Scenario: Member signs out on Android

- **WHEN** a member wants to sign out
- **THEN** Sign out is available from Account
- **AND** Sign out is not offered as a Menu list item

### Requirement: Profile chrome parity

The Android profile experience SHALL provide sticky member actions and section
navigation equivalent to the phone web profile chrome (message / experience /
contact actions and overview / about / hosting / contacts sections), using
native Compose controls.

#### Scenario: Member views a profile on Android

- **WHEN** a member opens a supported profile view after this phase lands
- **THEN** primary actions and profile sections are reachable without relying
  on a single undifferentiated scroll alone for those destinations

### Requirement: Messaging parity

Android conversations SHALL support multiline compose, persisted drafts where
the phone web does, hosting QuickReply where applicable, and an unread
indicator that reflects real unread state rather than a fixed badge.

#### Scenario: Member replies in a conversation

- **WHEN** a member composes a reply after this phase lands
- **THEN** the composer supports multiline input consistent with phone web
  thread behaviour
- **AND** unread state in the shell reflects whether unread threads exist

### Requirement: Search parity

Android host search SHALL provide filter and place-search interaction patterns
aligned with the phone web mobile search experience (filter presentation and
returning to the map), while remaining map-first.

#### Scenario: Member filters hosts on Android

- **WHEN** a member adjusts search filters after this phase lands
- **THEN** filters are presented in a phone-web-aligned pattern rather than
  only as an always-visible chip row without an equivalent Filters entry

### Requirement: Native Host, experiences and remaining account

The Android app SHALL provide native Host offer management, experiences and
remaining account settings that phone web members can perform, replacing
WebView fallbacks for those journeys when each lands. Until then, allowlisted
WebView MAY supply Host and deferred account flows from Menu or Account.

#### Scenario: Member manages hosting before native Host lands

- **WHEN** a member selects Host from Menu and native Host is not yet available
- **THEN** the app opens the allowlisted Trustroots Host flow in the embedded
  browser
