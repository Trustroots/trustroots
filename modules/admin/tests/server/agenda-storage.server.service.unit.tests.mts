import assert from 'node:assert/strict';
import sinon from 'sinon';
import {
  captureAgendaStorage,
  captureAgendaStorageJob,
  readAgendaStorageHistory,
} from '../../server/services/agenda-storage.server.service.mts';
describe('Agenda storage service', () => {
  afterEach(() => sinon.restore());

  it('uses its scheduled job name and bounds cleanup operations', async () => {
    assert.equal(captureAgendaStorageJob, 'capture agenda storage');

    const history = {
      deleteMany: sinon.stub().resolves(),
      updateOne: sinon.stub().resolves(),
    };
    const collection = {
      aggregate: sinon.stub().returns({
        toArray: async () => [
          { storageStats: { count: 2, storageSize: 20, totalIndexSize: 5 } },
        ],
      }),
    };
    const db = {
      collection: (name: string) =>
        name === 'agendaStorageSnapshots' ? history : collection,
      listCollections: sinon.stub().returns({
        toArray: async () => [
          { name: 'agendaJobs' },
          { name: 'agendaJobsArchived' },
        ],
      }),
    };
    const now = new Date('2025-03-30T12:00:00.000Z');

    await captureAgendaStorage(db as never, now);

    assert.deepEqual(history.deleteMany.firstCall.args, [
      { _id: { $lt: '2025-03-01' } },
      { timeoutMS: 5_000 },
    ]);
  });

  it('queries only the retained UTC date range in newest first order', async () => {
    const toArray = sinon.stub().resolves([]);
    const find = sinon.stub().returns({ toArray });
    const db = {
      collection: sinon.stub().returns({ find }),
    };
    const now = new Date('2025-03-30T12:00:00.000Z');

    await readAgendaStorageHistory(db as never, now);

    assert.deepEqual(find.firstCall.args, [
      { _id: { $gte: '2025-03-01', $lte: '2025-03-30' } },
      {
        projection: { _id: 0 },
        sort: { _id: -1 },
        limit: 30,
        maxTimeMS: 5_000,
      },
    ]);
  });
});
