# Queue production deployment notifications

## Why

Greeters and administrators need an email after production readiness and login
checks pass. The deploy helper already records that event and the application
can preview its eligible recipients.

## What changes

- Hand newly completed deployment and explicit rollback receipts to the existing
  mail queue from the deployment helper.
- Snapshot eligible destinations in MongoDB and resume interrupted queueing by
  receipt UUID with a stable Agenda job ID per destination.
- Add an operator recovery command and report handoff errors outside rollback handling.

## Impact

- Affected spec: deployment-success-events.
- Affected code: the production deploy helper, the notification operator command
  and the existing email worker.
