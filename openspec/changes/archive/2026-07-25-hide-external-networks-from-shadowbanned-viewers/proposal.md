## Why

Shadowbanned members can still browse ordinary public profiles and use external
network links to contact members outside Trustroots, bypassing the platform's
hidden interaction controls.

## What Changes

- Remove external social, hospitality-network, and Nostr identifiers from
  another member's profile when the authenticated viewer is shadowbanned.
- Remove detected URLs, email addresses, and phone numbers from other members'
  profile and offer descriptions for shadowbanned viewers.
- Keep those identifiers available when members view their own profile.
- Leave ordinary and administrative profile viewing unchanged.

## Impact

- Affects sanitised user-profile and offer responses and the rendered profile
  Elsewhere section.
- Does not alter stored profile data.
