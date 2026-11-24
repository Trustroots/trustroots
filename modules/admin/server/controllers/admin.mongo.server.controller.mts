import type { Request, Response } from 'express';
import type { Db } from 'mongodb';
import mongoose from 'mongoose';
import type {
  MongoDiagnosticsSnapshot,
  MongoServerDiagnostics,
} from '../../shared/mongo-diagnostics.mts';

import {
  agendaCollections,
  discoverAgendaCollections,
  readAgendaCollectionStorage,
  readAgendaStorageHistory,
} from '../services/agenda-storage.server.service.mts';

import {
  readJobCounts,
  readSavedAgendaInventory,
} from '../services/agenda-inventory.server.service.mts';
import { readMongoIndexInventory } from '../services/mongo-index-inventory.server.service.mts';

const maxTimeMS = 5_000;

async function readServerDiagnostics(db: Db): Promise<MongoServerDiagnostics> {
  const admin = db.admin();
  const options = { timeoutMS: maxTimeMS };
  const [buildInfo, hello, compatibility] = await Promise.all([
    admin.command({ buildInfo: 1 }, options).catch(() => undefined),
    admin
      .command({ hello: 1 }, options)
      .catch(() =>
        admin.command({ isMaster: 1 }, options).catch(() => undefined),
      ),
    admin
      .command({ getParameter: 1, featureCompatibilityVersion: 1 }, options)
      .catch(() => undefined),
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

async function readAgendaInventory(
  db: Db,
  liveJobs: boolean,
): Promise<Pick<MongoDiagnosticsSnapshot, 'jobs' | 'jobsCapturedAt'>> {
  const saved = await readSavedAgendaInventory(db).catch(() => undefined);
  if (saved && !liveJobs) return saved;

  try {
    return { jobs: await readJobCounts(db, 15_000), jobsCapturedAt: null };
  } catch {
    return saved ?? { jobs: null, jobsCapturedAt: null };
  }
}

async function readAgendaDiagnostics(
  db: Db,
  liveJobs: boolean,
): Promise<
  Pick<MongoDiagnosticsSnapshot, 'collections' | 'jobs' | 'jobsCapturedAt'>
> {
  try {
    const collections = await discoverAgendaCollections(db);
    const [storage, inventory] = await Promise.all([
      Promise.all(
        agendaCollections.map(name =>
          readAgendaCollectionStorage(db, name, collections),
        ),
      ),
      collections.includes('agendaJobs')
        ? readAgendaInventory(db, liveJobs)
        : { jobs: [], jobsCapturedAt: null },
    ]);
    return { collections: storage, ...inventory };
  } catch {
    return {
      collections: agendaCollections.map(name => ({
        name,
        status: 'unavailable',
      })),
      jobs: null,
      jobsCapturedAt: null,
    };
  }
}

export async function diagnostics(req: Request, res: Response) {
  res.set('Cache-Control', 'no-store');
  const db = mongoose.connection.db;
  if (!db) {
    return res
      .status(503)
      .json({ message: 'MongoDB diagnostics are unavailable.' });
  }

  const capturedAt = new Date();
  const [server, agenda, history, indexInventory] = await Promise.all([
    readServerDiagnostics(db),
    readAgendaDiagnostics(db, req.query?.liveJobs === 'true'),
    readAgendaStorageHistory(db, capturedAt).catch(() => null),
    readMongoIndexInventory(db),
  ]);
  return res.json({
    capturedAt: capturedAt.toISOString(),
    server,
    history,
    indexInventory,
    ...agenda,
  } satisfies MongoDiagnosticsSnapshot);
}
