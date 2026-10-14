import type {
  ExperienceModel,
  ExperienceRecord,
  MessageModel,
  MessageRecord,
  ReferenceThreadModel,
  ReferenceThreadRecord,
  TestQuery,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

const adminDashboard: typeof import('../../server/controllers/admin.dashboard.server.controller.mjs') = require('./../../server/controllers/admin.dashboard.server.controller.mjs');
require('should');

const Experience: ExperienceModel =
  mongoose.model<ExperienceRecord>('Experience');
const Message: MessageModel = mongoose.model<MessageRecord>('Message');
const ReferenceThread: ReferenceThreadModel =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const User = mongoose.model<UserRecord>('User');

type DashboardNegativeExperience = {
  _id: import('mongoose').Types.ObjectId;
  recommend: 'no';
};
type DashboardThreadVote = {
  _id: import('mongoose').Types.ObjectId;
  reference: 'no';
};
type Messenger = {
  _id: import('mongoose').Types.ObjectId;
  displayName: string;
  username: string;
};
type MessageCount = {
  _id: import('mongoose').Types.ObjectId | null;
  messageCount: number;
};
type DashboardFilter = {
  recommend: 'no';
  removedAt: { $exists: false };
};
type DashboardQuery<T> = TestQuery<T> & {
  select(...args: unknown[]): DashboardQuery<T>;
};
type QueryStub<TFilter, TResult> = import('sinon').SinonStub<
  [filter: TFilter],
  DashboardQuery<TResult>
>;

function dashboardQuery<T>(result: T): DashboardQuery<T> {
  const query: DashboardQuery<T> = {
    sort: () => query,
    limit: () => query,
    populate: () => query,
    select: () => query,
    exec: async () => result,
  };
  return query;
}

function stubAggregate(result: MessageCount[] | null, error?: Error) {
  const query = dashboardQuery(result);
  const exec = sinon.stub(query, 'exec');
  if (error) exec.rejects(error);
  else exec.resolves(result);
  const aggregate = sinon.stub(
    Message,
    'aggregate',
  ) as unknown as import('sinon').SinonStub<
    [pipeline: import('mongoose').PipelineStage[]],
    DashboardQuery<MessageCount[] | null>
  >;
  aggregate.returns(query);
  return aggregate;
}

function stubUserFind(result: Messenger[]) {
  const query = dashboardQuery(result);
  const find = sinon.stub(User, 'find') as unknown as QueryStub<
    Record<string, unknown>,
    Messenger[]
  >;
  find.returns(query);
  return find;
}

function stubThreadFind(result: DashboardThreadVote[] | null) {
  const query = dashboardQuery(result);
  const find = sinon.stub(ReferenceThread, 'find') as unknown as QueryStub<
    Record<string, unknown>,
    DashboardThreadVote[] | null
  >;
  find.returns(query);
  return find;
}

type DashboardBody = Record<string, object | string>;
type DashboardResponse = {
  statusCode: number;
  body: DashboardBody | null;
  status(code: number): DashboardResponse;
  send(body: DashboardBody): DashboardResponse;
  waitForResponse(): Promise<DashboardResponse & { body: DashboardBody }>;
};

function mockResponse(): DashboardResponse {
  let resolveResponse!: (
    response: DashboardResponse & { body: DashboardBody },
  ) => void;
  const promise = new Promise<DashboardResponse & { body: DashboardBody }>(
    resolve => {
      resolveResponse = resolve;
    },
  );
  const res: DashboardResponse = {
    statusCode: 200,
    body: null,
    waitForResponse: () => promise,
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      resolveResponse(res as DashboardResponse & { body: DashboardBody });
      return res;
    },
  };
  return res;
}

describe('Admin dashboard controller unit tests', () => {
  let findNegativeExperiences: QueryStub<
    DashboardFilter,
    DashboardNegativeExperience[] | null
  >;

  beforeEach(() => {
    const query = dashboardQuery<DashboardNegativeExperience[] | null>([]);
    findNegativeExperiences = sinon.stub(
      Experience,
      'find',
    ) as unknown as QueryStub<
      DashboardFilter,
      DashboardNegativeExperience[] | null
    >;
    findNegativeExperiences.returns(query);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns top messengers and recent negative thread votes', async () => {
    const messengerId = new mongoose.Types.ObjectId();
    const messenger: Messenger = {
      _id: messengerId,
      displayName: 'Top Sender',
      username: 'topsender',
    };
    const threadVote: DashboardThreadVote = {
      _id: new mongoose.Types.ObjectId(),
      reference: 'no',
    };
    const negativeExperience: DashboardNegativeExperience = {
      _id: new mongoose.Types.ObjectId(),
      recommend: 'no',
    };
    const negativeExperienceQuery = dashboardQuery([negativeExperience]);
    const negativeExperienceSort = sinon.spy(negativeExperienceQuery, 'sort');
    const negativeExperienceLimit = sinon.spy(negativeExperienceQuery, 'limit');
    findNegativeExperiences.returns(negativeExperienceQuery);

    stubAggregate([{ _id: messengerId, messageCount: 7 }]);
    stubUserFind([messenger]);
    const findThreadVotes = stubThreadFind([threadVote]);

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.should.deepEqual({
      negativeExperiences: [negativeExperience],
      threadVotes: [threadVote],
      topMessengers: [
        {
          messageCount: 7,
          user: messenger,
        },
      ],
    });
    sinon.assert.calledOnceWithExactly(findNegativeExperiences, {
      recommend: 'no',
      removedAt: { $exists: false },
    });
    sinon.assert.calledOnceWithExactly(negativeExperienceSort, '-created');
    sinon.assert.calledOnceWithExactly(negativeExperienceLimit, 10);
    sinon.assert.calledOnceWithExactly(findThreadVotes, { reference: 'no' });
  });

  it('uses empty dashboard lists when dashboard queries return null', async () => {
    findNegativeExperiences.returns(dashboardQuery(null));
    stubAggregate(null);
    stubThreadFind(null);

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.should.deepEqual({
      negativeExperiences: [],
      threadVotes: [],
      topMessengers: [],
    });
  });

  it('keeps fallback messenger identities when their profiles are unavailable', async () => {
    const missingMessengerId = new mongoose.Types.ObjectId();
    stubAggregate([
      { _id: null, messageCount: 1 },
      { _id: missingMessengerId, messageCount: 2 },
    ]);
    stubUserFind([]);
    stubThreadFind([]);

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.body.topMessengers.should.deepEqual([
      { messageCount: 1, user: null },
      { messageCount: 2, user: { _id: missingMessengerId } },
    ]);
  });

  it('returns an error response when dashboard queries fail', async () => {
    stubAggregate(null, new Error('db failed'));

    const res = mockResponse();
    adminDashboard.getDashboard({}, res);
    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.startWith('Snap! Something went wrong.');
  });
});
