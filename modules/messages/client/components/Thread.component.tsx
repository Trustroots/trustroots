import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import {
  getCurrentRouteParams,
  navigate,
} from '@/modules/core/client/services/client-runtime';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import * as usersAPI from '@/modules/users/client/api/users.api';
import Monkeybox from '@/modules/users/client/components/Monkeybox';
import ReportMember from '@/modules/support/client/components/ReportMember.component';
import BlockMember from '@/modules/users/client/components/BlockMember.component';
import BlockedMemberBanner from '@/modules/users/client/components/BlockedMemberBanner.component';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';
import Activate from '@/modules/users/client/components/Activate';
import ThreadMessages from '@/modules/messages/client/components/ThreadMessages';
import QuickReply from '@/modules/messages/client/components/QuickReply';
import Flashcard from '@/modules/messages/client/components/Flashcard';
import LoadingIndicator from '@/modules/core/client/components/LoadingIndicator';
import ReferenceThread from '@/modules/references-thread/client/components/ReferenceThread';
import { plainTextLength } from '@/modules/core/client/utils/filters';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';
import type {
  HostingContext,
  HostingDetails,
  Message,
  MessageUser,
  PageParams,
} from '../api/messages.api';

// Required by LanguageList in Monkeybox component.
const queryClient = new QueryClient();

const api = {
  messages: messagesAPI,
  users: usersAPI,
};

const ThreadContainer = styled.div`
  position: fixed;
  top: 44px;
  bottom: var(--trustroots-keyboard-inset, 0px);
  width: 100%;
  min-height: 0;
  overflow: hidden;
  @media (min-width: 768px) {
    width: 505px;
    bottom: 12px;
  }
  @media (min-width: 992px) {
    width: 667px;
  }
  @media (min-width: 1200px) {
    width: 800px;
  }
  display: flex;
  flex-direction: column;
`;

const LoadingContainer = styled.div`
  position: absolute;
  top: 0;
  width: 100%;
  text-align: center;
`;

const FlexGrow = styled.div`
  flex-grow: 1;
`;

function YouHaveNotBeenTalkingYet({ name }: { name?: string | null }) {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <h4>
        {name
          ? t<string>("You haven't been talking with {{name}} yet.", { name })
          : t<string>("You haven't been talking yet.")}
      </h4>
      <Flashcard />
    </div>
  );
}

function SafetyReminder() {
  const { t } = useTranslation('messages');
  return (
    <p className="text-muted text-center">
      {t<string>('Before meeting someone new, read our ')}
      <a href="/safety">{t<string>('safety tips')}</a>
      {t<string>(' and ')}
      <a href="/rules">{t<string>('community rules')}</a>
      {t<string>('.')}
    </p>
  );
}

function YourProfileSeemsQuiteEmpty() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <p className="lead">
        {t<string>('Your profile seems quite empty.')}
        <br />
        {t<string>(
          'Please write longer profile description before sending messages.',
        )}
        <br />
        <a href="/profile/edit">{t<string>('Edit your profile')}</a>
      </p>
    </div>
  );
}

function UserDoesNotExist() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <h4>{t<string>("This user isn't a member anymore.")}</h4>
    </div>
  );
}

function FailedToLoadThread() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <h4>{t<string>('Failed to load messages. Please try again.')}</h4>
    </div>
  );
}

function Loading() {
  return (
    <LoadingContainer>
      <LoadingIndicator />
    </LoadingContainer>
  );
}

type ThreadCurrentUser = MessageUser & {
  public?: boolean;
  description?: string;
  blocked?: string[];
};
type ThreadProps = { user: ThreadCurrentUser; profileMinimumLength: number };

export default function Thread({ user, profileMinimumLength }: ThreadProps) {
  const { t } = useTranslation('messages');

  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate />
      </section>
    );
  }

  const username = getCurrentRouteParams().username;
  if (user.username === username) {
    navigate('inbox');
    return null; // important to return null to indicate "nothing to render"
  }

  const [nextParams, setNextParams] = useState<PageParams | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [otherUser, setOtherUser] = useState<MessageUser | null>(null);
  const [doesNotExist, setDoesNotExist] = useState(false);
  const [failedToLoad, setFailedToLoad] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hostingContext, setHostingContext] = useState<HostingContext | null>(
    null,
  );
  const [hostingContextLoading, setHostingContextLoading] = useState(false);
  const [hostingContextError, setHostingContextError] = useState(false);
  const [hostingMode, setHostingMode] = useState(false);
  const hostingContextRequest = useRef(0);
  const cacheKey = `messages.thread.${user._id}-${username}`;
  const isBlocked = user.blocked?.includes(otherUser?._id || '');

  const hasEmptyProfile = useMemo(
    () => plainTextLength(user.description) < profileMinimumLength,
    [user],
  );

  const showReply = (messages.length > 0 || !hasEmptyProfile) && !removed;
  const latestOutgoingTime = messages
    .filter(message => message.userFrom?._id === user._id)
    .map(message => message.created)
    .sort()
    .pop();
  const userHasReplied = Boolean(latestOutgoingTime);
  const hasUnansweredHostingMessage = messages.some(
    message =>
      message.userFrom?._id !== user._id &&
      message.hostingDetails !== undefined &&
      (!latestOutgoingTime || message.created > latestOutgoingTime),
  );
  const showQuickReply = showReply && hasUnansweredHostingMessage;

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    let keyboardInset = 0;

    const updateKeyboardInset = () => {
      const isWritingMessage =
        document.activeElement?.id === 'message-reply-content';
      // Native text menus can temporarily take focus from the editor. Keep
      // the composer in place until the viewport shows the keyboard has closed.
      keyboardInset =
        isWritingMessage || keyboardInset > 0
          ? Math.max(
              0,
              Math.round(
                window.innerHeight - viewport.height - viewport.offsetTop,
              ),
            )
          : 0;
      document.documentElement.style.setProperty(
        '--trustroots-keyboard-inset',
        `${keyboardInset}px`,
      );
    };

    updateKeyboardInset();
    viewport.addEventListener('resize', updateKeyboardInset);
    viewport.addEventListener('scroll', updateKeyboardInset);
    window.addEventListener('resize', updateKeyboardInset);
    document.addEventListener('focusin', updateKeyboardInset);
    document.addEventListener('focusout', updateKeyboardInset);

    return () => {
      viewport.removeEventListener('resize', updateKeyboardInset);
      viewport.removeEventListener('scroll', updateKeyboardInset);
      window.removeEventListener('resize', updateKeyboardInset);
      document.removeEventListener('focusin', updateKeyboardInset);
      document.removeEventListener('focusout', updateKeyboardInset);
      document.documentElement.style.removeProperty(
        '--trustroots-keyboard-inset',
      );
    };
  }, []);

  async function fetchMoreData() {
    if (isFetchingMore || !nextParams) return;
    setIsFetchingMore(true);
    try {
      const { messages: moreMessages, nextParams: moreNextParams } =
        await api.messages.fetchMessages(otherUser!._id, nextParams);
      setMessages(messages => [
        ...moreMessages.sort((a, b) => a.created.localeCompare(b.created)),
        ...messages,
      ]);
      setNextParams(moreNextParams ?? null);
    } finally {
      setIsFetchingMore(false);
    }
  }

  function createFakeUserObject(userId: string): MessageUser {
    return {
      _id: userId,
      displayName: t<string>('Unknown member'),
    };
  }

  async function fetchHostingContext(userId: string) {
    const requestId = ++hostingContextRequest.current;
    setHostingContextLoading(true);
    setHostingContextError(false);
    setHostingContext(null);
    try {
      const context = await api.messages.fetchHostingContext(userId);
      if (requestId === hostingContextRequest.current) {
        setHostingContext(context);
      }
    } catch {
      if (requestId === hostingContextRequest.current) {
        setHostingContextError(true);
      }
    } finally {
      if (requestId === hostingContextRequest.current) {
        setHostingContextLoading(false);
      }
    }
  }

  async function fetchData() {
    try {
      setIsFetching(true);
      let otherUser: MessageUser;
      let userRemoved = false;
      try {
        otherUser = await api.users.fetch(username);
      } catch (error) {
        const apiError = error as { response?: { status?: number } };
        if (apiError.response?.status === 404) {
          const userId = getCurrentRouteParams().userId;
          if (userId !== undefined) {
            otherUser = createFakeUserObject(userId);
            userRemoved = true;
          } else {
            setDoesNotExist(true);
            return;
          }
        } else {
          setFailedToLoad(true);
          return;
        }
      }
      setRemoved(userRemoved);

      const { messages, nextParams } = await api.messages.fetchMessages(
        otherUser._id,
      );
      setOtherUser(otherUser);
      const sortedMessages = messages.sort((a, b) =>
        a.created.localeCompare(b.created),
      );
      // TODO should be done at the back-end?
      if (userRemoved) {
        const filledMessages = messages.map(message => {
          if (!message.userTo) {
            message.userTo = { _id: otherUser._id };
          }
          if (!message.userFrom) {
            message.userFrom = { _id: otherUser._id };
          }
          return message;
        });
        setMessages(filledMessages);
      } else {
        setMessages(sortedMessages);
      }
      setNextParams(nextParams ?? null);
    } catch {
      setFailedToLoad(true);
    } finally {
      setIsFetching(false);
    }
  }

  async function sendMessage(
    content: string,
    hostingDetails?: HostingDetails,
    hostingDescriptionAcknowledged?: boolean,
  ) {
    const userToId = (otherUser as MessageUser)._id;
    const messageRequest = hostingDetails
      ? api.messages.sendMessage(
          userToId,
          content,
          hostingDescriptionAcknowledged,
          hostingDetails,
        )
      : api.messages.sendMessage(userToId, content);
    const apiResponse = await messageRequest.catch(async error => {
      if (
        hostingDetails &&
        error?.response?.data?.error ===
          'hosting-description-acknowledgement-required'
      ) {
        await fetchHostingContext(otherUser!._id);
        return;
      }
      // Too many requests - error
      if (error?.response?.status === 429) {
        window.alert(
          t<string>(
            'You are writing to too many people too fast. Slow down and try later again.',
          ),
        );
      } else {
        window.alert(
          t<string>(
            'Failed to send the message. Perhaps your internet went down? Please try again.',
          ),
        );
      }
    });

    // Failed to send message
    if (!apiResponse?.data) {
      return false;
    }

    // Append in thread the formatted message we got as a response from API
    const { data: message } = apiResponse;
    setMessages(messages => [...messages, message]);
    if (hostingDetails) {
      setHostingContext(context =>
        context ? { ...context, acknowledgementRequired: false } : context,
      );
    }
    focus();
    return true;
  }

  function focus() {
    document.querySelector<HTMLElement>('#message-reply-content')?.focus();
  }

  function toggleHostingMode(enabled: boolean) {
    setHostingMode(enabled);
    if (!enabled) hostingContextRequest.current += 1;
    setHostingContext(null);
    setHostingContextError(false);
    if (enabled && otherUser) fetchHostingContext(otherUser._id);
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    async function markRead() {
      const unreadMessages = messages
        .filter(message => !message.read) // only unread
        .filter(message => message.userFrom?._id !== user._id); // only other persons messages
      if (unreadMessages.length > 0) {
        await api.messages.markRead(unreadMessages.map(message => message._id));
        setMessages(messages =>
          messages.map(message => ({ ...message, read: true })),
        );
        updateUnreadMessageCount();
      }
    }
    markRead();
  }, [messages]);

  if (doesNotExist) {
    return (
      <section className="container-spacer">
        <UserDoesNotExist />
      </section>
    );
  }

  if (failedToLoad) {
    return (
      <section className="container-spacer">
        <FailedToLoadThread />
      </section>
    );
  }

  return (
    <section className="container container-spacer">
      <div className="row">
        <div className="col-xs-12 col-sm-9">
          {isFetching && <Loading />}
          {!isFetching && (
            <ThreadContainer>
              {isFetchingMore && <Loading />}
              {messages.length === 0 ? (
                <>
                  <FlexGrow />
                  {hasEmptyProfile ? (
                    <YourProfileSeemsQuiteEmpty />
                  ) : (
                    <YouHaveNotBeenTalkingYet
                      name={otherUser?.displayName || otherUser?.username}
                    />
                  )}
                  <FlexGrow />
                </>
              ) : (
                <ThreadMessages
                  user={
                    user as React.ComponentProps<typeof ThreadMessages>['user']
                  }
                  otherUser={
                    otherUser as React.ComponentProps<
                      typeof ThreadMessages
                    >['otherUser']
                  }
                  messages={messages}
                  profileMinimumLength={profileMinimumLength}
                  onFetchMore={fetchMoreData}
                />
              )}
              {!isBlocked && showQuickReply && (
                <QuickReply
                  onSend={content => sendMessage(content)}
                  onFocus={focus}
                />
              )}
              {!userHasReplied && showReply && <SafetyReminder />}
              {!isBlocked && showReply && (
                <>
                  <ThreadReply
                    key={cacheKey}
                    cacheKey={cacheKey}
                    autoFocus={!isExtraSmall}
                    onSend={(content, details, acknowledged) =>
                      sendMessage(content, details, acknowledged)
                    }
                    hostingContext={hostingMode ? hostingContext : null}
                    hostingContextLoading={hostingContextLoading}
                    hostingContextError={hostingContextError}
                    onHostingModeChange={toggleHostingMode}
                    onRetryHostingContext={() =>
                      otherUser && fetchHostingContext(otherUser._id)
                    }
                  />
                </>
              )}
              {removed && (
                <div className="panel panel-default">
                  <div className="panel-body">
                    <em className="text-danger">
                      {t<string>('Member is not available anymore.')}
                    </em>
                  </div>
                </div>
              )}
              {isBlocked && (
                <BlockedMemberBanner username={otherUser!.username as string} />
              )}
            </ThreadContainer>
          )}
        </div>
        {otherUser && !isExtraSmall && !removed && (
          <div className="col-sm-3 text-center">
            <QueryClientProvider client={queryClient}>
              <Monkeybox
                user={
                  otherUser as React.ComponentProps<typeof Monkeybox>['user']
                }
                otherUser={
                  user as React.ComponentProps<typeof Monkeybox>['otherUser']
                }
              />
            </QueryClientProvider>
            {messages.length > 0 && (
              <ReferenceThread userToId={otherUser._id} />
            )}
            <ReportMember
              className="btn btn-sm btn-default"
              username={otherUser.username as string}
            />
            <br />
            <br />
            <BlockMember
              className="btn btn-sm btn-default"
              username={otherUser.username as string}
              isBlocked={isBlocked}
            />
          </div>
        )}
      </div>
    </section>
  );
}
