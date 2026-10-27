import nodemailer, { type MailMessage } from 'nodemailer';
import type { Config } from '../types.mts';

type Environment = Record<string, string | undefined>;
interface MailTransport {
  sendMail(
    data: MailMessage['data'],
    done: (error?: Error | null, info?: unknown) => void,
  ): unknown;
  close(): void;
}
type TransportFactory = (options: Config['mailer']['options']) => MailTransport;

function address(value: string): string {
  return value.trim().toLowerCase();
}

function isAddress(value: string): boolean {
  return /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(value);
}

/** Apply after deployment overrides so copied SMTP settings cannot bypass it. */
export function applyMailSafety(
  config: Pick<Config, 'domain' | 'mailer' | 'supportInbox' | 'supportEmail'>,
  env: Environment = process.env,
  createTransport: TransportFactory = options =>
    nodemailer.createTransport(options),
): 'live' | 'capture' | 'allowlist' {
  const domain = config.domain.toLowerCase().replace(/\.$/, '');
  const production =
    env.TRUSTROOTS_DEPLOYMENT_TIER === 'production' &&
    env.NODE_ENV === 'production' &&
    ['trustroots.org', 'www.trustroots.org'].includes(domain);
  const mode = env.TRUSTROOTS_MAIL_MODE || (production ? 'live' : 'capture');
  if (!['live', 'capture', 'allowlist'].includes(mode)) {
    throw new Error(
      'Invalid TRUSTROOTS_MAIL_MODE. Use capture, allowlist or live.',
    );
  }
  if (mode === 'live') {
    if (!production)
      throw new Error(
        'Live mail requires the explicit production tier and production site domain.',
      );
    return 'live';
  }

  if (mode === 'capture') {
    // Replace all transport options, including any inherited SMTP credentials.
    config.mailer.options = { jsonTransport: true };
    config.supportInbox.imap.enabled = false;
    config.supportInbox.imap.user = '';
    config.supportInbox.imap.password = '';
    return 'capture';
  }

  const recipients = (env.TRUSTROOTS_MAIL_RECIPIENT_ALLOWLIST || '')
    .split(',')
    .map(address)
    .filter(Boolean);
  const mailbox = address(env.TRUSTROOTS_SUPPORT_TEST_MAILBOX || '');
  if (
    !recipients.length ||
    !recipients.every(isAddress) ||
    !isAddress(mailbox)
  ) {
    throw new Error(
      'Allowlisted mail requires explicit valid test recipients and a test mailbox.',
    );
  }
  if (mailbox === 'support@trustroots.org') {
    throw new Error(
      'The test mailbox must differ from the production support mailbox.',
    );
  }
  if (
    config.supportInbox.imap.enabled &&
    address(config.supportInbox.imap.user) !== mailbox
  ) {
    throw new Error(
      'Test IMAP access must use the dedicated test mailbox account.',
    );
  }
  if (
    !config.supportInbox.imap.enabled &&
    address(config.supportInbox.imap.user) !== mailbox
  ) {
    config.supportInbox.imap.user = '';
    config.supportInbox.imap.password = '';
  }
  config.supportEmail = mailbox;
  config.mailer.from = mailbox;
  config.supportInbox.fromAddress = mailbox;
  config.supportInbox.fromName = 'Trustroots Support [test]';

  const smtpOptions = config.mailer.options;
  const allowed = new Set(recipients);
  config.mailer.options = {
    name: 'trustroots-allowlisted-mail',
    version: '1.0.0',
    send(mail, done) {
      // Use the actual SMTP envelope, including Bcc and explicit overrides.
      const envelope = mail.message.getEnvelope();
      if (
        !envelope.to.length ||
        envelope.to.some(recipient => !allowed.has(address(recipient))) ||
        address(envelope.from || '') !== mailbox
      ) {
        done(
          Object.assign(
            new Error(
              'Test mail was blocked by the recipient or sender policy.',
            ),
            { code: 'EMAIL_POLICY_BLOCKED' },
          ),
        );
        return;
      }
      let transport: MailTransport;
      try {
        transport = createTransport(smtpOptions);
      } catch {
        done(
          Object.assign(
            new Error('Test mail transport configuration is invalid.'),
            { code: 'EMAIL_POLICY_TRANSPORT' },
          ),
        );
        return;
      }
      transport.sendMail(mail.data, (error, info) => {
        transport.close();
        done(error, info);
      });
    },
  };
  return 'allowlist';
}
