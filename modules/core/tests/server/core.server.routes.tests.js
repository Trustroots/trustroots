const _ = require('lodash');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const config = require('../../../../config/config');
const utils = require('../../../../testutils/server/data.server.testutil');
const should = require('should');

const User = mongoose.model('User');

/**
 * Globals
 */
let app;
let agent;

// Demo CSP Violation report
// Doesn't matter what's in here,
// but this is how they generally look:
const cspViolationReport = {
  'csp-report': {
    'document-uri': 'https://trustroots.org/foo/bar',
    referrer: 'https://www.google.com/',
    'violated-directive': 'default-src self',
    'original-policy': 'default-src self; report-uri /api/report-csp-violation',
    'blocked-uri': 'http://evil.com',
  },
};

/**
 * Core routes tests
 */
describe('Core CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  describe('Content Security Policy Tests:', function () {
    it('Responses should have content security policy header', function (done) {
      agent
        .get('/')
        .expect('content-security-policy', /.*/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have content security policy header with "report-uri" value', function (done) {
      agent
        .get('/')
        .expect(
          'content-security-policy',
          /report-uri \/api\/report-csp-violation/,
        )
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should allow the Umami analytics origin', function (done) {
      agent
        .get('/')
        .expect('content-security-policy', /https:\/\/1p\.trustroots\.org/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should load Umami analytics', function (done) {
      agent
        .get('/')
        .expect('Content-Type', /html/)
        .expect(/https:\/\/1p\.trustroots\.org\/script\.js/)
        .expect(new RegExp(`data-website-id="${config.umami.websiteId}"`))
        .expect(/data-do-not-track="true"/)
        .end(function (err) {
          return done(err);
        });
    });

    it('should be able to receive CSP report with "application/json" accept header', function (done) {
      agent
        .post('/api/report-csp-violation')
        .set('Accept', 'application/json')
        .send(cspViolationReport)
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          res.body.should.be.empty;

          return done();
        });
    });

    it('should be able to receive CSP report with "application/csp-report" accept header', function (done) {
      agent
        .post('/api/report-csp-violation')
        .set('Accept', 'application/csp-report')
        .send(cspViolationReport)
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          res.body.should.be.empty;

          return done();
        });
    });
  });

  describe('Expect-CT header Tests:', function () {
    it('Responses should have Expect-CT header', function (done) {
      agent
        .get('/')
        .expect('expect-ct', /.*/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have Expect-CT header with correct "report-uri" value', function (done) {
      agent
        .get('/')
        .expect(function (res) {
          const header = _.get(res, 'headers.expect-ct');

          // Build full URI
          const uri =
            (config.https === true ? 'https' : 'http') +
            '://' +
            config.domain +
            '/api/report-expect-ct-violation';

          // Test URI is as a value of `report-uri` in `expect-ct` header
          if (!header || !_.includes(header, 'report-uri="' + uri + '"')) {
            throw new Error(
              'Expect-CT header does not contain correct report-uri value.',
            );
          }
        })
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should have Expect-CT header with correct "max-age" value', function (done) {
      agent
        .get('/')
        .expect('expect-ct', /max-age=30/)
        .end(function (err) {
          return done(err);
        });
    });

    it('Responses should not have Expect-CT header with "enforce" value', function (done) {
      agent
        .get('/')
        .expect(function (res) {
          const header = _.get(res, 'headers.expect-ct');

          if (!header || _.includes(header, 'enforce;')) {
            throw new Error('Found "enforce" value');
          }
        })
        .end(function (err) {
          return done(err);
        });
    });

    it('should be able to receive Expect-CT violation report with "application/json" accept header', function (done) {
      agent
        .post('/api/report-expect-ct-violation')
        .set('Accept', 'application/json')
        .send({ foo: 'bar' })
        .expect(204)
        .end(function (err, res) {
          // Handle errors
          if (err) {
            return done(err);
          }

          // Set assertion
          res.body.should.be.empty;

          return done();
        });
    });
  });

  describe('Mobile app wrapper detection Tests:', function () {
    it('Mobile app state should be false without "app" query argument', function (done) {
      agent.get('/').end(function (err, res) {
        should.not.exist(err);
        res.text.should.containEql('isNativeMobileApp = false');

        return done();
      });
    });

    it('Mobile app state should be true with "app" query argument', function (done) {
      agent.get('/?app').end(function (err, res) {
        should.not.exist(err);

        res.text.should.containEql('isNativeMobileApp = true');

        return done();
      });
    });
  });

  describe('Legacy redirect routes', function () {
    afterEach(utils.clearDatabase);

    it('redirects /invite to /signup', function (done) {
      agent.get('/invite').expect(301).expect('Location', '/signup').end(done);
    });

    it('redirects /tribes/lgbt to /circles/lgbtq', function (done) {
      agent
        .get('/tribes/lgbt')
        .expect(301)
        .expect('Location', '/circles/lgbtq')
        .end(done);
    });

    it('redirects /tribes to /circles', function (done) {
      agent.get('/tribes').expect(301).expect('Location', '/circles').end(done);
    });

    it('redirects /tribes/:slug to /circles/:slug when tribe exists', function (done) {
      const Tribe = mongoose.model('Tribe');
      const tribe = new Tribe({
        slug: 'testcircle',
        label: 'Test Circle',
        description: 'A test circle',
        public: true,
      });

      tribe.save(function (saveErr, savedTribe) {
        if (saveErr) {
          return done(saveErr);
        }

        agent
          .get('/tribes/' + savedTribe.slug)
          .expect(301)
          .expect('Location', '/circles/' + savedTribe.slug)
          .end(done);
      });
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

    function createNostrUser(overrides, done) {
      const username = overrides.username || 'nostruser';
      const user = new User(
        Object.assign(
          {
            public: true,
            firstName: 'Nostr',
            lastName: 'User',
            email: `${username}@example.com`,
            username,
            password: 'M3@n.jsI$Aw3$0m3',
            provider: 'local',
            roles: ['user'],
            nostrNpub: validNpub,
          },
          overrides,
        ),
      );

      user.save(done);
    }

    function expectEmptyNames(username, done) {
      agent
        .get('/.well-known/nostr.json?name=' + username)
        .expect(200)
        .end(function (err, res) {
          if (err) {
            return done(err);
          }

          res.body.should.deepEqual({ names: {} });

          return done();
        });
    }

    it('should return 500 when the user lookup fails', function (done) {
      const sinon = require('sinon');
      sinon.stub(User, 'findOne').yields(new Error('db down'));

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
      createNostrUser({ roles: ['user', 'suspended'] }, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        expectEmptyNames('nostruser', done);
      });
    });

    it('should return empty names for shadowbanned users', function (done) {
      createNostrUser({ roles: ['user', 'shadowban'] }, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        expectEmptyNames('nostruser', done);
      });
    });

    it('should verify public users with pending email changes', function (done) {
      createNostrUser(
        { emailTemporary: 'changed-nostruser@example.com' },
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

        User.updateOne(
          { _id: user._id },
          { $set: { email: '' } },
          function (updateErr) {
            if (updateErr) {
              return done(updateErr);
            }

            expectEmptyNames('nostruser', done);
          },
        );
      });
    });

    it('should return empty names for users without a nostr npub', function (done) {
      createNostrUser({ nostrNpub: '' }, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        expectEmptyNames('nostruser', done);
      });
    });

    it('should return empty names for malformed stored nostr npubs', function (done) {
      createNostrUser({ nostrNpub: 'npub1invalid' }, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        expectEmptyNames('nostruser', done);
      });
    });

    it('should return empty names for stored nostr values that are not npubs', function (done) {
      createNostrUser({ nostrNpub: nsec }, function (saveErr) {
        if (saveErr) {
          return done(saveErr);
        }

        expectEmptyNames('nostruser', done);
      });
    });
  });
});
