import { Input } from '@trustroots/ui/Input';
import { useSearch } from '@tanstack/react-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@trustroots/ui/Button';
import ContentState from '@/modules/core/client/components/ContentState';
import * as api from '../api/messages.api';
import Activate from '@/modules/users/client/components/Activate';
import InboxThread from '@/modules/messages/client/components/InboxThread';
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
  const unreadOnly = useSearch({ strict: false }).filter === 'unread';

  const [nextParams, setNextParams] = useState<PageParams | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [isLoadingForSearch, setIsLoadingForSearch] = useState(false);
  const [searchLoadFailed, setSearchLoadFailed] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [failedNextPage, setFailedNextPage] = useState(false);
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
    setIsFetchingNextPage(next);
    setLoadFailed(false);
    try {
      const params = next ? (nextParams as PageParams) : {};
      const data = await api.fetchThreads(
        unreadOnly ? { ...params, filter: 'unread' } : params,
      );
      setThreads(threads =>
        next ? threads.concat(data.threads) : data.threads,
      );
      setNextParams(data.nextParams || null);
    } catch {
      setLoadFailed(true);
      setFailedNextPage(next);
    } finally {
      setIsFetching(false);
      setIsFetchingNextPage(false);
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
      <div className="tw:page-container inbox-controls">
        <nav
          aria-label={t('Conversation filter')}
          className="inbox-view-filters"
        >
          <Button
            render={<a href="/messages" rel="external" />}
            aria-current={unreadOnly ? undefined : 'page'}
            aria-label={t('All conversations')}
          >
            <span className="tw:max-sm:hidden">{t('All conversations')}</span>
            <span className="tw:inline tw:sm:hidden">{t('All')}</span>
          </Button>
          <Button
            render={<a href="/messages?filter=unread" rel="external" />}
            aria-current={unreadOnly ? 'page' : undefined}
            aria-label={t('Unread conversations')}
          >
            <span className="tw:max-sm:hidden">
              {t('Unread conversations')}
            </span>
            <span className="tw:inline tw:sm:hidden">{t('Unread')}</span>
          </Button>
        </nav>
        <div className="inbox-search">
          <Input
            type="search"
            aria-label={t('Filter conversations')}
            placeholder={t('Filter conversations')}
            value={searchText}
            onChange={event => {
              setSearchText(event.target.value);
              setSearchLoadFailed(false);
            }}
          />
          {isLoadingForSearch && (
            <ContentState
              className="inbox-search-status"
              kind="loading"
              heading={t('Searching older conversations…')}
              description={t(
                'Please wait while we search older conversations.',
              )}
            />
          )}
          {searchLoadFailed && (
            <ContentState
              className="inbox-search-status"
              kind="error"
              heading={t('Older conversations unavailable')}
              description={t('Older conversations could not be loaded.')}
              action={
                <Button
                  type="button"
                  onClick={() => setSearchLoadFailed(false)}
                >
                  {t('Try again')}
                </Button>
              }
            />
          )}
        </div>
      </div>
      {isFetching && !loadFailed && (
        <div className="tw:page-container">
          <ContentState
            kind="loading"
            heading={
              isFetchingNextPage
                ? t('Loading older conversations…')
                : t('Loading conversations…')
            }
            description={t('Please wait while your conversations are loaded.')}
          />
        </div>
      )}
      {loadFailed && (
        <div className="tw:page-container">
          <ContentState
            kind="error"
            heading={
              failedNextPage
                ? t('More conversations unavailable')
                : t('Messages unavailable')
            }
            description={
              failedNextPage
                ? t('Could not load more conversations.')
                : t('Could not load your conversations.')
            }
            action={
              <Button
                type="button"
                onClick={() => fetchThreads(failedNextPage)}
              >
                {t('Try again')}
              </Button>
            }
          />
        </div>
      )}
      {!isFetching &&
        !loadFailed &&
        !isLoadingForSearch &&
        !searchLoadFailed &&
        (!query || !hasMore) &&
        visibleThreads.length === 0 && (
          <ContentState
            kind="empty"
            heading={
              query
                ? t('No matching conversations.')
                : unreadOnly
                  ? t('No unread conversations.')
                  : t('No conversations yet.')
            }
            description={t(
              'Conversations with other members will appear here.',
            )}
          />
        )}
      {visibleThreads.length > 0 && (
        <ul className="list-group threadlist">
          {visibleThreads.map(thread => (
            <InboxThread key={thread._id} user={user} thread={thread} />
          ))}
        </ul>
      )}
      {!isFetching &&
        !isLoadingForSearch &&
        !loadFailed &&
        !query &&
        hasMore && (
          <div className="text-center">
            <Button
              intent="primary"
              size="lg"
              onClick={() => fetchThreads(true)}
            >
              {t('More messages')}
            </Button>
          </div>
        )}
    </section>
  );
}
