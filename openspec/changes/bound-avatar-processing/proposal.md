# Bound avatar processing and publication

## Why

Uploads already enforce a 10 MiB default byte cap and inspect file signatures. Avatar processing creates seven thumbnails directly in the public destination; the controller has no explicit dimension, frame, process-time or decode-resource bounds. This proposal addresses those remaining processing and publication boundaries.

## What Changes

- Preserve existing format checks and byte limits.
- Reject excessive dimensions or animation frames and impose explicit processor time and resource budgets.
- Generate stripped, validated thumbnails in private mode-0700 staging; publish only after the complete set succeeds. Explicitly deny staging URLs before static middleware because filesystem permissions alone do not protect HTTP access by the owning process.
- Publish each completed set in a unique server-generated version directory and switch a server-owned avatar-version pointer only after the directory is complete. Continue serving existing flat avatar paths for members without a version pointer.
- Clean rejected input and staged output and preserve the previous avatar pointer and files on failure. On successful replacement, remove only the exact previous pointer after rereading the member and confirming the new pointer is current. Leave other unreferenced versions for a future offline garbage collector rather than racing another worker's publication.
- Keep the test-only processor fallback behind both test mode and an explicit flag; it exercises publication/rollback logic but does not demonstrate native processor resource enforcement.

## Processing limits

- Keep the current 10 MiB compressed upload cap.
- Reject images with more than one frame, a dimension above 10,000 pixels, or more than 40 megapixels.
- Apply processor memory, map, disk, pixel, and thread limits before reading input. Per-child limits are 192 MiB memory, 256 MiB map, 128 MiB disk, 40 megapixels, one processing thread, and 40 MiB of uncompressed reads for GraphicsMagick. Bound each native command to 15 seconds and each avatar generation to 60 seconds; limit active avatar generations to two per application process and reject excess queue waiters with 503. Reject any generated thumbnail larger than 8 MiB.
- Configure supported limits for GraphicsMagick and ImageMagick explicitly. The ImageMagick wrapper uses its supported `area`/`thread` limit names; GraphicsMagick uses `pixels`/`threads`. Before decoding input, query the selected backend with those limits and fail closed if the configured resource names are unavailable. GraphicsMagick 1.3.42 accepts but does not apply the `file` and `write` resource limits, so they are omitted; generated file size is checked after each thumbnail is written.
- These processor limits are per process. Deployment capacity must account for two simultaneous generations per application worker, the seven sequential thumbnail commands per generation, and the native processor's documented cache behavior. The test fallback must never be presented as proof that native limits are active.

## Status

Implementation is in progress. Test fallback validates publication and rollback logic only; native processor costs require validation against the deployed GraphicsMagick or ImageMagick build.
