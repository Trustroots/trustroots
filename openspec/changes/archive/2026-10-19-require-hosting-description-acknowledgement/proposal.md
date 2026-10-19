# Require hosting description acknowledgement

## Why

Hosts can describe requirements that guests miss before making contact (#3259).
An optional acknowledgement makes that description harder to overlook without
claiming to prove that a guest understood it.

## What Changes

- Add a hosting offer preference, off by default, requiring acknowledgement.
- In new conversations, display the hosting description above the composer and
  an initially unchecked “I have read this host’s hosting description and requirements.” checkbox.
- Reject first messages without an explicit acknowledgement when required.
- Leave existing conversations and offers without the preference unaffected.

## Affected Modules

Offers stores and exposes the preference; messages reads the recipient's host
offer and enforces it. This adds an intentional messages-to-offers dependency.
Existing documents need no migration: missing preferences mean disabled.
Older clients can continue existing conversations; first contact with an opted-in
host requires a client that sends the acknowledgement.
