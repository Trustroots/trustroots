import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

angular.module('messages').run(messagesRun);

/* @ngInject */
function messagesRun($timeout) {
  enableVisibilityWatching();
  enableFaviconUpdater();
  // This needs to be delayed just a little bit until angular is initialized
  // or stuff in angular-compat can't be used
  $timeout(enableUnreadMessageCountPolling);
}
