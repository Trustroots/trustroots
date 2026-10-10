import messagesPolicy from './../policies/messages.server.policy.mjs';
import messages from './../controllers/messages.server.controller.mjs';

/**
 * Module dependencies.
 */
function register(app) {
  app
    .route('/api/messages')
    .all(messagesPolicy.isAllowed)
    .get(messages.inbox)
    .post(messages.send);
  app
    .route('/api/messages/:messageUserId')
    .all(messagesPolicy.isAllowed)
    .get(messages.thread);
  app
    .route('/api/messages-read')
    .all(messagesPolicy.isAllowed)
    .post(messages.markRead);
  app
    .route('/api/messages-count')
    .all(messagesPolicy.isAllowed)
    .get(messages.messagesCount);
  app
    .route('/api/messages-sync')
    .all(messagesPolicy.isAllowed)
    .get(messages.sync);

  app
    .route('/api/messages-preview')
    .all(messagesPolicy.isAllowed)
    .post(messages.preview);

  // Finish by binding the message middleware
  app.param('messageUserId', messages.threadByUser);
}
export { register };
export default register;
export { register as 'module.exports' };
