import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { mailMode } from '../../../../config/config.mts';
import sinon from 'sinon';
import {
  recoverEmailJobName,
  sendEmailJobName,
} from '../../../../config/lib/mail-queue.mts';
import { queueHealth } from '../../server/controllers/admin.email.server.controller.mts';

describe('Admin email queue health', () => {
  const db = mongoose.connection.db!;
  const jobs = db.collection('agendaJobs');

  afterEach(() => sinon.restore());

  it('reports current aggregates without job data', async () => {
    const now = new Date();
    const { insertedIds } = await jobs.insertMany([
      {
        name: sendEmailJobName,
        nextRunAt: now,
        failCount: 1,
        data: { to: 'fictional@example.test', text: 'Private fixture' },
      },
      { name: recoverEmailJobName, type: 'single', lastFinishedAt: now },
    ]);

    const json = sinon.spy();
    const set = sinon.spy();
    try {
      await queueHealth({} as Request, { json, set } as unknown as Response);
      sinon.assert.calledWithExactly(set, 'Cache-Control', 'no-store');
      sinon.assert.calledOnce(json);
      const snapshot = json.firstCall.firstArg;
      assert.ok(Date.parse(snapshot.capturedAt) >= now.getTime());
      assert.equal(snapshot.mailMode, mailMode);
      assert.ok(snapshot.queued >= 1);
      assert.ok(snapshot.retrying >= 1);
      assert.equal(snapshot.workerHealthy, true);
      assert.ok(!JSON.stringify(snapshot).includes('fictional@example.test'));
    } finally {
      await jobs.deleteMany({ _id: { $in: Object.values(insertedIds) } });
    }
  });

  it('returns a sanitised unavailable response without a database connection', async () => {
    sinon.stub(mongoose.connection, 'db').value(undefined);
    const json = sinon.spy();
    const status = sinon.stub().returns({ json });

    await queueHealth(
      {} as Request,
      {
        set: sinon.spy(),
        status,
      } as unknown as Response,
    );
    sinon.assert.calledWithExactly(status, 503);
    sinon.assert.calledWithExactly(json, {
      message: 'Email queue health is unavailable.',
    });
  });

  it('returns a sanitised unavailable response when the query fails', async () => {
    sinon.stub(db, 'collection').throws(new Error('Private fixture'));
    const json = sinon.spy();
    const status = sinon.stub().returns({ json });

    await queueHealth(
      {} as Request,
      {
        set: sinon.spy(),
        status,
      } as unknown as Response,
    );
    sinon.assert.calledWithExactly(status, 503);
    sinon.assert.calledWithExactly(json, {
      message: 'Email queue health is unavailable.',
    });
  });
});
