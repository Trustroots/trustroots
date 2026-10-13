# Remove Facebook avatars

## Why

Facebook account linking has been retired. Legacy profile images still depend
on unauthenticated Graph API requests which can return a generic silhouette.
Retiring this image source removes the remaining Graph API dependency.

## What Changes

- Remove Facebook avatar URL generation on the client and server.
- Display the standard placeholder for legacy Facebook avatar selections and
  interpret stored selections as `none` when loading member documents.
- Reject Facebook as a new avatar selection. Keep uploaded photos, Gravatar
  and the explicit no-photo option.
- Stop including Facebook IDs in mini profiles solely for avatar rendering.
- Update the FAQ and privacy text and remove the Facebook avatar CSS fallback.

## Compatibility and Deployment

No database migration is required: stored Facebook selections are interpreted
as `none` on read. Members can save unrelated profile changes and choose a new
photo. Legacy social connection data remains available for disconnection.
Existing uploaded images and Gravatar selections are unchanged. Deploy the
client and server together. No production data is modified by this change.

## Affected Modules

`modules/users`, `modules/pages`, avatar styles, English translations and
account settings end-to-end tests.
