# Unify formatted content and request values

## Why

Formatted descriptions, notes and messages currently use several rendering paths. Relationship creation also constructs database records from broader request objects than the fields those operations need. Shared presentation rules and explicit record construction make these contracts easier to maintain.

## What Changes

- Share the supported rich-text tags, attributes and link schemes between server formatting and browser display.
- Add a browser formatted-content component, including message-specific link handling, and apply it to existing display surfaces and externally supplied editor values.
- Keep description excerpts as plain text rather than cutting HTML markup.
- Construct contacts and thread references from their supported fields, leaving identifiers and timestamps to the server.
- Extend HTTP boundary, browser and relationship regression coverage.

## Impact

Affected modules: core, admin, messages, offers, search, tribes, contacts and references-thread. Existing supported formatting and message-link behaviour remain available. No database migration or deployment configuration is required. DOMPurify is added as a browser runtime dependency. Existing CSRF and API input middleware remain the central request boundaries.
