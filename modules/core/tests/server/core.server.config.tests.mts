import createExpress from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import * as utils from './../../../../testutils/server/data.server.testutil.mts';
import should from 'should';
import express from './../../../../config/lib/express.mts';
/**
 * Module dependencies.
 */

type TribeRecord =
  import('../../../../testutils/server/model-contracts.mts').TribeRecord;
type ExpressApp = import('express').Express;

const Tribe = mongoose.model<TribeRecord>('Tribe');
/**
 * Globals
 */
let app: ExpressApp;
let agent: ReturnType<typeof request.agent>;
let user: ReturnType<typeof utils.createTestUser>;
let userId: string | import('mongoose').Types.ObjectId;
let credentials: {
  username: string;
  password: string;
};
describe('Configuration Tests:', function () {
  it('serves the signed Android App Links association as public JSON', async function () {
    const staticApp = createExpress();
    express.initModulesClientRoutes(staticApp);
    const response = await request(staticApp)
      .get('/.well-known/assetlinks.json')
      .expect(200)
      .expect('Content-Type', /application\/json/);

    should(response.body).deepEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'org.trustroots.android',
          sha256_cert_fingerprints: [
            '09:17:29:95:E8:AB:E0:C2:E0:99:8C:08:D8:79:5E:09:3F:41:6B:72:81:85:C1:6B:16:B2:5E:BE:79:68:FF:46',
          ],
        },
      },
    ]);
  });

  describe('avatar staging static-file guard', function () {
    it('denies staging paths before public static middleware', function () {
      const middleware: unknown[][] = [];
      express.initModulesClientRoutes({
        use: (...args: unknown[]) => middleware.push(args),
        get: () => {},
      } as never);
      should(middleware[0]?.[0]).equal(express.denyAvatarStagingRequests);
      const res: {
        statusCode?: number;
        sendStatus(status: number): {
          statusCode?: number;
          sendStatus(status: number): unknown;
        };
      } = {
        sendStatus(status: number) {
          res.statusCode = status;
          return res;
        },
      };
      let nextCalled = false;
      express.denyAvatarStagingRequests(
        {
          path: '/uploads-profile/member/avatar/%2Estaging-secret/128.jpg',
        } as never,
        res as never,
        () => {
          nextCalled = true;
        },
      );
      should(res.statusCode).equal(404);
      nextCalled.should.be.false();
    });
    it('allows ordinary static paths through the staging guard', function () {
      let nextCalled = false;
      express.denyAvatarStagingRequests(
        {
          path: '/uploads-profile/member/avatar/version/128.jpg',
        } as never,
        {
          sendStatus: () => {},
        } as never,
        () => {
          nextCalled = true;
        },
      );
      nextCalled.should.be.true();
    });
  });
  describe('Exposing authenticated user to pages', function () {
    before(function (done) {
      (async () => {
        app = await express.init(mongoose.connection);
        agent = request.agent(app);
        done();
      })().catch(done);
    });
    beforeEach(function (done) {
      credentials = {
        username: 'helloworld',
        password: 'M3@n.jsI$Aw3$0m3',
      };
      // Create a new user
      user = utils.createTestUser({
        lastName: 'Name A',
        displayName: 'Full Name A',
        email: 'user_a@example.com',
        username: credentials.username,
        password: credentials.password,
      });
      // Save a user to the test db
      user
        .save()
        .then(saveRes => {
          userId = saveRes._id;
          return done();
        })
        .catch(done);
    });
    afterEach(utils.clearDatabase);
    it('should have user set to "null" if not authenticated and loading index page', function (done) {
      // Get rendered layout
      agent
        .get('/')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect(200)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }
          res.text.should.containEql('user = null');
          return done();
        });
    });
    it('should have user set to user object when authenticated and loading index page', function (done) {
      // Authenticate user
      agent
        .post('/api/auth/signin')
        .send(credentials)
        .expect(200)
        .end(function (signinErr) {
          // Handle signin error
          if (signinErr) {
            return done(signinErr);
          }
          // Get rendered layout
          agent
            .get('/')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200)
            .end(function (err, res) {
              // Handle errors
              if (err) {
                return done(err);
              }
              // The user we just created should be exposed
              res.text.should.match(
                new RegExp('user = \\{.*"_id":"' + userId + '"'),
              );
              return done();
            });
        });
    });
    it('should allow an authenticated user to load the Naturists circle', function (done) {
      // Create a new tribe
      const _tribe = {
        slug: 'naturists',
        label: 'Naturists',
        tribe: true,
      };
      const tribe = new Tribe(_tribe);
      // Save a user to the test db
      tribe
        .save()
        .then(() => {
          // Authenticate user
          agent
            .post('/api/auth/signin')
            .send(credentials)
            .expect(200)
            .end(function (signinErr) {
              // Handle signin error
              if (signinErr) {
                return done(signinErr);
              }
              // Get rendered layout
              agent
                .get('/circles/naturists')
                .expect('Content-Type', 'text/html; charset=utf-8')
                .expect(200)
                .end(function (err, res) {
                  // Handle errors
                  if (err) {
                    return done(err);
                  }
                  // The user we just created should be exposed
                  res.text.should.match(
                    new RegExp('user = \\{.*"_id":"' + userId + '"'),
                  );
                  Tribe.deleteMany()
                    .exec()
                    .then(() => done())
                    .catch(done);
                });
            });
        })
        .catch(done);
    });
  });
  describe('Exposing environment as a variable to layout', function () {
    ['development', 'production', 'test'].forEach(function (env) {
      it('should expose environment set to ' + env, function (done) {
        (async () => {
          // Set env to development for this test
          process.env.NODE_ENV = env;
          // Get application
          app = await express.init(mongoose.connection);
          agent = request.agent(app);
          // Get rendered layout
          agent
            .get('/')
            .expect('Content-Type', 'text/html; charset=utf-8')
            .expect(200)
            .end(function (err, res) {
              // Handle errors
              if (err) {
                return done(err);
              }
              res.text.should.containEql('env = "' + env + '"');
              return done();
            });
        })().catch(done);
      });
    });
    afterEach(function () {
      // Set env back to test
      process.env.NODE_ENV = 'test';
    });
  });
});
