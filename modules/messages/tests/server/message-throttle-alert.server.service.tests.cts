import type { MessageThrottleAlertRecord } from '../../server/models/message-throttle-alert.server.model.mts';
import type { RenderedEmail } from '../../../core/server/services/email.server.service.mts';

const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mongoose = require('mongoose') as typeof import('mongoose');
const sinon = require('sinon') as typeof import('sinon');
const agenda =
  require('../../../../config/lib/agenda.mjs') as import('agenda').Agenda;
const config =
  require('../../../../config/config.mts') as typeof import('../../../../config/config.mts').default;
const alerts =
  require('../../server/services/message-throttle-alert.server.service.mts')
    .default as typeof import('../../server/services/message-throttle-alert.server.service.mts').default;
const emailService =
  require('../../../core/server/services/email.server.service.mts') as typeof import('../../../core/server/services/email.server.service.mts').default;
const Alert = mongoose.model<MessageThrottleAlertRecord>(
  'MessageThrottleAlert',
);

describe('Message throttle support alerts', () => {
  const user = {
    _id: new mongoose.Types.ObjectId(),
    username: 'fictional-member',
  };
  let queued: RenderedEmail[];

  beforeEach(() => {
    queued = [];
    sinon.stub(agenda, 'now').callsFake(async (_name, data) => {
      queued.push(data as RenderedEmail);
      return { attrs: { name: 'send email' } } as import('agenda').Job;
    });
  });

  afterEach(async () => {
    sinon.restore();
    await Alert.deleteMany({});
  });

  it('queues a plain-text support email with review metadata only', async () => {
    const before = Date.now();
    await alerts.notify(user, 16);
    assert.equal(queued.length, 1);
    const mail = queued[0]!;
    assert.equal(mail.to.address, config.supportEmail);
    assert.equal(mail.subject, 'Member reached the messaging recipient limit');
    assert.equal(mail.html, undefined);
    assert.ok(mail.text.includes('@fictional-member'));
    assert.ok(mail.text.includes(`/admin/user?id=${user._id}`));
    assert.ok(
      mail.text.includes('Distinct recipients in the current window: 16'),
    );
    assert.ok(
      mail.text.includes(
        `Configured recipient limit: ${config.limits.messagesToIndividualsThrottle.count}`,
      ),
    );
    assert.ok(mail.text.includes('Time (UTC): '));
    assert.ok(mail.text.includes('Configured window (minutes): 60'));
    const record = await Alert.findById(user._id).orFail();
    assert.ok(record.nextAlertAt.getTime() >= before + 24 * 60 * 60 * 1000);
  });

  it('deduplicates simultaneous and repeated hits across the full rolling window', async () => {
    await Promise.all(
      Array.from({ length: 12 }, () => alerts.notify(user, 16)),
    );
    await alerts.notify(user, 17);
    assert.equal(queued.length, 1);
    // A different sender has an independent cooldown.
    await alerts.notify({ ...user, _id: new mongoose.Types.ObjectId() }, 18);
    assert.equal(queued.length, 2);
    await Alert.updateOne(
      { _id: user._id },
      { $set: { nextAlertAt: new Date(Date.now() - 1) } },
    );
    await alerts.notify(user, 19);
    assert.equal(queued.length, 3);
    assert.ok(queued[2]!.text.includes('current window: 19'));
  });

  it('uses HTTPS for admin links on HTTPS deployments', async () => {
    sinon.stub(config, 'https').value(true);
    await alerts.notify(user, 16);
    assert.ok(
      queued[0]!.text.includes(
        `https://${config.domain}/admin/user?id=${user._id}`,
      ),
    );
  });

  it('allows a later hit to retry after a queue failure', async () => {
    const error = new Error('Queue unavailable');
    sinon
      .stub(emailService, 'renderEmailAndSend')
      .onFirstCall()
      .callsFake((_template, _params, callback) => callback(error));
    await assert.rejects(alerts.notify(user, 16), error);
    assert.equal(await Alert.countDocuments({}), 0);
    sinon.restore();
    const send = sinon
      .stub(emailService, 'renderEmailAndSend')
      .callsFake((_template, _params, callback) => callback());
    await alerts.notify(user, 16);
    assert.equal(send.callCount, 1);
  });

  it('propagates claim storage errors without queuing mail', async () => {
    const error = new Error('Storage unavailable');
    sinon.stub(Alert, 'findOneAndUpdate').rejects(error);
    await assert.rejects(alerts.notify(user, 16), error);
    assert.equal(queued.length, 0);
  });

  it('does not release a newer claim when a delayed queue operation fails', async () => {
    const newerClaim = new mongoose.Types.ObjectId();
    const error = new Error('Delayed queue failure');
    sinon
      .stub(emailService, 'renderEmailAndSend')
      .callsFake((_template, _params, callback) => {
        Alert.updateOne(
          { _id: user._id },
          { $set: { claim: newerClaim } },
        ).then(() => callback(error), callback);
      });
    await assert.rejects(alerts.notify(user, 16), error);
    assert.equal(
      (await Alert.findById(user._id).orFail()).claim.toString(),
      newerClaim.toString(),
    );
  });
});
