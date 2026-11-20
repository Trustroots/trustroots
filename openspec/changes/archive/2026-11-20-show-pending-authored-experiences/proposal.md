# Show pending Experiences on the author's profile

## Why

Members can see an Experience they wrote on the recipient's profile, but
their own Experiences page only lists what others shared. Authors need a
single place to see which of their Experiences are still private and the
existing publication countdown. This is part of #3750.

## What changes

- Allow the existing authenticated Experience list to return the signed-in
  member's unpublished, unremoved authored Experiences for their own profile.
- Show those cards on the author's profile with the recipient, authored
  feedback and existing publication countdown.
- Keep these records outside incoming Experiences and public summary counts.
