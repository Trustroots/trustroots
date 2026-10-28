# Improve support match review controls

## Why

Staff need bulk selection for unique suggestions, a reviewable wider submission-time window and useful local requester details instead of opaque request IDs.

## What Changes

- Add Select all unambiguous matches and Clear selection, excluding competing or shared request candidates and exact-match targets.
- Add a 1–60 minute submission-time window, default one minute. Changes invalidate selections and require a fresh server preview; persist the chosen window and enforce it again at apply.
- Show original local requester username/email and subject in authenticated administrator previews. Keep reduced manifests free of addresses and correspondence; do not add personal details to audit logs.

## Impact

Support import API/shared types/preview storage and administrator review interface. Existing manifests and one-minute previews remain supported. Sender/category/message equivalence and existing concurrency, permissions and identity guards remain required.
