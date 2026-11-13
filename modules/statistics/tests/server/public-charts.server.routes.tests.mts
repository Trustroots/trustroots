import mongoose from 'mongoose';
import moment from 'moment';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';
import express from '../../../../config/lib/express.mjs';
import type { PublicCharts } from '../../shared/public-charts.mts';

describe('Public statistics charts', () => {
  const User = mongoose.model('User');
  const MessageStat = mongoose.model('MessageStat');
  const userIds: mongoose.Types.ObjectId[] = [];
  const conversationIds: mongoose.Types.ObjectId[] = [];

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: userIds } });
    await MessageStat.deleteMany({ _id: { $in: conversationIds } });
  });

  it('backs off on a cold-cache failure and fills empty weeks after recovery', async () => {
    const app = await express.init(mongoose.connection);
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const query = vi.spyOn(User, 'aggregate').mockImplementationOnce(() => {
      throw new Error('Database unavailable');
    });
    try {
      await request(app)
        .get('/api/statistics/charts')
        .expect('Cache-Control', 'no-store')
        .expect('Retry-After', '60')
        .expect(503, { message: 'Chart data is temporarily unavailable.' });
      await request(app).get('/api/statistics/charts?v=2').expect(503);
      expect(query).toHaveBeenCalledTimes(2);

      clock.mockReturnValue(now + 60_000);
      const response = await request(app)
        .get('/api/statistics/charts')
        .expect('Cache-Control', 'public, max-age=3600')
        .expect(200);
      const data: PublicCharts = response.body;
      expect(data.weeks).toHaveLength(12);
      expect(data.weeks.every(week => week.signups === 0)).toBe(true);
      expect(data.weeks.every(week => week.conversationsStarted === 0)).toBe(
        true,
      );
      expect(data.weeks.every(week => week.firstReplies === 0)).toBe(true);
      expect(data.memberActivity).toEqual({
        past7Days: 0,
        past14Days: 0,
        past30Days: 0,
        past6Months: 0,
        past12Months: 0,
      });
    } finally {
      clock.mockRestore();
      query.mockRestore();
    }
  });

  it('buckets retained records in complete UTC weeks and counts latest activity', async () => {
    const app = await express.init(mongoose.connection);
    const now = moment.utc();
    const currentWeek = now.clone().startOf('isoWeek');
    const start = currentWeek.clone().subtract(12, 'weeks');
    const lastWeek = currentWeek.clone().subtract(1, 'week');
    const daysAgo = (days: number) =>
      now.clone().subtract(days, 'days').toDate();
    const users = [
      { created: start.toDate(), seen: daysAgo(1) },
      { created: lastWeek.toDate(), seen: daysAgo(10) },
      { created: currentWeek.toDate(), seen: daysAgo(25) },
      { created: start.clone().subtract(1, 'ms').toDate(), seen: daysAgo(90) },
      { created: daysAgo(400), seen: daysAgo(250) },
      { created: daysAgo(400), seen: daysAgo(400) },
      { created: daysAgo(400), seen: daysAgo(-1) },
    ].map((user, index) => ({
      ...user,
      _id: new mongoose.Types.ObjectId(),
      email: `charts${index}@example.invalid`,
      username: `chart-user-${index}`,
    }));
    const conversations = [
      {
        firstMessageCreated: start.toDate(),
        firstReplyCreated: lastWeek.toDate(),
      },
      {
        firstMessageCreated: start.clone().subtract(1, 'ms').toDate(),
        firstReplyCreated: start.toDate(),
      },
      { firstMessageCreated: lastWeek.toDate(), firstReplyCreated: null },
      {
        firstMessageCreated: currentWeek.toDate(),
        firstReplyCreated: currentWeek.toDate(),
      },
    ].map(conversation => ({
      ...conversation,
      _id: new mongoose.Types.ObjectId(),
      firstMessageUserFrom: new mongoose.Types.ObjectId(),
      firstMessageUserTo: new mongoose.Types.ObjectId(),
    }));
    userIds.push(...users.map(user => user._id));
    conversationIds.push(
      ...conversations.map(conversation => conversation._id),
    );
    await User.collection.insertMany(users);
    await MessageStat.collection.insertMany(conversations);

    // Advance the cache clock past the previous request without moving the query's dates.
    const refreshedAt = Date.now() + 3_660_001;
    const clock = vi.spyOn(Date, 'now').mockReturnValue(refreshedAt);
    const query = vi.spyOn(User, 'aggregate');
    try {
      const read = (suffix = '') =>
        request(app)
          .get('/api/statistics/charts' + suffix)
          .expect(200);
      const [response, concurrent] = await Promise.all([read(), read('?v=2')]);
      expect(query).toHaveBeenCalledTimes(2);
      expect(concurrent.body).toEqual(response.body);
      const data: PublicCharts = response.body;
      expect(data.weeks).toEqual(
        Array.from({ length: 12 }, (_, index) => {
          const hasRecords = index === 0 || index === 11;
          return {
            weekStarting: start
              .clone()
              .add(index, 'weeks')
              .format('YYYY-MM-DD'),
            signups: hasRecords ? 1 : 0,
            conversationsStarted: hasRecords ? 1 : 0,
            firstReplies: hasRecords ? 1 : 0,
          };
        }),
      );
      expect(data.memberActivity).toEqual({
        past7Days: 1,
        past14Days: 2,
        past30Days: 3,
        past6Months: 4,
        past12Months: 5,
      });
      clock.mockReturnValue(refreshedAt + 10_000);
      await read()
        .expect('Cache-Control', 'public, max-age=3590')
        .expect(response.body);
      expect(query).toHaveBeenCalledTimes(2);

      clock.mockReturnValue(refreshedAt + 3_600_001);
      query.mockImplementationOnce(() => {
        throw new Error('Database unavailable');
      });
      await read()
        .expect('Cache-Control', 'public, max-age=60')
        .expect(response.body);
      await read('?v=3').expect(response.body);
      expect(query).toHaveBeenCalledTimes(4);

      clock.mockReturnValue(refreshedAt + 86_400_001);
      query.mockImplementationOnce(() => {
        throw new Error('Database unavailable');
      });
      await request(app)
        .get('/api/statistics/charts')
        .expect('Retry-After', '60')
        .expect(503);
      expect(query).toHaveBeenCalledTimes(6);
    } finally {
      clock.mockRestore();
      query.mockRestore();
    }
  });
});
