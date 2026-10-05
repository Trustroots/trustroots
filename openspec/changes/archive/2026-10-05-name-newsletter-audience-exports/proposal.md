## Why

Targeted newsletter downloads all use `newsletter-audience.csv`, making it difficult to distinguish audiences and export times.

## What Changes

- Name audience CSV downloads with their selected location, hosting radius, selected sources when narrowed, and selected circle names.
- Append the local export time as `yyyymmdd-hhmm`, with filename-safe filter text.
- Use `newsletter-audience-Berlin-50km-yyyymmdd-hhmm.csv` for the initial audience.

## Capabilities

### Modified Capabilities

- `admin-moderation`: Descriptive, dated filenames for targeted newsletter exports.

## Impact

Changes the client-generated audience download filename and adds unit and browser regressions. CSV contents and other newsletter downloads retain their current behaviour.
