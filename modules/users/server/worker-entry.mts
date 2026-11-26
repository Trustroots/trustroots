export default {
  notificationEmail: () =>
    import('./services/notification-email.server.service.mts'),
  signupReminders: () => import('./jobs/user-finish-signup.server.job.mts'),
  signupReminderDelivery: () =>
    import('./services/signup-reminder.server.service.mts'),
  welcomeSequenceFirst: () =>
    import('./jobs/user-welcome-sequence-first.server.job.mts'),
  welcomeSequenceSecond: () =>
    import('./jobs/user-welcome-sequence-second.server.job.mts'),
  welcomeSequenceThird: () =>
    import('./jobs/user-welcome-sequence-third.server.job.mts'),
  testPush: () => import('./services/unified-push.server.service.mts'),
};
