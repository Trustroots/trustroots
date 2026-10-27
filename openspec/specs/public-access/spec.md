# Public Access Specification

## Purpose

Allow visitors to discover Trustroots, read public information, and begin using
the service without an existing account.

## Requirements

### Requirement: Homepage access

The system SHALL make the Trustroots homepage available without authentication
and present entry points for signing in and creating an account.

#### Scenario: Visitor opens the homepage

- **WHEN** a visitor opens the homepage
- **THEN** the Trustroots homepage is displayed
- **AND** sign-in and sign-up entry points are available
- **AND** the homepage provides a link to public statistics

### Requirement: Public information and circles

The system SHALL make its public information pages, including practical safety
guidance for hosts and travellers, and circle catalogue available without
authentication.

#### Scenario: Visitor browses circles

- **WHEN** a visitor opens the circles page
- **THEN** a list of available circles is displayed

#### Scenario: Visitor opens a public information page

- **WHEN** a visitor opens a supported public information page
- **THEN** the requested page is displayed without requiring authentication

#### Scenario: Visitor opens the safety guidance

- **WHEN** a visitor opens `/safety`
- **THEN** the page presents precautions for arranging and completing stays
- **AND** explains how to report concerning behaviour and respond to an
  immediate emergency
- **AND** provides in-page navigation to its main sections

#### Scenario: Visitor discovers safety guidance from the homepage

- **WHEN** a visitor views the Trustroots homepage
- **THEN** the homepage provides a link to the public safety guidance

### Requirement: Unknown-route response

The system SHALL show a user-facing not-found page when a visitor requests an
unknown browser route.

#### Scenario: Visitor opens an unknown route

- **WHEN** a visitor opens a route that is not provided by the application
- **THEN** the visitor is shown the not-found page

### Requirement: Public support requests

The system SHALL let a visitor or signed-in member submit a valid support
request, select Account help, Report a member, Report a bug, Volunteering, or
Other, and explain when the request cannot be accepted or sent. The category SHALL be
retained with the request and included in the support email body and subject.

#### Scenario: Visitor submits a valid support request

- **WHEN** a visitor submits a valid support request
- **THEN** the system accepts the request for delivery
- **AND** stores and emails its selected category

#### Scenario: Support request cannot be delivered

- **WHEN** a support request has invalid data or cannot be sent
- **THEN** the system displays validation or delivery feedback

#### Scenario: Prospective volunteer expresses interest

- **WHEN** a visitor or signed-in member follows the volunteer button on `/volunteering`
- **THEN** the support form opens with Volunteering selected
- **AND** invites a short description of interests, skills, and availability
- **AND** the Team Guide remains available on the volunteering page

#### Scenario: Existing member-report link is opened

- **WHEN** a visitor or member opens `/support?report=example-member`
- **THEN** Report a member is selected even if another category is specified
- **AND** the reported username is retained in the report submission

#### Scenario: Reporter changes to another category

- **WHEN** a reporter selects a category other than Report a member
- **THEN** the request is submitted without a reported username

#### Scenario: Older client submits an uncategorised request

- **WHEN** an API client omits the category
- **THEN** the request is categorised as Report a member if a reported username exists
- **AND** otherwise it is categorised as Other

#### Scenario: Client submits an unknown category

- **WHEN** an API client submits an unsupported category
- **THEN** the request is rejected before storage or email delivery

#### Scenario: Bug report contact route

- **WHEN** a member selects Report a bug from the menu
- **THEN** the support form opens with Report a bug selected
- **AND** submitting retains reportBug in storage and its readable label in email

#### Scenario: Bug reporting FAQ

- **WHEN** a visitor reads the bugs-and-features FAQ
- **THEN** the FAQ links to the bug-report contact form as the primary route
- **AND** GitHub is optional without issue-search or account-registration instructions

### Requirement: Public service information

The system SHALL make public language data, site statistics, and service-worker
configuration available to visitors.

#### Scenario: Visitor requests public service data

- **WHEN** a visitor requests supported public language, statistics, or service-worker data
- **THEN** the system returns the corresponding public response

### Requirement: Legacy public routes

The system SHALL redirect supported legacy invitation, tribe, and about routes
to their current public destinations.

#### Scenario: Visitor opens a supported legacy public route

- **WHEN** a visitor opens a supported legacy invitation, tribe, or about route
- **THEN** the system redirects the visitor to the current destination

### Requirement: Public statistics presentation

The system SHALL show visitors aggregate Experience and message-interaction
statistics on the statistics page. The page SHALL present one wider card for
real-life connections and recommendation rates and another for replied message
threads and positive feedback rates, with all-time and preceding-90-day
figures.
The public statistics response SHALL be cached for one hour, and failed
responses SHALL NOT replace a successful cached response.

#### Scenario: Visitor views the statistics page

- **WHEN** a visitor opens the statistics page
- **THEN** the page displays all-time and preceding-90-day real-life-connection counts and recommendation rates in one summary
- **AND** displays all-time and preceding-90-day replied-message-thread counts and positive feedback rates in another summary
- **AND** the page does not require authentication

#### Scenario: Repeated visitor requests statistics

- **WHEN** visitors request public statistics more than once within one hour
- **THEN** the system reuses the successful aggregate response
- **AND** advertises the same lifetime to shared HTTP caches

### Requirement: FAQ category filtering

FAQ search SHALL match a case-insensitive phrase in questions and answers across
every category and label the matching category. Clearing the search SHALL restore
the selected category.

#### Scenario: Visitor filters FAQ questions

- **WHEN** a visitor searches from any FAQ category
- **THEN** matching questions and answers from all categories are shown
- **AND** each result group identifies its category

#### Scenario: Visitor clears the FAQ filter

- **WHEN** a visitor clears the FAQ search
- **THEN** the selected category's questions are restored

#### Scenario: No FAQ question matches

- **WHEN** the phrase matches no question or answer in any category
- **THEN** an empty-results message is shown

### Requirement: Internal navigation link validation

CI SHALL reject literal internal client links to unknown application routes or
missing fragment targets. The check SHALL report the source file and destination
and SHALL run without contacting external websites.

#### Scenario: A stale route is introduced

- **WHEN** a literal internal client link points to an unknown route
- **THEN** the internal link check fails and identifies the link

#### Scenario: A fragment target is removed

- **WHEN** a literal internal client link references a missing fragment target
- **THEN** the internal link check fails and identifies the link

### Requirement: Account removal navigation

The removal FAQ SHALL link to the focused account removal section, which SHALL
explain confirmation and permanence and provide a link back to the FAQ answer.
Sign-in redirects SHALL preserve the removal fragment.

#### Scenario: Member follows the account removal FAQ

- **WHEN** a signed-in member follows the account link in the removal FAQ
- **THEN** the account removal section is brought into view and receives focus
- **AND** it explains the confirmation email and permanent deletion steps
- **AND** it links back to the same FAQ answer

#### Scenario: Visitor needs to sign in

- **WHEN** a visitor follows the removal link without being signed in
- **THEN** the sign-in destination retains the removal fragment in its return URL

### Requirement: Bounded support requests

Support SHALL apply shared request limits by client address and, when signed in,
member identity before persistence and email delivery. Exceeded policies SHALL
return HTTP 429 and Retry-After. Anonymous requests SHALL remain available within
the client-address allowance.

#### Scenario: Support allowance is exhausted

- **WHEN** a client or authenticated member exceeds their configured support allowance
- **THEN** the server returns HTTP 429 without storing or emailing that request

### Requirement: Public network connection statistics

Public statistics SHALL include Couchers.org profile-link counts and percentages
of Trustroots members. The statistics page SHALL label Couchsurfing, Facebook
and GitHub as Legacy and explain that these percentages represent previously
linked accounts.

#### Scenario: Visitor views network connections

- **WHEN** a visitor opens the statistics page
- **THEN** Couchers.org appears with its percentage of members with a profile link
- **AND** Couchsurfing, Facebook and GitHub display a Legacy label
- **AND** Couchers.org is not labelled Legacy

#### Scenario: Couchers.org statistics cannot be counted

- **WHEN** counting Couchers.org connections fails
- **THEN** the public statistics request returns an error without caching an incomplete response

### Requirement: Rolling public activity statistics

Public statistics SHALL count all new registrations, new conversations and
non-spam, non-shadow-hidden sent messages over rolling 24-hour and 168-hour
windows from one shared instant. Members SHALL show signup counts; a separate
card SHALL show new threads and sent messages in a table with the periods as
columns. The page SHALL identify the periods in hours and disclose that its
statistics share a one-hour cache.

#### Scenario: Visitor views recent activity

- **WHEN** a visitor opens the statistics page
- **THEN** Members shows new signups in the past 24 and 168 hours
- **AND** a messaging activity table shows new threads and messages sent over
  the same periods without requiring authentication

#### Scenario: A message replies to an existing conversation

- **WHEN** a member sends a message in a conversation started before the period
- **THEN** the sent-message count increases for the period
- **AND** the new-thread count does not increase

#### Scenario: Activity falls on a time boundary

- **WHEN** a record is dated exactly at a period's lower boundary or reference instant
- **THEN** it is included in that period
- **AND** future-dated records are excluded
- **AND** the 24-hour count is a subset of the 168-hour count

#### Scenario: Counting new registrations and conversations

- **WHEN** recent activity is counted
- **THEN** registrations include accounts that are not yet public
- **AND** new conversations are counted once by their first message time
- **AND** hidden and spam messages are excluded from sent-message counts

#### Scenario: No activity occurred during a period

- **WHEN** no eligible records exist for an activity and period
- **THEN** its count is zero

#### Scenario: Recent activity cannot be counted

- **WHEN** a recent activity query fails
- **THEN** the public statistics request returns an error without caching an
  incomplete response

### Requirement: Product credits

The system SHALL provide a public credits page identifying the GeoLite2 data provider and acknowledging map data, contributors and photographers.

#### Scenario: Visitor discovers credits

- **WHEN** a visitor follows the Credits link in the standard footer or approximate-location map notice
- **THEN** the public credits page displays the GeoLite2 attribution and a link to MaxMind
- **AND** acknowledges the other contributors and services

### Requirement: Durable support submission acknowledgement

When the shared support inbox is enabled, a support submission SHALL be durably stored before a threaded acknowledgement is queued to its valid requester email. It SHALL NOT also forward the same submission into the monitored support mailbox. Existing submission/category validation and report identity verification SHALL remain enforced.

#### Scenario: Request storage fails

- **WHEN** a support submission cannot be stored
- **THEN** the user receives an error and no acknowledgement or external support forwarding is sent.

#### Scenario: Shared inbox is disabled

- **WHEN** the feature is not enabled
- **THEN** the existing support delivery flow remains available and mailbox intake does not run.
