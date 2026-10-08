/**
 * Unit tests for the admin acquisition stories controller.
 */
const should = require('should');
const mongoose = require('mongoose');
const sinon = require('sinon');

const adminAcquisitionStories = require('./../../server/controllers/admin.acquisition-stories.server.controller.mjs');
const utils = require('../../../../testutils/server/data.server.testutil');
const Offer = mongoose.model('Offer');
const User = mongoose.model('User');
const Message = mongoose.model('Message');

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
    it('uses the first visible current-team message and returns only welcome metadata', async () => {
      const users = utils.generateUsers(5);
      users[0].acquisitionStory = 'A fictional recommendation.';
      users[0].languages = ['fre', 'eng'];
      users[0].roles = ['user', 'welcome-team'];
      users[1].roles = ['user', 'welcome-team'];
      users[2].roles = ['user', 'welcome-team'];
      users[3].roles = ['user', 'admin'];
      users[4].roles = ['user', 'welcome-team'];
      const saved = await utils.saveUsers(users);
      const recipient = saved[0];
      const firstDate = new Date('2026-01-02T12:00:00Z');
      await Message.create([
        {
          userFrom: saved[3]._id,
          userTo: recipient._id,
          content: 'Admin message.',
          created: new Date('2026-01-01'),
        },
        {
          userFrom: recipient._id,
          userTo: recipient._id,
          content: 'Self message.',
          created: new Date('2026-01-01'),
        },
        {
          userFrom: saved[2]._id,
          userTo: recipient._id,
          content: 'Hidden message.',
          shadowHidden: true,
          created: new Date('2026-01-01'),
        },
        {
          userFrom: recipient._id,
          userTo: saved[2]._id,
          content: 'Outgoing message.',
          created: new Date('2026-01-01'),
        },
        {
          userFrom: saved[1]._id,
          userTo: recipient._id,
          content: 'First welcome.',
          read: false,
          created: firstDate,
        },
        {
          userFrom: saved[2]._id,
          userTo: recipient._id,
          content: 'Later welcome.',
          created: new Date('2026-01-03'),
        },
        {
          userFrom: saved[4]._id,
          userTo: recipient._id,
          content: 'Former team message.',
          created: new Date('2026-01-01'),
        },
      ]);
      await User.updateOne(
        { _id: saved[4]._id },
        { $pull: { roles: 'welcome-team' } },
      );
      const aggregate = sinon.spy(Message, 'aggregate');
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);
      aggregate.firstCall.args[0][0].$match.userFrom.$in.should.deepEqual([
        recipient._id,
        saved[1]._id,
        saved[2]._id,
      ]);
      res.body[0].languages.should.deepEqual(['fre', 'eng']);
      res.body[0].welcomer.should.deepEqual({
        _id: saved[1]._id,
        username: saved[1].username,
        displayName: saved[1].displayName,
        created: firstDate,
      });
      res.body[0].welcomer.should.not.have.property('content');
      // Revoking the first sender's role exposes the next eligible contact.
      await User.updateOne(
        { _id: saved[1]._id },
        { $pull: { roles: 'welcome-team' } },
      );
      await adminAcquisitionStories.list({}, res);
      res.body[0].welcomer._id.should.eql(saved[2]._id);
      await User.updateOne(
        { _id: saved[2]._id },
        { $pull: { roles: 'welcome-team' } },
      );
      await adminAcquisitionStories.list({}, res);
      should(res.body[0].welcomer).equal(null);
    });

    it('breaks equal contact timestamps by message ID and ignores deleted senders', async () => {
      const users = utils.generateUsers(3);
      users[0].acquisitionStory = 'Another fictional recommendation.';
      users[1].roles = users[2].roles = ['user', 'welcome-team'];
      const saved = await utils.saveUsers(users);
      const created = new Date('2026-01-01');
      await Message.create([
        {
          _id: new mongoose.Types.ObjectId('666000000000000000000002'),
          userFrom: saved[2]._id,
          userTo: saved[0]._id,
          content: 'Second tied welcome.',
          created,
        },
        {
          _id: new mongoose.Types.ObjectId('666000000000000000000001'),
          userFrom: saved[1]._id,
          userTo: saved[0]._id,
          content: 'First tied welcome.',
          created,
        },
        {
          userFrom: new mongoose.Types.ObjectId(),
          userTo: saved[0]._id,
          content: 'Deleted sender.',
          created: new Date('2025-01-01'),
        },
      ]);
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);
      res.body[0].welcomer._id.should.eql(saved[1]._id);
    });

    it('yields to I/O while comparing the bounded data sources', async function () {
      this.timeout(30000);
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
      }));
      const find = sinon.stub(User, 'find');
      const storyLimit = sinon.stub().returns({ exec: async () => stories });
      find.onFirstCall().returns({
        sort: () => ({ limit: storyLimit }),
      });
      find.onSecondCall().returns({
        select: () => ({ exec: async () => [] }),
      });
      find.onThirdCall().returns({
        select: () => ({
          sort: () => ({
            limit: () => ({ exec: async () => restrictedUsers }),
          }),
        }),
      });
      sinon.stub(Offer, 'find').returns({
        select: () => ({ sort: () => ({ exec: async () => [] }) }),
      });
      sinon.stub(Message, 'aggregate').returns({ exec: async () => [] });
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
      res.body.should.have.length(500);
      res.body
        .every(story => story.restrictedMatches.length === 0)
        .should.be.true();
    });

    it('keeps the first ten identifier matches in source order', async () => {
      const users = utils.generateUsers(12);
      users[0].username = 'abcdefghijklmn';
      users[0].acquisitionStory = 'An active member story.';
      users.slice(1).forEach((user, index) => {
        user.username = users[0].username.slice(index, index + 4);
        user.roles = ['user', 'shadowban'];
        user.acquisitionStory = `Restricted member story ${index}.`;
      });
      await utils.saveUsers(users);
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);
      const expected = await User.find({ roles: 'shadowban' }).sort({
        created: -1,
        _id: 1,
      });
      const story = res.body.find(user => user.username === users[0].username);
      story.restrictedMatches
        .map(user => user._id.toString())
        .should.deepEqual(
          expected.slice(0, 10).map(user => user._id.toString()),
        );
    });

    it('returns acquisition stories for users who have one', async () => {
      const users = utils.generateUsers(3);
      users[0].acquisitionStory = 'Found via couch surfing';
      users[0].member = [{ tribe: new mongoose.Types.ObjectId() }];
      users[0].locationFrom = 'Fictional origin';
      users[0].locationLiving = 'Fictional home';
      users[0].public = true;
      users[1].acquisitionStory = 'Found through a fictional gathering';
      users[1].public = false;
      users[2].acquisitionStory = '';

      const [visibleUser, hiddenUser] = await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      res.body.length.should.equal(2);
      const visibleStory = res.body.find(
        story => story.username === visibleUser.username,
      );
      const hiddenStory = res.body.find(
        story => story.username === hiddenUser.username,
      );
      visibleStory.acquisitionStory.should.equal('Found via couch surfing');
      visibleStory.circleCount.should.equal(1);
      visibleStory.locationFrom.should.equal('Fictional origin');
      visibleStory.locationLiving.should.equal('Fictional home');
      visibleStory.public.should.equal(true);
      hiddenStory.public.should.equal(false);
      should(visibleStory.hostingLocation).equal(null);
      should(visibleStory.member).be.undefined();
      visibleStory.restrictedMatches.should.deepEqual([]);
      should(visibleStory.email).be.undefined();
      should(visibleStory.emailTemporary).be.undefined();
    });

    it('returns identifier matches but ignores exact and similar stories', async () => {
      const users = utils.generateUsers(6);
      users[0].username = 'identifiercluecopy';
      users[0].email = 'email-clue-copy@example.test';
      users[0].emailTemporary = 'temporary-clue-copy@example.test';
      users[0].acquisitionStory =
        'I heard about Trustroots through a travelling friend.';

      users[1].username = 'exactstoryuser';
      users[1].email = 'exact@example.test';
      users[1].roles = ['user', 'shadowban'];
      users[1].acquisitionStory =
        '  I HEARD about Trustroots through a travelling friend.  ';

      users[2].username = 'fuzzystoryuser';
      users[2].email = 'fuzzy@example.test';
      users[2].roles = ['user', 'suspended'];
      users[2].acquisitionStory =
        'I heard about Trustroots through one travelling friend.';

      users[3].username = 'identifierclue';
      users[3].email = 'unrelated@example.test';
      users[3].roles = ['user', 'shadowban'];
      users[3].acquisitionStory = 'A completely different source.';

      users[4].username = 'emailmatchuser';
      users[4].email = 'email-clue@example.test';
      users[4].roles = ['user', 'suspended'];
      users[4].acquisitionStory = 'Another unrelated source.';

      users[5].username = 'temporarymatchuser';
      users[5].email = 'other@example.test';
      users[5].emailTemporary = 'temporary-clue@example.test';
      users[5].roles = ['user', 'shadowban'];
      users[5].acquisitionStory = 'Yet another unrelated source.';

      await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      const story = res.body.find(
        user => user.username === 'identifiercluecopy',
      );
      story.restrictedMatches.should.have.length(3);
      should(
        story.restrictedMatches.find(
          user => user.username === 'exactstoryuser',
        ),
      ).be.undefined();
      should(
        story.restrictedMatches.find(
          user => user.username === 'fuzzystoryuser',
        ),
      ).be.undefined();
      story.restrictedMatches
        .find(user => user.username === 'identifierclue')
        .matchReasons.should.deepEqual(['Username identifier']);
      story.restrictedMatches
        .find(user => user.username === 'emailmatchuser')
        .matchReasons.should.deepEqual(['Email identifier']);
      story.restrictedMatches
        .find(user => user.username === 'temporarymatchuser')
        .matchReasons.should.deepEqual(['Temporary email identifier']);
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

    it('drops common English words before counting terms', async () => {
      const storyQuery = {
        exec: sinon
          .stub()
          .resolves([{ acquisitionStory: 'I found it through friends' }]),
      };
      storyQuery.sort = sinon.stub().returns(storyQuery);
      storyQuery.limit = sinon.stub().returns(storyQuery);
      sinon.stub(User, 'find').returns(storyQuery);

      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      const categories = res.body.table.map(row => row.category);
      categories.should.containEql('found');
      categories.should.containEql('friend');
      categories.should.not.containEql('through');
    });

    it('corrects one edit but does not treat a transposition as one edit', async () => {
      const stories = [
        'community',
        'comunity',
        'commuunity',
        'commanity',
        'commuinty',
        'coxxunity',
      ].map(acquisitionStory => ({ acquisitionStory }));
      const storyQuery = {
        exec: sinon.stub().resolves(stories),
      };
      storyQuery.sort = sinon.stub().returns(storyQuery);
      storyQuery.limit = sinon.stub().returns(storyQuery);
      sinon.stub(User, 'find').returns(storyQuery);

      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      const counts = Object.fromEntries(
        res.body.table.map(({ category, observed }) => [category, observed]),
      );
      counts.community.should.equal(4);
      counts.commuinty.should.equal(1);
      counts.coxxunity.should.equal(1);
    });

    it('ignores URL tokens that cannot be parsed', async () => {
      sinon.stub(global, 'URL').callsFake(() => {
        throw new TypeError('invalid URL');
      });
      const storyQuery = {
        exec: sinon
          .stub()
          .resolves([{ acquisitionStory: 'https://example.com' }]),
      };
      storyQuery.sort = sinon.stub().returns(storyQuery);
      storyQuery.limit = sinon.stub().returns(storyQuery);
      sinon.stub(User, 'find').returns(storyQuery);

      const res = mockResponse();
      await adminAcquisitionStories.getAnalysis({}, res);

      should.exist(res.body);
      res.body.table.should.be.an.Array();
      res.body.table.should.have.length(0);
    });
  });
});
