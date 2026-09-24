# Disable external links in message bodies

## Why

Member messages can contain clickable links to external sites, including links to scam sites. Existing stored messages remain clickable unless the display path handles them.

## What changes

- Show external links in message bodies as text while retaining their visible labels and formatting.
- Keep links to pages on the current Trustroots origin clickable.
- Apply the rule when displaying existing and new messages.

## Impact

The change affects message-body rendering in the React conversation view. It does not change stored message content or links elsewhere in the site.
