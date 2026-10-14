/**
 * Unit tests for the admin audit log controller.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

type AuditLogController =
  typeof import('../../server/controllers/admin.audit-log.server.controller.mts');
const adminAuditLog: Pick<
  AuditLogController,
  'record' | 'list'
> = require('./../../server/controllers/admin.audit-log.server.controller.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const should: typeof import('should') = require('should');

type AuditLogRecord = {
  body: Record<string, unknown>;
  ip: string;
  route: string;
  user: import('mongoose').Types.ObjectId | { username: string };
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
};
type AuditLogModel = import('mongoose').Model<AuditLogRecord>;
type AuditLogItem = AuditLogRecord & { user: { username: string } };
type TestQuery<T> =
  import('../../../../testutils/server/model-contracts.mts').TestQuery<T>;
type AuditLogResponse = {
  statusCode: number;
  body: unknown;
  status(code: number): AuditLogResponse;
  send(body: unknown): AuditLogResponse;
  waitForResponse(): Promise<AuditLogResponse>;
};

const AuditLog: AuditLogModel = mongoose.model<AuditLogRecord>('AuditLog');

function mockResponse(): AuditLogResponse {
  let resolveResponse: (response: AuditLogResponse) => void = () => {
    throw new Error('Response completion has not been initialised');
  };
  const promise = new Promise<AuditLogResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: AuditLogResponse = {
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
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

function auditLogItems(value: unknown): AuditLogItem[] {
  if (
    !Array.isArray(value) ||
    !value.every(
      (item): item is AuditLogItem =>
        typeof item === 'object' &&
        item !== null &&
        'body' in item &&
        typeof item.body === 'object' &&
        item.body !== null &&
        'ip' in item &&
        typeof item.ip === 'string' &&
        'route' in item &&
        typeof item.route === 'string' &&
        'user' in item &&
        typeof item.user === 'object' &&
        item.user !== null &&
        'username' in item.user &&
        typeof item.user.username === 'string',
    )
  ) {
    throw new Error('Expected populated audit log entries');
  }
  return value;
}

function stubFind(execute: () => Promise<AuditLogRecord[] | null>): void {
  const query: TestQuery<AuditLogRecord[] | null> = {
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    exec: execute,
  };
  sinon
    .stub(AuditLog, 'find')
    .returns(query as unknown as ReturnType<typeof AuditLog.find>);
}

function auditLogSaveCallback(value: unknown): value is (error: Error) => void {
  return typeof value === 'function';
}

describe('Admin audit log controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('record', () => {
    it('stores audit log entries and continues the middleware chain', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      let nextCalled = false;

      const req = {
        body: { action: 'search' },
        params: {},
        query: { q: 'foo' },
        route: { path: '/api/admin/users' },
        user,
        get(header: string): string | null {
          if (header === 'X-Forwarded-For') {
            return '203.0.113.10';
          }
          return null;
        },
        ip: '127.0.0.1',
      };

      await new Promise<void>((resolve, reject) => {
        adminAuditLog.record(req, {}, (err?: Error | null) => {
          if (err) {
            return reject(err);
          }
          nextCalled = true;
          resolve();
        });
      });

      nextCalled.should.equal(true);

      const items = await AuditLog.find({ user: user._id }).exec();
      items.length.should.equal(1);
      should(items[0].body.action).equal('search');
      items[0].ip.should.equal('203.0.113.10');
    });

    it('prefers the Passenger client address over X-Forwarded-For', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      let nextCalled = false;

      const req = {
        body: { action: 'search' },
        params: {},
        query: {},
        route: { path: '/api/admin/users' },
        user,
        get(header: string): string | null {
          if (header === '!~Passenger-Client-Address') {
            return '10.0.0.1';
          }
          if (header === 'X-Forwarded-For') {
            return '203.0.113.10';
          }
          return null;
        },
        ip: '127.0.0.1',
      };

      await new Promise<void>((resolve, reject) => {
        adminAuditLog.record(req, {}, (err?: Error | null) => {
          if (err) {
            return reject(err);
          }
          nextCalled = true;
          resolve();
        });
      });

      nextCalled.should.equal(true);
      const items = await AuditLog.find({ user: user._id }).exec();
      items[0].ip.should.equal('10.0.0.1');
    });

    it('still calls next when saving the audit log fails', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));
      sinon.stub(AuditLog.prototype, 'save').callsFake((...args: unknown[]) => {
        const callback = args[0];
        if (!auditLogSaveCallback(callback)) {
          throw new Error('Expected the audit log save callback');
        }
        callback(new Error('save failed'));
      });
      let nextCalled = false;

      await new Promise<void>(resolve => {
        adminAuditLog.record(
          {
            body: { action: 'search' },
            params: {},
            query: {},
            route: { path: '/api/admin/users' },
            user,
            get: () => null,
            ip: '127.0.0.1',
          },
          {},
          () => {
            nextCalled = true;
            resolve();
          },
        );
      });

      nextCalled.should.be.true();
    });
  });

  describe('list', () => {
    it('returns stored audit log entries', async () => {
      const [user] = await utils.saveUsers(utils.generateUsers(1));

      await new AuditLog({
        user: user._id,
        route: '/api/admin/users',
        body: { action: 'search' },
        ip: '127.0.0.1',
      }).save();

      const res = mockResponse();
      adminAuditLog.list({}, res);
      await res.waitForResponse();

      const entries = auditLogItems(res.body);
      entries.length.should.equal(1);
      entries[0].user.username.should.equal(user.username);
    });

    it('returns an empty array when audit log lookup returns null', async () => {
      stubFind(async () => null);

      const res = mockResponse();
      adminAuditLog.list({}, res);
      await res.waitForResponse();

      should(res.body).eql([]);
    });

    it('returns 400 when audit log lookup fails', async () => {
      stubFind(async () => {
        throw new Error('lookup failed');
      });

      const res = mockResponse();
      adminAuditLog.list({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });
});
