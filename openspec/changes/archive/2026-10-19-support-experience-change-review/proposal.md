# Support team Experience change review

## Why

Support members need to handle Experience changes while keeping approval independent from issuing the member link.

## What Changes

- Allow support-team access to the page, navigation and Experience change APIs.
- Record the link issuer on each submitted request, preserving attribution after replacement or expiry.
- Deny approval by that support member; allow another support member or any administrator.
- Require administrator approval for older requests without issuer attribution.
- Keep rejection available and explain unavailable approval in the queue.

## Impact

Affects admin and experiences policies, request storage, queue UI and regression tests. Existing requests remain readable without migration.
