const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const {
  notificationEmail,
  canDeliverNotificationEmail,
}: typeof import('../../server/services/notification-email.server.service.mts') = require('../../server/services/notification-email.server.service.mts');

type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;
const User = mongoose.model<UserRecord>('User');

describe('Optional email unsubscribe route', function () {
  it('changes only the signed category after confirmation, without a session', async function () {
    const app = await express.init(mongoose.connection);
    const user = await User.create({
      firstName: 'Example',
      lastName: 'Member',
      username: 'examplemember',
      email: 'examplemember@example.test',
      provider: 'local',
      password: 'Fict1onal!member',
      public: true,
      messageEmailFrequency: 'weekly',
    });
    const messageMail = notificationEmail(user, 'messages', 'weekly');
    const hostingMail = notificationEmail(user, 'hosting');
    const messages = new URL(messageMail.unsubscribeUrl!).pathname;
    const hosting = new URL(hostingMail.unsubscribeUrl!).pathname;
    const agent = request(app);

    await agent
      .get(messages)
      .expect(200)
      .expect(/Stop receiving unread-message emails/);
    assert.equal(
      await canDeliverNotificationEmail(
        messageMail.notificationEmail!,
        user.email!,
      ),
      true,
    );
    await agent.post(messages.replace('.messages.', '.hosting.')).expect(400);
    await agent
      .post(messages)
      .expect(200)
      .expect(/You have unsubscribed/);
    await agent.post(messages).expect(200);
    assert.equal(
      await canDeliverNotificationEmail(
        messageMail.notificationEmail!,
        user.email!,
      ),
      false,
    );
    assert.equal(
      await canDeliverNotificationEmail(
        hostingMail.notificationEmail!,
        user.email!,
      ),
      true,
    );

    await agent
      .get(hosting)
      .expect(200)
      .expect(/Stop receiving hosting reminders/);
    await agent.post(hosting).expect(200);
    assert.equal(
      await canDeliverNotificationEmail(
        hostingMail.notificationEmail!,
        user.email!,
      ),
      false,
    );
    await agent.get('/email/unsubscribe/invalid').expect(400);
    await agent.post('/email/unsubscribe/invalid').expect(400);
  });
});
