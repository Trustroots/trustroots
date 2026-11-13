## Why

The public statistics page embeds Grafana images that can fail independently of the Trustroots site. MongoDB already holds the records needed to show signup and messaging trends and current member activity.

## What Changes

- Replace the Grafana panels with weekly signup and messaging charts and a current member activity breakdown.
- Serve cached aggregate counts from a dedicated public statistics endpoint.
- Remove the public Grafana promo link. Discuss historical imports and the future of Grafana and InfluxDB in issue #3611.

## Capabilities

### Modified Capabilities

- `public-access` adds MongoDB-backed charts to public statistics.

## Impact

Statistics API, statistics page and tests. The weekly series use retained MongoDB records. No data migration is required.
