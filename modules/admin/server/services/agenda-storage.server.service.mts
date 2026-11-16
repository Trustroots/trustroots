import type { Db } from 'mongodb';
import type {
  AgendaCollection,
  AgendaCollectionStorage,
  AgendaStorageSample,
} from '../../shared/mongo-diagnostics.mts';

export const agendaCollections = ['agendaJobs', 'agendaJobsArchived'] as const;
export const captureAgendaStorageJob = 'capture agenda storage';
const maxTimeMS = 5_000;
const dayMs = 86_400_000;

type StoredSample = AgendaStorageSample & { _id: string };

function samples(db: Db) {
  return db.collection<StoredSample>('agendaStorageSnapshots');
}

function retainedFrom(now: Date) {
  return new Date(now.getTime() - 29 * dayMs).toISOString().slice(0, 10);
}

export async function discoverAgendaCollections(db: Db): Promise<string[]> {
  const existing = await db
    .listCollections(
      { name: { $in: [...agendaCollections] } },
      { nameOnly: true, maxTimeMS },
    )
    .toArray();
  return existing.map(collection => collection.name);
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

export async function readAgendaCollectionStorage(
  db: Db,
  name: AgendaCollection,
  existing: string[],
): Promise<AgendaCollectionStorage> {
  if (!existing.includes(name)) return { name, status: 'missing' };

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

export async function captureAgendaStorage(db: Db, now = new Date()) {
  const _id = now.toISOString().slice(0, 10);
  const history = samples(db);
  await history.deleteMany(
    { _id: { $lt: retainedFrom(now) } },
    { timeoutMS: maxTimeMS },
  );
  const existing = await discoverAgendaCollections(db);
  const collections = await Promise.all(
    agendaCollections.map(name =>
      readAgendaCollectionStorage(db, name, existing),
    ),
  );
  if (collections.some(collection => collection.status === 'unavailable')) {
    throw new Error('Agenda collection storage statistics are unavailable.');
  }
  await history.updateOne(
    { _id },
    { $setOnInsert: { capturedAt: now.toISOString(), collections } },
    { upsert: true, timeoutMS: maxTimeMS },
  );
}

export async function readAgendaStorageHistory(
  db: Db,
  now: Date,
): Promise<AgendaStorageSample[]> {
  return samples(db)
    .find(
      {
        _id: { $gte: retainedFrom(now), $lte: now.toISOString().slice(0, 10) },
      },
      { projection: { _id: 0 }, sort: { _id: -1 }, limit: 30, maxTimeMS },
    )
    .toArray();
}
