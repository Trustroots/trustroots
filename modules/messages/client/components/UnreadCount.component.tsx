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
      intent="danger"
      // Pinned to the corner of the header's Messages link, smaller than any
      // other badge.
      className="tw:absolute tw:top-2 tw:end-1.25 tw:rounded tw:px-[2px] tw:py-0 tw:text-[10px] tw:leading-[1.3] tw:font-normal tw:text-shadow-[0_-1px_0_rgb(0_0_0/0.4)]"
      aria-label={t('{{count}} unread messages', { count })}
    >
      {count}
    </Badge>
  );
}
