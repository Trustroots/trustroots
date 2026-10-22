## Why

Requiring an unverified surname adds unnecessary disclosure and prevents members
from using a single name. Issue #2785 asks to stop requiring it.

## What Changes

- Keep a required first name, allow a nickname, and make last name optional in
  signup and profile editing.
- Explain that a full name is not required, and allow existing members to clear
  their surname.
- Accept omitted or empty surnames on the server and generate clean display
  names using the available name parts.
- Retain existing surnames and API fields; no data migration is needed. Deploy
  the server and client changes together.

## Impact

- Affected specification: account-access.
- Affected modules: users (forms, validation, model and regression tests).
- Preserve names already stored and retain existing input sanitisation.
