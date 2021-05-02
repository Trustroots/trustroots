const request = require('supertest');
const path = require('path');
const mongoose = require('mongoose');
const express = require(path.resolve('./config/lib/express'));
const utils = require(path.resolve('./testutils/server/data.server.testutil'));

require('should');

const Offer = mongoose.model('Offer');

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
    });

    after(utils.clearDatabase);

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
