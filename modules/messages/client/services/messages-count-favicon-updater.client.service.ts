import { watch } from '@/modules/messages/client/services/unread-message-count.client.service';
import { ready } from '@/modules/core/client/utils/dom';

export function enable(): void {
  ready(() => {
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    const favicon2x = document.getElementById('favicon2x') as HTMLLinkElement;
    watch((count: number) => {
      if (count > 0) {
        favicon.href = '/img/favicon-notification.png';
        favicon2x.href = '/img/favicon-notification@2x.png';
      } else {
        favicon.href = '/img/favicon.png';
        favicon2x.href = '/img/favicon@2x.png';
      }
    });
  });
}
