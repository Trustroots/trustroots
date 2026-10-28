# Historical spam account cleanup

Administrators can open **Admin → Audit → Spam account cleanup** at
`/admin/spam-cleanup`. This uses the same fixed July 2021 and February 2023
campaign criteria as `pnpm cleanup:historical-spam`; it is not a general account
deletion tool. The command remains available and defaults to a dry run.

1. Choose **Preview first batch**. No accounts are changed.
2. Review the linked accounts, creation dates and eligible/protected decisions.
   Each preview covers at most 100 candidates, not the entire database.
3. Tick the permanent-deletion confirmation and choose **Delete N eligible
   accounts** to apply that reviewed batch. Or preview the next batch without
   deleting anything.
4. Preview again to see remaining accounts. Previews expire after 15 minutes,
   belong to the administrator who created them and cannot be applied by another
   administrator.

Existing protections remain in effect: member activity, messages, contacts,
offers, experiences, references, moderation notes, memberships, blocks, push
registrations and uploaded profile images prevent deletion. Restored accounts
and newly protected activity are checked again before deletion.

A completed preview returns its saved result if submitted again. An interrupted
apply is not automatically retried: preview again to check remaining accounts.
An active or interrupted apply cannot be started twice from the same preview.
Audit records contain the administrator, action, preview identifier and counts;
account details are not copied into audit payloads. No email is sent.
