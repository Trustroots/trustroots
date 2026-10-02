## Why

Visitors cannot narrow the questions on a FAQ page, and members are not told
the username change rules where they can change their username.

## What Changes

- Add a text filter to each FAQ category page that matches question and answer
  text, reports an empty result, and restores questions when cleared.
- Explain existing username format, availability, and timing rules beside the
  username field in account settings.

## Capabilities

### Modified Capabilities

- `public-access`: Visitors can filter questions within the open FAQ category.
- `account-access`: Members can read the rules for changing their username in
  account settings.

## Impact

The FAQ and account settings client components and their tests change. There is
no API or validation change, data migration, or special deployment step.
