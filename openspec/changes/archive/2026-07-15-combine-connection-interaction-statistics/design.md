## Context

Experience statistics currently occupy three independent cards. Replied
message interactions are recorded by `MessageStat.firstReplyCreated`, while
message feedback is stored separately as directional Yes/No ReferenceThread
records. ReferenceThread history can contain repeated submissions, so raw
document counts would inflate feedback rates.

## Goals / Non-Goals

**Goals:**

- Present real-life connections and their recommendation rate in one wide card.
- Count only message conversations where the first message received a reply.
- Calculate feedback rates from the latest directional response for replied
  member pairs.
- Show all-time and preceding-90-day figures consistently.

**Non-Goals:**

- Editing Grafana.
- Exposing individual messages, feedback, Experiences, or member identities.
- Treating an unanswered first message as a message interaction.

## Decisions

- Count replied threads from MessageStat documents with a non-null
  `firstReplyCreated`. Use that timestamp for the preceding-90-day boundary.
- Select the latest ReferenceThread per directional member pair, matching the
  feedback currently shown by the application, then
  include its Yes/No outcome only if the member pair has a replied MessageStat.
  Unrated replied threads remain in the thread count but not the feedback-rate
  denominator.
- Keep real-life connections deduplicated as unordered member pairs. Derive
  recommendation rates from Yes and No Experience recommendations, excluding
  skipped answers.
- Use the existing two-column `is-graph` span for both summary cards so they sit
  side by side at approximately half width on wide layouts and stack on narrow
  layouts.
- Cache a successfully assembled public statistics response in each application
  process for one hour and advertise the same shared-cache lifetime with
  `Cache-Control`. Errors are not cached.

## Risks / Trade-offs

- [Historical MessageStat gaps undercount replied threads] → Describe the count
  as a lower bound and use the existing backfill-compatible MessageStat source.
- [Latest feedback differs from historical event counts] → Latest feedback
  matches what the application currently returns for a member pair and avoids
  duplicate submissions inflating the rate.
- [Aggregate joins add public-request work] → Return only grouped counts and
  use the existing indexed member-pair fields, with a one-hour response
  cache preventing repeated work on ordinary page loads.

## Migration Plan

No migration is required. Deployment expands the statistics response and
changes only the statistics-page presentation. Rollback restores the previous
cards and response shape.
