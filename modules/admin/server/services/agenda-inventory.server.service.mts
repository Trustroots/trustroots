import type { Db } from 'mongodb';
import type { AgendaJobCounts } from '../../shared/mongo-diagnostics.mts';

interface SavedInventory {
  _id: 'latest';
  jobs: AgendaJobCounts[];
  jobsCapturedAt: string;
}

function inventory(db: Db) {
  return db.collection<SavedInventory>('agendaInventory');
}

export function readJobCounts(
  db: Db,
  maxTimeMS: number,
): Promise<AgendaJobCounts[]> {
  return db
    .collection('agendaJobs')
    .aggregate<AgendaJobCounts>(
      [
        {
          $group: {
            _id: {
              name: { $ifNull: ['$name', '(Unnamed job)'] },
              state: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$disabled', true] }, then: 'disabled' },
                    {
                      case: { $ne: [{ $ifNull: ['$lockedAt', null] }, null] },
                      then: 'locked',
                    },
                    {
                      case: { $ne: [{ $ifNull: ['$nextRunAt', null] }, null] },
                      then: 'queued',
                    },
                    {
                      case: {
                        $and: [
                          { $ne: [{ $ifNull: ['$failedAt', null] }, null] },
                          {
                            $gte: [
                              '$failedAt',
                              { $ifNull: ['$lastFinishedAt', null] },
                            ],
                          },
                        ],
                      },
                      then: 'failed',
                    },
                    {
                      case: {
                        $ne: [{ $ifNull: ['$lastFinishedAt', null] }, null],
                      },
                      then: 'completed',
                    },
                  ],
                  default: 'unscheduled',
                },
              },
            },
            count: { $sum: 1 },
            bsonBytes: { $sum: { $bsonSize: '$$ROOT' } },
            oldestCompletedAt: { $min: '$lastFinishedAt' },
          },
        },
        {
          $group: {
            _id: '$_id.name',
            states: { $push: { k: '$_id.state', v: '$count' } },
            total: { $sum: '$count' },
            bsonBytes: { $sum: '$bsonBytes' },
            oldestCompletedAt: {
              $min: {
                $cond: [
                  { $eq: ['$_id.state', 'completed'] },
                  '$oldestCompletedAt',
                  null,
                ],
              },
            },
          },
        },
        { $sort: { bsonBytes: -1, _id: 1 } },
        {
          $project: {
            _id: 0,
            name: '$_id',
            counts: { $arrayToObject: '$states' },
            total: 1,
            bsonBytes: 1,
            oldestCompletedAt: { $toString: '$oldestCompletedAt' },
          },
        },
      ],
      { maxTimeMS, allowDiskUse: false },
    )
    .toArray();
}

export async function captureAgendaInventory(db: Db) {
  const jobsCapturedAt = new Date().toISOString();
  const jobs = await readJobCounts(db, 120_000);
  await inventory(db).updateOne(
    { _id: 'latest' },
    { $set: { jobs, jobsCapturedAt } },
    { upsert: true, timeoutMS: 5_000 },
  );
}

export async function readSavedAgendaInventory(db: Db) {
  const saved = await inventory(db).findOne(
    { _id: 'latest' },
    { timeoutMS: 5_000 },
  );
  return saved && { jobs: saved.jobs, jobsCapturedAt: saved.jobsCapturedAt };
}
