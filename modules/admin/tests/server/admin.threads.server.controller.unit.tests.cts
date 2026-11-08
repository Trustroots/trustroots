const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const adminThreads: typeof import('../../server/controllers/admin.threads.server.controller.mts').default = require('./../../server/controllers/admin.threads.server.controller.mts');
require('should');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');

const Thread = mongoose.model('Thread');

type ControllerResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): ControllerResponse;
  send(body: unknown): ControllerResponse;
  waitForResponse(): Promise<ControllerResponse>;
};

function mockResponse(): ControllerResponse {
  let resolveResponse!: (response: ControllerResponse) => void;
  const promise = new Promise<ControllerResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: ControllerResponse = {
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
    waitForResponse: () => promise,
  };
  return res;
}

describe('Admin threads controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns 400 when thread aggregation fails', async () => {
    const query = {
      exec() {
        return Promise.reject(new Error('aggregate failed'));
      },
    };
    sinon
      .stub(Thread, 'aggregate')
      .returns(query as unknown as ReturnType<typeof Thread.aggregate>);

    const res = mockResponse();
    adminThreads.getThreads(
      { body: { userId: new mongoose.Types.ObjectId().toString() } },
      res,
    );
    const response = await res.waitForResponse();
    response.statusCode.should.equal(400);
  });

  describe('with stored threads', () => {
    afterEach(utils.clearDatabase);

    it("returns only the user's threads, newest first, with dates of messages between the pair only", async () => {
      const [user, partnerA, partnerB, stranger] = Array.from(
        { length: 4 },
        () => new mongoose.Types.ObjectId(),
      );
      const [older, newer] = await Thread.insertMany([
        {
          userFrom: user,
          userTo: partnerA,
          updated: new Date('2026-09-01T00:00:00Z'),
        },
        {
          userFrom: partnerB,
          userTo: user,
          updated: new Date('2026-10-01T00:00:00Z'),
        },
        {
          userFrom: stranger,
          userTo: partnerA,
          updated: new Date('2026-11-01T00:00:00Z'),
        },
      ]);
      await mongoose.connection.collection('messages').insertMany([
        {
          userFrom: user,
          userTo: partnerA,
          created: new Date('2026-08-10T00:00:00Z'),
        },
        {
          userFrom: partnerA,
          userTo: user,
          created: new Date('2026-08-20T00:00:00Z'),
        },
        {
          userFrom: partnerB,
          userTo: user,
          created: new Date('2026-09-15T00:00:00Z'),
        },
        // Messages that share only one side with a thread pair
        {
          userFrom: stranger,
          userTo: partnerA,
          created: new Date('2020-01-01T00:00:00Z'),
        },
        {
          userFrom: stranger,
          userTo: user,
          created: new Date('2030-01-01T00:00:00Z'),
        },
      ]);

      const res = mockResponse();
      adminThreads.getThreads({ body: { userId: user.toString() } }, res);
      const response = await res.waitForResponse();

      response.statusCode.should.equal(200);
      const threads = response.body as Array<{
        _id: import('mongoose').Types.ObjectId;
        firstMessage: Date | null;
        lastMessage: Date | null;
      }>;
      threads
        .map(thread => thread._id.toString())
        .should.deepEqual([newer._id.toString(), older._id.toString()]);
      threads[0]
        .firstMessage!.toISOString()
        .should.equal('2026-09-15T00:00:00.000Z');
      threads[0]
        .lastMessage!.toISOString()
        .should.equal('2026-09-15T00:00:00.000Z');
      threads[1]
        .firstMessage!.toISOString()
        .should.equal('2026-08-10T00:00:00.000Z');
      threads[1]
        .lastMessage!.toISOString()
        .should.equal('2026-08-20T00:00:00.000Z');
    });

    it('returns threads where the user is only the recipient', async () => {
      const [user, partner] = [
        new mongoose.Types.ObjectId(),
        new mongoose.Types.ObjectId(),
      ];
      const [received] = await Thread.insertMany([
        { userFrom: partner, userTo: user },
        { userFrom: partner, userTo: new mongoose.Types.ObjectId() },
      ]);

      const res = mockResponse();
      adminThreads.getThreads({ userIdFromUsername: user.toString() }, res);
      const response = await res.waitForResponse();

      (response.body as Array<{ _id: import('mongoose').Types.ObjectId }>)
        .map(thread => thread._id.toString())
        .should.deepEqual([received._id.toString()]);
    });
  });
});
