# Site Presentation Specification

## Purpose

Present consistent site navigation, media resources, and deployed-code
information across Trustroots pages.

## Requirements

### Requirement: Shared site footer

The system SHALL provide a consistent footer across the main site and
administration interface, including its core information and safety links and
applicable photo credits.

#### Scenario: Visitor views a page with the shared footer

- **WHEN** a visitor views a page that displays the shared footer
- **THEN** the footer provides links to volunteering, rules, safety, FAQ,
  privacy, and contact information
- **AND** displays applicable photo credits

#### Scenario: Administrator views the administration footer

- **WHEN** an authorised administrator views an administration page
- **THEN** the administration footer uses the shared footer presentation

### Requirement: Deployed-code provenance

The system SHALL display available deployed-code provenance in the footer,
including a link to the source commit and its deployment timestamp.

#### Scenario: Build metadata is available

- **WHEN** a page is rendered with valid build metadata
- **THEN** the footer displays the commit timestamp and short commit identifier
- **AND** links to the corresponding source commit

#### Scenario: Production image has no Git checkout

- **WHEN** a production image is built without a Git checkout
- **THEN** build-time metadata remains available for the deployed-code footer link

### Requirement: Media resources

The system SHALL provide links from the media page to the current Trustroots
community media repository and its downloadable assets.

#### Scenario: Visitor opens a media resource

- **WHEN** a visitor selects a style guide, screenshot collection, media archive, or logo download on the media page
- **THEN** the selected resource resolves in the Trustroots community media repository

### Requirement: React page shell

The system SHALL render administration, public pages, circle pages and member workflows with the React application shell.

#### Scenario: Visitor opens a React-owned public page

- **WHEN** a visitor directly opens statistics, support/contact, FAQ, or a read-only informational page
- **THEN** the server renders the React application root and React assets
- **AND** the requested page retains its existing visible content and title

#### Scenario: Administrator opens an administration page

- **WHEN** an authorised administrator directly opens an administration page
- **THEN** the server renders the React application root and admin footer
- **AND** the React client renders the requested administration component

#### Scenario: Guest opens an administration page

- **WHEN** a guest directly opens an administration page
- **THEN** the server redirects the guest to sign in

#### Scenario: Non-admin member opens an administration page

- **WHEN** an authenticated member without the admin role directly opens an administration page
- **THEN** the server redirects the member to the volunteering page

#### Scenario: Visitor opens a member workflow

- **WHEN** a visitor opens a profile, offer search, offer, message, or authentication route
- **THEN** the server renders the React application root and assets

#### Scenario: Visitor opens a circle page

- **WHEN** a visitor opens the catalogue or an accessible circle detail page
- **THEN** the server renders the React application root and assets

#### Scenario: Visitor opens the legacy about route

- **WHEN** a visitor opens `/about`
- **THEN** the React shell preserves the existing redirect to the homepage

### Requirement: React homepage and information pages

The system SHALL render `/`, `/about` and `/safety` through the existing React application shell and preserve circle landing queries, guest signup links, photo credits and existing page content.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** onward destinations render through the React application shell

### Requirement: React member entry pages

The system SHALL render welcome, navigation and member search using the
existing React application shell while preserving their member-only access
and links into other application workflows.

#### Scenario: Member opens an entry page

- **WHEN** a signed-in member opens `/welcome`, `/navigation` or `/search/members`
- **THEN** the page uses the React root and assets
- **AND** its existing content, title and footer visibility are preserved

#### Scenario: Guest opens an entry page

- **WHEN** a guest opens one of the member entry pages
- **THEN** the guest is redirected to sign in

#### Scenario: Member searches from a link

- **WHEN** a member opens `/search/members?search=sample`
- **THEN** the search field and results use the supplied query
- **AND** result links open the existing profile workflow

#### Scenario: Member leaves an entry page

- **WHEN** a member follows a link to another member workflow
- **THEN** the destination renders through the React application shell
- **AND** signing out from navigation ends the authenticated session

### Requirement: React contact confirmation

The system SHALL render `/contact-confirm/:contactId` through the existing React application shell and preserve member-only access, recipient checks, missing or confirmed requests and confirmation submission.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** onward destinations render through the React application shell

### Requirement: React recovery and outcome pages

The system SHALL render `/password/forgot`, `/password/reset/success`, `/password/reset/invalid` and `/confirm-email-invalid` through the existing React application shell and preserve username prefill, recovery submission responses and links into existing authentication workflows.

#### Scenario: Visitor opens a migrated page

- **WHEN** an eligible visitor opens a migrated route
- **THEN** the server renders the React root and assets
- **AND** the page retains its existing content and access rules

#### Scenario: Visitor continues to another workflow

- **WHEN** the visitor follows an onward link or completes a page action
- **THEN** the existing API behaviour and destination remain available
- **AND** onward destinations render through the React application shell

### Requirement: React contact creation

The system SHALL render `/contact-add/:userId` through the existing React application shell while preserving authentication, profile activation, editable contact messages and existing contact outcomes.

#### Scenario: Member creates a connection

- **WHEN** an activated member opens another member's contact-add page
- **THEN** the page checks the recipient and existing connection before offering submission
- **AND** the edited message is submitted through the existing contact API
- **AND** success and duplicate responses retain their existing meaning

#### Scenario: A connection cannot be offered

- **WHEN** the visitor is unauthenticated, inactive, the recipient is missing, or the recipient is the same member
- **THEN** the existing sign-in, activation or explanatory response is shown
- **AND** no contact creation form is offered

#### Scenario: Member follows a profile link

- **WHEN** the member cancels or follows an onward profile link
- **THEN** the existing React-owned profile workflow loads

### Requirement: React experience writing

The system SHALL render `/profile/:username/experiences/new` in the React shell using the existing experience form, recipient profile and experiences feature setting, with links back to the existing profile and experience history.

#### Scenario: Member shares an experience

- **WHEN** a signed-in member opens a recipient's experience-writing URL with experiences enabled
- **THEN** the recipient is loaded through the existing profile API
- **AND** the existing interaction, recommendation, feedback and submission workflow is available
- **AND** duplicate and self-experience outcomes remain available

#### Scenario: Experience writing is unavailable

- **WHEN** experiences are disabled or the recipient cannot be loaded
- **THEN** no experience submission form is displayed
- **AND** the page provides a return link or an explanatory error

### Requirement: Responsive client presentation

The system SHALL render the React client with Bootstrap 5 styles and supported
React Bootstrap components while retaining responsive navigation and usable
forms, dialogs, tabs and page layouts.

#### Scenario: Visitor opens a page on a narrow viewport

- **WHEN** a visitor opens a public or member page on a narrow viewport
- **THEN** navigation and page content remain available without horizontal overflow

#### Scenario: Member uses an interactive widget

- **WHEN** a member opens a dialog, changes a tab or uses a navigation menu
- **THEN** the widget responds to the member's action and remains accessible

### Requirement: Public greeter team page

The public `/team/greeters` page SHALL explain how greeters welcome new members, show the current eligible roster, and link Want to join to `/support?category=volunteering`. The existing team page SHALL link to it. The roster SHALL provide loading, empty and failure states and placeholder avatars to signed-out visitors.

#### Scenario: Visitor opens the greeter page directly

- **WHEN** a visitor navigates to `/team/greeters`
- **THEN** the page renders without requiring authentication and includes the volunteering enquiry link

### Requirement: Minimal public greeter roster

`GET /api/greeters` SHALL return `{ greeters: [{ _id, username, displayName }] }` containing only public `welcome-team` accounts without suspended or shadowban roles. Results SHALL be sorted by display name and username and limited to 500. No private account fields SHALL be returned.

#### Scenario: Restricted greeter accounts exist

- **WHEN** a roster is requested
- **THEN** hidden, suspended and shadowbanned greeters are omitted

### Requirement: Desktop member navigation shortcuts

The signed-in desktop header SHALL show dropdowns on hover and keyboard focus. Circles SHALL list at most ten of the member's own circles, with Hackers first when joined and the remaining circles sorted by descending member count. Search SHALL offer “Find member by name” linking to `/search/members`. Primary Circles and Search links SHALL retain their destinations, and mobile navigation SHALL retain its existing behaviour.

#### Scenario: Member opens circle shortcuts

- **WHEN** a desktop member hovers over or focuses Circles
- **THEN** up to ten joined circles are available as links to circle detail pages, with Hackers first when joined and the remainder ordered by member count
- **AND** a member with no circles has no empty dropdown

#### Scenario: Member opens name search

- **WHEN** a desktop member hovers over or focuses Search
- **THEN** the member name search shortcut is available

#### Scenario: Member uses mobile navigation

- **WHEN** a member uses the header on a mobile viewport
- **THEN** Circles and Search retain their direct links without hover dropdowns

### Requirement: Consistent formatted content

The browser SHALL render descriptions, notes, message bodies and message previews using a shared formatting policy aligned with the server formatter. Only supported formatting elements, per-element attributes and link schemes SHALL be retained. Message content SHALL retain only same-origin HTTP links. Plain-text excerpts SHALL be derived from complete markup, and externally supplied editor content SHALL use the same formatting policy without disturbing ordinary typing.

#### Scenario: Formatted content is displayed

- **WHEN** an existing display surface receives formatted content
- **THEN** supported formatting and text are retained under the shared policy
- **AND** unsupported elements and attributes are omitted

#### Scenario: A member expands a description

- **WHEN** a description exceeds its preview limit
- **THEN** the collapsed preview is literal plain text
- **AND** expanding it displays the complete formatted content under the shared policy

#### Scenario: An editor receives replacement content

- **WHEN** initial or externally replaced editor content is applied
- **THEN** the shared formatting policy is applied before insertion
- **AND** ordinary input does not reset the caret or emit duplicate changes

### Requirement: Non-clickable links in user-written content

The web application SHALL render all anchors embedded in user-written content as their visible children without clickable destinations, preserving supported formatting. This SHALL apply to existing and new content, previews and administrative displays. Stored content, emails and exports SHALL remain unchanged.

#### Scenario: Display a linked description or message

- **WHEN** user-written content contains external, internal, relative, email or telephone links
- **THEN** its labels and supported formatting remain visible without clickable anchors
- **AND** application navigation outside that content remains clickable

### Requirement: Editor formatting without link controls

The shared rich text editor SHALL omit link creation and clickable link previews while retaining other formatting controls and pasted HTML.

#### Scenario: Select text in the editor

- **WHEN** a member selects draft text
- **THEN** formatting controls are available without a link tool

### Requirement: Dedicated profile network exceptions

Dedicated Couchers, BeWelcome, Warmshowers, Nostr and connected social-network profile entries SHALL remain clickable. Couchsurfing entries and their profile-edit destination previews SHALL be plain text.

#### Scenario: View hospitality networks

- **WHEN** a profile contains hospitality-network entries
- **THEN** Couchers, BeWelcome and Warmshowers links remain clickable
- **AND** Couchsurfing remains visible without a clickable destination

### Requirement: Shared web design tokens

The web client SHALL expose existing brand and text colours, surfaces, typography,
component padding, radii and notification badge colour as `--tr-*` root CSS custom
properties derived from the existing Less variables. The initial token bridge
SHALL preserve the current appearance and be included in LTR and RTL stylesheets.

#### Scenario: CSS and React consumers share notification colour

- **WHEN** the web client renders a notification badge
- **THEN** its React styling uses the shared notification background token
- **AND** the resolved colour matches the existing Less notification colour

#### Scenario: Direction-independent token availability

- **WHEN** a member opens the client in an LTR or RTL language
- **THEN** the root design tokens are available to CSS and TSX styles
- **AND** the existing brand colours and component dimensions are preserved

### Requirement: Isolated utility styles

The web client SHALL provide prefixed Tailwind utilities alongside existing
Bootstrap styles without applying Tailwind's global Preflight reset. Brand
utilities SHALL use the existing shared web design tokens. A utility applied to
an element SHALL take precedence over global Bootstrap and Less element rules
for the same property, without `!important`.

#### Scenario: Existing pages retain their styling

- **WHEN** a page uses existing Bootstrap classes without Tailwind utilities
- **THEN** Tailwind does not reset or replace its existing styles

#### Scenario: Utilities use shared tokens in both directions

- **WHEN** a web component uses a prefixed brand utility in LTR or RTL
- **THEN** the utility resolves to the corresponding shared design token

#### Scenario: Utilities override legacy element rules

- **WHEN** a button carries a prefixed border radius or cursor utility
- **THEN** the utility value applies instead of Bootstrap's or the global Less
  `button` rule

### Requirement: Owned UI primitives

The web client SHALL provide reusable Button, Alert, Badge and Spinner
primitives independent of application configuration and translations. Their
styles SHALL be prefixed Tailwind utilities using theme tokens declared by the
UI package, SHALL use shared design values and SHALL preserve existing
presentation.

#### Scenario: Language loading fails

- **WHEN** the language selector cannot load its options
- **THEN** it displays the existing warning using the owned Alert primitive
- **AND** the warning retains its alert semantics

#### Scenario: Accessible controls and status

- **WHEN** a consumer renders a button, alert or loading indicator
- **THEN** the primitive exposes appropriate native or ARIA semantics
- **AND** its text is supplied by the consumer
