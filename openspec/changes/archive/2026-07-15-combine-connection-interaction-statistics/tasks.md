## 1. Public statistics API

- [x] 1.1 Aggregate all-time and preceding-90-day replied MessageStat counts.
- [x] 1.2 Aggregate latest directional ReferenceThread outcomes for replied member pairs.
- [x] 1.3 Return message-interaction statistics and cover success, empty, duplicate, and error cases with server tests.
- [x] 1.4 Cache successful public statistics responses for one hour and cover cache hits and errors.

## 2. Statistics presentation

- [x] 2.1 Combine connection counts and recommendation rates into one wide card.
- [x] 2.2 Add a wide replied-message-thread card with positive feedback rates.
- [x] 2.3 Cover the combined cards, percentage denominators, and fallback values with client tests.

## 3. End-to-end verification

- [x] 3.1 Seed deterministic replied-message statistics and assert both cards through the public page and API.
- [x] 3.2 Run formatting, lint, OpenSpec, coverage, and relevant test checks.
