import type { RequestHandler } from 'express';
import moment from 'moment';
import mongoose, { type Model } from 'mongoose';
import type { PublicCharts } from '../../shared/public-charts.mts';

const freshForMs = 60 * 60 * 1000;
const keepForMs = 24 * freshForMs;
const retryDelayMs = 60 * 1000;
const weeksToShow = 12;
const queryTimeoutMs = 5000;
let cache: { refreshedAt: number; data: PublicCharts } | undefined;
let pending: Promise<void> | undefined;
let retryAt = 0;

async function countByWeek(
  model: Pick<Model<unknown>, 'aggregate'>,
  field: string,
  boundaries: Date[],
): Promise<Map<string, number>> {
  const rows = await model
    .aggregate<{ _id: Date; count: number }>([
      {
        $match: {
          [field]: { $gte: boundaries[0], $lt: boundaries[weeksToShow] },
        },
      },
      {
        $bucket: {
          groupBy: `$${field}`,
          boundaries,
          output: { count: { $sum: 1 } },
        },
      },
    ])
    .option({ maxTimeMS: queryTimeoutMs })
    .exec();
  return new Map(rows.map(row => [row._id.toISOString(), row.count]));
}

async function getCharts(now: Date): Promise<PublicCharts> {
  const User = mongoose.model('User');
  const MessageStat = mongoose.model('MessageStat');
  const currentWeek = moment.utc(now).startOf('isoWeek');
  const boundaries = Array.from({ length: weeksToShow + 1 }, (_, index) =>
    currentWeek
      .clone()
      .subtract(weeksToShow - index, 'weeks')
      .toDate(),
  );
  const asOf = moment.utc(now);
  const since = {
    past7Days: asOf.clone().subtract(7, 'days').toDate(),
    past14Days: asOf.clone().subtract(14, 'days').toDate(),
    past30Days: asOf.clone().subtract(30, 'days').toDate(),
    past6Months: asOf.clone().subtract(6, 'months').toDate(),
    past12Months: asOf.clone().subtract(12, 'months').toDate(),
  };
  const counts = Object.fromEntries(
    Object.entries(since).map(([key, date]) => [
      key,
      { $sum: { $cond: [{ $gte: ['$seen', date] }, 1, 0] } },
    ]),
  );
  const [signups, starts, replies, [activity]] = await Promise.all([
    countByWeek(User, 'created', boundaries),
    countByWeek(MessageStat, 'firstMessageCreated', boundaries),
    countByWeek(MessageStat, 'firstReplyCreated', boundaries),
    User.aggregate<PublicCharts['memberActivity']>([
      { $match: { seen: { $gte: since.past12Months, $lte: now } } },
      { $group: { _id: null, ...counts } },
      { $project: { _id: 0 } },
    ])
      .option({ maxTimeMS: queryTimeoutMs })
      .exec(),
  ]);

  return {
    weeks: boundaries.slice(0, -1).map(date => {
      const key = date.toISOString();
      return {
        weekStarting: key.slice(0, 10),
        signups: signups.get(key) ?? 0,
        conversationsStarted: starts.get(key) ?? 0,
        firstReplies: replies.get(key) ?? 0,
      };
    }),
    memberActivity: activity ?? {
      past7Days: 0,
      past14Days: 0,
      past30Days: 0,
      past6Months: 0,
      past12Months: 0,
    },
  };
}

export const getPublicCharts: RequestHandler = async (_req, res) => {
  const now = Date.now();
  if ((!cache || cache.refreshedAt + freshForMs <= now) && retryAt <= now) {
    // Share a refresh across requests, including requests with different query strings.
    await (pending ??= getCharts(new Date())
      .then(
        data => {
          cache = { refreshedAt: Date.now(), data };
        },
        () => {
          retryAt = Date.now() + retryDelayMs;
        },
      )
      .finally(() => {
        pending = undefined;
      }));
  }

  const servedAt = Date.now();
  if (cache && cache.refreshedAt + keepForMs > servedAt) {
    const cacheUntil = Math.min(
      Math.max(cache.refreshedAt + freshForMs, retryAt),
      cache.refreshedAt + keepForMs,
    );
    const maxAge = Math.max(0, Math.floor((cacheUntil - servedAt) / 1000));
    res.set('Cache-Control', `public, max-age=${maxAge}`).json(cache.data);
    return;
  }

  res
    .set('Cache-Control', 'no-store')
    .set(
      'Retry-After',
      String(Math.max(1, Math.ceil((retryAt - servedAt) / 1000))),
    )
    .status(503)
    .json({ message: 'Chart data is temporarily unavailable.' });
};
