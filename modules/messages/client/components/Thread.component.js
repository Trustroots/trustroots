import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import { QueryClient, QueryClientProvider } from 'react-query';

import {
  getRouteParams,
  go,
} from '@/modules/core/client/services/angular-compat';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import * as usersAPI from '@/modules/users/client/api/users.api';
import { userType } from '@/modules/users/client/users.prop-types';
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
import plainTextLength from '@/modules/core/client/filters/plain-text-length.client.filter';
import { update as updateUnreadMessageCount } from '@/modules/messages/client/services/unread-message-count.client.service';

// Required by LanguageList in Monkeybox component
// @TODO: move this to higher up in the React tree once we no longer deal with Angular
const queryClient = new QueryClient();

const api = {
  messages: messagesAPI,
  users: usersAPI,
};

const ThreadContainer = styled.div`
  position: fixed;
  top: 44px;
  bottom: 0;
  width: 100%;
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

function YouHaveNotBeenTalkingYet() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <h4>{t("You haven't been talking yet.")}</h4>
      <Flashcard />
    </div>
  );
}

function YourProfileSeemsQuiteEmpty() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <p className="lead">
        {t('Your profile seems quite empty.')}
        <br />
        {t('Please write longer profile description before sending messages.')}
        <br />
        <a href="/profile/edit">{t('Edit your profile')}</a>
      </p>
    </div>
  );
}

function UserDoesNotExist() {
  const { t } = useTranslation('messages');
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt" />
      <h4>{t("This user isn't a member anymore.")}</h4>
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

export default function Thread({ user, profileMinimumLength }) {
  const { t } = useTranslation('messages');

  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate />
      </section>
    );
  }

  const username = getRouteParams().username;

  if (user.username === username) {
    go('inbox');
    return null; // important to return null to indicate "nothing to render"
  }

  const [nextParams, setNextParams] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [doesNotExist, setDoesNotExist] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [messages, setMessages] = useState([]);
  const cacheKey = `messages.thread.${user._id}-${username}`;
  const isBlocked = user.blocked?.includes(otherUser?._id);

  const hasEmptyProfile = useMemo(
    () => plainTextLength(user.description) < profileMinimumLength,
    [user],
  );

  const userHasReplied = Boolean(
    messages.find(message => message.userFrom._id === user._id),
  );
  const showReply = (messages.length > 0 || !hasEmptyProfile) && !removed;
  const showQuickReply = showReply && !userHasReplied;

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  async function fetchMoreData() {
    if (isFetchingMore || !nextParams) return;
    setIsFetchingMore(true);
    try {
      const { messages: moreMessages, nextParams: moreNextParams } =
        await api.messages.fetchMessages(otherUser._id, nextParams);
      setMessages(messages => [
        ...moreMessages.sort((a, b) => a.created.localeCompare(b.created)),
        ...messages,
      ]);
      setNextParams(moreNextParams);
    } finally {
      setIsFetchingMore(false);
    }
  }

  function createFakeUserObject(userId) {
    return {
      _id: userId,
      displayName: t('Unknown member'),
      username: null,
      member: [],
      languages: [],
    };
  }

  async function fetchData() {
    if (isFetching) return;
    try {
      setIsFetching(true);
      let otherUser;
      let userRemoved = false;
      try {
        otherUser = await api.users.fetch(username);
      } catch (error) {
        if (error.response?.status === 404) {
          const userId = getRouteParams().userId;
          if (userId !== undefined) {
            otherUser = createFakeUserObject(userId);
            userRemoved = true;
          } else {
            setDoesNotExist(true);
            throw error;
          }
        } else {
          throw error;
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
      setNextParams(nextParams);
    } finally {
      setIsFetching(false);
    }
  }

  async function sendMessage(content) {
    const apiResponse = await api.messages
      .sendMessage(otherUser._id, content)
      .catch(error => {
        // Too many requests - error
        if (error?.response?.status === 429) {
          window.alert(
            t(
              'You are writing to too many people too fast. Slow down and try later again.',
            ),
          );
        } else {
          window.alert(
            t(
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
    focus();
    return true;
  }

  function focus() {
    document.querySelector('#message-reply-content')?.focus();
  }

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    async function markRead() {
      const unreadMessages = messages
        .filter(message => !message.read) // only unread
        .filter(message => message.userFrom._id !== user._id); // only other persons messages
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
                    <YouHaveNotBeenTalkingYet />
                  )}
                  <FlexGrow />
                </>
              ) : (
                <ThreadMessages
                  user={user}
                  otherUser={otherUser}
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
              {!isBlocked && showReply && (
                <ThreadReply
                  cacheKey={cacheKey}
                  onSend={content => sendMessage(content)}
                />
              )}
              {removed && (
                <div className="panel panel-default">
                  <div className="panel-body">
                    <em className="text-danger">
                      {t('Member is not available anymore.')}
                    </em>
                  </div>
                </div>
              )}
              {isBlocked && (
                <BlockedMemberBanner username={otherUser.username} />
              )}
            </ThreadContainer>
          )}
        </div>
        {otherUser && !isExtraSmall && !removed && (
          <div className="col-sm-3 text-center">
            <QueryClientProvider client={queryClient}>
              <Monkeybox user={otherUser} otherUser={user} />
            </QueryClientProvider>
            {messages.length > 0 && (
              <ReferenceThread userToId={otherUser._id} />
            )}
            <ReportMember
              className="btn btn-sm btn-default"
              username={otherUser.username}
            />
            <br />
            <br />
            <BlockMember
              className="btn btn-sm btn-default"
              username={otherUser.username}
              isBlocked={isBlocked}
            />
          </div>
        )}
      </div>
    </section>
  );
}

Thread.propTypes = {
  user: userType.isRequired,
  profileMinimumLength: PropTypes.number.isRequired,
};
