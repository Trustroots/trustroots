## Design

The Agenda worker runs the storage capture at 03:00 UTC. MongoDB's collection statistics supply the document count, allocated bytes, index bytes and reusable bytes where available. A separate collection uses the UTC date as its unique key. An upsert preserves the first successful sample for each date, and the worker prunes dates outside the 30-date window.

The administrator endpoint loads history independently of live statistics. The live job aggregation counts states and sums BSON document sizes by job name with a 15-second server-side limit. The dashboard explains that these sizes measure uncompressed data. Only aggregate results leave MongoDB.

Deployment requires the existing worker and a MongoDB account with read and write access to the application database. No backfill is needed.

The worker also captures the latest inventory with a two-minute query limit and stores its timestamp. Initial dashboard requests reuse that inventory when available. Explicit refreshes attempt a live read within 15 seconds and show the dated inventory if that read fails. Storage history uses its own collection and is saved before the inventory scan.
