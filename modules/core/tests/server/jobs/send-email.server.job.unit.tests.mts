import assert from 'node:assert/strict';
import mockModule from './../../../../../testutils/server/mock-module.mts';

type CreateSendEmailJob =
  typeof import('../../../server/jobs/send-email.server.job.mts').default;

async function loadJob(
  sendError: Error | null,
  allow: boolean | Error = true,
  mailMode = 'live',
  accepted = true,
  serverMessageId?: string,
  deliverReminder: 'send' | 'skip' | Error = 'send',
) {
  const events: unknown[][] = [];
  const reminders: unknown[] = [];
  const transport = {
    sent: [] as unknown[],
    closed: 0,
    async sendMail(data: unknown) {
      transport.sent.push(data);
      if (sendError) throw sendError;
      return accepted
        ? { accepted: ['member@example.test'], serverMessageId }
        : {};
    },
    close() {
      transport.closed++;
    },
  };
  const { default: createSendEmailJob } = await mockModule<{
    default: CreateSendEmailJob;
  }>(
    new URL('../../../server/jobs/send-email.server.job.mts', import.meta.url),
    {
      nodemailer: {
        createTransport(options: unknown) {
          assert.deepEqual(options, { fictional: 'transport' });
          return transport;
        },
      },
      '../../../../config/config.mts': {
        domain: 'example.test',
        mailMode,
        mailer: { options: { fictional: 'transport' } },
      },
      '@trustroots/logger': (...args: unknown[]) => {
        events.push(args);
      },
    },
  );
  const job = createSendEmailJob({
    async canDeliverNotificationEmail() {
      if (allow instanceof Error) throw allow;
      return allow;
    },
    async deliverSignupReminder(reminder, email, send) {
      reminders.push({ reminder, email });
      if (deliverReminder instanceof Error) throw deliverReminder;
      if (deliverReminder === 'send') await send();
    },
  });
  return { job, events, transport, reminders };
}

const messageId = '<agenda-fictional-job-id@example.test>';
const email = {
  to: { name: 'Fictional Member', address: 'member@example.test' },
  from: 'trustroots@example.test',
  subject: 'Fictional subject',
  html: '<p>Hello</p>',
  text: 'Hello',
};

describe('job: send email (delivery and logging)', function () {
  const modes = [
    ['live', 'Queued email accepted by SMTP', true],
    ['allowlist', 'Queued email accepted by SMTP', true],
    ['allowlist', 'Queued email finished in allowlist mode', false],
    ['capture', 'Queued email captured', false],
  ] as const;
  for (const [mailMode, outcome, accepted] of modes) {
    it(`records ${mailMode} mail as ${outcome}`, async function () {
      const { job, events, transport } = await loadJob(
        null,
        true,
        mailMode,
        accepted,
      );
      const error = await new Promise<Error | null | undefined>(resolve =>
        job(
          {
            attrs: { _id: 'fictional-job-id', data: email, failCount: 1 },
          } as never,
          resolve,
        ),
      );
      assert.equal(error, undefined);
      assert.deepEqual(transport.sent, [{ ...email, messageId }]);
      assert.equal(transport.closed, 1);
      assert.deepEqual(events, [
        [
          'info',
          outcome,
          {
            jobId: 'fictional-job-id',
            attempt: 2,
            mailMode,
            messageId,
            processingMs: (events[0][2] as { processingMs: number })
              .processingMs,
          },
        ],
      ]);
    });
  }

  it('logs a well-formed provider Message-ID without raw transport details', async function () {
    for (const id of [
      '<server-123@smtp.example.test>',
      '<bad\nid@smtp.example.test>',
    ]) {
      const { job, events } = await loadJob(null, true, 'live', true, id);
      const error = await new Promise<Error | null | undefined>(resolve =>
        job(
          { attrs: { _id: 'fictional-job-id', data: email } } as never,
          resolve,
        ),
      );
      assert.equal(error, undefined);
      const metadata = events[0][2] as { providerMessageId?: string };
      assert.equal(
        metadata.providerMessageId,
        id.includes('\n') ? undefined : id,
      );
      assert.equal(JSON.stringify(metadata).includes(email.to.address), false);
    }
  });

  it('requires recipient acceptance for live mail', async function () {
    const { job, events, transport } = await loadJob(null, true, 'live', false);
    const error = await new Promise<Error | null | undefined>(resolve =>
      job(
        { attrs: { _id: 'fictional-job-id', data: email } } as never,
        resolve,
      ),
    );
    assert.equal(
      error?.message,
      'Mail authentication or configuration failure',
    );
    assert.equal(transport.closed, 1);
    assert.deepEqual(events, []);
  });

  it('skips past-deadline mail', async function () {
    const { job, events, transport } = await loadJob(null);
    const error = await new Promise<Error | null | undefined>(resolve =>
      job(
        {
          attrs: {
            _id: 'fictional-job-id',
            data: { ...email, deliveryDeadline: new Date(0) },
          },
        } as never,
        resolve,
      ),
    );
    assert.equal(error, undefined);
    assert.deepEqual(transport.sent, []);
    assert.deepEqual(events, [
      [
        'info',
        'Queued email expired',
        { jobId: 'fictional-job-id', attempt: 1, mailMode: 'live' },
      ],
    ]);
  });

  it('delivers signup reminders through the signup reminder gate', async function () {
    const reminder = {
      userId: 'fictional-member',
      emailToken: 'fictional-token',
    };
    for (const deliverReminder of ['send', 'skip'] as const) {
      const { job, transport, reminders } = await loadJob(
        null,
        true,
        'live',
        true,
        undefined,
        deliverReminder,
      );
      const error = await new Promise<Error | null | undefined>(resolve =>
        job(
          {
            attrs: {
              _id: 'fictional-job-id',
              data: { ...email, signupReminder: reminder },
            },
          } as never,
          resolve,
        ),
      );
      assert.equal(error, undefined);
      assert.deepEqual(reminders, [{ reminder, email: 'member@example.test' }]);
      assert.deepEqual(
        transport.sent,
        deliverReminder === 'send' ? [{ ...email, messageId }] : [],
      );
    }
  });

  it('checks optional mail before delivering it', async function () {
    const optionalEmail = {
      ...email,
      notificationEmail: { userId: 'fictional-member', category: 'hosting' },
    };
    const failure = new Error('database failed');
    for (const allow of [true, false, failure]) {
      const { job, transport } = await loadJob(null, allow);
      const error = await new Promise<Error | null | undefined>(resolve =>
        job(
          { attrs: { _id: 'fictional-job-id', data: optionalEmail } } as never,
          resolve,
        ),
      );
      assert.equal(
        error?.message,
        allow === failure ? 'Mail processing failed' : undefined,
      );
      assert.deepEqual(
        transport.sent,
        allow === true ? [{ ...email, messageId }] : [],
      );
    }
  });

  it('closes the transport and passes a sanitised error to Agenda', async function () {
    const failure = Object.assign(
      new Error('SMTP reply with a fictional secret'),
      {
        code: 'EENVELOPE',
        command: 'RCPT TO',
        responseCode: 550,
        response: '550 member@example.test',
      },
    );
    const { job, events, transport } = await loadJob(failure);
    const error = await new Promise<Error | null | undefined>(resolve =>
      job(
        { attrs: { _id: 'fictional-job-id', data: email } } as never,
        resolve,
      ),
    );
    assert.equal(error?.message, 'Mail recipient permanently rejected');
    assert.deepEqual(Object.entries(error!), [
      ['retryable', false],
      ['responseCode', 550],
    ]);
    assert.equal(transport.closed, 1);
    assert.deepEqual(events, []);
  });
});
