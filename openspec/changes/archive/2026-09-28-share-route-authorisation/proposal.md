## Why

Six callback-based route policies repeat role lookup, ACL evaluation and denial/error responses. Extract a shared factory while keeping each policy instance, role grants and domain prechecks isolated.

## What Changes

- Shared route authorisation middleware.
- Add focused regression tests and preserve coverage requirements.
- Keep the admin policy's distinct handling and the asynchronous experiences policy unchanged.

## Capabilities

### Modified Capabilities

- `runtime-platform`: Shared route authorisation middleware.

## Impact

Internal refactor with no API, persistence or deployment change. The asynchronous experiences policy keeps its existing error propagation. Existing policy and route tests provide regression coverage; no new user functionality needs an additional end-to-end journey.
