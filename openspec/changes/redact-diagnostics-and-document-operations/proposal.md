# Redact sensitive diagnostic metadata

## Why

The general logger currently exports winston.log directly, so each caller is responsible for excluding credentials and private payloads. Central bounded redaction can reduce accidental exposure while keeping useful event names and non-sensitive diagnostics. Production secret rotation and backup restoration are operational tasks and will not be executed by this PR.

## What Changes

- Redact credential and private-payload fields from structured diagnostic metadata before transport.
- Keep non-sensitive event names, counts and error classifications useful; bound traversal and avoid mutating caller data.
- Review errors, analytics and administrative exports for confirmed additional exposure.
- Document secret-rotation ownership, backup access and a safe restore-drill procedure without claiming production verification.

## Status

Draft implementation proposal. Runtime changes and validation remain in progress; this PR is not ready to merge.
