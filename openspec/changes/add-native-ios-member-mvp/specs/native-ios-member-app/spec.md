# Native iOS Member App Specification

## Purpose

Provide Trustroots members with a secure, fully native iPhone experience for
the core member journeys, while keeping administrative work on the website.

## ADDED Requirements

### Requirement: Production native API transport

The application SHALL use the production Trustroots HTTPS API origin and SHALL
NOT present an API-origin selector or permit clear-text API transport.

#### Scenario: Member opens the native app

- **WHEN** the member opens a debug or release build
- **THEN** the application uses the production Trustroots HTTPS API origin
- **AND** does not offer a server switch
- **AND** does not display the API origin on the sign-in screen

#### Scenario: API configuration uses clear-text HTTP

- **WHEN** an API server URL uses HTTP
- **THEN** the application rejects the configuration before making a request

### Requirement: Native member application

The system SHALL provide a native iOS application built with Swift and SwiftUI
for the supported member MVP. The application SHALL use native interfaces for
implemented MVP areas and SHALL NOT provide administration or moderation tools.

#### Scenario: Member uses a supported MVP area

- **WHEN** an eligible member opens a supported account, profile, member-search,
  circle, offer-search, offer-management, or messaging area in the iOS app
- **THEN** the app presents a native iOS interface for that area

#### Scenario: Administrator needs administration tools

- **WHEN** an administrator uses Trustroots administration functionality
- **THEN** the functionality remains available through the website
- **AND** is not presented in the iOS app

### Requirement: Stable native shell

The native primary navigation SHALL remain anchored to the bottom edge while a
destination is loading. The menu SHALL present member actions without exposing
developer API availability controls.

#### Scenario: Profile begins loading

- **WHEN** a member opens a profile before its content has loaded
- **THEN** the primary navigation remains at the bottom of the screen
- **AND** the loading state occupies the content region above it

#### Scenario: Content reaches the device cut-out

- **WHEN** the member views a normal native destination
- **THEN** the area around the Dynamic Island uses the Trustroots green brand
  strip with the white tree mark immediately to the left of the cut-out
- **AND** provides direct Profile and Account actions immediately to its right
- **AND** selecting the tree mark opens the Trustroots home page
- **WHEN** the member opens a circle detail
- **THEN** the circle hero artwork replaces that strip and extends behind the
  device cut-out
- **AND** the darkened artwork includes circle information on the left and a
  circular version of the artwork on the right
- **AND** the island controls remain visible over the artwork
- **WHEN** the member opens a profile
- **THEN** the member photo header replaces the strip and extends behind the
  device cut-out
- **AND** the darkened photo includes member information on the left and a
  circular profile photo on the right
- **AND** the island controls remain visible over the photo

#### Scenario: Member opens the native menu

- **WHEN** the member opens the native menu
- **THEN** the menu does not show API origin, build or availability diagnostics
- **AND** does not show an API availability check or refresh control
- **AND** provides a Find members action that opens native member search

### Requirement: Native member search

The native app SHALL let signed-in members find other available members through
the existing protected member-search route without opening the built-in
browser. The native results SHALL preserve the website route's visibility,
blocking and role restrictions.

#### Scenario: Member searches for another member

- **WHEN** a signed-in member submits at least three characters in native
  member search
- **THEN** the app requests matching members from the existing
  `/api/users?search=` route
- **AND** displays the returned members in a native list
- **AND** selecting a result opens that member's native profile

#### Scenario: Native member search has no matches

- **WHEN** the protected member-search route returns no members
- **THEN** the native screen explains that no members matched
- **AND** remains ready for another search

#### Scenario: Native member search input is incomplete

- **WHEN** the member enters fewer than three characters
- **THEN** the app does not submit a request
- **AND** explains the minimum search length

#### Scenario: Member uses the on-screen keyboard

- **WHEN** the member enters a native member search
- **THEN** the app provides visible Search and Done keyboard actions
- **AND** does not move the primary navigation above the keyboard

#### Scenario: Member filters a native list

- **WHEN** the member focuses the Circles or Messages filter
- **THEN** the filter remains directly above the on-screen keyboard
- **AND** the primary navigation is hidden until the keyboard closes
- **AND** the member can dismiss the keyboard with a visible Done action or by
  dragging the list

### Requirement: Secure existing-session authentication

The iOS app SHALL authenticate through the existing Trustroots sign-in route
and use the resulting signed website-session cookie with the established
policy-protected JSON routes. The app SHALL store that credential only in the
iOS Keychain and SHALL keep it out of shared browser cookie storage.

#### Scenario: Member signs in on iOS

- **WHEN** a member submits valid credentials in the iOS app
- **THEN** the app securely stores the signed session credential
- **AND** can access authorised existing member endpoints

#### Scenario: Member signs out on iOS

- **WHEN** a member signs out of the iOS app
- **THEN** the app calls the existing sign-out route
- **AND** removes its stored session credential

#### Scenario: Suspended or ineligible member uses a protected endpoint

- **WHEN** a suspended or otherwise ineligible member requests a protected
  existing endpoint
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

#### Scenario: Member selects hosts in a dense area

- **WHEN** the member repeatedly selects a clustered host annotation
- **THEN** the map resolves the cluster into individually selectable hosts
- **AND** does not keep regrouping nearby hosts at close zoom levels

#### Scenario: Member selects a potential host

- **WHEN** the member selects an individual host annotation
- **THEN** a full-width card is anchored to the bottom of the map
- **AND** the card prominently shows the member, hosting status, description
  and guest capacity available from the existing offer response
- **AND** the individual annotation uses a hosting-specific couch symbol

#### Scenario: Member returns to search from a map profile

- **WHEN** a member has opened a profile from a map host card
- **AND** selects the active Search destination
- **THEN** the profile is dismissed
- **AND** the existing map remains underneath

### Requirement: Native hosting information

Native member profiles SHALL show the member's current accommodation offer
using the established offer-by-user endpoint.

#### Scenario: Member profile has a hosting offer

- **WHEN** a member opens a profile with an accommodation offer
- **THEN** the profile shows whether the member is hosting, may be hosting, or
  is not currently hosting
- **AND** shows the available description and guest capacity

#### Scenario: Profile has many contacts or experiences

- **WHEN** a profile has more than six contacts or experiences
- **THEN** the first six are shown with a control to reveal the remainder
- **AND** the experience section summarises recommendation, meeting and
  hosting percentages from the loaded experiences

### Requirement: Native profile activity and messaging

Native member profiles SHALL display the existing public last-seen and reply
statistics returned by the protected profile route. A signed-in member SHALL be
able to open the existing native conversation with another member, or begin it
by sending the first message, without leaving that profile for the website.

#### Scenario: Profile has activity and reply statistics

- **WHEN** a member opens a profile whose response includes `seen`,
  `replyRate`, or `replyTime`
- **THEN** the profile displays the available last-login, reply-rate and
  typical-reply-time information
- **AND** does not derive or request additional private activity data

#### Scenario: Profile has no reply statistics

- **WHEN** a member opens a profile whose reply statistics are empty
- **THEN** the profile explains that reply data is not available yet
- **AND** remains otherwise fully usable

#### Scenario: Member opens messaging from another profile

- **WHEN** a signed-in member selects the profile's conversation action
- **THEN** the app opens the existing native conversation and displays its
  history
- **AND** if the conversation is empty, provides the composer that creates the
  thread when the first message is sent

#### Scenario: Member views their own profile

- **WHEN** the signed-in member opens their own profile
- **THEN** the app does not offer a conversation with themselves

#### Scenario: Member returns to a circle

- **WHEN** a member revisits a recently loaded circle during the same app
  session
- **THEN** the previously assembled contact, recommendation and active-member
  groups appear without repeating the full lookup

### Requirement: Configured member avatars

Native member images SHALL use the existing authenticated avatar endpoint and
SHALL support the avatar source selected by the member, including Gravatar.
The app SHALL NOT forward its session cookie to a cross-origin avatar provider.

#### Scenario: Member uses Gravatar

- **WHEN** a native view displays a member whose configured avatar source is
  Gravatar
- **THEN** the app follows the existing avatar redirect and displays the image
- **AND** removes the Trustroots session cookie from the cross-origin request

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
  only after cached-data use has continued beyond a short transient-failure
  grace period

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

#### Scenario: Trustroots website appears in the built-in browser

- **WHEN** the built-in browser loads an allowlisted page on
  `www.trustroots.org`
- **THEN** it hides the website's `#tr-header` and its reserved spacing
- **AND** shows an explicit Back control beside the Home control at the top of
  the native shell
- **AND** the normal website remains unchanged outside the app

#### Scenario: Deferred feature requires website authentication

- **WHEN** the website route requires a browser session that the member does
  not have
- **THEN** the website requests sign-in without receiving the native app's
  stored API session credential

### Requirement: First-party native analytics

The app SHALL send aggregate native screen pageviews to the existing
self-hosted Trustroots Umami service without including member identity,
credentials, advertising identifiers, or persistent device identifiers.
Trustroots SHALL NOT use native analytics for advertising, behavioural
profiling, advertising attribution, or sale.

#### Scenario: Member opens a native destination

- **WHEN** the member opens a native app destination
- **THEN** the app sends an `/ios/`-prefixed pageview to the Trustroots Umami
  endpoint using a cookie-free request
- **AND** distinguishes native usage with the `ios.trustroots.org` hostname
- **AND** does not include the member's identity or API session credential
- **AND** does not use the pageview for advertising, behavioural profiling,
  advertising attribution, or sale

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
