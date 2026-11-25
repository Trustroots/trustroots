export default {
  unreadMessages: () => import('./jobs/message-unread.server.job.mts'),
  messagePush: () => import('./jobs/message-push.server.job.mts'),
  messageDigest: () => import('./jobs/message-digest.server.job.mts'),
};
