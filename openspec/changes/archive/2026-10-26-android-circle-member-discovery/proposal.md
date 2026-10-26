# Android circle member discovery

## Why

Android circle details currently show circle information and membership actions
but do not help members find people in the circle. The web circle page already
uses the authenticated member-discovery API to show contacts, recommenders and
other active members.

## What changes

Add the same bounded member groups to native Android circle details using the
existing `/api/tribes/:slug/members` route. Present each result as a native
profile link, keep group failures separate from an empty result, and allow the
member to retry. The server API, its privacy rules and membership behaviour do
not change.

## Impact

This changes the native Android circle detail experience and its API client
models. It adds no data migration, endpoint, module dependency or deployment
step. Visitors and members who have not joined a circle continue to receive the
existing API response; Android only requests the groups for a signed-in member
who has joined the circle.
