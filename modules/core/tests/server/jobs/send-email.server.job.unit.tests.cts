const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const mockModule: typeof import('../../../../../testutils/server/mock-module') = require('../../../../../testutils/server/mock-module');

type SendEmailJob =
  typeof import('../../../server/jobs/send-email.server.job.mts').default;
type SendCallback = (error?: Error | null) => void;

function loadJob(sendError: Error | null) {
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
  const job = mockModule<SendEmailJob>(
    require.resolve('../../../server/jobs/send-email.server.job.mts'),
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
      './../../../../config/lib/logger.mjs': (...args: unknown[]) => {
        events.push(args);
      },
    },
  );
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
    const { job, events, transport } = loadJob(null);
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

  it('closes the pool, logs the failure and passes the error on', async function () {
    const failure = new Error('smtp failed');
    const { job, events, transport } = loadJob(failure);
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
