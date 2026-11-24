import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import sinon from 'sinon';
import agenda from '../../../../config/lib/agenda.mts';
import config from '../../../../config/config.mts';
import emailService, {
  type RenderedEmail,
} from '../../../core/server/services/email.server.service.mts';
import type {
  MessageThrottleAlertRecord,
  MessageThrottleReviewRecord,
} from '../../server/models/message-throttle-alert.server.model.mts';

import alerts from '../../server/services/message-throttle-alert.server.service.mts';

const Alert = mongoose.model<MessageThrottleAlertRecord>(
  'MessageThrottleAlert',
);
const Review = mongoose.model<MessageThrottleReviewRecord>(
  'MessageThrottleReview',
);
const window = {
  windowStart: new Date('2026-01-01T14:03:00.000Z'),
  windowEnd: new Date('2026-01-01T15:03:00.000Z'),
};

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
    await Review.deleteMany({});
  });

  it('queues a plain-text support email with review metadata only', async () => {
    const before = Date.now();
    await alerts.notify(user, 16, window);
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
    assert.ok(
      mail.text.includes(`Time (UTC): ${window.windowEnd.toISOString()}`),
    );
    assert.ok(mail.text.includes('Configured window (minutes): 60'));
    const record = await Alert.findById(user._id).orFail();
    const review = await Review.findById(record.claim).orFail();
    assert.ok(
      mail.text.includes(`/admin/support/message-reviews/${review._id}`),
    );
    assert.ok(review.sender.equals(user._id));
    assert.deepEqual(review.windowStart, window.windowStart);
    assert.deepEqual(review.windowEnd, window.windowEnd);
    assert.ok(record.nextAlertAt.getTime() >= before + 24 * 60 * 60 * 1000);
  });

  it('deduplicates simultaneous and repeated hits across the full rolling window', async () => {
    await Promise.all(
      Array.from({ length: 12 }, () => alerts.notify(user, 16, window)),
    );
    await alerts.notify(user, 17, window);
    assert.equal(queued.length, 1);
    assert.equal(await Review.countDocuments({ sender: user._id }), 1);
    const firstReview = await Review.findOne({ sender: user._id }).orFail();
    // A different sender has an independent cooldown.
    await alerts.notify(
      { ...user, _id: new mongoose.Types.ObjectId() },
      18,
      window,
    );
    assert.equal(queued.length, 2);
    await Alert.updateOne(
      { _id: user._id },
      { $set: { nextAlertAt: new Date(Date.now() - 1) } },
    );
    const laterWindow = {
      windowStart: new Date('2026-01-02T14:03:00.000Z'),
      windowEnd: new Date('2026-01-02T15:03:00.000Z'),
    };
    await alerts.notify(user, 19, laterWindow);
    assert.equal(queued.length, 3);
    assert.ok(queued[2]!.text.includes('current window: 19'));
    const laterClaim = (await Alert.findById(user._id).orFail()).claim;
    assert.ok(!laterClaim.equals(firstReview._id));
    assert.deepEqual(
      (await Review.findById(laterClaim).orFail()).windowEnd,
      laterWindow.windowEnd,
    );
    assert.deepEqual(
      (await Review.findById(firstReview._id).orFail()).windowEnd,
      window.windowEnd,
    );
  });

  it('uses HTTPS for admin links on HTTPS deployments', async () => {
    sinon.stub(config, 'https').value(true);
    await alerts.notify(user, 16, window);
    assert.ok(
      queued[0]!.text.includes(
        `https://${config.domain}/admin/user?id=${user._id}`,
      ),
    );
    assert.ok(
      queued[0]!.text.includes(
        `https://${config.domain}/admin/support/message-reviews/`,
      ),
    );
  });

  it('passes sender, campaign and an HTTP admin link to the email renderer on HTTP deployments', async () => {
    sinon.stub(config, 'https').value(false);
    const send = sinon
      .stub(emailService, 'renderEmailAndSend')
      .callsFake((_template, _params, callback) => callback());
    await alerts.notify(user, 16, window);
    const [template, params] = send.firstCall.args as [
      string,
      Record<string, unknown>,
      unknown,
    ];
    assert.equal(template, 'message-throttle-alert');
    assert.equal(params.from, `Trustroots Support <${config.supportEmail}>`);
    assert.equal(params.sparkpostCampaign, 'message-throttle-alert');
    assert.equal(
      params.adminProfileUrl,
      `http://${config.domain}/admin/user?id=${user._id}`,
    );
  });

  it('allows a later hit to retry after a queue failure', async () => {
    const error = new Error('Queue unavailable');
    sinon
      .stub(emailService, 'renderEmailAndSend')
      .onFirstCall()
      .callsFake((_template, _params, callback) => callback(error));
    await assert.rejects(alerts.notify(user, 16, window), error);
    assert.equal(await Alert.countDocuments({}), 0);
    const saved = await Review.findOne({ sender: user._id }).orFail();
    sinon.restore();
    const send = sinon
      .stub(emailService, 'renderEmailAndSend')
      .callsFake((_template, _params, callback) => callback());
    await alerts.notify(user, 16, window);
    assert.equal(send.callCount, 1);
    assert.ok(await Review.exists({ _id: saved._id }));
  });

  it('propagates claim storage errors without queuing mail', async () => {
    const error = new Error('Storage unavailable');
    sinon.stub(Alert, 'findOneAndUpdate').rejects(error);
    await assert.rejects(alerts.notify(user, 16, window), error);
    assert.equal(queued.length, 0);
  });

  it('releases the alert claim when saving the review fails', async () => {
    const error = new Error('Review storage unavailable');
    sinon.stub(Review, 'create').rejects(error);
    await assert.rejects(alerts.notify(user, 16, window), error);
    assert.equal(queued.length, 0);
    assert.equal(await Alert.countDocuments({}), 0);
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
    await assert.rejects(alerts.notify(user, 16, window), error);
    assert.equal(
      (await Alert.findById(user._id).orFail()).claim.toString(),
      newerClaim.toString(),
    );
  });
});
