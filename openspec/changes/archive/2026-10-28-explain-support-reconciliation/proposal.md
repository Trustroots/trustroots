# Explain historical support reconciliation

## Why

Missing historical statuses currently appear as Open, and exact correspondence fingerprints cannot explain formatting differences or offer reviewable alternatives.

## What Changes

- Distinguish unconfirmed legacy statuses from confirmed Open in counts and filters without inventing a terminal status.
- Extend local manifest preparation with reduced matching evidence: original sender hash, original category, submission timestamp and a conservatively normalised message fingerprint. Do not upload correspondence or addresses.
- Explain exact and suggested matches in an administrator preview. Suggest only same original sender/category, nearby submission time and equivalent message after formatting cleanup; expose competing candidates and require explicit selection for suggestions.
- Preserve one-to-one matching, permissions, snapshot guards, newer activity checks, idempotency and email-free apply. Unmatched requests remain unchanged.

## Impact

Support import preparation, support queue and administrator interfaces, tests and support documentation. Private exports remain local and ignored.
