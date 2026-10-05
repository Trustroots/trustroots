import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as api from '../api/messages.api';
import Activate from '@/modules/users/client/components/Activate';
import { trackEvent } from '@/modules/core/client/services/client-runtime';
import InboxThread from '@/modules/messages/client/components/InboxThread';
import { userType } from '@/modules/users/client/users.prop-types';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';
import type { MessageThreadSummary, PageParams } from '../api/messages.api';

type InboxProps = { user: { public?: boolean; _id: string } };

export default function Inbox({ user }: InboxProps) {
  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate />
      </section>
    );
  }
  const { t } = useTranslation('messages');
  const unreadOnly =
    new URLSearchParams(window.location.search).get('filter') === 'unread';

  const [nextParams, setNextParams] = useState<PageParams | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isLoadingForSearch, setIsLoadingForSearch] = useState(false);
  const [searchLoadFailed, setSearchLoadFailed] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [threads, setThreads] = useState<MessageThreadSummary[]>([]);

  const hasMore = Boolean(nextParams);
  const query = searchText.trim().toLocaleLowerCase();
  const visibleThreads = query
    ? threads.filter(thread => {
        const otherUser =
          thread.userFrom._id === user._id ? thread.userTo : thread.userFrom;
        return [
          otherUser.displayName,
          otherUser.username,
          thread.message.excerpt,
        ].some(value => value?.toLocaleLowerCase().includes(query));
      })
    : threads;

  async function fetchThreads(next = false) {
    setIsFetching(true);
    try {
      if (next) {
        trackEvent('inbox-pagination', {
          category: 'messages.inbox',
          label: 'Inbox page ' + nextParams?.page,
        });
      }

      const params = next ? (nextParams as PageParams) : {};
      const data = await api.fetchThreads(
        unreadOnly ? { ...params, filter: 'unread' } : params,
      );
      setThreads(threads =>
        next ? threads.concat(data.threads) : data.threads,
      );
      setNextParams(data.nextParams || null);
    } finally {
      setIsFetching(false);
    }
  }

  useEffect(() => {
    updateUnreadMessageCount();
    fetchThreads();
  }, []);

  useEffect(() => {
    if (
      !query ||
      !nextParams ||
      isFetching ||
      isLoadingForSearch ||
      searchLoadFailed
    ) {
      return;
    }

    async function loadOlderConversations() {
      setIsLoadingForSearch(true);
      let params = nextParams;
      const olderThreads: MessageThreadSummary[] = [];
      try {
        while (params) {
          const data = await api.fetchThreads(
            unreadOnly ? { ...params, filter: 'unread' } : params,
          );
          olderThreads.push(...data.threads);
          params = data.nextParams || null;
        }
        setThreads(current => current.concat(olderThreads));
        setNextParams(null);
      } catch {
        setSearchLoadFailed(true);
      } finally {
        setIsLoadingForSearch(false);
      }
    }

    loadOlderConversations();
  }, [query, nextParams, isFetching, isLoadingForSearch, searchLoadFailed]);

  return (
    <section className="container-spacer">
      <div className="container inbox-controls">
        <nav
          aria-label={t<string>('Conversation filter')}
          className="inbox-view-filters"
        >
          <a
            href="/messages"
            rel="external"
            aria-current={unreadOnly ? undefined : 'page'}
            className="btn btn-default"
          >
            {t<string>('All conversations')}
          </a>
          <a
            href="/messages?filter=unread"
            rel="external"
            aria-current={unreadOnly ? 'page' : undefined}
            className="btn btn-default"
          >
            {t<string>('Unread conversations')}
          </a>
        </nav>
        <div className="inbox-search">
          <input
            type="search"
            className="form-control"
            aria-label={t<string>('Filter conversations')}
            placeholder={t<string>('Filter conversations')}
            value={searchText}
            onChange={event => {
              setSearchText(event.target.value);
              setSearchLoadFailed(false);
            }}
          />
          {isLoadingForSearch && (
            <p className="inbox-search-status" role="status">
              {t<string>('Searching older conversations…')}
            </p>
          )}
          {searchLoadFailed && (
            <p className="inbox-search-status" role="alert">
              {t<string>('Older conversations could not be loaded.')}
            </p>
          )}
        </div>
      </div>
      {!isFetching &&
        !isLoadingForSearch &&
        !searchLoadFailed &&
        (!query || !hasMore) &&
        visibleThreads.length === 0 && (
          <div className="content-empty">
            <i className="icon-3x icon-messages-alt" />
            <h4 role="alert">
              {query
                ? t<string>('No matching conversations.')
                : unreadOnly
                ? t<string>('No unread conversations.')
                : t<string>('No conversations yet.')}
            </h4>
          </div>
        )}
      {visibleThreads.length > 0 && (
        <ul className="list-group threadlist">
          {visibleThreads.map(thread => (
            <InboxThread key={thread._id} user={user} thread={thread} />
          ))}
        </ul>
      )}
      {!isFetching && !query && hasMore && (
        <div className="text-center">
          <button
            className="btn btn-primary btn-lg"
            onClick={() => fetchThreads(true)}
          >
            {t<string>('More messages')}
          </button>
        </div>
      )}
    </section>
  );
}

Inbox.propTypes = {
  user: userType.isRequired,
};
