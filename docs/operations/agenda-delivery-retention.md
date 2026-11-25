# Agenda delivery job retention

The worker prunes up to 5,000 terminal `send email` and legacy
`send push message` jobs every 15 minutes. Delivery records become eligible
after 90 days. Email delivery previews that use the local queue can only
reliably cover the retained period.

For investigations covering older failures, capture aggregate counts by week
and SMTP error category before deploying retention. Agenda stores the last
failure time and reason on each job. SparkPost delivery events cover a
different stage of delivery.

The first run builds the `agenda_delivery_retention` index, which may
temporarily increase disk and I/O usage. Watch the worker logs for batch
counts and the admin Agenda storage page for the change in job count and
logical BSON size. Allow several days for a backlog of more than a million
records. MongoDB can reuse the freed storage internally. Any operation to
return space to the filesystem should be planned separately for the deployed
MongoDB version and topology.

The Docker development export already omits the live Agenda queue. The worker
cleanup applies to the live queue. Existing archives and backups follow their
own retention policies.
