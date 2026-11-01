## ADDED Requirements

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

## MODIFIED Requirements

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
