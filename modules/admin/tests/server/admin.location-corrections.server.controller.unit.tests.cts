import type { Types } from 'mongoose';

const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert').strict =
  require('node:assert').strict;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const messageToStats: {
  save(...args: unknown[]): void;
} = require('../../../messages/server/services/message-to-stats.server.service.mjs');

type Candidate = {
  userId: string;
  key: string;
  username: string;
  match: 'exact' | 'nearby';
  offers: Array<{ _id: string; match: string }>;
};
type Body = Record<string, unknown>;
type Controller = {
  list(req: unknown, res: unknown): Promise<unknown>;
  send(req: unknown, res: unknown): Promise<unknown>;
  _test: {
    classifyLocation(location: unknown): 'exact' | 'nearby' | null;
    candidateKey(userId: unknown, offers: unknown[]): string;
    compareCandidates(
      a: { match: string; username: string },
      b: { match: string; username: string },
    ): number;
  };
};
// Load the controller on first use, inside a test, so that test covers (and
// can kill) mutants in its module-level constants.
const controller = new Proxy({} as Controller, {
  get: (_target, key) =>
    require('../../server/controllers/admin.location-corrections.server.controller.mts')[
      key
    ],
});

const exact = [48.6908333333, 9.14055555556];
const nearby = [48.691, 9.141];
const area = {
  south: 48.6825742243,
  north: 48.6978156112,
  west: 9.1301107407,
  east: 9.1519975662,
};
const description =
  'I help members find each other and keep their offers accurate. I enjoy welcoming travellers, sharing local knowledge, and building thoughtful conversations.';

function response() {
  const captured: { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: undefined,
  };
  const res = {
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    send(body: unknown) {
      captured.body = JSON.parse(JSON.stringify(body));
      return body;
    },
  };
  return { res, captured };
}

describe('Location corrections controller', () => {
  const Offer = mongoose.model('Offer');
  const Message = mongoose.model('Message');
  const Thread = mongoose.model('Thread');
  type Saved = Awaited<
    ReturnType<typeof utils.saveUsersWithCachedPasswords>
  >[number];
  let team: Saved;
  let member: Saved;
  let other: Saved;

  beforeEach(async () => {
    const users = utils
      .generateUsersWithSharedPassword(3)
      .map(user => Object.assign(user, { public: true, description }));
    users[0].roles = ['user', 'welcome-team'];
    [team, member, other] = await utils.saveUsersWithCachedPasswords(users);
  });

  afterEach(async () => {
    sinon.restore();
    await utils.clearDatabase();
  });

  const addOffer = (
    user: { _id: unknown } | null,
    location: number[],
    overrides: Record<string, unknown> = {},
  ) =>
    new Offer({
      user: user?._id,
      type: 'host',
      status: 'yes',
      description: 'A place to stay.',
      location,
      ...overrides,
    }).save();

  async function list() {
    const { res, captured } = response();
    await controller.list({ user: team }, res);
    return captured as { statusCode: number; body: Candidate[] };
  }

  async function send(body: unknown, user: unknown = team) {
    const { res, captured } = response();
    await controller.send({ user, body }, res);
    return captured as { statusCode: number; body: Body };
  }

  const content = 'Please check your location.';
  const sendTo = (candidate: Candidate, userId = candidate.userId) =>
    send({ userId, key: candidate.key, content });

  describe('classification helpers', () => {
    const classifyLocation = (location: unknown) =>
      controller._test.classifyLocation(location);
    const candidateKey = (userId: unknown, offers: unknown[]) =>
      controller._test.candidateKey(userId, offers);
    const compareCandidates = (
      a: { match: string; username: string },
      b: { match: string; username: string },
    ) => controller._test.compareCandidates(a, b);

    it('accepts the historic area boundaries and only exact default coordinates', () => {
      for (const location of [
        [area.south, 9.14],
        [area.north, 9.14],
        [48.69, area.west],
        [48.69, area.east],
        [exact[0], 9.141],
        [48.691, exact[1]],
      ]) {
        assert.equal(classifyLocation(location), 'nearby', String(location));
      }
      assert.equal(classifyLocation([...exact, 0]), null);
      assert.equal(classifyLocation(exact), 'exact');
      assert.equal(classifyLocation([52, 13]), null);
    });

    it('separates offer ids and coordinates in the candidate key', () => {
      assert.notEqual(
        candidateKey('u', [{ _id: 'a', location: [1.2, 3] }]),
        candidateKey('u', [{ _id: 'a', location: [1, 23] }]),
      );
    });

    it('orders candidates with the same match by username', () => {
      assert(
        compareCandidates(
          { match: 'exact', username: 'b' },
          { match: 'exact', username: 'a' },
        ) > 0,
      );
    });
  });

  it('lists maybe hosts with offers ordered by id', async () => {
    const high = new mongoose.Types.ObjectId('ffffffffffffffffffffffff');
    const low = new mongoose.Types.ObjectId('000000000000000000000001');
    await addOffer(member, nearby, { _id: high, status: 'maybe' });
    await addOffer(member, exact, { _id: low });
    const result = await list();
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.length, 1);
    assert.deepEqual(
      result.body[0].offers.map(offer => offer._id),
      [String(low), String(high)],
    );
  });

  it('skips offers without a member or outside the classified shape', async () => {
    await Offer.collection.insertMany([
      { type: 'host', status: 'yes', location: exact },
      {
        type: 'host',
        status: 'yes',
        location: exact,
        user: new mongoose.Types.ObjectId(),
      },
      {
        type: 'host',
        status: 'yes',
        location: [...exact, 0],
        user: (other as { _id: Types.ObjectId })._id,
      },
    ]);
    const result = await list();
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, []);
  });

  it('combines the coverage of every earlier correction to a member', async () => {
    const first = await addOffer(member, exact);
    const second = await addOffer(member, nearby);
    await Message.collection.insertMany([
      {
        userFrom: team._id,
        userTo: member._id,
        content: 'First.',
        locationCorrectionOffers: [{ offer: first._id, location: exact }],
      },
      {
        userFrom: team._id,
        userTo: member._id,
        content: 'Second.',
        locationCorrectionOffers: [{ offer: second._id, location: nearby }],
      },
      // An ordinary message has no correction coverage at all.
      { userFrom: other._id, userTo: member._id, content: 'Hello.' },
    ]);
    const result = await list();
    assert.equal(result.statusCode, 200);
    assert.deepEqual(result.body, []);
  });

  it('reports a loading failure', async () => {
    sinon.stub(Offer, 'find').throws(new Error('database unavailable'));
    const result = await list();
    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, {
      message: 'Could not load location corrections.',
    });
  });

  it('rejects malformed send requests with a message', async () => {
    const key = 'a'.repeat(64);
    const userId = String(member._id);
    for (const body of [
      'not an object',
      { userId, key: [key], content: 'Hello' },
      { userId, key: `z${key}`, content: 'Hello' },
      { userId, key: `${key}z`, content: 'Hello' },
      { userId, key, content: ['Hello'] },
      { userId, key, content: 'x'.repeat(5001) },
    ]) {
      const result = await send(body);
      assert.equal(result.statusCode, 400, JSON.stringify(body).slice(0, 80));
      assert.deepEqual(result.body, { message: 'Invalid correction message.' });
    }
    const blank = await send({ userId, key, content: ' ' });
    assert.equal(blank.statusCode, 400);
    assert.deepEqual(blank.body, { message: 'Please write a message.' });
  });

  it('explains why a sender cannot send', async () => {
    const key = 'a'.repeat(64);
    const body = { userId: String(member._id), key, content: 'Hello' };
    const hidden = await send(body, { ...team.toObject(), public: false });
    assert.equal(hidden.statusCode, 403);
    assert.deepEqual(hidden.body, { message: 'Messaging is unavailable.' });
    const incomplete = await send(body, {
      ...team.toObject(),
      description: undefined,
    });
    assert.equal(incomplete.statusCode, 400);
    assert.deepEqual(incomplete.body, {
      message: 'Please complete your profile before sending messages.',
    });
  });

  it('sends with a profile of exactly the minimum length and the longest message', async () => {
    await addOffer(member, exact);
    const [candidate] = (await list()).body;
    const sender = { ...team.toObject(), description: 'x'.repeat(140) };
    const result = await send(
      {
        userId: candidate.userId,
        key: candidate.key,
        content: 'y'.repeat(5000),
      },
      sender,
    );
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.sent, true);
  });

  it('stores an unread visible message with defaults, its thread and its stats once', async () => {
    const save = sinon.stub(messageToStats, 'save');
    await addOffer(member, exact);
    await addOffer(other, nearby);
    // An unrelated conversation must not be touched.
    const unrelated = await new Thread({
      userFrom: other._id,
      userTo: team._id,
      updated: new Date(0),
      message: new mongoose.Types.ObjectId(),
    }).save();
    // An older conversation between the pair is moved to the new message.
    const existing = await new Thread({
      userFrom: member._id,
      userTo: team._id,
      updated: new Date(0),
      message: new mongoose.Types.ObjectId(),
    }).save();
    const candidate = (await list()).body.find(
      item => item.userId === String(member._id),
    )!;
    const result = await sendTo(candidate);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.sent, true);
    const message = await Message.findById(result.body.messageId).lean<{
      read: boolean;
      shadowHidden: boolean;
      created?: Date;
      notificationCount?: number;
    }>();
    assert.deepEqual(
      [message!.read, message!.shadowHidden, message!.notificationCount],
      [false, false, 0],
    );
    assert(message!.created instanceof Date);
    const thread = await Thread.findById(existing._id).lean<{
      message: unknown;
    }>();
    assert.equal(String(thread!.message), String(result.body.messageId));
    const untouched = await Thread.findById(unrelated._id).lean<{
      message: unknown;
      updated: Date;
    }>();
    assert.equal(String(untouched!.message), String(unrelated.message));
    assert.equal(untouched!.updated.getTime(), 0);
    sinon.assert.calledOnce(save);

    // A retry reports the earlier message while other members stay queued.
    const retry = await sendTo(candidate);
    assert.equal(retry.statusCode, 200);
    assert.deepEqual(retry.body, {
      sent: false,
      message: 'This member has already been contacted.',
    });
    sinon.assert.calledOnce(save);
  });

  it('creates separate threads for corrections to different members', async () => {
    await addOffer(member, exact);
    await addOffer(other, nearby);
    for (const candidate of (await list()).body) {
      const result = await sendTo(candidate);
      assert.equal(result.statusCode, 200);
      assert.equal(
        await Thread.countDocuments({ message: String(result.body.messageId) }),
        1,
      );
    }
  });

  it('refuses a key of another member, or a stale key of a queued one', async () => {
    await addOffer(member, exact);
    const [candidate] = (await list()).body;
    const changed = 'The candidate has changed. Refresh the queue.';
    const foreign = await sendTo(candidate, String(other._id));
    assert.equal(foreign.statusCode, 409);
    assert.deepEqual(foreign.body, { sent: false, message: changed });
    const stale = await sendTo({ ...candidate, key: 'b'.repeat(64) });
    assert.equal(stale.statusCode, 409);
    assert.deepEqual(stale.body, { message: changed });
    assert.equal(await Message.countDocuments(), 0);
  });

  // Stores the message, then fails as a concurrent or broken write would.
  function storeThenThrow(error: Error) {
    const original = Message.findOneAndUpdate;
    const stub = sinon.stub(Message, 'findOneAndUpdate').callsFake(
      (...args: unknown[]) =>
        ({
          exec: async () => {
            stub.restore();
            await Reflect.apply(original, Message, args).exec();
            throw error;
          },
        }) as unknown as ReturnType<typeof Message.findOneAndUpdate>,
    );
  }

  const failures: Array<[string, () => void]> = [
    [
      'a thread update',
      () => {
        const original = Thread.updateOne;
        const error = Object.assign(new Error('invalid'), { code: 121 });
        sinon
          .stub(Thread, 'updateOne')
          .callsFake((...args: unknown[]) =>
            Reflect.apply(original, Thread, args),
          )
          .onFirstCall()
          .returns({ exec: () => Promise.reject(error) } as never);
      },
    ],
    [
      'message storage',
      () => storeThenThrow(new Error('write concern failed')),
    ],
  ];
  for (const [name, fail] of failures)
    it(`fails when ${name} fails for a reason other than a duplicate`, async () => {
      await addOffer(member, exact);
      const [candidate] = (await list()).body;
      fail();
      const result = await sendTo(candidate);
      assert.equal(result.statusCode, 500);
      assert.deepEqual(result.body, {
        message: 'Could not send the correction message.',
      });
    });

  it('does not count stats again when a concurrent send stored the message', async () => {
    const save = sinon.stub(messageToStats, 'save');
    await addOffer(member, exact);
    const [candidate] = (await list()).body;
    storeThenThrow(
      Object.assign(new Error('concurrent insert'), { code: 11000 }),
    );
    const result = await sendTo(candidate);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.sent, false);
    sinon.assert.notCalled(save);
  });
});
