import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as api from '../api/messages.api';
import Activate from '@/modules/users/client/components/Activate';
import { eventTrack } from '@/modules/core/client/services/angular-compat';
import InboxThread from '@/modules/messages/client/components/InboxThread';
import { userType } from '@/modules/users/client/users.prop-types';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';

export default function Inbox({ user }) {
  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate />
      </section>
    );
  }
  const { t } = useTranslation('messages');

  const [nextParams, setNextParams] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [threads, setThreads] = useState([]);

  const hasMore = Boolean(nextParams);

  async function fetchThreads(next = false) {
    setIsFetching(true);
    try {
      if (next) {
        eventTrack('inbox-pagination', {
          category: 'messages.inbox',
          label: 'Inbox page ' + nextParams.page,
        });
      }

      const data = await api.fetchThreads(next ? nextParams : {});
      setThreads(threads =>
        next ? threads.concat(data.threads) : data.threads,
      );
      setNextParams(data.nextParams);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    updateUnreadMessageCount();
    fetchThreads();
  }, []);

  return (
    <section className="container-spacer">
      {!isFetching && threads.length === 0 && (
        <div className="content-empty">
          <i className="icon-3x icon-messages-alt" />
          <h4 role="alert">{t('No conversations yet.')}</h4>
        </div>
      )}
      {threads.length > 0 && (
        <ul className="list-group threadlist">
          {threads.map(thread => (
            <InboxThread key={thread._id} user={user} thread={thread} />
          ))}
        </ul>
      )}
      {!isFetching && hasMore && (
        <div className="text-center">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => fetchThreads(true)}
          >
            {t('More messages')}
          </button>
        </div>
      )}
    </section>
  );
}

Inbox.propTypes = {
  user: userType.isRequired,
};
