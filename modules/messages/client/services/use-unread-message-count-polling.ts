import { useEffect } from 'react';

import { useAuth } from '@/modules/core/client/react-app/auth';
import { start } from '@/modules/messages/client/services/unread-message-count.client.service';

/** Polls the unread message count while a public member is signed in. */
export default function useUnreadMessageCountPolling(): void {
  const isPublicMember = Boolean(useAuth().user?.public);

  useEffect(() => (isPublicMember ? start() : undefined), [isPublicMember]);
}
