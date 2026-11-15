## Context

Circle discovery places several groups in columns on desktop. A second fixed split inside each group can leave the text a very narrow strip beside the avatar. Other discovery, contact, offer and conversation screens compose the same identity fields independently.

## Goals

Make member identities recognisable across the three clients. Preserve enough width for names and handles, including in a desktop grid and at larger text sizes.

## Decisions

- Use a fixed-size avatar next to a flexible text column. Show the display name first, then the handle. Use the handle as the primary line when it is the sole name and a generic member label when both fields are absent.
- Use existing photo loaders and their initials fallbacks. Apply the existing navigation action to the identity or its containing row. Offer and conversation actions retain their own controls.
- Place long card metadata below the identity at full width. Use tracks sized to the actual space available within each circle group.
- Reuse one identity component per client. Metadata such as location, activity or hosting stays with the owning screen.

## Risks / Trade-offs

Long content, browser zoom and large text can squeeze a nested grid. Check card dimensions in a constrained desktop column and let rows wrap. Keep links governed by the data and permissions each screen already receives.
