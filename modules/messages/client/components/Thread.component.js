import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import moment from 'moment';
import { useMediaQuery } from 'react-responsive';

import { getRouteParams, $broadcast } from '@/modules/core/client/services/angular-compat';
import * as messagesAPI from '@/modules/messages/client/api/messages.api';
import * as usersAPI from '@/modules/users/client/api/users.api';
import { userType } from '@/modules/users/client/users.prop-types';
import plainTextLength from '@/modules/core/client/filters/plain-text-length.client.filter';
import Monkeybox from '@/modules/messages/client/components/Monkeybox';
import ReportMemberLink from '@/modules/support/client/components/ReportMemberLink.component';
import ThreadReply from '@/modules/messages/client/components/ThreadReply';
import ThreadMessage from 'modules/messages/client/components/ThreadMessage';
import InfiniteMessages from '@/modules/messages/client/components/InfiniteMessages';
import Flashcard from '@/modules/messages/client/components/Flashcard';
import Activate from 'modules/users/client/components/Activate';
import Avatar from '@/modules/users/client/components/Avatar.component';

// @TODO remove this stuff once ready
import range from 'lodash/range';
import faker from 'faker';
import { generateMongoId } from '@/testutils/common/data.common.testutil';

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

const quickReplies = [
  {
    host: true,
    content: 'Yes, I can host!',
  },
  {
    host: false,
    content: 'Sorry I can\'t host',
  },
  {
    write: true,
    content: 'Write back',
  },
];

function QuickReply({ onSend, onFocus }) {
  return (
    <div className="btn-toolbar" id="message-quick-reply">
      {quickReplies.map(({ write, host, content }) => {
        const className = write ? 'btn-offer-meet' : `btn-offer-hosting-${host ? 'yes' : 'no'}`;
        function onClick() {
          if (write) {
            onFocus();
          } else {
            onSend(`
              <p data-hosting="${host ? 'yes' : 'no'}">
                <b><i>${content}</i></b>
              </p>
            `);
          }
        }
        return (
          <button
            key={content}
            className={`btn btn-sm ${className}`}
            onClick={onClick}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

QuickReply.propTypes = {
  onSend: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
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

const MessagesContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding-top: 30px;
  padding-right: 30px;
  @media (min-width: 768px) {
    padding-right: 0;
  }
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
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt"/>
      <h4>You haven&apos;t been talking yet.</h4>
      <Flashcard/>
    </div>
  );
}

function YourProfileSeemsQuiteEmpty() {
  return (
    <div className="content-empty">
      <i className="icon-3x icon-messages-alt"/>
      <p className="lead">
        Your profile seems quite empty.<br/>
        Please write longer profile description before sending messages.<br/>
        <a href="/profile/edit">Edit your profile</a>
      </p>
    </div>
  );
}

export default function Thread({ user, profileMinimumLength }) {
  if (!user.public) {
    return (
      <section className="container-spacer">
        <Activate/>
      </section>
    );
  }

  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const cacheKey = `messages.thread.${user._id}-${getRouteParams().username}`;

  const userHasReplied = Boolean(messages.find(message => message.userFrom._id === user._id));
  const showQuickReply = !userHasReplied;

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

  function hasEmptyProfile() {
    return plainTextLength(user.description) < profileMinimumLength;
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
        setMessages(messages => messages.map(message => ({ ...message, read: true })));
        $broadcast('syncUnreadMessagesCount');
      }
    }
    markRead();
  }, [messages]);

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
              {messages.length > 0 ? (
                <InfiniteMessages component={MessagesContainer} onFetchMore={fetchMoreData}>
                  {isExtraSmall && (
                    <div className="message">
                      <div className="message-recipient panel panel-default">
                        <a className="panel-body" href={`/profile/${user.username}`}>
                          <Avatar user={otherUser} size={32} link={false} />
                          <h4>
                            { otherUser.displayName }
                          </h4>
                          <small className="text-muted">
                            @{ otherUser.username }
                          </small>
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="message">
                    <div className="divider divider-first text-muted">
                      <small>Conversation started {moment(messages[0].created).format('LL')}</small>
                    </div>
                  </div>
                  {messages.map(message => (
                    <ThreadMessage
                      key={message._id}
                      message={message}
                      user={user}
                    />
                  ))}
                </InfiniteMessages>
              ) : (
                <>
                  <FlexGrow/>
                  {hasEmptyProfile() ? <YourProfileSeemsQuiteEmpty/> : <YouHaveNotBeenTalkingYet/>}
                  <FlexGrow/>
                </>
              )}
              {showQuickReply && <QuickReply onSend={content => sendMessage(content)} onFocus={focus}/>}
              <ThreadReply cacheKey={cacheKey} onSend={content => sendMessage(content)}/>
            </ThreadContainer>
          )}
        </div>
        {otherUser && !isExtraSmall && (
          <div className="col-sm-3 text-center">
            <Monkeybox user={user} otherUser={otherUser}/>
            <ReportMemberLink username={otherUser.username}/>
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
