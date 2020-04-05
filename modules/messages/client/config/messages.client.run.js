import { enable as enableUnreadMessageCountPolling } from '@/modules/messages/client/services/unread-message-count.client.service';
import { enable as enableVisibilityWatching } from '@/modules/messages/client/services/visibility.client.service';
import { enable as enableFaviconUpdater } from '@/modules/messages/client/services/messages-count-favicon-updater.client.service';

angular.module('messages').run(() => {
  enableVisibilityWatching();
  enableFaviconUpdater();
  // Without setImmediate the stuff in angular-compat cannot load as it's too early
  setImmediate(enableUnreadMessageCountPolling);
});
