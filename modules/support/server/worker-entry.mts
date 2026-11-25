export default {
  sendSupportMessage: () =>
    import('./jobs/send-support-message.server.job.mts'),
  pollSupportMailbox: () =>
    import('./jobs/poll-support-mailbox.server.job.mts'),
  recoverSupportMessages: () =>
    import('./jobs/recover-support-messages.server.job.mts'),
};
