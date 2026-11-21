# Remind recipients about pending Experiences

## Why

The first notification tells members that they can share their own account
before automatic publication. A single reminder at day 11 gives recipients
time to respond while the Experience is still private. This is part of #3750.

## What changes

- Queue one reminder per eligible Experience starting 11 days after creation
  and ending at its existing publication deadline.
- Recheck publication, removal and reciprocal Experience state in the
  delivery job. Skip unavailable or restricted members and blocked pairs.
- Use the existing mail delivery path and include a link to share, with no
  pending feedback in the email.
