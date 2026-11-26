import type { Agenda, Job } from 'agenda';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import sinon from 'sinon';
import { expect, it, vi } from 'vitest';

import config from '../../../../config/config.mts';
import createSendEmailJob from '../../../core/server/jobs/send-email.server.job.mts';
import { canDeliverNotificationEmail } from '../../../users/server/services/notification-email.server.service.mts';
import { deliverSignupReminder } from '../../../users/server/services/signup-reminder.server.service.mts';
import emailService, {
  type RenderedEmail,
} from '../../../core/server/services/email.server.service.mts';
import * as utils from '../../../../testutils/server/data.server.testutil.mts';
import {
  queueExperienceReplyReminders,
  sendExperienceReplyReminder,
  sendExperienceReplyReminderJob,
} from '../../server/jobs/experience-reply-reminder.server.job.mts';

const sendMail = vi.fn((_email: RenderedEmail, done: () => void) => done());

const now = new Date('2026-11-20T12:00:00.000Z');
const day = 24 * 60 * 60 * 1000;
const members = mongoose.connection.collection('users');
const experiences = mongoose.connection.collection('experiences');

async function makePair() {
  const author = new mongoose.Types.ObjectId();
  const recipient = new mongoose.Types.ObjectId();
  const authorUsername = `example-author-${String(author).slice(-8)}`;
  const recipientEmail = `${recipient}@example.org`;
  await members.insertMany([
    {
      _id: author,
      username: authorUsername,
      email: `${author}@example.org`,
      public: true,
      roles: [],
    },
    {
      _id: recipient,
      username: `example-recipient-${String(recipient).slice(-8)}`,
      email: recipientEmail,
      public: true,
      roles: [],
    },
  ]);
  return { author, recipient, authorUsername, recipientEmail };
}

async function experienceAt(
  age: number,
  overrides: Record<string, unknown> = {},
) {
  const pair = await makePair();
  const { author, recipient } = pair;
  const { insertedId } = await experiences.insertOne({
    userFrom: author,
    userTo: recipient,
    created: new Date(now.getTime() - age * day),
    public: false,
    feedbackPublic: 'Sensitive feedback for this test.',
    ...overrides,
  });
  return { id: insertedId, ...pair };
}

function deliver(experienceId?: string) {
  const job = {
    attrs: {
      _id: new mongoose.Types.ObjectId(),
      data: experienceId ? { experienceId } : undefined,
    },
  };
  return sendExperienceReplyReminder(
    createSendEmailJob({ canDeliverNotificationEmail, deliverSignupReminder }),
    job as unknown as Job<{ experienceId: string }>,
  );
}

function makeQueue() {
  const save = vi.fn().mockResolvedValue(undefined);
  const queuedJob = {
    schedule: vi.fn().mockReturnThis(),
    unique: vi.fn().mockReturnThis(),
    save,
  };
  const create = vi.fn().mockReturnValue(queuedJob);
  return { agenda: { create } as unknown as Agenda, queuedJob, create, save };
}

describe('day-11 Experience reply reminders', () => {
  beforeEach(() => {
    sinon.useFakeTimers({ now, toFake: ['Date'] });
    sendMail.mockClear();
    sinon.stub(nodemailer, 'createTransport').returns({
      sendMail,
      close: vi.fn(),
    } as unknown as ReturnType<typeof nodemailer.createTransport>);
  });
  afterEach(() => sinon.restore());
  afterEach(utils.clearDatabase);

  it('queues each due record once, excluding earlier, expired, removed and public records', async () => {
    const second = await experienceAt(11);
    const first = await experienceAt(13);
    await experienceAt(10.9);
    await experienceAt(14);
    await experienceAt(12, { removedAt: now });
    await experienceAt(12, { public: true });
    const { agenda, queuedJob, create, save } = makeQueue();

    await queueExperienceReplyReminders(agenda);
    await queueExperienceReplyReminders(agenda);

    expect(create.mock.calls).toEqual([
      [sendExperienceReplyReminderJob, { experienceId: String(first.id) }],
      [sendExperienceReplyReminderJob, { experienceId: String(second.id) }],
    ]);
    expect(queuedJob.schedule).toHaveBeenCalledWith(now);
    expect(queuedJob.unique).toHaveBeenCalledWith(
      { 'data.experienceId': String(first.id) },
      { insertOnly: true },
    );
    expect(save).toHaveBeenCalledTimes(2);
    expect(await experiences.findOne({ _id: first.id })).toHaveProperty(
      'replyReminderQueuedAt',
      now,
    );
  });

  it('limits each scan to 100 pending records and resumes from the rest', async () => {
    await experiences.insertMany(
      Array.from({ length: 101 }, () => ({
        userFrom: new mongoose.Types.ObjectId(),
        userTo: new mongoose.Types.ObjectId(),
        public: false,
        created: new Date(now.getTime() - 12 * day),
      })),
    );
    const { agenda, create } = makeQueue();
    await queueExperienceReplyReminders(agenda);
    expect(create).toHaveBeenCalledTimes(100);
    await queueExperienceReplyReminders(agenda);
    expect(create).toHaveBeenCalledTimes(101);
  });

  it('leaves the record eligible for retry when queue persistence fails', async () => {
    const { id } = await experienceAt(12);
    const { agenda, save } = makeQueue();
    save.mockRejectedValueOnce(new Error('Queue write failed'));
    await expect(queueExperienceReplyReminders(agenda)).rejects.toThrow(
      'Queue write failed',
    );
    expect(await experiences.findOne({ _id: id })).not.toHaveProperty(
      'replyReminderQueuedAt',
    );
    await queueExperienceReplyReminders(agenda);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])(
    'sends the sharing link to the current recipient without feedback (HTTPS %s)',
    async https => {
      sinon.stub(config, 'https').value(https);
      const { id, authorUsername, recipientEmail } = await experienceAt(11);
      await deliver(String(id));
      expect(sendMail).toHaveBeenCalledTimes(1);
      const [email] = sendMail.mock.calls[0];
      expect(email).toMatchObject({
        to: { address: recipientEmail },
        subject: 'You can still share your Experience on Trustroots',
        text: expect.stringContaining(
          `${https ? 'https' : 'http'}://${config.domain}/profile/${authorUsername}/experiences/new`,
        ),
      });
      expect(email.html).toBeUndefined();
      expect(email.text).not.toContain('Sensitive feedback');
    },
  );

  it('skips delivery when a removed reciprocal Experience prevents another reply', async () => {
    const { id, author, recipient } = await experienceAt(12);
    await experiences.insertOne({
      userFrom: recipient,
      userTo: author,
      removedAt: now,
    });
    await deliver(String(id));
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not substitute another record when the queued Experience is missing', async () => {
    await experienceAt(12);
    await deliver(String(new mongoose.Types.ObjectId()));
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('stops delivery after a reply, publication, expiry or removal', async () => {
    const { id, author, recipient } = await experienceAt(12);
    await experiences.insertOne({ userFrom: recipient, userTo: author });
    await deliver(String(id));
    await deliver(String((await experienceAt(14)).id));
    await deliver(String((await experienceAt(10)).id));
    await deliver(String((await experienceAt(12, { public: true })).id));
    await deliver(String((await experienceAt(12, { removedAt: now })).id));
    await deliver();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('fails the job when the renderer does not provide an email', async () => {
    const { id } = await experienceAt(12);
    sinon
      .stub(emailService, 'renderEmail')
      .callsFake((_template, _params, callback) => callback(null));
    await expect(deliver(String(id))).rejects.toThrow(
      'Experience reminder email did not render.',
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([
    ['author', { public: false }],
    ['author', { username: null }],
    ['author', { roles: ['shadowban'] }],
    ['recipient', { public: false }],
    ['recipient', { email: null }],
    ['recipient', { roles: ['suspended'] }],
  ] as const)(
    'skips delivery when the %s account is unavailable or restricted (%j)',
    async (side, update) => {
      const pair = await experienceAt(12);
      await members.updateOne({ _id: pair[side] }, { $set: update });
      await deliver(String(pair.id));
      expect(sendMail).not.toHaveBeenCalled();
    },
  );

  it.each(['author', 'recipient'] as const)(
    'skips delivery when the %s has blocked the other member',
    async side => {
      const pair = await experienceAt(12);
      const other = side === 'author' ? 'recipient' : 'author';
      await members.updateOne(
        { _id: pair[side] },
        { $set: { blocked: [new mongoose.Types.ObjectId(), pair[other]] } },
      );
      await deliver(String(pair.id));
      expect(sendMail).not.toHaveBeenCalled();
    },
  );

  it('leaves the queue and mail untouched while Experiences are disabled', async () => {
    const { id } = await experienceAt(12);
    sinon.stub(config.featureFlags, 'reference').value(false);
    const { agenda, create } = makeQueue();
    await queueExperienceReplyReminders(agenda);
    await deliver(String(id));
    expect(create).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
