# IP address identifiers

The application uses a request's validated client address transiently. User records store `lastIpHash`, a domain-separated HMAC-SHA-256 equality identifier. Equivalent IPv6 forms and IPv4-mapped IPv6 are canonicalised before hashing. Admin matching uses this identifier and does not display addresses. Audit entries use `ipHash` for the acting staff member; IP search fields are omitted from recorded payloads.

## Deployment

1. Generate a dedicated random key with `openssl rand -hex 32`. Supply it as `TRUSTROOTS_IP_HASH_SECRET` through deployment secret management, or as `ipHashSecret` in deployment-owned configuration. Do not reuse session keys or commit it. Keep the same key across workers and restarts. Missing keys disable new identifier collection; configured keys shorter than 32 bytes are rejected when used.
2. Stop old application workers before migration so they cannot write raw addresses again. Deploy the new version with the key configured.
3. Run `node bin/db-maintenance/pseudonymise-ip-addresses.mts` for a dry run. It reports counts only. Run the same command with `--apply`, then repeat the dry run to confirm no legacy records remain. Use the normal deployment environment and database configuration. Invalid legacy addresses are removed without generating an identifier. Existing identifiers are preserved. Concurrently modified records are skipped and reported; rerun after writes have stopped.
4. Resume workers and verify that the admin “Find accounts using the same IP” action works. Existing raw-IP bookmarks and the old admin matching endpoint are replaced by identifier-based links and `/api/admin/users/by-last-ip-hash`.
5. Review reverse proxy, CDN, application diagnostic and external service logs independently. Purge or expire historical backups according to the agreed retention policy. The MongoDB migration cannot remove copies in logs, replicas' history or backups.

The migration removes raw `lastIpAddress` fields from users, and raw staff `ip` and legacy IP-search fields from audit logs. It does not reconstruct staff address identifiers from historical logs. It leaves existing user identifiers unchanged and does not retain an address history. The obsolete `lastIpAddress_1` index can be dropped separately after migration, if present.

## Key rotation and retention

These identifiers remain linkable data. Protect the key separately from MongoDB. Key rotation changes all identifiers: stop workers, clear `users.lastIpHash` and `auditlogs.ipHash`, configure the new key on every worker, and resume. New authenticated activity repopulates user identifiers; old addresses cannot be recovered from the old hashes to migrate them. Coordinate rotation with any pending migration.

This change does not define a retention period. Establishing one needs a separate product decision covering inactive accounts, audit records, logs and backups.

## Location lookup

The raw client address remains accessible during a request for a local location database lookup. The map-default-location endpoint passes the validated request address directly to the local MaxMind reader and does not use a stored address. That flow remains unchanged. Stored member locations are unchanged.
