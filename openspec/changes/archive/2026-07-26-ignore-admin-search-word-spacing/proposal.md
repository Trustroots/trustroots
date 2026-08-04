# Ignore spacing between admin member-search terms

## Why

Administrators commonly search a username with a readable space between its
words. A search such as `trustroots team` currently requires that exact space
in a stored value and misses matching usernames such as `trustrootsteam1` and
`trustrootsteam2`.

## What Changes

- Treat whitespace between words in an administration member search as
  optional, while preserving the existing case-insensitive matching and regex
  escaping.

## Impact

- Affects the administration member-search API and its route coverage.
- No data migration, deployment configuration, or breaking API change is
  required.
