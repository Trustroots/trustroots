## ADDED Requirements

### Requirement: Administrator email delivery diagnostics

The system SHALL provide an administrator-only SparkPost dashboard at `/admin/sparkpost`, adapted from the ROmongous daily email overview, with live application activity and read-only delivery diagnostics.

#### Scenario: Compare application activity and provider metrics

- **WHEN** an administrator selects a supported reporting period
- **THEN** the dashboard shows daily UTC sign-up and private-message counts from the current application database alongside SparkPost sent, delivered, bounced, unique-open and complaint counts
- **AND** missing configuration or provider failure is shown as unavailable rather than zero deliveries.

#### Scenario: Inspect recent provider events

- **WHEN** an administrator opens a recent day
- **THEN** the dashboard shows a bounded sample of delivery-related events with campaign, event type and recipient domain, excluding full addresses and message bodies
- **AND** it identifies retention limits and truncated samples without treating absence as proof of non-delivery.

#### Scenario: Preview a sending interruption

- **WHEN** an administrator submits a valid bounded UTC time window
- **THEN** the dashboard previews completed email jobs grouped by campaign and new accounts still awaiting confirmation
- **AND** labels these as unverified candidates rather than confirmed missing emails
- **AND** does not send emails, replay jobs, or alter accounts or reminder counters.

#### Scenario: Restrict access and external requests

- **WHEN** a non-administrator requests diagnostics or supplies an invalid window
- **THEN** the request is rejected before reading diagnostic data or calling SparkPost
- **AND** provider requests use server-held credentials, a fixed supported regional endpoint, bounded pagination and timeouts without exposing provider error bodies or credentials.
