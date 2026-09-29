# Password hash migration operations

New and changed passwords use the versioned scrypt format stored in the
existing `password` field. Existing PBKDF2-HMAC-SHA1 records remain verifiable
during the migration window. A successful legacy login replaces the old hash
with scrypt using a compare-and-set update; it does not change the password
update time or revoke other sessions. A reset or password change still updates
the password update time and authentication version.

The hash version and work parameters are stored with each scrypt hash. Keep the
legacy verifier until monitoring confirms that legacy logins have stopped and
the project has decided how to handle remaining inactive accounts. Do not
remove the legacy path or lower its verification cost as an operational
shortcut. Future format or cost changes should add a verifier for the old
format and upgrade it after a successful login.

The current scrypt settings use 128 MiB per active derivation. Each Node
process admits one derivation at a time and queues at most 16 additional
requests. A full queue returns HTTP 503 so the client can retry; it never falls
back to a cheaper hash. The active-memory requirement is therefore at least
128 MiB per process, plus Node and application overhead. Multiply that amount
by the number of application processes on a host, and measure peak memory,
login latency, and queue rejections under the production process count before
changing concurrency or work parameters. Keep enough memory headroom for the
rest of the application and avoid increasing the process count without
rechecking that budget.

Treat passwords and complete password hashes as sensitive authentication
data. Never include a submitted password, derived key, salt, or stored hash in
application logs, analytics, error responses, support tickets, or monitoring
labels. Authentication failures should remain generic. Overload responses
should reveal only that password verification is temporarily busy.

Deploy compatible readers before any code path begins writing the new format.
Keep the version that reads both formats available for rollback: reverting to
code that only understands PBKDF2 would lock out accounts whose passwords were
created or transparently upgraded after deployment. A rollback plan must
preserve the compatible verifier and the authentication-version checks.

The application security maintainers own the format and cost review. The
service operators own process-count and memory-budget checks, 503-rate
monitoring, and incident response for sustained queue saturation. Review these
settings when changing the Node runtime, deployment process model, or host
memory allocation.
