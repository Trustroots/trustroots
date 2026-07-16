const request = require('supertest');
const mongoose = require('mongoose');
const express = require('../../../../config/lib/express');
const utils = require('../../../../testutils/server/data.server.testutil');
const statistics = require('../../server/controllers/statistics.server.controller');

require('should');

const Offer = mongoose.model('Offer');
const Experience = mongoose.model('Experience');
const MessageStat = mongoose.model('MessageStat');
const ReferenceThread = mongoose.model('ReferenceThread');
const validNpub =
  'npub1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqzqujme';
const differentNpub =
  'npub1zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygse4sl3h';

function assertStats(stats) {
  stats.total.should.equal(4);

  stats.connections.should.have.lengthOf(6);
  stats.connections.map(connection => {
    connection.count.should.equal(2);
    connection.percentage.should.equal(50);
  });

  stats.hosting.total.should.equal(2);
  stats.hosting.percentage.should.equal(50);
  stats.hosting.maybe.should.equal(1);
  stats.hosting.maybePercentage.should.equal(50);
  stats.hosting.yes.should.equal(1);
  stats.hosting.yesPercentage.should.equal(50);

  stats.newsletter.count.should.equal(2);
  stats.newsletter.percentage.should.equal(50);

  stats.experiences.should.deepEqual({
    total: 5,
    recommended: 2,
    notRecommended: 2,
    recent: { total: 4, recommended: 2, notRecommended: 1 },
    realLifeConnections: { total: 3, recent: 2 },
  });

  stats.messageInteractions.should.deepEqual({
    total: 2,
    positive: 2,
    negative: 1,
    recent: { total: 1, positive: 1, negative: 1 },
  });
}

/**
 * Statistics routes tests
 */
describe('Statistics CRUD tests', () => {
  const app = express.init(mongoose.connection);
  const agent = request.agent(app);

  describe('Reading statistics', async () => {
    let users;

    // Not belonging to any network
    const _usersPublic1 = utils.generateUsers(2, {
      public: true,
    });

    // Belonging to networks
    const _usersPublic2 = utils.generateUsers(2, {
      public: true,
      newsletter: true,
      extSitesCouchers: 'username',
      extSitesCS: 'username',
      extSitesBW: 'username',
      extSitesWS: '12312312',
      additionalProvidersData: {
        facebook: {
          username: 'username',
        },
        twitter: {
          username: 'username',
        },
        github: {
          username: 'username',
        },
      },
    });

    _usersPublic2[0].nostrNpub = validNpub;
    _usersPublic2[1].nostrNpub = differentNpub;

    const _usersPrivate = utils.generateUsers(1, {
      public: false,
      newsletter: true,
      extSitesCS: 'nonpublic',
      extSitesBW: 'nonpublic',
      extSitesWS: '12312312',
      additionalProvidersData: {
        facebook: {
          username: 'username',
        },
        twitter: {
          username: 'username',
        },
        github: {
          username: 'username',
        },
      },
    });

    const _users = [..._usersPublic1, ..._usersPublic2, ..._usersPrivate];

    // Save database contents just once because we're not modifying anything between tests
    before(async () => {
      statistics.clearPublicStatisticsCache();
      users = await utils.saveUsers(_users);

      // @TODO: add via test utils
      const offer = {
        description: '',
        location: [52.498981209298776, 13.418329954147339],
        locationFuzzy: [52.50155039101136, 13.42255019882177],
        maxGuests: 1,
        noOfferDescription: '',
        type: 'host',
        updated: new Date(),
      };

      await new Offer({
        ...offer,
        status: 'yes',
        user: users[0]._id,
      }).save();

      await new Offer({
        ...offer,
        status: 'maybe',
        user: users[1]._id,
      }).save();

      await new Offer({
        ...offer,
        status: 'no',
        user: users[2]._id,
      }).save();

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
          created: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000),
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

      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      const recentDate = new Date();

      await MessageStat.create([
        {
          firstMessageUserFrom: users[0]._id,
          firstMessageUserTo: users[1]._id,
          firstMessageCreated: recentDate,
          firstReplyCreated: recentDate,
        },
        {
          firstMessageUserFrom: users[1]._id,
          firstMessageUserTo: users[2]._id,
          firstMessageCreated: oldDate,
          firstReplyCreated: oldDate,
        },
        {
          firstMessageUserFrom: users[2]._id,
          firstMessageUserTo: users[3]._id,
          firstMessageCreated: recentDate,
          firstReplyCreated: null,
        },
      ]);

      await ReferenceThread.create([
        {
          thread: new mongoose.Types.ObjectId(),
          userFrom: users[0]._id,
          userTo: users[1]._id,
          reference: 'yes',
          created: oldDate,
        },
        {
          thread: new mongoose.Types.ObjectId(),
          userFrom: users[0]._id,
          userTo: users[1]._id,
          reference: 'no',
          created: recentDate,
        },
        {
          thread: new mongoose.Types.ObjectId(),
          userFrom: users[1]._id,
          userTo: users[0]._id,
          reference: 'yes',
          created: recentDate,
        },
        {
          thread: new mongoose.Types.ObjectId(),
          userFrom: users[1]._id,
          userTo: users[2]._id,
          reference: 'yes',
          created: oldDate,
        },
        {
          thread: new mongoose.Types.ObjectId(),
          userFrom: users[2]._id,
          userTo: users[3]._id,
          reference: 'yes',
          created: recentDate,
        },
      ]);
    });

    after(() => {
      statistics.clearPublicStatisticsCache();
      return utils.clearDatabase();
    });

    it('should be able to read statistics when not logged in', async () => {
      const { body } = await agent.get('/api/statistics').expect(200);
      assertStats(body);
    });
  });

  describe('Writing statistics', () => {
    after(utils.clearDatabase);

    it('should be able to write to statistics endpoint', async () => {
      const { body, headers } = await agent
        .post('/api/statistics')
        .send({
          collection: 'mobileAppInit',
          stats: {
            version: '1.0.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android',
          },
        })
        .expect(200);

      body.message.should.equal('OK');
      headers.should.not.have.property('x-tr-update-needed');
    });

    it('should return update header with invalid collection value', async () => {
      const { body, headers } = await agent
        .post('/api/statistics')
        .send({
          collection: 'WRONG',
          stats: {
            version: '1.0.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android',
          },
        })
        .expect(400);

      body.message.should.equal('Missing or invalid `collection`.');
      headers.should.have.property('x-tr-update-needed');
      headers['x-tr-update-needed'].should.equal(
        'You should update Trustroots app or otherwise it will not continue functioning.',
      );
    });

    it('should return update header with old app version', async () => {
      const { body, headers } = await agent
        .post('/api/statistics')
        .send({
          collection: 'mobileAppInit',
          stats: {
            version: '0.1.0',
            deviceYearClass: '2015',
            expoVersion: '21.0.0',
            os: 'android',
          },
        })
        .expect(200);

      body.message.should.equal(
        'You should update Trustroots app or otherwise it will not continue functioning.',
      );
      headers.should.have.property('x-tr-update-needed');
      headers['x-tr-update-needed'].should.equal(
        'You should update Trustroots app or otherwise it will not continue functioning.',
      );
    });
  });
});
