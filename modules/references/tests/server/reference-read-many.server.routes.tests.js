const mongoose = require('mongoose');
const path = require('path');
const request = require('supertest');
const should = require('should');
const sinon = require('sinon');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));
const userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller'));
const express = require(path.resolve('./config/lib/express'));

describe('Read references by userFrom Id or userTo Id', () => {
  // GET /references?userFrom=:UserId&userTo=:UserId

  // logged in public user can read all public references by userFrom
  // ...                   can read all public references by userTo
  // ...                   can read all public and private references from self
  // ...                   can not read private references to self
  // ...                   can read a specific reference by specifying userFrom and userTo
  // when userFrom or userTo doesn't exist, we simply return empty list
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  let users;

  const _usersPublic = utils.generateUsers(6, { public: true });
  const _usersPrivate = utils.generateUsers(3, {
    public: false,
    username: 'nonpublic',
    email: 'nonpublic@example.com'
  });
  const _users = [..._usersPublic, ..._usersPrivate];

  beforeEach(() => {
    sinon.useFakeTimers({ now: new Date('2018-01-12'), toFake: ['Date'] });
  });

  afterEach(() => {
    sinon.restore();
  });

  beforeEach(async () => {
    users = await utils.saveUsers(_users);
  });

  /**
   * array of [userFrom, userTo, values]
   *
   * Overview of the referenceData
   * - row: userFrom - index of user within array of users provided to utils.generateReferences()
   * - column: userTo - same as row
   * - T: reference exists and is public
   * - F: reference exists and is not public
   * - .: reference doesn't exist
   *
   *   0 1 2 3 4 5
   * 0 . T T F F T
   * 1 T . T T . T
   * 2 T . . T F T
   * 3 T . F . . .
   * 4 F . . . . .
   * 5 T . . . . .
   */
  const referenceData = [
    [0, 1], [0, 2], [0, 3, { public: false }], [0, 4, { public: false }], [0, 5],
    [1, 0], [1, 2], [1, 3], [1, 5],
    [2, 0], [2, 3], [2, 4, { public: false }], [2, 5],
    [3, 0], [3, 2, { public: false }],
    [4, 0, { public: false }],
    [5, 0]
  ];

  beforeEach(async () => {
    const _references = utils.generateReferences(users, referenceData);

    await utils.saveReferences(_references);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {

    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('[param userFrom] respond with all public references from userFrom', async () => {
      const { body } = await agent
        .get(`/api/references?userFrom=${users[2]._id}`)
        .expect(200);

      // user2 gave 3 public and 1 non-public references
      should(body).be.Array().of.length(3);
    });

    it('the references in response have expected structure, userFrom & userTo have miniProfile', async () => {
      const { body } = await agent
        .get(`/api/references?userFrom=${users[2]._id}`)
        .expect(200);

      for (const ref of body) {
        should(ref)
          .have.property('userFrom')
          .which.is.Object()
          .with.properties(userProfile.userMiniProfileFields.split(' ').slice(2, -1));

        should(ref)
          .have.property('userTo')
          .which.is.Object()
          .with.properties(userProfile.userMiniProfileFields.split(' ').slice(2, -1));

        should(ref).have.propertyByPath('interactions', 'met').Boolean();
        should(ref).have.propertyByPath('interactions', 'hostedMe').Boolean();
        should(ref).have.propertyByPath('interactions', 'hostedThem').Boolean();
        should(ref).have.property('public', true);
        should(ref).have.property('created', new Date().toISOString());
        should(ref).have.property('recommend').oneOf('yes', 'no', 'unknown');
        should(ref).have.property('_id').String().match(/[0-9a-f]{24}/);
      }
    });

    it('[param userTo] respond with all public references to userTo', async () => {
      const { body } = await agent
        .get(`/api/references?userTo=${users[2]._id}`)
        .expect(200);

      // user2 has received 2 public and 1 non-public reference
      should(body).be.Array().of.length(2);
    });

    it('[params userFrom and userTo] respond with 1 or 0 public reference from userFrom to userTo', async () => {
      const { body } = await agent
        .get(`/api/references?userFrom=${users[2]._id}&userTo=${users[5]._id}`)
        .expect(200);

      // there is 1 public reference from user2 to user5
      should(body).be.Array().of.length(1);
    });

    it('[userFrom is self] display all public and private references from userFrom', async () => {
      const { body } = await agent
        .get('/api/references?userFrom=' + users[0]._id)
        .expect(200);

      // user0 has given 3 public and 2 non-public reference
      // and should see all 5 of them
      should(body).be.Array().of.length(5);

      const nonpublic = body.filter(ref => !ref.public);
      should(nonpublic).length(2);
      // the reference details are also present
      should(nonpublic[0]).have.keys('recommend', 'interactions');
      should(nonpublic[0].interactions).have.keys('met', 'hostedMe', 'hostedThem');
    });

    it('[userTo is self] private references are included in limited form (only userFrom, userTo, public, created)', async () => {
      const { body } = await agent
        .get(`/api/references?userTo=${users[0]._id}`)
        .expect(200);

      // user0 has received 4 public and 1 non-public reference
      // and should see all 5 of them
      // but the 1 non-public should have only fields userFrom, userTo, public, created
      should(body).be.Array().of.length(5);

      const nonpublic = body.filter(ref => !ref.public);
      should(nonpublic).be.Array().of.length(1);
      should(nonpublic[0]).match({
        public: false,
        created: new Date().toISOString()
      });
      should(nonpublic[0]).have.only.keys('_id', 'userFrom', 'userTo', 'created', 'public');
    });

    it('[no params] 400 and error', async () => {
      const { body } = await agent
        .get('/api/references')
        .expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          userFrom: 'missing',
          userTo: 'missing'
        }
      });
    });

    it('[invalid params] 400 and error', async () => {
      const { body } = await agent
        .get('/api/references?userFrom=asdf&userTo=1')
        .expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          userFrom: 'invalid',
          userTo: 'invalid'
        }
      });
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent
        .get(`/api/references?userFrom=${users[2]._id}`)
        .expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent
        .get(`/api/references?userFrom=${users[2]._id}`)
        .expect(403);
    });
  });
});
