## Context

The public statistics API currently aggregates only Experiences whose `public`
field is true. The user has approved including private records in anonymous
totals, provided no individual Experience metadata or content is exposed.

## Goals / Non-Goals

**Goals:**

- Include all Experience records in aggregate totals and pair-deduplicated
  real-life-connection counts.
- Preserve the existing response shape and prevent individual disclosure.

**Non-Goals:**

- Making a private Experience visible on a profile.
- Returning private Experience text, users, timestamps, or visibility status.

## Decisions

- Remove the public-only match from both aggregate pipelines. The output
  remains summed counts only, so a caller cannot determine which individual
  Experience is private.
- Continue to group real-life connections by an unordered member pair across
  all records. A private and public Experience about the same pair still counts
  as one connection.

## Risks / Trade-offs

- [Aggregate totals disclose that private Experiences exist] → This is the
  explicitly approved reporting policy; no per-member, textual, or visibility
  data is exposed.

## Migration Plan

No data migration is needed. New totals take effect at deployment and rollback
restores the previous public-only aggregation.
