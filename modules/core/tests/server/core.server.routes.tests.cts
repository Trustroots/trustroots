import type {
  TestExpressApp,
  TestExpressModule,
  TestAgent,
  TribeRecord,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
import type { ServerUserFixture } from '../../../../testutils/common/data.common.testutil.mts';

const request: typeof import('supertest') = require('supertest');
const mongoose: typeof import('mongoose') = require('mongoose');
const express: TestExpressModule = require('./../../../../config/lib/express.mjs');
const config: typeof import('../../../../config/config.mts').default = require('./../../../../config/config.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const should: typeof import('should') = require('should');
const User = mongoose.model<UserRecord>('User');

/**
 * Globals
 */
let app: TestExpressApp;
let agent: TestAgent;

type NostrUserOverrides = Partial<ServerUserFixture> & {
  firstName?: string;
  lastName?: string;
  emailTemporary?: string;
  emailToken?: string;
  nostrNpub?: string;
  roles?: string[];
};
type ErrorFirstCallback<T> = (error: Error | null, value?: T) => void;
type TestUser = ReturnType<typeof utils.createTestUser>;

/**
 * Core routes tests
 */
describe('Core CRUD tests', function () {
  before(function (done) {
    (async () => {
      // Get application
      app = await express.init(mongoose.connection);
      agent = request.agent(app);
      done();
    })().catch(done);
  });
  it('registers the authenticated private map-default endpoint', async function () {
    const response = await request(app)
      .get('/api/map-default-location')
      .expect(401);
    response.headers['cache-control'].should.equal('private, no-store');
  });

  describe('Content Security Policy Tests:', function () {
    it('Responses should load Umami analytics', function (done) {
      agent
        .get('/')
        .expect('Content-Type', /html/)
        .expect(/https:\/\/1p\.trustroots\.org\/script\.js/)
        .expect(new RegExp(`data-website-id="${config.umami.websiteId}"`))
        .expect(/data-do-not-track="true"/)
        .expect(/data-performance="true"/)
        .end(function (err) {
          return done(err);
        });
    });
  });
  describe('Member-only circle routes', function () {
    it('redirects visitors away from the Naturists circle', function (done) {
      agent
        .get('/circles/naturists')
        .expect('Location', '/signin')
        .expect(302)
        .end(done);
    });
  });
  describe('Frontend app root selection', function () {
    afterEach(utils.clearDatabase);
    function createUser(
      overrides: Parameters<typeof utils.createTestUser>[0],
    ): Promise<TestUser> {
      return utils
        .createTestUser({
          email: 'frontend-root-user@example.com',
          firstName: 'Frontend',
          lastName: 'User',
          username: 'frontendrootuser',
          ...overrides,
        })
        .save();
    }
    it('renders React assets and root for admin users on admin pages', function (done) {
      const adminCredentials = {
        password: 'Password123!',
        username: 'frontendrootadmin',
      };
      createUser({
        email: 'frontend-root-admin@example.com',
        roles: ['user', 'admin'],
        ...adminCredentials,
      })
        .then(function () {
          return utils.signIn(adminCredentials, agent);
        })
        .then(function () {
          agent.get('/admin').end(function (err, res) {
            should.not.exist(err);
            res.text.should.containEql('id="tr-react-root"');
            res.text.should.containEql('assets/react-main.js');
            res.text.should.not.containEql('data-ui-view');
            utils
              .signOut(agent)
              .then(() => done())
              .catch(done);
          });
        })
        .catch(done);
    });
    it('renders React assets and root for authenticated profile pages', function (done) {
      const profileCredentials = {
        password: 'Password123!',
        username: 'frontendrootprofile',
      };
      createUser({
        email: 'frontend-root-profile@example.com',
        roles: ['user'],
        ...profileCredentials,
      })
        .then(function () {
          return utils.signIn(profileCredentials, agent);
        })
        .then(function () {
          agent.get('/profile/frontend-root-profile').end(function (err, res) {
            should.not.exist(err);
            res.text.should.containEql('id="tr-react-root"');
            res.text.should.containEql('assets/react-main.js');
            res.text.should.not.containEql('data-ui-view');
            utils
              .signOut(agent)
              .then(() => done())
              .catch(done);
          });
        })
        .catch(done);
    });
  });
  describe('Legacy redirect routes', function () {
    afterEach(utils.clearDatabase);
    it('redirects /login to /signin', function (done) {
      agent.get('/login').expect(302).expect('Location', '/signin').end(done);
    });
    it('preserves query parameters when redirecting /login', function (done) {
      agent
        .get('/login?continue=true&returnTo=%2Fmessages')
        .expect(302)
        .expect('Location', '/signin?continue=true&returnTo=%2Fmessages')
        .end(done);
    });
    it('redirects /invite to /signup', function (done) {
      agent.get('/invite').expect(301).expect('Location', '/signup').end(done);
    });
    it('redirects /tribes/:slug to /circles/:slug when tribe exists', function (done) {
      const Tribe = mongoose.model<TribeRecord>('Tribe');
      const tribe = new Tribe({
        slug: 'testcircle',
        label: 'Test Circle',
        description: 'A test circle',
        public: true,
      });
      tribe
        .save()
        .then(savedTribe => {
          agent
            .get('/tribes/' + savedTribe.slug)
            .expect(301)
            .expect('Location', '/circles/' + savedTribe.slug)
            .end(done);
        })
        .catch(done);
    });
    it('redirects unknown tribe slugs to /circles', function (done) {
      agent
        .get('/tribes/missing-circle')
        .expect(301)
        .expect('Location', '/circles')
        .end(done);
    });
  });
  describe('NIP-05 nostr Tests:', function () {
    const validNpub =
      'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
    const validNpubHex =
      '0000000000000000000000000000000000000000000000000000000000000000';
    const nsec =
      'nsec1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqwkhnav';
    afterEach(utils.clearDatabase);
    function createNostrUser(
      overrides: NostrUserOverrides,
      done: ErrorFirstCallback<TestUser>,
    ): void {
      const username = overrides.username || 'nostruser';
      const user = utils.createTestUser({
        firstName: 'Nostr',
        lastName: 'User',
        email: `${username}@example.com`,
        username,
        password: 'M3@n.jsI$Aw3$0m3',
        nostrNpub: validNpub,
        ...overrides,
      });

      void user
        .save()
        .then(saved => done(null, saved))
        .catch(error => {
          done(error instanceof Error ? error : new Error(String(error)));
        });
    }
    function expectEmptyNames(username: string, done: TestDone): void {
      agent
        .get('/.well-known/nostr.json?name=' + username)
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          res.body.should.deepEqual({
            names: {},
          });
          return done();
        });
    }
    it('should return 500 when the user lookup fails', function (done) {
      const sinon = require('sinon');
      sinon.stub(User, 'findOne').rejects(new Error('db down'));
      agent
        .get('/.well-known/nostr.json?name=nostruser')
        .expect(500)
        .end(function (err, res) {
          sinon.restore();
          if (err) {
            return done(err);
          }
          res.body.error.should.equal('Internal server error');
          done();
        });
    });
    it('should reject nostr requests with a query object as username', function (done) {
      agent
        .get('/.well-known/nostr.json?name[$ne]=x')
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          res.body.error.should.equal('Valid username required.');
          return done();
        });
    });
    it('should reject nostr requests with duplicate username values', function (done) {
      agent
        .get('/.well-known/nostr.json?name=userone&name=usertwo')
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          res.body.error.should.equal('Valid username required.');
          return done();
        });
    });
    it('should reject nostr requests with an empty username', function (done) {
      agent
        .get('/.well-known/nostr.json?name=')
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          res.body.error.should.equal('Valid username required.');
          return done();
        });
    });
    it('should reject nostr requests with an invalid username', function (done) {
      agent
        .get('/.well-known/nostr.json?name=' + 'a'.repeat(35))
        .expect(400)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }
          res.body.error.should.equal('Valid username required.');
          return done();
        });
    });
    it('should use the normalized username as the nostr response key', function (done) {
      createNostrUser({}, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }
        agent
          .get('/.well-known/nostr.json?name=NostrUser')
          .expect(200)
          .end(function (err, res) {
            if (err) {
              return done(err);
            }
            res.body.names.should.have.property('nostruser', validNpubHex);
            res.body.names.should.not.have.property('NostrUser');
            res.headers['access-control-allow-origin'].should.equal('*');
            return done();
          });
      });
    });
    it('should return empty names for a missing user', function (done) {
      expectEmptyNames('missinguser', done);
    });
    it('should return empty names for a private or unconfirmed user', function (done) {
      createNostrUser(
        {
          public: false,
          emailTemporary: 'nostruser@example.com',
          emailToken: 'initial email token',
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
    it('should return empty names for suspended users', function (done) {
      createNostrUser(
        {
          roles: ['user', 'suspended'],
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
    it('should return empty names for shadowbanned users', function (done) {
      createNostrUser(
        {
          roles: ['user', 'shadowban'],
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
    it('should verify public users with pending email changes', function (done) {
      createNostrUser(
        {
          emailTemporary: 'changed-nostruser@example.com',
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          agent
            .get('/.well-known/nostr.json?name=nostruser')
            .expect(200)
            .end(function (err, res) {
              if (err) {
                return done(err);
              }
              res.body.names.should.have.property('nostruser', validNpubHex);
              return done();
            });
        },
      );
    });
    it('should return empty names for public users without a current email', function (done) {
      createNostrUser({}, function (saveErr, user) {
        if (saveErr) {
          return done(saveErr);
        }
        void User.updateOne({ _id: user!._id }, { $set: { email: '' } })
          .exec()
          .then(() => expectEmptyNames('nostruser', done))
          .catch(done);
      });
    });
    it('should return empty names for users without a nostr npub', function (done) {
      createNostrUser(
        {
          nostrNpub: '',
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
    it('should return empty names for malformed stored nostr npubs', function (done) {
      createNostrUser(
        {
          nostrNpub: 'npub1invalid',
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
    it('should return empty names for stored nostr values that are not npubs', function (done) {
      createNostrUser(
        {
          nostrNpub: nsec,
        },
        function (saveErr) {
          if (saveErr) {
            return done(saveErr);
          }
          expectEmptyNames('nostruser', done);
        },
      );
    });
  });
  describe('Nostr author visibility API', function () {
    const validNpub =
      'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
    const validNpubHex =
      '0000000000000000000000000000000000000000000000000000000000000000';
    afterEach(utils.clearDatabase);
    function createNostrUser(
      overrides: NostrUserOverrides,
      done: ErrorFirstCallback<TestUser>,
    ): void {
      const user = utils.createTestUser({
        firstName: 'Nostr',
        lastName: 'User',
        email: 'nostruser@example.com',
        username: 'nostruser',
        password: 'M3@n.jsI$Aw3$0m3',
        nostrNpub: validNpub,
        ...overrides,
      });

      void user
        .save()
        .then(saved => done(null, saved))
        .catch(error => {
          done(error instanceof Error ? error : new Error(String(error)));
        });
    }
    it('returns only eligible public author keys from a batch', function (done) {
      createNostrUser({}, function (saveErr) {
        if (saveErr) return done(saveErr);
        agent
          .get(
            '/api/nostr/author-visibility?pubkey=' +
              validNpubHex +
              '&pubkey=' +
              '11'.repeat(32),
          )
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);
            res.body.should.deepEqual({
              linkedPubkeys: [validNpubHex],
              pubkeys: [validNpubHex],
            });
            return done();
          });
      });
    });
    it('excludes shadowbanned author keys', function (done) {
      createNostrUser(
        {
          roles: ['user', 'shadowban'],
        },
        function (saveErr) {
          if (saveErr) return done(saveErr);
          agent
            .get('/api/nostr/author-visibility?pubkey=' + validNpubHex)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              res.body.should.deepEqual({
                linkedPubkeys: [validNpubHex],
                pubkeys: [],
              });
              return done();
            });
        },
      );
    });
    it('identifies private author keys without making them visible', function (done) {
      createNostrUser(
        {
          public: false,
        },
        function (saveErr) {
          if (saveErr) return done(saveErr);
          agent
            .get('/api/nostr/author-visibility?pubkey=' + validNpubHex)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);
              res.body.should.deepEqual({
                linkedPubkeys: [validNpubHex],
                pubkeys: [],
              });
              return done();
            });
        },
      );
    });
    it('rejects invalid author key batches', function (done) {
      agent
        .get('/api/nostr/author-visibility?pubkey=invalid')
        .expect(400)
        .end(function (err, res) {
          if (err) return done(err);
          res.body.error.should.equal('One to 100 valid public keys required.');
          return done();
        });
    });
    it('returns an error when the author lookup fails', function (done) {
      const sinon = require('sinon');
      sinon.stub(User, 'find').rejects(new Error('db unavailable'));
      agent
        .get('/api/nostr/author-visibility?pubkey=' + validNpubHex)
        .expect(500)
        .end(function (err, res) {
          sinon.restore();
          if (err) return done(err);
          res.body.error.should.equal('Internal server error');
          return done();
        });
    });
  });
});
