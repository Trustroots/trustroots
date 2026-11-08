const mongoose: typeof import('mongoose') = require('mongoose');
const sinon: typeof import('sinon') = require('sinon');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const utils: typeof import('../../../../testutils/server/data.server.testutil.mts') = require('../../../../testutils/server/data.server.testutil.mts');
const diagnostics: typeof import('../../server/services/sparkpost.server.service.mts') = require('../../server/services/sparkpost.server.service.mts');
let axios: typeof import('axios', {
  with: { 'resolution-mode': 'import' },
}).default;

describe('SparkPost diagnostics service', () => {
  const savedKey = process.env.SPARKPOST_API_KEY;
  const savedBase = process.env.SPARKPOST_API_BASE;
  let get: import('sinon').SinonStub;
  before(async () => {
    axios = (await import('axios')).default;
  });
  beforeEach(() => {
    process.env.SPARKPOST_API_KEY = 'fictional-api-key';
    delete process.env.SPARKPOST_API_BASE;
    get = sinon.stub(axios, 'get');
    get.resolves({ data: { results: [] } });
  });
  afterEach(async () => {
    sinon.restore();
    if (savedKey === undefined) delete process.env.SPARKPOST_API_KEY;
    else process.env.SPARKPOST_API_KEY = savedKey;
    if (savedBase === undefined) delete process.env.SPARKPOST_API_BASE;
    else process.env.SPARKPOST_API_BASE = savedBase;
    await mongoose.connection.collection('agendaJobs').deleteMany({});
    await utils.clearDatabase();
  });

  describe('input validation', () => {
    it('explains an invalid period', () => {
      assert.throws(() => diagnostics.period('14'), {
        message: 'Choose a period of 7, 30 or 90 days.',
      });
    });

    it('accepts only canonical UTC timestamps', () => {
      const now = new Date('2026-10-31T12:00:00.000Z');
      for (const to of [
        '+010000-01-01T00:00:00.000Z',
        '2026-10-30T24:00:00.000Z',
      ]) {
        assert.throws(
          () => diagnostics.windowDates('2026-10-29T00:00:00.000Z', to, now),
          { message: 'Enter valid UTC dates.' },
        );
      }
      assert.throws(
        () =>
          diagnostics.windowDates(
            '2026-02-30T00:00:00.000Z',
            '2026-03-04T00:00:00.000Z',
            new Date('2026-03-05T00:00:00.000Z'),
          ),
        { message: 'Enter valid UTC dates.' },
      );
    });

    it('allows a window of exactly 31 days', () => {
      const now = new Date('2026-10-31T12:00:00.000Z');
      const from = '2026-09-30T00:00:00.000Z';
      const to = '2026-10-31T00:00:00.000Z';
      assert.deepEqual(diagnostics.windowDates(from, to, now), {
        from: new Date(from),
        to: new Date(to),
      });
      assert.throws(
        () => diagnostics.windowDates(from, '2026-10-31T00:00:00.001Z', now),
        {
          message:
            'Choose a UTC window with the start before the end and a duration of at most 31 days.',
        },
      );
    });
  });

  describe('overview', () => {
    const now = new Date('2026-10-31T12:00:00.000Z');

    it('requests daily UTC metrics with bounded, authenticated calls', async () => {
      process.env.SPARKPOST_API_KEY = '  fictional-api-key  ';
      await diagnostics.overview(7, now);
      assert.equal(get.callCount, 1);
      const [url, options] = get.firstCall.args;
      assert.equal(
        url,
        'https://api.eu.sparkpost.com/api/v1/metrics/deliverability/time-series',
      );
      assert.deepEqual(options, {
        params: {
          from: '2026-10-25T00:00',
          to: '2026-10-31T12:00',
          precision: 'day',
          timezone: 'UTC',
          metrics:
            'count_sent,count_delivered,count_bounce,count_unique_confirmed_opened,count_spam_complaint',
        },
        headers: {
          Authorization: 'fictional-api-key',
          Accept: 'application/json',
        },
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: 2 * 1024 * 1024,
      });
    });

    it('treats a blank API key as disabled', async () => {
      process.env.SPARKPOST_API_KEY = '   ';
      assert.equal((await diagnostics.overview(7, now)).provider, 'disabled');
      assert.equal(get.callCount, 0);
    });

    it('counts whole UTC days up to now and reports provider complaints', async () => {
      await mongoose.connection.collection('users').insertMany([
        // Early on the first day of the period.
        {
          username: 'early',
          email: 'early@example.test',
          created: new Date('2026-10-25T01:00:00Z'),
        },
        // Later today, after `now`.
        {
          username: 'later',
          email: 'later@example.test',
          created: new Date('2026-10-31T13:00:00Z'),
        },
      ]);
      get.resolves({
        data: {
          results: [
            {
              ts: '2026-10-30T00:00:00Z',
              count_sent: 5,
              count_delivered: 4,
              count_bounce: 1,
              count_unique_confirmed_opened: 3,
              count_spam_complaint: 2,
            },
          ],
        },
      });
      const { rows } = await diagnostics.overview(7, now);
      assert.equal(rows[6].date, '2026-10-25');
      assert.equal(rows[6].signups, 1);
      assert.equal(rows[0].date, '2026-10-31');
      assert.equal(rows[0].signups, 0);
      assert.equal(rows[1].complaints, 2);
    });
  });

  describe('provider response schemas', () => {
    // The schemas are built when the module loads, so load a fresh copy.
    function freshDiagnostics(): typeof diagnostics {
      const path =
        require.resolve('../../server/services/sparkpost.server.service.mts');
      delete require.cache[path];
      return require(path);
    }
    const now = new Date('2026-10-31T12:00:00.000Z');

    it('reads provider metrics', async () => {
      get.resolves({
        data: {
          results: [
            {
              ts: '2026-10-30T00:00:00Z',
              count_sent: 5,
              count_delivered: 4,
              count_bounce: 1,
              count_unique_confirmed_opened: 3,
              count_spam_complaint: 2,
            },
          ],
        },
      });
      const { provider, rows } = await freshDiagnostics().overview(7, now);
      assert.equal(provider, 'ready');
      assert.deepEqual(rows[1], {
        date: '2026-10-30',
        signups: 0,
        messages: 0,
        sent: 5,
        delivered: 4,
        bounced: 1,
        opens: 3,
        complaints: 2,
      });
    });

    it('fills in missing event fields and pages up to 100 events', async () => {
      get.resolves({
        data: {
          results: [{ timestamp: '2026-10-30T13:00:00Z', type: 'open' }],
        },
      });
      const fresh = freshDiagnostics();
      assert.deepEqual(await fresh.events('2026-10-30', now), {
        date: '2026-10-30',
        capped: false,
        events: [
          {
            timestamp: '2026-10-30T13:00:00Z',
            type: 'open',
            campaign: '',
            recipientDomain: '',
            messageId: '',
            subject: '',
            recipient: '',
          },
        ],
      });
      get.resolves({
        data: {
          results: Array.from({ length: 101 }, () => ({
            timestamp: '2026-10-30T13:00:00Z',
            type: 'open',
          })),
        },
      });
      await assert.rejects(fresh.events('2026-10-30', now));
    });
  });

  describe('events', () => {
    const now = new Date('2026-10-31T12:00:00.000Z');

    it('matches each event to exactly one current account', async () => {
      const created = new Date('2026-01-01T00:00:00.000Z');
      await mongoose.connection.collection('users').insertMany([
        {
          username: 'publicmember',
          email: 'public@example.test',
          created,
          public: true,
        },
        // No pending address at all.
        {
          username: 'privatemember',
          email: 'private@example.test',
          created,
          public: false,
        },
        {
          username: 'sharedemail',
          email: 'shared@example.test',
          created,
          public: true,
        },
        {
          username: 'sharedtemporary',
          email: 'other@example.test',
          emailTemporary: 'shared@example.test',
          created,
          public: false,
        },
        {
          username: 'nopending',
          email: 'unrelated@example.test',
          emailTemporary: '',
          created,
          public: true,
        },
      ]);
      const event = (rcpt: string) => ({
        timestamp: '2026-10-30T12:00:00Z',
        type: 'delivery',
        campaign_id: 'confirm-email',
        recipient_domain: 'example.test',
        message_id: 'fictional-message',
        subject: 'Fictional subject',
        rcpt_to: rcpt,
      });
      get.resolves({
        data: {
          results: [
            event('Public@Example.test'),
            event('private@example.test'),
            event('shared@example.test'),
            // Without a recipient, and without the optional fields.
            { timestamp: '2026-10-30T13:00:00Z', type: 'open' },
          ],
        },
      });
      const result = await diagnostics.events('2026-10-30', now);
      const [url, options] = get.firstCall.args;
      assert.equal(url, 'https://api.eu.sparkpost.com/api/v1/events/message');
      assert.deepEqual(options.params, {
        from: '2026-10-30T00:00:00.000Z',
        to: '2026-10-31T00:00:00.000Z',
        per_page: '100',
      });
      const account = (username: string, isPublic: boolean) => ({
        username,
        created: created.toISOString(),
        public: isPublic,
      });
      assert.deepEqual(result, {
        date: '2026-10-30',
        capped: false,
        events: [
          {
            ...event('Public@Example.test'),
            campaign_id: undefined,
            recipient_domain: undefined,
            message_id: undefined,
            rcpt_to: undefined,
            campaign: 'confirm-email',
            recipientDomain: 'example.test',
            messageId: 'fictional-message',
            recipient: 'Public@Example.test',
            account: account('publicmember', true),
          },
          {
            ...event('private@example.test'),
            campaign_id: undefined,
            recipient_domain: undefined,
            message_id: undefined,
            rcpt_to: undefined,
            campaign: 'confirm-email',
            recipientDomain: 'example.test',
            messageId: 'fictional-message',
            recipient: 'private@example.test',
            account: account('privatemember', false),
          },
          {
            ...event('shared@example.test'),
            campaign_id: undefined,
            recipient_domain: undefined,
            message_id: undefined,
            rcpt_to: undefined,
            campaign: 'confirm-email',
            recipientDomain: 'example.test',
            messageId: 'fictional-message',
            recipient: 'shared@example.test',
          },
          {
            timestamp: '2026-10-30T13:00:00Z',
            type: 'open',
            campaign: '',
            recipientDomain: '',
            messageId: '',
            subject: '',
            recipient: '',
          },
        ].map(row =>
          Object.fromEntries(
            Object.entries(row).filter(([, value]) => value !== undefined),
          ),
        ),
      });
    });

    it('accepts the oldest and newest allowed days', async () => {
      const midnight = new Date('2026-10-31T00:00:00.000Z');
      for (const day of ['2026-10-21', '2026-10-31']) {
        assert.equal((await diagnostics.events(day, midnight)).date, day);
      }
      await assert.rejects(
        diagnostics.events('2026-02-30', new Date('2026-03-05T00:00:00.000Z')),
        { message: 'Choose a complete UTC day within the last 10 days.' },
      );
    });

    it('limits the event page cursor to 2048 characters', async () => {
      const cursor = 'c'.repeat(2048);
      await diagnostics.events('2026-10-30', now, cursor);
      assert.equal(get.firstCall.args[1].params.cursor, cursor);
      await assert.rejects(
        diagnostics.events('2026-10-30', now, cursor + 'c'),
        {
          message: 'Invalid event page.',
        },
      );
    });

    it('refuses blank keys and unknown regions before calling the provider', async () => {
      process.env.SPARKPOST_API_KEY = '   ';
      await assert.rejects(diagnostics.events('2026-10-30', now), {
        message: 'SparkPost is not configured.',
      });
      process.env.SPARKPOST_API_KEY = 'fictional-api-key';
      process.env.SPARKPOST_API_BASE = 'https://untrusted.example.test';
      await assert.rejects(diagnostics.events('2026-10-30', now), {
        message: 'Unsupported SparkPost region.',
      });
      assert.equal(get.callCount, 0);
    });
  });

  describe('preview', () => {
    const now = new Date('2026-10-31T12:00:00.000Z');
    const from = '2026-10-28T00:00:00.000Z';
    const to = '2026-10-31T00:00:00.000Z';
    const job = (campaign: unknown, lastFinishedAt = new Date(from)) => ({
      name: 'send email',
      lastFinishedAt,
      data: {
        headers: { 'X-MSYS-API': JSON.stringify({ campaign_id: campaign }) },
      },
    });

    it('inspects the earliest 1000 jobs, capping only beyond that', async () => {
      const jobs = mongoose.connection.collection('agendaJobs');
      // Inserted first, but finished last.
      await jobs.insertOne(job('latest', new Date('2026-10-30T23:00:00Z')));
      await jobs.insertMany(Array.from({ length: 999 }, () => job('early')));
      const exact = await diagnostics.preview(from, to, now);
      assert.equal(exact.capped, false);
      assert.equal(exact.jobsInspected, 1000);
      await jobs.insertOne(job('early'));
      const capped = await diagnostics.preview(from, to, now);
      assert.equal(capped.capped, true);
      assert.deepEqual(capped.campaigns, [{ campaign: 'early', count: 1000 }]);
    });

    it('names campaigns only from string IDs of at most 100 characters', async () => {
      await mongoose.connection.collection('agendaJobs').insertMany([
        job(['listed']),
        job(7),
        job('x'.repeat(150)),
        { name: 'send email', lastFinishedAt: new Date(from), data: {} },
        {
          name: 'send email',
          lastFinishedAt: new Date(from),
          data: { headers: { 'X-MSYS-API': 'null' } },
        },
      ]);
      const result = await diagnostics.preview(from, to, now);
      assert.deepEqual(result.campaigns, [
        { campaign: 'Unknown', count: 4 },
        { campaign: 'x'.repeat(100), count: 1 },
      ]);
    });

    it('counts only unconfirmed signups as awaiting confirmation', async () => {
      const created = new Date('2026-10-29T00:00:00.000Z');
      await mongoose.connection.collection('users').insertMany(
        [false, true, true].map((isPublic, index) => ({
          username: `member${index}`,
          email: `member${index}@example.test`,
          created,
          public: isPublic,
          roles: ['user'],
        })),
      );
      assert.equal(
        (await diagnostics.preview(from, to, now)).awaitingConfirmation,
        1,
      );
    });
  });
});
