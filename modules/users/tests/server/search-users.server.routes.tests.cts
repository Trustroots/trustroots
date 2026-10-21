const request: typeof import('supertest') = require('supertest');
const _: typeof import('lodash') = require('lodash');
const sinon: typeof import('sinon') = require('sinon');
const mongoose: typeof import('mongoose') = require('mongoose');
const should: typeof import('should') = require('should');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const userHandler =
  require('./../../server/controllers/users.profile.server.controller.mjs') as typeof import('../../server/controllers/users.profile.server.controller.mjs').default;
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil');
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
interface SearchUserRecord extends UserRecord {
  gender?: string;
}
type SearchUserDocument = import('mongoose').HydratedDocument<SearchUserRecord>;
const User = mongoose.model<SearchUserRecord>('User');
type NewSearchUser = Partial<SearchUserRecord>;
type SearchResponseUser = Pick<SearchUserRecord, 'username'> &
  Partial<SearchUserRecord>;
type SearchResponse = SearchResponseUser[];
describe('Search users: GET /users?search=string', function () {
  let agent: import('supertest').Agent;
  const limit = 9;
  // initialize the testing environment
  before(async function () {
    // Stub the limit value
    sinon.stub(config.limits, 'paginationLimit').value(limit);
    // the limit is used in this config, so we needed to stub limit before importing this
    const express = require('./../../../../config/lib/express.mjs');
    // Get application
    const app = await express.init(mongoose.connection);
    agent = request.agent(app);
  });
  // rebuild indexes before tests
  before(function (done) {
    User.ensureIndexes()
      .then(() => done())
      .catch(done);
  });
  afterEach(utils.clearDatabase);
  after(function () {
    sinon.restore();
  });
  async function createUsers(
    users: NewSearchUser[],
  ): Promise<SearchUserDocument[]> {
    const createdUsers: SearchUserDocument[] = [];
    for (const [index, user] of users.entries()) {
      const createdUser = new User({
        username: user.username || 'user' + index,
        firstName: user.firstName || 'firstName' + index,
        lastName: user.lastName || 'lastName' + index,
        get email() {
          return this.username + '@example.com';
        },
        get displayName() {
          return this.firstName + ' ' + this.lastName;
        },
        get emailTemporary() {
          return this.email;
        },
        emailToken: 'initial email token',
        password: user.password || '******password',
        provider: 'local',
        public: _.has(user, 'public') ? user.public : true,
        gender: 'non-binary',
        locationFrom: user.locationFrom || 'Wonderland',
        locationLiving: user.locationLiving || 'Sampleton',
        tagline: user.tagline || '',
        roles: user.roles || ['user'],
      });
      createdUsers.push(createdUser);
      await createdUser.save();
    }
    return createdUsers;
  }
  context('not logged in', function () {
    it('Forbidden 403', function (done) {
      agent.get('/api/users?search=aaaBc').expect(403).end(done);
    });
  });
  context('logged in', function () {
    let loggedUser: SearchUserDocument;
    // create logged user
    beforeEach(async function () {
      const users = await createUsers([
        {
          username: 'loggedUser',
          password: 'somepassword',
        },
      ]);
      loggedUser = users[0];
    });
    // sign in
    beforeEach(function (done) {
      agent
        .post('/api/auth/signin')
        .send({
          username: loggedUser.username,
          password: 'somepassword',
        })
        .expect(200)
        .end(done);
    });
    // sign out
    afterEach(function (done) {
      agent
        .post('/api/auth/signout')
        .set('Origin', 'http://localhost:3000')
        .expect(302)
        .end(done);
    });
    context('valid request', function () {
      it('caps result count even when a larger limit is requested', function (done) {
        // These profiles are only searched, so reuse the signed-in fixture's
        // hash and insert them without running password hashing for every row.
        User.insertMany(
          Array.from({ length: 55 }, (_, index) => ({
            username: 'boundedmember' + index,
            firstName: 'Capped',
            lastName: 'Member',
            displayName: 'Capped Member',
            email: 'boundedmember' + index + '@example.com',
            password: loggedUser.password,
            provider: 'local',
            public: true,
            roles: ['user'],
          })),
        )
          .then(() => {
            agent
              .get('/api/users?search=Capped&limit=100')
              .expect(200)
              .end(function (error, response) {
                if (error) return done(error);
                (response.body as SearchResponse).should.have.length(50);
                done();
              });
          })
          .catch(done);
      });
      it('excludes members blocked in either direction from location results', async function () {
        const members = await createUsers([
          { username: 'blockedbyviewer', locationLiving: 'Exampleville' },
          { username: 'blockingviewer', locationLiving: 'Exampleville' },
          { username: 'visiblemember', locationLiving: 'Exampleville' },
        ]);
        await Promise.all([
          User.updateOne(
            { _id: loggedUser._id },
            { $set: { blocked: [members[0]._id] } },
          ),
          User.updateOne(
            { _id: members[1]._id },
            { $set: { blocked: [loggedUser._id] } },
          ),
        ]);
        const response = await agent
          .get('/api/users?search=Exampleville')
          .expect(200);
        (response.body as SearchResponse)
          .map(member => member.username)
          .should.eql(['visiblemember']);
      });
      it('finds public locations and taglines, ranking names higher', async function () {
        await createUsers([
          { username: 'riverside' },
          { username: 'locationmatch', locationLiving: 'Riverside' },
          { username: 'originmatch', locationFrom: 'Riverside' },
          {
            username: 'taglinematch',
            tagline: 'Riverside pottery enthusiast',
          },
          {
            username: 'privatematch',
            locationLiving: 'Riverside',
            public: false,
          },
          {
            username: 'suspendedmatch',
            locationLiving: 'Riverside',
            roles: ['suspended'],
          },
          {
            username: 'shadowmatch',
            locationLiving: 'Riverside',
            roles: ['shadowban'],
          },
        ]);
        const response = await agent
          .get('/api/users?search=Riverside')
          .expect(200);
        (response.body as SearchResponse)
          .map(member => member.username)
          .should.eql([
            'riverside',
            'locationmatch',
            'originmatch',
            'taglinematch',
          ]);
        (response.body as SearchResponse)[3]!.tagline!.should.eql(
          'Riverside pottery enthusiast',
        );
      });
      it('[a username matched] return array of users', async function () {
        // create some users
        await createUsers([
          {
            username: 'asdf',
          },
          {
            username: 'asdfg',
          },
          {
            username: 'asdia',
          },
          {
            username: 'hasdfg',
          },
        ]);
        // search
        const response = await agent.get('/api/users?search=asdia').expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(1);
      });
      it('[some given names matched] return array of users', async function () {
        // create some users
        await createUsers([
          {
            firstName: 'qwer',
          },
          {
            firstName: 'qwera',
          },
          {
            firstName: 'qwery',
          },
          {
            firstName: 'qwer',
          },
          {
            firstName: 'qwe',
          },
          {
            firstName: 'sqwero',
          },
        ]);
        // search
        const response = await agent.get('/api/users?search=qwer').expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(2);
      });
      it('[some family names matched] return array of users', async function () {
        // create some users
        await createUsers([
          {
            lastName: 'zxcvbna',
          },
          {
            lastName: 'zxcvbnrya',
          },
          {
            lastName: 'zxcvb',
          },
          {
            lastName: 'zxcvbny',
          },
          {
            lastName: 'zxcvb',
          },
          {
            lastName: 'zxcvba',
          },
          {
            lastName: 'zxcvz',
          },
          {
            lastName: 'asdia',
          },
          {
            lastName: 'hasdfg',
          },
        ]);
        // search
        const response = await agent.get('/api/users?search=zxcvb').expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(2);
      });
      it('[full names matched] return array of users', async function () {
        // create some users
        await createUsers([
          {
            firstName: 'jacob',
            lastName: 'alia',
          },
          {
            firstName: 'jacob',
            lastName: 'alib',
          },
          {
            firstName: 'jAcob',
            lastName: 'alic',
          },
          {
            firstName: 'jaCob',
            lastName: 'alid',
          },
          {
            firstName: 'jacob',
            lastName: 'aliE',
          },
          {
            firstName: 'jacob',
            lastName: 'alIA',
          },
          {
            firstName: 'jaco',
            lastName: 'alg',
          },
        ]);
        // search
        const response = await agent
          .get('/api/users?search=jacob+aLia')
          .expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(6);
      });
      it('[none matched] return empty array', async function () {
        // create some users
        await createUsers([
          {
            lastName: 'zxcvbna',
          },
          {
            username: 'zxcvba',
          },
          {
            firstName: 'xcvz',
          },
          {
            lastName: 'asdia',
          },
          {
            username: 'hasdfg',
          },
        ]);
        // search
        const response = await agent.get('/api/users?search=aeiou').expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(0);
      });
      it('the user data should have only fields from searchProfile, and score', async function () {
        // create some users
        await createUsers([
          {
            username: 'aaa',
          },
        ]);
        // search
        const response = await agent.get('/api/users?search=aaa').expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(1);
        // _id is not specified in userSearchProfileFields, but gets included anyways
        // that's just how mongo works
        const expectedFields = userHandler.userSearchProfileFields
          .split(' ')
          .concat(['_id']);
        const actualFields = _.keys(foundUsers[0]);
        const unexpectedFields = _.difference(actualFields, expectedFields);
        should(unexpectedFields).eql(['score']);
      });
      context('limit the amount of results and pagination', function () {
        // create some users
        const testUsers = [
          {
            username: 'aaaaaa',
          },
          {
            firstName: 'aaaaaa',
          },
          {
            lastName: 'aaaaaa',
          },
          {
            lastName: 'aaaaaa',
          },
          {
            firstName: 'aAaAaa',
          },
          {
            lastName: 'aaaaaa',
          },
          {
            firstName: 'aaaaaa',
          },
          {
            lastName: 'aaaaaa',
          },
          {
            firstName: 'aaaaaa',
          },
          {
            lastName: 'aaaaaa',
          },
          {
            firstName: 'aaaaaa',
          },
          {
            lastName: 'aaaaaa',
          },
        ];
        beforeEach(async function () {
          await createUsers(testUsers);
        });
        // TCs with different or missing page and limit parameters
        const pageTests = [
          {
            params: '',
            expected: limit,
          },
          {
            params: '&page=1',
            expected: limit,
          },
          {
            params: '&page=2',
            expected: testUsers.length - limit,
          },
          {
            params: '&limit=11',
            expected: 11,
          },
          {
            params: '&page=1&limit=11',
            expected: 11,
          },
          {
            params: '&page=2&limit=11',
            expected: testUsers.length - 11,
          },
        ];
        pageTests.forEach(function (test) {
          it(
            'should limit results to ' +
              test.expected +
              ', when param is ' +
              test.params,
            async function () {
              // search
              const response = await agent
                .get('/api/users?search=aaaaaa' + test.params)
                .expect(200);
              // check that we found the users
              should(response.body as SearchResponse).length(test.expected);
            },
          );
        });
      });
      it('search is case insensitive', async function () {
        // create some users
        await createUsers([
          {
            username: 'abcdef',
          },
          {
            firstName: 'abCdef',
          },
          {
            lastName: 'ABCdEF',
          },
          {
            username: 'aabc',
          },
        ]);
        // search
        const response = await agent
          .get('/api/users?search=abcdEf')
          .expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(3);
      });
      it('return only public users', async function () {
        // create some users
        await createUsers([
          {
            username: 'aabcdef',
            public: true,
          },
          {
            firstName: 'aAabCd',
            public: false,
          },
          {
            lastName: 'aaABCc',
            public: false,
          },
          {
            lastName: 'aaABCc',
            public: true,
          },
          // this one is not matched
          {
            firstName: 'aabCDef',
            lastName: 'aAbcdef',
            public: true,
          },
        ]);
        // search
        const response = await agent
          .get('/api/users?search=aabcdef')
          .expect(200);
        const foundUsers = response.body as SearchResponse;
        // check that we found the users
        should(foundUsers).length(2);
      });
    });
    context('invalid request', function () {
      it('rejects excessive pagination', function (done) {
        agent.get('/api/users?search=example&page=1000').expect(400).end(done);
      });
      it('[query string is less than 3 characters long] respond with 400', function (done) {
        agent
          .get('/api/users?search=aa')
          .expect(400)
          .end(function (err, res) {
            should(res.body.message).eql('Bad request.');
            should(res.body.detail).eql(
              'Query string should contain between 3 and 120 characters.',
            );
            done(err);
          });
      });
      for (const query of [
        'search=aaa&search=bbb',
        'search=' + 'a'.repeat(121),
        'search=%20%20%20',
      ]) {
        it('rejects invalid query ' + query.slice(0, 30), function (done) {
          agent
            .get('/api/users?' + query)
            .expect(400)
            .end(done);
        });
      }
    });
  });
});
