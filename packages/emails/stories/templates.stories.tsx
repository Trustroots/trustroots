import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { EmailPreview } from './email-preview.tsx';
import confirmContact from '../src/templates/confirm-contact.tsx';
import emailConfirmation from '../src/templates/email-confirmation.tsx';
import experienceNotificationFirst from '../src/templates/experience-notification-first.tsx';
import experienceNotificationSecond from '../src/templates/experience-notification-second.tsx';
import messagesDigest from '../src/templates/messages-digest.tsx';
import messagesUnread from '../src/templates/messages-unread.tsx';
import reactivateHosts from '../src/templates/reactivate-hosts.tsx';
import removeProfile from '../src/templates/remove-profile.tsx';
import removeProfileConfirmed from '../src/templates/remove-profile-confirmed.tsx';
import resetPassword from '../src/templates/reset-password.tsx';
import resetPasswordConfirm from '../src/templates/reset-password-confirm.tsx';
import signup from '../src/templates/signup.tsx';
import signupReminder from '../src/templates/signup-reminder.tsx';
import welcomeSequenceFirst from '../src/templates/welcome-sequence-first.tsx';
import welcomeSequenceSecond from '../src/templates/welcome-sequence-second.tsx';
import welcomeSequenceThird from '../src/templates/welcome-sequence-third.tsx';

export default {
  title: 'Emails',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

function email<P extends object>(
  Email: ((props: P) => ReactNode) & { PreviewProps: NoInfer<P> },
  props: Partial<P> = {},
): StoryObj {
  return {
    render: () => (
      <EmailPreview email={<Email {...Email.PreviewProps} {...props} />} />
    ),
  };
}

const longName = 'Maximiliana Alexandrina Wolfeschlegelsteinhausenberger';

export const ConfirmContact = email(confirmContact);
export const ConfirmContactWithoutMessage = email(confirmContact, {
  messageHTML: false,
});
export const EmailConfirmation = email(emailConfirmation);
export const ExperienceNotificationFirst = email(experienceNotificationFirst);
export const ExperienceNotificationSecond = email(experienceNotificationSecond);
export const MessagesDigest = email(messagesDigest);
export const MessagesUnread = email(messagesUnread);
export const MessagesUnreadOneFromLongName = email(messagesUnread, {
  userFromName: longName,
  messageCount: 1,
  messages: [
    { content: `<p>${'A long message without breaks. '.repeat(20)}</p>` },
  ],
  unsubscribeUrl: undefined,
});
export const ReactivateHosts = email(reactivateHosts);
export const ReactivateHostsWithoutSurvey = email(reactivateHosts, {
  urlSurvey: false,
  unsubscribeUrl: undefined,
});
export const RemoveProfile = email(removeProfile);
export const RemoveProfileConfirmed = email(removeProfileConfirmed);
export const ResetPassword = email(resetPassword);
export const ResetPasswordConfirm = email(resetPasswordConfirm);
export const Signup = email(signup);
export const SignupLongName = email(signup, {
  name: longName,
  email: 'maximiliana.alexandrina.wolfeschlegelsteinhausenberger@example.org',
});
export const SignupReminder = email(signupReminder);
export const SignupReminderLast = email(signupReminder, { reminderCount: 3 });
export const WelcomeSequenceFirst = email(welcomeSequenceFirst);
export const WelcomeSequenceSecond = email(welcomeSequenceSecond);
export const WelcomeSequenceThird = email(welcomeSequenceThird);
export const WelcomeSequenceThirdFeedback = email(welcomeSequenceThird, {
  topic: 'feedback',
});
