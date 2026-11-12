import type { Request, Response } from 'express';
import type { Db } from 'mongodb';
import mongoose from 'mongoose';
import type {
  AgendaCollection,
  AgendaCollectionStorage,
  AgendaJobCounts,
  MongoDiagnosticsSnapshot,
  MongoServerDiagnostics,
} from '../../shared/mongo-diagnostics.mts';

const collections = ['agendaJobs', 'agendaJobsArchived'] as const;
const maxTimeMS = 5_000;

async function readServerDiagnostics(db: Db): Promise<MongoServerDiagnostics> {
  const admin = db.admin();
  const options = { timeoutMS: maxTimeMS };
  const [buildInfo, hello, compatibility] = await Promise.all([
    admin.command({ buildInfo: 1 }, options).catch(() => null),
    admin
      .command({ hello: 1 }, options)
      .catch(() => admin.command({ isMaster: 1 }, options).catch(() => null)),
    admin
      .command({ getParameter: 1, featureCompatibilityVersion: 1 }, options)
      .catch(() => null),
  ]);

  const rawVersion: unknown = buildInfo?.version;
  const version = typeof rawVersion === 'string' ? rawVersion : null;
  const topology = hello
    ? hello.msg === 'isdbgrid'
      ? 'sharded'
      : typeof hello.setName === 'string'
        ? 'replicaSet'
        : 'standalone'
    : null;

  const rawFcv: unknown = compatibility?.featureCompatibilityVersion;
  const fcv = rawFcv as
    | { version?: unknown; targetVersion?: unknown; previousVersion?: unknown }
    | undefined;

  return {
    version,
    topology,
    fcv:
      typeof fcv?.version === 'string'
        ? {
            version: fcv.version,
            targetVersion:
              typeof fcv.targetVersion === 'string' ? fcv.targetVersion : null,
            transitioning:
              typeof fcv.targetVersion === 'string' ||
              typeof fcv.previousVersion === 'string',
          }
        : null,
  };
}

interface StorageStats {
  count: number;
  storageSize: number;
  totalIndexSize: number;
  freeStorageSize?: number;
  wiredTiger?: {
    'block-manager'?: { 'file bytes available for reuse'?: number };
  };
}

async function readStorage(
  db: Db,
  name: AgendaCollection,
): Promise<AgendaCollectionStorage> {
  try {
    const rows = await db
      .collection(name)
      .aggregate<{ storageStats: StorageStats }>(
        [{ $collStats: { storageStats: {} } }],
        { maxTimeMS },
      )
      .toArray();

    // MongoDB reports one row per shard. Older versions expose reusable
    // space under WiredTiger's block manager.
    let count = 0;
    let storageBytes = 0;
    let indexBytes = 0;
    let reusableBytes: number | null = 0;
    for (const { storageStats: stats } of rows) {
      count += stats.count;
      storageBytes += stats.storageSize;
      indexBytes += stats.totalIndexSize;
      const reusable =
        stats.freeStorageSize ??
        stats.wiredTiger?.['block-manager']?.['file bytes available for reuse'];
      reusableBytes =
        reusableBytes === null || reusable === undefined
          ? null
          : reusableBytes + reusable;
    }
    return {
      name,
      status: 'available',
      count,
      storageBytes,
      indexBytes,
      reusableBytes,
    };
  } catch {
    return { name, status: 'unavailable' };
  }
}

function readJobCounts(db: Db): Promise<AgendaJobCounts[]> {
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
          },
        },
        {
          $group: {
            _id: '$_id.name',
            states: { $push: { k: '$_id.state', v: '$count' } },
          },
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            name: '$_id',
            counts: { $arrayToObject: '$states' },
          },
        },
      ],
      { maxTimeMS, allowDiskUse: false },
    )
    .toArray();
}

async function readAgendaDiagnostics(
  db: Db,
): Promise<Pick<MongoDiagnosticsSnapshot, 'collections' | 'jobs'>> {
  try {
    const existing = await db
      .listCollections(
        { name: { $in: [...collections] } },
        { nameOnly: true, maxTimeMS },
      )
      .toArray();
    const names = new Set(existing.map(collection => collection.name));
    const [storage, jobs] = await Promise.all([
      Promise.all(
        collections.map(async (name): Promise<AgendaCollectionStorage> =>
          names.has(name) ? readStorage(db, name) : { name, status: 'missing' },
        ),
      ),
      names.has('agendaJobs') ? readJobCounts(db).catch(() => null) : [],
    ]);
    return { collections: storage, jobs };
  } catch {
    return {
      collections: collections.map(name => ({ name, status: 'unavailable' })),
      jobs: null,
    };
  }
}

export async function diagnostics(_req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const db = mongoose.connection.db;
  if (!db) {
    return res
      .status(503)
      .json({ message: 'MongoDB diagnostics are unavailable.' });
  }

  const capturedAt = new Date().toISOString();
  const [server, agenda] = await Promise.all([
    readServerDiagnostics(db),
    readAgendaDiagnostics(db),
  ]);
  return res.json({
    capturedAt,
    server,
    ...agenda,
  } satisfies MongoDiagnosticsSnapshot);
}
