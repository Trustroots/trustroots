import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import type { UserRecord } from '../../../../testutils/server/model-contracts.mts';

const mongoose: typeof import('mongoose') = require('mongoose');
interface BuildMetadata {
  committedAt: string;
  commitUrl: string;
  shortCommit: string;
}
interface SupportEmailData {
  category: string;
  message: string;
  username: string;
  email: string;
  emailTemp: string | boolean;
  displayName: string;
  userId: string;
  userAgent: string;
  authenticated: 'yes' | 'no';
  profilePublic: 'yes' | 'no';
  signupDate: string;
  reportMember: string | false;
  build: BuildMetadata | false;
}
interface SupportStatPoint {
  namespace: 'supportRequest';
  counts: { count: number };
  tags: { authenticated: 'yes' | 'no'; category: string; type: string };
}
interface EmailServiceModule {
  sendSupportRequest(
    replyTo: { address: string; name?: string },
    data: SupportEmailData,
    callback: (error?: Error | null) => void,
  ): void;
}
interface StatsServiceModule {
  stat(point: SupportStatPoint, callback: () => void): void;
}
interface StoredSupportRequest {
  category?: string;
  email?: string;
  message?: string;
  reportMember?: string;
  user?: Types.ObjectId;
  userAgent?: string;
  username?: string;
}
const emailService: EmailServiceModule = require('../../../core/server/services/email.server.service.mjs');
const statsService: StatsServiceModule = require('../../../stats/server/services/stats.server.service.mts');
const config: typeof import('../../../../config/config.mts') & {
  supportEmail: string;
} = require('../../../../config/config.mts');
const winston: typeof import('winston') = require('winston');
require('./../../server/models/support.server.model.mjs');
const sinon: typeof import('sinon') = require('sinon');

require('should');

interface SupportResponseBody {
  message: string;
}
interface MockResponse {
  statusCode: number;
  body: SupportResponseBody;
  status(code: number): this;
  json(body: SupportResponseBody): this;
  send(body: SupportResponseBody): this;
  waitForResponse(): Promise<MockResponse>;
}
interface TestSupportRequest {
  body?: Record<string, unknown>;
  headers?: { 'user-agent'?: string };
  app?: { locals?: { appSettings?: { build?: BuildMetadata } } };
  user?: UserRecord & { _id: Types.ObjectId; created: Date };
}
function mockResponse(): MockResponse {
  let resolveResponse!: (response: MockResponse) => void;
  const promise = new Promise<MockResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: MockResponse = {
    statusCode: 200,
    body: { message: '' },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: SupportResponseBody) {
      this.body = body;
      resolveResponse(this);
      return this;
    },
    send(body: SupportResponseBody) {
      this.body = body;
      resolveResponse(this);
      return this;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

type SupportController = Pick<
  typeof import('../../server/controllers/support.server.controller.mjs'),
  'supportRequest'
>;
async function loadController(
  options: {
    saveError?: Error;
    saveReject?: boolean;
    emailError?: Error;
  } = {},
) {
  const User = mongoose.model<UserRecord>('User');
  sinon.stub(User, 'findOne').returns({
    select: async () => ({ _id: new mongoose.Types.ObjectId() }),
  } as unknown as ReturnType<typeof User.findOne>);
  const savedSupportRequests: StoredSupportRequest[] = [];
  interface SupportRequestDocument extends StoredSupportRequest {
    save(callback: (error?: Error | null) => void): void;
  }
  const SupportRequest =
    mongoose.model<SupportRequestDocument>('SupportRequest');
  sinon.stub(SupportRequest.prototype, 'save').callsFake(function (
    this: SupportRequestDocument,
    ...args: unknown[]
  ) {
    savedSupportRequests.push(
      Object.fromEntries(
        Object.entries({
          category: this.category,
          email: this.email,
          message: this.message,
          reportMember: this.reportMember,
          user: this.user,
          userAgent: this.userAgent,
          username: this.username,
        }).filter(([, value]) => value !== undefined),
      ),
    );
    const callback = args[0];
    if (typeof callback === 'function') {
      (callback as (error: Error | null) => void)(options.saveError || null);
      return;
    }
    return options.saveReject || options.saveError
      ? Promise.reject(options.saveError)
      : Promise.resolve();
  });
  const sendSupportRequest = sinon
    .stub(emailService, 'sendSupportRequest')
    .callsFake((replyTo, data, callback) =>
      callback(options.emailError || null),
    );
  const stat = sinon
    .stub(statsService, 'stat')
    .callsFake((statsObject, callback) => callback());
  const log = sinon.stub(winston.Logger.prototype, 'log');
  sinon.stub(config, 'supportEmail').value('support@example.test');
  const importedController =
    await import('../../server/controllers/support.server.controller.mjs');
  const controller: SupportController & {
    supportRequest(
      request: TestSupportRequest,
      response: MockResponse,
    ): Promise<unknown>;
  } = {
    ...importedController,
    supportRequest: (request, response) =>
      importedController.supportRequest(
        request as unknown as Request,
        response as unknown as Response,
      ),
  };

  return {
    controller,
    log,
    savedSupportRequests,
    sendSupportRequest,
    stat,
  };
}

describe('Support controller unit tests', () => {
  afterEach(() => sinon.restore());
  const build = {
    committedAt: '2026-06-21 18:06',
    commitUrl:
      'https://github.com/Trustroots/trustroots/commit/7a1d63965692fdb3361d3fd9ad1a6a17fb391b92',
    shortCommit: '7a1d639',
  };

  it('sends a guest support request and records normal guest stats', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.body.message.should.equal('Support request sent.');
    harness.sendSupportRequest.calledOnce.should.be.true();
    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({ address: 'guest@example.com' });
    supportRequestData.should.containEql({
      authenticated: 'no',
      displayName: '-',
      email: 'guest@example.com',
      emailTemp: false,
      message: 'Need help',
      profilePublic: 'no',
      reportMember: false,
      signupDate: '-',
      userAgent: 'TestAgent',
      userId: '-',
      username: 'guest',
    });
    harness.savedSupportRequests[0].should.deepEqual({
      category: 'other',
      email: 'guest@example.com',
      message: 'Need help',
      userAgent: 'TestAgent',
      username: 'guest',
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'no',
      category: 'other',
      type: 'normal',
    });
  });

  it('adds build metadata to the support email data', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        app: {
          locals: {
            appSettings: {
              build,
            },
          },
        },
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    await res.waitForResponse();

    const supportRequestData = harness.sendSupportRequest.firstCall.args[1];
    supportRequestData.build.should.deepEqual(build);
  });

  it('falls back to support email for invalid guest reply-to addresses', async () => {
    const harness = await loadController();
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          email: 'not an email',
          username: 'guest',
        },
        headers: {},
      },
      res,
    );

    await res.waitForResponse();

    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({ address: 'support@example.test' });
    supportRequestData.message.should.equal('—');
    supportRequestData.userAgent.should.equal('—');
  });

  it('uses signed-in user data for reply-to, storage, and stats', async () => {
    const harness = await loadController();
    const res = mockResponse();
    const created = new Date('2026-01-02T03:04:05.000Z');
    const userId = new mongoose.Types.ObjectId();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Hello',
          email: 'ignored@example.com',
          reportMember: 'reported-user',
          username: 'ignored',
        },
        headers: { 'user-agent': 'UserAgent' },
        user: {
          _id: userId,
          created,
          displayName: 'User Name',
          email: 'user@example.com',
          emailTemporary: 'temporary@example.com',
          public: true,
          username: 'username',
        },
      },
      res,
    );

    await res.waitForResponse();

    const [replyTo, supportRequestData] =
      harness.sendSupportRequest.firstCall.args;
    replyTo.should.deepEqual({
      address: 'user@example.com',
      name: 'User Name',
    });
    supportRequestData.should.containEql({
      authenticated: 'yes',
      displayName: 'User Name',
      email: 'user@example.com',
      emailTemp: 'temporary@example.com',
      profilePublic: 'yes',
      reportMember: 'reported-user',
      signupDate: created.toString(),
      userId: userId.toString(),
      username: 'username',
    });
    harness.savedSupportRequests[0].should.containEql({
      category: 'reportMember',
      reportMember: 'reported-user',
      user: userId,
    });
    harness.stat.firstCall.args[0].tags.should.deepEqual({
      authenticated: 'yes',
      category: 'reportMember',
      type: 'reportMember',
    });
  });

  it('continues and sends email when DB save fails', async () => {
    const harness = await loadController({ saveError: new Error('db down') });
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.body.message.should.equal('Support request sent.');
    harness.sendSupportRequest.calledOnce.should.be.true();
    harness.log
      .calledWith('error', 'Failed storing support request to the DB. #39ghsa')
      .should.be.true();
  });

  it('continues without logging when the save rejects without a value', async () => {
    const harness = await loadController({ saveReject: true });
    const res = mockResponse();
    harness.controller.supportRequest(
      {
        body: { message: 'Need help', email: 'guest@example.com' },
        headers: {},
      },
      res,
    );

    const response = await res.waitForResponse();
    response.body.message.should.equal('Support request sent.');
    harness.log
      .calledWith('error', 'Failed storing support request to the DB. #39ghsa')
      .should.be.false();
  });

  for (const category of [
    'account',
    'reportMember',
    'reportBug',
    'volunteering',
    'other',
  ]) {
    it(`stores and emails the ${category} category`, async () => {
      const harness = await loadController();
      const res = mockResponse();
      harness.controller.supportRequest(
        {
          body: {
            category,
            message: 'Support enquiry.',
            email: 'visitor@example.test',
            reportMember: 'example-member',
          },
          headers: {},
        },
        res,
      );
      await res.waitForResponse();
      harness.savedSupportRequests[0]!.category!.should.equal(category);
      const data = harness.sendSupportRequest.firstCall.args[1];
      data.category.should.equal(category);
      harness.stat.firstCall.args[0].tags.should.containEql({
        category,
        type: category === 'reportMember' ? 'reportMember' : 'normal',
      });
      if (category === 'reportMember') {
        data.reportMember.should.equal('example-member');
        harness.savedSupportRequests[0]!.reportMember!.should.equal(
          'example-member',
        );
      } else {
        data.reportMember.should.equal(false);
        require('should').not.exist(
          harness.savedSupportRequests[0]!.reportMember,
        );
      }
    });
  }

  for (const category of [
    'unknown',
    'toString',
    '__proto__',
    '',
    null,
    ['other'],
    {},
  ]) {
    it(`rejects invalid category ${JSON.stringify(
      category,
    )} before storage or delivery`, async () => {
      const harness = await loadController();
      const res = mockResponse();
      harness.controller.supportRequest(
        { body: { category, message: 'Support enquiry.' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      harness.savedSupportRequests.length.should.equal(0);
      harness.sendSupportRequest.called.should.equal(false);
      harness.stat.called.should.equal(false);
    });
  }

  it('returns 400 and does not record stats when email send fails', async () => {
    const harness = await loadController({
      emailError: new Error('smtp failed'),
    });
    const res = mockResponse();

    harness.controller.supportRequest(
      {
        body: {
          message: 'Need help',
          email: 'guest@example.com',
          username: 'guest',
        },
        headers: { 'user-agent': 'TestAgent' },
      },
      res,
    );

    const response = await res.waitForResponse();

    response.statusCode.should.equal(400);
    response.body.message.should.containEql('Failure while sending');
    harness.stat.called.should.be.false();
    harness.log
      .calledWith('error', 'Failed sending support request via email. #49ghsd')
      .should.be.true();
  });
});
