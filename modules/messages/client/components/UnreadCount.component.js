import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { watch as watchUnreadCount } from '@/modules/messages/client/services/unread-message-count.client.service';

export default function UnreadCount() {
  const { t } = useTranslation('messages');

  const [count, setCount] = useState(null);

  useEffect(() => watchUnreadCount(setCount), []);

  if (count === null || count === 0) {
    return null;
  }

  return (
    <span
      className="notification-badge"
      aria-label={t('{{count}} unread messages', { count })}
      tabIndex="0"
    >
      {count}
    </span>
  );
}

UnreadCount.propTypes = {};
