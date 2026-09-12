/**
 * Unit tests for the admin acquisition stories controller.
 */
const should = require('should');
const mongoose = require('mongoose');
const proxyquire = require('proxyquire').noCallThru();
const sinon = require('sinon');

const adminAcquisitionStories = require('../../server/controllers/admin.acquisition-stories.server.controller');
const utils = require('../../../../testutils/server/data.server.testutil');
const Offer = mongoose.model('Offer');
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
    it('yields to I/O at the source limits and prepares each story only once', async function () {
      this.timeout(30000);
      const readStory = sinon.spy(
        () =>
          'A fictional traveller recommended this community while discussing a journey.',
      );
      const stories = Array.from({ length: 500 }, (_, index) => ({
        _id: `visitor-${index}`,
        username: `visitor${index}`,
        email: `visitor${index}@example.test`,
        emailTemporary: '',
        member: [],
        acquisitionStory: 'An unrelated fictional source with different words.',
      }));
      const restrictedUsers = Array.from({ length: 1000 }, (_, index) => ({
        _id: `restricted-${index}`,
        username: `restricted${index}`,
        email: `restricted${index}@example.test`,
        emailTemporary: '',
        get acquisitionStory() {
          return readStory();
        },
      }));
      const find = sinon.stub(User, 'find');
      const storyLimit = sinon.stub().returns({ exec: async () => stories });
      find.onFirstCall().returns({
        sort: () => ({ limit: storyLimit }),
      });
      find.onSecondCall().returns({
        select: () => ({
          sort: () => ({
            limit: () => ({ exec: async () => restrictedUsers }),
          }),
        }),
      });
      sinon.stub(Offer, 'find').returns({
        select: () => ({ sort: () => ({ exec: async () => [] }) }),
      });
      let ioTurns = 0;
      let pending;
      const heartbeat = () => {
        ioTurns += 1;
        pending = setImmediate(heartbeat);
      };
      pending = setImmediate(heartbeat);
      const res = mockResponse();
      try {
        await adminAcquisitionStories.list({}, res);
      } finally {
        clearImmediate(pending);
      }
      sinon.assert.calledOnceWithExactly(storyLimit, 500);
      ioTurns.should.be.aboveOrEqual(5000);
      readStory.callCount.should.equal(1000);
      res.body.should.have.length(500);
      res.body
        .every(story => story.restrictedMatches.length === 0)
        .should.be.true();
    });

    it('keeps the first ten matches in source order and excludes the member itself', async () => {
      const users = utils.generateUsers(12);
      users.forEach(user => {
        user.roles = ['user', 'shadowban'];
        user.acquisitionStory = 'The same fictional community recommendation.';
      });
      await utils.saveUsers(users);
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);
      const expected = await User.find({ roles: 'shadowban' }).sort({
        created: -1,
        _id: 1,
      });
      res.body.forEach(story => {
        story.restrictedMatches
          .map(user => user._id.toString())
          .should.deepEqual(
            expected
              .filter(user => !user._id.equals(story._id))
              .slice(0, 10)
              .map(user => user._id.toString()),
          );
      });
    });

    it('returns acquisition stories for users who have one', async () => {
      const users = utils.generateUsers(2);
      users[0].acquisitionStory = 'Found via couch surfing';
      users[0].member = [{ tribe: new mongoose.Types.ObjectId() }];
      users[0].locationFrom = 'Fictional origin';
      users[0].locationLiving = 'Fictional home';
      users[1].acquisitionStory = '';

      await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body.length.should.equal(1);
      res.body[0].acquisitionStory.should.equal('Found via couch surfing');
      res.body[0].circleCount.should.equal(1);
      res.body[0].locationFrom.should.equal('Fictional origin');
      res.body[0].locationLiving.should.equal('Fictional home');
      should(res.body[0].hostingLocation).equal(null);
      should(res.body[0].member).be.undefined();
      res.body[0].restrictedMatches.should.deepEqual([]);
      should(res.body[0].email).be.undefined();
      should(res.body[0].emailTemporary).be.undefined();
    });

    it('returns identifier, exact-story, and fuzzy-story restricted matches', async () => {
      const users = utils.generateUsers(4);
      users[0].username = 'identifier-clue-copy';
      users[0].email = 'active@example.test';
      users[0].acquisitionStory =
        'I heard about Trustroots through a travelling friend.';

      users[1].username = 'exact-story-user';
      users[1].email = 'exact@example.test';
      users[1].roles = ['user', 'shadowban'];
      users[1].acquisitionStory =
        '  I HEARD about Trustroots through a travelling friend.  ';

      users[2].username = 'fuzzy-story-user';
      users[2].email = 'fuzzy@example.test';
      users[2].roles = ['user', 'suspended'];
      users[2].acquisitionStory =
        'I heard about Trustroots through one travelling friend.';

      users[3].username = 'identifierclue';
      users[3].email = 'unrelated@example.test';
      users[3].roles = ['user', 'shadowban'];
      users[3].acquisitionStory = 'A completely different source.';

      await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      const story = res.body.find(
        user => user.username === 'identifier-clue-copy',
      );
      story.restrictedMatches.should.have.length(3);
      story.restrictedMatches
        .find(user => user.username === 'exact-story-user')
        .matchReasons.should.deepEqual(['Acquisition story']);
      story.restrictedMatches
        .find(user => user.username === 'fuzzy-story-user')
        .matchReasons.should.deepEqual(['Similar acquisition story']);
      story.restrictedMatches
        .find(user => user.username === 'identifierclue')
        .matchReasons.should.deepEqual(['Username identifier']);
      story.restrictedMatches.forEach(match => {
        should(match.email).be.undefined();
        ['shadowban', 'suspended']
          .some(role => match.roles.includes(role))
          .should.equal(true);
      });
    });

    it('returns the latest hosting location with acquisition stories', async () => {
      const users = utils.generateUsers(1);
      users[0].acquisitionStory = 'Found through friends';
      const [savedUser] = await utils.saveUsers(users);
      sinon.stub(Offer, 'find').returns({
        select: () => ({
          sort: () => ({
            exec: () =>
              Promise.resolve([
                {
                  user: savedUser._id,
                  location: [10, 20],
                  locationFuzzy: [10.1, 20.1],
                },
                {
                  user: savedUser._id,
                  location: [30, 40],
                  locationFuzzy: [],
                },
              ]),
          }),
        }),
      });

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body[0].hostingLocation.should.deepEqual([10.1, 20.1]);
    });

    it('falls back to a precise hosting location when no fuzzy value exists', async () => {
      const users = utils.generateUsers(1);
      users[0].acquisitionStory = 'Found through a gathering';
      const [savedUser] = await utils.saveUsers(users);
      sinon.stub(Offer, 'find').returns({
        select: () => ({
          sort: () => ({
            exec: () =>
              Promise.resolve([
                {
                  user: savedUser._id,
                  location: [30, 40],
                  locationFuzzy: [],
                },
              ]),
          }),
        }),
      });

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body[0].hostingLocation.should.deepEqual([30, 40]);
    });

    it('handles a missing hosting-offer result', async () => {
      const users = utils.generateUsers(1);
      users[0].acquisitionStory = 'Found through a cyclist';
      await utils.saveUsers(users);
      sinon.stub(Offer, 'find').returns({
        select: () => ({
          sort: () => ({
            exec: () => Promise.resolve(null),
          }),
        }),
      });

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      should(res.body[0].hostingLocation).equal(null);
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
      const find = sinon.spy(User, 'find');
      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      find.firstCall.returnValue.options.limit.should.equal(3000);
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

  describe('getStorySimilarity', () => {
    it('requires substantive stories and scores small edits highly', () => {
      adminAcquisitionStories
        .getStorySimilarity('short', 'short')
        .should.equal(0);
      adminAcquisitionStories
        .getStorySimilarity(
          'A travelling friend recommended Trustroots to me.',
          'A traveler friend recommended Trustroots to me.',
        )
        .should.be.above(0.82);
    });
  });
});
