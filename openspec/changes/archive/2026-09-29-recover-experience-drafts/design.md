## Decisions

Persist public feedback, interaction choices and recommendation synchronously
after changes, under a versioned key containing both member IDs. Expire drafts
after seven days and offer explicit restore/discard. Do not persist private report
text. Storage denial must leave the form usable and explain that recovery is
unavailable. Clear drafts only after confirmed saving or explicit discard.

After a network failure, server error or conflict, read the author's experience
back once. Confirm success only for the current author, preserving existing
duplicate semantics. Definitive validation failures remain editable errors.
Display saving confirmation before awaiting any private report request.

Expose the existing server feedback limit through application settings. Keep
oversized text editable instead of truncating it. Count JavaScript string length
as the server does; server sanitisation and validation remain authoritative.

## Risks

Local drafts are available to someone with access to that browser profile. They
are scoped to the signed-in member but not encrypted. Private report text is
excluded. A device crash before a storage write or denied storage can still lose
text. Local drafts are not a server backup and do not recover earlier losses.
