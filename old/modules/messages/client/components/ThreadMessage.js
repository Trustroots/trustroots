import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { userType } from '@/modules/users/client/users.prop-types';

function isHosting(content) {
  if (content.substr(0, 21) === '<p data-hosting="yes"') {
    return true;
  } else if (content.substr(0, 20) === '<p data-hosting="no"') {
    return false;
  } else {
    return null;
  }
}

function getHostingData(content) {
  const hosting = isHosting(content);
  if (hosting === null) return {};
  return {
    'data-hosting': hosting ? 'yes' : 'no',
  };
}

const MessageContainer = styled.div.attrs(({ message }) => ({
  className: 'message',
  ...getHostingData(message.content),
}))`
  display: flex;

  .message-main {
    flex-grow: 1;

    .avatar {
      display: none;
    }
  }

  .panel {
    display: flex;
  }

  .message-author {
    margin: 0 15px;
  }

  @media (max-width: 767px) {
    .panel-body {
      padding: 8px 15px 8px 4px;
    }
    .message-main {
      .avatar {
        display: block;
        margin: 8px;
      }
    }
    .message-author {
      display: none;
    }
  }
`;

export default function ThreadMessage({ message, user }) {
  const { t } = useTranslation('messages');

  function isMe(otherUser) {
    return otherUser._id === user._id;
  }

  const deletedUser = !message.userFrom.username;

  return (
    <MessageContainer message={message}>
      <div className="message-main">
        <div className="message-meta">
          {isMe(message.userFrom) ? (
            <span>{t('You')}</span>
          ) : !deletedUser ? (
            <a href={`/profile/${message.userFrom.username}`}>
              {message.userFrom.displayName}
            </a>
          ) : (
            <span>{t('Unknown member')}</span>
          )}
          —
          <TimeAgo date={new Date(message.created)} />
        </div>
        <div className="panel panel-default">
          <Avatar user={message.userFrom} size={24} link={!deletedUser} />
          <div
            className="panel-body"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
        </div>
      </div>
      <div className="message-author">
        <Avatar user={message.userFrom} size={32} link={!deletedUser} />
      </div>
    </MessageContainer>
  );
}

ThreadMessage.propTypes = {
  message: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    userFrom: userType.isRequired,
    created: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }),
  user: userType.isRequired,
};
