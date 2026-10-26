## Context

The existing authenticated member-profile response already includes `seen`, `replyRate` and `replyTime`. iOS decodes and displays these fields. Android's `MemberProfile` currently drops them during parsing, so both the full profile and map host result card lack the information.

## Decisions

- Add nullable fields to the Android `MemberProfile` data class. Parse `seen` as an epoch-millisecond instant only when the JSON value is a valid ISO-8601 timestamp; keep invalid or absent values null. Preserve reply strings as optional text, treating blank strings as absent.
- Keep these values in the shared profile model so profile saves, host detail state and retained snapshots carry them naturally.
- Add a resource-backed Activity section to the profile About content. Use Android `DateUtils` for relative last-active text, clamp the reference interval so future timestamps do not produce negative durations, and omit the last-active row for invalid timestamps. Show reply rate only when present and reply time only when present.
- Add a compact summary to `HostResultCard`, displaying the last-active fact and reply rate when available. Keep it absent when both values are unavailable and retain the card's existing scroll and height behaviour.
- Use locale-aware Android string resources for labels and fallbacks. Do not use a fallback value that suggests the member has never been active or has a 0% reply rate.

## Testing

- Extend API parser/endpoint unit coverage for valid, missing, blank and malformed fields.
- Add Android UI journey coverage for populated and missing activity statistics on the full profile and host card. Device tests will be run only when a shared emulator is allocated.

## Risks

Relative date text varies by locale and current time. Tests should assert stable labelled values and use timestamps safely in the past rather than hard-code relative words. Host result cards are space-constrained, so only the two compact facts are shown there.
