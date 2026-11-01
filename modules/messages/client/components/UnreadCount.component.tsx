import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@trustroots/ui/Badge';

import { watch as watchUnreadCount } from '@/modules/messages/client/services/unread-message-count.client.service';

export default function UnreadCount() {
  const { t } = useTranslation('messages');

  const [count, setCount] = useState(0);

  useEffect(() => watchUnreadCount(setCount), []);

  if (!count) return null;

  return (
    <Badge
      variant="solid"
      tone="danger"
      size="xs"
      // Pinned to the corner of the header's Messages link.
      className="tw:absolute tw:top-2 tw:end-1.25"
      aria-label={t('{{count}} unread messages', { count })}
    >
      {count}
    </Badge>
  );
}
