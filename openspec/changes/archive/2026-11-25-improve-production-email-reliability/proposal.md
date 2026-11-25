## Why

Temporary SMTP outages can strand signup confirmations and password resets.

## What Changes

- Persist bounded, jittered retries for temporary failures and record sanitised outcomes.
- Add an independent queue check, verify SMTP from the deployed worker and check receipt through a controlled inbox canary.

## Impact

The worker, core mail job and deployment tooling are affected. Existing Agenda jobs retain their format. New jobs may carry a delivery deadline. Live checks require a dedicated IMAP inbox and a production alert destination.
