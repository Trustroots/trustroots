'use strict';

var should = require('should'),
    request = require('supertest'),
    path = require('path'),
    mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Tag = mongoose.model('Tag'),
    express = require(path.resolve('./config/lib/express'));

/**
 * Globals
 */
var app,
    agent,
    credentials,
    user,
    _user,
    tag,
    _tag,
    tribe,
    _tribe,
    tribeNonPublic,
    _tribeNonPublic;

/**
 * User routes tests
 */
describe('Tag CRUD tests', function () {

  before(function (done) {
    // Get application
    app = express.init(mongoose);
    agent = request.agent(app);

    done();
  });

  beforeEach(function (done) {
    // Create user credentials
    credentials = {
      username: 'tr_username',
      password: 'M3@n.jsI$Aw3$0m3'
    };

    // Create a new user
    _user = {
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test@test.com',
      username: credentials.username,
      displayUsername: credentials.username,
      password: credentials.password,
      provider: 'local',
      public: true
    };

    // Create a new tag
    _tag = {
      label: 'Awesome Tag',
      tribe: false
    };

    // Create a new tribe
    _tribe = {
      label: 'Awesome Tribe',
      attribution: 'Photo credits',
      attribution_url: 'http://www.trustroots.org/team',
      image_UUID: '3c8bb9f1-e313-4baa-bf4c-1d8994fd6c6c',
      tribe: true,
      description: 'Lorem ipsum.'
    };

    // Create a new non-public tribe
    _tribeNonPublic = {
      label: 'Non-public Tribe',
      tribe: true,
      public: false
    };

    user = new User(_user);
    tag = new Tag(_tag);
    tribe = new Tag(_tribe);
    tribeNonPublic = new Tag(_tribeNonPublic);

    // Save a user to the test db
    user.save(function (err) {
      should.not.exist(err);
      tag.save(function (err) {
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
  });

  it('should be able to read tribes when not logged in', function(done) {

    // Read tribes
    agent.get('/api/tribes')
      .expect(200)
      .end(function(tribesReadErr, tribesReadRes) {

        tribesReadRes.body.should.have.length(1);
        tribesReadRes.body[0].tribe.should.equal(true);
        tribesReadRes.body[0].label.should.equal('Awesome Tribe');
        tribesReadRes.body[0].slug.should.equal('awesome-tribe');
        tribesReadRes.body[0].description.should.equal(_tribe.description);
        tribesReadRes.body[0].attribution.should.equal(_tribe.attribution);
        tribesReadRes.body[0].attribution_url.should.equal(_tribe.attribution_url);
        tribesReadRes.body[0].count.should.eql(0);
        should.exist(tribesReadRes.body[0]._id);

        // `color` and `image_UUID` are published only for tribes
        should.exist(tribesReadRes.body[0].color);
        tribesReadRes.body[0].image_UUID.should.equal(_tribe.image_UUID);


        // These are at the model, but aren't exposed
        should.not.exist(tribesReadRes.body[0].synonyms);
        should.not.exist(tribesReadRes.body[0].labelHistory);
        should.not.exist(tribesReadRes.body[0].slugHistory);
        should.not.exist(tribesReadRes.body[0].created);

        // Call the assertion callback
        return done(tribesReadErr);
      });
  });

  it('should be able to read tribes when logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Read tribes
        agent.get('/api/tribes')
          .expect(200)
          .end(function(tribesReadErr, tribesReadRes) {

            tribesReadRes.body.should.have.length(1);
            tribesReadRes.body[0].tribe.should.equal(true);
            tribesReadRes.body[0].label.should.equal('Awesome Tribe');
            tribesReadRes.body[0].slug.should.equal('awesome-tribe');
            tribesReadRes.body[0].description.should.equal(_tribe.description);
            tribesReadRes.body[0].attribution.should.equal(_tribe.attribution);
            tribesReadRes.body[0].attribution_url.should.equal(_tribe.attribution_url);
            tribesReadRes.body[0].count.should.eql(0);
            should.exist(tribesReadRes.body[0]._id);

            // `color` and `image_UUID` are published only for tribes
            should.exist(tribesReadRes.body[0].color);
            tribesReadRes.body[0].image_UUID.should.equal(_tribe.image_UUID);


            // These are at the model, but aren't exposed
            should.not.exist(tribesReadRes.body[0].synonyms);
            should.not.exist(tribesReadRes.body[0].labelHistory);
            should.not.exist(tribesReadRes.body[0].slugHistory);
            should.not.exist(tribesReadRes.body[0].created);

            // Call the assertion callback
            return done(tribesReadErr);
          });

      });
  });

  it('should be able to read only 2 most popular tribes', function(done) {

    // Create more tribes
    var tribe1 = new Tag(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1.save(function (err) {
      should.not.exist(err);
      var tribe2 = new Tag(_tribe);
      tribe2.label = 'Tribe 2';
      tribe2.count = 40;
      tribe2.save(function (err) {
        should.not.exist(err);
        var tribe3 = new Tag(_tribe);
        tribe3.label = 'Tribe 3';
        tribe3.count = 30;
        tribe3.save(function (err) {
          should.not.exist(err);
          var tribe4 = new Tag(_tribe);
          tribe4.label = 'Tribe 4';
          tribe4.count = 20;
          tribe4.save(function (err) {
            should.not.exist(err);

            // Read tribes
            agent.get('/api/tribes?limit=2') // defaults to `&page=1`
              .expect(200)
              .end(function(tribesReadErr, tribesReadRes) {

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

  it('should be able to read only 2 second popular tribes', function(done) {

    // Create more tribes
    var tribe1 = new Tag(_tribe);
    tribe1.label = 'Tribe 1';
    tribe1.count = 50;
    tribe1.save(function (err) {
      should.not.exist(err);
      var tribe2 = new Tag(_tribe);
      tribe2.label = 'Tribe 2';
      tribe2.count = 40;
      tribe2.save(function (err) {
        should.not.exist(err);
        var tribe3 = new Tag(_tribe);
        tribe3.label = 'Tribe 3';
        tribe3.count = 30;
        tribe3.save(function (err) {
          should.not.exist(err);
          var tribe4 = new Tag(_tribe);
          tribe4.label = 'Tribe 4';
          tribe4.count = 20;
          tribe4.save(function (err) {
            should.not.exist(err);

            // Read tribes
            agent.get('/api/tribes?limit=2&page=2')
              .expect(200)
              .end(function(tribesReadErr, tribesReadRes) {

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

  it('should be able to read tags when not logged in', function(done) {

    // Read tags
    agent.get('/api/tags')
      .expect(200)
      .end(function(tagsReadErr, tagsReadRes) {

        tagsReadRes.body.should.have.length(1);
        tagsReadRes.body[0].label.should.equal('Awesome Tag');
        tagsReadRes.body[0].slug.should.equal('awesome-tag');
        tagsReadRes.body[0].count.should.eql(0);
        should.exist(tagsReadRes.body[0]._id);

        // `color` and `image_UUID` are published only for tribes
        should.not.exist(tagsReadRes.body[0].color);
        should.not.exist(tagsReadRes.body[0].image_UUID);

        // These are at the model, but aren't exposed
        should.not.exist(tagsReadRes.body[0].tribe);
        should.not.exist(tagsReadRes.body[0].synonyms);
        should.not.exist(tagsReadRes.body[0].labelHistory);
        should.not.exist(tagsReadRes.body[0].slugHistory);
        should.not.exist(tagsReadRes.body[0].created);
        should.not.exist(tagsReadRes.body[0].attribution);
        should.not.exist(tagsReadRes.body[0].attribution_url);

        // Call the assertion callback
        return done(tagsReadErr);
      });
  });

  it('should be able to read tags when logged in', function(done) {
    agent.post('/api/auth/signin')
      .send(credentials)
      .expect(200)
      .end(function(signinErr) {
        // Handle signin error
        if (signinErr) return done(signinErr);

        // Read tags
        agent.get('/api/tags')
          .expect(200)
          .end(function(tagsReadErr, tagsReadRes) {

            tagsReadRes.body.should.have.length(1);
            tagsReadRes.body[0].label.should.equal('Awesome Tag');
            tagsReadRes.body[0].slug.should.equal('awesome-tag');
            tagsReadRes.body[0].count.should.eql(0);
            should.exist(tagsReadRes.body[0]._id);

            // `color` and `image_UUID` are published only for tribes
            should.not.exist(tagsReadRes.body[0].color);
            should.not.exist(tagsReadRes.body[0].image_UUID);

            // These are at the model, but aren't exposed
            should.not.exist(tagsReadRes.body[0].tribe);
            should.not.exist(tagsReadRes.body[0].synonyms);
            should.not.exist(tagsReadRes.body[0].labelHistory);
            should.not.exist(tagsReadRes.body[0].slugHistory);
            should.not.exist(tagsReadRes.body[0].created);
            should.not.exist(tagsReadRes.body[0].attribution);
            should.not.exist(tagsReadRes.body[0].attribution_url);

            // Call the assertion callback
            return done(tagsReadErr);
          });

      });
  });

  afterEach(function (done) {
    User.remove().exec(function() {
      Tag.remove().exec(done);
    });
  });
});
