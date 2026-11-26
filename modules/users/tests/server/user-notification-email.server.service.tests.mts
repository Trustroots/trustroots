import { notificationEmail } from '../../../core/server/services/notification-email-envelope.server.service.mts';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import mongoose from 'mongoose';
import sinon from 'sinon';
import config from '../../../../config/config.mts';
import {
  confirmUnsubscribe,
  canDeliverNotificationEmail,
} from '../../server/services/notification-email.server.service.mts';

type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;
const User = mongoose.model<UserRecord>('User');

describe('Notification email unsubscribe service', function () {
  afterEach(async function () {
    sinon.restore();
    await User.deleteMany({ username: 'notificationservicefixture' });
  });

  it('stores the exact opt-out preference for each signed email category', async function () {
    const user = await User.create({
      firstName: 'Sample',
      lastName: 'Member',
      username: 'notificationservicefixture',
      email: 'notificationservice@example.test',
      provider: 'local',
      password: 'Fict1onal!member',
      public: true,
      messageEmailFrequency: 'weekly',
      hostingReminderEmails: true,
    });
    const token = (category: 'messages' | 'hosting') => {
      const link = notificationEmail(user, category);
      return new URL(link.unsubscribeUrl!).pathname.split('/').at(-1)!;
    };
    const messageToken = token('messages');
    const expectedMessageSignature = createHmac('sha256', config.sessionSecret)
      .update(
        JSON.stringify([
          'email-unsubscribe',
          String(user._id),
          'messages',
          user.email,
        ]),
      )
      .digest('hex');
    assert.equal(
      messageToken,
      `${String(user._id)}.messages.${expectedMessageSignature}`,
    );

    const findById = sinon.spy(User, 'findById');
    const updateOne = sinon.spy(User, 'updateOne');
    assert.equal(await confirmUnsubscribe(messageToken), true);
    assert.equal(findById.firstCall.args[1], 'email');
    assert.deepEqual(updateOne.firstCall.args[0], {
      _id: String(user._id),
      email: user.email,
    });
    let preferences = await User.findById(user._id)
      .select('messageEmailFrequency hostingReminderEmails')
      .lean()
      .exec();
    assert.equal(preferences?.messageEmailFrequency, 'off');
    assert.equal(preferences?.hostingReminderEmails, true);

    assert.equal(await confirmUnsubscribe(token('hosting')), true);
    assert.equal(findById.thirdCall.args[1], 'email');
    assert.deepEqual(updateOne.secondCall.args[0], {
      _id: String(user._id),
      email: user.email,
    });
    preferences = await User.findById(user._id)
      .select('messageEmailFrequency hostingReminderEmails')
      .lean()
      .exec();
    assert.equal(preferences?.messageEmailFrequency, 'off');
    assert.equal(preferences?.hostingReminderEmails, false);
  });

  it('reports failure when the address changes before the preference update matches', async function () {
    const user = await User.create({
      firstName: 'Sample',
      lastName: 'Member',
      username: 'notificationservicefixture',
      email: 'notificationservice@example.test',
      provider: 'local',
      password: 'Fict1onal!member',
      public: true,
    });
    const link = notificationEmail(user, 'messages');
    const token = new URL(link.unsubscribeUrl!).pathname.split('/').at(-1)!;
    sinon.stub(User, 'updateOne').resolves({ matchedCount: 0 } as never);

    assert.equal(await confirmUnsubscribe(token), false);
  });

  it('loads only the fields needed to validate a queued notification', async function () {
    const user = await User.create({
      firstName: 'Sample',
      lastName: 'Member',
      username: 'notificationservicefixture',
      email: 'notificationservice@example.test',
      provider: 'local',
      password: 'Fict1onal!member',
      public: true,
      messageEmailFrequency: 'weekly',
    });
    const findById = sinon.spy(User, 'findById');
    const mail = notificationEmail(user, 'messages', 'weekly');

    assert.equal(
      await canDeliverNotificationEmail(mail.notificationEmail!, user.email!),
      true,
    );
    assert.equal(
      findById.firstCall.args[1],
      'email messageEmailFrequency hostingReminderEmails',
    );
  });
});
