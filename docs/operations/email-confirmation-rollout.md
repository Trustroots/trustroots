# Email confirmation link rollout

New signup, resend, reminder and email-change links expire 24 hours after
issuance. Each issued link replaces the previous link for that pending address.

Before deploying this behaviour, configure
`TRUSTROOTS_EMAIL_CONFIRMATION_LEGACY_DEADLINE` on every application instance
with the same absolute ISO-8601 timestamp, set to seven days after rollout.
Existing links without expiry metadata remain valid until that timestamp. The
deadline is read from deployment configuration so restarts and multiple
instances use the same transition boundary. If the setting is absent or
invalid, links without expiry metadata are rejected; members can request a new
confirmation email.

After the deadline, remove the setting from deployment configuration. Newly
issued links carry expiry metadata and continue to work without it.
