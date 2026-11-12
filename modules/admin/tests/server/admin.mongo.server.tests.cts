const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
require('should');
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

  afterEach(async () => {
    sinon.restore();
    await agenda.deleteMany({});
    await archived.deleteMany({});
  });

  it('reports live Mongo metadata, storage statistics and grouped Agenda states', async () => {
    await agenda.insertMany([
      { name: 'sample', nextRunAt: new Date('2026-11-12T12:00:00Z') },
      { name: 'sample', disabled: true },
      { name: 'other', lastFinishedAt: new Date('2026-11-12T11:00:00Z') },
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
    jobs
      .find(job => job.name === 'sample')!
      .counts.should.deepEqual({
        queued: 1,
        disabled: 1,
      });
    jobs
      .find(job => job.name === 'other')!
      .counts.should.deepEqual({
        completed: 1,
      });
    response.headers['Cache-Control'].should.equal('no-store');
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
                    count: 1,
                    storageSize: 10,
                    totalIndexSize: 2,
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
          aggregate: () => ({ toArray: async () => rows }),
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
    list.calledOnce.should.equal(true);
    collection.callCount.should.equal(3);
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
