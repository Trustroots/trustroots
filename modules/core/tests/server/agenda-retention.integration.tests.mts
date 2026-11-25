import assert from 'node:assert/strict';
import type { Collection, Document } from 'mongodb';
import mongoose from 'mongoose';
import sinon from 'sinon';
import { pruneAgendaDeliveryJobs } from '../../../../config/lib/agenda-retention.mts';

describe('Agenda delivery retention', function () {
  const now = new Date('2026-04-01T00:00:00Z');
  const cutoff = new Date('2026-01-01T00:00:00Z');
  const old = new Date('2025-12-31T23:59:59Z');
  const terminal = { name: 'send email', lastFinishedAt: old };
  let jobs: Collection<Document>;

  beforeEach(function () {
    jobs = mongoose.connection.db!.collection('agendaDeliveryRetentionTests');
  });

  afterEach(async function () {
    sinon.restore();
    await jobs.deleteMany({});
  });

  it('prunes old delivery history and preserves actionable and recent jobs', async function () {
    const eligible = [
      { ...terminal },
      { ...terminal, name: 'send push message' },
      { ...terminal, failedAt: old, lockedAt: null, nextRunAt: null },
      { name: 'send email', failedAt: old },
    ];
    const protectedJobs = [
      { ...terminal, lastFinishedAt: cutoff },
      { ...terminal, failedAt: now },
      { ...terminal, nextRunAt: now },
      { ...terminal, failedAt: old, nextRunAt: now },
      { ...terminal, lockedAt: old },
      { ...terminal, disabled: true },
      { ...terminal, repeatInterval: '1 day' },
      { ...terminal, repeatAt: '3am' },
      { ...terminal, type: 'single' },
      { ...terminal, name: 'send experience reply reminder' },
      { name: 'send email' },
    ];
    const { insertedIds } = await jobs.insertMany([
      ...eligible,
      ...protectedJobs,
    ]);

    assert.equal(await pruneAgendaDeliveryJobs(jobs, now), eligible.length);
    const remaining = await jobs.find({}, { projection: { _id: 1 } }).toArray();
    assert.deepEqual(
      new Set(remaining.map(job => job._id)),
      new Set(Object.values(insertedIds).slice(eligible.length)),
    );
  });

  it('caps each run and resumes on a subsequent run', async function () {
    await jobs.insertMany(
      Array.from({ length: 5001 }, () => ({ ...terminal })),
    );

    assert.equal(await pruneAgendaDeliveryJobs(jobs, now), 5000);
    assert.equal(await pruneAgendaDeliveryJobs(jobs, now), 1);
    assert.equal(await pruneAgendaDeliveryJobs(jobs, now), 0);
  });

  it('preserves a candidate rescheduled before deletion', async function () {
    const { insertedId } = await jobs.insertOne({ ...terminal });
    const deleteMany = jobs.deleteMany.bind(jobs);
    sinon.stub(jobs, 'deleteMany').callsFake(async (filter, options) => {
      await jobs.updateOne({ _id: insertedId }, { $set: { nextRunAt: now } });
      return deleteMany(filter, options);
    });

    assert.equal(await pruneAgendaDeliveryJobs(jobs, now), 0);
    assert.ok(await jobs.findOne({ _id: insertedId, nextRunAt: now }));
  });
});
