import type {
  MessageDocument,
  MessageModel,
  MessageRecord,
  ReferenceThreadDocument,
  ReferenceThreadModel,
  ReferenceThreadRecord,
  ThreadModel,
  ThreadRecord,
  UserDocument,
  UserModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Unit tests for reference-thread controller guard and validation branches.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const referenceController: typeof import('./../../server/controllers/reference-thread.server.controller.mjs') = require('./../../server/controllers/reference-thread.server.controller.mjs');
const statService: typeof import('./../../../stats/server/services/stats.server.service.mts') = require('./../../../stats/server/services/stats.server.service.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
require('should');

const ReferenceThread = mongoose.model<
  ReferenceThreadRecord,
  ReferenceThreadModel
>('ReferenceThread');
const Thread = mongoose.model<ThreadRecord, ThreadModel>('Thread');
const User = mongoose.model<UserRecord, UserModel>('User');
const Message = mongoose.model<MessageRecord, MessageModel>('Message');

type ResponseBody = {
  message?: string;
  allowCreatingReference?: boolean;
  userFrom?: import('mongoose').Types.ObjectId;
  userTo?: import('mongoose').Types.ObjectId;
  reference?: 'yes' | 'no';
  _id?: string | import('mongoose').Types.ObjectId;
};
type DeferredResponse = {
  statusCode: number;
  body: ResponseBody | null;
  status(code: number): DeferredResponse;
  send(body: ResponseBody): DeferredResponse;
  json(body: ResponseBody): DeferredResponse;
  waitForResponse(): Promise<DeferredResponse>;
};
function responseBody(response: DeferredResponse): ResponseBody {
  if (response.body === null) throw new Error('Expected a response body');
  return response.body;
}
type ReferenceRequest = {
  user?: UserDocument;
  referenceThread?: ReferenceThreadDocument | { _id: string; reference: 'yes' };
  body?: { userTo?: string; reference?: 'yes' | 'no'; feedback?: string };
};
type Next = (error?: unknown) => void;
type ReferenceController = {
  readReferenceThread(
    request: ReferenceRequest,
    response: DeferredResponse,
  ): void;
  readReferenceThreadById(
    request: ReferenceRequest,
    response: DeferredResponse,
    next: Next,
    userToId: string,
  ): void;
  createReferenceThread(
    request: ReferenceRequest,
    response: DeferredResponse,
  ): void;
};
const controller = referenceController as unknown as ReferenceController;

function deferredResponse(): DeferredResponse {
  let resolveResponse!: (response: DeferredResponse) => void;
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    json(body) {
      res.body = body;
      resolveResponse(res);
      return res;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

async function createThreadWithMessage(
  author: UserDocument,
  other: UserDocument,
  fromAuthor: boolean,
) {
  const userFrom = fromAuthor ? author._id : other._id;
  const userTo = fromAuthor ? other._id : author._id;
  const message = await new Message({
    content: 'Thread message',
    userFrom,
    userTo,
  }).save();
  const thread = await new Thread({
    userFrom: author._id,
    userTo: other._id,
    message: message._id,
    read: false,
    updated: Date.now(),
  }).save();
  return { message, thread };
}

describe('Reference thread controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('readReferenceThread', () => {
    it('returns an empty object when no reference is attached', async () => {
      const res = deferredResponse();
      controller.readReferenceThread({}, res);
      await res.waitForResponse();
      responseBody(res).should.eql({});
    });

    it('returns the attached reference thread', async () => {
      const res = deferredResponse();
      const referenceThread = { _id: 'ref-1', reference: 'yes' as const };
      controller.readReferenceThread({ referenceThread }, res);
      await res.waitForResponse();
      responseBody(res).should.eql(referenceThread);
    });
  });

  describe('readReferenceThreadById', () => {
    it('responds with 403 without a user', async () => {
      const res = deferredResponse();
      controller.readReferenceThreadById(
        {},
        res,
        () => {},
        new mongoose.Types.ObjectId().toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('responds with 400 for an invalid id', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      const res = deferredResponse();
      controller.readReferenceThreadById({ user }, res, () => {}, 'bad-id');
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('calls next when a reference thread exists', async () => {
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      const { thread: messageThread } = await createThreadWithMessage(
        author,
        other,
        false,
      );
      const thread = await new ReferenceThread({
        thread: messageThread._id,
        userFrom: author._id,
        userTo: other._id,
        reference: 'yes',
      }).save();

      const req: ReferenceRequest & {
        referenceThread?: ReferenceThreadDocument;
      } = { user: author };
      let nextCalled = false;
      await new Promise<void>(resolve => {
        controller.readReferenceThreadById(
          req,
          deferredResponse(),
          () => {
            nextCalled = true;
            resolve();
          },
          other._id.toString(),
        );
      });

      nextCalled.should.be.true();
      if (!req.referenceThread) {
        throw new Error('Expected the controller to attach a reference thread');
      }
      req.referenceThread._id.toString().should.equal(thread._id.toString());
    });

    it('responds with 404 and allowCreatingReference when messaging is allowed', async () => {
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);

      const res = deferredResponse();
      controller.readReferenceThreadById(
        { user: author },
        res,
        () => {},
        other._id.toString(),
      );
      await res.waitForResponse();
      res.statusCode.should.equal(404);
      responseBody(res).allowCreatingReference!.should.be.true();
    });

    it('passes message lookup errors to next when no reference exists', async () => {
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      type CallbackQuery<T> = {
        sort(order: string): CallbackQuery<T>;
        exec(
          callback?: (error: Error | null, document: T | null) => void,
        ): void | Promise<T | null>;
      };
      const referenceThreadQueries = ReferenceThread as unknown as {
        findOne(query: object): CallbackQuery<ReferenceThreadDocument>;
      };
      const noReferenceQuery: CallbackQuery<ReferenceThreadDocument> = {
        sort() {
          return this;
        },
        exec(callback) {
          if (callback) callback(null, null);
          return Promise.resolve(null);
        },
      };
      sinon.stub(referenceThreadQueries, 'findOne').returns(noReferenceQuery);
      const messageModelWithPromiseFindOne = Message as unknown as {
        findOne(query: object): { exec(): Promise<MessageDocument | null> };
      };
      sinon.stub(messageModelWithPromiseFindOne, 'findOne').returns({
        exec: () => Promise.reject(new Error('message lookup failed')),
      });

      let nextArg: unknown;
      await new Promise<void>(resolve => {
        controller.readReferenceThreadById(
          { user: author },
          deferredResponse(),
          err => {
            nextArg = err;
            resolve();
          },
          other._id.toString(),
        );
      });

      if (!(nextArg instanceof Error))
        throw new Error('Expected a callback error');
      nextArg.should.be.Error();
      nextArg.message.should.equal('message lookup failed');
    });

    it('passes database errors to next', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      type CallbackQuery<T> = {
        sort(order: string): CallbackQuery<T>;
        exec(callback: (error: Error | null, document: T | null) => void): void;
      };
      const referenceThreadQueries = ReferenceThread as unknown as {
        findOne(query: object): CallbackQuery<ReferenceThreadDocument>;
      };
      const failedQuery: CallbackQuery<ReferenceThreadDocument> = {
        sort() {
          return this;
        },
        exec(callback) {
          if (callback) {
            callback(new Error('lookup failed'), null);
            return;
          }
          return Promise.reject(new Error('lookup failed'));
        },
      };
      sinon.stub(referenceThreadQueries, 'findOne').returns(failedQuery);

      let nextArg: unknown;
      await new Promise<void>(resolve => {
        controller.readReferenceThreadById(
          { user },
          deferredResponse(),
          err => {
            nextArg = err;
            resolve();
          },
          new mongoose.Types.ObjectId().toString(),
        );
      });

      if (!(nextArg instanceof Error))
        throw new Error('Expected a callback error');
      nextArg.should.be.Error();
      nextArg.message.should.equal('lookup failed');
    });
  });

  describe('createReferenceThread', () => {
    it('responds with 403 without a public user', async () => {
      const res = deferredResponse();
      controller.createReferenceThread({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('rejects an invalid userTo id', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      const res = deferredResponse();
      controller.createReferenceThread(
        { user, body: { userTo: 'bad-id' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects references for non-existing threads', async () => {
      const [user] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(1, { public: true }),
      );
      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user,
          body: { userTo: new mongoose.Types.ObjectId().toString() },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      responseBody(res).message!.should.equal('Thread does not exist.');
    });

    it('rejects references when the other person has not messaged you', async () => {
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      const Message = mongoose.model<MessageRecord, MessageModel>('Message');
      const Thread = mongoose.model<ThreadRecord, ThreadModel>('Thread');
      const message = await new Message({
        content: 'Only from author',
        userFrom: author._id,
        userTo: other._id,
      }).save();
      await new Thread({
        userFrom: author._id,
        userTo: other._id,
        message: message._id,
        read: false,
        updated: Date.now(),
      }).save();

      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user: author,
          body: { userTo: other._id.toString(), feedback: 'Great guest' },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });

    it('creates a reference thread when messaging rules allow it', async () => {
      sinon
        .stub(statService, 'stat')
        .callsFake((_data, callback) => callback?.());
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);

      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();

      responseBody(res)
        .userFrom!.toString()
        .should.equal(author._id.toString());
      responseBody(res).userTo!.toString().should.equal(other._id.toString());
      responseBody(res).reference!.should.equal('yes');

      const saved = await ReferenceThread.findOne({
        userFrom: author._id,
        userTo: other._id,
      });
      if (!saved) throw new Error('Expected a saved reference');
      saved.reference.should.equal('yes');
    });

    it('responds with 400 when saving the reference fails', async () => {
      sinon
        .stub(statService, 'stat')
        .callsFake((_data, callback) => callback?.());
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);
      sinon
        .stub(ReferenceThread.prototype, 'save')
        .callsFake(() => Promise.reject(new Error('save failed')));

      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('responds with 400 when the waterfall fails', async () => {
      sinon
        .stub(statService, 'stat')
        .callsFake((_data, callback) => callback?.());
      const [author, other] = await utils.saveUsersWithCachedPasswords(
        utils.generateUsersWithSharedPassword(2, { public: true }),
      );
      await createThreadWithMessage(author, other, false);
      const userModelWithCallbackFindById = User as unknown as {
        findById(id: import('mongoose').Types.ObjectId): {
          select(fields: string): { exec(): Promise<UserDocument | null> };
        };
      };
      sinon.stub(userModelWithCallbackFindById, 'findById').returns({
        select: () => ({
          exec: () => Promise.reject(new Error('user lookup failed')),
        }),
      });

      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user: author,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects references when the user is not in the thread', async () => {
      const [author, other, stranger] =
        await utils.saveUsersWithCachedPasswords(
          utils.generateUsersWithSharedPassword(3, { public: true }),
        );
      const threadModelWithCallbackFindOne = Thread as unknown as {
        findOne(
          query: object,
          fields: string,
        ): {
          exec(): Promise<{
            _id: import('mongoose').Types.ObjectId;
            userFrom: import('mongoose').Types.ObjectId;
            userTo: import('mongoose').Types.ObjectId;
          } | null>;
        };
      };
      sinon.stub(threadModelWithCallbackFindOne, 'findOne').returns({
        exec: () =>
          Promise.resolve({
            _id: new mongoose.Types.ObjectId(),
            userFrom: new mongoose.Types.ObjectId(author._id.toString()),
            userTo: new mongoose.Types.ObjectId(other._id.toString()),
          }),
      });

      const res = deferredResponse();
      controller.createReferenceThread(
        {
          user: stranger,
          body: {
            userTo: other._id.toString(),
            reference: 'yes',
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(403);
    });
  });
});
