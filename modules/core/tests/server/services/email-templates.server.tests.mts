import { expect } from 'vitest';
import sinon from 'sinon';
import config from './../../../../../config/config.mts';
import agenda from './../../../../../config/lib/agenda.mts';
import emailService, {
  sendMessageDigest,
} from './../../../server/services/email.server.service.mts';

/**
 * The exact text and HTML of every transactional email, so copy and markup
 * changes show up in review. Run with `-u` to accept an intended change.
 */

type Rendered =
  import('../../../server/services/email.server.service.mts').RenderedEmail;
type Send = (callback: (error?: unknown) => void) => void;

const snapshots = './__snapshots__/emails/';
const created = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const ada = {
  _id: '5f0c1a2b3c4d5e6f7a8b9c0d',
  username: 'ada_l',
  displayName: 'Ada & "Bea" <Lov\\elace>',
  firstName: "Ad'a",
  email: 'ada@example.test',
  emailTemporary: 'ada.new@example.test',
  emailToken: 'email-token',
  resetPasswordToken: 'reset-token',
  removeProfileToken: 'remove-token',
  description: '',
  created,
};
const ben = {
  _id: '5f0c1a2b3c4d5e6f7a8b9c0e',
  username: 'ben',
  displayName: 'Ben Fictional',
  firstName: 'Ben',
  email: 'ben@example.test',
  description: 'x'.repeat(200),
};
const noId = { ...ada, _id: undefined };
const admin = { ...ben, roles: ['user', 'admin'] };
const build = {
  committedAt: '2026-11-01 10:00',
  shortCommit: 'abc1234',
  commitUrl: 'https://example.test/commit/abc1234',
};
const params = {
  subject: 'Bare',
  name: 'Bare',
  email: 'bare@example.test',
  urlConfirmPlainText: null,
};

const emails: Record<string, Send> = {
  'messages-unread-one': done =>
    emailService.sendMessagesUnread(
      ben,
      noId,
      {
        messages: [
          {
            content:
              '<p>Hi <b>there</b> &amp; welcome!<br>See https://www.trustroots.org/faq and <a href="https://elsewhere.example.test/x">this</a>.</p>',
          },
        ],
      },
      done,
    ),
  'messages-unread-many': done =>
    emailService.sendMessagesUnread(
      admin,
      ada,
      {
        notificationCount: 2,
        messages: [
          {
            content:
              '\n  First   line  \r\nnext <br> line\n\n\n\n<p>  second <i>line</i>  </p>',
          },
          {
            content:
              '<p>Visit trustroots.org/circles</p><h1>Head</h1><p>Second para &lt;script&gt;</p>',
          },
          { content: '<ul><li>one</li><li>two</li></ul>' },
        ],
      },
      done,
    ),
  'messages-digest': done =>
    sendMessageDigest(
      ada,
      'daily',
      [
        { username: 'ben', displayName: 'Ben <B> & Co', count: 3 },
        { username: 'cy d', displayName: "Cy's", count: 1 },
      ],
      done,
    ),
  'confirm-contact': done =>
    emailService.sendConfirmContact(
      ben,
      ada,
      { _id: 'contact-1' },
      '<p>Hello <b>friend</b></p>',
      done,
    ),
  'confirm-contact-without-message': done =>
    emailService.sendConfirmContact(
      ben,
      ada,
      { _id: 'contact-2' },
      false,
      done,
    ),
  'remove-profile': done => emailService.sendRemoveProfile(ada, done),
  'remove-profile-confirmed': done =>
    emailService.sendRemoveProfileConfirmed(ada, done),
  'reset-password': done => emailService.sendResetPassword(ada, done),
  'reset-password-confirm': done =>
    emailService.sendResetPasswordConfirm(ada, done),
  'email-confirmation': done =>
    emailService.sendChangeEmailConfirmation(ada, done),
  'email-change-notification': done =>
    emailService.sendEmailChangeNotification(
      ada,
      new Date('2026-11-26T06:00:00Z'),
      done,
    ),
  signup: done => emailService.sendSignupEmailConfirmation(ada, done),
  'flagged-signup-alert': done =>
    emailService.sendFlaggedSignupAlert(ada, ['scam', 'crypto <x>'], done),
  'support-request': done =>
    emailService.sendSupportRequest(
      'ada@example.test',
      {
        category: 'other',
        categoryLabel: 'Other',
        username: 'ada_l',
        displayName: 'Ada',
        email: 'ada@example.test',
        message: 'Line one\nLine <two> & three',
        reportMember: 'someone',
        authenticated: true,
        userAgent: 'Mozilla/5.0',
        userId: ada._id,
        profilePublic: true,
        signupDate: '2026-01-02',
        emailTemp: 'ada.tmp@example.test',
        build: { ...build, branch: 'feature/x' },
      },
      done,
    ),
  'support-request-on-main': done =>
    emailService.sendSupportRequest(
      'ada@example.test',
      {
        category: 'unknown',
        categoryLabel: 'Other',
        message: 'Help',
        build: { ...build, branch: 'main' },
      },
      done,
    ),
  'support-request-without-build': done =>
    emailService.sendSupportRequest(
      'ada@example.test',
      { category: 'other', categoryLabel: 'Other', message: 'Hi' },
      done,
    ),
  'signup-reminder': done =>
    emailService.sendSignupEmailReminder(
      { ...ada, publicReminderCount: 0 },
      done,
    ),
  'signup-reminder-last': done =>
    emailService.sendSignupEmailReminder(
      { ...ada, publicReminderCount: 2 },
      done,
    ),
  'reactivate-hosts': done => emailService.sendReactivateHosts(ada, done),
  'reactivate-hosts-without-survey': done => {
    sinon.stub(config, 'surveyReactivateHosts').value(false);
    emailService.sendReactivateHosts(noId, done);
  },
  'welcome-sequence-first': done =>
    emailService.sendWelcomeSequenceFirst(ada, done),
  'welcome-sequence-second': done =>
    emailService.sendWelcomeSequenceSecond(ada, done),
  'welcome-sequence-third-fill-profile': done =>
    emailService.sendWelcomeSequenceThird(ada, done),
  'welcome-sequence-third-feedback': done =>
    emailService.sendWelcomeSequenceThird(ben, done),
  'experience-notification-first': done =>
    emailService.sendExperienceNotificationFirst(ben, ada, done),
  'experience-notification-second': done =>
    emailService.sendExperienceNotificationSecond(
      ben,
      ada,
      { _id: 'exp-1' },
      done,
    ),
  'experience-reply-reminder': done =>
    emailService.renderEmailAndSend(
      'experience-reply-reminder',
      emailService.addEmailBaseTemplateParams({
        email: ada.email,
        shareUrl: 'http://localhost:3000/profile/ben/experiences/new',
      }),
      done,
    ),
  'message-throttle-alert': done =>
    emailService.renderEmailAndSend(
      'message-throttle-alert',
      {
        email: 'support@example.test',
        username: 'ada_l',
        adminProfileUrl: 'http://localhost:3000/admin/user?id=' + ada._id,
        reviewUrl:
          'http://localhost:3000/admin/support/message-reviews/0123456789abcdef01234567',
        timestamp: '2026-11-18T10:00:00.000Z',
        recipientCount: 12,
        limit: 10,
        windowMinutes: 60,
      },
      done,
    ),
  'without-base-params': done =>
    emailService.renderEmailAndSend('reset-password', params, done),
  'without-base-params-from-a-person': done =>
    emailService.renderEmailAndSend(
      'reset-password',
      { ...params, from: 'Ada <ada@example.test>' },
      done,
    ),
};

/**
 * One tag per line. Unless `full`, drops the layout tables and inlined
 * styles, which the layout snapshot pins once.
 */
function content(html: string, full = false) {
  const body = full
    ? html
    : html
        .replace(/<head>[\s\S]*<\/head>/, '')
        .replace(/<\/?(table|tbody|tr|td|center)\b[^>]*>/g, '')
        .replace(/ style="[^"]*"/g, '');
  return body.replace(/></g, '>\n<').replaceAll('\r', '\\r');
}

describe('Email templates', function () {
  let sent: Rendered[];

  beforeEach(function () {
    sent = [];
    sinon.stub(config, 'supportVolunteerNames').value(['Dee']);
    sinon.stub(agenda, 'now').callsFake((_name, email) => {
      sent.push(email as Rendered);
      return Promise.resolve({} as never);
    });
  });

  afterEach(function () {
    sinon.restore();
  });

  for (const [name, send] of Object.entries(emails)) {
    it(`renders ${name}`, async function () {
      await new Promise<void>((resolve, reject) =>
        send(error => (error ? reject(error) : resolve())),
      );
      const [email] = sent;
      await expect(email.text).toMatchFileSnapshot(`${snapshots}${name}.txt`);
      if (email.html)
        await expect(content(email.html)).toMatchFileSnapshot(
          `${snapshots}${name}.html`,
        );
    });
  }

  it('addresses the change notice to the current address without the pending address or token', async () => {
    await new Promise<void>((resolve, reject) =>
      emails['email-change-notification'](error =>
        error ? reject(error) : resolve(),
      ),
    );
    const [email] = sent;
    expect(email.to.address).toBe(ada.email);
    const rendered = email.text + email.html;
    expect(rendered).not.toContain(ada.emailTemporary);
    expect(rendered).not.toContain(ada.emailToken);
    expect(rendered).not.toContain('/confirm-email/');
    expect(rendered).toContain('2026-11-26 06:00 UTC');
  });

  it('renders the layout around the content', async function () {
    await new Promise(resolve => emails['messages-unread-many'](resolve));
    await new Promise(resolve => emails['remove-profile'](resolve));
    await expect(
      sent.map(email => content(email.html!, true)).join('\n'),
    ).toMatchFileSnapshot(`${snapshots}layout.html`);
  });
});
