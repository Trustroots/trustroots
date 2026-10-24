import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as api from '../api/messages.api';
import Activate from '@/modules/users/client/components/Activate';
import {
  navigate,
  trackEvent,
} from '@/modules/core/client/services/client-runtime';
import InboxThread from '@/modules/messages/client/components/InboxThread';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';
import type {
  ConversationCounts,
  MessageThreadSummary,
  PageParams,
} from '../api/messages.api';

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
  const requestedFilter = new URLSearchParams(window.location.search).get(
    'filter',
  );
  const filter =
    requestedFilter === 'unread' || requestedFilter === 'unreplied'
      ? requestedFilter
      : 'all';
  const [counts, setCounts] = useState<ConversationCounts | null>(null);

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
        const fromId = thread.userFrom?._id;
        const otherUser = fromId === user._id ? thread.userTo : thread.userFrom;
        const displayName =
          otherUser && 'displayName' in otherUser
            ? otherUser.displayName
            : undefined;
        const username =
          otherUser && 'username' in otherUser ? otherUser.username : undefined;
        return [displayName, username, thread.message.excerpt].some(value =>
          value?.toLocaleLowerCase().includes(query),
        );
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
        filter === 'all' ? params : { ...params, filter },
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
    let active = true;
    async function refreshCounts() {
      try {
        const data = await api.conversationCounts();
        if (active) setCounts(data);
      } catch {
        if (active) setCounts(null);
      }
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshCounts();
    }
    refreshCounts();
    window.addEventListener('focus', refreshCounts);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshCounts);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
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
            filter === 'all' ? params : { ...params, filter },
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
        <select
          aria-label={t<string>('Conversation filter')}
          className="form-control inbox-view-filter"
          value={filter}
          onChange={event =>
            navigate(
              event.target.value === 'all'
                ? '/messages'
                : `/messages?filter=${event.target.value}`,
              {},
              { reload: true },
            )
          }
        >
          <option value="all">
            {t<string>('All conversations')}
            {counts && ` (${counts.all})`}
          </option>
          <option value="unread">
            {t<string>('Unread conversations')}
            {counts && ` (${counts.unread})`}
          </option>
          <option value="unreplied">
            {t<string>('Unreplied conversations')}
            {counts && ` (${counts.unreplied})`}
          </option>
        </select>
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
                : filter === 'unreplied'
                  ? t<string>('No unreplied conversations.')
                  : filter === 'unread'
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
