## Why

Stale internal URLs and missing fragment targets leave members unable to reach
account removal from the FAQ. Similar links can regress without a CI check.
Searching one FAQ category at a time also makes related answers hard to find.

## What Changes

- Repair stale FAQ and information-page links.
- Restore the account removal fragment, focus its section and explain the
  existing email confirmation and permanent deletion process, with a FAQ link.
- Check literal internal client links against application routes and fragment
  targets in CI, with browser coverage for removal navigation.
- Search across all FAQ categories and label matching answers by category.

## Capabilities

### Modified Capabilities

- `public-access`: Internal navigation links are checked during CI.

## Impact

Client information pages, account settings, tests and CI change. No API change,
data migration or special deployment step is required. The static check covers
literal client links; external availability and data-dependent links are outside
its scope. Browser tests verify actual navigation for the reported regression.
