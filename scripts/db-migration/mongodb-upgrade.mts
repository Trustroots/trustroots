#!/usr/bin/env node

import { globSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MongoClient, type Document } from 'mongodb';

const serverSeries = ['4.4', '5.0', '6.0', '7.0'] as const;
type ServerSeries = (typeof serverSeries)[number];
type Topology = 'standalone' | 'replicaSet' | 'sharded';

const nextSeries = new Map<ServerSeries, ServerSeries>([
  ['4.4', '5.0'],
  ['5.0', '6.0'],
  ['6.0', '7.0'],
]);

type Admin = {
  command(command: Document): Promise<Document>;
};

export type MigrationClient = {
  db(name?: string): { admin(): Admin };
};

export type ServerState = {
  version: string;
  series: string;
  fcv: string;
  fcvTransition: boolean;
  topology: Topology;
  writablePrimary: boolean;
  replicaMembers?: { total: number; healthy: number };
};

export type SafeReport = {
  schemaVersion: 1;
  action: string;
  checkedAt: string;
  status: 'passed' | 'failed';
  server?: ServerState;
  checks: Array<{
    code: string;
    status: 'passed' | 'failed';
    expected?: string | number;
    actual?: string | number;
  }>;
};

export class MigrationCheckError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'MigrationCheckError';
    this.code = code;
  }
}

function seriesFor(version: string): string {
  const match = /^(\d+\.\d+)(?:\.|$)/.exec(version);
  return match?.[1] ?? '';
}

function readFcv(result: Document): {
  version: string;
  transitioning: boolean;
} {
  const value = result.featureCompatibilityVersion as
    | { version?: unknown; targetVersion?: unknown; previousVersion?: unknown }
    | undefined;
  return {
    version: typeof value?.version === 'string' ? value.version : '',
    transitioning:
      typeof value?.targetVersion === 'string' ||
      typeof value?.previousVersion === 'string',
  };
}

function commandSucceeded(result: Document): boolean {
  return result.ok === 1 || result.ok === true;
}

function assertCommandSucceeded(result: Document, code: string): void {
  if (!commandSucceeded(result)) throw new MigrationCheckError(code);
}

export async function inspectServer(
  client: MigrationClient,
): Promise<ServerState> {
  const admin = client.db('admin').admin();
  const [buildInfo, fcvResult, hello] = await Promise.all([
    admin.command({ buildInfo: 1 }),
    admin.command({ getParameter: 1, featureCompatibilityVersion: 1 }),
    admin.command({ hello: 1 }),
  ]);
  assertCommandSucceeded(buildInfo, 'BUILD_INFO_FAILED');
  assertCommandSucceeded(fcvResult, 'FCV_READ_FAILED');
  assertCommandSucceeded(hello, 'TOPOLOGY_READ_FAILED');

  const version =
    typeof buildInfo.version === 'string' ? buildInfo.version : '';
  const fcv = readFcv(fcvResult);
  if (!version || !fcv.version) {
    throw new MigrationCheckError('SERVER_STATE_INCOMPLETE');
  }

  const topology: Topology =
    hello.msg === 'isdbgrid'
      ? 'sharded'
      : typeof hello.setName === 'string'
        ? 'replicaSet'
        : 'standalone';
  const state: ServerState = {
    version,
    series: seriesFor(version),
    fcv: fcv.version,
    fcvTransition: fcv.transitioning,
    topology,
    writablePrimary: hello.isWritablePrimary === true,
  };

  if (topology === 'replicaSet') {
    const status = await admin.command({ replSetGetStatus: 1 });
    assertCommandSucceeded(status, 'REPLICA_STATUS_FAILED');
    const members = Array.isArray(status.members)
      ? (status.members as Array<{ state?: number; health?: number }>)
      : [];
    const healthy = members.filter(
      member => member.health === 1 && [1, 2, 7].includes(member.state ?? -1),
    ).length;
    if (!members.length || healthy !== members.length) {
      throw new MigrationCheckError('REPLICA_SET_UNHEALTHY');
    }
    state.replicaMembers = { total: members.length, healthy };
  }

  return state;
}

export function assertFcvTransition(
  source: string,
  target: string,
  state: ServerState,
): void {
  if (
    !serverSeries.includes(source as ServerSeries) ||
    nextSeries.get(source as ServerSeries) !== target
  ) {
    throw new MigrationCheckError('NON_SEQUENTIAL_TRANSITION');
  }
  if (state.topology !== 'standalone') {
    throw new MigrationCheckError('UNSUPPORTED_TOPOLOGY');
  }
  if (state.fcvTransition) {
    throw new MigrationCheckError('FCV_TRANSITION_IN_PROGRESS');
  }
  if (state.series !== target) {
    throw new MigrationCheckError('TARGET_BINARY_MISMATCH');
  }
  if (state.fcv !== source) {
    throw new MigrationCheckError('SOURCE_FCV_MISMATCH');
  }
  if (!state.writablePrimary) {
    throw new MigrationCheckError('NOT_WRITABLE_PRIMARY');
  }
}

export async function advanceFcv(
  client: MigrationClient,
  source: string,
  target: string,
): Promise<{ before: ServerState; after: ServerState }> {
  const before = await inspectServer(client);
  assertFcvTransition(source, target, before);

  const command: Document = { setFeatureCompatibilityVersion: target };
  if (target === '7.0') command.confirm = true;
  const result = await client.db('admin').admin().command(command);
  assertCommandSucceeded(result, 'FCV_ADVANCE_FAILED');

  const after = await inspectServer(client);
  if (after.fcv !== target || after.fcvTransition) {
    throw new MigrationCheckError('FCV_READBACK_MISMATCH');
  }
  return { before, after };
}

type IndexSpec = { key: Document; options: Document };
type ModelCheck = {
  collectionName: string;
  indexes: IndexSpec[];
  readIdOnly(): Promise<void>;
  listIndexes(): Promise<Document[]>;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sameIndex(expected: IndexSpec, actual: Document): boolean {
  if (
    JSON.stringify(Object.entries(expected.key)) !==
    JSON.stringify(Object.entries(actual.key as Document))
  ) {
    return false;
  }
  const ignored = new Set(['name', 'background']);
  for (const [key, value] of Object.entries(expected.options)) {
    if (ignored.has(key)) continue;
    if (stable(value) !== stable(actual[key])) return false;
  }
  return true;
}

export async function verifyModels(models: ModelCheck[]): Promise<{
  modelsChecked: number;
  readsPassed: number;
  indexesExpected: number;
  indexesPresent: number;
}> {
  if (!models.length) throw new MigrationCheckError('NO_APPLICATION_MODELS');
  let readsPassed = 0;
  let indexesExpected = 0;
  let indexesPresent = 0;
  for (const model of models) {
    try {
      await model.readIdOnly();
      readsPassed += 1;
    } catch {
      throw new MigrationCheckError('APPLICATION_READ_FAILED');
    }
    const actualIndexes = await model.listIndexes().catch(() => {
      throw new MigrationCheckError('INDEX_READ_FAILED');
    });
    indexesExpected += model.indexes.length;
    for (const expected of model.indexes) {
      if (actualIndexes.some(actual => sameIndex(expected, actual))) {
        indexesPresent += 1;
      } else {
        throw new MigrationCheckError('DECLARED_INDEX_MISSING');
      }
    }
  }
  return {
    modelsChecked: models.length,
    readsPassed,
    indexesExpected,
    indexesPresent,
  };
}

function report(
  action: string,
  status: SafeReport['status'],
  checks: SafeReport['checks'],
  server?: ServerState,
): SafeReport {
  return {
    schemaVersion: 1,
    action,
    checkedAt: new Date().toISOString(),
    status,
    ...(server ? { server } : {}),
    checks,
  };
}

function output(value: SafeReport): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function parseOptions(args: string[]): Map<string, string> {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key?.startsWith('--') || options.has(key)) {
      throw new MigrationCheckError('INVALID_ARGUMENTS');
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new MigrationCheckError('INVALID_ARGUMENTS');
    }
    options.set(key, value);
    index += 1;
  }
  return options;
}

export function discoverModelPaths(repoRoot: string): string[] {
  // The source tree contains generated JavaScript siblings for many TypeScript
  // models. Importing both registers the same Mongoose model twice and raises
  // OverwriteModelError. Prefer source modules when paired, while retaining
  // JavaScript-only model modules.
  const candidates = globSync('modules/*/server/models/**/*.{mjs,mts}', {
    cwd: repoRoot,
  })
    .filter(modelPath => !modelPath.endsWith('.types.mts'))
    .sort();
  const selected = new Map<string, string>();
  for (const modelPath of candidates) {
    const moduleBase = modelPath.replace(/\.(?:mjs|mts)$/, '');
    if (modelPath.endsWith('.mts') || !selected.has(moduleBase)) {
      selected.set(moduleBase, modelPath);
    }
  }
  return [...selected.values()].sort();
}

export async function loadModelChecks(
  mongoose: typeof import('mongoose').default,
): Promise<ModelCheck[]> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const configLog = console.log;
  const previousSkipLocalConfig = process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG;
  process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG = 'true';
  console.log = () => undefined;
  try {
    const modelPaths = discoverModelPaths(repoRoot);
    if (!modelPaths.length) {
      throw new MigrationCheckError('NO_APPLICATION_MODELS');
    }
    for (const modelPath of modelPaths) {
      await import(pathToFileURL(resolve(repoRoot, modelPath)).href);
    }
    return mongoose.modelNames().map(name => {
      const model = mongoose.model(name);
      return {
        collectionName: model.collection.name,
        indexes: model.schema.indexes().map(([key, options]) => ({
          key: key as Document,
          options: options as Document,
        })),
        readIdOnly: async () => {
          await model.findOne({}, { _id: 1 }).lean().exec();
        },
        listIndexes: async () => {
          const database = mongoose.connection.db;
          if (!database) throw new MigrationCheckError('INDEX_READ_FAILED');
          const collections = await database
            .listCollections(
              { name: model.collection.name },
              { nameOnly: true },
            )
            .toArray();
          if (!collections.length) return [];
          return database
            .collection(model.collection.name)
            .listIndexes()
            .toArray();
        },
      };
    });
  } finally {
    console.log = configLog;
    if (previousSkipLocalConfig === undefined) {
      delete process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG;
    } else {
      process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG = previousSkipLocalConfig;
    }
  }
}

export function uriHasDatabase(uri: string): boolean {
  try {
    return new URL(uri).pathname.length > 1;
  } catch {
    return false;
  }
}

export function sanitisedAction(requestedAction: string): string {
  return ['inspect', 'verify', 'advance-fcv'].includes(requestedAction)
    ? requestedAction
    : 'unknown';
}

async function run(args: string[]): Promise<void> {
  const requestedAction = args[0] ?? '';
  const action = sanitisedAction(requestedAction);
  let client: MongoClient | undefined;
  let mongoose: typeof import('mongoose').default | undefined;
  try {
    if (action === 'unknown') {
      throw new MigrationCheckError('INVALID_COMMAND');
    }
    const options = parseOptions(args.slice(1));
    const allowedOptions =
      action === 'advance-fcv' ? ['--source', '--target'] : [];
    if ([...options.keys()].some(key => !allowedOptions.includes(key))) {
      throw new MigrationCheckError('INVALID_ARGUMENTS');
    }
    const uri = process.env.MONGODB_URI;
    if (!uri?.trim()) throw new MigrationCheckError('URI_REQUIRED');
    if (action === 'verify' && !uriHasDatabase(uri)) {
      throw new MigrationCheckError('URI_DATABASE_REQUIRED');
    }

    client = new MongoClient(uri, { serverSelectionTimeoutMS: 10_000 });
    await client.connect();

    if (action === 'advance-fcv') {
      const source = options.get('--source');
      const target = options.get('--target');
      if (!source || !target)
        throw new MigrationCheckError('INVALID_ARGUMENTS');
      const transition = await advanceFcv(client, source, target);
      output(
        report(
          action,
          'passed',
          [
            { code: 'BINARY_AND_SOURCE_FCV_GUARDS', status: 'passed' },
            {
              code: 'FCV_ADVANCED_AND_VERIFIED',
              status: 'passed',
              expected: target,
              actual: transition.after.fcv,
            },
          ],
          transition.after,
        ),
      );
    } else {
      const server = await inspectServer(client);
      if (action === 'inspect') {
        output(
          report(
            action,
            'passed',
            [{ code: 'SERVER_INSPECTED', status: 'passed' }],
            server,
          ),
        );
      } else {
        await client.close();
        client = undefined;
        process.env.TRUSTROOTS_SKIP_LOCAL_CONFIG = 'true';
        const mongooseModule = await import('mongoose');
        mongoose = mongooseModule.default;
        const models = await loadModelChecks(mongooseModule.default);
        await mongoose.connect(uri, {
          autoIndex: false,
          autoCreate: false,
          serverSelectionTimeoutMS: 10_000,
        });
        const appChecks = await verifyModels(models);
        output(
          report(
            action,
            'passed',
            [
              { code: 'SERVER_INSPECTED', status: 'passed' },
              {
                code: 'APPLICATION_MODELS_CHECKED',
                status: 'passed',
                actual: appChecks.modelsChecked,
              },
              {
                code: 'APPLICATION_READS_PASSED',
                status: 'passed',
                actual: appChecks.readsPassed,
              },
              {
                code: 'DECLARED_INDEXES_PRESENT',
                status: 'passed',
                actual: appChecks.indexesPresent,
                expected: appChecks.indexesExpected,
              },
            ],
            server,
          ),
        );
      }
    }
  } catch (error) {
    const code =
      error instanceof MigrationCheckError
        ? error.code
        : 'MIGRATION_CHECK_FAILED';
    output(report(action || 'unknown', 'failed', [{ code, status: 'failed' }]));
    process.exitCode = 1;
  } finally {
    if (mongoose?.connection.readyState)
      await mongoose.disconnect().catch(() => undefined);
    if (client) await client.close().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  void run(process.argv.slice(2));
}
