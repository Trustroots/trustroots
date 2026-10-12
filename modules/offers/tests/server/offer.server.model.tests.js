/**
 * Module dependencies.
 */
require('should');
const mongoose = require('mongoose');
const utils = require('../../../../testutils/server/data.server.testutil');

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
  beforeEach(async function () {
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
    user = await user.save();

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
  });

  afterEach(utils.clearDatabase);

  describe('Method Save', function () {
    it('should be able to save host offer without problems', async function () {
      await offerHost.save();
    });

    it('should be able to save meet offer without problems', async function () {
      await offerMeet.save();
    });

    it('should be able to save without problems with empty descriptions', async function () {
      offerHost.description = '';
      offerHost.noOfferDescription = '';

      await offerHost.save();
    });

    it('should be able to save without problems with with limited html in descriptions', async function () {
      const html = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      const updatedofferHost = await offerHost.save();
      updatedofferHost.description.should.equal(html);
      updatedofferHost.noOfferDescription.should.equal(html);
    });

    it('should be able to clean excessive html from descriptions', async function () {
      const html =
        '<p><strong><img src="http://www.example.com/i.png"><script>alert();</script>HTML</strong></p>';
      const htmlClean = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      const updatedofferHost = await offerHost.save();
      updatedofferHost.description.should.equal(htmlClean);
      updatedofferHost.noOfferDescription.should.equal(htmlClean);
    });

    it('should be able to save empty html descriptions as empty strings', async function () {
      const html = '<p> <br><br><br> </p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;

      const updatedofferHost = await offerHost.save();
      updatedofferHost.description.should.equal('');
      updatedofferHost.noOfferDescription.should.equal('');
    });

    it('should be able to show an error when try to save without status', async function () {
      offerHost.status = '';

      await offerHost.save().should.be.rejected();
    });

    it('should be able to show an error when try to save without type', async function () {
      offerHost.type = '';

      await offerHost.save().should.be.rejected();
    });

    describe('Location Validation', function () {
      it('should be able to show an error when try to save with empty array location', async function () {
        offerHost.location = [];

        await offerHost.save().should.be.rejected();
      });

      it('should be able to show an error when try to save with coordinates outside lat/lon scale', async function () {
        offerHost.location = [10000.0, 32.0];

        await offerHost.save().should.be.rejected();
      });

      it('should be able to show an error when try to save location with too few coordinate values', async function () {
        offerHost.location = [60.1];

        await offerHost.save().should.be.rejected();
      });

      it('should be able to show an error when try to save location with too many coordinate values', async function () {
        offerHost.location = [60.1, 24.1, 24.1];

        await offerHost.save().should.be.rejected();
      });

      it('should be able to save with correct coordinates (integer)', async function () {
        offerHost.location = [60, 24];

        await offerHost.save();
      });

      it('should be able to save with correct coordinates (float)', async function () {
        offerHost.location = [60.192059, 24.945831];

        await offerHost.save();
      });
    });
  });
});
