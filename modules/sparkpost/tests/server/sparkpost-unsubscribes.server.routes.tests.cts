import type { UserServerRecord } from '../../../users/server/models/user.server.types.mts';

const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const should: typeof import('should') = require('should');
const express: typeof import('../../../../config/lib/express.mjs').default = require('../../../../config/lib/express.mjs');
const config: typeof import('../../../../config/config.mts').default = require('../../../../config/config.mts');
const User = mongoose.model<UserServerRecord>('User');

describe('SparkPost newsletter unsubscribe HTTP integration', () => {
  let agent: ReturnType<typeof request.agent>;
  const email = 'newsletter-member@example.test';

  function event(type: string, rcpt_to: unknown = email) {
    return { msys: { unsubscribe_event: { type, rcpt_to } } };
  }

  function post(events: unknown[]) {
    return agent
      .post('/api/sparkpost/webhook')
      .auth(config.sparkpostWebhook.username, config.sparkpostWebhook.password)
      .send(events);
  }

  before(async () => {
    agent = request.agent(await express.init(mongoose.connection));
  });

  beforeEach(async () => {
    await User.create({
      firstName: 'Example',
      username: 'newslettermember',
      email,
      emailTemporary: 'pending-member@example.test',
      password: 'fictional-test-password',
      newsletter: true,
      public: true,
      locale: 'en',
      roles: ['user'],
    });
  });

  afterEach(async () => {
    sinon.restore();
    await User.deleteOne({ email });
  });

  for (const type of ['list_unsubscribe', 'link_unsubscribe']) {
    it(`persists ${type} and preserves all other member fields on repeated delivery`, async () => {
      const before = await User.findOne({ email }).lean().exec();
      const batch = [event(type, ' NEWSLETTER-MEMBER@example.test ')];
      await post(batch).expect(200);
      await post(batch).expect(200);
      const after = await User.findOne({ email }).lean().exec();
      should(after).deepEqual({ ...before, newsletter: false });
    });
  }

  it('ignores unknown, pending and malformed recipients and unrelated events in a mixed batch', async () => {
    const before = await User.findOne({ email }).lean().exec();
    await post([
      { msys: {} },
      event('list_unsubscribe', 'unknown-member@example.test'),
      event('link_unsubscribe', 'pending-member@example.test'),
      event('list_unsubscribe', { address: email }),
      event('list_unsubscribe', 'invalid'),
      event('list_unsubscribe', null),
      event('delivery'),
      { msys: { message_event: { type: 'list_unsubscribe', rcpt_to: email } } },
    ]).expect(200);
    should(await User.findOne({ email }).lean().exec()).deepEqual(before);
  });

  it('rejects unauthenticated opt-outs without changing consent', async () => {
    await agent
      .post('/api/sparkpost/webhook')
      .send([event('list_unsubscribe')])
      .expect(401);
    should((await User.findOne({ email }).lean().exec())!.newsletter).equal(
      true,
    );
  });

  it('rejects recipient query operators at the HTTP boundary', async () => {
    await post([event('list_unsubscribe', { $ne: null })]).expect(400);
    should((await User.findOne({ email }).lean().exec())!.newsletter).equal(
      true,
    );
  });

  it('returns 503 on persistence failure and applies the same batch on retry', async () => {
    const update = sinon.stub(User, 'updateOne').returns({
      exec: () => Promise.reject(new Error('database unavailable')),
    } as unknown as ReturnType<typeof User.updateOne>);
    const batch = [event('list_unsubscribe')];
    const failed = await post(batch).expect(503);
    failed.body.should.deepEqual({
      message: 'Could not process SparkPost unsubscribe events.',
    });
    should((await User.findOne({ email }).lean().exec())!.newsletter).equal(
      true,
    );
    update.restore();
    await post(batch).expect(200);
    should((await User.findOne({ email }).lean().exec())!.newsletter).equal(
      false,
    );
  });
});
