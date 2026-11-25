# Edit hosting and meeting availability on mobile

## Why

Members use the web hosting editor to set their hosting and ongoing meeting
availability together, including whether they welcome guests who can
volunteer. Android’s existing editor cannot change the meeting or volunteering
fields, and iOS does not provide a native hosting editor.

## What changes

- Extend Android’s existing hosting editor with the web meeting options and
  volunteering toggle.
- Add a signed-in iOS editor for the member’s own hosting offer, using the
  versioned mobile offer endpoints and the existing iOS session.
- Preserve saved coordinates, descriptions and offer identity across edits.
- Require a member-chosen location for a new host offer on both platforms.
- Keep a meeting-only offer possible when hosting is set to No.

The change reuses the existing host offer contract. Dated meetups remain a
separate flow.
