# Historical spam account cleanup

Administrators can open **Admin → Audit → Spam account cleanup** at
`/admin/spam-cleanup`. This uses the same fixed July 2021 and February 2023
campaign criteria as `pnpm cleanup:historical-spam`; it is not a general account
deletion tool. The command remains available and defaults to a dry run.

1. Choose **Preview all accounts**. The page scans the entire matching set in
   internal chunks of 1,000 accounts, reports progress and stores a snapshot of
   the reviewed account IDs. No accounts are changed. Keep the page open until
   scanning completes. Review rows are fetched only after scanning and displayed
   100 at a time.
2. Review the stage overview. **Stage 1: Inactive since 2023 or earlier** is
   selected by default and includes only accounts with a recorded login before
   1 January 2024 UTC and no protected activity, including zero threads.
   Accounts with a later login or no recorded login are in **Stage 2: Needs
   review**; a missing login date is not evidence of inactivity. Protected
   accounts are retained. Choose **All eligible accounts (manual review)** only
   when you intend to review both eligible stages together.
3. Review the account pages for the chosen stage. Choose **Select all accounts
   in this stage** to select that stage, then untick any individual accounts you
   want to retain. Selections persist across pages within the stage.
   **Clear selection** lets you choose individual accounts instead. Changing
   stages resets the selection and deletion confirmation.
4. Check the selected total, tick the permanent-deletion confirmation and choose
   **Delete N selected accounts**. That one confirmation applies the selection
   across every page, reporting cumulative progress. Keep the page open until
   completion. The visible page size does not limit the cleanup size.
5. Preview again to see remaining accounts. Previews belong to the administrator
   who created them and expire after 15 minutes of inactivity.

Both scanning and deletion use bounded internal requests. Reviewed IDs are stored
in separate chunks so large cleanups do not depend on a single document or an
unbounded response. Chunk metadata contains IDs only and expires automatically.
The inactive stage cutoff is checked again immediately before deletion, along
with all other eligibility and protected-activity rules.

Existing protections remain in effect: member activity, messages, contacts,
offers, experiences, references, moderation notes, memberships, blocks, push
registrations and uploaded profile images prevent deletion. Restored accounts
and newly protected activity are checked again before each deletion batch.
Accounts added after the full preview is completed are not included.

A completed preview returns its saved result if the same selection is submitted
again. The selection cannot change after deletion starts. Closing the page stops
further requests. On an interrupted or failed operation, start a fresh preview to
review remaining accounts; an already claimed step cannot run twice. No email is
sent. Audit payloads contain the administrator, action, preview identifier and
counts rather than account details or correspondence.
