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
      const pair = (userFrom: unknown, userTo: unknown, date: string) => ({
        userFrom,
        userTo,
        date: new Date(date + 'T00:00:00Z'),
      });
      const [older, newer] = await Thread.insertMany(
        [
          pair(user, partnerA, '2026-09-01'),
          pair(partnerB, user, '2026-10-01'),
          pair(stranger, partnerA, '2026-11-01'),
        ].map(({ date, ...thread }) => ({ ...thread, updated: date })),
      );
      await mongoose.connection.collection('messages').insertMany(
        [
          pair(user, partnerA, '2026-08-10'),
          pair(partnerA, user, '2026-08-20'),
          pair(partnerB, user, '2026-09-15'),
          // Messages that share only one side with a thread pair
          pair(stranger, partnerA, '2020-01-01'),
          pair(stranger, user, '2030-01-01'),
        ].map(({ date, ...message }) => ({ ...message, created: date })),
      );

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
        .map(({ _id, firstMessage, lastMessage }) => [
          String(_id),
          firstMessage!.toISOString().slice(0, 10),
          lastMessage!.toISOString().slice(0, 10),
        ])
        .should.deepEqual([
          [String(newer._id), '2026-09-15', '2026-09-15'],
          [String(older._id), '2026-08-10', '2026-08-20'],
        ]);
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
