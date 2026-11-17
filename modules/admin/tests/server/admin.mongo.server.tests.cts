const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
require('should');
const {
  captureAgendaInventory,
}: typeof import('../../server/services/agenda-inventory.server.service.mts') = require('../../server/services/agenda-inventory.server.service.mts');
const { BSON }: typeof import('mongodb') = require('mongodb');
const {
  captureAgendaStorage,
  readAgendaStorageHistory,
}: typeof import('../../server/services/agenda-storage.server.service.mts') = require('../../server/services/agenda-storage.server.service.mts');
const adminMongo: typeof import('../../server/controllers/admin.mongo.server.controller.mts') = require('../../server/controllers/admin.mongo.server.controller.mts');

type MongoBody =
  import('../../shared/mongo-diagnostics.mts').MongoDiagnosticsSnapshot;

type Response = {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  set(name: string, value: string): Response;
  status(code: number): Response;
  json(body: unknown): Response;
};

function mockResponse(): Response {
  const response: Response = {
    statusCode: 200,
    headers: {},
    set(name, value) {
      response.headers[name] = value;
      return response;
    },
    status(code) {
      response.statusCode = code;
      return response;
    },
    json(body) {
      response.body = body;
      return response;
    },
  };
  return response;
}

function mongoBody(response: Response): MongoBody {
  return response.body as MongoBody;
}

describe('Admin Mongo diagnostics', () => {
  const db = mongoose.connection.db!;
  const agenda = db.collection('agendaJobs');
  const archived = db.collection('agendaJobsArchived');
  const inventory = db.collection('agendaInventory');
  const history = db.collection<{ _id: string }>('agendaStorageSnapshots');

  afterEach(async () => {
    sinon.restore();
    await agenda.deleteMany({});
    await archived.deleteMany({});
    await history.deleteMany({});
    await inventory.deleteMany({});
  });

  it('reports live Mongo metadata, storage statistics and grouped Agenda states', async () => {
    const earlier = new Date('2026-11-12T11:00:00Z');
    const later = new Date('2026-11-12T12:00:00Z');
    await agenda.insertMany([
      { name: 'sample', nextRunAt: later },
      { name: 'sample', disabled: true },
      { name: 'sample', lockedAt: earlier, nextRunAt: later },
      { name: 'sample', failedAt: later, lastFinishedAt: earlier },
      { name: 'sample', failedAt: earlier },
      { name: 'sample', failedAt: earlier, lastFinishedAt: later },
      { name: 'sample' },
      { name: 'sample', failedAt: null, lastFinishedAt: null },
      { lastFinishedAt: earlier },
      { name: 'larger fixture', data: { text: 'x'.repeat(2048) } },
    ]);
    await archived.insertOne({ name: 'archived' });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);

    const body = mongoBody(response);
    body.server.version!.should.be.a.String();
    body.server.topology!.should.be.oneOf([
      'standalone',
      'replicaSet',
      'sharded',
    ]);
    body.server.fcv!.version.should.be.a.String();
    body.collections
      .map(collection => collection.status)
      .should.deepEqual(['available', 'available']);
    const jobs = body.jobs!;
    const sample = jobs.find(job => job.name === 'sample');
    const largerFixture = jobs.find(job => job.name === 'larger fixture');
    assert.ok(sample);
    assert.ok(largerFixture);
    assert.ok(largerFixture.bsonBytes > sample.bsonBytes);
    assert.ok(jobs.indexOf(largerFixture) < jobs.indexOf(sample));
    assert.equal(sample.total, 8);
    assert.equal(sample.oldestCompletedAt, later.toISOString());
    assert.equal(
      sample.bsonBytes,
      (await agenda.find({ name: 'sample' }).toArray()).reduce(
        (bytes, job) => bytes + BSON.calculateObjectSize(job),
        0,
      ),
    );
    assert.deepEqual(body.history, []);
    sample.counts.should.deepEqual({
      queued: 1,
      disabled: 1,
      locked: 1,
      failed: 2,
      completed: 1,
      unscheduled: 2,
    });
    jobs
      .find(job => job.name === '(Unnamed job)')!
      .counts.should.deepEqual({
        completed: 1,
      });
    response.headers['Cache-Control'].should.equal('no-store');
  });

  it('serves a dated worker inventory and falls back to it when a fresh query fails', async () => {
    const name = 'inventory fixture';
    await agenda.insertOne({ name });
    await captureAgendaInventory(db);
    await agenda.insertOne({ name });

    const saved = mockResponse();
    await adminMongo.diagnostics({} as never, saved as never);
    assert.equal(
      mongoBody(saved).jobs?.find(job => job.name === name)?.total,
      1,
    );
    assert.match(mongoBody(saved).jobsCapturedAt!, /^\d{4}-\d{2}-\d{2}T/);

    const liveRequest = { query: { liveJobs: 'true' } };
    const live = mockResponse();
    await adminMongo.diagnostics(liveRequest as never, live as never);
    assert.equal(
      mongoBody(live).jobs?.find(job => job.name === name)?.total,
      2,
    );
    assert.equal(mongoBody(live).jobsCapturedAt, null);

    const collection = db.collection.bind(db);
    const aggregate = agenda.aggregate.bind(agenda);
    sinon.stub(agenda, 'aggregate').callsFake((pipeline, options) => {
      if (pipeline?.[0]?.$group) throw new Error('query timed out');
      return aggregate(pipeline, options);
    });
    sinon
      .stub(db, 'collection')
      .callsFake((name: string) =>
        name === 'agendaJobs' ? agenda : collection(name),
      );

    const fallback = mockResponse();
    await adminMongo.diagnostics(liveRequest as never, fallback as never);
    assert.deepEqual(mongoBody(fallback).jobs, mongoBody(saved).jobs);
    assert.equal(
      mongoBody(fallback).jobsCapturedAt,
      mongoBody(saved).jobsCapturedAt,
    );
  });

  it('keeps the first capture on each UTC date and prunes expired readings', async () => {
    const now = new Date('2025-02-01T03:00:00Z');
    const oldest = new Date('2025-01-03T03:00:00Z');
    await captureAgendaStorage(db, new Date('2025-01-02T03:00:00Z'));
    await captureAgendaStorage(db, oldest);
    await agenda.insertOne({
      name: 'diagnostics fixture',
      data: { text: 'Private fixture body' },
    });
    await captureAgendaStorage(db, now);
    await agenda.insertOne({ name: 'later job' });
    await captureAgendaStorage(db, new Date('2025-02-01T23:59:00Z'));

    const readings = await readAgendaStorageHistory(db, now);
    assert.deepEqual(
      readings.map(reading => reading.capturedAt),
      [now.toISOString(), oldest.toISOString()],
    );
    const live = readings[0]!.collections[0]!;
    assert.equal(live.status === 'available' && live.count, 1);
    assert.doesNotMatch(JSON.stringify(readings), /Private fixture body/);
    assert.equal(await history.countDocuments({ _id: '2025-01-02' }), 0);

    const nextDay = new Date('2025-02-02T00:00:00Z');
    await captureAgendaStorage(db, nextDay);
    assert.equal(await history.countDocuments({ _id: '2025-01-03' }), 0);
    assert.equal((await readAgendaStorageHistory(db, now)).length, 1);
    assert.equal((await readAgendaStorageHistory(db, nextDay)).length, 2);
  });

  it('does not persist a capture when storage statistics are unavailable', async () => {
    sinon.stub(agenda, 'aggregate').throws(new Error('unavailable'));
    const collection = sinon.stub(db, 'collection');
    collection.withArgs('agendaJobs').returns(agenda);
    collection.withArgs('agendaJobsArchived').returns(archived);
    collection.withArgs('agendaStorageSnapshots').returns(history as never);
    sinon.stub(db, 'listCollections').returns({
      toArray: async () => [{ name: 'agendaJobs' }],
    } as never);

    await assert.rejects(
      captureAgendaStorage(db),
      /statistics are unavailable/,
    );
    assert.equal(await history.countDocuments({}), 0);
  });

  it('recognises a sharded topology and FCV target-version transition', async () => {
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).resolves({ version: '7.0.1' });
    command.withArgs({ hello: 1 }).resolves({ msg: 'isdbgrid' });
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .resolves({
        featureCompatibilityVersion: {
          version: '6.0',
          targetVersion: '7.0',
        },
      });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    mongoBody(response).server.should.deepEqual({
      version: '7.0.1',
      topology: 'sharded',
      fcv: { version: '6.0', targetVersion: '7.0', transitioning: true },
    });
  });

  it('recognises replica sets and FCV previous-version transitions', async () => {
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).resolves({ version: '7.0.1' });
    command.withArgs({ hello: 1 }).resolves({ setName: 'replica-set' });
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .resolves({
        featureCompatibilityVersion: {
          version: '7.0',
          previousVersion: '6.0',
        },
      });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    mongoBody(response).server.should.deepEqual({
      version: '7.0.1',
      topology: 'replicaSet',
      fcv: { version: '7.0', targetVersion: null, transitioning: true },
    });
  });

  it('uses isMaster on older servers and reports unavailable metadata independently', async () => {
    sinon.stub(db, 'listCollections').returns({
      toArray: async () => [],
    } as never);
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).rejects(new Error('unavailable'));
    command.withArgs({ hello: 1 }).rejects(new Error('unknown command'));
    command.withArgs({ isMaster: 1 }).resolves({});
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .rejects(new Error('unavailable'));

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    mongoBody(response).server.should.deepEqual({
      version: null,
      topology: 'standalone',
      fcv: null,
    });
    mongoBody(response).collections[0]!.status.should.equal('missing');
    assert.deepEqual(mongoBody(response).jobs, []);
  });

  it('reports unavailable topology when both hello commands fail', async () => {
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon
      .stub(admin, 'command')
      .rejects(new Error('Unavailable'));
    command.withArgs({ buildInfo: 1 }).resolves({ version: '7.0.1' });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    assert.deepEqual(mongoBody(response).server, {
      version: '7.0.1',
      topology: null,
      fcv: null,
    });
  });

  it('sums shard storage and reads reusable space from older WiredTiger stats', async () => {
    const list = sinon.stub(db, 'listCollections').returns({
      toArray: async () => [
        { name: 'agendaJobs' },
        { name: 'agendaJobsArchived' },
      ],
    } as never);
    const aggregate = sinon.spy();
    const collection = sinon
      .stub(db, 'collection')
      .callsFake((name: string) => {
        const rows =
          name === 'agendaJobs'
            ? [
                {
                  storageStats: {
                    count: 2,
                    storageSize: 20,
                    totalIndexSize: 4,
                    wiredTiger: {
                      'block-manager': { 'file bytes available for reuse': 3 },
                    },
                  },
                },
                {
                  storageStats: {
                    count: 5,
                    storageSize: 50,
                    totalIndexSize: 10,
                    wiredTiger: {
                      'block-manager': { 'file bytes available for reuse': 7 },
                    },
                  },
                },
              ]
            : [
                {
                  storageStats: {
                    count: 0,
                    storageSize: 0,
                    totalIndexSize: 0,
                  },
                },
                {
                  storageStats: {
                    count: 1,
                    storageSize: 10,
                    totalIndexSize: 2,
                    wiredTiger: {},
                  },
                },
                {
                  storageStats: {
                    count: 2,
                    storageSize: 20,
                    totalIndexSize: 4,
                    freeStorageSize: 5,
                  },
                },
              ];
        return {
          aggregate: (pipeline: unknown[], options: unknown) => {
            aggregate(name, pipeline, options);
            return { toArray: async () => rows };
          },
        } as never;
      });
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).resolves({ version: '4.4.29' });
    command.withArgs({ hello: 1 }).rejects(new Error('unknown command'));
    command.withArgs({ isMaster: 1 }).resolves({});
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .resolves({ featureCompatibilityVersion: { version: '4.4' } });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    const body = mongoBody(response);
    assert.deepEqual(body.server.fcv, {
      version: '4.4',
      targetVersion: null,
      transitioning: false,
    });
    body.collections[0]!.should.deepEqual({
      name: 'agendaJobs',
      status: 'available',
      count: 7,
      storageBytes: 70,
      indexBytes: 14,
      reusableBytes: 10,
    });
    assert.deepEqual(body.collections[1], {
      name: 'agendaJobsArchived',
      status: 'available',
      count: 3,
      storageBytes: 30,
      indexBytes: 6,
      reusableBytes: null,
    });
    sinon.assert.calledOnceWithExactly(
      list,
      { name: { $in: ['agendaJobs', 'agendaJobsArchived'] } },
      { nameOnly: true, maxTimeMS: 5_000 },
    );
    for (const name of ['agendaJobs', 'agendaJobsArchived']) {
      sinon.assert.calledWithExactly(
        aggregate,
        name,
        [{ $collStats: { storageStats: {} } }],
        { maxTimeMS: 5_000 },
      );
    }
    sinon.assert.calledWithExactly(aggregate, 'agendaJobs', sinon.match.array, {
      maxTimeMS: 15_000,
      allowDiskUse: false,
    });
    for (const request of [
      { buildInfo: 1 },
      { hello: 1 },
      { isMaster: 1 },
      { getParameter: 1, featureCompatibilityVersion: 1 },
    ]) {
      sinon.assert.calledWithExactly(command, request, { timeoutMS: 5_000 });
    }
    collection.callCount.should.equal(5);
    assert.equal(body.history, null);
  });

  it('marks storage and job counts unavailable when their reads fail', async () => {
    sinon.stub(db, 'listCollections').returns({
      toArray: async () => [
        { name: 'agendaJobs' },
        { name: 'agendaJobsArchived' },
      ],
    } as never);
    sinon.stub(db, 'collection').callsFake(
      () =>
        ({
          aggregate: () => ({
            toArray: async () => {
              throw new Error('unavailable');
            },
          }),
        }) as never,
    );
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).resolves({ version: '7.0.1' });
    command.withArgs({ hello: 1 }).resolves({});
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .resolves({ featureCompatibilityVersion: { version: '7.0' } });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    mongoBody(response)
      .collections.every(item => item.status === 'unavailable')
      .should.equal(true);
    assert.equal(mongoBody(response).jobs, null);
  });

  it('keeps server metadata when Agenda collection discovery fails', async () => {
    sinon.stub(db, 'listCollections').throws(new Error('unavailable'));
    const admin = db.admin();
    sinon.stub(db, 'admin').returns(admin);
    const command = sinon.stub(admin, 'command');
    command.withArgs({ buildInfo: 1 }).resolves({ version: '7.0.1' });
    command.withArgs({ hello: 1 }).resolves({ setName: 'replica-set' });
    command
      .withArgs({ getParameter: 1, featureCompatibilityVersion: 1 })
      .resolves({ featureCompatibilityVersion: { version: '7.0' } });

    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    assert.equal(mongoBody(response).server.version, '7.0.1');
    mongoBody(response)
      .collections.every(item => item.status === 'unavailable')
      .should.equal(true);
    assert.equal(mongoBody(response).jobs, null);
  });

  it('returns unavailable when the database connection is absent', async () => {
    sinon.stub(mongoose.connection, 'db').value(undefined);
    const response = mockResponse();
    await adminMongo.diagnostics({} as never, response as never);
    response.statusCode.should.equal(503);
    assert.deepEqual(response.body, {
      message: 'MongoDB diagnostics are unavailable.',
    });
  });
});
