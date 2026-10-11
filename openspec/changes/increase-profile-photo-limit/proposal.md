## Why

Members only discover the photo upload size limit after selecting a file. Larger
camera photos can exceed the current 10 MiB default despite being suitable for
the existing thumbnail pipeline.

## What Changes

- Show the configured size limit, supported formats and automatic resizing beside
  the upload button before a file is selected.
- Accept profile photos up to 20 MiB by default, with a separate configurable
  avatar limit, keeping other upload limits unchanged.
- Allow multipart overhead in both bundled Nginx configurations (21 MiB).
- Reuse existing server resizing, original-file cleanup and processing bounds.

## Impact

Affected areas: profile photo UI, settings bootstrap, upload middleware, default
and test configuration, Nginx, and profile tests. No data migration is required.
Deployments must apply the updated Nginx configuration alongside the application;
custom proxies must allow the configured photo size plus multipart overhead.
