import type {
  OfferDocument,
  OfferModel,
  OfferRecord,
  UserModel,
  UserModelDocument,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';
/**
 * Module dependencies.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const utils: typeof import('../../../../testutils/server/data.server.testutil') = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model<UserRecord, UserModel>('User');
const Offer = mongoose.model<OfferRecord, OfferModel>('Offer');
/**
 * Globals
 */
let user: UserModelDocument;
let offerHost: OfferDocument;
let offerMeet: OfferDocument;
/**
 * Unit tests
 */
describe('Offer Model Unit Tests:', function () {
  it('defaults hosting acknowledgement off and persists the explicit preference', async () => {
    const offer = new Offer({ type: 'host', location: [12, 34] });
    offer.get('requireHostingDescriptionAcknowledgement').should.equal(false);
    offer.set('requireHostingDescriptionAcknowledgement', true);
    await offer.save();
    const saved = await Offer.findById(offer._id);
    should.exist(saved);
    saved!.get('requireHostingDescriptionAcknowledgement').should.equal(true);
  });
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
    user
      .save()
      .then(user => {
        should.not.exist(null);
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
      })
      .catch(done);
  });
  afterEach(utils.clearDatabase);
  describe('Method Save', function () {
    it('should be able to save host offer without problems', function (done) {
      offerHost
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to save meet offer without problems', function (done) {
      offerMeet
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to save without problems with empty descriptions', function (done) {
      offerHost.description = '';
      offerHost.noOfferDescription = '';
      offerHost
        .save()
        .then(() => {
          should.not.exist(null);
          return done();
        })
        .catch(done);
    });
    it('should be able to save without problems with with limited html in descriptions', function (done) {
      const html = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;
      offerHost
        .save()
        .then(updatedofferHost => {
          should.not.exist(null);
          updatedofferHost.description!.should.equal(html);
          updatedofferHost.noOfferDescription!.should.equal(html);
          return done();
        })
        .catch(done);
    });
    it('should be able to clean excessive html from descriptions', function (done) {
      const html =
        '<p><strong><img src="http://www.example.com/i.png"><script>alert();</script>HTML</strong></p>';
      const htmlClean = '<p><b>HTML</b></p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;
      offerHost
        .save()
        .then(updatedofferHost => {
          should.not.exist(null);
          updatedofferHost.description!.should.equal(htmlClean);
          updatedofferHost.noOfferDescription!.should.equal(htmlClean);
          return done();
        })
        .catch(done);
    });
    it('should be able to save empty html descriptions as empty strings', function (done) {
      const html = '<p> <br><br><br> </p>';
      offerHost.description = html;
      offerHost.noOfferDescription = html;
      offerHost
        .save()
        .then(updatedofferHost => {
          should.not.exist(null);
          updatedofferHost.description!.should.equal('');
          updatedofferHost.noOfferDescription!.should.equal('');
          return done();
        })
        .catch(done);
    });
    it('should be able to show an error when try to save without status', function (done) {
      offerHost.set('status', '');
      offerHost
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            return done();
          },
        )
        .catch(done);
    });
    it('should be able to show an error when try to save without type', function (done) {
      offerHost.set('type', '');
      offerHost
        .save()
        .then(
          () => {
            throw new Error('Expected the operation to reject');
          },
          err => {
            should.exist(err);
            return done();
          },
        )
        .catch(done);
    });
    describe('Location Validation', function () {
      it('should be able to show an error when try to save with empty array location', function (done) {
        offerHost.location = [];
        offerHost
          .save()
          .then(
            () => {
              throw new Error('Expected the operation to reject');
            },
            err => {
              should.exist(err);
              return done();
            },
          )
          .catch(done);
      });
      it('should be able to show an error when try to save with coordinates outside lat/lon scale', function (done) {
        offerHost.location = [10000.0, 32.0];
        offerHost
          .save()
          .then(
            () => {
              throw new Error('Expected the operation to reject');
            },
            err => {
              should.exist(err);
              return done();
            },
          )
          .catch(done);
      });
      it('should be able to show an error when try to save location with too few coordinate values', function (done) {
        offerHost.location = [60.1];
        offerHost
          .save()
          .then(
            () => {
              throw new Error('Expected the operation to reject');
            },
            err => {
              should.exist(err);
              return done();
            },
          )
          .catch(done);
      });
      it('should be able to show an error when try to save location with too many coordinate values', function (done) {
        offerHost.location = [60.1, 24.1, 24.1];
        offerHost
          .save()
          .then(
            () => {
              throw new Error('Expected the operation to reject');
            },
            err => {
              should.exist(err);
              return done();
            },
          )
          .catch(done);
      });
      it('should be able to save with correct coordinates (integer)', function (done) {
        offerHost.location = [60, 24];
        offerHost
          .save()
          .then(() => {
            should.not.exist(null);
            return done();
          })
          .catch(done);
      });
      it('should be able to save with correct coordinates (float)', function (done) {
        offerHost.location = [60.192059, 24.945831];
        offerHost
          .save()
          .then(() => {
            should.not.exist(null);
            return done();
          })
          .catch(done);
      });
    });
  });
});
