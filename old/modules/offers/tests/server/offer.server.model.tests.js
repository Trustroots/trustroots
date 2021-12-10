/**
 * Module dependencies.
 */
const should = require('should');
const mongoose = require('mongoose');
const path = require('path');
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

const User = mongoose.model('User');
const Offer = mongoose.model('Offer');

/**
 * Globals
 */
let user;
let offerHost;
let offerMeet;

/**
 * Unit tests
 */
describe('Offer Model Unit Tests:', function () {
  beforeEach(function (done) {
    user = new User({
      firstName: 'Full',
      lastName: 'Name',
      displayName: 'Full Name',
      email: 'test1@test.com',
      username: 'username1',
      password: 'password123',
      provider: 'local',
    });

    // Save user and hosting offer
    user.save(function (err, user) {
      should.not.exist(err);

      offerHost = new Offer({
        type: 'host',
        user: user._id,
        status: 'yes',
        description: '<p>I can host! :)</p>',
        noOfferDescription: '<p>I cannot host... :(</p>',
        maxGuests: 1,
        updated: new Date(),
        location: [52.498981209298776, 13.418329954147339],
        locationFuzzy: [52.50155039101136, 13.42255019882177],
      });

      offerMeet = new Offer({
        type: 'meet',
        user: user._id,
        description: '<p>I can meet! :)</p>',
        updated: new Date(),
        validUntil: new Date(),
        location: [52.498981209298776, 13.418329954147339],
        locationFuzzy: [52.50155039101136, 13.42255019882177],
      });

      return done();
    });
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save host offer without problems', function (done) {
      offerHost.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to save meet offer without problems', function (done) {
      offerMeet.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to save without problems with empty descriptions', function (done) {
      offerHost.description = '';
      offerHost.noOfferDescription = '';

      offerHost.save(function (err) {
        should.not.exist(err);
        return done();
      });
    });

    it('should be able to save without problems with with limited html in descriptions', function (done) {
      const html = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      offerHost.save(function (err, updatedofferHost) {
        should.not.exist(err);
        updatedofferHost.description.should.equal(html);
        updatedofferHost.noOfferDescription.should.equal(html);
        return done();
      });
    });

    it('should be able to clean excessive html from descriptions', function (done) {
      const html =
        '<p><strong><img src="http://www.example.com/i.png"><script>alert();</script>HTML</strong></p>';
      const htmlClean = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      offerHost.save(function (err, updatedofferHost) {
        should.not.exist(err);
        updatedofferHost.description.should.equal(htmlClean);
        updatedofferHost.noOfferDescription.should.equal(htmlClean);
        return done();
      });
    });

    it('should be able to save empty html descriptions as empty strings', function (done) {
      const html = '<p> <br><br><br> </p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      offerHost.save(function (err, updatedofferHost) {
        should.not.exist(err);
        updatedofferHost.description.should.equal('');
        updatedofferHost.noOfferDescription.should.equal('');
        return done();
      });
    });

    it('should be able to show an error when try to save without status', function (done) {
      offerHost.status = '';

      offerHost.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    it('should be able to show an error when try to save without type', function (done) {
      offerHost.type = '';

      offerHost.save(function (err) {
        should.exist(err);
        return done();
      });
    });

    describe('Location Validation', function () {
      it('should be able to show an error when try to save with empty array location', function (done) {
        offerHost.location = [];

        offerHost.save(function (err) {
          should.exist(err);
          return done();
        });
      });

      it('should be able to show an error when try to save with coordinates outside lat/lon scale', function (done) {
        offerHost.location = [10000.0, 32.0];

        offerHost.save(function (err) {
          should.exist(err);
          return done();
        });
      });

      it('should be able to show an error when try to save location with too few coordinate values', function (done) {
        offerHost.location = [60.1];

        offerHost.save(function (err) {
          should.exist(err);
          return done();
        });
      });

      it('should be able to show an error when try to save location with too many coordinate values', function (done) {
        offerHost.location = [60.1, 24.1, 24.1];

        offerHost.save(function (err) {
          should.exist(err);
          return done();
        });
      });

      it('should be able to save with correct coordinates (integer)', function (done) {
        offerHost.location = [60, 24];

        offerHost.save(function (err) {
          should.not.exist(err);
          return done();
        });
      });

      it('should be able to save with correct coordinates (float)', function (done) {
        offerHost.location = [60.192059, 24.945831];

        offerHost.save(function (err) {
          should.not.exist(err);
          return done();
        });
      });
    });
  });
});
