const should = require('should');
const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');

const User = mongoose.model('User');
const Tribe = mongoose.model('Tribe');

/**
 * Globals
 */
let app;
let agent;
let credentials;
let user;
let _user;
let tribe;
let _tribe;
let tribeNonPublic;
let _tribeNonPublic;

/**
 * User routes tests
 */
describe('Tribe CRUD tests', function () {
  before(function (done) {
    // Get application
    app = express.init(mongoose.connection);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'tr_username',
      password: 'M3@n.jsI$Aw3$0m3',
    };

    // Create a new user
    _user = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true,
    };

    // Create a new tribe
    _tribe = {
      label: 'Awesome Tribe',
      attribution: 'Photo credits',
      attribution_url: 'http://www.trustroots.org/team',
      image: false,
      tribe: true,
      description: 'Lorem ipsum.',
    };

    // Create a new non-public tribe
    _tribeNonPublic = {
      label: 'Non-public Tribe',
      tribe: true,
      public: false,
    };

    user = new User(_user);
    tribe = new Tribe(_tribe);
    tribeNonPublic = new Tribe(_tribeNonPublic);

    // Save a user to the test db
    user.save(function (err) {
      should.not.exist(err);
      tribe.save(function (err) {
        should.not.exist(err);
        tribeNonPublic.save(function (err) {
          should.not.exist(err);
          done(err);
        });
      });
    });
  });

  afterEach(utils.clearDatabase);

  it('formats stored descriptions consistently in catalogue and detail responses', async () => {
    tribe.description =
      '<p>Sample <b>formatted</b> text</p><iframe src="about:blank"></iframe>';
    await tribe.save();
    const catalogue = await agent.get('/api/tribes').expect(200);
    const detail = await agent.get(`/api/tribes/${tribe.slug}`).expect(200);
    for (const circle of [catalogue.body[0], detail.body]) {
      circle.description.should.equal('<p>Sample <b>formatted</b> text</p>');
    }
  });

  it('builds catalogue page links with ordinary nested query fields', async () => {
    await new Tribe({ label: 'Another Sample Circle' }).save();
    const response = await agent
      .get(
        '/api/tribes?limit=1&filter[label]=sample&filter[constructor][label]=unused',
      )
      .expect(200);
    response.headers.link.should.containEql('rel="next"');
    response.headers.link.should.not.containEql('constructor');
    response.body.should.have.length(1);
  });

  it('serves the catalogue and details through the React root', async () => {
    for (const url of ['/circles', `/circles/${tribe.slug}`]) {
      const response = await agent.get(url).expect(200);
      response.text.should.containEql('id="tr-react-root"');
      response.text.should.not.containEql('data-ui-view');
    }
  });

  it('should be able to read tribes when not logged in', function (done) {
    // Read tribes
    agent
      .get('/api/tribes')
      .expect(200)
      .end(function (tribesReadErr, tribesReadRes) {
        tribesReadRes.body.should.have.length(1);
        tribesReadRes.body[0].label.should.equal('Awesome Tribe');
        tribesReadRes.body[0].slug.should.equal('awesome-tribe');
        tribesReadRes.body[0].description.should.equal(_tribe.description);
        tribesReadRes.body[0].attribution.should.equal(_tribe.attribution);
        tribesReadRes.body[0].attribution_url.should.equal(
          _tribe.attribution_url,
        );
        tribesReadRes.body[0].count.should.eql(0);
        tribesReadRes.body[0].new.should.equal(true); // Virtual field
        should.exist(tribesReadRes.body[0].created);
        should.exist(tribesReadRes.body[0]._id);

        // `color` and `image` are published only for tribes
        should.exist(tribesReadRes.body[0].color);
        tribesReadRes.body[0].image.should.equal(_tribe.image);

        // These are at the model, but aren't exposed
        should.not.exist(tribesReadRes.body[0].synonyms);
        should.not.exist(tribesReadRes.body[0].labelHistory);
        should.not.exist(tribesReadRes.body[0].slugHistory);

        // Call the assertion callback
        return done(tribesReadErr);
      });
  });

  it('should be able to read tribes when logged in', function (done) {
    agent
      .post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function (signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Read tribes
        agent
          .get('/api/tribes')
          .expect(200)
          .end(function (tribesReadErr, tribesReadRes) {
            tribesReadRes.body.should.have.length(1);
            tribesReadRes.body[0].label.should.equal('Awesome Tribe');
            tribesReadRes.body[0].slug.should.equal('awesome-tribe');
            tribesReadRes.body[0].description.should.equal(_tribe.description);
            tribesReadRes.body[0].attribution.should.equal(_tribe.attribution);
            tribesReadRes.body[0].attribution_url.should.equal(
              _tribe.attribution_url,
            );
            tribesReadRes.body[0].new.should.equal(true); // Virtual field
            tribesReadRes.body[0].count.should.eql(0);
            should.exist(tribesReadRes.body[0].created);
            should.exist(tribesReadRes.body[0]._id);

            // `color` and `image` are published only for tribes
            should.exist(tribesReadRes.body[0].color);
            tribesReadRes.body[0].image.should.equal(_tribe.image);

            // These are at the model, but aren't exposed
            should.not.exist(tribesReadRes.body[0].synonyms);
            should.not.exist(tribesReadRes.body[0].labelHistory);
            should.not.exist(tribesReadRes.body[0].slugHistory);

            // Call the assertion callback
            return done(tribesReadErr);
          });
      });
  });

  it('should be able to read only 2 most popular tribes from page 1', function (done) {
    // Create more tribes
    const tribe1 = new Tribe(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1.save(function (err) {
      should.not.exist(err);
      const tribe2 = new Tribe(_tribe);
      tribe2.label = 'Tribe 2';
      tribe2.count = 40;
      tribe2.save(function (err) {
        should.not.exist(err);
        const tribe3 = new Tribe(_tribe);
        tribe3.label = 'Tribe 3';
        tribe3.count = 30;
        tribe3.save(function (err) {
          should.not.exist(err);
          const tribe4 = new Tribe(_tribe);
          tribe4.label = 'Tribe 4';
          tribe4.count = 20;
          tribe4.save(function (err) {
            should.not.exist(err);

            // Read tribes
            agent
              .get('/api/tribes?limit=2') // defaults to `&page=1`
              .expect(200)
              .end(function (tribesReadErr, tribesReadRes) {
                tribesReadRes.body.should.have.length(2);
                tribesReadRes.body[0].label.should.equal('Tribe 1');
                tribesReadRes.body[1].label.should.equal('Tribe 2');

                // Call the assertion callback
                return done(tribesReadErr);
              });
          });
        });
      });
    });
  });

  it('should be able to read most popular tribes from page 2', function (done) {
    // Create more tribes
    const tribe1 = new Tribe(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1.save(function (err) {
      should.not.exist(err);
      const tribe2 = new Tribe(_tribe);
      tribe2.label = 'Tribe 2';
      tribe2.count = 40;
      tribe2.save(function (err) {
        should.not.exist(err);
        const tribe3 = new Tribe(_tribe);
        tribe3.label = 'Tribe 3';
        tribe3.count = 30;
        tribe3.save(function (err) {
          should.not.exist(err);
          const tribe4 = new Tribe(_tribe);
          tribe4.label = 'Tribe 4';
          tribe4.count = 20;
          tribe4.save(function (err) {
            should.not.exist(err);

            // Read tribes
            agent
              .get('/api/tribes?limit=2&page=2')
              .expect(200)
              .end(function (tribesReadErr, tribesReadRes) {
                tribesReadRes.body.should.have.length(2);
                tribesReadRes.body[0].label.should.equal('Tribe 3');
                tribesReadRes.body[1].label.should.equal('Tribe 4');

                // Call the assertion callback
                return done(tribesReadErr);
              });
          });
        });
      });
    });
  });
});
