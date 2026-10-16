## 1. Proposal

- [x] 1.1 Validate the proposal with strict OpenSpec validation.

## 2. Server boundary

- [x] 2.1 Inventory member read routes and all middleware/indirect side effects;
      define a minimal read allowlist and excluded sensitive GET endpoints.
- [x] 2.2 Implement separate actor/effective-member context, password-confirmed
      and rate-limited entry, explicit exit, session rotation and a 15-minute
      deadline. Reject unsupported targets and nested views.
- [x] 2.3 Recheck actor permissions and both authentication versions; enforce
      read-only restrictions before parameter middleware and route handlers.
- [x] 2.4 Suppress last-seen/IP changes and other automatic member activity;
      implement structured lifecycle/access auditing with private content omitted.
- [x] 2.5 Define and implement server-authoritative context transitions for
      stale tabs, stale forms, concurrent requests, expiry and restoration.

## 3. Client experience

- [x] 3.1 Add entry controls to the admin member report with password/reason
      input, clear private-page scope, error handling and progress state.
- [x] 3.2 Add a persistent accessible banner, expiry state and return action.
- [x] 3.3 Suppress automatic write requests and disable member write controls;
      prevent local read-receipt updates and automatic mutation retries.
- [x] 3.4 Reload and clear account-specific state on transitions; synchronise
      tabs and validate context on focus and requests.

## 4. Verification and completion

- [x] 4.1 Cover actor/target authorisation, target restrictions, password failure,
      rate limits, CSRF, session rotation, revocation, expiry and audit failures.
- [x] 4.2 Prove rejected mutations do not call route/parameter handlers, including
      direct HTTP calls, unlisted reads and credential/export endpoints.
- [x] 4.3 Prove member data, timestamps, IPs, unread state, push registrations,
      notifications and member-attributed analytics remain unchanged.
- [x] 4.4 Cover entry/banner/exit, hidden-header routes, expiry after reload,
      context-change errors and caches in client tests.
- [x] 4.5 Add end-to-end coverage for entry, private-page reads, blocked writes,
      unchanged unread state, return, stale tabs and context transitions.
- [x] 4.6 Run pnpm check, relevant server and end-to-end suites, coverage checks
      and the module-graph check; retain 100% client and server coverage.
- [x] 4.7 Archive this change and update the admin-moderation living spec after
      implementation and successful verification.
