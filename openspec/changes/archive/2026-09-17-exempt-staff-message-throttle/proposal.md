# Exempt welcome team and admins from the message recipient limit

## Why

Welcome-team outreach and administrator duties require messaging more members than the ordinary hourly recipient limit permits.

## What Changes

- Exempt authenticated members with `welcome-team` or `admin` roles from the distinct-recipient throttle.
- Preserve all other message validation and moderation rules and the existing limit for everyone else.

## Impact

Affects the messages server controller and messaging tests. No schema migration or client change is required. The server must be deployed for the exemption to take effect.
