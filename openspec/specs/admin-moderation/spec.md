# Admin Moderation Specification

## Purpose

Allow authorised administrators to safely moderate the community, investigate
member activity, and access operational information.

## Requirements

### Requirement: Administrator-only access

The system SHALL restrict administration tools and administration APIs to
authorised administrators, except that members with the `welcome-team` role
SHALL also have access to acquisition stories and analysis and their APIs, as
well as a staff support view where administrators can see who blocked any
administrator or Welcome team member and Welcome team members can see who
blocked their own account.

#### Scenario: Administrator opens the dashboard

- **WHEN** an authorised administrator opens the administration dashboard
- **THEN** the dashboard is displayed

#### Scenario: Regular member requests an administration API

- **WHEN** a regular member without an applicable administrative role requests an administration API
- **THEN** the system denies access

### Requirement: Staff can identify members who blocked staff accounts

The system SHALL allow administrators to view members who blocked any
administrator or Welcome team member, and Welcome team members to view members
who blocked their own account. The view SHALL expose only public identifiers,
usernames, and display names.

#### Scenario: Staff views members who blocked them

- **WHEN** an administrator or Welcome team member opens the blocked-member support view
- **THEN** administrators see members who blocked any administrator or Welcome team member, and Welcome team members see members who blocked them

#### Scenario: Regular member requests the staff support list

- **WHEN** a regular member requests the blocked-member support list
- **THEN** the system denies access

### Requirement: Administration dashboard overview

The system SHALL provide authorised administrators with a dashboard that
combines member search, moderation-tool navigation, and recent community
activity.

#### Scenario: Administrator opens the dashboard with recent activity

- **WHEN** an authorised administrator opens the administration dashboard
- **THEN** the dashboard displays the ten most active messengers from the previous seven days
- **AND** the ten most recent negative thread votes
- **AND** the ten most recent experiences with a negative recommendation

#### Scenario: Administrator opens a review from the dashboard

- **WHEN** an authorised administrator selects a recent thread vote
- **THEN** the system opens the associated message-inspection view

### Requirement: Member search and role filtering

The system SHALL let authorised administrators search for members and list
members with a selected moderation role. Search queries SHALL ignore leading
and trailing whitespace, and whitespace between query words SHALL be optional
when matching stored member data. Member collections SHALL be paginated and
server-side sortable by name, username, email address, signup date, or current
IP address. The selected sort order SHALL be retained while an administrator
moves between pages.

#### Scenario: Administrator searches for a member

- **WHEN** an authorised administrator searches using a valid member query
- **THEN** the first page of matching member records is displayed

#### Scenario: Administrator searches with surrounding whitespace

- **WHEN** an authorised administrator searches using a valid member query
  with leading or trailing whitespace
- **THEN** the system searches using the trimmed query

#### Scenario: Administrator searches with spacing between words

- **WHEN** an authorised administrator searches using words separated by
  whitespace
- **THEN** matching member data is returned whether it stores whitespace
  between those words or not

#### Scenario: Administrator filters members by role

- **WHEN** an authorised administrator selects a moderation role
- **THEN** the first page of members with that role is displayed

#### Scenario: Administrator sorts member search results

- **WHEN** an authorised administrator selects a member-table column header
- **THEN** the displayed member collection is sorted by that column on the server
- **AND** selecting the active header again reverses the sort direction

#### Scenario: Administrator opens another member-list page

- **WHEN** an authorised administrator selects a subsequent or previous page
- **THEN** the system displays that page of the same member collection
- **AND** retains the selected sort column and direction

#### Scenario: Administrator submits an invalid search or role

- **WHEN** an authorised administrator submits an invalid member search or role
- **THEN** the system explains that the request is invalid

### Requirement: Member reports and moderation notes

The system SHALL provide authorised administrators with a member report and
allow them to record moderation notes about that member.

#### Scenario: Administrator opens a member report

- **WHEN** an authorised administrator opens a report for an existing member
- **THEN** the report displays the member's moderation-relevant information

#### Scenario: Administrator saves a moderation note

- **WHEN** an authorised administrator adds a note to a member report
- **THEN** the note is saved and displayed with that member's notes

#### Scenario: Administrator requests a missing or malformed member report

- **WHEN** an authorised administrator requests a report with a missing or malformed member identifier
- **THEN** the system returns a usable error response

### Requirement: Admin member reports include the public profile

The administrator member report SHALL include the viewed member's public
profile below the moderation information. It SHALL reuse the public profile
view, use the authenticated administrator as the viewer, and keep the target
member distinct from the viewer. The embedded profile SHALL not add duplicate
global navigation.

#### Scenario: Administrator opens a member report

- **WHEN** an administrator opens `/admin/user/<username>`
- **THEN** the moderation report is followed by that member's public profile
- **AND** profile actions use the signed-in administrator as the viewer
- **AND** the profile identifies the reported member as its target

### Requirement: Role changes use accessible confirmation dialogs

Role changes from an administrator member report SHALL use an accessible
application dialog with clear action-specific text. The dialog SHALL support
keyboard dismissal before submission, provide progress feedback while saving,
prevent duplicate submissions, and report mutation or refresh errors accurately.

#### Scenario: Administrator confirms or cancels a role change

- **WHEN** an administrator selects a moderation action on a member report
- **THEN** a labelled confirmation dialog explains the action
- **AND** cancelling or dismissing the dialog leaves the member unchanged
- **AND** confirming applies the action once and refreshes the report

#### Scenario: Role change or report refresh fails

- **WHEN** saving a role change fails
- **THEN** the dialog reports the failure and allows a retry
- **WHEN** saving succeeds but refreshing the report fails
- **THEN** the dialog reports that the role changed and does not offer to repeat it

### Requirement: Role changes and audit history

The system SHALL let authorised administrators apply permitted moderation-role
changes, including removing a member's `shadowban` role, and review the
administration audit history. Removing the role SHALL leave messages already
hidden during the shadowban hidden.
Role descriptions SHALL be available on hover and keyboard focus, and exposed
to assistive technology without requiring visible explanatory paragraphs.

#### Scenario: Administrator focuses role help

- **WHEN** an administrator focuses a role label or the greeter control
- **THEN** its explanation appears and is available to screen readers

#### Scenario: Administrator unshadowbans a member

- **WHEN** an authorised administrator confirms Unshadowban on a shadowbanned member report
- **THEN** the `shadowban` role is removed and the member report reflects the change
- **AND** the removal is recorded in moderation notes and the audit history
- **AND** previously hidden messages remain hidden

#### Scenario: Member attempts to remove a shadowban

- **WHEN** a member without the `admin` role requests removal of a shadowban
- **THEN** the system denies access

#### Scenario: Administrator changes a member's moderation role

- **WHEN** an authorised administrator applies a permitted role change
- **THEN** the member's role is updated
- **AND** the action is recorded in the audit history

#### Scenario: Administrator requests an impermissible role change

- **WHEN** an authorised administrator requests a role change that is not permitted
- **THEN** the system rejects the request

### Requirement: Conversation and reference inspection

The system SHALL let authorised administrators inspect message threads,
messages between identified members, and reference threads for moderation.

#### Scenario: Administrator inspects messages between members

- **WHEN** an authorised administrator requests messages between two valid members
- **THEN** the system displays the messages available for moderation, including shadow-hidden content

#### Scenario: Administrator inspects member threads

- **WHEN** an authorised administrator queries threads by a member identifier or username
- **THEN** the system returns the matching threads

#### Scenario: Administrator submits an invalid member identifier for inspection

- **WHEN** an authorised administrator submits a malformed member identifier
- **THEN** the system rejects the request with an error response

### Requirement: Scammer recipient warnings

The system SHALL let authorised administrators find the distinct members
contacted by a member username and send one warning message to all of them.

#### Scenario: Administrator previews scammer recipients

- **WHEN** an authorised administrator supplies a member username
- **THEN** the system displays the distinct existing members that member has
  contacted

#### Scenario: Administrator sends a scammer warning

- **WHEN** an authorised administrator confirms a non-empty warning message
- **THEN** the system sends it to every previewed recipient in a normal message
  thread
- **AND** the notification email is sent from Trustroots Support

#### Scenario: Administrator retries a partially completed warning

- **WHEN** warning delivery fails or its response is lost and the administrator retries the same warning request
- **THEN** the request reuses its message identifiers and repairs missing or older thread state without duplicating messages
- **AND** retries preserve read state and newer conversation messages
- **AND** overlapping retries create only one inbox thread for each administrator and recipient pair
- **AND** a new deliberate warning uses a new request identifier

#### Scenario: Regular member requests a scammer warning

- **WHEN** a regular member requests the lookup or send endpoint
- **THEN** the system denies access

### Requirement: Readable moderation context

The system SHALL present member search results, reports, message inspection,
and reference threads in a form that lets authorised administrators move
between related members and activity.

#### Scenario: Administrator inspects a member's activity

- **WHEN** an authorised administrator opens a member report or search result
- **THEN** the system presents the member's relevant profile, role, contact,
  offer, and moderation information with links to related administration views

#### Scenario: Administrator searches message participants by username

- **WHEN** an authorised administrator supplies member usernames to message inspection
- **THEN** the system resolves the members and displays their conversation context
- **AND** any related reference-thread votes are shown

### Requirement: Administration operational views

The system SHALL provide authorised administrators with administration views
for audit history, newsletter subscribers, acquisition stories, and acquisition
analysis. The acquisition-stories view SHALL identify members with profile
pictures and public-profile links, show their circle participation and available
location context, and allow the available columns to be sorted. Newsletter
operations SHALL require newsletter consent and a public profile and SHALL
exclude suspended, shadowbanned, and profile-deletion-pending members.

#### Scenario: Administrator opens acquisition stories

- **WHEN** an authorised administrator opens the acquisition-stories view
- **THEN** each story identifies its member with a profile picture and public-profile link
- **AND** shows the number of circles that member has joined
- **AND** shows available living and origin locations
- **AND** shows the latest hosting-offer location using fuzzy coordinates when available
- **AND** the administrator can sort the rows by date, member, circle count, or story

#### Scenario: Administrator opens an available operational view

- **WHEN** an authorised administrator opens an available operational view
- **THEN** the requested view displays its available data

#### Scenario: Administrator splits uploaded newsletter CSV recipients

- **WHEN** an authorised administrator uploads a CSV, JSONL, or NDJSON file of
  email recipients in the newsletter view
- **THEN** the system classifies uploaded emails as still subscribed or
  unsubscribed
- **AND** the "still subscribed" output includes only members who are eligible
  for newsletter emails
- **AND** the excluded output includes a reason for each excluded recipient
- **AND** each output uses the uploaded file's CSV, JSONL, or NDJSON format and
  extension

#### Scenario: Administrator uploads invalid JSON Lines

- **WHEN** an authorised administrator uploads malformed JSONL or NDJSON
- **THEN** the system rejects the upload with a usable validation message
- **AND** does not return a partial classification

#### Scenario: Administrator exports eligible newsletter recipients

- **WHEN** an authorised administrator requests a newsletter export for all subscribers or one circle
- **THEN** the system returns a CSV containing only email-eligible recipients

#### Scenario: Administrator builds a location audience

- **WHEN** an authorised administrator selects living location, origin
  location, or hosting location and supplies valid location criteria
- **THEN** the system previews the number of eligible subscribers matching any
  selected location source
- **AND** can export those subscribers as CSV

#### Scenario: Administrator changes valid audience filters

- **WHEN** an authorised administrator changes a valid location or circle
  filter configuration
- **THEN** the view automatically refreshes the number of eligible recipients
  matching that configuration

#### Scenario: Administrator filters by hosting radius

- **WHEN** an authorised administrator supplies valid coordinates and a radius
  and selects hosting location
- **THEN** eligible members with a current `yes` or `maybe` hosting offer inside
  the radius are included
- **AND** expired or unavailable hosting offers are excluded

#### Scenario: Administrator builds a circle audience

- **WHEN** an authorised administrator selects one or more circles
- **THEN** eligible subscribers belonging to any selected circle are included

#### Scenario: Administrator combines location and circle criteria

- **WHEN** an authorised administrator supplies both location and circle
  criteria
- **THEN** only eligible subscribers matching at least one selected location
  source and at least one selected circle are included

#### Scenario: Administrator submits invalid audience criteria

- **WHEN** an authorised administrator supplies incomplete or invalid audience
  criteria
- **THEN** the system rejects the request with a usable validation message
- **AND** does not expose subscriber data

#### Scenario: Restricted member matches audience criteria

- **WHEN** a suspended, shadowbanned, private, unsubscribed, or
  profile-deletion-pending member matches the selected location or circles
- **THEN** the member is excluded from preview and export results

#### Scenario: Newsletter audience action is requested

- **WHEN** an authorised administrator previews or exports an audience
- **THEN** the request criteria are recorded in the administration audit log

### Requirement: Current IP address moderation context

The system SHALL retain only the current client IP address observed during a
member's authenticated activity. It SHALL make that address available only to
authorised administrators in member-search results and member reports.

#### Scenario: Member performs authenticated activity

- **WHEN** a member performs authenticated activity from a client IP address
- **THEN** the system records the member's current client IP address
- **AND** replaces any previously stored IP address for that member

#### Scenario: Administrator views a member

- **WHEN** an authorised administrator views a member in a search result or
  member report
- **THEN** the system displays the member's current stored IP address when one
  is available

#### Scenario: Administrator follows an IP address

- **WHEN** an authorised administrator selects a displayed IP address
- **THEN** the system displays members whose current stored IP address exactly
  matches that address

#### Scenario: Regular member requests an IP-address lookup

- **WHEN** a regular member requests the administrator IP-address lookup
- **THEN** the system denies access

### Requirement: Potential accounts related to restricted members

The system SHALL help authorised administrators investigate a suspended or
shadowbanned member by showing a bounded set of other accounts with a similar
username or email local-part, or an identical normalised acquisition story.
The system SHALL identify the signal that caused each possible match and SHALL
NOT automatically change an account because of a match.

#### Scenario: Administrator opens a restricted member report

- **WHEN** an authorised administrator opens a suspended or shadowbanned
  member report
- **THEN** the report shows the member's acquisition story when available
- **AND** shows a bounded set of possible related accounts
- **AND** identifies whether each account matched the username, email
  local-part, or acquisition story

#### Scenario: Administrator opens an unrestricted member report

- **WHEN** an authorised administrator opens a member report for an account
  without the suspended or shadowban role
- **THEN** the report does not perform or display restricted-member matching

#### Scenario: Possible account match is found

- **WHEN** another account matches one or more restricted-member signals
- **THEN** the administrator can open that account's member report
- **AND** neither account's roles or other state are changed automatically

### Requirement: Restricted-account signals in acquisition stories

The system SHALL compare acquisition-story rows with a bounded set of
suspended and shadowbanned accounts and show possible matches to authorised
administrators. Match signals SHALL include similar normalised username and
email local-part identifiers and SHALL NOT include acquisition-story text.
Matches SHALL NOT automatically change account state.

#### Scenario: Acquisition story resembles a restricted account

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a story row has an identifier resembling one from a suspended or shadowbanned account
- **THEN** the row identifies the matching restricted account
- **AND** labels the username, email, or temporary-email identifier signal
- **AND** links to the restricted account's member report

#### Scenario: Acquisition story has no restricted-account signal

- **WHEN** an authorised administrator opens the acquisition-stories view
- **AND** a row shares exact or similar acquisition-story text with a restricted account
- **AND** the accounts have no qualifying identifier match
- **THEN** the row is shown without a restricted-account lead

### Requirement: Member role inventory

The system SHALL show authorised administrators an inventory of a member's
current roles and concise explanations of those roles alongside the Welcome
team membership controls.

#### Scenario: Administrator reviews member roles

- **WHEN** an authorised administrator opens a member report
- **THEN** the report lists the member's current roles
- **AND** explains each recognised role
- **AND** role-removal controls are limited to Welcome team membership

### Requirement: Welcome team acquisition access

The system SHALL allow members with the `welcome-team` role to view acquisition stories and analysis, including all existing acquisition data, and the blockers of their own account. Administrator permissions beyond these tools SHALL remain restricted to administrators. The interface SHALL display the role as Greeter and show only accessible navigation and member links.

#### Scenario: Welcome team views acquisition pages

- **WHEN** a welcome-team member opens either acquisition page or calls its API
- **THEN** access is granted and existing data is returned
- **AND** unrelated administrator pages and APIs remain forbidden

### Requirement: Administrator manages Welcome team membership

Administrators SHALL be able to grant and revoke `welcome-team` from member role management. The role-change API SHALL accept an optional action of add or remove, default to add, and permit removal only for welcome-team. Changes SHALL preserve other roles and create administrator notes.

#### Scenario: Administrator grants and revokes membership

- **WHEN** an administrator grants or revokes Welcome team membership
- **THEN** the stored role and refreshed role inventory reflect the change
- **AND** subsequent acquisition API access reflects the current roles

#### Scenario: Member attempts to grant access

- **WHEN** a non-administrator requests a role change
- **THEN** the request is forbidden

### Requirement: Acquisition-story table context

The acquisition-stories view SHALL show each member's profile visibility,
explain its compact column headings, and allow profile visibility to be sorted.

#### Scenario: Administrator opens acquisition stories

- **WHEN** an authorised administrator opens the acquisition-stories view
- **THEN** each story shows whether the member's profile is visible
- **AND** compact column headings provide accessible explanations
- **AND** the administrator can sort the rows by profile visibility

### Requirement: Acquisition welcome context

The acquisition-stories list SHALL show a sortable Welcomer column derived from
the first non-self, non-hidden incoming message from a current welcome-team
member, including the sender's linked identity and date. Unread messages SHALL
count. Members without a qualifying message SHALL show Unassigned. Contacted
rows SHALL be subtly faded while preserving readable text and usable controls.
The API SHALL batch contact metadata without returning message content.

#### Scenario: First welcome message establishes the welcomer

- **WHEN** a welcome-team member sends a visible message to a listed member
- **THEN** reloading the list shows that sender and date and subtly fades the row
- **AND** subsequent messages do not replace the first welcomer

#### Scenario: Non-qualifying messages

- **WHEN** only self-messages, hidden messages or messages from non-team senders exist
- **THEN** the member remains Unassigned

### Requirement: Acquisition language context

The list SHALL display declared language names with languages shared with the
signed-in viewer first, preserving profile order within both groups. Shared
languages SHALL be bold except English, which SHALL retain normal weight.
Empty language lists SHALL show Not specified. A viewer without languages SHALL
see the original recipient language order without emphasis.

#### Scenario: Shared languages

- **WHEN** a member and viewer share English and another language
- **THEN** those languages appear before unshared languages
- **AND** only the shared non-English language is bold

#### Scenario: Missing languages

- **WHEN** a member has no declared languages
- **THEN** the Languages column shows Not specified

### Requirement: Profile admin navigation

Public profile action links SHALL be consistently aligned. Administrators SHALL
see an Admin action linking to `/admin/user/<viewed-member-username>`, on desktop
and mobile. Other members, including the welcome team, SHALL not see it.

#### Scenario: Administrator views a member

- **WHEN** an administrator opens a member's profile
- **THEN** the Admin action opens that member's existing admin record

#### Scenario: Non-administrator views a member

- **WHEN** a non-administrator opens a profile
- **THEN** no Admin action is displayed

### Requirement: Admin member username URLs

The application SHALL support `/admin/user/:username` with the same admin-only
access as `/admin/user`. It SHALL look up the exact username independently of
fuzzy search results and their pagination, while preserving ID, IP and query
URL support. Member links SHALL prefer the encoded username path whenever the
username is available; ID-only records SHALL retain the legacy ID fallback.

#### Scenario: Exact username deep link despite a matching prefix

- **GIVEN** members named `fictional-member` and `fictional-member-extra`
- **WHEN** an administrator opens `/admin/user/fictional-member`
- **THEN** the admin page shows the record for the exact `fictional-member` username

### Requirement: Compact audit history

The admin audit log SHALL display compact rows containing time, acting member,
request route and a concise summary. Empty request fields and pagination fields
SHALL be omitted from summaries. Raw body, params, query, IP address and log ID
SHALL remain available through expandable details without changing stored logs.

#### Scenario: Request summary

- **WHEN** an entry contains an empty userId, a username and pagination criteria
- **THEN** its summary shows the username without empty or pagination fields
- **AND** its full request data remains available in expandable details

### Requirement: Audit actor filters

Administrators SHALL filter audit history by the staff username that performed
the action and by current admin or welcome-team membership. Combined filters
SHALL intersect. Filters SHALL apply before the latest 100 entries are selected.
Username options SHALL include existing actors from all recorded history.
The existing response array and admin-only access SHALL remain compatible.

#### Scenario: Older matching staff activity

- **WHEN** an administrator filters by an actor whose records precede the latest
  100 unfiltered entries
- **THEN** the actor's latest matching entries are returned

#### Scenario: Team and username filters

- **WHEN** an administrator selects a username and a team
- **THEN** only that actor's entries are returned if they currently belong to that team
- **AND** members holding both roles match either team

#### Scenario: Invalid or missing results

- **WHEN** an invalid team or non-string filter is supplied
- **THEN** the API rejects the filter
- **WHEN** no actors match valid filters
- **THEN** the list returns an empty array

### Requirement: Descriptive newsletter audience export filenames

Targeted newsletter CSV download filenames SHALL include the applicable location, hosting radius, selected location sources when narrowed, selected circle names, and the local export datetime in `yyyymmdd-hhmm` format. Filter text SHALL be sanitised for use in filenames. Hosting-only audiences SHALL describe their coordinates instead of an unused text location.

#### Scenario: Administrator exports the default audience

- **WHEN** an authorised administrator exports the initial Berlin audience with a 50 kilometre hosting radius and all location sources
- **THEN** the CSV filename uses `newsletter-audience-Berlin-50km-yyyymmdd-hhmm.csv` with the actual local export datetime

#### Scenario: Administrator exports a customised audience

- **WHEN** an authorised administrator exports an audience after changing location sources, location criteria or circles
- **THEN** the CSV filename describes the selected filters and includes the local export datetime
- **AND** filename-unsafe characters from filter text are replaced
