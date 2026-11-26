import assert from 'node:assert/strict';
import { MongoBackend } from '@agendajs/mongo-backend';
import mongoose from 'mongoose';
import { afterEach, test, vi } from 'vitest';
import { findDeploymentNotificationAddresses } from '../../../../config/lib/deployment-notification-recipients.mts';
import {
  deploymentNotificationJob,
  queueDeploymentNotifications,
  readDeploymentSuccessReceipt,
} from '../../../../config/lib/deployment-notifications.mts';
import { clearDatabase } from '../../../../testutils/server/data.server.testutil.mts';

afterEach(clearDatabase);

const receipt = readDeploymentSuccessReceipt(
  JSON.stringify({
    schemaVersion: 1,
    status: 'succeeded',
    eventId: '11111111-2222-4333-8444-555555555555',
    action: 'deploy',
    origin: 'https://www.trustroots.org',
    buildCommit: 'c'.repeat(40),
    readinessSucceededAt: '2026-01-02T03:04:05+00:00',
  }),
);
const from = 'trustroots@example.test';

afterEach(async () => {
  const db = mongoose.connection.db!;
  await db.collection('deploymentNotifications').deleteMany({});
  await db
    .collection('agendaJobs')
    .deleteMany({ name: deploymentNotificationJob });
});

test('deployment recipients are active greeters and admins with unique valid addresses', async () => {
  const db = mongoose.connection.db!;
  const users = db.collection('users');
  await users.insertMany(
    [
      { email: ' Greeter@example.org ', public: true, roles: ['welcome-team'] },
      { email: 'greeter@example.org', public: true, roles: ['admin'] },
      {
        email: 'both@example.org',
        public: true,
        roles: ['admin', 'welcome-team'],
      },
      { email: 'admin@example.org', public: true, roles: ['admin'] },
      { email: 'member@example.org', public: true, roles: ['user'] },
      {
        email: 'suspended@example.org',
        public: true,
        roles: ['admin', 'suspended'],
      },
      { email: 'unconfirmed@example.org', public: false, roles: ['admin'] },
      { email: 'legacy@example.org', roles: ['welcome-team'] },
      { email: 'invalid', public: true, roles: ['admin'] },
      { email: 42, public: true, roles: ['admin'] },
      {
        email: 'first@example.org,second@example.org',
        public: true,
        roles: ['admin'],
      },
    ].map((user, index) => ({ ...user, username: `recipient-${index}` })),
  );
  const removed = await users.insertOne({
    email: 'removed@example.org',
    username: 'removed-recipient',
    public: true,
    roles: ['welcome-team'],
  });
  await users.deleteOne({ _id: removed.insertedId });

  assert.deepEqual(
    await findDeploymentNotificationAddresses(db),
    new Set(['greeter@example.org', 'both@example.org', 'admin@example.org']),
  );
});

test('concurrent handoffs keep one Agenda job per destination and receipt', async () => {
  const db = mongoose.connection.db!;
  await db.collection('users').insertOne({
    username: 'fictional-greeter',
    email: 'greeter@example.test',
    public: true,
    roles: ['welcome-team', 'admin'],
  });
  assert.deepEqual(
    await Promise.all(
      Array.from({ length: 4 }, () =>
        queueDeploymentNotifications(db, receipt, from),
      ),
    ),
    [1, 1, 1, 1],
  );
  const collection = db.collection('agendaJobs');
  const jobs = await collection
    .find({ deploymentEventId: receipt.eventId })
    .toArray();
  assert.equal(jobs.length, 1);
  const backend = new MongoBackend({ mongo: db, ensureIndex: false });
  await backend.connect();
  try {
    const job = await backend.repository.getJobById(jobs[0]._id.toHexString());
    assert.equal(job?.name, deploymentNotificationJob);
    assert.ok(job.nextRunAt instanceof Date);
    assert.deepEqual(job.data, {
      to: { address: 'greeter@example.test' },
      from: { name: 'Trustroots', address: from },
      subject: 'Trustroots production deployment verified',
      text: [
        'The Trustroots production deployment passed readiness and login checks.',
        '',
        `Deployed commit: https://github.com/Trustroots/trustroots/commit/${receipt.buildCommit}`,
        `Readiness verified at: ${receipt.readinessSucceededAt} (UTC)`,
        'Mail mode: live',
      ].join('\n'),
    });
  } finally {
    await backend.disconnect();
  }
  await assert.rejects(
    queueDeploymentNotifications(db, { ...receipt, action: 'rollback' }, from),
    /conflicts with saved notification progress/,
  );
  const redeploy = {
    ...receipt,
    eventId: '11111111-2222-4333-8444-555555555556',
  };
  await queueDeploymentNotifications(db, redeploy, from);
  assert.equal(
    await collection.countDocuments({ name: deploymentNotificationJob }),
    2,
  );
});

test('a duplicate-key race on progress insert rereads the saved snapshot', async () => {
  const db = mongoose.connection.db!;
  await db.collection('users').insertOne({
    username: 'race-greeter',
    email: 'race@example.test',
    public: true,
    roles: ['welcome-team'],
  });
  const events = db.collection<{
    _id: string;
    origin: string;
    action: string;
    buildCommit: string;
    readinessSucceededAt: string;
    addresses: string[];
    queuedCount: number;
  }>('deploymentNotifications');
  // Another concurrent writer already inserted the progress document.
  await events.insertOne({
    _id: receipt.eventId,
    origin: receipt.origin,
    action: receipt.action,
    buildCommit: receipt.buildCommit,
    readinessSucceededAt: receipt.readinessSucceededAt,
    addresses: ['race@example.test'],
    queuedCount: 0,
  });
  // queueDeploymentNotifications calls db.collection() again; reuse this
  // instance so the spies below actually intercept the race path.
  const originalCollection = db.collection.bind(db);
  const collection = vi
    .spyOn(db, 'collection')
    .mockImplementation(((name: string, options?: object) =>
      name === 'deploymentNotifications'
        ? events
        : originalCollection(name as never, options as never)) as never);
  const findOne = vi.spyOn(events, 'findOne').mockResolvedValueOnce(null);
  const findOneAndUpdate = vi
    .spyOn(events, 'findOneAndUpdate')
    .mockRejectedValueOnce(
      Object.assign(new Error('E11000 duplicate key'), { code: 11000 }),
    );
  try {
    assert.equal(await queueDeploymentNotifications(db, receipt, from), 1);
    assert.equal(findOneAndUpdate.mock.calls.length, 1);
    assert.ok(findOne.mock.calls.length >= 2);
  } finally {
    findOne.mockRestore();
    findOneAndUpdate.mockRestore();
    collection.mockRestore();
  }
  assert.equal(
    await db.collection('agendaJobs').countDocuments({
      deploymentEventId: receipt.eventId,
    }),
    1,
  );
});

test('progress insert failures other than duplicate keys still reject', async () => {
  const db = mongoose.connection.db!;
  await db.collection('users').insertOne({
    username: 'fail-greeter',
    email: 'fail@example.test',
    public: true,
    roles: ['admin'],
  });
  const events = db.collection<{ _id: string }>('deploymentNotifications');
  const originalCollection = db.collection.bind(db);
  const collection = vi
    .spyOn(db, 'collection')
    .mockImplementation(((name: string, options?: object) =>
      name === 'deploymentNotifications'
        ? events
        : originalCollection(name as never, options as never)) as never);
  const findOne = vi.spyOn(events, 'findOne').mockResolvedValueOnce(null);
  const findOneAndUpdate = vi
    .spyOn(events, 'findOneAndUpdate')
    .mockRejectedValueOnce(new Error('write unavailable'));
  try {
    await assert.rejects(
      queueDeploymentNotifications(db, receipt, from),
      /write unavailable/,
    );
  } finally {
    findOne.mockRestore();
    findOneAndUpdate.mockRestore();
    collection.mockRestore();
  }
});

test('a resumed handoff keeps its snapshot and does not reschedule an inserted job', async () => {
  const db = mongoose.connection.db!;
  const users = db.collection('users');
  await users.insertMany([
    {
      username: 'first',
      email: 'first@example.test',
      public: true,
      roles: ['admin'],
    },
    {
      username: 'second',
      email: 'second@example.test',
      public: true,
      roles: ['welcome-team'],
    },
  ]);
  const jobs = db.collection('agendaJobs');
  const events = db.collection('deploymentNotifications');
  const collection = vi.spyOn(db, 'collection').mockReturnValueOnce(events);
  const progressWrite = vi
    .spyOn(events, 'updateOne')
    .mockRejectedValueOnce(new Error('Interrupted'));
  try {
    await assert.rejects(
      queueDeploymentNotifications(db, receipt, from),
      /Interrupted/,
    );
  } finally {
    collection.mockRestore();
    progressWrite.mockRestore();
  }
  const query = { deploymentEventId: receipt.eventId };
  const inserted = await jobs.findOne(query);
  assert.ok(inserted);
  // The worker may have already processed the insert before progress was recorded.
  const lastFinishedAt = new Date();
  await jobs.updateOne(
    { _id: inserted._id },
    { $set: { nextRunAt: null, lastFinishedAt } },
  );
  await users.updateOne(
    { username: 'second' },
    { $set: { email: 'changed@example.test' } },
  );
  assert.equal(await queueDeploymentNotifications(db, receipt, from), 2);
  const queued = await jobs
    .find(query)
    .sort({ 'data.to.address': 1 })
    .toArray();
  assert.deepEqual(
    queued.map(job => job.data.to.address),
    ['first@example.test', 'second@example.test'],
  );
  assert.equal(queued[0]._id.toHexString(), inserted._id.toHexString());
  assert.equal(queued[0].nextRunAt, null);
  assert.deepEqual(queued[0].lastFinishedAt, lastFinishedAt);
  await jobs.deleteOne({ _id: inserted._id });
  assert.equal(await queueDeploymentNotifications(db, receipt, from), 2);
  assert.equal(await jobs.countDocuments(query), 1);
});
