# Disable links in user-written content

## Why

User-written content should display link labels and formatting without providing clickable destinations. Dedicated profile network fields have a separate, explicit role.

## What changes

- Unwrap links when displaying user-written content across the web application, including existing messages, previews, descriptions and administrative views.
- Remove the shared editor's link tool and link preview, retaining pasted HTML and stored content.
- Keep dedicated profile network links clickable except Couchsurfing, which becomes plain text.

## Impact

Client presentation changes only; APIs, storage, email templates and exports remain unchanged. Application navigation stays clickable. The existing shared RichText component applies a single display policy without new module dependencies.
