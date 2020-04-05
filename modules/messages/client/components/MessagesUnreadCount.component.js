import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { watchUnreadMessageCount } from 'modules/messages/client/services/unread-message-count.client.service';

export default function MessagesUnreadCount() {
  const { t } = useTranslation('messages');

  const [count, setCount] = useState(null);

  useEffect(() => watchUnreadMessageCount(setCount), []);

  if (count === null || count === 0) {
    return null;
  }

  return (
    <span
      className="notification-badge"
      aria-label={t(`{{count}} unread messages`)}
      tabIndex="0"
    >
      {count}
    </span>
  );
}

MessagesUnreadCount.propTypes = {};
