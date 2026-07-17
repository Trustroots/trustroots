# Native iOS Member App Specification

## Purpose

Provide Trustroots members with a secure, fully native iPhone experience for
the core member journeys, while keeping administrative work on the website.

## ADDED Requirements

### Requirement: Secure native API transport

The application SHALL use HTTPS for every configurable API server outside a
debug iOS Simulator. A debug Simulator MAY use unencrypted HTTP only for the
loopback hosts `localhost`, `127.0.0.1`, and `::1` so it can reach a developer
server on the same Mac.

#### Scenario: Member or persisted setting supplies remote HTTP

- **WHEN** an API server URL uses HTTP with a non-loopback host
- **THEN** the application rejects the configuration before making a request

#### Scenario: Debug Simulator reaches the Mac development server

- **WHEN** a debug Simulator build uses HTTP with an allowed loopback host
- **THEN** the application accepts the development API configuration

### Requirement: Native member application

The system SHALL provide a native iOS application built with Swift and SwiftUI
for the supported member MVP. The application SHALL use native interfaces for
implemented MVP areas and SHALL NOT provide administration or moderation tools.

#### Scenario: Member uses a supported MVP area

- **WHEN** an eligible member opens a supported account, profile, circle,
  offer-search, offer-management, or messaging area in the iOS app
- **THEN** the app presents a native iOS interface for that area

#### Scenario: Administrator needs administration tools

- **WHEN** an administrator uses Trustroots administration functionality
- **THEN** the functionality remains available through the website
- **AND** is not presented in the iOS app

### Requirement: Stable native shell and API diagnostics

The native navigation header SHALL remain anchored to the top edge while a
destination is loading. The menu SHALL identify the configured API origin and
report whether the mobile endpoint is available, rejecting authentication,
missing, rate limited, returning a server error, or unreachable because of a
recognisable network failure.

#### Scenario: Profile begins loading

- **WHEN** a member opens a profile before its content has loaded
- **THEN** the navigation header remains at the top of the screen
- **AND** the loading state occupies the content region below it

#### Scenario: Member inspects API diagnostics

- **WHEN** the member opens the native menu
- **THEN** the menu shows the exact configured API origin
- **AND** checks the authenticated mobile endpoint
- **AND** distinguishes HTTP, authentication, timeout, DNS, connection and TLS failures

#### Scenario: Developer selects a simulator API server

- **WHEN** a debug Simulator build displays the sign-in screen
- **THEN** the developer can switch between the loopback Mac API and the PR 2777 test API
- **AND** the selected exact origin remains visible

### Requirement: Secure mobile authentication

The system SHALL authenticate the iOS app through versioned mobile API
endpoints using short-lived access tokens and rotating, revocable refresh
tokens. The app SHALL store mobile credentials only in the iOS Keychain.

#### Scenario: Member signs in on iOS

- **WHEN** a member submits valid credentials in the iOS app
- **THEN** the app receives a mobile session and can access authorised
  member-only mobile endpoints

#### Scenario: Member signs out on iOS

- **WHEN** a member signs out of the iOS app
- **THEN** the active mobile session is revoked
- **AND** the app removes its stored mobile credentials

#### Scenario: Suspended or ineligible member uses a mobile endpoint

- **WHEN** a suspended or otherwise ineligible member requests a protected
  mobile endpoint
- **THEN** the system denies access under the same eligibility rules as the
  website

### Requirement: Native member-list filtering

The native app SHALL provide local text filters for the loaded conversation and
circle lists. Conversation filtering SHALL match the other member's name or
the available message excerpt; circle filtering SHALL match its name or
description.

#### Scenario: Member filters conversations

- **WHEN** a member enters text in the conversation filter
- **THEN** the app shows loaded conversations whose name or message excerpt
  matches that text without leaving the native screen

#### Scenario: Member filters circles

- **WHEN** a member enters text in the circle filter
- **THEN** the app shows loaded circles whose name or description matches that
  text

### Requirement: Permissioned current-location map centring

The native map SHALL request location permission only after the member selects
the current-location control. It SHALL use the resulting coordinate to centre
the map locally and SHALL NOT publish or save the coordinate as a member
profile location without a separate explicit sharing feature.

#### Scenario: Member centres the map on their current location

- **WHEN** a member selects the current-location control and grants
  when-in-use permission
- **THEN** the native map centres on the current device location
- **AND** the app does not change the member's saved profile location

#### Scenario: Member declines location permission

- **WHEN** a member declines or has disabled location permission
- **THEN** the app leaves the map at its existing position and explains how to
  enable the optional permission

### Requirement: Native community activity map

The native map SHALL present Hosts, Meetups and validator-approved Community
Notes via Nostroots as distinct layers. Meetups and Community Notes SHALL be
enabled by default, and disabling a layer SHALL remove its annotations.

#### Scenario: Member opens the map for the first time

- **WHEN** the member opens native search with default filters
- **THEN** authorised host and meetup offers are requested
- **AND** verified Community Notes are loaded from the Trustroots Nostr relay

#### Scenario: Member disables a map layer

- **WHEN** the member disables Hosts, Meetups or Community Notes
- **THEN** annotations belonging to that layer are removed without affecting
  the other enabled layers

### Requirement: Offline read-only fallback

The native app SHALL retain successful GET responses in an account-scoped,
protected cache and MAY use them after a network transport failure. It SHALL
clearly identify cached/offline content and SHALL NOT substitute cached data
for an HTTP authorisation or validation failure.

#### Scenario: Server cannot be reached after prior use

- **WHEN** an authenticated read request fails because the server is
  unreachable
- **AND** a cached response exists for the same server, account and request
- **THEN** the app renders the cached response
- **AND** displays a persistent offline warning including when data was saved

#### Scenario: Another account signs in on the device

- **WHEN** a different member signs in after a previous member
- **THEN** the app does not expose the previous member's cached responses
- **AND** removes the previous member's cached response files

### Requirement: Native conversation experiences

The native app SHALL show whether an experience exists between the members in
a conversation. After a meaningful exchange, the app SHALL offer a native form
for creating an experience when the signed-in member has not already created
one. The form SHALL collect at least one interaction, a recommendation and
optional public feedback.

#### Scenario: Conversation already has an experience

- **WHEN** a member opens a conversation with an existing experience in either
  direction
- **THEN** the app indicates that an experience exists
- **AND** does not prompt as though no experience had been shared

#### Scenario: Member has exchanged several messages without an experience

- **WHEN** a member opens a conversation containing at least six messages
- **AND** no experience exists between the two members
- **THEN** the app offers a native action to share an experience

#### Scenario: Member shares an experience

- **WHEN** the member selects at least one interaction, a recommendation and
  submits the native experience form
- **THEN** the app creates the experience through the authenticated API
- **AND** updates the conversation to show the experience relationship

### Requirement: Web account recovery

The iOS MVP SHALL retain the existing website as the account-confirmation and
password-recovery experience through its built-in browser.

#### Scenario: Member needs account recovery

- **WHEN** a member needs to confirm their account or reset their password
- **THEN** the app opens the existing website flow in its built-in browser
- **AND** the iOS app does not process email-link tokens

### Requirement: In-app browser fallback

The app SHALL provide a native `WKWebView` browser for an allowlist of
Trustroots HTTPS routes whose member functionality is not yet available
natively. It SHALL open non-Trustroots destinations in the system browser only
after member confirmation and SHALL NOT present administration or moderation
routes.

#### Scenario: Member opens a deferred supported feature

- **WHEN** a member selects a supported deferred feature in the iOS app
- **THEN** the app opens its allowlisted Trustroots route in the in-app browser

#### Scenario: Deferred feature requires website authentication

- **WHEN** the website route requires a browser session that the member does
  not have
- **THEN** the website requests sign-in without receiving the native app's
  mobile access token

#### Scenario: Member follows an external link

- **WHEN** a member selects a destination outside the Trustroots allowlist
  from the in-app browser
- **THEN** the app requests confirmation before opening the destination in the
  system browser

### Requirement: Permissioned Nostr browser bridge

The native browser SHALL expose NIP-07 operations only to HTTPS origins under
`trustroots.org` and `hitchwiki.org`. Those project-controlled origins MAY be
allowed automatically. The app SHALL keep the Nostr private key in Keychain,
validate the actual main-frame origin for every operation, and SHALL NOT expose
the private key to webpage JavaScript.

#### Scenario: Trustroots website requests a Nostr operation

- **WHEN** an allowlisted Trustroots web origin requests a supported NIP-07
  operation
- **THEN** the native bridge performs the permitted operation without exposing
  the private key to the page

#### Scenario: Member creates or imports an app-local Nostr key

- **WHEN** a member generates a key or imports a valid `nsec` or 64-character
  private-key hex in native account settings
- **THEN** the app stores only the secret in the device Keychain
- **AND** exposes its public key and supported NIP-07 operations only through
  the permissioned browser bridge

#### Scenario: Member changes the Nostr key

- **WHEN** a member imports, replaces, or removes the app-local Nostr key
- **THEN** the app clears all remembered NIP-07 origin permissions
- **AND** does not modify any key held by another application

#### Scenario: Untrusted website requests a Nostr operation

- **WHEN** a website outside the fixed Trustroots origin allowlist requests a
  NIP-07 operation
- **THEN** the native browser denies the request

#### Scenario: Page navigates while a Nostr request is pending

- **WHEN** the main frame changes origin before a pending NIP-07 operation is
  approved or performed
- **THEN** the native browser rejects the stale operation

#### Scenario: Subframe sends a bridge message

- **WHEN** a message does not originate from the actual main frame
- **THEN** the native browser rejects the operation even if the visible page
  has a trusted URL

#### Scenario: Shared Nostroots key is unavailable

- **WHEN** the Nostroots Expo app has not migrated its private key to a shared
  Keychain Access Group
- **THEN** the Trustroots app does not attempt to read that private key
- **AND** remains usable without shared-key access
