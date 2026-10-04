# Improve the acquisition-stories welcome list

## Why

Welcomers need to identify members who have already received a welcome message
and prioritise members with whom they share a language.

## What Changes

- Add Welcomer and Languages columns to the acquisition-stories list.
- Derive the welcomer from the first visible incoming message from a current
  welcome-team member, and subtly fade contacted rows.
- Put languages shared with the viewer first and emphasise them except English.

## Impact

The admin API gains language codes and optional first-contact metadata. Existing
permissions and messaging flows remain unchanged. No data migration is needed;
historical messages count and current role membership determines eligibility.
