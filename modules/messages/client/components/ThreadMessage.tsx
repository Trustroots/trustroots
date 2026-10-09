import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import MessageBubble from './MessageBubble';
import { disableExternalLinks } from '../utils/message-content';

import Avatar from '@/modules/users/client/components/Avatar.component';
import TimeAgo from '@/modules/core/client/components/TimeAgo';
import { userType } from '@/modules/users/client/users.prop-types';
import type { Message, MessageUser } from '../api/messages.api';

function isHosting(content: string): boolean | null {
  if (content.substr(0, 21) === '<p data-hosting="yes"') {
    return true;
  } else if (content.substr(0, 20) === '<p data-hosting="no"') {
    return false;
  } else {
    return null;
  }
}

function getHostingData(content: string): { 'data-hosting'?: 'yes' | 'no' } {
  const hosting = isHosting(content);
  if (hosting === null) return {};
  return {
    'data-hosting': hosting ? 'yes' : 'no',
  };
}

type ThreadMessageProps = { message: Message; user: MessageUser };

export default function ThreadMessage({ message, user }: ThreadMessageProps) {
  const { t } = useTranslation('messages');

  const sentByMe = message.userFrom._id === user._id;

  const deletedUser = !message.userFrom.username;

  return (
    <MessageBubble
      {...getHostingData(message.content)}
      className={sentByMe ? 'message-sender-me' : 'message-sender-other'}
    >
      <div className="message-main">
        <div className="message-meta">
          {sentByMe ? (
            <span>{t<string>('You')}</span>
          ) : !deletedUser ? (
            <a href={`/profile/${message.userFrom.username}`}>
              {message.userFrom.displayName}
            </a>
          ) : (
            <span>{t<string>('Unknown member')}</span>
          )}
          <span aria-hidden="true">·</span>
          <TimeAgo date={new Date(message.created)} />
        </div>
        <div className="panel panel-default">
          <div
            className="panel-body"
            dangerouslySetInnerHTML={{
              __html: disableExternalLinks(message.content),
            }}
          />
        </div>
      </div>
      <div className="message-author">
        <Avatar user={message.userFrom} size={32} link={!deletedUser} />
      </div>
    </MessageBubble>
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
