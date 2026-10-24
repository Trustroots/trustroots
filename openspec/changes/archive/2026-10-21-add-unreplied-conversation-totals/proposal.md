## Why

Members need to find initial messages they have never answered and see how many
conversations each inbox view contains.

## What Changes

- Add an Unreplied inbox view for incoming conversations never answered by the member.
- Show total conversation counts for All, Unread and Unreplied, independently of search and pagination.
- Extend the message count endpoint with an opt-in response containing all three totals.

## Impact

- Affects the messages module and its inbox UI, API and tests.
- Existing count API consumers retain their current response. No migration or dependency changes are required.
