## Why

Administrators need to compare application activity with provider delivery metrics and inspect email jobs after a sending interruption. ROmongous already offers a useful SparkPost daily table and recent-event detail, but its application counts come from a delayed dump.

## What Changes

- Add an administrator-only `/admin/sparkpost` page with daily UTC SparkPost metrics alongside live application sign-up and message counts.
- Add bounded recent-event detail with recipient domains only and explicit incomplete/retention notices.
- Add a read-only outage-window preview of completed email jobs, grouped by campaign, and counts of new accounts still awaiting confirmation. Completion is not evidence of delivery; this version neither claims individual emails are missing nor sends them.
- Read a server-only SparkPost API key and EU/US endpoint configuration; show unavailable metrics distinctly from zero.

## Impact

Affected: admin client/server/shared types, shell routing, configuration documentation, admin tests and e2e coverage. Reuse existing admin-to-user/message dependencies. No database migration, email sends, or job/user mutations. Configure `SPARKPOST_API_KEY` with read-only metrics/events permissions; EU is the default endpoint. Existing SMTP configuration is unchanged.
