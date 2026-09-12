# Admin circle management

## Why

Circles were previously added by editing MongoDB directly, and circle images
were copied to the server and processed separately.

## What changed

- Added an administrator-only circle management page.
- Added administrator-only APIs for listing, creating, and updating circles.
- Added image upload processing for the existing static JPG/WebP sizes.
- Kept public circle APIs and URLs backwards compatible.

## Compatibility and deployment

Existing `Tribe` documents and image files remain valid. No database migration
is required. New uploads require write access to `config.circleImagesDir`.

## Scope

Deleting circles and deleting an existing image without replacement remain out
of scope.
