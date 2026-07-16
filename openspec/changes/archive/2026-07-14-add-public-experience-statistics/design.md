## Context

The statistics page already fetches a small, public aggregate response from
`/api/statistics`. Experiences are stored separately and can be private;
statistics must not reveal the number, content, or recommendation of private
experiences. The page also embeds a Grafana-rendered message chart, which is
outside this change's control.

## Goals / Non-Goals

**Goals:**

- Return aggregate counts for public experiences, answered recommendations,
  and real-life meetings for all time and the preceding 90 days.
- Present those figures in the existing statistics page.
- Make the local text around the Grafana message embed clear without changing
  Grafana itself.

**Non-Goals:**

- Editing Grafana dashboards, queries, images, or links.
- Exposing individual experience text, member identities, or private records.
- Creating historical trend data or changing the experience publication flow.

## Decisions

- Aggregate `Experience` documents with `public: true` in the statistics
  controller. This preserves the existing single public API and avoids a new
  endpoint; private experience existence remains undisclosed.
- Count `recommend: 'yes'` as a recommendation and `recommend: 'no'` as a
  non-recommendation. Exclude `unknown` from the recommendation percentage
  because it represents the form's “Skip” response, not a negative answer.
- Return a stable `experiences` object with all-time and recent totals,
  recommendation and non-recommendation counts, plus a
  `realLifeConnections` object for all-time and recent meeting counts. The
  client derives recommendation percentages from answered recommendations,
  matching its existing hosting and newsletter pattern.
- Treat `interactions.met: true` as a real-life connection. Group the two
  possible experience directions into one unordered member pair before
  counting, so a two-sided experience does not inflate the connection count.
  It directly represents the “Met in person” answer and is clearer as a
  headline statistic than combining the two hosting-direction answers.
- Replace the ambiguous message-panel heading with neutral wording and a local
  explanation. The embedded chart remains exactly the same.

## Risks / Trade-offs

- [Aggregate query adds work to a public request] → Use a single aggregation
  over an existing `public` field and keep the response limited to four
  counts.
- [A recommendation percentage can be misread as sentiment] → Label it as a
  recommendation and explain that it represents a Yes answer to the
  recommendation question; skipped answers are excluded.
- [Recent count boundary varies during a request] → Calculate the 90-day
  threshold once per request and use it for the aggregate.

## Migration Plan

No data migration or deployment configuration is needed. The expanded API is
backwards compatible; clients that do not consume `experiences` continue to
work. Rollback consists of deploying the prior application version.

## Open Questions

None.
