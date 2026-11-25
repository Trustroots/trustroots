import { promisify } from 'node:util';
import type { Agenda, Job } from 'agenda';
import { subDays, sub } from 'date-fns';
import mongoose, { type Types } from 'mongoose';

import config from '../../../../config/config.mts';
import sendEmailJob from '../../../core/server/jobs/send-email.server.job.mts';
import emailService from '../../../core/server/services/email.server.service.mts';
import userRolesService from '../../../users/server/services/user-roles.server.service.mts';
import type { ExperienceRecord } from '../models/experiences.server.model.mts';

export const queueExperienceReplyRemindersJob =
  'queue experience reply reminders';
export const sendExperienceReplyReminderJob = 'send experience reply reminder';

interface ReminderData {
  experienceId: string;
}

interface ReminderMember {
  username?: string;
  email?: string;
  public?: boolean;
  roles?: string[];
  blocked?: Types.ObjectId[];
}

const sendEmail = promisify(sendEmailJob);

function pendingInReplyWindow(now: Date) {
  return {
    public: false,
    removedAt: { $exists: false },
    created: {
      $gt: sub(now, config.limits.timeToReplyExperience),
      $lte: subDays(now, 11),
    },
  };
}

export async function queueExperienceReplyReminders(
  agenda: Pick<Agenda, 'create'>,
) {
  if (!config.featureFlags.reference) return;

  const now = new Date();
  const experiences = mongoose.model<ExperienceRecord>('Experience');
  const due = await experiences
    .find({
      ...pendingInReplyWindow(now),
      replyReminderQueuedAt: { $exists: false },
    })
    .sort({ created: 1 })
    .limit(100)
    .select(
      // Stryker disable next-line StringLiteral: the scheduler only reads the ID even when more fields are fetched.
      '_id',
    )
    .lean();

  for (const experience of due) {
    const experienceId = String(experience._id);
    await agenda
      .create<ReminderData>(sendExperienceReplyReminderJob, { experienceId })
      .schedule(now)
      .unique({ 'data.experienceId': experienceId }, { insertOnly: true })
      .save();
    await experiences.updateOne(
      { _id: experience._id },
      { $set: { replyReminderQueuedAt: now } },
    );
  }
}

export async function sendExperienceReplyReminder(job: Job<ReminderData>) {
  if (!config.featureFlags.reference || !job.attrs.data) return;

  const experiences = mongoose.model<ExperienceRecord>('Experience');
  const experience = await experiences
    .findOne({
      _id: job.attrs.data.experienceId,
      ...pendingInReplyWindow(new Date()),
    })
    .select(
      // Stryker disable next-line StringLiteral: the job only reads the pair even when more fields are fetched.
      'userFrom userTo',
    )
    .lean();
  if (!experience) return;

  const { userFrom, userTo } = experience;
  // A removed reply still prevents the recipient from sharing another one.
  const hasReciprocalExperience = await experiences.exists({
    userFrom: userTo,
    userTo: userFrom,
  });
  if (hasReciprocalExperience) return;

  const members = await mongoose
    .model<ReminderMember>('User')
    .find(
      { _id: { $in: [userFrom, userTo] }, public: true },
      // Stryker disable next-line StringLiteral: the delivery checks only read these fields even with a wider projection.
      'username email roles blocked',
    )
    .lean();
  const author = members.find(member => member._id.equals(userFrom));
  const recipient = members.find(member => member._id.equals(userTo));
  if (
    !author?.username ||
    !recipient?.email ||
    userRolesService.hasRestrictedMessagingRole(author) ||
    userRolesService.hasRestrictedMessagingRole(recipient) ||
    author.blocked?.some(id => id.equals(userTo)) ||
    recipient.blocked?.some(id => id.equals(userFrom))
  )
    return;

  const campaign = 'experience-reply-reminder';
  const shareUrl = `${config.https ? 'https' : 'http'}://${config.domain}/profile/${encodeURIComponent(author.username)}/experiences/new`;
  const email = await promisify(emailService.renderEmail)(
    campaign,
    emailService.addEmailBaseTemplateParams({
      subject: 'You can still share your Experience on Trustroots',
      email: recipient.email,
      username: recipient.username,
      shareUrl,
      sparkpostCampaign: campaign,
    }),
  );
  if (!email) throw new Error('Experience reminder email did not render.');
  await sendEmail({ attrs: { ...job.attrs, data: email } });
}
