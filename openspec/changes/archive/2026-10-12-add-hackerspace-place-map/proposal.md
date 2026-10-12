# Add a Nostr hackerspace map

## Summary

Import geolocated spaces from the SpaceAPI Collector, publish them as addressable NIP-41 place events, and display them on the public Hackers circle page. Administrators review and approve imports through their browser Nostr signer.

## Motivation

The Hackers circle can connect members around a shared interest, while a public place map makes physical hackerspaces discoverable without requiring membership or location access. Using the open NIP-41 Places draft makes the records consumable by other place-aware Nostr clients.

## Scope

- Add an administrator-only SpaceAPI import preview and signer-mediated publication workflow.
- Publish addressable kind `33000` events using the current NIP-41 draft shape, geohash ladders and optional Plus Code metadata.
- Make the hackerspace map a prominent, above-the-fold feature on `/circles/hackers`, with source and verification disclosures.
- Present circle contacts, recommenders and other active members using the same information-rich member cards as member search.
- Keep SpaceAPI endpoint data explicitly marked as source-reported and not human-verified.

## Compatibility and rollout

This introduces no database migration. NIP-41 remains a draft, so isolate event construction behind a tested adapter that can follow proposal changes. The page must tolerate relay unavailability and malformed or unsupported events. Existing circle membership remains available, with its profile cards upgraded to match member search.

## Risks

- SpaceAPI validity checks do not verify physical location accuracy or guarantee current opening status.
- Kind `33000` support varies across Nostr clients while NIP-41 remains a draft.
- Publishing precise place coordinates makes those coordinates public and durable on relays.
