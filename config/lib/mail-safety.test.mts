import assert from 'node:assert/strict';
import { test } from 'node:test';
import nodemailer, { type MailMessage } from 'nodemailer';
import type { Config } from '../types.mts';
import { applyMailSafety } from './mail-safety.mts';

function fixture(domain = 'main.test.trustroots.org'): Config {
  return {
    domain,
    supportEmail: 'support@trustroots.org',
    supportInbox: {
      enabled: true,
      fromName: 'Trustroots Support',
      fromAddress: 'support@trustroots.org',
      imap: {
        enabled: true,
        user: 'support@trustroots.org',
        password: 'fictional-password',
      },
    },
    mailer: {
      from: 'support@trustroots.org',
      options: { auth: { user: 'fictional-smtp', pass: 'fictional-secret' } },
    },
  } as Config;
}

const allowlist = {
  NODE_ENV: 'production',
  TRUSTROOTS_DEPLOYMENT_TIER: 'staging',
  TRUSTROOTS_MAIL_MODE: 'allowlist',
  TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST:
    ' tester@example.test,second@example.test ',
  TRUSTROOTS_SUPPORT_TEST_MAILBOX: 'support-test@example.test',
};

test('production NODE_ENV and copied credentials do not enable staging mail', () => {
  const config = fixture();
  assert.equal(applyMailSafety(config, { NODE_ENV: 'production' }), 'capture');
  assert.deepEqual(config.mailer.options, { jsonTransport: true });
  assert.equal(config.supportInbox.enabled, true);
  assert.equal(config.supportInbox.imap.enabled, false);
  assert.equal(config.supportInbox.imap.user, '');
  assert.equal(config.supportInbox.imap.password, '');
});

test('live delivery requires both explicit production tier and production host', () => {
  for (const domain of [
    'trustroots.org',
    'www.trustroots.org',
    'WWW.TRUSTROOTS.ORG.',
  ]) {
    const config = fixture(domain);
    const original = config.mailer.options;
    assert.equal(
      applyMailSafety(config, {
        NODE_ENV: 'production',
        TRUSTROOTS_DEPLOYMENT_TIER: 'production',
      }),
      'live',
    );
    assert.equal(config.mailer.options, original);
    assert.equal(config.supportInbox.imap.enabled, true);
  }
  assert.equal(
    applyMailSafety(fixture('www.trustroots.org'), { NODE_ENV: 'production' }),
    'capture',
  );
  for (const env of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'production', TRUSTROOTS_DEPLOYMENT_TIER: 'production' },
    { NODE_ENV: 'development', TRUSTROOTS_DEPLOYMENT_TIER: 'production' },
  ]) {
    assert.throws(
      () =>
        applyMailSafety(fixture(), { ...env, TRUSTROOTS_MAIL_MODE: 'live' }),
      /explicit production/,
    );
  }
});

test('explicit capture overrides production and unknown modes fail closed', () => {
  assert.equal(
    applyMailSafety(fixture('www.trustroots.org'), {
      NODE_ENV: 'production',
      TRUSTROOTS_DEPLOYMENT_TIER: 'production',
      TRUSTROOTS_MAIL_MODE: 'capture',
    }),
    'capture',
  );
  assert.throws(
    () => applyMailSafety(fixture(), { TRUSTROOTS_MAIL_MODE: 'mistyped' }),
    /Invalid/,
  );
});

test('test delivery requires valid recipients and a separate matching mailbox', () => {
  const config = fixture();
  config.supportInbox.imap.user = 'support-test@example.test';
  assert.throws(
    () =>
      applyMailSafety(config, {
        ...allowlist,
        TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST: '',
      }),
    /valid test recipients/,
  );
  assert.throws(
    () =>
      applyMailSafety(config, {
        ...allowlist,
        TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST: 'not-an-address',
      }),
    /valid test recipients/,
  );
  assert.throws(
    () =>
      applyMailSafety(config, {
        ...allowlist,
        TRUSTROOTS_SUPPORT_TEST_MAILBOX: '',
      }),
    /valid test recipients/,
  );
  assert.throws(
    () =>
      applyMailSafety(config, {
        ...allowlist,
        TRUSTROOTS_SUPPORT_TEST_MAILBOX: 'support@trustroots.org',
      }),
    /must differ/,
  );
  assert.throws(
    () => applyMailSafety(fixture(), allowlist),
    /dedicated test mailbox/,
  );
});

test('allowlist checks actual recipients including Bcc and explicit envelopes before SMTP', async () => {
  const config = fixture();
  config.supportInbox.imap.user = 'support-test@example.test';
  let delivered = 0;
  let closed = 0;
  assert.equal(
    applyMailSafety(config, allowlist, () => ({
      sendMail(_data, done) {
        delivered++;
        done(null, { accepted: true });
      },
      close() {
        closed++;
      },
    })),
    'allowlist',
  );
  assert.equal(config.supportEmail, 'support-test@example.test');
  assert.equal(config.supportInbox.fromAddress, 'support-test@example.test');
  const send = config.mailer.options.send!;
  async function attempt(
    to: string[],
    from: string | false = 'support-test@example.test',
  ) {
    const mail = {
      data: { text: 'Fictional message' },
      message: { getEnvelope: () => ({ to, from }) },
    } as unknown as MailMessage;
    return new Promise<Error | null | undefined>(resolve =>
      send(mail, error => resolve(error)),
    );
  }
  assert.equal(
    await attempt(['TESTER@example.test', 'second@example.test']),
    null,
  );
  assert.equal(delivered, 1);
  assert.equal(closed, 1);
  for (const recipients of [
    [],
    ['outsider@example.test'],
    ['tester@example.test', 'outsider@example.test'],
  ]) {
    assert.match((await attempt(recipients))!.message, /blocked/);
  }
  assert.match(
    (await attempt(['tester@example.test'], 'support@trustroots.org'))!.message,
    /blocked/,
  );
  assert.equal(delivered, 1);
});

test('invalid SMTP setup fails through the callback without exposing configuration', async () => {
  const config = fixture();
  config.supportInbox.imap.user = 'support-test@example.test';
  applyMailSafety(config, allowlist, () => {
    throw new Error('Fictional private configuration');
  });
  const transport = nodemailer.createTransport(config.mailer.options);
  try {
    await assert.rejects(
      transport.sendMail({
        from: 'support-test@example.test',
        to: 'tester@example.test',
        text: 'Fictional',
      }),
      error => {
        assert.equal(
          (error as Error).message,
          'Test mail transport configuration is invalid.',
        );
        return true;
      },
    );
  } finally {
    transport.close();
  }
});

test('allowlisted transport delegates through Nodemailer without enabling network access in tests', async () => {
  const config = fixture();
  config.supportInbox.imap.user = 'support-test@example.test';
  config.mailer.options = { jsonTransport: true };
  applyMailSafety(config, allowlist);
  const transport = nodemailer.createTransport(config.mailer.options);
  try {
    const result = await transport.sendMail({
      from: 'support-test@example.test',
      to: 'tester@example.test',
      text: 'Fictional content',
    });
    assert.equal(typeof result.message, 'string');
    assert.match(result.message, /Fictional content/);
  } finally {
    transport.close();
  }
});

test('allowlisted transport propagates safe delivery failures and closes the transport', async () => {
  const config = fixture();
  config.supportInbox.imap.enabled = false;
  let closed = false;
  applyMailSafety(config, allowlist, () => ({
    sendMail(_data, done) {
      done(new Error('Fictional SMTP failure'));
    },
    close() {
      closed = true;
    },
  }));
  const mail = {
    data: {},
    message: {
      getEnvelope: () => ({
        to: ['tester@example.test'],
        from: 'support-test@example.test',
      }),
    },
  } as unknown as MailMessage;
  await new Promise<void>(resolve =>
    config.mailer.options.send!(mail, error => {
      assert.equal(error!.message, 'Fictional SMTP failure');
      resolve();
    }),
  );
  assert.equal(closed, true);
  assert.equal(config.supportInbox.imap.password, '');
});

test('a preconfigured test support address is permitted and real MIME Bcc cannot bypass the guard', async () => {
  const config = fixture();
  config.supportEmail = 'support-test@example.test';
  config.supportInbox.imap.user = 'support-test@example.test';
  let delivered = 0;
  applyMailSafety(config, allowlist, () => ({
    sendMail(_data, done) {
      delivered++;
      done(null, { accepted: ['tester@example.test'] });
    },
    close() {},
  }));
  const transport = nodemailer.createTransport(config.mailer.options);
  try {
    const base = {
      from: 'Test Support <support-test@example.test>',
      to: 'Fictional Tester <tester@example.test>',
      text: 'Fictional test content',
    };
    await assert.rejects(
      transport.sendMail({ ...base, bcc: 'outsider@example.test' }),
      /blocked/,
    );
    await assert.rejects(
      transport.sendMail({
        ...base,
        envelope: {
          from: 'support-test@example.test',
          to: ['outsider@example.test'],
        },
      }),
      /blocked/,
    );
    assert.equal(delivered, 0);
    await transport.sendMail(base);
    assert.equal(delivered, 1);
  } finally {
    transport.close();
  }
});
