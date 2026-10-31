## Why

Production mail can be configured as live while the underlying Nodemailer transport captures messages. Successful jobs then provide a misleading signal. Issue #3500 calls for early configuration validation and visible mail mode selection.

## What Changes

- Reject JSON, stream, sendmail, SES and custom transports when live SMTP mode is selected.
- Require an explicitly configured SMTP host, service or SMTP URL for live mode.
- Report the effective mail mode at configuration startup without credentials or message data.
- Preserve explicit capture as an intentional maintenance override and keep staging safeguards.
- Document explicit production settings for both services and local validation limits.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Validate live SMTP transport selection and report effective mail mode.

## Impact

Configuration validation and regression tests only; no database or email-provider calls. Invalid live configurations stop startup instead of completing captured jobs. SMTP verification, retries, queue alerts and inbox canaries remain follow-ups to #3500. Configuration-level tests cover this startup behaviour; a browser end-to-end test is not appropriate.
