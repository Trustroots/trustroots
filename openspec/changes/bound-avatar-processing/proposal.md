# Bound avatar processing and publication

## Why

Uploads already enforce a 10 MiB default byte cap and inspect file signatures. Avatar processing creates seven thumbnails directly in the public destination; the controller has no explicit dimension, frame, process-time or decode-resource bounds. This proposal addresses those remaining processing and publication boundaries.

## What Changes

- Preserve existing format checks and byte limits.
- Reject excessive dimensions or animation frames and impose explicit processor time and resource budgets.
- Generate stripped, validated thumbnails in private staging; publish only after the complete set succeeds.
- Clean rejected input and staged output, preserve the previous avatar on failure, and keep test-only processor fallback separate from production guarantees.

## Status

Draft implementation proposal. Runtime changes and validation remain in progress; this PR is not ready to merge.
