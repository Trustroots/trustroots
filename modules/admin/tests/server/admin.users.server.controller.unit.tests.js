/**
 * Unit tests for uncovered admin users controller paths.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const adminUsers = require('../../server/controllers/admin.users.server.controller');
const errorService = require('../../../core/server/services/error.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
const should = require('should');

const User = mongoose.model('User');

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

describe('Admin users controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('searchUsers', () => {
    it('rejects queries shorter than three characters', () => {
      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'ab' } }, res);

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        'Query string at least 3 characters long required.',
      );
    });

    it('returns 400 when the database lookup fails', async () => {
      sinon.stub(User, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              exec: cb => cb(new Error('search failed')),
            }),
          }),
        }),
      });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('obfuscates sensitive tokens in search results', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      userDoc.removeProfileToken = 'remove-token';
      userDoc.resetPasswordToken = 'reset-token';
      await userDoc.save();

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: userDoc.username } }, res);
      await res.waitForResponse();

      res.body.length.should.equal(1);
      res.body[0].removeProfileToken.should.equal('(Hidden from admins.)');
      res.body[0].resetPasswordToken.should.equal('(Hidden from admins.)');
    });

    it('obfuscates OAuth tokens in search results', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      userDoc.additionalProvidersData = {
        facebook: { accessToken: 'fb-access', refreshToken: 'fb-refresh' },
        github: { accessToken: 'gh-access', refreshToken: 'gh-refresh' },
        twitter: { token: 'tw-token', tokenSecret: 'tw-secret' },
      };
      await userDoc.save();

      sinon.stub(User, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              exec: cb => cb(null, [userDoc]),
            }),
          }),
        }),
      });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: userDoc.username } }, res);
      await res.waitForResponse();

      res.body.length.should.equal(1);
      res.body[0].additionalProvidersData.facebook.accessToken.should.equal(
        '(Hidden from admins.)',
      );
      res.body[0].additionalProvidersData.github.accessToken.should.equal(
        '(Hidden from admins.)',
      );
      res.body[0].additionalProvidersData.twitter.token.should.equal(
        '(Hidden from admins.)',
      );
    });

    it('returns an empty array when the database returns no users', async () => {
      sinon.stub(User, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              exec: cb => cb(null, null),
            }),
          }),
        }),
      });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      res.body.should.deepEqual([]);
    });

    it('keeps null database rows unchanged while obfuscating results', async () => {
      sinon.stub(User, 'find').returns({
        select: () => ({
          sort: () => ({
            limit: () => ({
              exec: cb => cb(null, [null]),
            }),
          }),
        }),
      });

      const res = mockResponse();
      adminUsers.searchUsers({ body: { search: 'abc' } }, res);
      await res.waitForResponse();
      res.body.should.deepEqual([undefined]);
    });

    it('throws when escaping a non-string search value', () => {
      (() =>
        adminUsers.searchUsers(
          { body: { search: { length: 3 } } },
          mockResponse(),
        )).should.throw('Expected a string');
    });
  });

  describe('listUsersByRole', () => {
    it('rejects an invalid role', async () => {
      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'not-a-role' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Invalid role.');
    });

    it('returns users with the requested role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(users[0]._id);
      userDoc.roles = ['user', 'volunteer'];
      await userDoc.save();

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      res.body.length.should.equal(1);
      res.body[0]._id.toString().should.equal(userDoc._id.toString());
    });

    it('returns 400 when the database lookup fails', async () => {
      sinon.stub(User, 'find').returns({
        select: () => ({
          sort: () => ({
            exec: cb => cb(new Error('role lookup failed')),
          }),
        }),
      });

      const res = mockResponse();
      adminUsers.listUsersByRole({ body: { role: 'volunteer' } }, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });
  });

  describe('getUser', () => {
    it('returns 400 for an invalid id', async () => {
      const res = mockResponse();
      await adminUsers.getUser({ body: { id: 'bad-id' } }, res);

      res.statusCode.should.equal(400);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('invalid-id'),
      );
    });

    it('returns 404 for missing users', async () => {
      const res = mockResponse();
      await adminUsers.getUser(
        { body: { id: new mongoose.Types.ObjectId().toString() } },
        res,
      );

      res.statusCode.should.equal(404);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('returns profile details for an existing user', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.getUser({ body: { id: users[0]._id.toString() } }, res);

      res.body.profile.username.should.equal(users[0].username);
      res.body.messageFromCount.should.equal(0);
    });

    it('returns 400 when loading a user fails', async () => {
      sinon.stub(User, 'findById').returns({
        select: () => ({
          populate: () => Promise.reject(new Error('lookup failed')),
        }),
      });

      const res = mockResponse();
      await adminUsers.getUser(
        { body: { id: new mongoose.Types.ObjectId().toString() } },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('changeRole', () => {
    it('promotes a volunteer and removes volunteer-alumni', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];
      target.roles = ['user', 'volunteer-alumni'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'volunteer' },
          user: admin,
        },
        res,
      );

      res.body.message.should.equal('Role changed.');

      const updated = await User.findById(target._id).exec();
      updated.roles.should.containEql('volunteer');
      updated.roles.should.not.containEql('volunteer-alumni');
    });

    it('promotes a user to volunteer-alumni and removes volunteer', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const admin = users[0];
      const target = users[1];
      target.roles = ['user', 'volunteer'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'volunteer-alumni' },
          user: admin,
        },
        res,
      );

      res.body.message.should.equal('Role changed.');

      const updated = await User.findById(target._id).exec();
      updated.roles.should.containEql('volunteer-alumni');
      updated.roles.should.not.containEql('volunteer');
    });

    it('returns 404 when the target user does not exist', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: {
            id: new mongoose.Types.ObjectId().toString(),
            role: 'suspended',
          },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(404);
      res.body.message.should.equal(
        errorService.getErrorMessageByKey('not-found'),
      );
    });

    it('rejects invalid roles', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const res = mockResponse();

      await adminUsers.changeRole(
        {
          body: { id: users[0]._id.toString(), role: 'admin' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
      res.body.message.should.equal('Invalid role.');
    });

    it('shadowbans a user and removes suspended role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const target = users[1];
      target.roles = ['user', 'suspended'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'shadowban' },
          user: users[0],
        },
        res,
      );

      const updated = await User.findById(target._id).exec();
      updated.roles.should.containEql('shadowban');
      updated.roles.should.not.containEql('suspended');
    });

    it('suspends a user and removes shadowban role', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      const target = users[1];
      target.roles = ['user', 'shadowban'];
      await target.save();

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: target._id.toString(), role: 'suspended' },
          user: users[0],
        },
        res,
      );

      const updated = await User.findById(target._id).exec();
      updated.roles.should.containEql('suspended');
      updated.roles.should.not.containEql('shadowban');
      updated.public.should.be.false();
    });

    it('returns 400 when updating a role fails', async () => {
      const users = await utils.saveUsers(utils.generateUsers(2));
      sinon.stub(User, 'updateOne').rejects(new Error('update failed'));

      const res = mockResponse();
      await adminUsers.changeRole(
        {
          body: { id: users[1]._id.toString(), role: 'suspended' },
          user: users[0],
        },
        res,
      );

      res.statusCode.should.equal(400);
    });
  });

  describe('usernameToUserId', () => {
    it('attaches a user id when the username exists', async () => {
      const users = await utils.saveUsers(utils.generateUsers(1));
      const req = { body: { username: users[0].username } };
      let nextCalled = false;

      await adminUsers.usernameToUserId(req, {}, () => {
        nextCalled = true;
      });

      nextCalled.should.equal(true);
      req.userIdFromUsername.toString().should.equal(users[0]._id.toString());
    });

    it('continues when the username is missing', async () => {
      const req = { body: {} };
      let nextCalled = false;

      await adminUsers.usernameToUserId(req, {}, () => {
        nextCalled = true;
      });

      nextCalled.should.equal(true);
      should.not.exist(req.userIdFromUsername);
    });
  });
});
