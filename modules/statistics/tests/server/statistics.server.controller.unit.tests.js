/**
 * Unit tests for statistics controller helpers and write endpoints.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

const statistics = require('../../server/controllers/statistics.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');
const Offer = mongoose.model('Offer');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { statusCode: 200, body: null };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.header = () => res;
  res.waitForResponse = () => promise;
  return res;
}

describe('Statistics controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('count helper error callbacks', () => {
    const dbError = new Error('db unavailable');

    it('getUsersCount propagates database errors', done => {
      sinon.stub(User, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getUsersCount(err => {
        err.should.be.Error();
        done();
      });
    });

    it('getNewsletterSubscriptionsCount propagates database errors', done => {
      sinon.stub(User, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getNewsletterSubscriptionsCount(err => {
        err.should.be.Error();
        done();
      });
    });

    it('getPushRegistrationCount propagates database errors', done => {
      sinon.stub(User, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getPushRegistrationCount(err => {
        err.should.be.Error();
        done();
      });
    });

    it('getLastSeenStatistic propagates database errors', done => {
      sinon.stub(User, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getLastSeenStatistic({ days: 7 }, err => {
        err.should.be.Error();
        done();
      });
    });

    it('getExternalSiteCount propagates database errors', done => {
      sinon.stub(User, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getExternalSiteCount('github', err => {
        err.should.be.Error();
        done();
      });
    });

    it('getMeetOffersCount propagates database errors', done => {
      sinon.stub(Offer, 'countDocuments').callsFake((query, cb) => cb(dbError));
      statistics.getMeetOffersCount(err => {
        err.should.be.Error();
        done();
      });
    });

    it('getHostOffersCount propagates database errors', done => {
      sinon.stub(Offer, 'aggregate').callsFake((pipeline, cb) => cb(dbError));
      statistics.getHostOffersCount(err => {
        err.should.be.Error();
        done();
      });
    });
  });

  describe('getExternalSiteCount', () => {
    it('errors for an invalid site id', done => {
      statistics.getExternalSiteCount('invalid', err => {
        err.should.be.Error();
        err.message.should.equal('Missing external site id.');
        done();
      });
    });

    it('counts users connected to github', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = true;
      userDoc.additionalProvidersData = { github: { id: '123' } };
      await userDoc.save();

      await new Promise((resolve, reject) => {
        statistics.getExternalSiteCount('github', (err, count) => {
          if (err) return reject(err);
          count.should.equal(1);
          resolve();
        });
      });
    });

    ['bewelcome', 'couchsurfing', 'warmshowers', 'facebook', 'twitter'].forEach(
      site => {
        it(`counts users connected to ${site}`, async () => {
          const [saved] = await utils.saveUsers(utils.generateUsers(1));
          const userDoc = await User.findById(saved._id);
          userDoc.public = true;

          switch (site) {
            case 'bewelcome':
              userDoc.extSitesBW = 'https://bewelcome.org/member/1';
              break;
            case 'couchsurfing':
              userDoc.extSitesCS = 'https://couchsurfing.com/1';
              break;
            case 'warmshowers':
              userDoc.extSitesWS = 'https://warmshowers.org/1';
              break;
            case 'facebook':
              userDoc.additionalProvidersData = { facebook: { id: '1' } };
              break;
            case 'twitter':
              userDoc.additionalProvidersData = { twitter: { id: '1' } };
              break;
            default:
              break;
          }

          await userDoc.save();

          await new Promise((resolve, reject) => {
            statistics.getExternalSiteCount(site, (err, count) => {
              if (err) return reject(err);
              count.should.equal(1);
              resolve();
            });
          });
        });
      },
    );
  });

  describe('count helpers', () => {
    it('counts public users', async () => {
      await utils.saveUsers(utils.generateUsers(2, { public: true }));
      await new Promise((resolve, reject) => {
        statistics.getUsersCount((err, count) => {
          if (err) return reject(err);
          count.should.be.aboveOrEqual(2);
          resolve();
        });
      });
    });

    it('counts meet offers', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await new Offer({
        type: 'meet',
        location: [1, 2],
        user: saved._id,
      }).save();

      await new Promise((resolve, reject) => {
        statistics.getMeetOffersCount((err, count) => {
          if (err) return reject(err);
          count.should.equal(1);
          resolve();
        });
      });
    });

    it('counts push registrations', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.public = true;
      userDoc.pushRegistration = [{ platform: 'android', token: 'abc' }];
      await userDoc.save();

      await new Promise((resolve, reject) => {
        statistics.getPushRegistrationCount((err, count) => {
          if (err) return reject(err);
          count.should.equal(1);
          resolve();
        });
      });
    });

    it('counts users seen recently', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.seen = new Date();
      await userDoc.save();

      await new Promise((resolve, reject) => {
        statistics.getLastSeenStatistic({ days: 7 }, (err, count) => {
          if (err) return reject(err);
          count.should.be.aboveOrEqual(1);
          resolve();
        });
      });
    });

    it('counts newsletter subscribers', async () => {
      await utils.saveUsers(
        utils.generateUsers(2, { public: true, newsletter: true }),
      );

      await new Promise((resolve, reject) => {
        statistics.getNewsletterSubscriptionsCount((err, count) => {
          if (err) return reject(err);
          count.should.be.aboveOrEqual(2);
          resolve();
        });
      });
    });

    it('returns top spoken languages', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = await User.findById(saved._id);
      userDoc.languages = ['eng', 'fin'];
      await userDoc.save();

      await new Promise((resolve, reject) => {
        statistics.getUserLanguagesCount(5, (err, counts) => {
          if (err) return reject(err);
          counts.length.should.be.aboveOrEqual(1);
          resolve();
        });
      });
    });
  });

  describe('getHostOffersCount', () => {
    it('returns zeroed counters when there are no host offers', done => {
      statistics.getHostOffersCount((err, counters) => {
        if (err) return done(err);
        counters.should.deepEqual({ yes: 0, maybe: 0, no: 0 });
        done();
      });
    });

    it('groups host offers by status', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      await new Offer({
        type: 'host',
        status: 'yes',
        location: [1, 2],
        user: saved._id,
      }).save();
      await new Offer({
        type: 'host',
        status: 'maybe',
        location: [1, 2],
        user: saved._id,
      }).save();

      await new Promise((resolve, reject) => {
        statistics.getHostOffersCount((err, counters) => {
          if (err) return reject(err);
          counters.yes.should.equal(1);
          counters.maybe.should.equal(1);
          resolve();
        });
      });
    });
  });

  describe('getPublicStatistics', () => {
    it('returns aggregated public statistics', async () => {
      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.should.have.property('total');
      res.body.should.have.property('connections');
      res.body.should.have.property('hosting');
      res.body.connections.length.should.be.aboveOrEqual(6);
      res.body.should.have.property('newsletter');
    });

    it('returns 400 when collecting public statistics fails', async () => {
      sinon.stub(statistics, 'getUsersCount').callsFake(cb => {
        cb(new Error('statistics unavailable'));
      });

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when an external site count fails', async () => {
      const original = statistics.getExternalSiteCount;
      statistics.getExternalSiteCount = function (site, cb) {
        if (site === 'bewelcome') {
          return cb(new Error('bewelcome count failed'));
        }
        return original.call(statistics, site, cb);
      };

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      statistics.getExternalSiteCount = original;
      res.statusCode.should.equal(400);
    });
  });

  describe('collectStatistics', () => {
    it('rejects missing stats payload', async () => {
      const res = deferredResponse();
      statistics.collectStatistics(
        { body: { collection: 'mobileAppInit' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('rejects an invalid collection', async () => {
      const res = deferredResponse();
      statistics.collectStatistics(
        { body: { stats: { version: '1.0.0' }, collection: 'invalid' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('accepts a current mobile app version', async () => {
      const res = deferredResponse();
      statistics.collectStatistics(
        {
          body: {
            collection: 'mobileAppInit',
            stats: { version: '1.0.0', os: 'android' },
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.equal('OK');
    });

    it('asks outdated mobile apps to update', async () => {
      const res = deferredResponse();
      statistics.collectStatistics(
        {
          body: {
            collection: 'mobileAppInit',
            stats: { version: '0.5.0', os: 'ios' },
          },
        },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.message.should.containEql('update');
    });
  });
});
