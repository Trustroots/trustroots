## Why

The three separate Experience cards fragment closely related information,
while the statistics page does not summarise replied message interactions and
their feedback. Two wider summaries make the meaningful community outcomes
clearer and reduce visual noise.

## What Changes

- Combine the Experience metrics into one half-width “Real-life connections”
  card with all-time and preceding-90-day connection counts and recommendation
  rates.
- Add a half-width “Message interactions” card showing conversations whose
  first message received a reply, all-time and during the preceding 90 days.
- Show the positive rate of the latest Yes/No message feedback associated with
  replied member pairs, for all time and the preceding 90 days.
- Cache the anonymous public statistics response for one hour in the
  application process and in shared HTTP caches.
- Keep Grafana dashboards, queries, images, and links unchanged.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `experiences-references`: add aggregate replied-message-thread and positive
  message-feedback statistics.
- `public-access`: present connection and message-interaction statistics as two
  wider cards.

## Impact

- `modules/statistics` API aggregation and page presentation.
- `modules/messages` MessageStat data and `modules/references-thread` feedback
  are read only in anonymous aggregate form.
- Statistics server, client, and end-to-end tests and deterministic seed data.
- No migration, dependency, or Grafana change is required.
