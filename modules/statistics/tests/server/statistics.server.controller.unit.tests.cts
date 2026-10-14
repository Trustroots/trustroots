import type {
  ExperienceModel,
  MessageStatModel,
  OfferModel,
  ReferenceThreadModel,
  UserRecord,
} from '../../../../testutils/server/model-contracts.mts';

type Callback<T> = (error: Error | null, result?: T) => void;
type CountResult = {
  total: number;
  recommended: number;
  notRecommended: number;
  recent: { total: number; recommended: number; notRecommended: number };
  realLifeConnections: { total: number; recent: number };
};
type InteractionResult = {
  total: number;
  positive: number;
  negative: number;
  recent: { total: number; positive: number; negative: number };
};
type HostingResult = { yes: number; maybe: number; no: number };
type LanguageResult = Array<{ _id: string; count: number }>;
type MobileStats = {
  namespace: 'mobileAppInit';
  counts: { count: number };
  tags: { version: string; deviceYearClass: string };
  meta: { os: string; expoVersion: string };
};
interface StatsService {
  stat(stats: MobileStats, callback: (error?: Error) => void): void;
}
interface StatisticsBody {
  message: string;
  total: number;
  connections: Array<{ network: string; count: number; percentage: number }>;
  hosting: { total: number; yes: number; maybe: number };
  newsletter: { count: number; percentage: number };
  experiences: CountResult;
  messageInteractions: InteractionResult;
}
interface DeferredResponse {
  body: StatisticsBody;
  headers: Record<string, string>;
  sendCount: number;
  statusCode: number;
  status(code: number): DeferredResponse;
  send(body: object): DeferredResponse;
  json(body: object): DeferredResponse;
  header(name: string, value: string): DeferredResponse;
  waitForResponse(): Promise<DeferredResponse>;
}
interface StatisticsController {
  clearPublicStatisticsCache(): void;
  getUsersCount(callback: Callback<number>): void;
  getNewsletterSubscriptionsCount(callback: Callback<number>): void;
  getLastSeenStatistic(
    input: { days: number },
    callback: Callback<number>,
  ): void;
  getExternalSiteCount(site: string, callback: Callback<number>): void;
  getMeetOffersCount(callback: Callback<number>): void;
  getHostOffersCount(callback: Callback<HostingResult>): void;
  getUserLanguagesCount(
    limit: number,
    callback: Callback<LanguageResult>,
  ): void;
  getExperienceStatistics(since: Date, callback: Callback<CountResult>): void;
  getMessageInteractionStatistics(
    since: Date,
    callback: Callback<InteractionResult>,
  ): void;
  getPublicStatistics(request: object, response: DeferredResponse): void;
  collectStatistics(
    request: { body?: object },
    response: DeferredResponse,
  ): void;
}

function required<T>(value: T | null | undefined): NonNullable<T> {
  if (value === null || value === undefined)
    throw new Error('Expected saved fixture');
  return value as NonNullable<T>;
}

/**
 * Unit tests for statistics controller helpers and write endpoints.
 */
const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');

function typedStub<TArgs extends readonly unknown[]>(
  target: object,
  method: string,
): import('sinon').SinonStub<TArgs, unknown> {
  const methods = target as Record<string, (...args: TArgs) => unknown>;
  return sinon.stub(methods, method) as unknown as import('sinon').SinonStub<
    TArgs,
    unknown
  >;
}

require('./../../../offers/server/models/offer.server.model.mjs');
require('./../../../users/server/models/user.server.model.mjs');
require('./../../../experiences/server/models/experiences.server.model.mjs');
require('./../../../messages/server/models/message-stat.server.model.mjs');
require('./../../../references-thread/server/models/reference-thread.server.model.mjs');
const statistics =
  require('./../../server/controllers/statistics.server.controller.mjs') as StatisticsController;
const parseStatisticsCount: typeof import('../../server/controllers/parse-statistics-count.mts').default =
  require('../../server/controllers/parse-statistics-count.mts').default;
const statService =
  require('./../../../stats/server/services/stats.server.service.mts') as StatsService;
const utils = require('../../../../testutils/server/data.server.testutil');
require('should');

type StatisticsUser = Omit<UserRecord, 'additionalProvidersData'> & {
  additionalProvidersData?: Record<
    string,
    { id?: string; login?: string; screen_name?: string }
  >;
};
type StatisticsUserModel = import('mongoose').Model<StatisticsUser>;
const User = mongoose.model('User') as unknown as StatisticsUserModel;
const Offer = mongoose.model('Offer') as unknown as OfferModel;
const Experience = mongoose.model('Experience') as unknown as ExperienceModel;
const MessageStat = mongoose.model(
  'MessageStat',
) as unknown as MessageStatModel;
const ReferenceThread = mongoose.model(
  'ReferenceThread',
) as unknown as ReferenceThreadModel;

function deferredResponse(): DeferredResponse {
  let resolveResponse!: (response: DeferredResponse) => void;
  const promise = new Promise<DeferredResponse>(resolve => {
    resolveResponse = resolve;
  });
  const res: DeferredResponse = {
    body: {
      message: '',
      total: 0,
      connections: [],
      hosting: { total: 0, yes: 0, maybe: 0 },
      newsletter: { count: 0, percentage: 0 },
      experiences: {
        total: 0,
        recommended: 0,
        notRecommended: 0,
        recent: { total: 0, recommended: 0, notRecommended: 0 },
        realLifeConnections: { total: 0, recent: 0 },
      },
      messageInteractions: {
        total: 0,
        positive: 0,
        negative: 0,
        recent: { total: 0, positive: 0, negative: 0 },
      },
    },
    headers: {},
    sendCount: 0,
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.sendCount += 1;
      this.body = body as StatisticsBody;
      resolveResponse(this);
      return this;
    },
    json(body) {
      this.sendCount += 1;
      this.body = body as StatisticsBody;
      resolveResponse(this);
      return this;
    },
    header(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    waitForResponse() {
      return promise;
    },
  };
  return res;
}

describe('Statistics controller unit tests', () => {
  afterEach(() => {
    sinon.restore();
    statistics.clearPublicStatisticsCache();
    if (mongoose.connection.readyState !== 1) {
      return undefined;
    }
    return utils.clearDatabase();
  });

  describe('parseStatisticsCount', () => {
    it('preserves decimal-prefix parsing, truncation, negatives, and zero fallback', () => {
      parseStatisticsCount('12.8tail').should.equal(12);
      parseStatisticsCount(-4.8).should.equal(-4);
      parseStatisticsCount('invalid').should.equal(0);
      parseStatisticsCount(null).should.equal(0);
      parseStatisticsCount(undefined).should.equal(0);
    });
  });

  describe('count helper error callbacks', () => {
    const dbError = new Error('db unavailable');

    it('getUsersCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, count: number) => void]>(
        User,
        'countDocuments',
      ).callsFake((query, cb) => cb(dbError, 0));
      statistics.getUsersCount(err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getNewsletterSubscriptionsCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, count: number) => void]>(
        User,
        'countDocuments',
      ).callsFake((query, cb) => cb(dbError, 0));
      statistics.getNewsletterSubscriptionsCount(err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getLastSeenStatistic propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, count: number) => void]>(
        User,
        'countDocuments',
      ).callsFake((query, cb) => cb(dbError, 0));
      statistics.getLastSeenStatistic({ days: 7 }, err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getExternalSiteCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, count: number) => void]>(
        User,
        'countDocuments',
      ).callsFake((query, cb) => cb(dbError, 0));
      statistics.getExternalSiteCount('github', err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getMeetOffersCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, count: number) => void]>(
        Offer,
        'countDocuments',
      ).callsFake((query, cb) => cb(dbError, 0));
      statistics.getMeetOffersCount(err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getHostOffersCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, rows: unknown[]) => void]>(
        Offer,
        'aggregate',
      ).callsFake((pipeline, cb) => cb(dbError, []));
      statistics.getHostOffersCount(err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getUserLanguagesCount propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, rows: unknown[]) => void]>(
        User,
        'aggregate',
      ).callsFake((pipeline, cb) => cb(dbError, []));
      statistics.getUserLanguagesCount(5, err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getExperienceStatistics propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, rows: unknown[]) => void]>(
        Experience,
        'aggregate',
      ).callsFake((pipeline, cb) => {
        cb(dbError, []);
        return undefined;
      });
      statistics.getExperienceStatistics(new Date(), err => {
        err!.should.be.Error();
        done();
      });
    });

    it('getMessageInteractionStatistics propagates database errors', done => {
      typedStub<[unknown, (error: Error | null, rows: unknown[]) => void]>(
        MessageStat,
        'aggregate',
      ).callsFake((pipeline, cb) => {
        cb(dbError, []);
        return undefined;
      });
      statistics.getMessageInteractionStatistics(new Date(), err => {
        err!.should.be.Error();
        done();
      });
    });
  });

  describe('getMessageInteractionStatistics', () => {
    it('counts only replied threads and the latest eligible feedback', async () => {
      const users = await utils.saveUsers(utils.generateUsers(4));
      const oldDate = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
      const recentDate = new Date();
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

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

      const result = await new Promise<InteractionResult>((resolve, reject) => {
        statistics.getMessageInteractionStatistics(since, (err, counts) => {
          if (err) return reject(err);
          resolve(counts!);
        });
      });

      result.should.deepEqual({
        total: 2,
        positive: 2,
        negative: 1,
        recent: { total: 1, positive: 1, negative: 1 },
      });
    });

    it('returns zeroed counts when there are no message interactions', done => {
      statistics.getMessageInteractionStatistics(new Date(), (err, counts) => {
        if (err) return done(err);
        counts!.should.deepEqual({
          total: 0,
          positive: 0,
          negative: 0,
          recent: { total: 0, positive: 0, negative: 0 },
        });
        done();
      });
    });
  });

  describe('getExternalSiteCount', () => {
    it('errors for an invalid site id', done => {
      statistics.getExternalSiteCount('invalid', err => {
        err!.should.be.Error();
        err!.message.should.equal('Missing external site id.');
        done();
      });
    });

    it('counts users connected to github', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = required(
        (await User.findById(saved._id)) as
          import('mongoose').HydratedDocument<StatisticsUser> | null,
      );
      userDoc.public = true;
      userDoc.additionalProvidersData = { github: { id: '123' } };
      await userDoc.save();

      await new Promise<void>((resolve, reject) => {
        statistics.getExternalSiteCount('github', (err, count) => {
          if (err) return reject(err);
          count!.should.equal(1);
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
        const userDoc = required(
          (await User.findById(saved._id)) as
            import('mongoose').HydratedDocument<StatisticsUser> | null,
        );
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

        await new Promise<void>((resolve, reject) => {
          statistics.getExternalSiteCount(site, (err, count) => {
            if (err) return reject(err);
            count!.should.equal(1);
            resolve();
          });
        });
      });
    });
  });

  describe('count helpers', () => {
    it('counts public users', async () => {
      await utils.saveUsers(utils.generateUsers(2, { public: true }));
      await new Promise<void>((resolve, reject) => {
        statistics.getUsersCount((err, count) => {
          if (err) return reject(err);
          count!.should.be.aboveOrEqual(2);
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

      await new Promise<void>((resolve, reject) => {
        statistics.getMeetOffersCount((err, count) => {
          if (err) return reject(err);
          count!.should.equal(1);
          resolve();
        });
      });
    });

    it('counts users seen recently', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = required(
        (await User.findById(saved._id)) as
          import('mongoose').HydratedDocument<StatisticsUser> | null,
      );
      userDoc.seen = new Date();
      await userDoc.save();

      await new Promise<void>((resolve, reject) => {
        statistics.getLastSeenStatistic({ days: 7 }, (err, count) => {
          if (err) return reject(err);
          count!.should.be.aboveOrEqual(1);
          resolve();
        });
      });
    });

    it('counts newsletter subscribers', async () => {
      await utils.saveUsers(
        utils.generateUsers(2, { public: true, newsletter: true }),
      );

      await new Promise<void>((resolve, reject) => {
        statistics.getNewsletterSubscriptionsCount((err, count) => {
          if (err) return reject(err);
          count!.should.be.aboveOrEqual(2);
          resolve();
        });
      });
    });

    it('returns top spoken languages', async () => {
      const [saved] = await utils.saveUsers(utils.generateUsers(1));
      const userDoc = required(
        (await User.findById(saved._id)) as
          import('mongoose').HydratedDocument<StatisticsUser> | null,
      );
      userDoc.languages = ['eng', 'fin'];
      await userDoc.save();

      await new Promise<void>((resolve, reject) => {
        statistics.getUserLanguagesCount(5, (err, counts) => {
          if (err) return reject(err);
          counts!.length.should.be.aboveOrEqual(1);
          resolve();
        });
      });
    });

    it('counts only positive experiences as real-life connections', async () => {
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

      const experienceStatistics = await new Promise<CountResult>(
        (resolve, reject) => {
          statistics.getExperienceStatistics(since, (err, result) => {
            if (err) return reject(err);
            resolve(result!);
          });
        },
      );

      experienceStatistics.should.deepEqual({
        total: 5,
        recommended: 2,
        notRecommended: 2,
        recent: { total: 4, recommended: 2, notRecommended: 1 },
        realLifeConnections: { total: 2, recent: 2 },
      });
    });
  });

  describe('getHostOffersCount', () => {
    it('returns zeroed counters when there are no host offers', done => {
      statistics.getHostOffersCount((err, counters) => {
        if (err) return done(err);
        counters!.should.deepEqual({ yes: 0, maybe: 0, no: 0 });
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

      await new Promise<void>((resolve, reject) => {
        statistics.getHostOffersCount((err, counters) => {
          if (err) return reject(err);
          counters!.yes.should.equal(1);
          counters!.maybe.should.equal(1);
          resolve();
        });
      });
    });

    it('ignores unknown statuses and defaults invalid counts to zero', done => {
      typedStub<
        [
          unknown,
          (
            error: Error | null,
            rows: Array<{ _id: string; count: string }>,
          ) => void,
        ]
      >(Offer, 'aggregate').callsFake((pipeline, cb) => {
        cb(null, [
          { _id: 'yes', count: '2' },
          { _id: 'maybe', count: 'not-a-number' },
          { _id: 'other', count: '9' },
        ]);
        return undefined;
      });

      statistics.getHostOffersCount((err, counters) => {
        if (err) return done(err);
        counters!.should.deepEqual({ yes: 2, maybe: 0, no: 0 });
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
      res.body.should.have.property('messageInteractions');
      res.headers['cache-control'].should.equal('public, max-age=3600');
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

    it('returns 400 when message interaction statistics fail', async () => {
      sinon
        .stub(statistics, 'getMessageInteractionStatistics')
        .callsFake((since, cb) => {
          cb(new Error('message interaction statistics failed'));
        });

      const res = deferredResponse();
      statistics.getPublicStatistics({}, res);
      await res.waitForResponse();
      res.statusCode.should.equal(400);
      res.headers['cache-control'].should.equal('no-store');
    });

    it('reuses a successful response for one hour', async () => {
      const firstResponse = deferredResponse();
      statistics.getPublicStatistics({}, firstResponse);
      await firstResponse.waitForResponse();

      const getUsersCount = sinon.spy(statistics, 'getUsersCount');
      const cachedResponse = deferredResponse();
      statistics.getPublicStatistics({}, cachedResponse);
      await cachedResponse.waitForResponse();

      getUsersCount.called.should.be.false();
      cachedResponse.body.should.deepEqual(firstResponse.body);
      cachedResponse.headers['cache-control'].should.equal(
        'public, max-age=3600',
      );
    });

    it('refreshes an expired cached response', async () => {
      const firstResponse = deferredResponse();
      statistics.getPublicStatistics({}, firstResponse);
      await firstResponse.waitForResponse();

      const afterCacheExpiry = Date.now() + 60 * 60 * 1000 + 1;
      sinon.stub(Date, 'now').returns(afterCacheExpiry);
      const getUsersCount = sinon.spy(statistics, 'getUsersCount');
      const refreshedResponse = deferredResponse();
      statistics.getPublicStatistics({}, refreshedResponse);
      await refreshedResponse.waitForResponse();

      getUsersCount.calledOnce.should.be.true();
      refreshedResponse.statusCode.should.equal(200);
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
