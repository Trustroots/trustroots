/**
 * Unit tests for statistics controller helpers and write endpoints.
 */
const mongoose = require('mongoose');
const sinon = require('sinon');

require('../../../offers/server/models/offer.server.model');
require('../../../users/server/models/user.server.model');
require('../../../experiences/server/models/experiences.server.model');
const statistics = require('../../server/controllers/statistics.server.controller');
const statService = require('../../../stats/server/services/stats.server.service');
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

const User = mongoose.model('User');
const Offer = mongoose.model('Offer');
const Experience = mongoose.model('Experience');

function deferredResponse() {
  let resolveResponse;
  const promise = new Promise(resolve => {
    resolveResponse = resolve;
  });
  const res = { body: null, headers: {}, sendCount: 0, statusCode: 200 };
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.send = body => {
    res.sendCount += 1;
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.json = body => {
    res.sendCount += 1;
    res.body = body;
    resolveResponse(res);
    return res;
  };
  res.header = (name, value) => {
    res.headers[name.toLowerCase()] = value;
    return res;
  };
  res.waitForResponse = () => promise;
  return res;
}

describe('Statistics controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    if (mongoose.connection.readyState !== 1) {
      return undefined;
    }
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

    it('getUserLanguagesCount propagates database errors', done => {
      sinon.stub(User, 'aggregate').callsFake((pipeline, cb) => cb(dbError));
      statistics.getUserLanguagesCount(5, err => {
        err.should.be.Error();
        done();
      });
    });

    it('getExperienceStatistics propagates database errors', done => {
      sinon
        .stub(Experience, 'aggregate')
        .callsFake((pipeline, cb) => cb(dbError));
      statistics.getExperienceStatistics(new Date(), err => {
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

    [
      'couchers',
      'bewelcome',
      'couchsurfing',
      'warmshowers',
      'facebook',
      'twitter',
      'nostr',
    ].forEach(site => {
      it(`counts users connected to ${site}`, async () => {
        const [saved] = await utils.saveUsers(utils.generateUsers(1));
        const userDoc = await User.findById(saved._id);
        userDoc.public = true;

        switch (site) {
          case 'couchers':
            userDoc.extSitesCouchers = 'https://couchers.org/user/1';
            break;
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
          case 'nostr':
            userDoc.nostrNpub =
              'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
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
    });
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

    it('aggregates all experiences and unique real-life connections', async () => {
      const users = await utils.saveUsers(utils.generateUsers(4));
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

      await Experience.create([
        {
          userFrom: users[0]._id,
          userTo: users[1]._id,
          public: true,
          recommend: 'yes',
          interactions: { met: true, guest: false, host: false },
        },
        {
          userFrom: users[1]._id,
          userTo: users[0]._id,
          public: true,
          recommend: 'no',
          interactions: { met: true, guest: false, host: false },
        },
        {
          userFrom: users[1]._id,
          userTo: users[2]._id,
          public: true,
          recommend: 'unknown',
          interactions: { met: false, guest: false, host: true },
        },
        {
          userFrom: users[2]._id,
          userTo: users[3]._id,
          public: true,
          created: oldDate,
          recommend: 'no',
          interactions: { met: true, guest: false, host: false },
        },
        {
          userFrom: users[3]._id,
          userTo: users[0]._id,
          public: false,
          recommend: 'yes',
          interactions: { met: true, guest: false, host: false },
        },
      ]);

      const experienceStatistics = await new Promise((resolve, reject) => {
        statistics.getExperienceStatistics(since, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
      });

      experienceStatistics.should.deepEqual({
        total: 5,
        recommended: 2,
        notRecommended: 2,
        recent: { total: 4, recommended: 2, notRecommended: 1 },
        realLifeConnections: { total: 3, recent: 2 },
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

    it('ignores unknown statuses and defaults invalid counts to zero', done => {
      sinon.stub(Offer, 'aggregate').callsFake((pipeline, cb) => {
        cb(null, [
          { _id: 'yes', count: '2' },
          { _id: 'maybe', count: 'not-a-number' },
          { _id: 'other', count: '9' },
        ]);
      });

      statistics.getHostOffersCount((err, counters) => {
        if (err) return done(err);
        counters.should.deepEqual({ yes: 2, maybe: 0, no: 0 });
        done();
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
      res.body.connections
        .map(connection => connection.network)
        .should.containEql('nostr');
      res.body.should.have.property('newsletter');
      res.body.should.have.property('experiences');
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

    ['couchsurfing', 'warmshowers', 'facebook', 'github', 'nostr'].forEach(
      site => {
        it(`returns 400 when ${site} count fails`, async () => {
          const original = statistics.getExternalSiteCount;
          statistics.getExternalSiteCount = function (requestedSite, cb) {
            if (requestedSite === site) {
              return cb(new Error(`${site} count failed`));
            }
            return original.call(statistics, requestedSite, cb);
          };

          const res = deferredResponse();
          statistics.getPublicStatistics({}, res);
          await res.waitForResponse();
          statistics.getExternalSiteCount = original;
          res.statusCode.should.equal(400);
        });
      },
    );

    it('returns 400 when newsletter count fails', async () => {
      sinon
        .stub(statistics, 'getNewsletterSubscriptionsCount')
        .callsFake(cb => {
          cb(new Error('newsletter count failed'));
        });

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when hosting count fails', async () => {
      sinon.stub(statistics, 'getHostOffersCount').callsFake(cb => {
        cb(new Error('hosting count failed'));
      });

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns 400 when experience statistics fail', async () => {
      sinon
        .stub(statistics, 'getExperienceStatistics')
        .callsFake((since, cb) => {
          cb(new Error('experience statistics failed'));
        });

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
    });

    it('returns zeroed hosting stats when there are no host offers', async () => {
      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(200);
      res.body.hosting.total.should.equal(0);
      res.body.hosting.yes.should.equal(0);
      res.body.hosting.maybe.should.equal(0);
    });
  });

  describe('collectStatistics', () => {
    it('rejects missing stats payload', async () => {
      const stat = sinon.stub(statService, 'stat');
      const res = deferredResponse();
      statistics.collectStatistics(
        { body: { collection: 'mobileAppInit' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.sendCount.should.equal(1);
      res.headers['x-tr-update-needed'].should.containEql('update');
      stat.called.should.be.false();
    });

    it('rejects an invalid collection', async () => {
      const stat = sinon.stub(statService, 'stat');
      const res = deferredResponse();
      statistics.collectStatistics(
        { body: { stats: { version: '1.0.0' }, collection: 'invalid' } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.sendCount.should.equal(1);
      res.headers['x-tr-update-needed'].should.containEql('update');
      stat.called.should.be.false();
    });

    it('rejects a missing collection', async () => {
      const stat = sinon.stub(statService, 'stat');
      const res = deferredResponse();
      statistics.collectStatistics(
        { body: { stats: { version: '1.0.0' } } },
        res,
      );
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.body.message.should.equal('Missing or invalid `collection`.');
      res.sendCount.should.equal(1);
      res.headers['x-tr-update-needed'].should.containEql('update');
      stat.called.should.be.false();
    });

    it('accepts a current mobile app version', async () => {
      const stat = sinon.stub(statService, 'stat').callsFake((stats, cb) => {
        cb();
      });
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
      res.sendCount.should.equal(1);
      stat.calledOnce.should.be.true();
      stat.firstCall.args[0].namespace.should.equal('mobileAppInit');
      stat.firstCall.args[0].counts.count.should.equal(1);
      stat.firstCall.args[0].tags.version.should.equal('1.0.0');
      stat.firstCall.args[0].tags.deviceYearClass.should.equal('unknown');
      stat.firstCall.args[0].meta.os.should.equal('android');
      stat.firstCall.args[0].meta.expoVersion.should.equal('unknown');
    });

    it('asks outdated mobile apps to update', async () => {
      sinon.stub(statService, 'stat').callsFake((stats, cb) => {
        cb();
      });
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
      res.sendCount.should.equal(1);
      res.headers['x-tr-update-needed'].should.containEql('update');
    });
  });
});
