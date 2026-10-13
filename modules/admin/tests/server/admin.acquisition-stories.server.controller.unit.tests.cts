/**
 * Unit tests for the admin acquisition stories controller.
 */
const should: typeof import('should') = require('should');
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon = require('sinon');

type AcquisitionController =
  typeof import('../../server/controllers/admin.acquisition-stories.server.controller.mts');
const adminAcquisitionStories: Pick<
  AcquisitionController,
  'list'
> = require('./../../server/controllers/admin.acquisition-stories.server.controller.mts');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
type OfferRecord =
  import('../../../../testutils/server/model-contracts.mts').OfferRecord;
type UserRecord =
  import('../../../../testutils/server/model-contracts.mts').UserRecord;
type MessageRecord =
  import('../../../../testutils/server/model-contracts.mts').MessageRecord;
type StoryFixture =
  import('../../../../testutils/common/data.common.testutil.mts').ServerUserFixture & {
    acquisitionStory?: string;
    emailTemporary?: string;
    locationFrom?: string;
    locationLiving?: string;
    member?: UserRecord['member'];
  };
type RestrictedMatch = {
  _id: import('mongoose').Types.ObjectId;
  displayName?: string;
  matchReasons: string[];
  restrictionStatuses: string[];
  username: string;
};
type Welcomer = {
  _id: import('mongoose').Types.ObjectId;
  username: string;
  displayName?: string;
  created: Date;
};
type AcquisitionStory = {
  _id: import('mongoose').Types.ObjectId | string;
  acquisitionStory: string;
  circleCount: number;
  created?: Date;
  displayName?: string;
  hostingLocation: number[] | null;
  languages: string[];
  locationFrom?: string;
  locationLiving?: string;
  welcomer: Welcomer | null;
  public: boolean;
  restrictionStatuses: string[];
  restrictedMatches: RestrictedMatch[];
  username: string;
};
type MockResponse = { body: unknown; send(body: unknown): MockResponse };
const Offer = mongoose.model<OfferRecord>('Offer');
const User = mongoose.model<UserRecord>('User');
const Message = mongoose.model<MessageRecord>('Message');

function generateStoryUsers(count: number): StoryFixture[] {
  return utils.generateUsers(count).map(user => {
    if (!user || !('password' in user))
      throw new Error('Expected server user fixtures');
    return {
      ...user,
      acquisitionStory: undefined,
      emailTemporary: undefined,
      locationFrom: undefined,
      locationLiving: undefined,
      member: undefined,
    };
  });
}

function storyList(res: MockResponse): AcquisitionStory[] {
  if (!Array.isArray(res.body) || !res.body.every(isAcquisitionStory)) {
    throw new Error('Expected acquisition story results');
  }
  return res.body;
}

function findStory(
  res: MockResponse,
  predicate: (story: AcquisitionStory) => boolean,
): AcquisitionStory {
  const story = storyList(res).find(predicate);
  if (!story) throw new Error('Expected matching acquisition story');
  return story;
}

function findMatch(
  matches: RestrictedMatch[],
  predicate: (match: RestrictedMatch) => boolean,
): RestrictedMatch {
  const match = matches.find(predicate);
  if (!match) throw new Error('Expected matching restricted user');
  return match;
}

function isAcquisitionStory(value: unknown): value is AcquisitionStory {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    (typeof value._id === 'string' ||
      value._id instanceof mongoose.Types.ObjectId) &&
    'acquisitionStory' in value &&
    typeof value.acquisitionStory === 'string' &&
    'circleCount' in value &&
    typeof value.circleCount === 'number' &&
    'created' in value &&
    (value.created === undefined || value.created instanceof Date) &&
    'hostingLocation' in value &&
    (value.hostingLocation === null || Array.isArray(value.hostingLocation)) &&
    'languages' in value &&
    Array.isArray(value.languages) &&
    value.languages.every(language => typeof language === 'string') &&
    'welcomer' in value &&
    (value.welcomer === null || isWelcomer(value.welcomer)) &&
    'public' in value &&
    typeof value.public === 'boolean' &&
    'restrictionStatuses' in value &&
    Array.isArray(value.restrictionStatuses) &&
    'restrictedMatches' in value &&
    Array.isArray(value.restrictedMatches) &&
    value.restrictedMatches.every(isRestrictedMatch) &&
    'username' in value &&
    typeof value.username === 'string'
  );
}

function isWelcomer(value: unknown): value is Welcomer {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    value._id instanceof mongoose.Types.ObjectId &&
    'username' in value &&
    typeof value.username === 'string' &&
    'created' in value &&
    value.created instanceof Date
  );
}

function isRestrictedMatch(value: unknown): value is RestrictedMatch {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    value._id instanceof mongoose.Types.ObjectId &&
    'username' in value &&
    typeof value.username === 'string' &&
    'matchReasons' in value &&
    Array.isArray(value.matchReasons) &&
    value.matchReasons.every(reason => typeof reason === 'string') &&
    'restrictionStatuses' in value &&
    Array.isArray(value.restrictionStatuses) &&
    value.restrictionStatuses.every(status => typeof status === 'string')
  );
}

function mockResponse(): MockResponse {
  const res: MockResponse = {
    body: null,
    send(body) {
      res.body = body;
      return res;
    },
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
      const users = generateStoryUsers(5);
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
      storyList(res)[0].languages.should.deepEqual(['fre', 'eng']);
      should(storyList(res)[0].welcomer).deepEqual({
        _id: saved[1]._id,
        username: saved[1].username,
        displayName: saved[1].displayName,
        created: firstDate,
      });
      should(storyList(res)[0].welcomer).not.have.property('content');
      // Revoking the first sender's role exposes the next eligible contact.
      await User.updateOne(
        { _id: saved[1]._id },
        { $pull: { roles: 'welcome-team' } },
      );
      await adminAcquisitionStories.list({}, res);
      should(storyList(res)[0].welcomer?._id).eql(saved[2]._id);
      await User.updateOne(
        { _id: saved[2]._id },
        { $pull: { roles: 'welcome-team' } },
      );
      await adminAcquisitionStories.list({}, res);
      should(storyList(res)[0].welcomer).equal(null);
    });

    it('breaks equal contact timestamps by message ID and ignores deleted senders', async () => {
      const users = generateStoryUsers(3);
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
      should(storyList(res)[0].welcomer?._id).eql(saved[1]._id);
    });

    it('yields to I/O while comparing the bounded data sources', async function () {
      this.timeout(30000);
      const stories = Array.from({ length: 500 }, (_, index) => ({
        _id: `visitor-${index}`,
        roles: ['user'],
        username: `visitor${index}`,
        email: `visitor${index}@example.test`,
        emailTemporary: '',
        member: [],
        acquisitionStory: 'An unrelated fictional source with different words.',
      }));
      const restrictedUsers = Array.from({ length: 1000 }, (_, index) => ({
        _id: `restricted-${index}`,
        roles: ['user', 'suspended'],
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
      storyList(res).should.have.length(500);
      storyList(res)
        .every(story => story.restrictedMatches.length === 0)
        .should.be.true();
    });

    it('keeps the first ten identifier matches in source order', async () => {
      const users = generateStoryUsers(12);
      users[0].username = 'abcdefghijklmn';
      users[0].acquisitionStory = 'An active member story.';
      users.slice(1).forEach((user, index) => {
        user.username = users[0].username.slice(index, index + 4);
        user.roles = ['user', 'shadowban'];
        user.acquisitionStory = `Restricted member story ${index}.`;
      });
      users.forEach(user => {
        user.password = 'AcquisitionStoriesTestPassword123!';
      });
      await utils.saveUsersWithSharedPassword(users);
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);
      const expected = await User.find({ roles: 'shadowban' }).sort({
        created: -1,
        _id: 1,
      });
      const story = findStory(res, user => user.username === users[0].username);
      story.restrictedMatches
        .map(user => user._id.toString())
        .should.deepEqual(
          expected.slice(0, 10).map(user => user._id.toString()),
        );
    });

    it('returns acquisition stories for users who have one', async () => {
      const users = generateStoryUsers(3);
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

      storyList(res).length.should.equal(2);
      const visibleStory = findStory(
        res,
        story => story.username === visibleUser.username,
      );
      const hiddenStory = findStory(
        res,
        story => story.username === hiddenUser.username,
      );
      should(visibleStory.acquisitionStory).equal('Found via couch surfing');
      visibleStory.circleCount.should.equal(1);
      should(visibleStory.locationFrom).equal('Fictional origin');
      should(visibleStory.locationLiving).equal('Fictional home');
      visibleStory.public.should.equal(true);
      hiddenStory.public.should.equal(false);
      should(visibleStory.hostingLocation).equal(null);
      should(visibleStory).not.have.property('member');
      visibleStory.restrictedMatches.should.deepEqual([]);
      should(visibleStory).not.have.property('email');
      should(visibleStory).not.have.property('emailTemporary');
    });

    it('returns identifier matches but ignores exact and similar stories', async () => {
      const users = generateStoryUsers(6);
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
      users[5].roles = ['user', 'shadowban', 'suspended', 'volunteer'];
      users[5].acquisitionStory = 'Yet another unrelated source.';

      await utils.saveUsers(users);

      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      const story = findStory(
        res,
        user => user.username === 'identifiercluecopy',
      );
      story.restrictedMatches.should.have.length(3);
      story.restrictionStatuses.should.deepEqual([]);
      findStory(
        res,
        user => user.username === 'identifierclue',
      ).restrictionStatuses.should.deepEqual(['shadowban']);
      findStory(
        res,
        user => user.username === 'emailmatchuser',
      ).restrictionStatuses.should.deepEqual(['suspended']);
      findStory(
        res,
        user => user.username === 'temporarymatchuser',
      ).restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
      findMatch(
        story.restrictedMatches,
        user => user.username === 'temporarymatchuser',
      ).restrictionStatuses.should.deepEqual(['suspended', 'shadowban']);
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
      findMatch(
        story.restrictedMatches,
        user => user.username === 'identifierclue',
      ).matchReasons.should.deepEqual(['Username identifier']);
      findMatch(
        story.restrictedMatches,
        user => user.username === 'emailmatchuser',
      ).matchReasons.should.deepEqual(['Email identifier']);
      findMatch(
        story.restrictedMatches,
        user => user.username === 'temporarymatchuser',
      ).matchReasons.should.deepEqual(['Temporary email identifier']);
      story.restrictedMatches.forEach(match => {
        should(match).not.have.property('email');
        should(match).not.have.property('roles');
        ['shadowban', 'suspended']
          .some(role => match.restrictionStatuses.includes(role))
          .should.equal(true);
      });
    });

    it('returns the latest hosting location with acquisition stories', async () => {
      const users = generateStoryUsers(1);
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

      should(storyList(res)[0].hostingLocation).deepEqual([10.1, 20.1]);
    });

    it('falls back to a precise hosting location when no fuzzy value exists', async () => {
      const users = generateStoryUsers(1);
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

      should(storyList(res)[0].hostingLocation).deepEqual([30, 40]);
    });

    it('handles a missing hosting-offer result', async () => {
      const users = generateStoryUsers(1);
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

      should(storyList(res)[0].hostingLocation).equal(null);
    });

    it('returns an empty array when no stories exist', async () => {
      const res = mockResponse();
      await adminAcquisitionStories.list({}, res);

      should(storyList(res)).eql([]);
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

      should(storyList(res)).eql([]);
    });
  });
});
