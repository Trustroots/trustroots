/**
 * Module dependencies.
 */
import _ from 'lodash';
import moment from 'moment';
import errorService from './../../../core/server/services/error.server.service.mjs';
import statService from './../../../stats/server/services/stats.server.service.mts';
import async from 'async';
import semver from 'semver';
import mongoose, { type Types } from 'mongoose';
import parseStatisticsCount from './parse-statistics-count.mts';
import type { StatObject } from '../../../stats/server/services/stats.server.service.mts';

type Callback<Result> = (error: unknown, result?: Result) => void;
type OfferStatus = 'yes' | 'maybe' | 'no';
type HostingCounts = { yes: number; maybe: number; no: number };
type LanguageCount = { _id: string; count: number };
type ExperienceCounts = {
  total: number;
  recommended: number;
  notRecommended: number;
  recent: { total: number; recommended: number; notRecommended: number };
  realLifeConnections: { total: number; recent: number };
};
type InteractionCounts = {
  total: number;
  positive: number;
  negative: number;
  recent: { total: number; positive: number; negative: number };
};
type PublicStatistics = {
  total: number;
  connections: Array<{ network: string; count: number; percentage: number }>;
  hosting: {
    total: number;
    percentage: number;
    yes: number;
    yesPercentage: number;
    maybe: number;
    maybePercentage: number;
  };
  newsletter: { count: number; percentage: number };
  experiences: ExperienceCounts;
  messageInteractions: InteractionCounts;
};
type StatisticsAccumulator = {
  total?: number;
  connections: PublicStatistics['connections'];
  hosting: Partial<PublicStatistics['hosting']>;
  newsletter?: PublicStatistics['newsletter'];
  experiences: Partial<ExperienceCounts>;
  messageInteractions: Partial<InteractionCounts>;
};

interface UserRecord {
  _id: Types.ObjectId;
  public?: boolean;
  newsletter?: boolean;
  seen?: Date;
  languages?: string[];
  extSitesCouchers?: string;
  extSitesBW?: string;
  extSitesCS?: string;
  extSitesWS?: string;
  additionalProvidersData?: Record<string, unknown>;
  nostrNpub?: string;
}
interface OfferRecord {
  type?: 'host' | 'meet';
  status?: 'yes' | 'maybe' | 'no';
  validUntil?: Date;
}
interface ExperienceRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  created?: Date;
  recommend?: string;
  removedAt?: Date;
  interactions?: { met?: boolean };
}
interface MessageStatRecord {
  firstMessageUserFrom?: Types.ObjectId;
  firstMessageUserTo?: Types.ObjectId;
  firstReplyCreated?: Date | null;
}
interface ReferenceThreadRecord {
  userFrom: Types.ObjectId;
  userTo: Types.ObjectId;
  reference: 'yes' | 'no';
  created?: Date;
}
interface ExperienceAggregate {
  total?: number;
  recommended?: number;
  notRecommended?: number;
  recentTotal?: number;
  recentRecommended?: number;
  recentNotRecommended?: number;
}
interface ConnectionAggregate {
  total?: number;
  recent?: number;
}
interface ThreadAggregate {
  total?: number;
  recentTotal?: number;
}
interface FeedbackAggregate {
  positive?: number;
  negative?: number;
  recentPositive?: number;
  recentNegative?: number;
}
interface JsonResponse<Body> {
  header(name: string, value: string): this;
  status(code: number): this;
  send(body: { message: string }): this;
  json(body: Body): this;
}
interface StatisticsRequest {
  statistics?: StatisticsAccumulator;
}
interface CollectionRequest {
  body?: unknown;
}
interface StatisticsControllerService {
  clearPublicStatisticsCache(): void;
  getUsersCount(callback: Callback<number>): void;
  getExternalSiteCount(site: string, callback: Callback<number>): void;
  getMeetOffersCount(callback: Callback<number>): void;
  getHostOffersCount(callback: Callback<HostingCounts>): void;
  getNewsletterSubscriptionsCount(callback: Callback<number>): void;
  getLastSeenStatistic(
    since: moment.DurationInputArg1,
    callback: Callback<number>,
  ): void;
  getUserLanguagesCount(
    limit: number,
    callback: Callback<LanguageCount[]>,
  ): void;
  getExperienceStatistics(
    since: Date,
    callback: Callback<ExperienceCounts>,
  ): void;
  getMessageInteractionStatistics(
    since: Date,
    callback: Callback<InteractionCounts>,
  ): void;
  getPublicStatistics(
    req: StatisticsRequest,
    res: JsonResponse<PublicStatistics>,
  ): void;
  collectStatistics(
    req: CollectionRequest,
    res: JsonResponse<{ message: string }>,
  ): void;
}

// Match the legacy service object identity, populated before module consumers
// can invoke these handlers.
const statisticsService = {} as StatisticsControllerService;
const Offer = mongoose.model<OfferRecord>('Offer');
const User = mongoose.model<UserRecord>('User');
const Experience = mongoose.model<ExperienceRecord>('Experience');
const MessageStat = mongoose.model<MessageStatRecord>('MessageStat');
const ReferenceThread =
  mongoose.model<ReferenceThreadRecord>('ReferenceThread');
const PUBLIC_STATISTICS_CACHE_SECONDS = 60 * 60;
let publicStatisticsCache:
  { expiresAt: number; statistics: PublicStatistics } | undefined;

type WaterfallDone = (error?: unknown, ...results: unknown[]) => void;
function connectionPercentage(
  count: number,
  total: number | undefined,
): number {
  return total ? Math.round((count / total) * 1000) / 10 : 0;
}

function isOfferStatus(value: string): value is OfferStatus {
  return ['yes', 'maybe', 'no'].indexOf(value) !== -1;
}

function errorMessage(error: Error): string {
  // The JavaScript error service always returns its default string when a
  // validation error does not carry a message; its inferred JS type is wider.
  return errorService.getErrorMessage(error) as string;
}
export const clearPublicStatisticsCache = function (): void {
  publicStatisticsCache = undefined;
};

/**
 * Get count of all public users
 */
export const getUsersCount = function (callback: Callback<number>): void {
  User.countDocuments({
    public: true,
  }).then(
    (count: number) => callback(null, parseStatisticsCount(count)),
    callback,
  );
};

/**
 * Get count of all public users
 */
export const getExternalSiteCount = function (
  site: string,
  callback: Callback<number>,
): void {
  const validSites = [
    'bewelcome',
    'couchers',
    'couchsurfing',
    'warmshowers',
    'facebook',
    'twitter',
    'github',
    'nostr',
  ];

  // Validate site
  if (!site || validSites.indexOf(site) === -1) {
    return callback(new Error('Missing external site id.'));
  }

  // Build the query
  const query: Record<string, unknown> = {
    public: true,
  };
  switch (site) {
    case 'couchers':
      query.extSitesCouchers = {
        $exists: true,
        $ne: '',
      };
      break;
    case 'bewelcome':
      query.extSitesBW = {
        $exists: true,
        $ne: '',
      };
      break;
    case 'couchsurfing':
      query.extSitesCS = {
        $exists: true,
        $ne: '',
      };
      break;
    case 'warmshowers':
      query.extSitesWS = {
        $exists: true,
        $ne: '',
      };
      break;
    case 'facebook':
      query['additionalProvidersData.facebook'] = {
        $exists: true,
      };
      break;
    case 'twitter':
      query['additionalProvidersData.twitter'] = {
        $exists: true,
      };
      break;
    case 'github':
      query['additionalProvidersData.github'] = {
        $exists: true,
      };
      break;
    case 'nostr':
      query.nostrNpub = {
        $exists: true,
        $ne: '',
      };
      break;
  }
  User.countDocuments(query).then(
    (count: number) => callback(null, parseStatisticsCount(count)),
    callback,
  );
};

/**
 * Get count of all public users
 */
export const getMeetOffersCount = function (callback: Callback<number>): void {
  Offer.countDocuments({
    type: 'meet',
    $or: [
      {
        validUntil: {
          $gte: new Date(),
        },
      },
      {
        validUntil: {
          $exists: false,
        },
      },
    ],
  }).then(
    (count: number) => callback(null, parseStatisticsCount(count)),
    callback,
  );
};

/**
 * Get count of hosting offers
 * Callback will be called with Object `{ yes: Int, maybe: Int, no: Int }`
 */
export const getHostOffersCount = function (
  callback: Callback<HostingCounts>,
): void {
  Offer.aggregate<{ _id: string; count: number }>([
    {
      $match: {
        type: 'host',
      },
    },
    {
      $group: {
        _id: '$status',
        count: {
          $sum: 1,
        },
      },
    },
  ]).then(counters => {
    // the returned counters is expected to be an array of a form
    //
    // [
    //   {
    //     _id: 'yes',
    //     count: number // amount of 'yes' offers
    //   },
    //   {
    //     _id: 'maybe',
    //     count: number // amount of 'maybe' offers
    //   },
    //   {
    //     _id: 'no',
    //     count: number // amount of 'no' offers
    //   }
    // ]
    const values: HostingCounts = {
      yes: 0,
      maybe: 0,
      no: 0,
    };
    if (counters && counters.length > 0) {
      counters.forEach(function (counter) {
        if (isOfferStatus(counter._id)) {
          values[counter._id] = parseStatisticsCount(counter.count);
        }
      });
    }
    callback(null, values);
  }, callback);
};

/**
 * Get count of newsletter subscriptions
 */
export const getNewsletterSubscriptionsCount = function (
  callback: Callback<number>,
): void {
  User.countDocuments({
    newsletter: true,
    public: true,
  }).then(
    (count: number) => callback(null, parseStatisticsCount(count)),
    callback,
  );
};

// Future push: restore getPushRegistrationCount here if product metrics
// need historical pushRegistration totals again.

/**
 * Generate statistics based on the user last seen attribute
 */
export const getLastSeenStatistic = function (
  since: moment.DurationInputArg1,
  callback: Callback<number>,
): void {
  const query = {
    seen: {
      $gte: moment().subtract(since).toDate(),
    },
  };
  User.countDocuments(query).then(
    (count: number) => callback(null, parseStatisticsCount(count)),
    callback,
  );
};

/**
 * Get count of languages users speak
 *
 * @param limit {int} Limit returned number of languages
 * @param callback {function}
 */
export const getUserLanguagesCount = function (
  limit: number,
  callback: Callback<LanguageCount[]>,
): void {
  User.aggregate<LanguageCount>([
    {
      $unwind: '$languages',
    },
    {
      $group: {
        _id: '$languages',
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
    {
      $limit: limit,
    },
  ]).then(rows => callback(null, rows), callback);
};

/**
 * Get aggregate statistics for public experiences.
 *
 * @param {Date} since Beginning of the recent-statistics period
 * @param {Function} callback Callback receiving aggregate statistics
 */
export const getExperienceStatistics = function (
  since: Date,
  callback: Callback<ExperienceCounts>,
): void {
  async.parallel<{
    experiences: ExperienceAggregate[];
    realLifeConnections: ConnectionAggregate[];
  }>(
    {
      experiences: done => {
        Experience.aggregate<ExperienceAggregate>([
          { $match: { removedAt: { $exists: false } } },
          {
            $group: {
              _id: null,
              total: {
                $sum: 1,
              },
              recommended: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$recommend', 'yes'],
                    },
                    1,
                    0,
                  ],
                },
              },
              notRecommended: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$recommend', 'no'],
                    },
                    1,
                    0,
                  ],
                },
              },
              recentTotal: {
                $sum: {
                  $cond: [
                    {
                      $gte: ['$created', since],
                    },
                    1,
                    0,
                  ],
                },
              },
              recentRecommended: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $gte: ['$created', since],
                        },
                        {
                          $eq: ['$recommend', 'yes'],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              recentNotRecommended: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $gte: ['$created', since],
                        },
                        {
                          $eq: ['$recommend', 'no'],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]).then(rows => done(null, rows), done);
      },
      realLifeConnections: done => {
        Experience.aggregate<ConnectionAggregate>([
          {
            $match: {
              recommend: 'yes',
              'interactions.met': true,
              removedAt: { $exists: false },
            },
          },
          {
            $project: {
              created: 1,
              memberOne: {
                $cond: [
                  {
                    $lt: ['$userFrom', '$userTo'],
                  },
                  '$userFrom',
                  '$userTo',
                ],
              },
              memberTwo: {
                $cond: [
                  {
                    $lt: ['$userFrom', '$userTo'],
                  },
                  '$userTo',
                  '$userFrom',
                ],
              },
            },
          },
          {
            $group: {
              _id: {
                memberOne: '$memberOne',
                memberTwo: '$memberTwo',
              },
              latestCreated: {
                $max: '$created',
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: 1,
              },
              recent: {
                $sum: {
                  $cond: [
                    {
                      $gte: ['$latestCreated', since],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]).then(rows => done(null, rows), done);
      },
    },
    (err, results) => {
      if (err) {
        return callback(err);
      }
      const experienceCounts = results.experiences[0] || {};
      const connectionCounts = results.realLifeConnections[0] || {};
      return callback(null, {
        total: parseStatisticsCount(experienceCounts.total),
        recommended: parseStatisticsCount(experienceCounts.recommended),
        notRecommended: parseStatisticsCount(experienceCounts.notRecommended),
        recent: {
          total: parseStatisticsCount(experienceCounts.recentTotal),
          recommended: parseStatisticsCount(experienceCounts.recentRecommended),
          notRecommended: parseStatisticsCount(
            experienceCounts.recentNotRecommended,
          ),
        },
        realLifeConnections: {
          total: parseStatisticsCount(connectionCounts.total),
          recent: parseStatisticsCount(connectionCounts.recent),
        },
      });
    },
  );
};

/**
 * Get aggregate statistics for message conversations that received a reply.
 *
 * @param {Date} since Beginning of the recent-statistics period
 * @param {Function} callback Callback receiving aggregate statistics
 */
export const getMessageInteractionStatistics = function (
  since: Date,
  callback: Callback<InteractionCounts>,
): void {
  async.parallel<{
    repliedThreads: ThreadAggregate[];
    feedback: FeedbackAggregate[];
  }>(
    {
      repliedThreads: done => {
        MessageStat.aggregate<ThreadAggregate>([
          {
            $match: {
              firstReplyCreated: {
                $exists: true,
                $ne: null,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: 1,
              },
              recentTotal: {
                $sum: {
                  $cond: [
                    {
                      $gte: ['$firstReplyCreated', since],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]).then(rows => done(null, rows), done);
      },
      feedback: done => {
        ReferenceThread.aggregate<FeedbackAggregate>([
          {
            $sort: {
              created: -1,
              _id: -1,
            },
          },
          {
            $group: {
              _id: {
                userFrom: '$userFrom',
                userTo: '$userTo',
              },
              reference: {
                $first: '$reference',
              },
              created: {
                $first: '$created',
              },
            },
          },
          {
            $lookup: {
              from: MessageStat.collection.name,
              let: {
                feedbackUserFrom: '$_id.userFrom',
                feedbackUserTo: '$_id.userTo',
              },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        {
                          $ne: ['$firstReplyCreated', null],
                        },
                        {
                          $or: [
                            {
                              $and: [
                                {
                                  $eq: [
                                    '$firstMessageUserFrom',
                                    '$$feedbackUserFrom',
                                  ],
                                },
                                {
                                  $eq: [
                                    '$firstMessageUserTo',
                                    '$$feedbackUserTo',
                                  ],
                                },
                              ],
                            },
                            {
                              $and: [
                                {
                                  $eq: [
                                    '$firstMessageUserFrom',
                                    '$$feedbackUserTo',
                                  ],
                                },
                                {
                                  $eq: [
                                    '$firstMessageUserTo',
                                    '$$feedbackUserFrom',
                                  ],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $limit: 1,
                },
              ],
              as: 'repliedThreads',
            },
          },
          {
            $match: {
              'repliedThreads.0': {
                $exists: true,
              },
            },
          },
          {
            $group: {
              _id: null,
              positive: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$reference', 'yes'],
                    },
                    1,
                    0,
                  ],
                },
              },
              negative: {
                $sum: {
                  $cond: [
                    {
                      $eq: ['$reference', 'no'],
                    },
                    1,
                    0,
                  ],
                },
              },
              recentPositive: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $gte: ['$created', since],
                        },
                        {
                          $eq: ['$reference', 'yes'],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              recentNegative: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        {
                          $gte: ['$created', since],
                        },
                        {
                          $eq: ['$reference', 'no'],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]).then(rows => done(null, rows), done);
      },
    },
    (err, results) => {
      if (err) {
        return callback(err);
      }
      const threadCounts = results.repliedThreads[0] || {};
      const feedbackCounts = results.feedback[0] || {};
      return callback(null, {
        total: parseStatisticsCount(threadCounts.total),
        positive: parseStatisticsCount(feedbackCounts.positive),
        negative: parseStatisticsCount(feedbackCounts.negative),
        recent: {
          total: parseStatisticsCount(threadCounts.recentTotal),
          positive: parseStatisticsCount(feedbackCounts.recentPositive),
          negative: parseStatisticsCount(feedbackCounts.recentNegative),
        },
      });
    },
  );
};

/**
 * Get all statistics
 */
export const getPublicStatistics = function (
  req: StatisticsRequest,
  res: JsonResponse<PublicStatistics>,
): JsonResponse<PublicStatistics> | void {
  if (publicStatisticsCache && publicStatisticsCache.expiresAt > Date.now()) {
    return res
      .header(
        'Cache-Control',
        `public, max-age=${PUBLIC_STATISTICS_CACHE_SECONDS}`,
      )
      .json(publicStatisticsCache.statistics);
  }
  const state: StatisticsAccumulator = {
    connections: [],
    experiences: {},
    hosting: {},
    messageInteractions: {},
  };
  req.statistics = state;
  async.waterfall(
    [
      // Total users
      function (done: WaterfallDone) {
        statisticsService.getUsersCount(function (err, count) {
          if (err) {
            return done(err);
          }
          state.total = count!;
          done();
        });
      },
      // External sites - BeWelcome
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount(
          'bewelcome',
          function (err, count) {
            if (err) {
              return done(err);
            }
            state.connections.push({
              network: 'bewelcome',
              count: count!,
              percentage: connectionPercentage(count!, state.total),
            });
            done();
          },
        );
      },
      // External sites - Couchsurfing
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount(
          'couchsurfing',
          function (err, count) {
            if (err) {
              return done(err);
            }
            state.connections.push({
              network: 'couchsurfing',
              count: count!,
              percentage: connectionPercentage(count!, state.total),
            });
            done();
          },
        );
      },
      // External sites - Warmshowers
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount(
          'warmshowers',
          function (err, count) {
            if (err) {
              return done(err);
            }
            state.connections.push({
              network: 'warmshowers',
              count: count!,
              percentage: connectionPercentage(count!, state.total),
            });
            done();
          },
        );
      },
      // External sites - Facebook
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount(
          'facebook',
          function (err, count) {
            if (err) {
              return done(err);
            }
            state.connections.push({
              network: 'facebook',
              count: count!,
              percentage: connectionPercentage(count!, state.total),
            });
            done();
          },
        );
      },
      // External sites - GitHub
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount('github', function (err, count) {
          if (err) {
            return done(err);
          }
          state.connections.push({
            network: 'github',
            count: count!,
            percentage: connectionPercentage(count!, state.total),
          });
          done();
        });
      },
      // External sites - Nostr
      function (done: WaterfallDone) {
        statisticsService.getExternalSiteCount('nostr', function (err, count) {
          if (err) {
            return done(err);
          }
          state.connections.push({
            network: 'nostr',
            count: count!,
            percentage: connectionPercentage(count!, state.total),
          });
          done();
        });
      },
      // Newsletter subscribers
      function (done: WaterfallDone) {
        statisticsService.getNewsletterSubscriptionsCount(
          function (err, count) {
            if (err) {
              return done(err);
            }
            state.newsletter = {
              count: count!,
              percentage: Math.round((count! / state.total!) * 100),
            };
            done();
          },
        );
      },
      // Experience statistics
      function (done: WaterfallDone) {
        statisticsService.getExperienceStatistics(
          moment().subtract(90, 'days').toDate(),
          function (err, statistics) {
            if (err) {
              return done(err);
            }
            state.experiences = statistics!;
            done();
          },
        );
      },
      // Replied message threads and their feedback
      function (done: WaterfallDone) {
        statisticsService.getMessageInteractionStatistics(
          moment().subtract(90, 'days').toDate(),
          function (err, statistics) {
            if (err) {
              return done(err);
            }
            state.messageInteractions = statistics!;
            done();
          },
        );
      },
      // Hosting stats
      function (done: WaterfallDone) {
        statisticsService.getHostOffersCount(function (err, counter) {
          if (err) {
            return done(err);
          }
          const totalHosting = counter!.yes + counter!.maybe;
          state.hosting = {
            total: totalHosting,
            percentage: Math.round((totalHosting / state.total!) * 100),
            yes: counter!.yes,
            yesPercentage: Math.round((counter!.yes / totalHosting) * 100),
            maybe: counter!.maybe,
            maybePercentage: Math.round((counter!.maybe / totalHosting) * 100),
          };
          done();
        });
      },
      // Done!
      function () {
        // This stage runs only after every preceding task has populated the
        // accumulator; the assertion changes no runtime shape or values.
        const statistics = state as PublicStatistics;
        publicStatisticsCache = {
          expiresAt: Date.now() + PUBLIC_STATISTICS_CACHE_SECONDS * 1000,
          statistics,
        };
        req.statistics = statistics;
        return res
          .header(
            'Cache-Control',
            `public, max-age=${PUBLIC_STATISTICS_CACHE_SECONDS}`,
          )
          .json(statistics);
      },
    ],
    function (err?: Error | null) {
      /* istanbul ignore else */
      if (err) {
        res
          .header('Cache-Control', 'no-store')
          .status(400)
          .send({
            message: errorMessage(err),
          });
      }
    },
  );
};

/**
 * Collect statistics
 *
 * Mobile apps should show "App needs update" if this route returns headers:
 * ```
 * {
 *   'x-tr-update-needed': 'Custom message to show to user.'
 * }
 * ```
 */
export const collectStatistics = function (
  req: CollectionRequest,
  res: JsonResponse<{ message: string }>,
): JsonResponse<{ message: string }> | void {
  const collection = String(_.get(req, 'body.collection', ''));
  const validCollections = ['mobileAppInit'];
  const updateMsg =
    'You should update Trustroots app or otherwise it will not continue functioning.';
  const statsInput = _.get(req, 'body.stats');
  if (!_.has(req, 'body.stats') || !_.isObject(statsInput)) {
    return res.header('x-tr-update-needed', updateMsg).status(400).send({
      message: 'Missing or invalid `stats`.',
    });
  }
  if (!collection || validCollections.indexOf(collection) === -1) {
    return res.header('x-tr-update-needed', updateMsg).status(400).send({
      message: 'Missing or invalid `collection`.',
    });
  }
  const appVersion = String(_.get(req, 'body.stats.version', 'unknown'));
  const needsUpdate = semver.satisfies(appVersion, '< 1.0.0');

  // Object for statistics
  const stats: StatObject = {
    namespace: 'mobileAppInit',
    counts: {
      count: 1,
    },
    tags: {
      // Trustroots app version (e.g. "0.2.0")
      version: appVersion,
      // Device year class, e.g. "2012"
      // @link https://github.com/facebook/device-year-class
      deviceYearClass: String(
        _.get(req, 'body.stats.deviceYearClass', 'unknown'),
      ),
    },
    meta: {
      // Device OS (e.g. "android")
      os: String(_.get(req, 'body.stats.os', 'unknown')),
      // Expo SDK version
      expoVersion: String(_.get(req, 'body.stats.expoVersion', 'unknown')),
    },
  };

  // Send validation result to stats
  statService.stat(stats, function () {
    // Add update header if app version so requires
    if (needsUpdate) {
      return res.header('x-tr-update-needed', updateMsg).json({
        message: updateMsg,
      });
    }
    return res.json({
      message: 'OK',
    });
  });
};
Object.assign(statisticsService, {
  clearPublicStatisticsCache,
  getUsersCount,
  getExternalSiteCount,
  getMeetOffersCount,
  getHostOffersCount,
  getNewsletterSubscriptionsCount,
  getLastSeenStatistic,
  getUserLanguagesCount,
  getExperienceStatistics,
  getMessageInteractionStatistics,
  getPublicStatistics,
  collectStatistics,
});
export default statisticsService;
export { statisticsService as 'module.exports' };
