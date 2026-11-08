/**
 * What each transactional email sends: sender, subject, SparkPost campaign
 * and the exact tracked links in its HTML body.
 */
const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const sinon: typeof import('sinon') = require('sinon');
const winston: typeof import('winston') = require('winston');
const config: typeof import('../../../../../config/config.mts').default = require('./../../../../../config/config.mts');
const agenda: {
  now(type: string, data: unknown): Promise<unknown>;
} = require('./../../../../../config/lib/agenda.mjs');

type Address = { name?: string; address?: string };
type SentEmail = {
  to: Address;
  from: string | Address;
  subject: string;
  text: string;
  html?: string;
  replyTo?: Address;
  headers: Record<string, string>;
};
type EmailService = Record<string, (...args: never[]) => unknown> & {
  addEmailBaseTemplateParams(params: unknown): Record<string, unknown>;
  renderEmail(
    template: string,
    params: Record<string, unknown>,
    callback: (error: Error | null, email?: SentEmail) => void,
  ): void;
};

const emailService: EmailService = require('./../../../server/services/email.server.service.mjs');

const site = 'http://' + config.domain;
const defaultFrom = 'Trustroots <' + config.mailer.from + '>';
const supportFrom = 'Trustroots Support <' + config.supportEmail + '>';

function tracked(path: string, campaign: string, content?: string) {
  const separator = path.includes('?') ? '&' : '?';
  const [base, hash] = path.split('#');
  return (
    site +
    base +
    separator +
    `utm_source=transactional-email&utm_medium=email&utm_campaign=${campaign}` +
    (content ? `&utm_content=${content}` : '') +
    (hash ? '#' + hash : '')
  );
}

/** Header, support and footer links every templated email carries. */
function frame(campaign: string, profile?: string) {
  return [
    tracked('/', campaign, 'email-header'),
    tracked('/support', campaign, 'email-support'),
    ...(profile
      ? [tracked('/profile/' + profile, campaign, 'email-profile')]
      : []),
    tracked('/', campaign, 'email-footer'),
  ];
}

function links(email: SentEmail): string[] {
  return [
    ...new Set(
      [...(email.html ?? '').matchAll(/href="([^"]*)"/g)].map(match =>
        match[1].replace(/&amp;/g, '&'),
      ),
    ),
  ].sort();
}

function campaignHeader(email: SentEmail): unknown {
  return JSON.parse(email.headers['X-MSYS-API']);
}

const member = {
  _id: 'member-id',
  displayName: 'Ann Example',
  firstName: 'Ann',
  username: 'ann',
  email: 'ann@example.test',
  emailTemporary: 'new@example.test',
  emailToken: 'email-token',
  resetPasswordToken: 'reset-token',
  removeProfileToken: 'remove-token',
  description: '',
};
const other = {
  _id: 'other-id',
  displayName: 'Bo Example',
  firstName: 'Bo',
  username: 'bo',
  email: 'bo@example.test',
  roles: ['user'],
};

describe('Service: email (sent content)', function () {
  let sent: SentEmail[];

  beforeEach(function () {
    sent = [];
    sinon.stub(agenda, 'now').callsFake(async (type, data) => {
      assert.equal(type, 'send email');
      sent.push(JSON.parse(JSON.stringify(data)));
      return {};
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  async function send(name: string, ...args: unknown[]): Promise<SentEmail> {
    await new Promise<void>((resolve, reject) =>
      (emailService[name] as (...values: unknown[]) => void)(
        ...args,
        (error?: Error | null) => (error ? reject(error) : resolve()),
      ),
    );
    assert.equal(sent.length, 1, name);
    return sent[0];
  }

  type Expectation = {
    name: string;
    args: unknown[];
    to: Address;
    from?: string;
    subject: string;
    campaign?: string;
    links: string[];
  };

  const expectations: Expectation[] = [
    {
      name: 'sendMessagesUnread',
      args: [
        other,
        member,
        { notificationCount: 0, messages: [{ content: 'hi' }] },
      ],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Bo Example wrote you from Trustroots',
      campaign: 'messages-unread',
      links: [
        ...frame('messages-unread'),
        tracked('/profile/bo', 'messages-unread', 'profile'),
        tracked('/messages/bo', 'messages-unread', 'reply-to'),
      ],
    },
    {
      name: 'sendConfirmContact',
      args: [member, other, { _id: 'contact-id' }, '<p>hello</p>', 'hello'],
      to: { name: 'Bo Example', address: 'bo@example.test' },
      subject: 'Confirm contact',
      campaign: 'confirm-contact',
      links: [
        ...frame('confirm-contact'),
        tracked('/profile/ann', 'confirm-contact', 'profile'),
        tracked(
          '/contact-confirm/contact-id',
          'confirm-contact',
          'confirm-contact',
        ),
      ],
    },
    {
      name: 'sendRemoveProfile',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Confirm removing your Trustroots profile',
      campaign: 'remove-profile',
      links: [
        ...frame('remove-profile'),
        tracked('/remove/remove-token', 'remove-profile'),
        site + '/profile/edit/account#remove',
      ],
    },
    {
      name: 'sendRemoveProfileConfirmed',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Your Trustroots profile has been removed',
      campaign: 'remove-profile-confirmed',
      links: frame('remove-profile-confirmed'),
    },
    {
      name: 'sendResetPassword',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Password Reset',
      campaign: 'reset-password',
      links: [
        ...frame('reset-password'),
        tracked('/api/auth/reset/reset-token', 'reset-password'),
      ],
    },
    {
      name: 'sendResetPasswordConfirm',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Your password has been changed',
      campaign: 'reset-password-confirm',
      links: [
        ...frame('reset-password-confirm'),
        tracked('/password/forgot', 'reset-password-confirm'),
      ],
    },
    {
      name: 'sendChangeEmailConfirmation',
      args: [member],
      to: { name: 'Ann Example', address: 'new@example.test' },
      subject: 'Confirm email change',
      campaign: 'confirm-email',
      links: [
        ...frame('confirm-email'),
        tracked('/confirm-email/email-token', 'confirm-email'),
      ],
    },
    {
      name: 'sendSignupEmailConfirmation',
      args: [member],
      to: { name: 'Ann Example', address: 'new@example.test' },
      subject: 'Confirm Email',
      campaign: 'confirm-email',
      links: [
        ...frame('confirm-email'),
        tracked('/confirm-email/email-token?signup=true', 'confirm-email'),
      ],
    },
    {
      name: 'sendFlaggedSignupAlert',
      args: [member, ['spam']],
      to: { name: 'Trustroots Support', address: config.supportEmail },
      from: supportFrom,
      subject: 'Signup matched safety-review keywords',
      campaign: 'flagged-signup-alert',
      links: [],
    },
    {
      name: 'sendSupportRequest',
      args: [
        { name: 'Ann', address: 'ann@example.test' },
        { category: 'other', message: 'Hello', username: 'ann' },
      ],
      to: { name: 'Trustroots Support', address: config.supportEmail },
      from: supportFrom,
      subject: 'Support request [Other] from ann',
      campaign: 'support-request',
      links: [],
    },
    {
      name: 'sendSignupEmailReminder',
      args: [member],
      to: { name: 'Ann Example', address: 'new@example.test' },
      subject: 'Complete your signup to Trustroots',
      campaign: 'signup-reminder',
      links: [
        ...frame('signup-reminder'),
        tracked('/confirm-email/email-token?signup=true', 'signup-reminder'),
      ],
    },
    {
      name: 'sendWelcomeSequenceFirst',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: '👋 Welcome to Trustroots Ann!',
      campaign: 'welcome-sequence-first',
      links: [
        ...frame('welcome-sequence-first', 'ann'),
        tracked('/profile/edit', 'welcome-sequence-first'),
        tracked('/faq', 'welcome-sequence-first'),
      ],
    },
    {
      name: 'sendWelcomeSequenceSecond',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'Meet new people at Trustroots, Ann',
      campaign: 'welcome-sequence-second',
      links: [
        ...frame('welcome-sequence-second', 'ann'),
        tracked('/offer/meet', 'welcome-sequence-second'),
        'https://www.facebook.com/trustroots.org/?ref=welcome-email',
        'https://www.facebook.com/groups/trustroots/?ref=welcome-email',
        'https://twitter.com/trustroots',
        'https://www.instagram.com/trustroots/',
      ],
    },
    {
      name: 'sendWelcomeSequenceThird',
      args: [member],
      to: { name: 'Ann Example', address: 'ann@example.test' },
      subject: 'How is it going, Ann?',
      campaign: 'welcome-sequence-third-fill-profile',
      links: [
        ...frame('welcome-sequence-third-fill-profile', 'ann'),
        tracked('/profile/edit', 'welcome-sequence-third-fill-profile'),
        'https://www.facebook.com/trustroots.org/?ref=welcome-email',
        'https://www.facebook.com/groups/trustroots/?ref=welcome-email',
        'https://twitter.com/trustroots',
        'https://www.instagram.com/trustroots/',
      ],
    },
    {
      name: 'sendExperienceNotificationFirst',
      args: [other, member],
      to: { address: 'ann@example.test' },
      subject: 'Bo Example shared their experience with you',
      links: [
        ...frame('transactional-email', 'ann'),
        tracked('/profile/bo', 'experience-notification-first', 'from-profile'),
        tracked(
          '/profile/bo/experiences/new',
          'experience-notification-first',
          'give-experience',
        ),
      ],
    },
    {
      name: 'sendExperienceNotificationSecond',
      args: [other, member, { _id: 'experience-id' }],
      to: { address: 'ann@example.test' },
      subject: 'Bo Example shared also their experience with you',
      links: [
        ...frame('transactional-email', 'ann'),
        tracked(
          '/profile/bo',
          'experience-notification-second',
          'from-profile',
        ),
        tracked(
          '/profile/ann/experiences#experience-id',
          'experience-notification-second',
          'see-experiences',
        ),
      ],
    },
  ];

  for (const expected of expectations) {
    it(`${expected.name} sends the expected sender, subject, campaign and links`, async function () {
      const email = await send(expected.name, ...expected.args);
      assert.deepEqual(email.to, expected.to);
      if (expected.name.startsWith('sendWelcomeSequence')) {
        assert.equal((email.from as Address).address, config.supportEmail);
        assert.ok(
          config.supportVolunteerNames.includes((email.from as Address).name!),
        );
      } else {
        assert.equal(email.from, expected.from ?? defaultFrom);
      }
      assert.equal(email.subject, expected.subject);
      assert.deepEqual(campaignHeader(email), {
        options: { transactional: true },
        ...(expected.campaign ? { campaign_id: expected.campaign } : {}),
      });
      assert.deepEqual(links(email), [...expected.links].sort());
    });
  }

  it('sends host reactivation without a survey link when none is configured', async function () {
    sinon.stub(config, 'surveyReactivateHosts').value(false);
    const email = await send('sendReactivateHosts', member);
    assert.equal(email.subject, 'Ann, start hosting on Trustroots again?');
    assert.deepEqual(campaignHeader(email), {
      options: { transactional: true },
      campaign_id: 'reactivate-hosts',
    });
    assert.deepEqual(
      links(email),
      [
        ...frame('reactivate-hosts'),
        tracked('/offer', 'reactivate-hosts'),
      ].sort(),
    );
    assert.ok(!email.text.includes('survey'), email.text);
  });

  it('sends host reactivation with a tracked survey link when configured', async function () {
    sinon
      .stub(config, 'surveyReactivateHosts')
      .value('https://survey.example.test/reactivate');
    const email = await send('sendReactivateHosts', member);
    assert.ok(
      links(email).includes(
        'https://survey.example.test/reactivate?utm_source=transactional-email&utm_medium=email&utm_campaign=reactivate-hosts',
      ),
    );
    assert.ok(email.text.includes('https://survey.example.test/reactivate'));
  });

  it('sends unread notifications from members without roles under their own name', async function () {
    const withoutRoles = { ...other, roles: undefined };
    const email = await send('sendMessagesUnread', withoutRoles, member, {
      notificationCount: 0,
      messages: [{ content: 'hi' }],
    });
    assert.equal(email.from, defaultFrom);
  });

  it('defangs every form of link in unread message previews', async function () {
    const email = await send('sendMessagesUnread', other, member, {
      notificationCount: 0,
      messages: [
        { content: 'One <a class="x" href="https://one.example/a">label</a>.' },
        { content: 'Two <a href = "https://two.example/b">label</a>.' },
        { content: 'Three <a href= "https://three.example/c">label</a>.' },
        {
          content:
            'Four <a href="https://four.example/d" target="_blank">label</a>.',
        },
        { content: 'Five <a href="https://five.example/e">my page</a>.' },
        { content: 'Write to member@example.org or call 555.666.7777.' },
      ],
    });
    for (const body of [email.html!, email.text]) {
      for (const expected of [
        'One https[:]//one[.]example/a.',
        'Two https[:]//two[.]example/b.',
        'Three https[:]//three[.]example/c.',
        'Four https[:]//four[.]example/d.',
        'Five https[:]//five[.]example/e.',
        'Write to member@example.org or call 555.666.7777.',
      ]) {
        assert.ok(body.includes(expected), expected);
      }
      assert.ok(!body.includes('label'));
    }
  });

  it('picks the welcome topic from the plain-text profile length', async function () {
    const atMinimum = await send('sendWelcomeSequenceThird', {
      ...member,
      description: `<p>${'a'.repeat(config.profileMinimumLength)}</p>`,
    });
    assert.deepEqual(campaignHeader(atMinimum), {
      options: { transactional: true },
      campaign_id: 'welcome-sequence-third-feedback',
    });
    sent = [];
    const short = await send('sendWelcomeSequenceThird', {
      ...member,
      description: `<p>${'a'.repeat(config.profileMinimumLength - 1)}</p>`,
    });
    assert.deepEqual(campaignHeader(short), {
      options: { transactional: true },
      campaign_id: 'welcome-sequence-third-fill-profile',
    });
  });

  it('counts this signup reminder after the ones already sent', async function () {
    const email = await send('sendSignupEmailReminder', {
      ...member,
      publicReminderCount: 1,
    });
    assert.ok(
      email.text.includes(
        `This is a reminder 2/${config.limits.maxSignupReminders}`,
      ),
      email.text,
    );
  });

  describe('addEmailBaseTemplateParams', function () {
    it('logs and returns nothing for values that are not objects', function () {
      const log = sinon.stub(winston, 'log');
      assert.deepEqual(emailService.addEmailBaseTemplateParams('text'), {});
      assert.deepEqual(emailService.addEmailBaseTemplateParams(null), {});
      const calls = log
        .getCalls()
        .map(call => call.args.slice(0, 2))
        .filter(([level]) => level === 'error');
      assert.deepEqual(calls, [
        [
          'error',
          'addEmailBaseTemplateParams: requires param to be Object. No URL parameters added.',
        ],
        [
          'error',
          'addEmailBaseTemplateParams: requires param to be Object. No URL parameters added.',
        ],
      ]);
    });

    it('adds plain and tracked base links, with a profile link for a username', function () {
      sinon.stub(config, 'https').value(true);
      const secure = 'https://' + config.domain;
      const track = (url: string, content: string) =>
        `${url}?utm_source=transactional-email&utm_medium=email&utm_campaign=transactional-email&utm_content=${content}`;
      assert.deepEqual(
        emailService.addEmailBaseTemplateParams({ username: 'ann' }),
        {
          username: 'ann',
          urlSupportPlainText: secure + '/support',
          footerUrlPlainText: secure,
          headerUrl: track(secure + '/', 'email-header'),
          footerUrl: track(secure + '/', 'email-footer'),
          supportUrl: track(secure + '/support', 'email-support'),
          profileUrl: track(secure + '/profile/ann', 'email-profile'),
        },
      );
      assert.equal(
        'profileUrl' in emailService.addEmailBaseTemplateParams({}),
        false,
      );
    });
  });

  describe('renderEmail', function () {
    function render(params: Record<string, unknown>): Promise<SentEmail> {
      return new Promise((resolve, reject) =>
        emailService.renderEmail('support-request', params, (error, email) =>
          error ? reject(error) : resolve(email!),
        ),
      );
    }

    it('returns a plain-text email from the default sender without optional fields', async function () {
      const email = await render({
        name: 'Ann',
        email: 'ann@example.test',
        subject: 'Fictional subject',
        skipHtmlTemplate: true,
        request: {
          categoryLabel: 'Other',
          message: 'Call +1 555 666 7777 or visit https://example.test/page',
        },
      });
      assert.deepEqual(Object.keys(email).sort(), [
        'from',
        'headers',
        'subject',
        'text',
        'to',
      ]);
      assert.equal(email.from, defaultFrom);
      assert.deepEqual(campaignHeader(email), {
        options: { transactional: true },
      });
      assert.ok(
        email.text.includes(
          'Call +1 555 666 7777 or visit <https://example.test/page>',
        ),
        email.text,
      );
    });
  });
});
