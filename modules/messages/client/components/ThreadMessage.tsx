import React from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';

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

function disableExternalLinks(content: string): string {
  const template = document.createElement('template');
  template.innerHTML = content;

  for (const link of Array.from(template.content.querySelectorAll('a'))) {
    let internal = false;
    try {
      const href = link.getAttribute('href');
      if (href) {
        const url = new URL(href, window.location.href);
        internal =
          ['http:', 'https:'].includes(url.protocol) &&
          url.origin === window.location.origin;
      }
    } catch {
      // An invalid destination cannot be an internal link.
    }

    if (!internal) link.replaceWith(...Array.from(link.childNodes));
  }

  return template.innerHTML;
}

const MessageContainerBase = styled.div.attrs<{ message: Message }>(
  ({ message }) => ({
    className: 'message',
    ...getHostingData(message.content),
  }),
)`
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-bottom: 16px;

  .message-main {
    flex: 0 1 auto;
    min-width: 0;
    max-width: min(72%, 640px);
  }

  .message-author {
    flex: 0 0 32px;
    order: -1;
    margin: 0 0 2px;

    .avatar {
      margin: 0;
    }
  }

  .panel {
    margin-bottom: 0;
    border-radius: 16px;
    box-shadow: none;

    &::before,
    &::after {
      display: none;
    }
  }

  .panel-body {
    padding: 12px 16px;
    overflow-wrap: anywhere;
  }

  .message-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px;
    margin: 0 4px 4px;
    text-align: left;
  }

  &.message-sender-me {
    justify-content: flex-end;

    .message-meta {
      justify-content: flex-end;
    }

    .panel {
      background: #e1f5ed;
      border-bottom-right-radius: 4px;
    }

    &:not([data-hosting]) .panel {
      border-color: #c5e7da;
    }

    .message-author {
      display: none;
    }
  }

  &.message-sender-other .panel {
    border-bottom-left-radius: 4px;
  }

  @media (max-width: 767px) {
    gap: 6px;
    margin-bottom: 12px;

    .message-main {
      max-width: 85%;
    }

    .panel-body {
      padding: 10px 12px;
    }
  }
`;
const MessageContainer = MessageContainerBase as unknown as React.ComponentType<
  React.HTMLAttributes<HTMLDivElement> & { message: Message }
>;

type ThreadMessageProps = { message: Message; user: MessageUser };

export default function ThreadMessage({ message, user }: ThreadMessageProps) {
  const { t } = useTranslation('messages');

  const sentByMe = message.userFrom._id === user._id;

  const deletedUser = !message.userFrom.username;

  return (
    <MessageContainer
      message={message}
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
