## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Durable support email handling

Support correspondence SHALL use stable threading identifiers, a durable idempotent outbox and opt-in read-only IMAP over verified TLS. Intake SHALL checkpoint only durable processing, deduplicate replay and avoid response loops. Sender/thread mismatches SHALL create separate requests without gaining investigation access. Correspondence SHALL retain plain text and attachment notices; files remain in Zoho.

#### Scenario: Intake processing bounds

- **WHEN** mailbox intake is enabled
- **THEN** it polls every minute without deleting, moving or marking mail read
- **AND** raw processing is bounded to 25 MiB and stored text to 12 MiB with explicit omission notices directing staff to the intact original in Zoho.

#### Scenario: Staging runs with production application settings

- **WHEN** a non-production site starts with production NODE_ENV or copied SMTP settings
- **THEN** all outgoing mail is captured and production mailbox intake remains disabled
- **AND** live delivery requires the explicit production tier and production site domain, while controlled staging delivery requires a separate test mailbox and an SMTP recipient allowlist.

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

Only administrators SHALL preview and apply reduced historical statuses using unique original identity/category/message fingerprints. Imports SHALL be idempotent, preserve ticket identifiers, send no email and grant no investigation permissions. Logs SHALL exclude correspondence, search text, secrets and import payloads.

#### Scenario: Administrator previews historical statuses

- **WHEN** an administrator uploads a reduced manifest
- **THEN** the preview reports changes and skipped outcomes without applying them
- **AND** support volunteers cannot access import endpoints.

#### Scenario: Import is repeated or a request changes after preview

- **WHEN** an administrator applies a previously reviewed manifest
- **THEN** unchanged unique matches are updated once and changed or conflicting matches are skipped without sending mail.
- **AND** ambiguous matches and requests with newer local activity remain unchanged.
