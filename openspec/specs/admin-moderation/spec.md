# Admin Moderation Specification

## Purpose

Allow authorised administrators to safely moderate the community, investigate
member activity, and access operational information.

## Requirements

### Requirement: Administrator-only access

The system SHALL restrict administration tools and administration APIs to
authorised administrators, except that members with the `welcome-team` role
SHALL also have access to acquisition stories and their API, as
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

### Requirement: Dashboard previews negative-experience feedback

The admin dashboard SHALL expose the public feedback text for each recent
negative experience in a responsive preview attached to its date. The complete
text SHALL be available on hover and keyboard focus, and togglable by touch.
The preview SHALL preserve line breaks, render text without interpreting HTML,
close on Escape, and show a clear fallback when feedback is unavailable.

#### Scenario: Administrator previews public feedback

- **WHEN** an administrator hovers over, focuses, or taps a negative experience
  date
- **THEN** the dashboard shows that experience's complete public feedback
- **AND** line breaks in the feedback remain visible
- **AND** the feedback is rendered as plain text without an extra request

#### Scenario: Administrator dismisses a preview

- **WHEN** an administrator presses Escape while a preview is open
- **THEN** the preview closes and focus remains on its date control

#### Scenario: Public feedback is unavailable

- **WHEN** a negative experience has no public feedback text
- **THEN** the preview explains that the text is unavailable

### Requirement: Member search and role filtering

The system SHALL let authorised administrators search for members and list
members with a selected moderation role. Search queries SHALL ignore leading
and trailing whitespace, and whitespace between query words SHALL be optional
when matching stored member data. Member collections SHALL be paginated and
server-side sortable by name, username, email address, signup date, or current
IP identifier. The selected sort order SHALL be retained while an administrator
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

#### Scenario: Administrator opens a role list URL

- **WHEN** an authorised administrator opens `/admin/search-users?role=<role>` for a valid role
- **THEN** the first page of members with that role is displayed
- **AND** the selected role is visible in the role filter
- **AND** the URL retains the role while the administrator changes pages or sorting

#### Scenario: Administrator follows a member role link

- **WHEN** an administrator selects the Greeter or volunteer role on a member record
- **THEN** the application opens the corresponding role-filtered member list at its unique URL

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
for audit history, newsletter subscribers, and acquisition stories. The acquisition-stories view SHALL identify members with profile
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

The system SHALL retain only a keyed identifier of the current client IP address observed during a member's authenticated activity. It SHALL make matching by that identifier available only to authorised administrators in member-search results and member reports. Raw addresses SHALL not appear in those responses.

#### Scenario: Member performs authenticated activity

- **WHEN** a member performs authenticated activity from a valid client IP address and a hashing key is configured
- **THEN** the system records the member's current client IP identifier
- **AND** replaces any previously stored identifier for that member

#### Scenario: Administrator views a member

- **WHEN** an authorised administrator views a member in a search result or member report
- **THEN** the system offers a descriptive same-IP matching action when an identifier is available
- **AND** neither the raw address nor its identifier is displayed as the action label

#### Scenario: Administrator follows an IP address

- **WHEN** an authorised administrator selects the same-IP matching action
- **THEN** the system displays members whose current stored identifier exactly matches

#### Scenario: Regular member requests an IP-address lookup

- **WHEN** a regular member requests the administrator IP matching lookup
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

The system SHALL allow members with the `welcome-team` role to view acquisition stories, including existing story data, and the blockers of their own account. Administrator permissions beyond these tools SHALL remain restricted to administrators. The interface SHALL display the role as Greeter and show only accessible navigation and member links.

#### Scenario: Welcome team views acquisition pages

- **WHEN** a welcome-team member opens the acquisition-stories page or calls its API
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
SHALL be omitted from summaries. Stored body, params, query, keyed staff IP identifier and log ID
SHALL remain available through expandable details. Raw IP search fields SHALL be
omitted from newly stored body and query payloads. Legacy raw address fields SHALL
be removed by the documented migration.

#### Scenario: Request summary

- **WHEN** an entry contains an empty userId, a username and pagination criteria
- **THEN** its summary shows the username without empty or pagination fields
- **AND** its stored request data remains available in expandable details

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

### Requirement: Experience change administration

The system SHALL let administrators find Experiences, issue member-scoped
change links, and review pending change requests. These capabilities SHALL be
unavailable to non-administrators.

#### Scenario: Administrator issues a link

- **WHEN** an administrator selects an Experience and its author or recipient
- **THEN** the system returns a seven-day link scoped to that Experience and member

#### Scenario: Administrator decides a request

- **WHEN** an administrator approves or rejects a pending Experience change request
- **THEN** the decision and administrator are recorded for audit

#### Scenario: Regular member requests an admin action

- **WHEN** a regular member requests link issuance or a review decision
- **THEN** the system denies access

### Requirement: Descriptive newsletter audience export filenames

Targeted newsletter CSV download filenames SHALL include the applicable location, hosting radius, selected location sources when narrowed, selected circle names, and the local export datetime in `yyyymmdd-hhmm` format. Filter text SHALL be sanitised for use in filenames. Hosting-only audiences SHALL describe their coordinates instead of an unused text location.

#### Scenario: Administrator exports the default audience

- **WHEN** an authorised administrator exports the initial Berlin audience with a 50 kilometre hosting radius and all location sources
- **THEN** the CSV filename uses `newsletter-audience-Berlin-50km-yyyymmdd-hhmm.csv` with the actual local export datetime

#### Scenario: Administrator exports a customised audience

- **WHEN** an authorised administrator exports an audience after changing location sources, location criteria or circles
- **THEN** the CSV filename describes the selected filters and includes the local export datetime
- **AND** filename-unsafe characters from filter text are replaced

### Requirement: Filter unassigned acquisition stories

The acquisition-stories view SHALL provide an accessible “Unassigned only” checkbox, unchecked by default, to administrators and greeters. When checked, the view SHALL show only members without an assigned greeter within the existing latest 500 stories. Filtering SHALL preserve the selected sort order. Clearing the checkbox SHALL restore all loaded stories without refetching them. If no rows match, the view SHALL explain that no unassigned acquisition stories were found and keep the checkbox available.

#### Scenario: Show only unassigned members

- **WHEN** an authorised viewer checks Unassigned only
- **THEN** rows with an assigned greeter are hidden
- **AND** rows marked Unassigned remain in the selected sort order

#### Scenario: Restore all stories

- **WHEN** the viewer clears Unassigned only
- **THEN** all loaded rows return in the selected sort order

#### Scenario: No unassigned stories

- **WHEN** Unassigned only is checked and no loaded members are unassigned
- **THEN** the view shows a filtered empty state and the checkbox remains available

### Requirement: Acquisition profile visibility filtering

The acquisition stories view SHALL offer an accessible All / Visible / Hidden profile visibility selector, defaulting to All. It SHALL combine with Unassigned only over the loaded latest 500 stories, preserve sorting, and avoid refetching. Controls SHALL remain available with an explanatory empty state. Hidden profiles SHALL be explained as signups not yet activated through email confirmation, rather than deactivated accounts or necessarily missing descriptions.

#### Scenario: Greeter combines filters

- **WHEN** a greeter selects Hidden and Unassigned only
- **THEN** only hidden, unassigned rows are shown in the selected order without another request

#### Scenario: Filter matches no stories

- **WHEN** no loaded stories match the filters
- **THEN** an empty-result explanation and both filter controls remain visible

### Requirement: Acquisition analysis is retired

The system SHALL NOT expose an acquisition analysis page, navigation link or API. The acquisition stories list SHALL remain available to administrators and Greeters without term counts or statistical metrics.

#### Scenario: Administrator or Greeter views acquisition stories

- **WHEN** an authorised staff member opens acquisition stories
- **THEN** the stories list is available without an Analysis link
- **AND** POST requests to `/api/admin/acquisition-stories/analysis` return HTTP 404

### Requirement: Support team access

The `support-team` role SHALL grant current greeter tools, allowlisted member search and details including restricted profiles and account status, and internal member notes. Only administrators SHALL grant or remove this role. It SHALL NOT confer moderation actions, exports, audit browsing or unrestricted private-conversation access.

#### Scenario: Support volunteer investigates an account

- **WHEN** a support volunteer searches for a suspended member
- **THEN** safe account details and status are available without authentication tokens or IP history
- **AND** suspension, shadowban and role changes remain denied

### Requirement: Support request inbox

Administrators and support volunteers SHALL share support threads at stable request URLs, search their plain-text correspondence and requester identifiers, filter by category and new/open/pending/hold/solved/closed status, and see accurate total, matching and per-status counts. Unresolved SHALL include new, open, pending and hold. Legacy resolved SHALL mean solved and missing legacy status SHALL mean open.

#### Scenario: Support volunteer resolves a request

- **WHEN** a support volunteer solves an open request
- **THEN** its status and acting staff member are recorded
- **AND** the request can subsequently be reopened.

#### Scenario: Staff shares a filtered request

- **WHEN** staff selects a request with search, category, status and pagination active
- **THEN** its URL identifies the request and preserves those filters across refresh and browser navigation
- **AND** counts and pagination reflect the combined filters.

#### Scenario: Staff corresponds with a requester

- **WHEN** staff sends a reply
- **THEN** all support staff can read its author, time and delivery state in the shared thread
- **AND** only SMTP acceptance marks it accepted and moves it to pending without overwriting newer activity.

#### Scenario: A staging reply is captured

- **WHEN** a local or staging transport captures an outgoing reply without sending it
- **THEN** staff see a captured-for-testing state rather than SMTP acceptance
- **AND** the request status is unchanged and captured mail is not automatically resent.

#### Scenario: Requester replies to a closed request

- **WHEN** a matching requester email replies to a known thread
- **THEN** the correspondence is stored once and the request becomes open, including when previously closed.

### Requirement: Report-scoped private investigation

Authenticated member reports SHALL store server-verified immutable reporter and target IDs. A linked report SHALL grant administrators and support volunteers audited, read-only access to the entire conversation and all experiences in both directions between the pair, including hidden messages and unpublished feedback. Access SHALL remain after resolution. Report forms SHALL explain this access before submission. Signed-out or ambiguous reports SHALL NOT unlock private content. Historical identities SHALL only be linked using reliable evidence, never current username ownership alone.

#### Scenario: Support volunteer reads a reported conversation

- **WHEN** a support volunteer opens a reliably linked member report
- **THEN** the entire pair's conversation and experiences are available through pagination
- **AND** unrelated pairs cannot be selected
- **AND** reading does not mark messages read or publish experiences

#### Scenario: Report has no verified pair

- **WHEN** support opens a signed-out or historically ambiguous report
- **THEN** the report text remains available but private investigation is denied

### Requirement: Greeter-visible account restrictions

The acquisition-stories API SHALL return an allowlisted `restrictionStatuses` array containing only `suspended` and `shadowban` on each story and restricted match, without exposing full role collections. Unrestricted accounts SHALL return an empty array. The acquisition-stories view SHALL show Suspended and Shadowbanned danger badges beside the corresponding names to authorised administrators and greeters, independently of profile visibility. Existing profile access and moderation permissions SHALL remain unchanged.

#### Scenario: Greeter reviews restricted accounts

- **WHEN** a greeter opens acquisition stories containing suspended or shadowbanned members or restricted matches
- **THEN** each name displays its applicable restriction badges, including both if both apply
- **AND** the greeter gains no additional profile access or moderation actions

#### Scenario: Unrestricted member or older response

- **WHEN** a row has no restrictions or omits restriction statuses
- **THEN** the view displays no restriction badges

#### Scenario: Ordinary member requests staff statuses

- **WHEN** an ordinary member requests acquisition stories
- **THEN** access is denied

### Requirement: Circle catalogue administration

The system SHALL provide authorised administrators with tools to create and
edit circle catalogue records and their associated images. Catalogue reads and
writes SHALL be recorded in the administration audit log.

#### Scenario: Administrator manages circles

- **WHEN** an authorised administrator opens the circle administration view
- **THEN** the system lists existing circles and provides create and edit
  controls

#### Scenario: Regular member requests circle administration

- **WHEN** a regular member requests a circle administration API
- **THEN** the system denies the request

### Requirement: Member experience statistics

The admin member report SHALL show received and written experience totals and
separate counts of published positive, negative and neutral recommendations
and unpublished experiences. Removed experiences SHALL be excluded. Statistics
SHALL use a consistent responsive layout and show zero for empty categories.

#### Scenario: Administrator inspects a member with experiences

- **WHEN** an administrator opens a member report with published, unpublished and removed experiences
- **THEN** received and written totals include active experiences only
- **AND** recommendation counts include published experiences only
- **AND** unpublished counts appear separately

#### Scenario: Administrator inspects a member without experiences

- **WHEN** an administrator opens a member report without experiences
- **THEN** all experience counts are zero
- **AND** activity cards remain readable at desktop and mobile widths

### Requirement: Sortable circle catalogue overview

The admin circle catalogue SHALL display circle images, left-aligned names, descriptions and numeric membership counts in a responsive table. Hidden circles SHALL retain a text visibility indicator and their numeric count. Available images SHALL use the existing versioned circle thumbnail URL. Missing images and descriptions SHALL preserve the table layout.

#### Scenario: Administrator compares circles

- **WHEN** an administrator opens the circle catalogue
- **THEN** names, descriptions and membership counts appear in separate columns
- **AND** available thumbnails appear beside the circle names
- **AND** member counts do not repeat a unit label in each row

#### Scenario: Administrator sorts a column

- **WHEN** the administrator activates a name, description or member-count column heading
- **THEN** the table sorts by that column and exposes its direction with aria-sort
- **AND** activating the heading again reverses the direction
- **AND** membership counts sort numerically
- **AND** sorting preserves the selected circle and its editing form

### Requirement: Readable member thread overview

The admin thread page SHALL use username-based navigation and display conversations in a table with participants, read status, directional thread votes and first and last message datetimes. Datetimes SHALL use UTC yyyy-mm-dd hh:mm format and SHALL come from actual messages in either direction. Missing values SHALL display a placeholder. The page SHALL omit the member query input and raw thread details.

#### Scenario: Administrator opens a member's threads

- **WHEN** the administrator follows the member's thread link
- **THEN** the URL identifies the member by username
- **AND** the table shows the member's conversation participants, votes and message datetimes
- **AND** the conversation link uses usernames

#### Scenario: Legacy identifier link

- **WHEN** the administrator opens a legacy userId link for an existing member
- **THEN** the system resolves that member and replaces the URL with its username equivalent
- **AND** the same conversations are available

#### Scenario: Messages in both directions

- **WHEN** a thread contains messages sent by both participants
- **THEN** its first and last datetime cover both directions
- **AND** votes are attributed to their author and recipient

### Requirement: Compact administration sidebar

Desktop admin pages SHALL display grouped navigation in a compact sidebar beside the content. Smaller screens SHALL display the navigation above the content. The duplicated Admin brand link SHALL be omitted, and the primary Admin navigation item SHALL remain selected across admin paths.

#### Scenario: Administrator moves between tools

- **WHEN** an administrator visits an admin page on desktop
- **THEN** all authorised navigation groups appear in the sidebar
- **AND** the selected subsection and primary Admin item are highlighted

### Requirement: Readable administration conversations

The admin Messages view SHALL use the standard conversation bubble presentation in a read-only view. Conversation URLs SHALL prefer participant usernames and resolve legacy identifier links. The view SHALL omit manual participant fields, the Read button, raw message details and recipient warning controls. Existing warning APIs and their authorisation SHALL remain unchanged.

#### Scenario: Administrator opens a conversation

- **WHEN** an administrator opens a conversation through participant usernames or a legacy identifier link
- **THEN** messages render as conversation bubbles with sender, read state and formatted timestamps
- **AND** legacy links are replaced by username links when those usernames are available

### Requirement: Consistent administration datetimes

Rendered administration datetimes SHALL use UTC yyyy-mm-dd hh:mm format. Machine-readable timestamps, date input values and export filenames SHALL preserve their established formats.

#### Scenario: Administrator compares activity times

- **WHEN** an administrator views member activity, notes, support cases, audit events or conversations
- **THEN** the displayed datetimes use the same year-first minute-precision format

### Requirement: Support account context and username navigation

Support case details SHALL show account state and roles for linked reporters and reported members. Support member URLs SHALL prefer usernames, accept legacy identifiers and link to the full admin member view for authorised administrators. Existing role permissions SHALL remain in force.

#### Scenario: Staff inspects a support case

- **WHEN** staff opens a case linked to member accounts
- **THEN** the case shows each member's current suspension, shadowban and staff-role badges where applicable
- **AND** account links identify the members by username when available

#### Scenario: Administrator opens a support member

- **WHEN** an administrator opens a support member page through a legacy identifier
- **THEN** the page replaces the URL with the member's username
- **AND** offers a link to that member's full admin account view

### Requirement: Username change history

The system SHALL retain each successful username change as an old/new pair
with its timestamp. A failed username update SHALL NOT append history. Username
history SHALL be private and available only through admin-authorised tools. The
system SHALL NOT expose it through public or member profile responses.
Administrators SHALL be able to inspect changes from the previous 90 days or
all available history. The default list SHALL cover the previous 90 days and
return at most 50 changes per page, ordered by change time descending and
member ID ascending to break ties. It SHALL show each member's current username
linked to their admin report, optional display name, old and new usernames,
and exact UTC change time. Historical members whose previous username is
unknown SHALL show that value as unavailable, never fabricated.

#### Scenario: Username changes successfully

- **WHEN** an eligible member successfully changes their username
- **THEN** the former and new usernames and change time are saved atomically
- **AND** the member's current username and existing change timestamp are
  updated in that same save

#### Scenario: Username change fails

- **WHEN** a username change fails validation or persistence
- **THEN** no username history entry is saved

#### Scenario: Administrator opens recent username changes

- **WHEN** an authorised administrator opens `/admin/username-changes`
- **THEN** the page lists changes from the previous 90 days by default
- **AND** shows the member's current username, optional display name, old and
  new usernames, and exact UTC times
- **AND** links each current username to its admin member report

#### Scenario: Administrator chooses all available history

- **WHEN** an administrator selects the all-time history range
- **THEN** the page includes every recorded username change
- **AND** includes legacy `usernameUpdated` timestamps with the old username
  unavailable when no recorded history exists

#### Scenario: Administrator pages through changes

- **WHEN** more than 50 username changes match the selected range
- **THEN** the API returns pages of at most 50 changes
- **AND** each page continues the same descending-time order with stable ID
  tie-breaking

#### Scenario: Regular member requests recent username changes

- **WHEN** a regular member requests the username changes page or API
- **THEN** the system denies access

#### Scenario: Administrator reviews a historical timestamp without a prior name

- **WHEN** a historical timestamp has no corresponding username history
- **THEN** the interface identifies the previous username as unavailable
- **AND** does not infer a previous username from the current one

### Requirement: Durable support email handling

Support correspondence SHALL use stable threading identifiers, a durable idempotent outbox and opt-in read-only IMAP over verified TLS. Intake SHALL checkpoint only durable processing, deduplicate replay and avoid response loops. Sender/thread mismatches SHALL create separate requests without gaining investigation access. Correspondence SHALL retain plain text and attachment notices; files remain in Zoho.

#### Scenario: Intake processing bounds

- **WHEN** mailbox intake is enabled
- **THEN** it polls every minute without deleting, moving or marking mail read
- **AND** raw processing is bounded to 25 MiB and stored text to 12 MiB with explicit omission notices directing staff to the intact original in Zoho.

#### Scenario: Staging runs with production application settings

- **WHEN** a non-production site starts with production NODE_ENV or copied SMTP settings
- **THEN** all outgoing mail is captured and production mailbox intake remains disabled
- **AND** live delivery requires the production runtime and production site domain; existing deployments may omit the deployment tier, but an explicit non-production tier prevents live delivery. Controlled staging delivery requires a separate test mailbox and an SMTP recipient allowlist.

#### Scenario: Delivery or intake is interrupted

- **WHEN** sending or mailbox processing fails or restarts
- **THEN** failures and uncertain delivery are visible, duplicate submissions or replay do not create duplicate correspondence, and uncertain sends require explicit retry.

#### Scenario: Request update fails after SMTP acceptance

- **WHEN** acceptance is stored but updating the request's activity fails or its response is lost
- **THEN** recovery reconciles that activity without sending the message again
- **AND** newer staff or requester activity remains unchanged.

#### Scenario: Email contains unsafe HTML or large attachments

- **WHEN** incoming email contains HTML, files or exceeds the processing bound
- **THEN** no remote content is fetched or rendered, bounded processing records a clear notice, and the original remains available in Zoho.

### Requirement: Conservative historical support status import

Administrators SHALL import statuses using unique original fingerprints or explicitly reviewed one-to-one suggestions. Suggestions SHALL require original sender/category, nearby submission times and equivalent normalised messages. Imports SHALL be idempotent, preserve ticket IDs, send no email and grant no investigation access. Logs SHALL exclude correspondence, search text, secrets and payloads.

#### Scenario: Administrator previews historical statuses

- **WHEN** an administrator uploads a reduced manifest
- **THEN** the preview reports exact changes, suggested changes with reasons, and skipped outcomes without applying them
- **AND** support volunteers cannot access import endpoints

#### Scenario: Import is repeated or a request changes after preview

- **WHEN** an administrator applies a reviewed manifest
- **THEN** unchanged exact matches and explicitly selected one-to-one suggestions are updated once and changed or conflicting matches are skipped without sending mail
- **AND** unselected suggestions, unresolved competing matches and requests with newer local activity remain unchanged

### Requirement: Explainable historical support reconciliation

Administrators SHALL preview matching reasons before importing historical statuses. Suggestions SHALL require explicit review and retain identity, one-to-one and concurrent activity safeguards. Reduced files SHALL exclude correspondence and email addresses. Unknown or competing matches SHALL NOT silently apply.

#### Scenario: Reviewing a formatting difference

- **WHEN** original sender and category agree, submission times are nearby and conservatively normalised messages agree
- **THEN** an administrator sees a suggested match with its evidence and must select it before apply

#### Scenario: Unconfirmed historical status

- **WHEN** a request has no stored status
- **THEN** the inbox identifies it as unconfirmed legacy status and offers a filter and count distinct from confirmed Open while retaining unresolved queue access

### Requirement: Support status count filtering

Support staff SHALL be able to activate any status count, including unconfirmed legacy status, to filter requests. Controls SHALL expose their selected state and support keyboard interaction. Filtering SHALL update the URL, preserve search and category, and reset pagination.

#### Scenario: Filter from a status count

- **WHEN** staff activate a status count
- **THEN** the inbox shows requests for that status on page one while retaining search and category
- **AND** the selected count and status dropdown reflect the URL filter

### Requirement: Efficient historical match review

Administrators SHALL be able to select all unambiguous suggestions, clear selection and preview a matching window from one to sixty minutes. Window changes SHALL clear the preview and selections. The server SHALL validate, persist and recheck the chosen window. Bulk selection SHALL exclude competing or shared targets and exact matches. Review SHALL show original local requester details only to administrators, without adding personal data to reduced files or audit logs.

#### Scenario: Wider matching window

- **WHEN** an administrator changes the matching window
- **THEN** a fresh preview is required and apply checks the window stored with that preview
- **AND** original sender/category and message equivalence remain required

#### Scenario: Bulk review

- **WHEN** staff choose Select all unambiguous matches
- **THEN** only unique suggestions without competing source or target assignments are selected
- **AND** original local sender details are visible to help review the decisions

### Requirement: Administrator email delivery diagnostics

The system SHALL provide an administrator-only SparkPost dashboard at `/admin/sparkpost`, adapted from the ROmongous daily email overview, with live application activity and read-only delivery diagnostics.

#### Scenario: Compare application activity and provider metrics

- **WHEN** an administrator selects a supported reporting period
- **THEN** the dashboard shows daily UTC sign-up and private-message counts from the current application database alongside SparkPost sent, delivered, bounced, unique-open and complaint counts
- **AND** missing configuration or provider failure is shown as unavailable rather than zero deliveries.

#### Scenario: Inspect recent provider events

- **WHEN** an administrator opens a recent day
- **THEN** the dashboard provides bounded cursor pages of all available event types, with subject, recipient address, campaign, event history and unique current-account matches, excluding email bodies
- **AND** it identifies retention limits and incomplete pagination without treating absence as proof of non-delivery.

#### Scenario: Preview a sending interruption

- **WHEN** an administrator submits a valid bounded UTC time window
- **THEN** the dashboard previews completed email jobs grouped by campaign and new accounts still awaiting confirmation
- **AND** labels these as unverified candidates rather than confirmed missing emails
- **AND** does not send emails, replay jobs, or alter accounts or reminder counters.

#### Scenario: Restrict access and external requests

- **WHEN** a non-administrator requests diagnostics or supplies an invalid window
- **THEN** the request is rejected before reading diagnostic data or calling SparkPost
- **AND** provider requests use server-held credentials, a fixed supported regional endpoint, bounded pagination and timeouts without exposing provider error bodies or credentials.

### Requirement: Daily email inspection and selected recovery

Administrators SHALL inspect provider messages and select application recovery candidates per UTC day.

#### Scenario: Inspect all available events

- **WHEN** an administrator opens a recent day
- **THEN** all available event types are accessible through bounded cursor pages, with subject, recipient and event history grouped by provider message ID and recipient
- **AND** current account matches are distinguished from exact application-message matches, and retention or incomplete retrieval remains visible.

#### Scenario: Review selected recovery candidates

- **WHEN** an administrator selects sign-ups or unread conversations for a UTC day
- **THEN** checkboxes and select-all affect only eligible rows on the displayed page
- **AND** the administrator reviews recipient and email type before explicitly queuing fresh mail.

#### Scenario: Queue recovery once

- **WHEN** the administrator submits selected candidates while live mail is configured
- **THEN** the server revalidates current confirmation/read/role and conversation eligibility, generates fresh confirmation tokens or current unread reminders, persists duplicate-prevention claims, and audits the actor and per-item outcomes
- **AND** repeated or concurrent submissions cannot queue the same candidate twice, confirmed/read/restricted accounts are skipped, failures remain visible, and no provider email body is replayed.

#### Scenario: Review accounts behind the preview count

- **WHEN** an administrator opens the unconfirmed-account count for an interruption window
- **THEN** a bounded paginated list shows matching accounts, email addresses, sign-up times and recovery status
- **AND** selection and review can queue fresh confirmations across the dates in that window with the same eligibility checks and duplicate prevention as daily recovery.
