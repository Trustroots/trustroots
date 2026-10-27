# Support mail across environments

The site UI and mail delivery are configured independently. All mail is captured
and support IMAP access is disabled unless the deployment explicitly configures
another mode. This policy is applied after local configuration, so copying SMTP
credentials into a staging deployment does not by itself enable delivery.

| Deployment                    | Required settings                                                                                                              | Behaviour                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Production                    | `NODE_ENV=production`, `TRUSTROOTS_DEPLOYMENT_TIER=production`, and site domain `trustroots.org` or `www.trustroots.org`       | Live SMTP is permitted; inbox and IMAP still require their own enable flags.                                                                 |
| Staging / local / tests       | Default `TRUSTROOTS_MAIL_MODE=capture`                                                                                         | All SMTP, including legacy support forwarding, is captured. IMAP is disabled and mailbox credentials are removed from runtime configuration. |
| Controlled staging email test | `TRUSTROOTS_MAIL_MODE=allowlist`, `TRUSTROOTS_SUPPORT_TEST_MAILBOX`, and comma-separated `TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST` | Only the dedicated test sender and explicitly listed SMTP envelope recipients are permitted.                                                 |

`TRUSTROOTS_MAIL_MODE=live` is rejected outside the explicit production tier and
production site domain. Use `capture` to disable delivery even on production.
Do not interpret SMTP capture success on a test deployment as delivery to an
external mailbox.

## Test mailbox setup

Use a separate Zoho account for the test mailbox, with its own credentials. When
IMAP is enabled in allowlist mode, its configured username must equal the test
mailbox address. Do not use an alias or a different folder inside the production
support account. The test mailbox must differ from the production support address.

The test mailbox replaces the runtime support address, support sender and default
mail sender. Provide SMTP credentials authorised to send from that test address.
The recipient policy checks the final SMTP envelope, including Bcc and explicit
envelope overrides, and rejects the entire message if any recipient is unlisted.
List the test mailbox too if testing legacy support forwarding into it.

Keep production and staging databases, Agenda queues and deployment secrets
separate. Do not restore real support data or pending production email jobs into
staging. Use fictional requests and reduced fictional status manifests there.
Never commit mailbox credentials, exports or generated import files.

## Cutover

Configure a real Zoho mailbox, rather than a forwarding-only address, and enable
IMAP access in its account settings. Use the IMAP hostname shown for that account
and region, port 993 and verified TLS. Keep the mailbox username and password
(an application password when required by the account's authentication policy)
in deployment secrets, alongside the existing SMTP credentials. See
[Zoho's IMAP setup instructions](https://www.zoho.com/mail/help/imap-access.html).
The worker reads mail without marking it read, moving it or deleting it.

Polling defaults to once per minute. Messages larger than 25 MiB are recorded as
notices without downloading their content. For messages within that limit, the
stored plain text is capped at 12 MiB so the database document remains within
MongoDB's size limit. Any omission is labelled in the inbox; the complete email
and its files remain available in Zoho.

Set `supportInbox.enabled` to enable shared replies and website acknowledgements;
set `supportInbox.imap.enabled` separately to enable incoming mail. Website
submissions are stored before acknowledgement and are no longer forwarded into
the monitored support mailbox when the inbox is enabled. The worker process must
be running for queued replies and mailbox polling.

1. Test receipt, staff reply and requester reply using only the dedicated test
   mailbox and approved test recipients.
2. Confirm production's explicit deployment tier, domain, SMTP credentials, mailbox
   credentials and feature flags before enabling the production mailbox worker.
3. Verify production routing and the handling of replies to historical Zendesk
   addresses before retiring Zendesk forwarding.
4. Apply the reviewed real status manifest only in production. Keep the complete
   historical archive in the ignored private backup directory.

The first successful mailbox poll records the current end of the mailbox and
does not import existing mail. Initialise and verify that checkpoint before
switching incoming routing, then test a fresh message. Review mail received
during the transition in Zoho. Existing historical Zendesk reply addresses must
continue routing to a monitored destination; an old Zendesk Message-ID alone
does not establish a trusted link to a local request, so unmatched replies appear
as separate requests for review.
