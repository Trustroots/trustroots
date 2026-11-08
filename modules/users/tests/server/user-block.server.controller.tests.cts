/**
 * Unit tests for the user block controller.
 *
 * The controller is loaded through `mock-module` with a recording logger, so
 * each test checks the response, the stored block list and the log calls.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const mockModule: typeof import('./../../../../testutils/server/mock-module.mts').default = require('./../../../../testutils/server/mock-module');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
require('should');

type Id = import('mongoose').Types.ObjectId | string;
interface BlockRequest {
  user: { _id: Id };
  profile?: { _id: Id; username?: string };
  params?: { username?: string };
}
type Handler = (req: BlockRequest, res: MockResponse) => Promise<unknown>;
interface BlockController {
  getBlockedUsers: Handler;
  blockUser: Handler;
  unblockUser: Handler;
}

interface MockResponse {
  statusCode: number;
  body: unknown;
  status(code: number): this;
  send(body: unknown): this;
}

const User = mongoose.model<{ blocked: Id[] }>('User');
const message = (text: string) => ({ message: text });
const invalidId = message('Cannot interpret id.');
const notFound = message('Not found.');
const failed = message(
  (
    require('./../../../core/server/services/error.server.service.mjs') as typeof import('../../../core/server/services/error.server.service.mjs').default
  ).getErrorMessageByKey('default'),
);

async function call(handler: keyof BlockController, req: BlockRequest) {
  const logged: unknown[][] = [];
  const controller = mockModule<BlockController>(
    require.resolve('./../../server/controllers/users.block.server.controller.mts'),
    {
      './../../../../config/lib/logger.mjs': (...args: unknown[]) =>
        logged.push(args),
    },
  );
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    send(body: unknown) {
      res.body = body;
      return res;
    },
  };
  await controller[handler](req, res);
  return { response: [res.statusCode, res.body], logged };
}

const errorLog = (logged: unknown[][]) => {
  logged.at(-1)![0]!.should.equal('error');
  logged.at(-1)![1]!.should.be.instanceOf(Error);
  return logged.slice(0, -1);
};

describe('User block controller unit tests', () => {
  afterEach(utils.clearDatabase);

  const missingId = new mongoose.Types.ObjectId();
  const other = { _id: new mongoose.Types.ObjectId(), username: 'someone' };

  it('sends the blocked list with only public name fields', async () => {
    const [user, blocked] = await utils.saveUsers(utils.generateUsers(2));
    await User.updateOne({ _id: user._id }, { blocked: [blocked._id] });

    const { response, logged } = await call('getBlockedUsers', {
      user: { _id: user._id },
    });

    response[0]!.should.equal(200);
    JSON.parse(JSON.stringify(response[1])).should.eql([
      {
        _id: blocked._id.toString(),
        username: blocked.username,
        displayName: blocked.displayName,
      },
    ]);
    logged.should.eql([]);
  });

  it('responds with 400 and logs when the blocked list lookup fails', async () => {
    const { response, logged } = await call('getBlockedUsers', {
      user: { _id: missingId },
    });
    response.should.eql([400, failed]);
    errorLog(logged).should.eql([]);
  });

  it('rejects a missing profile or blocking yourself', async () => {
    for (const [handler, req] of [
      ['blockUser', { user: { _id: missingId } }],
      ['blockUser', { user: { _id: missingId }, profile: { _id: missingId } }],
      ['unblockUser', { user: { _id: missingId }, params: {} }],
    ] as Array<[keyof BlockController, BlockRequest]>) {
      (await call(handler, req)).should.eql({
        response: [400, invalidId],
        logged: [],
      });
    }
  });

  it('blocks and unblocks a member', async () => {
    const [user, target] = await utils.saveUsers(utils.generateUsers(2));
    const profile = { _id: target._id, username: target.username };
    const params = { username: 'requested-name' };
    const stored = async () =>
      (await User.findById(user._id))!.blocked.map(String);

    (await call('blockUser', { user, profile })).should.eql({
      response: [200, `${target.username} added to block list.`],
      logged: [['info', `${user._id} blocking ${target._id}`]],
    });
    (await stored()).should.eql([target._id.toString()]);

    (await call('unblockUser', { user, profile, params })).should.eql({
      response: [200, message(`${target.username} removed from block list.`)],
      logged: [['info', `${user._id} unblocking requested-name:${target._id}`]],
    });
    (await stored()).should.eql([]);

    // Nothing left to unblock: matched but not modified.
    (await call('unblockUser', { user, profile, params })).response.should.eql([
      404,
      notFound,
    ]);
  });

  it('responds with 404 when the logged in user no longer exists', async () => {
    const params = { username: 'someone' };
    (
      await call('blockUser', { user: { _id: missingId }, profile: other })
    ).response.should.eql([404, notFound]);
    (
      await call('unblockUser', {
        user: { _id: missingId },
        profile: other,
        params,
      })
    ).response.should.eql([404, notFound]);
  });

  it('responds with 400 and logs when the update throws', async () => {
    const user = { _id: 'not-a-valid-object-id' };
    const params = { username: 'someone' };
    for (const handler of ['blockUser', 'unblockUser'] as const) {
      const { response, logged } = await call(handler, {
        user,
        profile: other,
        params,
      });
      response.should.eql([400, failed]);
      errorLog(logged).length.should.equal(1);
    }
  });
});
