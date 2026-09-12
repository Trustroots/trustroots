## Context

The production data contains two historic, high-volume automated-signup waves:
4–6 July 2021 and 27–28 February 2023. Their accounts carry the `suspended`
role and are non-public. This change deliberately targets only those known
windows rather than creating a general rule for unconfirmed or suspended
accounts.

The administration tool has created an AdminNote for every role change since
March 2021. The command excludes every account with an AdminNote, so an account
manually suspended through the administration tool stays out of scope even if
it was created during a campaign window.

The existing self-service removal path is intentionally broad: it removes
related data and profile uploads. This maintenance command must be narrower.
It selects only accounts that have neither related community data nor uploaded
profile images, so direct removal cannot leave related records behind.

## Goals / Non-Goals

**Goals:**

- Permanently remove only accounts belonging to the two identified spam
  campaigns.
- Retain any account with community activity, an uploaded profile image, an
  active staff/moderation role, or a moderation note.
- Default to dry-run and keep deletion bounded and observable.

**Non-Goals:**

- Automatically remove any account outside the two identified campaigns.
- Create an ongoing retention policy or alter signup confirmation.
- Reclaim or otherwise reserve deleted usernames and email addresses.
- Delete message, offer, contact, experience, reference, or moderation data.

## Decisions

- Select accounts created in the two inclusive campaign windows that are
  non-public and whose roles contain only `user` and `suspended`. This makes
  the historical scope explicit and excludes unrelated suspended,
  shadowbanned, and staff accounts.
- Require no messages, threads, contacts, offers, experiences, reference
  threads, or admin notes in either direction. Also require empty circle
  membership, block, and push-registration lists and no uploaded avatar. These
  conditions make direct User deletion safe and preserve any account with
  member, moderation, or uploaded data.
- Use a cursor with bounded identifier batches. Before deleting a batch, check
  its protected activity again and revalidate the campaign, non-public, and
  allowed-role conditions. This prevents deletion when an account was restored
  or reviewed while the command was running.
- Provide a command-line `--delete` switch. Without it, the command reports
  how many records would be removed and exits without writing.
- Process bounded batches until no eligible account remains. The command is
  manually invoked, so it is never scheduled by the production worker.

## Risks / Trade-offs

- [A real suspended account is deleted] → The command is restricted to the
  known campaign windows and excludes accounts with any activity, AdminNote,
  uploaded avatar, or non-standard role.
- [The historic backlog creates database load] → The command uses cursor
  batches and never performs an unbounded deletion.
- [An operator executes deletion unintentionally] → Dry-run is the default;
  deletion requires an explicit `--delete` switch.

## Migration Plan

1. Deploy the command without executing it.
2. Take and retain a production database backup.
3. Run the command in dry-run mode and verify the aggregate count against the
   investigated campaign data.
4. Run it with `--delete`, monitoring batch counts and duration. Stop the
   command to halt further batches; already deleted records can be recovered
   only from the pre-run backup.

Browser end-to-end coverage is not applicable because this is a manually run
maintenance command with no application route or user interface. Its direct
server test exercises dry-run and deletion behaviour against MongoDB.

## Open Questions

None.
