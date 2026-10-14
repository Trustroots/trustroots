# Email confirmation link rollout

New signup, resend, reminder and email-change links expire 24 hours after
issuance. Each issued link replaces the previous link for that pending address.

Links issued before expiry metadata existed remain valid until 1 November 2026
at 00:00 UTC. That cut-off is fixed in the application, so there is no
deployment setting to configure. From that instant, a link without expiry
metadata is rejected. The member can sign in and request a new confirmation
email.

Newly issued links carry expiry metadata and continue to work after the
cut-off.
