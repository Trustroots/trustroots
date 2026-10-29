## 1. Contracts and persistence

- [x] Add shared statuses, request/thread records, compatibility migration and metadata-only audit behaviour.
- [x] Extend list/search/count/detail/status APIs and explicit conversation/reply/retry routes.

## 2. Inbox

- [x] Add request deep links and URL-backed combined filters, search, counts and pagination.
- [x] Add shared chronological correspondence, plain-text composer and delivery/attachment notices.

## 3. Email

- [x] Add durable, idempotent SMTP outbox and read-only checkpointed IMAP intake with safe MIME processing.
- [x] Add opt-in support acknowledgement and remove forwarding loops when enabled.
- [x] Document mailbox setup, staged verification and cutover limitations.

## 4. Import

- [x] Add local status-manifest preparation and administrator preview/apply with conservative one-to-one matching and stale/change guards.
- [x] Keep uploads reduced, private, idempotent and unable to send mail or change investigation links.

## 5. Verification and completion

- [x] Add anonymous client/server and end-to-end coverage for successful and failure flows.
- [x] Run pnpm check, relevant server/e2e and coverage checks without lowering baselines.
- [x] Update living specifications and documentation and archive the proposal after successful implementation.
