## Why

Members can submit support requests from a browser or through the mobile API.
They should have the same support allowance whichever client they use.

## What Changes

- Apply the existing support request policy after mobile authentication and
  before saving a support request or sending email.
- Share the existing client-address and member counters across browser and
  mobile requests, including HTTP 429 and Retry-After on rejection.

## Capabilities

### Modified Capabilities

- `public-access`: Include the mobile support endpoint in the shared allowance.

## Impact

The mobile module uses the existing core request-limit middleware for support.
The support policy, database counters and expiry index are already deployed.
There is no data migration or configuration change.
