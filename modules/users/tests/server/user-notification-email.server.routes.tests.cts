const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const config: import('../../../../testutils/server/model-contracts.mts').TestConfigModule = require('../../../../config/config.mts');
const express: import('../../../../testutils/server/model-contracts.mts').TestExpressModule = require('../../../../config/lib/express.mjs');
const {
  notificationEmail,
  canDeliverNotificationEmail,
}: typeof import('../../server/services/notification-email.server.service.mts') = require('../../server/services/notification-email.server.service.mts');

type UserRecord =
  import('../../server/models/user.server.types.mts').UserServerRecord;
const User = mongoose.model<UserRecord>('User');

describe('Optional email unsubscribe route', function () {
  afterEach(async function () {
    await User.deleteMany({
      username: { $in: ['sampleemailmember', 'examplemember'] },
    });
  });

  it('uses HTTPS links when the site uses HTTPS', function () {
    const https = sinon.stub(config, 'https').value(true);
    try {
      const email = notificationEmail(
        { _id: new mongoose.Types.ObjectId(), email: 'member@example.test' },
        'hosting',
      );
      assert.equal(new URL(email.unsubscribeUrl!).protocol, 'https:');
    } finally {
      https.restore();
    }
  });

  it('requires both the member ID and address to generate an unsubscribe link', function () {
    assert.deepEqual(
      notificationEmail({ email: 'member@example.test' }, 'hosting'),
      {},
    );
    assert.deepEqual(
      notificationEmail({ _id: new mongoose.Types.ObjectId() }, 'hosting'),
      {},
    );
  });

  it('rechecks queued addresses and uses the default on profiles without a preference', async function () {
    const user = await User.create({
      firstName: 'Sample',
      lastName: 'Member',
      username: 'sampleemailmember',
      email: 'samplemember@example.test',
      provider: 'local',
      password: 'Fict1onal!member',
      public: true,
    });
    const mail = notificationEmail(user, 'messages', 'immediate');
    const notification = mail.notificationEmail!;

    await User.updateOne(
      { _id: user._id },
      { $unset: { messageEmailFrequency: 1 } },
    );
    assert.equal(
      await canDeliverNotificationEmail(notification, user.email),
      true,
    );
    assert.equal(
      await canDeliverNotificationEmail(notification, undefined),
      false,
    );

    await User.updateOne(
      { _id: user._id },
      { $set: { email: 'newaddress@example.test' } },
    );
    assert.equal(
      await canDeliverNotificationEmail(notification, user.email),
      false,
    );

    const app = await express.init(mongoose.connection);
    const path = new URL(mail.unsubscribeUrl!).pathname;
    await request(app).post(path).expect(400);

    await User.deleteOne({ _id: user._id });
    assert.equal(
      await canDeliverNotificationEmail(notification, user.email),
      false,
    );
    await request(app).post(path).expect(400);
  });

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

    const messagesResponse = await agent.get(messages).expect(200);
    assert.equal(messagesResponse.headers['cache-control'], 'no-store');
    assert.equal(messagesResponse.headers['referrer-policy'], 'strict-origin');
    assert.ok(
      messagesResponse.text.startsWith(
        '<!doctype html><html lang="en"><meta charset="utf-8">',
      ),
    );
    assert.ok(
      messagesResponse.text.includes(
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
      ),
    );
    assert.ok(
      messagesResponse.text.includes(
        '<title>Email preferences · Trustroots</title>',
      ),
    );
    assert.ok(
      messagesResponse.text.includes('<main><h1>Email preferences</h1>'),
    );
    assert.ok(
      messagesResponse.text.includes(
        '<p>Stop receiving unread-message emails from Trustroots?</p>',
      ),
    );
    assert.ok(
      messagesResponse.text.includes(
        '<form method="post"><button type="submit">Unsubscribe</button></form>',
      ),
    );
    assert.ok(messagesResponse.text.endsWith('</main></html>'));
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
    const invalidResponse = await agent
      .get('/email/unsubscribe/invalid')
      .expect(400);
    assert.ok(
      invalidResponse.text.includes(
        '<p>This unsubscribe link is invalid. You can change your email preferences in Account settings.</p>',
      ),
    );
    await agent.post('/email/unsubscribe/invalid').expect(400);
  });
});
