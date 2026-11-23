import importedDependency0 from './../../server/controllers/users.profile.server.controller.mts';
import { promisify } from 'node:util';
import request from 'supertest';
import sinon from 'sinon';
import mongoose from 'mongoose';
import should from 'should';
import config from './../../../../config/config.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import express from './../../../../config/lib/express.mts';

const userHandler =
  importedDependency0 as typeof import('../../server/controllers/users.profile.server.controller.mts').default;

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
type UserCreationCallback = (
  error: Error | null | undefined,
  users: SearchUserDocument[],
) => void;
type SearchCallback = (
  error: Error | null | undefined,
  result?: SearchResponse,
) => void;
type CreateCallback = (
  error: Error | null | undefined,
  users: SearchUserDocument[],
) => void;
type FinishedCallback = (error?: Error | null) => void;
describe('Search users: GET /users?search=string', function () {
  let agent: import('supertest').Agent;
  const limit = 9;
  // initialize the testing environment
  before(async function () {
    // Stub the limit value
    sinon.stub(config.limits, 'paginationLimit').value(limit);
    // the limit is used in this config, so we needed to stub limit before importing this

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
  function createUsers(
    users: NewSearchUser[],
    callback: UserCreationCallback,
  ): void {
    const createdUsers: SearchUserDocument[] = [];
    async function create(): Promise<void> {
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
          public: Object.hasOwn(user, 'public') ? user.public : true,
          gender: 'non-binary',
          locationFrom: user.locationFrom || 'Wonderland',
          locationLiving: user.locationLiving || 'Sampleton',
          tagline: user.tagline || '',
          roles: user.roles || ['user'],
        });
        createdUsers.push(createdUser);
        await createdUser.save();
      }
    }
    create().then(
      () => callback(null, createdUsers),
      err => callback(err, createdUsers),
    );
  }
  context('not logged in', function () {
    it('Forbidden 403', function (done) {
      agent.get('/api/users?search=aaaBc').expect(403).end(done);
    });
  });
  context('logged in', function () {
    let loggedUser: SearchUserDocument;
    // create logged user
    beforeEach(function (done) {
      createUsers(
        [
          {
            username: 'loggedUser',
            password: 'somepassword',
          },
        ],
        function (err, users) {
          loggedUser = users[0];
          done(err);
        },
      );
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
      it('restricts results to confirmed contacts and fails closed if the lookup fails', async function () {
        const [confirmed, pending] = await promisify(createUsers)([
          { username: 'fernwalker', locationLiving: 'Exampleville' },
          { username: 'meadowwalker', locationLiving: 'Exampleville' },
        ]);
        const Contact = mongoose.model('Contact');
        const endpoint = '/api/users?search=Exampleville&connectionsOnly=true';
        await Contact.create([
          { userFrom: confirmed._id, userTo: loggedUser._id, confirmed: true },
          { userFrom: loggedUser._id, userTo: pending._id, confirmed: false },
        ]);
        const response = await agent.get(endpoint).expect(200);
        (response.body as SearchResponse)
          .map(member => member.username)
          .should.eql(['fernwalker']);

        const lookup = sinon
          .stub(Contact, 'find')
          .throws(new Error('Lookup failed'));
        try {
          await agent.get(endpoint).expect(500);
        } finally {
          lookup.restore();
        }
      });

      it('applies Experience visibility and gives negative recommendations precedence', async function () {
        const members = await promisify(createUsers)(
          [
            'incomingpositive',
            'outgoingpositive',
            'incomingnegative',
            'outgoingnegative',
            'bothnegative',
            'privatepositive',
            'privatelynegative',
            'removedpositive',
            'neutralexperience',
          ].map(username => ({ username, locationLiving: 'Sampleville' })),
        );
        const [
          incoming,
          outgoing,
          negativeIn,
          negativeOut,
          both,
          privateYes,
          privateNo,
          removed,
          neutral,
        ] = members.map(member => member._id);
        const self = loggedUser._id;
        const recommendation = (
          userFrom: typeof self,
          userTo: typeof self,
          recommend: 'yes' | 'no' | 'unknown',
          published = true,
        ) => ({
          userFrom,
          userTo,
          recommend,
          public: published,
          created: new Date(),
        });

        await mongoose.model('Contact').create(
          [negativeIn, negativeOut, both, privateNo].map(userTo => ({
            userFrom: self,
            userTo,
            confirmed: true,
          })),
        );
        await mongoose
          .model('Experience')
          .collection.insertMany([
            recommendation(incoming, self, 'yes'),
            recommendation(self, outgoing, 'yes', false),
            recommendation(self, negativeIn, 'yes'),
            recommendation(negativeIn, self, 'no'),
            recommendation(negativeOut, self, 'yes'),
            recommendation(self, negativeOut, 'no', false),
            recommendation(self, both, 'no'),
            recommendation(both, self, 'no'),
            recommendation(privateYes, self, 'yes', false),
            recommendation(privateNo, self, 'no', false),
            { ...recommendation(removed, self, 'yes'), removedAt: new Date() },
            recommendation(neutral, self, 'unknown'),
          ]);

        const response = await agent
          .get('/api/users?search=Sampleville&connectionsOnly=true')
          .expect(200);
        (response.body as SearchResponse)
          .map(member => member.username)
          .sort()
          .should.eql([
            'incomingpositive',
            'outgoingpositive',
            'privatelynegative',
          ]);
      });

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
      it('excludes members blocked in either direction from location results', function (done) {
        createUsers(
          [
            { username: 'blockedbyviewer', locationLiving: 'Exampleville' },
            { username: 'blockingviewer', locationLiving: 'Exampleville' },
            { username: 'visiblemember', locationLiving: 'Exampleville' },
          ],
          function (err, members) {
            if (err) return done(err);
            Promise.all([
              User.updateOne(
                { _id: loggedUser._id },
                { $set: { blocked: [members[0]._id] } },
              ),
              User.updateOne(
                { _id: members[1]._id },
                { $set: { blocked: [loggedUser._id] } },
              ),
            ])
              .then(() => {
                agent
                  .get('/api/users?search=Exampleville')
                  .expect(200)
                  .end(function (error, response) {
                    if (error) return done(error);
                    (response.body as SearchResponse)
                      .map(member => member.username)
                      .should.eql(['visiblemember']);
                    done();
                  });
              })
              .catch(done);
          },
        );
      });
      it('finds public locations and taglines, ranking names higher', function (done) {
        createUsers(
          [
            {
              username: 'taglinematch',
              tagline: 'Riverside pottery enthusiast',
            },
            { username: 'originmatch', locationFrom: 'Riverside' },
            { username: 'locationmatch', locationLiving: 'Riverside' },
            { username: 'riverside' },
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
          ],
          function (err) {
            if (err) return done(err);
            agent
              .get('/api/users?search=Riverside')
              .expect(200)
              .end(function (error, response) {
                if (error) return done(error);
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
                done();
              });
          },
        );
      });
      it('[a username matched] return array of users', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=asdia')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(1);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('[some given names matched] return array of users', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=qwer')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(2);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('[some family names matched] return array of users', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=zxcvb')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(2);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('[full names matched] return array of users', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=jacob+aLia')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(6);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('[none matched] return empty array', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=aeiou')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(0);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('the user data should have only fields from searchProfile, and score', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
                {
                  username: 'aaa',
                },
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=aaa')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(1);
            // _id is not specified in userSearchProfileFields, but gets included anyways
            // that's just how mongo works
            const expectedFields = userHandler.userSearchProfileFields
              .split(' ')
              .concat(['_id']);
            const actualFields = Object.keys(foundUsers[0]);
            const unexpectedFields = actualFields.filter(
              field => !expectedFields.includes(field),
            );
            should(unexpectedFields).eql(['score']);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
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
        beforeEach(function (done) {
          createUsers(testUsers, function (err) {
            done(err);
          });
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
            function (done) {
              (async () => {
                const step0 = await promisify(function (cb: SearchCallback) {
                  agent
                    .get('/api/users?search=aaaaaa' + test.params)
                    .expect(200)
                    .end(function (err, response) {
                      cb(err, response.body as SearchResponse);
                    });
                })();
                const step1 = await promisify(function (
                  foundUsers: SearchResponse,
                  cb: FinishedCallback,
                ) {
                  should(foundUsers).length(test.expected);
                  cb();
                })(step0!);
                return step1;
              })().then(() => done(), done);
            },
          );
        });
      });
      it('search is case insensitive', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=abcdEf')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(3);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
      });
      it('return only public users', function (done) {
        (async () => {
          const step0 = await promisify(function (cb: CreateCallback) {
            createUsers(
              [
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
              ],
              cb,
            );
          })();
          const step1 = await promisify(function (
            users: SearchUserDocument[],
            cb: SearchCallback,
          ) {
            agent
              .get('/api/users?search=aabcdef')
              .expect(200)
              .end(function (err, response) {
                cb(err, response.body as SearchResponse);
              });
          })(step0!);
          const step2 = await promisify(function (
            foundUsers: SearchResponse,
            cb: FinishedCallback,
          ) {
            should(foundUsers).length(2);
            cb();
          })(step1!);
          return step2;
        })().then(() => done(), done);
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
