const _ = require('lodash'),
      mongoose = require('mongoose'),
      path = require('path'),
      request = require('supertest'),
      should = require('should'),
      sinon = require('sinon'),
      utils = require(path.resolve('./testutils/data.server.testutils')),
      userProfile = require(path.resolve('./modules/users/server/controllers/users.profile.server.controller')),
      express = require(path.resolve('./config/lib/express'));

describe('Read a single reference by reference id', () => {
  // GET /references/:referenceId
  // logged in public user can read a single public reference by id
  // .....                 can read a single private reference if it is from self
  // logged in public user can not read other private references
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  const _usersPublic = utils.generateUsers(3, { public: true });
  const _usersPrivate = utils.generateUsers(1, { public: false, username: 'private', email: 'non@example.com' });
  const _users = [..._usersPublic, ..._usersPrivate];

  let users,
      references;

  beforeEach(() => {
    sinon.useFakeTimers({ now: new Date('2019-01-13 13:21:55.1'), toFake: ['Date'] });
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
   *   0 1 2
   * 0 . T F
   * 1 F . T
   * 2 T F .
   */
  const referenceData = [
    [0, 1], [0, 2, { public: false }],
    [1, 0, { public: false }], [1, 2],
    [2, 0], [2, 1, { public: false }]
  ];

  beforeEach(async () => {
    const _references = utils.generateReferences(users, referenceData);
    references = await utils.saveReferences(_references);
  });

  afterEach(utils.clearDatabase);

  context('logged in as public user', () => {

    beforeEach(utils.signIn.bind(this, _usersPublic[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('read a single public reference by id', async () => {
      const { body } = await agent
        .get(`/api/references/${references[3]._id}`)
        .expect(200);

      // pre-collect expected values of users
      const userFields = userProfile.userMiniProfileFields.split(' ').slice(2);
      const userFromExp = _.pick(users[1], userFields);
      userFromExp._id = users[1]._id.toString();
      const userToExp = _.pick(users[2], userFields);
      userToExp._id = users[2]._id.toString();

      should(body).eql({
        public: true,
        userFrom: userFromExp,
        userTo: userToExp,
        created: new Date().toISOString(),
        _id: references[3]._id.toString(),
        interactions: {
          met: references[3].interactions.met,
          hostedMe: references[3].interactions.hostedMe,
          hostedThem: references[3].interactions.hostedThem
        },
        recommend: references[3].recommend
      });
    });

    it('read a single private reference if it is from self', async () => {
      const { body } = await agent
        .get(`/api/references/${references[1]._id}`)
        .expect(200);

      should(body).match({
        public: false,
        _id: references[1]._id.toString()
      });
    });

    it('[private reference to self] display in limited form', async () => {
      const { body } = await agent
        .get(`/api/references/${references[2]._id}`)
        .expect(200);

      should(body).match({
        public: false,
        _id: references[2]._id.toString(),
        created: new Date().toISOString()
      });

      should(body).have.only.keys('userFrom', 'userTo', '_id', 'public', 'created');
    });

    it('[private references not from self] 404', async () => {
      const { body } = await agent
        .get(`/api/references/${references[5]._id}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
        details: {
          reference: 'not found'
        }
      });
    });

    it('[reference doesn\'t exist] 404', async () => {
      const { body } = await agent
        .get(`/api/references/${'a'.repeat(24)}`)
        .expect(404);

      should(body).eql({
        message: 'Not found.',
        details: {
          reference: 'not found'
        }
      });
    });

    it('[invalid referenceId] 400', async () => {
      const { body } = await agent
        .get('/api/references/foo')
        .expect(400);

      should(body).eql({
        message: 'Bad request.',
        details: {
          referenceId: 'invalid'
        }
      });
    });
  });

  context('logged in as non-public user', () => {
    beforeEach(utils.signIn.bind(this, _usersPrivate[0], agent));
    afterEach(utils.signOut.bind(this, agent));

    it('403', async () => {
      await agent
        .get(`/api/references/${references[3]._id}`)
        .expect(403);
    });
  });

  context('not logged in', () => {
    it('403', async () => {
      await agent
        .get(`/api/references/${references[3]._id}`)
        .expect(403);
    });
  });
});
