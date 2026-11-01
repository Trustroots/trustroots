// Daily metrics and bounded event pagination adapted from ROmongous's
// ops.trustroots.org/handlers/stats.go (public domain).
import axios from 'axios';
import mongoose from 'mongoose';
import { z } from 'zod';
import type {
  SparkpostOverview,
  SparkpostEvents,
  SparkpostPreview,
} from '../../shared/sparkpost.ts';

const DAY = 86400000;
const metricSchema = z.object({
  results: z.array(
    z.object({
      ts: z.string(),
      count_sent: z.number().nonnegative(),
      count_delivered: z.number().nonnegative(),
      count_bounce: z.number().nonnegative(),
      count_unique_confirmed_opened: z.number().nonnegative(),
      count_spam_complaint: z.number().nonnegative(),
    }),
  ),
});
const eventSchema = z.object({
  results: z
    .array(
      z.object({
        timestamp: z.string(),
        type: z.string(),
        campaign_id: z.string().default(''),
        recipient_domain: z.string().default(''),
        message_id: z.string().default(''),
        subject: z.string().default(''),
        rcpt_to: z.string().default(''),
      }),
    )
    .max(100),
  links: z.object({ next: z.string().optional() }).default({}),
});

export class DiagnosticInputError extends Error {}

export function period(value: unknown): number {
  if (value === undefined) return 30;
  if (typeof value !== 'string' || !['7', '30', '90'].includes(value)) {
    throw new DiagnosticInputError('Choose a period of 7, 30 or 90 days.');
  }
  return Number(value);
}

export function windowDates(from: unknown, to: unknown, now = new Date()) {
  const valid = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
  if (!valid(from) || !valid(to)) {
    throw new DiagnosticInputError('Enter valid UTC dates.');
  }
  const start = Math.min(Date.parse(from), now.getTime());
  const end = Math.min(Date.parse(to), now.getTime());
  if (start >= end || end - start > 31 * DAY) {
    throw new DiagnosticInputError(
      'Choose a UTC window with the start before the end and a duration of at most 31 days.',
    );
  }
  return { from: new Date(start), to: new Date(end) };
}

async function providerRequest(path: string, params: Record<string, string>) {
  const key = process.env.SPARKPOST_API_KEY?.trim();
  if (!key) throw new Error('SparkPost is not configured.');
  const base = (
    process.env.SPARKPOST_API_BASE || 'https://api.eu.sparkpost.com'
  ).replace(/\/$/, '');
  if (
    !['https://api.eu.sparkpost.com', 'https://api.sparkpost.com'].includes(
      base,
    )
  ) {
    throw new Error('Unsupported SparkPost region.');
  }
  const { data } = await axios.get(base + '/api/v1/' + path, {
    params,
    headers: { Authorization: key, Accept: 'application/json' },
    timeout: 10000,
    maxRedirects: 0,
    maxContentLength: 2 * 1024 * 1024,
  });
  return data;
}

async function dailyCounts(model: 'User' | 'Message', from: Date, to: Date) {
  return mongoose
    .model(model)
    .aggregate<{ _id: string; count: number }>([
      { $match: { created: { $gte: from, $lt: to } } },
      {
        $group: {
          _id: {
            $dateToString: {
              date: '$created',
              format: '%Y-%m-%d',
              timezone: 'UTC',
            },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .option({ maxTimeMS: 10000 })
    .exec();
}

export async function overview(
  days: number,
  now = new Date(),
): Promise<SparkpostOverview> {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const [signups, messages] = await Promise.all([
    dailyCounts('User', start, now),
    dailyCounts('Message', start, now),
  ]);
  let provider: SparkpostOverview['provider'] = 'disabled';
  let metrics: z.infer<typeof metricSchema>['results'] = [];
  if (process.env.SPARKPOST_API_KEY?.trim()) {
    try {
      metrics = metricSchema.parse(
        await providerRequest('metrics/deliverability/time-series', {
          from: start.toISOString().slice(0, 16),
          to: now.toISOString().slice(0, 16),
          precision: 'day',
          timezone: 'UTC',
          metrics:
            'count_sent,count_delivered,count_bounce,count_unique_confirmed_opened,count_spam_complaint',
        }),
      ).results;
      provider = 'ready';
    } catch {
      provider = 'unavailable';
    }
  }
  return {
    provider,
    rows: Array.from({ length: days }, (_, index) => {
      const date = new Date(start.getTime() + (days - index - 1) * DAY)
        .toISOString()
        .slice(0, 10);
      const metric = metrics.find(row => row.ts.slice(0, 10) === date);
      return {
        date,
        signups: signups.find(row => row._id === date)?.count || 0,
        messages: messages.find(row => row._id === date)?.count || 0,
        sent: metric?.count_sent ?? null,
        delivered: metric?.count_delivered ?? null,
        bounced: metric?.count_bounce ?? null,
        opens: metric?.count_unique_confirmed_opened ?? null,
        complaints: metric?.count_spam_complaint ?? null,
      };
    }),
  };
}

export async function events(
  day: unknown,
  now = new Date(),
  cursor: unknown = '',
): Promise<SparkpostEvents> {
  if (
    typeof day !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(day)) ||
    new Date(day).toISOString().slice(0, 10) !== day ||
    Date.parse(day) < now.getTime() - 10 * DAY ||
    Date.parse(day) > now.getTime()
  ) {
    throw new DiagnosticInputError(
      'Choose a complete UTC day within the last 10 days.',
    );
  }
  const to = new Date(Math.min(Date.parse(day) + DAY, now.getTime()));
  const result: SparkpostEvents = { date: day, capped: false, events: [] };
  if (typeof cursor !== 'string' || cursor.length > 2048)
    throw new DiagnosticInputError('Invalid event page.');
  const payload = eventSchema.parse(
    await providerRequest('events/message', {
      from: new Date(day).toISOString(),
      to: to.toISOString(),
      per_page: '100',
      ...(cursor ? { cursor } : {}),
    }),
  );
  const recipients = [
    ...new Set(
      payload.results.map(event => event.rcpt_to.toLowerCase()).filter(Boolean),
    ),
  ];
  const accounts = await mongoose
    .model<{
      username: string;
      email: string;
      emailTemporary?: string;
      created: Date;
      public: boolean;
    }>('User')
    .find({
      $or: [
        { email: { $in: recipients } },
        { emailTemporary: { $in: recipients } },
      ],
    })
    .select('username email emailTemporary created public')
    .lean()
    .exec();
  result.events = payload.results.map(event => {
    const matches = accounts.filter(user =>
      [user.email, user.emailTemporary].some(
        address =>
          typeof address === 'string' &&
          address.toLowerCase() === event.rcpt_to.toLowerCase(),
      ),
    );
    const user = matches.length === 1 ? matches[0] : undefined;
    return {
      timestamp: event.timestamp,
      type: event.type,
      campaign: event.campaign_id,
      recipientDomain: event.recipient_domain,
      messageId: event.message_id,
      subject: event.subject,
      recipient: event.rcpt_to,
      ...(user
        ? {
            account: {
              username: String(user.username),
              created: new Date(user.created).toISOString(),
              public: user.public === true,
            },
          }
        : {}),
    };
  });
  if (payload.links.next) {
    const next = new URL(
      payload.links.next,
      'https://api.eu.sparkpost.com',
    ).searchParams.get('cursor');
    if (next && next !== cursor && payload.results.length)
      result.nextCursor = next;
    else result.capped = true;
  }
  return result;
}

function campaignOf(header: unknown): string {
  try {
    const parsed = JSON.parse(String(header));
    return typeof parsed?.campaign_id === 'string'
      ? parsed.campaign_id.slice(0, 100)
      : 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export async function preview(
  from: unknown,
  to: unknown,
  now = new Date(),
): Promise<SparkpostPreview> {
  const window = windowDates(from, to, now);
  const [jobs, awaitingConfirmation] = await Promise.all([
    mongoose.connection
      .collection('agendaJobs')
      .find(
        {
          name: 'send email',
          lastFinishedAt: { $gte: window.from, $lt: window.to },
          // Failed attempts are not successful completions; Agenda retains old failures.
          $expr: {
            $gt: ['$lastFinishedAt', { $ifNull: ['$failedAt', new Date(0)] }],
          },
        },
        {
          projection: { _id: 0, 'data.headers.X-MSYS-API': 1 },
          maxTimeMS: 10000,
        },
      )
      .sort({ lastFinishedAt: 1, _id: 1 })
      .limit(1001)
      .toArray(),
    mongoose
      .model('User')
      .countDocuments({
        created: { $gte: window.from, $lt: window.to },
        public: false,
        roles: { $nin: ['suspended', 'shadowban'] },
      })
      .maxTimeMS(10000)
      .exec(),
  ]);
  const campaigns = new Map<string, number>();
  for (const job of jobs.slice(0, 1000)) {
    const campaign = campaignOf(job.data?.headers?.['X-MSYS-API']);
    campaigns.set(campaign, (campaigns.get(campaign) || 0) + 1);
  }
  return {
    from: window.from.toISOString(),
    to: window.to.toISOString(),
    awaitingConfirmation,
    jobsInspected: Math.min(jobs.length, 1000),
    capped: jobs.length > 1000,
    campaigns: [...campaigns]
      .map(([campaign, count]) => ({ campaign, count }))
      .sort(
        (a, b) => b.count - a.count || a.campaign.localeCompare(b.campaign),
      ),
  };
}
