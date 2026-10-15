# Account Access Specification

## Purpose

Allow people to create, secure, recover, and end access to their Trustroots
account.

## Requirements

### Requirement: Explicit profile response fields

Profile responses SHALL include only explicitly approved fields. Account-owner
responses SHALL preserve fields required for profile editing, account settings,
and blocking. Public responses SHALL omit email addresses, account settings, IP
addresses, push credentials, provider credentials, and unrecognised document
fields. Existing sanitisation and viewer-dependent privacy rules SHALL still
apply.

The member-entered home and origin place labels are public profile fields.
Precise coordinates and street addresses are not part of the profile response.
Viewer-dependent profile responses SHALL NOT be marked for public shared
caching.

#### Scenario: Public profile response excludes private fields

- **WHEN** a member requests another member's profile
- **THEN** the response includes only approved public profile fields
- **AND** account, credential, and unrecognised fields are omitted
- **AND** public place labels may be included without precise coordinates or
  street addresses

#### Scenario: Account holder receives profile editing fields

- **WHEN** an account holder requests their own profile
- **THEN** the response includes the fields required to edit their profile and
  account settings
- **AND** IP addresses, push credentials, provider credentials, and
  unrecognised fields are omitted

#### Scenario: Viewer-specific profile response is not publicly cached

- **WHEN** a profile response depends on the authenticated viewer
- **THEN** the response is not marked cacheable by a public shared cache

### Requirement: Session cookie security and persistence

The system SHALL issue session cookies with HttpOnly and SameSite=Lax. When
HTTPS is enabled, it SHALL mark session cookies Secure and issue them only for
HTTPS requests. Forwarded protocol headers SHALL be trusted for this decision
only when the session proxy setting is explicitly enabled. The system SHALL
not persist or issue cookies for uninitialised sessions, SHALL avoid rewriting
unchanged sessions, and SHALL refresh their expiry through the session store.

#### Scenario: Visitor makes an uninitialised request

- **WHEN** a visitor makes a request without changing session state
- **THEN** the system does not issue a session cookie or persist a session

#### Scenario: HTTPS session is changed

- **WHEN** a person changes session state through a verified HTTPS request
- **THEN** the system issues an HttpOnly, SameSite=Lax, Secure session cookie

#### Scenario: Forwarded protocol is not trusted by default

- **WHEN** a request over HTTP includes `X-Forwarded-Proto: https` while the
  session proxy setting is disabled
- **THEN** the system does not treat the request as HTTPS for session cookies

#### Scenario: Existing session remains unchanged

- **WHEN** a person makes a request without changing an existing session
- **THEN** the system refreshes the session expiry without rewriting the session

### Requirement: Account registration

The system SHALL allow a person to create an account with valid, unique
registration details and SHALL explain invalid or unavailable details.

#### Scenario: Person creates an account

- **WHEN** a person submits valid and unique registration details
- **THEN** the system creates their account

#### Scenario: Person submits unavailable registration details

- **WHEN** a person submits a username or email address that cannot be used
- **THEN** the system reports that the registration details are invalid or unavailable

### Requirement: Flagged signup alerts

The system SHALL send a best-effort internal alert after a newly created
account's identifying signup text matches a configured safety-review keyword.

#### Scenario: Signup matches a keyword

- **WHEN** a saved signup's first name, last name, display name, or username
  contains a configured keyword case-insensitively
- **THEN** the system sends an internal alert identifying the matched keywords
  and member

#### Scenario: Alert delivery fails

- **WHEN** delivery of a flagged-signup alert fails
- **THEN** the saved account's confirmation and login flow continues normally

### Requirement: Sign-in and protected access

The system SHALL let account holders sign in using either their username or
email address, and SHALL require sign-in for member-only routes.

#### Scenario: Account holder signs in with an email address

- **WHEN** an account holder submits valid email-address credentials
- **THEN** the system signs them in and opens their member experience

#### Scenario: Visitor opens a member-only route

- **WHEN** a signed-out visitor opens a member-only route
- **THEN** the system directs them to sign in

#### Scenario: Person submits invalid credentials

- **WHEN** a person submits invalid sign-in credentials
- **THEN** the system shows an error and keeps them on the sign-in page

### Requirement: Account confirmation and recovery

The system SHALL let account holders confirm their email address and recover
access through valid password-reset details.

#### Scenario: Account holder confirms their email address

- **WHEN** an account holder submits a valid email-confirmation token
- **THEN** the system makes their profile public

#### Scenario: Account holder resets their password

- **WHEN** an account holder submits a valid password-reset token and matching new passwords
- **THEN** the system updates their password
- **AND** the account holder can sign in with the new password

### Requirement: Private password recovery

The system SHALL immediately return the same successful status and generic
acknowledgement for valid recovery identifiers, whether or not an account
exists. Account lookup, token creation, persistence, email rendering, and email
queueing SHALL happen after the acknowledgement and SHALL NOT change its
status or body. Recovery work is best-effort until it reaches the existing
durable email queue.

#### Scenario: Recovery is requested for a known account

- **WHEN** a visitor submits a valid username or email address belonging to an
  account
- **THEN** the system immediately returns the generic recovery acknowledgement
- **AND** it attempts to enqueue a password-reset email

#### Scenario: Recovery is requested for an unknown account

- **WHEN** a visitor submits a valid username or email address belonging to no
  account
- **THEN** the system immediately returns the same status and acknowledgement

#### Scenario: Recovery email delivery is stalled or fails

- **WHEN** recovery email delivery is stalled or fails after a known account is
  submitted
- **THEN** the generic acknowledgement is returned without waiting for delivery
- **AND** delivery failure does not change the response

### Requirement: Single-use password reset

The system SHALL update a password and consume its reset token in one
conditional database operation that only matches a valid, unexpired token.

#### Scenario: Account holder resets a password

- **WHEN** an account holder submits matching new passwords with a valid,
  unexpired reset token
- **THEN** the password, password-updated timestamp, and authentication version
  are updated atomically with token consumption
- **AND** the browser completing the reset is signed in with a new session
- **AND** sessions created before the reset require sign-in again

#### Scenario: Reset token is reused or submitted concurrently

- **WHEN** a reset token has already been consumed by another request
- **THEN** the system rejects the reset without changing the password

### Requirement: Account-wide session revocation after credential changes

The system SHALL validate the authentication version stored in each Passport
session against the account's current version. Password reset, authenticated
password change, and an actual administrative role change SHALL increment the
version atomically with the corresponding account update. A role request that
does not change roles SHALL NOT increment the version. Sessions using the
legacy account-ID-only format SHALL require sign-in again after deployment.

#### Scenario: Account holder changes their password

- **WHEN** an authenticated account holder changes their password after
  providing the current password
- **THEN** the password, password-updated timestamp, and authentication version
  are updated consistently
- **AND** the current browser receives a newly established session
- **AND** sessions in other browsers require sign-in again

#### Scenario: Administrator changes account roles

- **WHEN** an administrator changes an account's roles
- **THEN** the account's authentication version increments with the role update
- **AND** sessions created before the change require sign-in again

#### Scenario: Administrator repeats a role request with no effect

- **WHEN** an administrator submits a role request that leaves roles unchanged
- **THEN** the authentication version is unchanged
- **AND** existing sessions remain valid

#### Scenario: Legacy session or deleted account is presented

- **WHEN** a session contains only the legacy account ID, or its account no
  longer exists
- **THEN** Passport rejects the session and member-only routes require sign-in

### Requirement: Welcome-sequence delivery

The system SHALL not send welcome-sequence emails to suspended or shadowbanned
members.

#### Scenario: Restricted member is eligible for a welcome-sequence step

- **WHEN** a suspended or shadowbanned member otherwise meets a
  welcome-sequence job's timing and profile criteria
- **THEN** the job does not select that member for email delivery

### Requirement: Member data export

The system SHALL let an authenticated member download an unsigned, versioned
JSON file containing their profile, the circles they belong to, their contacts,
their hosting and meet offers (including expired offers still stored), and the
messages and experiences they have written. The download filename SHALL be
`trustroots-data-<username>-<yyyymmdd>-<hhmm>.json`, using the member's
username and the UTC time of the export. When the username is not safe to
place in a filename, the system SHALL omit it and use
`trustroots-data-<yyyymmdd>-<hhmm>.json`.

#### Scenario: Member downloads their data

- **WHEN** an authenticated member requests their data export
- **THEN** the system returns a JSON attachment named with that member's
  username and the UTC export time, with format `trustroots-data-export`,
  version `1`, an export timestamp, and `profile`, `circles`, `contacts`,
  `hostingOffers`, `messages`, and `experiences` sections

#### Scenario: Unauthenticated visitor requests an export

- **WHEN** an unauthenticated visitor requests the data-export endpoint
- **THEN** the system refuses the request

### Requirement: Browser-origin mutation protection

The system SHALL reject state-changing requests with a foreign Origin or
non-same-origin Fetch Metadata value. Originless API mutations SHALL require
JSON content or the dedicated `X-Trustroots-Request: 1` header, and multipart
mutations SHALL always require that header. The system SHALL end an account
holder's session only after a same-origin state-changing POST sign-out request.
Originless JSON requests remain compatible and do not carry synchroniser-token
proof, so this is a bounded defence-in-depth measure.

#### Scenario: Account holder signs out

- **WHEN** an account holder submits a same-origin POST sign-out request
- **THEN** the system clears their session
- **AND** member-only routes require them to sign in again

#### Scenario: Browser submits a cross-origin state-changing account request

- **WHEN** a state-changing request includes a foreign `Origin` or
  non-same-origin Fetch Metadata value
- **THEN** the system rejects it without applying the mutation

#### Scenario: Legacy client omits browser-origin metadata

- **WHEN** a state-changing request omits both `Origin` and Fetch Metadata
- **AND** the request uses JSON content or includes the dedicated request
  header
- **THEN** the system preserves existing API compatibility
- **AND** the request remains outside this bounded browser-origin mitigation

#### Scenario: Originless API request has no JSON content or request marker

- **WHEN** an API mutation omits both browser-origin signals and has neither
  JSON content nor the dedicated request header
- **THEN** the system rejects it without applying the mutation

#### Scenario: Client requests sign-out with GET

- **WHEN** a client requests the sign-out endpoint with GET
- **THEN** the system does not end the account holder's session

#### Scenario: Native API client sends an originless mutation

- **WHEN** a supported native client sends a state-changing API request with
  the dedicated request header
- **THEN** the system preserves the native API flow

#### Scenario: Reporting or authenticated webhook client posts

- **WHEN** a CSP or Expect-CT report is posted, or SparkPost posts a webhook
  authenticated with its configured credentials
- **THEN** the system accepts the request for its dedicated handler

### Requirement: Account settings

The system SHALL let an authenticated account holder update valid account
details and change their password after providing their current password. The
account settings page SHALL explain the existing username format, availability,
and change timing rules beside the username field.

#### Scenario: Account holder updates account details

- **WHEN** an authenticated account holder submits valid account details
- **THEN** the system saves the updated details

#### Scenario: Account holder changes their password

- **WHEN** an authenticated account holder provides their current password and matching valid new passwords
- **THEN** the system updates their password
- **AND** the account holder can sign in with the new password

#### Scenario: Account holder reads username change rules

- **WHEN** an authenticated account holder opens account settings
- **THEN** the username field explains when changes are allowed and what makes
  a username valid and available

### Requirement: Account removal

The system SHALL require a valid confirmation token before permanently
removing an account.

#### Scenario: Account holder confirms removal

- **WHEN** an authenticated account holder requests removal and confirms it with a valid token
- **THEN** the system removes the account

#### Scenario: Account holder submits an invalid removal token

- **WHEN** an account holder submits an invalid removal token
- **THEN** the system rejects the removal

### Requirement: Connected accounts and push registrations

The system SHALL let authenticated account holders remove connected OAuth
provider data and manage their push-notification registrations.

#### Scenario: Account holder disconnects an OAuth provider

- **WHEN** an authenticated account holder disconnects a supported OAuth provider
- **THEN** the system removes the provider data from their account

#### Scenario: Account holder manages a push registration

- **WHEN** an authenticated account holder adds or removes a push registration
- **THEN** the system persists the requested registration state

### Requirement: Finish-signup reminder delivery

The system SHALL not send finish-signup reminder emails to suspended or
shadowbanned members.

#### Scenario: Restricted member remains incomplete

- **WHEN** a suspended or shadowbanned member otherwise meets a finish-signup
  reminder job's timing and profile criteria
- **THEN** the job does not select that member for email delivery

### Requirement: Service usernames remain reserved

New accounts and username changes SHALL reject configured reserved names. Existing members SHALL retain unchanged reserved usernames when saving unrelated profile changes and using identity lookups.

#### Scenario: A new member selects a reserved service name

- **WHEN** a signup or username change selects a configured reserved name
- **THEN** the request is rejected without changing the stored identity

#### Scenario: An existing member retains a newly reserved name

- **WHEN** a member saves an unrelated profile change without changing their reserved username
- **THEN** the save succeeds and the username remains unchanged

### Requirement: Pending email addresses are valid

Pending email addresses SHALL pass the existing email validator or be empty when no confirmation is pending. Profile email changes SHALL reject malformed addresses and non-string values before processing the change.

#### Scenario: A member submits a malformed email change

- **WHEN** a member submits an invalid email address or a non-string value
- **THEN** the request returns a validation error without changing the stored email

#### Scenario: No email confirmation is pending

- **WHEN** an account has an empty pending email address
- **THEN** email validation allows the account to be saved

### Requirement: Versioned password verifiers

The system SHALL store newly registered, reset, or changed local account passwords using an asynchronous, salted, versioned adaptive password verifier that records its algorithm and work parameters.

#### Scenario: New password is stored

- **WHEN** a person registers or sets a new password
- **THEN** the system stores only a verifier in the current versioned format
- **AND** the verifier records its algorithm, work parameters, random salt, and derived key
- **AND** the plaintext password is not logged or returned

#### Scenario: Current verifier authenticates

- **WHEN** an account holder submits the password matching a supported current verifier
- **THEN** the system authenticates the account holder
- **AND** the KDF runs asynchronously

### Requirement: Legacy password verifier compatibility

The system SHALL continue to verify existing PBKDF2-HMAC-SHA1 password records during migration and SHALL upgrade a valid legacy record after successful sign-in without changing the account password or invalidating its sessions.

#### Scenario: Account holder signs in with a legacy password

- **WHEN** an account holder submits the password matching a legacy PBKDF2-HMAC-SHA1 record
- **THEN** the system authenticates the account holder
- **AND** the system replaces the legacy verifier with the current versioned verifier if the stored legacy verifier is still unchanged
- **AND** the system removes the separate legacy salt
- **AND** the rehash does not change the password-updated timestamp or authentication version

#### Scenario: Legacy password changes during verification

- **WHEN** the stored password record changes after a legacy verifier has been read but before its upgrade is saved
- **THEN** the system does not overwrite the newer record
- **AND** the system does not create an authenticated session based only on the stale verification

#### Scenario: Stored verifier uses an unsupported format

- **WHEN** a stored verifier is malformed or uses an unsupported version or algorithm
- **THEN** the system treats the credentials as invalid
- **AND** the system does not fall back to plaintext comparison or accept partially parsed parameters

### Requirement: Bounded password verification work

The system SHALL run password derivations asynchronously with current verifier
parameters restricted to an explicit supported allowlist and SHALL bound active
and queued derivations per application process.

#### Scenario: Password verifier parameters are malformed or unsupported

- **WHEN** a stored verifier has parameters or encodings outside the supported
  format
- **THEN** the system treats the credentials as invalid
- **AND** it performs dummy current-cost verification work
- **AND** it does not execute an attacker-selected KDF cost

#### Scenario: Password verification queue is full

- **WHEN** an authentication request arrives after the active derivation and
  bounded queue are full
- **THEN** the system returns a generic retryable service-unavailable response
- **AND** it does not fall back to a cheaper verifier
- **AND** it exposes only active and queued counts to operational monitoring

### Requirement: Targeted limits for account access requests

The system SHALL enforce configurable, shared request limits for sign-in, password recovery and confirmation-resend operations. Limits SHALL use a trusted client address together with a keyed account-identifier digest where an account identifier is supplied, so an attacker cannot lock an account by submitting requests from unrelated clients. The system SHALL not rely on caller-supplied forwarding headers for the client address.

#### Scenario: Client exceeds an account-access policy

- **WHEN** a client exceeds a configured sign-in, recovery or confirmation-resend limit within its window
- **THEN** the request is rejected with HTTP 429 and a `Retry-After` header

#### Scenario: Requests are spread across application instances

- **WHEN** requests for the same applicable client and account key reach different application instances during one window
- **THEN** the shared counter enforces the same limit across those instances

#### Scenario: A caller supplies a forged forwarding header

- **WHEN** a caller supplies an untrusted `X-Forwarded-For` value
- **THEN** that value does not select the request's limiting client identity

### Requirement: Sign-in session confirmation

After accepting sign-in credentials, the client SHALL confirm through a subsequent
non-cacheable request that the server recognises the same account before updating
its authenticated state or redirecting. The session endpoint SHALL return only the
current account identifier, or null for anonymous requests, without initialising
an anonymous session. Session cookie security settings SHALL remain unchanged.

#### Scenario: Session persists after sign-in

- **WHEN** credentials are accepted and the subsequent request identifies the same account
- **THEN** the client completes sign-in and preserves the intended destination

#### Scenario: Session is missing or belongs to a different account

- **WHEN** credentials are accepted but the subsequent request does not identify the same account
- **THEN** the client stays on the sign-in form and explains that a cookie or site problem prevented keeping the person signed in
- **AND** the form allows another attempt without treating the credentials as invalid

#### Scenario: Session verification request fails

- **WHEN** credentials are accepted but the subsequent session request fails
- **THEN** the client explains that it could not check the session and offers a retry
- **AND** it does not claim cookies are blocked or redirect

### Requirement: Member session controls and expiry

The system SHALL let an authenticated member list their own active sessions
using opaque identifiers and identify the current session. Session controls
SHALL expose no browser fingerprint or precise location. Individual revocation
and account-wide sign-out SHALL require the member's current password. The
system SHALL enforce a seven-day idle and 28-day absolute lifetime for every
signed-in member, including administrators and welcome-team greeters. Privileged
admin tooling SHALL use a separate password step-up instead of a shorter
session. Revoked records SHALL remain as tombstones until absolute expiry so
concurrent requests cannot recreate revoked sessions. Session-control responses
SHALL not be cached, and mutations SHALL use a dedicated shared request limit.
Deployments SHALL create the MemberSession TTL index because production disables
automatic index creation.

#### Scenario: Member reviews active sessions

- **WHEN** a member opens session controls
- **THEN** they see active sessions for their own account, including which one
  is current
- **AND** the response does not expose browser fingerprints or precise location

#### Scenario: Member revokes one session

- **WHEN** a member submits the current password to revoke one of their sessions
- **THEN** that session cannot access authenticated routes again
- **AND** other sessions remain active

#### Scenario: Member signs out everywhere

- **WHEN** a member submits the current password to sign out everywhere
- **THEN** the account authentication version increments
- **AND** every existing session requires sign-in again

#### Scenario: Session reaches an idle or absolute lifetime

- **WHEN** a member session reaches its idle or absolute lifetime
- **THEN** the server destroys the session and requires sign-in again

### Requirement: Account access deployed version

The system SHALL display the deployed build date and commit link on signin, signup, password recovery/reset and not-found pages when build metadata is available.

#### Scenario: Visitor diagnoses account access

- **WHEN** a visitor opens an account access page with build metadata available
- **THEN** a compact footer exposes the deployed date and commit

### Requirement: Login route alias

The system SHALL redirect /login to /signin while preserving query parameters.

#### Scenario: Visitor uses the login alias

- **WHEN** a visitor requests /login with a returnTo query parameter
- **THEN** the visitor is redirected to /signin with the same parameter

### Requirement: Username selection is consistent and type safe

Signup, signup availability checks, profile username changes and model validation for new or changed usernames SHALL require 3–34 ASCII letters and digits including at least one letter. Uppercase input SHALL be accepted and stored lowercase. Explicitly supplied non-string usernames SHALL be rejected by the APIs before coercion. Profile updates MAY omit the username.

#### Scenario: A person selects a username

- **WHEN** a new username contains punctuation, only digits, or an invalid length
- **THEN** signup, availability checks and username changes reject it with validation feedback

#### Scenario: A person selects uppercase letters

- **WHEN** an otherwise valid new username contains uppercase letters
- **THEN** it is accepted and stored lowercase

#### Scenario: An API caller supplies a non-string username

- **WHEN** signup, signup availability or a profile update supplies a null, boolean, number, array or object username
- **THEN** it returns HTTP 400 without changing the stored identity or username-change timestamp

### Requirement: Existing username identities remain compatible

Unchanged existing usernames, including underscores, hyphens, dots, digits-only names and reserved names, SHALL remain usable for sign-in, profile lookup, NIP-05 lookup and unrelated saves. NIP-05 SHALL retain existing member visibility restrictions. Model validation SHALL enforce selection policy for new and changed usernames without revalidating unchanged identities.

#### Scenario: A member retains an existing identity

- **WHEN** an existing member signs in, resolves their visible profile or NIP-05 identity, or saves an unrelated change
- **THEN** their existing username remains usable without being renamed

#### Scenario: A member resubmits their normalised username

- **WHEN** a profile update supplies the same username after trimming and lowercasing
- **THEN** the update succeeds without applying the change cooldown or changing its timestamp

#### Scenario: A member changes their username

- **WHEN** a member selects a different valid username
- **THEN** the existing three-month cooldown applies and a successful change records the change timestamp

### Requirement: Hashed account action credentials

The system SHALL store SHA-256 digests of newly issued email-confirmation, password-reset and account-removal tokens. Email links SHALL contain the original random bearer token and existing URL formats SHALL remain compatible. Stored digests SHALL not be accepted as bearer tokens.

#### Scenario: Member follows a new action link

- **WHEN** an action token is issued
- **THEN** its digest is stored in the user document and its original value is sent in the email link
- **AND** a valid original token can complete its action while the stored digest cannot

#### Scenario: Password reset is repeated

- **WHEN** a password reset consumes a valid token
- **THEN** the token is atomically removed and a subsequent attempt is rejected

#### Scenario: Outstanding legacy link is used

- **WHEN** a member follows an outstanding legacy token link
- **THEN** the link remains valid under its existing expiry and action requirements

#### Scenario: Signup reminder races with confirmation

- **WHEN** a reminder prepares a fresh confirmation token while another request consumes or replaces the existing token
- **THEN** the reminder does not restore or overwrite that token and sends no stale reminder

#### Scenario: Operator migrates outstanding legacy credentials

- **WHEN** the maintenance migration is run without an apply flag
- **THEN** it reports aggregate counts without modifying credentials or disclosing bearer values
- **WHEN** the migration is explicitly applied
- **THEN** legacy tokens are replaced by digests without changing expiry or restoring concurrently consumed tokens
- **AND** repeated application is idempotent

### Requirement: Authenticator-based multi-factor access

Members MAY enable authenticator-app MFA. The system SHALL encrypt pending and
active TOTP secrets with AES-256-GCM using a dedicated deployment key, and
SHALL store recovery codes only as one-way hashes. Enrolment and management
operations SHALL require password confirmation. Each TOTP time step and
recovery code SHALL be accepted at most once through an atomic database update.

#### Scenario: Member enrols an authenticator

- **WHEN** a signed-in member confirms their password and begins enrolment
- **THEN** the system returns an authenticator provisioning URI and a short-lived
  pending secret
- **AND** MFA remains inactive until a current code is confirmed
- **AND** successful enrolment displays recovery codes once

#### Scenario: MFA member signs in

- **WHEN** a member with MFA enabled submits a valid password
- **THEN** the system creates only a short-lived pre-authentication challenge
- **AND** it establishes a member session only after a valid unused TOTP or
  recovery code
- **AND** concurrent attempts cannot consume the same factor more than once

#### Scenario: MFA member manages factors

- **WHEN** a member views, replaces recovery codes, or disables MFA
- **THEN** the system does not expose TOTP secrets or recovery-code hashes
- **AND** management requires password confirmation and a valid unused factor
- **AND** replacing codes invalidates previous codes

#### Scenario: Recovery and confirmation do not bypass MFA

- **WHEN** an MFA member resets a password, confirms an email address, or
  completes another direct login path
- **THEN** the operation does not create an MFA-verified session without a
  successful second factor
- **AND** MFA-enabled members cannot use member routes until their session has
  verified the second factor

#### Scenario: MFA verification is rate limited

- **WHEN** a person submits repeated TOTP or recovery-code attempts
- **THEN** the system applies shared per-IP and per-account limits across
  application instances

#### Scenario: Privileged member requires verified MFA

- **WHEN** an administrator, moderator, or welcome-team member has no verified
  MFA session
- **THEN** account APIs remain blocked until enrolment and verification finish
- **AND** an unenrolled member can reach the account screen to enrol
- **AND** sign-in, sign-out, session status, and MFA endpoints remain reachable
  so the member can establish a verified session

#### Scenario: Native client does not implement MFA challenge

- **WHEN** a member with MFA enabled signs in through a native client that does
  not support the challenge response
- **THEN** the client cannot complete sign-in until its MFA challenge flow is
  implemented

### Requirement: Production script policy

The system SHALL forbid JavaScript eval and unnonced inline scripts in production, forbid object content, and restrict script origins to the application and required analytics providers. It SHALL retain nonce-authorised bootstrap scripts, blob map workers and development eval source maps.

#### Scenario: Production document is served

- **WHEN** the production application serves a document
- **THEN** script-src excludes unsafe-eval and unsafe-inline and includes a fresh per-response nonce
- **AND** object-src is none and unused wildcard script origins are absent

#### Scenario: Browser executes untrusted inline content

- **WHEN** an unnonced inline script is appended to a document
- **THEN** the browser blocks its execution while the application remains usable

#### Scenario: Developer uses hot reload

- **WHEN** the development application serves a document
- **THEN** eval source maps remain supported under a report-only policy

### Requirement: Supported profile image sources

The system SHALL support uploaded photos, Gravatar and no profile photo. It
SHALL NOT request Facebook images. Stored Facebook avatar selections SHALL be
interpreted as no profile photo without preventing unrelated account updates.
New Facebook avatar selections SHALL be rejected. Legacy social connections
SHALL remain removable independently of profile images.

#### Scenario: Member has a stored Facebook avatar selection

- **WHEN** a legacy member document with a Facebook avatar selection is loaded
- **THEN** the selection is interpreted as no profile photo
- **AND** the client displays its normal placeholder without contacting Facebook
- **AND** the member can save unrelated profile changes or choose a supported image source

#### Scenario: Member requests a Facebook image source

- **WHEN** a member submits Facebook as a new avatar selection or explicit avatar source
- **THEN** the server rejects the unsupported source

#### Scenario: Member removes a legacy Facebook connection

- **WHEN** a member disconnects stored Facebook provider data
- **THEN** the connection is removed without enabling Facebook profile images
### Requirement: Account-wide sign-in challenge

The system SHALL enforce a shared account-identifier attempt limit across
client addresses while retaining the existing address-based limits and bounded
password-verification queue. After the configured account threshold, it SHALL
require a short-lived proof-of-work challenge bound to the normalised submitted
username or email and the trusted client address. The challenge SHALL be
single-use, and its counter data SHALL not store the identifier in plaintext.
The system SHALL not permanently lock an account based on submitted sign-in
attempts.

#### Scenario: Account threshold requires additional work

- **WHEN** sign-in attempts for one normalised account identifier exceed the
  shared threshold across addresses
- **THEN** the server returns HTTP 429 with a signed challenge and its fixed
  difficulty
- **AND** a valid challenge proof permits one password verification

#### Scenario: Browser and native clients complete the challenge

- **WHEN** a browser, Android client, or iOS client receives the challenge
- **THEN** it computes the bounded proof without blocking the user interface
- **AND** retries the credentials with the proof at most once

#### Scenario: Challenge is replayed or bound to another identity

- **WHEN** a challenge is expired, already used, or presented for another
  account identifier or trusted address
- **THEN** the server rejects the proof and requires a fresh challenge

#### Scenario: Ordinary address throttling is reached

- **WHEN** a sign-in request reaches an existing address-based limit
- **THEN** the server returns its ordinary rate-limit response without a
  proof-of-work challenge

### Requirement: Authenticator MFA

Members MAY enable authenticator-app MFA using TOTP. Enrolment SHALL remain pending until the member confirms a valid code. The system SHALL encrypt pending and active TOTP secrets with AES-256-GCM using a dedicated deployment key, separate from the session and password keys. The deployment SHALL document key generation, configuration, rotation, and backup requirements.

#### Scenario: A member enrols an authenticator

- **WHEN** a member confirms their current password and requests enrolment
- **THEN** the system returns a one-time authenticator provisioning URI and a pending secret
- **AND** it does not mark MFA active until a valid, unused TOTP is verified
- **AND** the pending secret expires after a short period

#### Scenario: An active member verifies MFA

- **WHEN** a member signs in with a valid password and has MFA enabled
- **THEN** the password check creates only a short-lived pre-authentication challenge
- **AND** the system establishes an authenticated session only after a valid TOTP or recovery code
- **AND** concurrent requests cannot consume the same TOTP time step or recovery code more than once

#### Scenario: A member manages MFA

- **WHEN** a member views or changes MFA settings
- **THEN** the system never returns the active secret or recovery-code hashes
- **AND** enrolment, replacement recovery codes, and disablement require a recent password confirmation
- **AND** replacement recovery codes are shown only once and previous codes stop working atomically

#### Scenario: A privileged account lacks verified MFA

- **WHEN** an administrator, moderator, or other configured privileged role has no verified MFA session
- **THEN** privileged routes treat that account as an ordinary member
- **AND** promotion of a privileged account requires MFA to be enrolled and verified before privileged access is granted

#### Scenario: Account recovery does not bypass MFA

- **WHEN** a member resets or changes their password, confirms an email address, or uses another direct login path
- **THEN** the operation cannot establish an MFA-verified session without a successful second factor
- **AND** credential changes invalidate older sessions

#### Scenario: MFA verification is rate limited

- **WHEN** a client submits too many sign-in challenges, TOTP codes, recovery codes, or password confirmations
- **THEN** the system applies bounded IP and account or challenge limits and returns a retry response

### Requirement: Credential-confirmed account email changes

The system SHALL require a fresh current-password confirmation before staging
a different account email and SHALL also require and consume an MFA factor when
MFA is enabled. The existing address SHALL remain active until the current
pending address is confirmed. Members SHALL be able to cancel a pending change,
and the previous address SHALL receive a notification without the new address
or a reusable confirmation token.

#### Scenario: A member stages an email change

- **WHEN** a signed-in member submits a different valid address with their
  current password and, when enabled, a valid authenticator or recovery code
- **THEN** the system stages the address and sends its confirmation to the new
  address
- **AND** the current address remains active and receives a notification

#### Scenario: A member cancels or replaces a pending address

- **WHEN** a member cancels or replaces a pending email change
- **THEN** earlier confirmation tokens cannot apply the cancelled or replaced
  address

#### Scenario: Cancellation races with a replacement

- **WHEN** a pending address or its token changes after a cancellation request
  was authenticated
- **THEN** cancellation returns a retry response and leaves the replacement
  pending address unchanged

#### Scenario: The current pending address is confirmed

- **WHEN** a member confirms the current pending address with its valid token
- **THEN** the system atomically applies that address and clears the pending
  token and address
- **AND** increments the authentication version to invalidate older sessions
- **AND** preserves a verified MFA session only when it was already verified

### Requirement: Bounded email confirmation lifetime

The system SHALL issue email confirmation credentials with a 24-hour lifetime and SHALL store only their digests. Legacy credentials lacking expiry metadata SHALL be accepted only before a configured, deployment-wide deadline that is set seven days after rollout.

#### Scenario: Link reaches its expiry boundary

- **WHEN** an email confirmation is submitted at or after its stored expiry
- **THEN** the system rejects it and leaves the account and pending email unchanged

#### Scenario: Legacy transition deadline passes

- **WHEN** a legacy confirmation without expiry metadata is submitted at or after the configured deadline
- **THEN** the system rejects it and offers the existing resend flow

#### Scenario: Member requests a replacement

- **WHEN** a resend or eligible reminder issues a new confirmation
- **THEN** the new link receives a fresh 24-hour lifetime
- **AND** earlier links cannot confirm the pending address

### Requirement: Atomic confirmation consumption

The system SHALL consume the current email confirmation and apply its account changes in one atomic operation matching the token digest, pending email and valid expiry. Read-only link validation SHALL never consume a credential.

#### Scenario: Two requests confirm concurrently

- **WHEN** two requests submit the same current confirmation credential
- **THEN** exactly one request applies the account changes
- **AND** the other receives the invalid-link outcome

#### Scenario: Reminder overlaps confirmation

- **WHEN** a reminder races with consumption or pending-address replacement
- **THEN** it cannot restore the consumed credential or overwrite the newer pending change

### Requirement: Combined account access regression coverage

The account-access test suite SHALL exercise recovery, session revocation,
sign-in challenges and MFA together, including concurrent use of single-use
credentials and native-client handling of unsupported authentication steps.
These scenarios SHALL use anonymous fixtures and retain the established
coverage thresholds.

#### Scenario: Combined account-access flows are exercised

- **WHEN** account-access integration tests run
- **THEN** they cover password recovery and confirmation on MFA-enabled
  accounts, session invalidation, sign-in challenge completion and concurrent
  credential use
- **AND** a native client that cannot complete a required step does not retain
  an authenticated session

### Requirement: Bounded signup requests

Signup SHALL accept only supported registration fields. The server SHALL apply
shared request limits by client address and normalised recipient email before
account creation and email delivery, returning HTTP 429 and Retry-After when a
policy is exceeded.

#### Scenario: Signup recipient reaches its limit

- **WHEN** signup attempts for the same normalised email exceed the configured limit
- **THEN** further attempts are rejected even from another client address
- **AND** no account or email job is created for the rejected request

#### Scenario: Caller supplies account state

- **WHEN** signup contains fields outside the supported registration fields
- **THEN** those fields do not alter server-owned account state

### Requirement: Bounded email confirmation lifetime

The system SHALL issue email confirmation credentials with a 24-hour lifetime and SHALL store only their digests. Legacy credentials lacking expiry metadata SHALL be accepted only before 1 November 2026 at 00:00 UTC.

#### Scenario: Link reaches its expiry boundary

- **WHEN** an email confirmation is submitted at or after its stored expiry
- **THEN** the system rejects it and leaves the account and pending email unchanged

#### Scenario: Legacy transition deadline passes

- **WHEN** a legacy confirmation without expiry metadata is submitted at or after 1 November 2026 at 00:00 UTC
- **THEN** the system rejects it and offers the existing resend flow

#### Scenario: Member requests a replacement

- **WHEN** a resend or eligible reminder issues a new confirmation
- **THEN** the new link receives a fresh 24-hour lifetime
- **AND** earlier links cannot confirm the pending address

### Requirement: Atomic confirmation consumption

The system SHALL consume the current email confirmation and apply its account changes in one atomic operation matching the token digest, pending email and valid expiry. Read-only link validation SHALL never consume a credential.

#### Scenario: Two requests confirm concurrently

- **WHEN** two requests submit the same current confirmation credential
- **THEN** exactly one request applies the account changes
- **AND** the other receives the invalid-link outcome

#### Scenario: Reminder overlaps confirmation

- **WHEN** a reminder races with consumption or pending-address replacement
- **THEN** it cannot restore the consumed credential or overwrite the newer pending change
