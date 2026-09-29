# Redact sensitive diagnostic metadata

## Why

The general logger currently exports winston.log directly, so each caller is responsible for excluding credentials and private payloads. Central bounded redaction can reduce accidental exposure while keeping useful event names and non-sensitive diagnostics. Production secret rotation and backup restoration are operational tasks and will not be executed by this PR.

## What Changes

- Redact credential and private-payload fields from structured diagnostic metadata before transport.
- Keep stable event descriptions, non-sensitive event names, counts and safe error classifications useful; bound traversal and avoid mutating caller data.
- Omit arbitrary Error messages and stacks, which can contain request or database values.
- Replace raw analytics URL and UTM values in validation-failure logs with presence flags.
- Review errors and administrative exports for confirmed additional exposure; no export log path requires changes.
- Document secret-rotation ownership, backup access and a safe restore-drill procedure without claiming production verification.

## Status

Implementation in progress. Redaction covers structured metadata keys; arbitrary free-text strings are deliberately not scanned, so callers must keep event descriptions stable and avoid embedding request data. The pure logger-boundary suite is appropriate here instead of a browser end-to-end test because the change only affects server logging transports.
