import React from 'react';
import styled from 'styled-components';
import moment from 'moment';
import { useMediaQuery } from 'react-responsive';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';

import InfiniteMessages from '@/modules/messages/client/components/InfiniteMessages';
import Avatar from '@/modules/users/client/components/Avatar.component';
import ThreadMessage from '@/modules/messages/client/components/ThreadMessage';
import { userType } from '@/modules/users/client/users.prop-types';

const MessagesContainer = styled.div`
  flex-grow: 1;
  overflow-y: auto;
  padding-top: 30px;
  padding-right: 30px;
  @media (min-width: 768px) {
    padding-right: 0;
  }
`;

export default function ThreadMessages({
  user,
  otherUser,
  messages,
  onFetchMore,
}) {
  const { t } = useTranslation('messages');
  const isExtraSmall = useMediaQuery({ maxWidth: 768 - 1 });
  return (
    <InfiniteMessages component={MessagesContainer} onFetchMore={onFetchMore}>
      {isExtraSmall && otherUser.username && (
        <div className="message">
          <div className="message-recipient panel panel-default">
            <a className="panel-body" href={`/profile/${otherUser.username}`}>
              <Avatar user={otherUser} size={32} link={false} />
              <h4>{otherUser.displayName}</h4>
              <small className="text-muted">@{otherUser.username}</small>
            </a>
          </div>
        </div>
      )}
      <div className="message">
        <div className="divider divider-first text-muted">
          <small>
            {t('Conversation started {{ date }}', {
              date: moment(messages[0].created).format('LL'),
            })}
          </small>
        </div>
      </div>
      {messages.map(message => (
        <ThreadMessage key={message._id} message={message} user={user} />
      ))}
    </InfiniteMessages>
  );
}

ThreadMessages.propTypes = {
  user: userType.isRequired,
  otherUser: userType.isRequired,
  messages: PropTypes.array.isRequired,
  onFetchMore: PropTypes.func.isRequired,
};
