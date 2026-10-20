## Context

The Android circle detail currently uses `Html.fromHtml(...).toString()`,
discarding the spans and structure produced by the platform HTML parser. The
website uses `modules/core/client/components/RichText.tsx`, which sanitises
descriptions using `modules/core/shared/rich-text-policy.mts` and removes
anchors while retaining their child text.

## Goals and Non-Goals

**Goals:**

- Match the website's supported formatting in Android circle details.
- Keep the result readable, selectable by accessibility services, and native
  to Compose.
- Ensure markup does not create clickable links or load embedded content.
- Preserve the current filtering behaviour over description text.

**Non-Goals:**

- Change the website or iOS rendering.
- Add ordered-list, image, embedded-content, or arbitrary HTML support.
- Change circle API responses or how descriptions are authored.

## Decisions

### Follow the shared rich-text allowlist

Use `richTextTags` in `modules/core/shared/rich-text-policy.mts` as the
formatting contract: `p`, `br`, `b`, `i`, `em`, `strong`, `u`, `a`, `li`, `ul`,
and `blockquote`. The rendered Android view will preserve paragraphs, line
breaks, unordered-list markers, inline emphasis/underline, and blockquote
structure. Unsupported tags and attributes will not create views, images,
navigation, or other active behaviour.

Compose's HTML-to-text conversion does not retain native list and quote spans,
so the Android converter emits visible `•`/`◦` list markers for nested unordered
lists and a `┃` quote marker before blockquote text. This keeps those structures
visible in native text and ensures discovery filtering searches what members
see.

The lightweight tag scanner recognises tag boundaries outside quoted
attributes, drops comments through their terminator (or to end of input when
unterminated), and treats an unterminated non-comment `<` as visible text. When
blocked content tags are misnested, a closing tag clears that blocked tag and
any malformed nested blocked tags above it; this lets later visible text recover
without displaying content from inside the blocked region. Text search uses the
same rendered text, including decoded entities and platform whitespace for
paragraphs, lists, and line breaks.

### Keep user-written links inert

The web `RichText` component applies `disableUserContentLinks`, which unwraps
anchors and keeps their child nodes. Android will show each link label with any
nested supported formatting but will not expose a clickable destination or
open an external activity.

### Render through Compose without a new dependency

Represent the supported structure with native Compose text and layout. Do not
use a WebView or add a library for this focused presentation change. Keep the
formatting conversion reusable only if another Android screen needs the same
behaviour; this change does not require refactoring other rich-text views.

## Risks and Trade-offs

- Android and browser font metrics differ, so visual parity means preserving
  structure and emphasis rather than matching exact line wrapping.
- Rich descriptions can be long; the existing detail scroll container must
  continue to make the description and membership action reachable.
- API content remains untrusted display data; only supported formatting is
  rendered and link destinations remain inert.

## Migration Plan

No migration is needed. The change is client-only and uses the existing
description field.

## Open Questions

None. Link labels remain visible and non-clickable, matching the web component.
