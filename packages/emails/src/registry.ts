import type { ComponentType } from 'react';
import confirmContact from './templates/confirm-contact.tsx';
import emailConfirmation from './templates/email-confirmation.tsx';
import experienceNotificationFirst from './templates/experience-notification-first.tsx';
import experienceNotificationSecond from './templates/experience-notification-second.tsx';
import messagesDigest from './templates/messages-digest.tsx';
import messagesUnread from './templates/messages-unread.tsx';
import reactivateHosts from './templates/reactivate-hosts.tsx';
import removeProfile from './templates/remove-profile.tsx';
import removeProfileConfirmed from './templates/remove-profile-confirmed.tsx';
import resetPassword from './templates/reset-password.tsx';
import resetPasswordConfirm from './templates/reset-password-confirm.tsx';
import signup from './templates/signup.tsx';
import signupReminder from './templates/signup-reminder.tsx';
import welcomeSequenceFirst from './templates/welcome-sequence-first.tsx';
import welcomeSequenceSecond from './templates/welcome-sequence-second.tsx';
import welcomeSequenceThird from './templates/welcome-sequence-third.tsx';
import experienceReplyReminder from './text/experience-reply-reminder.ts';
import flaggedSignupAlert from './text/flagged-signup-alert.ts';
import messageThrottleAlert from './text/message-throttle-alert.ts';
import supportRequest from './text/support-request.ts';

// Each template types its own props; the email service passes them by name.
type Props = never;

export const htmlEmails: Record<string, ComponentType<Props>> = {
  'confirm-contact': confirmContact,
  'email-confirmation': emailConfirmation,
  'experience-notification-first': experienceNotificationFirst,
  'experience-notification-second': experienceNotificationSecond,
  'messages-digest': messagesDigest,
  'messages-unread': messagesUnread,
  'reactivate-hosts': reactivateHosts,
  'remove-profile': removeProfile,
  'remove-profile-confirmed': removeProfileConfirmed,
  'reset-password': resetPassword,
  'reset-password-confirm': resetPasswordConfirm,
  signup,
  'signup-reminder': signupReminder,
  'welcome-sequence-first': welcomeSequenceFirst,
  'welcome-sequence-second': welcomeSequenceSecond,
  'welcome-sequence-third': welcomeSequenceThird,
};

/** Templates sent as plain text only. */
export const textEmails: Record<string, (props: Props) => string> = {
  'experience-reply-reminder': experienceReplyReminder,
  'flagged-signup-alert': flaggedSignupAlert,
  'message-throttle-alert': messageThrottleAlert,
  'support-request': supportRequest,
};
