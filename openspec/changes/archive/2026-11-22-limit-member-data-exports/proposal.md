## Why

Preparing a member data export assembles profile information and several complete collections. An hourly allowance supports normal downloads and retries while bounding repeated export generation for each member.

## What Changes

- Give authenticated members an hourly export allowance that follows their account across browsers and networks.
- Return HTTP 429 with `Retry-After` when the allowance is exhausted, before generating another file.

## Impact

- Updates the `account-access` spec and the data export route.
- Reuses the existing request allowance store and configuration.
