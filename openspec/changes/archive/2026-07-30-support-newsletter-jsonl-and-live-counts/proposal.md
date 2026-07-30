# Change: Support newsletter JSON Lines uploads and live audience counts

## Why

Newsletter recipient exports are not always CSV files. Administrators also
receive newline-delimited JSON files and need to see the size of a targeted
audience while configuring its filters, before exporting recipient data.

## What Changes

- Accept `.jsonl` and `.ndjson` recipient uploads alongside CSV uploads.
- Extract recipient emails from JSON strings or objects containing an email
  field and report malformed JSON Lines clearly.
- Return subscribed and excluded recipient downloads in the same format and
  extension as the uploaded file.
- Refresh the eligible-recipient count after a valid audience filter
  configuration changes.
- Keep CSV as the download format for generated audience exports.

## Impact

- Affected spec: `admin-moderation`
- Affected code: admin newsletter upload parsing, audience builder UI, and
  their server, client, and end-to-end tests
