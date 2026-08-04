## 1. Historical spam selection and deletion

- [x] 1.1 Add the bounded eligibility query for the identified historical spam campaigns.
- [x] 1.2 Implement a dry-run maintenance command with explicit deletion, safe revalidation, and aggregate reporting.
- [x] 1.3 Document the production backup, dry-run, and deletion procedure.

## 2. Verification

- [x] 2.1 Add server tests covering eligible deletion, campaign boundaries, every protected activity type, batching, dry-run, and errors.
- [x] 2.2 Document why direct command coverage is sufficient for this no-UI maintenance tool instead of an end-to-end test.
- [x] 2.3 Validate the OpenSpec change and run the relevant server and command tests.
