/**
 * Unit tests for the admin audit log controller.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const adminAuditLog = require('../../server/controllers/admin.audit-log.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const AuditLog = mongoose.model('AuditLog');

function mockResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
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
        get(header) {
          if (header === 'X-Forwarded-For') {
            return '203.0.113.10';
          }
          return null;
        },
        ip: '127.0.0.1',
      };

      await new Promise((resolve, reject) => {
        adminAuditLog.record(req, {}, err => {
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
      items[0].body.action.should.equal('search');
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
        get(header) {
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

      await new Promise((resolve, reject) => {
        adminAuditLog.record(req, {}, err => {
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
      sinon.stub(AuditLog.prototype, 'save').callsFake(cb => {
        cb(new Error('save failed'));
      });
      let nextCalled = false;

      await new Promise(resolve => {
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

      res.body.length.should.equal(1);
      res.body[0].user.username.should.equal(user.username);
    });

    it('returns 400 when audit log lookup fails', async () => {
      sinon.stub(AuditLog, 'find').returns({
        sort: () => ({
          limit: () => ({
            populate: () => ({
              exec: cb => cb(new Error('lookup failed')),
            }),
          }),
        }),
      });

      const res = mockResponse();
      adminAuditLog.list({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });
});
