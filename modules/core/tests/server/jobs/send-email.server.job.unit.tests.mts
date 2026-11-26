import assert from 'node:assert/strict';
import mockModule from './../../../../../testutils/server/mock-module.mts';

type CreateSendEmailJob =
  typeof import('../../../server/jobs/send-email.server.job.mts').default;
type SendCallback = (error?: Error | null) => void;

async function loadJob(sendError: Error | null, allow: boolean | Error = true) {
  const events: unknown[][] = [];
  const transport = {
    sent: [] as unknown[],
    closed: 0,
    sendMail(data: unknown, callback: SendCallback) {
      transport.sent.push(data);
      callback(sendError);
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
      './../../../../config/config.mts': {
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
    async deliverSignupReminder(_reminder, _address, send) {
      await send();
    },
  });
  return { job, events, transport };
}

const email = {
  to: { name: 'Fictional Member', address: 'member@example.test' },
  from: 'trustroots@example.test',
  subject: 'Fictional subject',
  html: '<p>Hello</p>',
  text: 'Hello',
};

describe('job: send email (delivery and logging)', function () {
  it('sends the email, closes the pool and logs the start and success', async function () {
    const { job, events, transport } = await loadJob(null);
    const error = await new Promise<Error | null | undefined>(resolve =>
      job(
        { attrs: { _id: 'fictional-job-id', data: email } } as never,
        resolve,
      ),
    );
    assert.equal(error, undefined);
    assert.deepEqual(transport.sent, [email]);
    assert.equal(transport.closed, 1);
    assert.deepEqual(events, [
      [
        'debug',
        'Starting `send email` job #wGcxmQ',
        { jobId: 'fictional-job-id' },
      ],
      [
        'info',
        'Successfully finished `send email` job #4vO5Vt',
        { jobId: 'fictional-job-id' },
      ],
    ]);
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
      assert.equal(error, allow === failure ? failure : undefined);
      assert.deepEqual(transport.sent, allow === true ? [email] : []);
    }
  });

  it('closes the pool, logs the failure and passes the error on', async function () {
    const failure = new Error('smtp failed');
    const { job, events, transport } = await loadJob(failure);
    const error = await new Promise<Error | null | undefined>(resolve =>
      job(
        { attrs: { _id: 'fictional-job-id', data: email } } as never,
        resolve,
      ),
    );
    assert.equal(error, failure);
    assert.equal(transport.closed, 1);
    assert.deepEqual(events, [
      [
        'debug',
        'Starting `send email` job #wGcxmQ',
        { jobId: 'fictional-job-id' },
      ],
      [
        'error',
        'The `send email` job failed #VDKMbr',
        { jobId: 'fictional-job-id', error: failure },
      ],
    ]);
  });
});
