## API

The administrator catalogue uses `/api/admin/circles` and
`PUT /api/admin/circles/:id`. Multipart requests may include an `image` field.
The existing public `/api/tribes` endpoints remain read-only and public.

## Images

Uploaded images are validated, converted to the canonical `<slug>.jpg`, and
processed into 120x120, 742x496, 906x240, and 1400x900 JPG/WebP variants.
Existing assets follow a slug change.
