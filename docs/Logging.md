# Application logging

The application logger keeps the existing Winston call shape:

```js
log('error', 'Stable event description.', { reason: 'provider unavailable' });
```

The event level and string description pass through unchanged. Object metadata is
copied before it reaches a transport. Fields whose keys identify credentials,
recovery tokens, cookies, authorization values, message/body/content payloads,
or security reports are replaced with `[REDACTED]`. Circular references,
excessive nesting, and metadata with more than 1,000 visited entries receive
bounded placeholder values. Accessors are not evaluated. Error objects keep recognised standard
error names, short machine-style codes and numeric status classifications; their
message and stack are omitted because they may contain request or database
values.

Keep event descriptions stable and do not put request data in them. Key-based
redaction cannot identify secrets embedded in arbitrary free-text strings or
under unrecognised metadata keys. Prefer structured metadata with meaningful
field names and avoid logging private values in the first place. The
[security maintenance runbook](operations/security-maintenance.md) covers
diagnostic access, retention, secret rotation ownership, and backup restore
drills.
