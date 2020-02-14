import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';

import {
  $broadcast,
  getRouteParams,
} from '@/modules/core/client/services/angular-compat';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import * as usersAPI from '@/modules/users/client/api/users.api';
import { userType } from '@/modules/users/client/users.prop-types';
import Monkeybox from '@/modules/messages/client/components/Monkeybox';
import ReportMemberLink from '@/modules/support/client/components/ReportMemberLink.component';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';
import Activate from 'modules/users/client/components/Activate';
import ThreadMessages from '@/modules/messages/client/components/ThreadMessages';
import QuickReply from '@/modules/messages/client/components/QuickReply';
import Flashcard from 'modules/messages/client/components/Flashcard';

// @TODO remove this stuff once ready
import range from 'lodash/range';
import faker from 'faker';
import { generateMongoId } from '@/testutils/common/data.common.testutil';
import plainTextLength from 'modules/core/client/filters/plain-text-length.client.filter';

function generateMessage(userFrom) {
  return {
    _id: generateMongoId(),
    fake: true,
    userFrom,
    created: new Date().toISOString(),
    content: faker.lorem.text(),
  };
}

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
  top: 10px;
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

export default function Thread({ user, profileMinimumLength }) {
  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate />
      </section>
    );
  }

  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [doesNotExist, setDoesNotExist] = useState(false);
  const [messages, setMessages] = useState([]);
  const cacheKey = `messages.thread.${user._id}-${getRouteParams().username}`;

  const hasEmptyProfile = useMemo(
    () => plainTextLength(user.description) < profileMinimumLength,
    [user],
  );

  const userHasReplied = Boolean(
    messages.find(message => message.userFrom._id === user._id),
  );
  const showQuickReply = messages.length > 0 && !userHasReplied;
  const showReply = !hasEmptyProfile;

  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });

  function fetchMoreData() {
    // @TODO only if there is more ...
    setIsFetchingMore(true);
    setTimeout(() => {
      setMessages(messages => [
        ...range(10).map(() => generateMessage(otherUser)),
        ...messages,
      ]);
      setIsFetchingMore(false);
    }, 500);
  }

  async function fetchData() {
    const username = getRouteParams().username;
    try {
      setIsFetching(true);
      const otherUser = await api.users.fetch(username);
      const messages = await api.messages.fetchMessages(otherUser._id);
      setOtherUser(otherUser);
      setMessages(messages.sort((a, b) => a.created.localeCompare(b.created)));
    } catch (error) {
      if (error.response?.status === 404) {
        setDoesNotExist(true);
      } else {
        throw error;
      }
    } finally {
      setIsFetching(false);
    }
  }

  async function sendMessage(content) {
    const message = await api.messages.sendMessage(otherUser._id, content);
    setMessages(messages => [...messages, message]);
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
        .filter(message => message.userFrom._id !== user._id) // only other persons messages
        .filter(message => !message.fake); // @TODO remove this later
      if (unreadMessages.length > 0) {
        await api.messages.markRead(unreadMessages.map(message => message._id));
        setMessages(messages =>
          messages.map(message => ({ ...message, read: true })),
        );
        $broadcast('syncUnreadMessagesCount');
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
          {isFetching && (
            <LoadingContainer>
              {/* @TODO replace with a proper loader */}
              Loading initial...
            </LoadingContainer>
          )}
          {!isFetching && (
            <ThreadContainer>
              {isFetchingMore && (
                <LoadingContainer>
                  {/* @TODO replace with a proper loader */}
                  Loading...
                </LoadingContainer>
              )}
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
              {showQuickReply && (
                <QuickReply
                  onSend={content => sendMessage(content)}
                  onFocus={focus}
                />
              )}
              {showReply && (
                <ThreadReply
                  cacheKey={cacheKey}
                  onSend={content => sendMessage(content)}
                />
              )}
            </ThreadContainer>
          )}
        </div>
        {otherUser && !isExtraSmall && (
          <div className="col-sm-3 text-center">
            <Monkeybox user={user} otherUser={otherUser} />
            <ReportMemberLink username={otherUser.username} />
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
