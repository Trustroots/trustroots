import type { Collection, Document, Filter } from 'mongodb';

const retentionMs = 90 * 24 * 60 * 60 * 1000;
const batchSize = 5000;
const maxTimeMS = 30_000;

export async function pruneAgendaDeliveryJobs(
  jobs: Collection<Document>,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionMs);
  const eligible: Filter<Document> = {
    name: { $in: ['send email', 'send push message'] },
    nextRunAt: null,
    lockedAt: null,
    disabled: { $ne: true },
    type: { $ne: 'single' },
    repeatInterval: null,
    repeatAt: null,
    $or: [
      { lastFinishedAt: { $lt: cutoff }, failedAt: null },
      { lastFinishedAt: { $lt: cutoff }, failedAt: { $lt: cutoff } },
      // Older Agenda failures can lack a finish timestamp.
      { lastFinishedAt: null, failedAt: { $lt: cutoff } },
    ],
  };

  await jobs.createIndex(
    { name: 1, nextRunAt: 1, lockedAt: 1, lastFinishedAt: 1 },
    { name: 'agenda_delivery_retention' },
  );
  const candidates = await jobs
    .find(eligible, { projection: { _id: 1 }, maxTimeMS })
    .limit(batchSize)
    .toArray();
  // A candidate can be scheduled or locked again between selection and deletion.
  const result = await jobs.deleteMany(
    { ...eligible, _id: { $in: candidates.map(job => job._id) } },
    { maxTimeMS },
  );
  return result.deletedCount;
}
