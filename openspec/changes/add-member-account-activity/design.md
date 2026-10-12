# Add a member account activity history

## Event catalogue

Record successful session creation, session revocation, all-session sign-out, password change/reset, completed email change, MFA enable/disable, recovery-code replacement and recovery-code use. Record events once after the corresponding state transition succeeds. Use a stable event identifier for retries rather than creating duplicate entries.

## Data and access

Persist only the owning member ID, event type, timestamp and minimal outcome/context needed for the display. Do not store passwords, bearer/action tokens, TOTP secrets, recovery codes, private messages, exact locations, full IP addresses or raw user-agent strings. An optional device label must be bounded and normalised and is not trusted identity evidence.

Provide an owner-only API with opaque cursor pagination, a maximum page size of 50 and no-store responses. A caller cannot request another member's history. Use a dedicated collection with a TTL index for 90 days, plus a member/timestamp index. Account removal deletes the member's activity. Describe eventual TTL deletion accurately.

## Reliability

A successful credential or session change remains committed if activity recording temporarily fails. Queue or retry event delivery using a bounded mechanism and log only event type and error classification. The UI must distinguish unavailable history from an empty history.

## Interface

Add a recent account activity panel with accessible event descriptions, localised dates and pagination. Identify a newly created session without exposing its cookie or internal session-store ID. Do not display precise inferred geography or build behavioural profiling.

## Validation

Test owner isolation, pagination, event redaction, retention/index configuration, idempotence, account deletion and temporary storage failure. Add an account-settings browser scenario for a credential change appearing in the history.

