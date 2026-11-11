## Implementation

- [x] Validate the proposal before implementation.
- [x] Draft and test a bounded Stalwart JMAP reader and acknowledgement helper.
- [x] Draft and test conservative plain-text reply validation.
- [ ] Add opt-in configuration and scoped reply addresses.
- [ ] Add bounded JMAP ingestion and idempotent message delivery.
- [ ] Update notification headers and templates.
- [ ] Cover valid replies, eligibility, invalid input, duplicates and retries.
- [ ] Add an end-to-end notification/reply/conversation test.
- [x] Add the admin-only, on-demand mailbox preview and access-control tests.
- [ ] Design bounded operational receipt storage and retention before rollout;
      retain outcome and sanitised matching evidence independently of provider
      acknowledgement, without storing reply tokens or credentials.
- [ ] Add an admin-only read API for mailbox configuration and connection/poll
      health plus paginated, filterable receipt outcomes; enforce the server
      admin policy for every request and redact secrets and legacy headers.
- [ ] Add `/admin/email-replies` with delivered, rejected, failed and duplicate
      processing outcomes, separate verified, candidate, ambiguous and
      unmatched matching states, and escaped receipt details separating the
      extracted reply from quoted content and showing sanitised sender,
      recipient and matching evidence.
- [ ] Add integration coverage for receipt persistence across acknowledgement,
      retention, filtering, legacy-header matching evidence, access control and
      dry-run behaviour (no conversation writes and no provider acknowledgement).
- [ ] Add an end-to-end admin diagnostic-page test for outcome filtering and
      receipt detail rendering; confirm no replay, acknowledge or delete action
      is exposed.
- [ ] Run repository checks and server coverage without lowering thresholds.
- [ ] Document deployment, archive the change and update the living specification.
