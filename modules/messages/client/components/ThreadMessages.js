import React from 'react';
import styled from 'styled-components';
import moment from 'moment';
import { useMediaQuery } from 'react-responsive';

import InfiniteMessages from 'modules/messages/client/components/InfiniteMessages';
import Avatar from 'modules/users/client/components/Avatar.component';
import ThreadMessage from '@/modules/messages/client/components/ThreadMessage';
import Flashcard from '@/modules/messages/client/components/Flashcard';
import plainTextLength from '@/modules/core/client/filters/plain-text-length.client.filter';

const MessagesContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding-top: 30px;
  padding-right: 30px;
  @media (min-width: 768px) {
    padding-right: 0;
  }
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

export default function ThreadMessages({ user, otherUser, messages, profileMinimumLength, onFetchMore }) {
  if (messages.length === 0) {
    const hasEmptyProfile = plainTextLength(user.description) < profileMinimumLength;
    return (
      <>
        <FlexGrow/>
        {hasEmptyProfile ? <YourProfileSeemsQuiteEmpty/> : <YouHaveNotBeenTalkingYet/>}
        <FlexGrow/>
      </>
    );
  } else {
    const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });
    return (
      <InfiniteMessages component={MessagesContainer} onFetchMore={onFetchMore}>
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
    );
  }
}
