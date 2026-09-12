# Reserve service names and validate pending email addresses

## Why

Extract the agreed account safeguards from #2726 without adopting its broader username or personal-name restrictions. Reserve service and organisation names and reject malformed email changes before processing them.

## What Changes

- Add the 28 agreed reserved usernames for new accounts, username changes and existing-account profile saves.
- Validate pending email addresses with the existing email validator and reject non-string email changes before string operations.
- Let disabled welcome-email handlers acknowledge an optional completion callback. Agenda already completes their current synchronous handlers; this is callback consistency, not a stuck-job fix.

## Impact

Affected modules: user configuration, model, profile updates and disabled welcome jobs. Existing username syntax and personal-name rules remain unchanged. Accounts already using a reserved username cannot save profile changes while retaining that name. No data migration or deployment changes are required. Existing invalid pending emails will need correction when saving the account.
