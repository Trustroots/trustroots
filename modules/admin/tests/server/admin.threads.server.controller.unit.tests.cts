const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const adminThreads: typeof import('../../server/controllers/admin.threads.server.controller.mjs').default = require('./../../server/controllers/admin.threads.server.controller.mjs');
require('should');

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
      exec(callback: (error: Error | null, threads?: unknown[]) => void) {
        callback(new Error('aggregate failed'));
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
});
