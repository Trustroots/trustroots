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
2. Review the stage overview. **Stage 1: Inactive since 2023 or earlier**
   includes only accounts with a recorded login before 1 January 2024 UTC and
   no protected activity. **Stage 2: No recorded login** contains eligible
   accounts without a recorded login. **Stage 3: Recent login — needs review**
   contains eligible accounts with a login on or after the cutoff. Missing login
   dates do not prove inactivity. The first non-empty eligible stage is selected
   after scanning, with no accounts selected. Protected accounts are retained.
   Choose **All eligible accounts (manual review)** only when you intend to
   review all three eligible stages together.
3. Review the account pages for the chosen stage. Rows from every stage remain
   visible, and only rows in the chosen stage can be selected. Click any of the
   six column headings to sort the entire preview; click again to reverse the
   direction. Sorting and pagination retain selections and exclusions.
   Choose **Select all accounts in this stage** to select that stage, then untick any individual accounts you
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
unbounded response. Chunks contain account IDs and the displayed review metadata
for sorting, and expire automatically. Existing previews must be regenerated
after this update.
The inactive stage cutoff is checked again immediately before deletion, along
with all other eligibility and protected-activity rules. The no-recorded-login
stage also rechecks that the login remains unrecorded immediately before deletion;
any newly recorded login, including one before the cutoff, causes that account
to be skipped.

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
