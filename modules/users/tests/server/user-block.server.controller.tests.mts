import { removePendingContacts } from '../../../../layers/server/user-account.mts';
import type { RemovePendingContacts } from '../../server/services/user-contacts.server.contract.mts';
import importedDependency0 from './../../../core/server/services/error.server.service.mts';
import mongoose from 'mongoose';
import mockModule from './../../../../testutils/server/mock-module.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import 'should';
/**
 * Unit tests for the user block controller.
 *
 * The controller is loaded through `mock-module` with a recording logger, so
 * each test checks the response, the stored block list and the log calls.
 */

type Id = import('mongoose').Types.ObjectId | string;
interface BlockRequest {
  user: { _id: Id };
  profile?: { _id: Id; username?: string };
  params?: { username?: string };
}
type Handler = (req: BlockRequest, res: MockResponse) => Promise<unknown>;
interface BlockController {
  getBlockedUsers: Handler;
  blockUser: (
    removePending: RemovePendingContacts,
    ...args: Parameters<Handler>
  ) => Promise<unknown>;
  unblockUser: Handler;
}

const Contact =
  mongoose.model<
    import('../../../contacts/server/models/contacts.server.model.mts').ContactRecord
  >('Contact');

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
    importedDependency0 as typeof import('../../../core/server/services/error.server.service.mts').default
  ).getErrorMessageByKey('default'),
);

async function call(
  handler: keyof BlockController,
  req: BlockRequest,
  removePending = removePendingContacts,
) {
  const logged: unknown[][] = [];
  const controller = (
    await mockModule<{ default: BlockController }>(
      new URL(
        './../../server/controllers/users.block.server.controller.mts',
        import.meta.url,
      ),
      {
        '@trustroots/logger': (...args: unknown[]) => logged.push(args),
      },
    )
  ).default;
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
  if (handler === 'blockUser')
    await controller.blockUser(removePending, req, res);
  else await controller[handler](req, res);
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

  it('cancels pending contacts in both directions', async () => {
    const [user, target] = await utils.saveUsers(utils.generateUsers(2));
    const pending = await Contact.create([
      { userFrom: user._id, userTo: target._id, confirmed: false },
      { userFrom: target._id, userTo: user._id, confirmed: false },
    ]);

    const { response } = await call('blockUser', { user, profile: target });

    response[0]!.should.equal(200);
    const remaining = await Contact.find({
      _id: { $in: pending.map(contact => contact._id) },
    });
    remaining.length.should.equal(0);
  });

  it('preserves confirmed contacts and unrelated pending requests', async () => {
    const [user, target, other] = await utils.saveUsers(utils.generateUsers(3));
    const confirmed = await Contact.create({
      userFrom: user._id,
      userTo: target._id,
      confirmed: true,
    });
    const unrelated = await Contact.create({
      userFrom: user._id,
      userTo: other._id,
      confirmed: false,
    });

    const { response } = await call('blockUser', { user, profile: target });

    response[0]!.should.equal(200);
    (await Contact.findById(confirmed._id))!.confirmed.should.be.true();
    (await Contact.findById(unrelated._id))!.confirmed.should.be.false();
  });

  it('reports a pending contact cleanup failure after recording the block', async () => {
    const [user, target] = await utils.saveUsers(utils.generateUsers(2));
    const failure = new Error('Pending contact cleanup failed');
    const { response, logged } = await call(
      'blockUser',
      { user, profile: target },
      async () => {
        throw failure;
      },
    );

    response.should.eql([400, failed]);
    logged.at(-1)![1]!.should.equal(failure);
    (await User.findById(user._id))!.blocked
      .map(String)
      .should.eql([String(target._id)]);
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
