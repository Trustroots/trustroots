/**
 * Unit tests for the admin acquisition stories controller.
 */
const should = require('should');
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const adminAcquisitionStories = require('../../server/controllers/admin.acquisition-stories.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
const User = mongoose.model('User');

function mockResponse() {
  const res = { statusCode: 200, body: null };
  res.status = function (code) {
    res.statusCode = code;
    return res;
  };
  res.send = function (body) {
    res.body = body;
    return res;
  };
  return res;
}

describe('Admin acquisition stories controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    return utils.clearDatabase();
  });

  describe('list', () => {
    it('returns acquisition stories for users who have one', async () => {
      const users = utils.generateUsers(2);
      users[0].acquisitionStory = 'Found via couch surfing';
      users[0].member = [{ tribe: new mongoose.Types.ObjectId() }];
      users[1].acquisitionStory = '';

      await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body.length.should.equal(1);
      res.body[0].acquisitionStory.should.equal('Found via couch surfing');
      res.body[0].circleCount.should.equal(1);
      should(res.body[0].member).be.undefined();
    });

    it('returns an empty array when no stories exist', async () => {
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body.should.eql([]);
    });

    it('returns an empty array when story lookup returns null', async () => {
      sinon.stub(User, 'find').returns({
        sort: () => ({
          limit: () => ({
            exec: () => Promise.resolve(null),
          }),
        }),
      });

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body.should.eql([]);
    });
  });

  describe('getAnalysis', () => {
    const acquisitionStories = [
      '123',
      'Google',
      'facebook',
      'googling',
      'googl',
      'singles',
      'ws',
      'warmshower',
      'www.warmshowers.com',
      'warm showers',
      'something else ... :)',
      'example.org',
      'http://example.org',
      'www example org',
      'www.example.org',
    ];

    beforeEach(async () => {
      const users = utils
        .generateUsers(acquisitionStories.length)
        .map((user, index) => {
          user.acquisitionStory = acquisitionStories[index];
          return user;
        });

      await utils.saveUsers(users);
    });

    it('returns frequency analysis with expected shape', async () => {
      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      should.exist(res.body);
      should(res.body).have.property('table');
      should(res.body).have.property('size');
      should(res.body).have.property('sum');
      should(res.body).have.property('x2');
      should(res.body).have.property('df');
      should(res.body).have.property('entropy');
      res.body.table.should.be.an.Array();
      res.body.table.length.should.be.above(0);
      should(res.body.table[0]).have.property('category');
      should(res.body.table[0]).have.property('observed');
      should(res.body.table[0]).have.property('percentage');
      should(res.body.table[0]).have.property('expected');
    });

    it('normalizes synonyms, compounds, typos, and domains', async () => {
      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      const categories = res.body.table.map(row => row.category);

      categories.should.containEql('google');
      categories.should.containEql('facebook');
      categories.should.containEql('warmshowers');
      categories.should.containEql('example');
      categories.should.containEql('single');
      categories.should.containEql('something');
    });

    it('ignores URL tokens that cannot be parsed', async () => {
      const controller = proxyquire(
        '../../server/controllers/admin.acquisition-stories.server.controller',
        {
          'wink-tokenizer': () => ({
            tokenize: () => [{ tag: 'url', value: 'not a valid url' }],
          }),
        },
      );
      const users = utils.generateUsers(1);
      users[0].acquisitionStory = 'malformed url token';
      await utils.saveUsers(users);

      const res = mockResponse();
      await controller.getAnalysis({}, res);

      should.exist(res.body);
      res.body.table.should.be.an.Array();
      res.body.table.should.have.length(0);
    });
  });
});
