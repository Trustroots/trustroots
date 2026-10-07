## Implementation

- [x] Validate this proposal before implementation.
- [x] Check positive local log-rotation limits and existing container logging.
- [x] Add outage and adoption regression cases.
- [x] Document adoption, independent shipping and outage recovery.
- [x] Run deployment checks, update the living specification and archive.

Validation: all 17 deployment regression tests pass, including CLI deploy and
rollback paths with simulated Docker timeouts and stale remote logging. Python
compilation and diff whitespace checks pass. A browser end-to-end test is not
appropriate for this operator CLI; its integration tests invoke the entry point
with fake Docker responses and assert that no image/container changes occur.
Production adoption and outage rehearsal remain operator work under issue #3038.
