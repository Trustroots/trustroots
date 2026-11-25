## ADDED Requirements

### Requirement: Agenda delivery job retention

The worker SHALL periodically delete at most 5,000 eligible documents per run from the live Agenda queue. Eligible documents SHALL be unlocked, enabled, unscheduled, non-recurring `send email` or legacy `send push message` jobs with a recorded finish or terminal failure older than 90 days. Eligibility SHALL be rechecked when deleting each batch.

#### Scenario: Old terminal delivery jobs accumulate

- **WHEN** the worker runs scheduled retention
- **THEN** it deletes eligible terminal job records in bounded batches, including legacy failures that only have a failure timestamp
- **AND** it preserves delivery history within the last 90 days

#### Scenario: A job is still actionable

- **WHEN** a delivery job is queued, scheduled for retry, locked, disabled, recurring or lacks a terminal timestamp
- **THEN** the worker preserves it
